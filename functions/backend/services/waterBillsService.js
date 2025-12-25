// services/waterBillsService.js
import admin from 'firebase-admin';
console.log(`[waterBillsService] module loaded from ${import.meta.url}`);

import { getDb } from '../firebase.js';
import { waterDataService } from './waterDataService.js';
import penaltyRecalculationService from './penaltyRecalculationService.js';
import { getNow } from '../../shared/services/DateService.js';
import { pesosToCentavos, centavosToPesos } from '../../shared/utils/currencyUtils.js';
import { validateCentavos } from '../../shared/utils/centavosValidation.js';

class WaterBillsService {
  constructor() {
    this.db = null;
  }

  async _initializeDb() {
    if (!this.db) {
      this.db = await getDb();
    }
  }

  /**
   * Generate quarterly bill (aggregates 3+ months of readings)
   * For quarterly billing clients (AVII), bills are stored with sequential IDs (bill-001, bill-002)
   * Each bill aggregates all readings since the last bill
   */
  async generateQuarterlyBill(clientId, year, dueDate, options = {}) {
    await this._initializeDb();
    
    // 1. Get water billing config
    const config = await this.getBillingConfig(clientId);
    
    if (config.billingPeriod !== 'quarterly') {
      throw new Error('Client is not configured for quarterly billing');
    }
    
    // 2. Find the last bill to determine starting point
    const billsRef = this.db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills');
    
    const billsSnapshot = await billsRef.get();
    // Look for quarterly bills in format YYYY-Q# (e.g., 2026-Q1, 2026-Q2)
    const quarterlyBills = billsSnapshot.docs
      .filter(doc => {
        const id = doc.id;
        return /^\d{4}-Q[1-4]$/.test(id); // Match format: 2026-Q1
      })
      .map(doc => ({
        id: doc.id,
        data: doc.data()
      }))
      .sort((a, b) => {
        // Sort by year, then quarter
        const [yearA, qA] = a.id.split('-');
        const [yearB, qB] = b.id.split('-');
        const yearDiff = parseInt(yearA) - parseInt(yearB);
        if (yearDiff !== 0) return yearDiff;
        return qA.localeCompare(qB);
      });
    
    const lastBillId = quarterlyBills.length > 0 ? quarterlyBills[quarterlyBills.length - 1].id : null;
    
    // 3. Get last bill date or fiscal year start
    let lastBillDate;
    let isFirstBill = false;
    if (lastBillId) {
      const lastBill = await billsRef.doc(lastBillId).get();
      lastBillDate = new Date(lastBill.data().billDate);
      console.log(`Last bill: ${lastBillId}, date: ${lastBillDate.toISOString()}`);
    } else {
      // No previous bills - include all readings for this fiscal year
      // Set lastBillDate to a date before any readings could exist
      lastBillDate = new Date(`${year - 1}-01-01`); // Jan 1 of previous year
      isFirstBill = true;
      console.log(`First bill - including all readings for fiscal year ${year}`);
    }
    
    // 4. Collect all readings since last bill
    const readingsRef = this.db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('readings');
    
    const readingsSnapshot = await readingsRef
      .where('year', '==', year)
      .get();
    
    const readingsToInclude = [];
    readingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Use timestamp if available, otherwise estimate from month (end of month in calendar year)
      // For fiscal year 2026 (Jul 2025 - Jun 2026):
      // - Month 0 (July) = 2025-07-31
      // - Month 1 (August) = 2025-08-31
      // - Month 6 (January) = 2026-01-31
      let readingDate;
      if (data.timestamp?.toDate) {
        readingDate = data.timestamp.toDate();
      } else {
        // Calculate calendar year and month from fiscal month
        const fiscalMonth = data.month;
        let calendarYear = year - 1; // Fiscal year 2026 starts in calendar year 2025
        let calendarMonth = fiscalMonth + 7; // Fiscal month 0 (July) = calendar month 7
        
        // Handle year wraparound (fiscal months 6-11 are in next calendar year)
        if (calendarMonth >= 13) {
          calendarMonth -= 12;
          calendarYear += 1;
        }
        
        // Create date at end of month (JavaScript months are 0-indexed)
        // Day 0 of next month = last day of current month
        readingDate = new Date(calendarYear, calendarMonth, 0);
      }
      
      if (readingDate > lastBillDate) {
        readingsToInclude.push({ 
          month: data.month, 
          docId: doc.id, 
          data: data,
          readingDate 
        });
      }
    });
    
    // Sort by month
    readingsToInclude.sort((a, b) => a.month - b.month);
    
    // 5. Determine quarter - use provided quarter from options, or auto-determine from readings
    let fiscalQuarter;
    let quarterStartMonth;
    let quarterEndMonth;
    
    if (options.quarter && options.quarter >= 1 && options.quarter <= 4) {
      // Use explicitly provided quarter
      fiscalQuarter = options.quarter;
      quarterStartMonth = (fiscalQuarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
      quarterEndMonth = quarterStartMonth + 2; // Q1=0-2, Q2=3-5, etc.
      console.log(`Using explicitly provided quarter: Q${fiscalQuarter} (months ${quarterStartMonth}-${quarterEndMonth})`);
    } else {
      // Auto-determine quarter from first reading (original behavior)
      if (readingsToInclude.length === 0) {
        throw new Error(`No new readings found since last bill (${lastBillDate.toISOString()})`);
      }
      fiscalQuarter = Math.floor(readingsToInclude[0].month / 3) + 1; // 1-4
      quarterStartMonth = (fiscalQuarter - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
      quarterEndMonth = quarterStartMonth + 2; // Q1=0-2, Q2=3-5, etc.
      console.log(`Auto-determined quarter from readings: Q${fiscalQuarter} (months ${quarterStartMonth}-${quarterEndMonth})`);
    }
    
    // Filter readings to only include those for the specified quarter
    // If quarter was explicitly provided, we need to get readings for that quarter
    // even if they're not "new" (since last bill)
    let quarterReadings;
    if (options.quarter) {
      // For explicit quarter, get all readings for that quarter from the fiscal year
      quarterReadings = [];
      for (let month = quarterStartMonth; month <= quarterEndMonth; month++) {
        const monthDoc = `${year}-${String(month).padStart(2, '0')}`;
        try {
          const monthDocRef = await readingsRef.doc(monthDoc).get();
          if (monthDocRef.exists) {
            const monthData = monthDocRef.data();
            quarterReadings.push({
              month: month,
              docId: monthDocRef.id,
              data: monthData,
              readingDate: monthData.timestamp?.toDate ? monthData.timestamp.toDate() : new Date()
            });
          }
        } catch (error) {
          console.log(`No readings found for month ${month} (${monthDoc})`);
        }
      }
      if (quarterReadings.length === 0) {
        throw new Error(`No readings found for Q${fiscalQuarter} (months ${quarterStartMonth}-${quarterEndMonth})`);
      }
    } else {
      // Original behavior: only include readings since last bill
      quarterReadings = readingsToInclude.filter(r => 
        r.month >= quarterStartMonth && r.month <= quarterEndMonth
      );
      if (quarterReadings.length === 0) {
        throw new Error(`No new readings found since last bill (${lastBillDate.toISOString()})`);
      }
    }
    
    console.log(`Found ${readingsToInclude.length} months of readings since last bill: months ${readingsToInclude.map(r => r.month).join(', ')}`);
    console.log(`Generating bill for Q${fiscalQuarter} (months ${quarterStartMonth}-${quarterEndMonth}): ${quarterReadings.length} months`);
    
    // 5b. Get prior month's readings (for consumption calculation)
    // For Q1 (months 0-2), we need month -1 (June of prior fiscal year = month 11 of prior year)
    const firstQuarterMonth = quarterReadings[0].month;
    let priorReadings = {};
    
    if (firstQuarterMonth === 0) {
      // Q1 starts in July (month 0), need June (month 11 of prior fiscal year)
      const priorYear = year - 1;
      const priorMonthDoc = `${priorYear}-11`;
      try {
        const priorDoc = await readingsRef.doc(priorMonthDoc).get();
        if (priorDoc.exists) {
          const priorData = priorDoc.data();
          // Extract readings (handle both raw values and objects)
          for (const [unitId, reading] of Object.entries(priorData.readings || {})) {
            if (typeof reading === 'number') {
              priorReadings[unitId] = reading;
            } else if (typeof reading === 'object' && reading.reading !== undefined) {
              priorReadings[unitId] = reading.reading;
            }
          }
        }
      } catch (error) {
        console.log(`No prior month readings found (${priorMonthDoc}), starting from 0`);
      }
    } else {
      // For Q2/Q3/Q4, get the last month before the quarter
      const priorMonth = firstQuarterMonth - 1;
      const priorMonthDoc = `${year}-${String(priorMonth).padStart(2, '0')}`;
      try {
        const priorDoc = await readingsRef.doc(priorMonthDoc).get();
        if (priorDoc.exists) {
          const priorData = priorDoc.data();
          for (const [unitId, reading] of Object.entries(priorData.readings || {})) {
            if (typeof reading === 'number') {
              priorReadings[unitId] = reading;
            } else if (typeof reading === 'object' && reading.reading !== undefined) {
              priorReadings[unitId] = reading.reading;
            }
          }
        }
      } catch (error) {
        console.log(`No prior month readings found (${priorMonthDoc}), starting from 0`);
      }
    }
    
    console.log(`Prior readings loaded for ${Object.keys(priorReadings).length} units`);
    
    // 5c. Calculate consumption and aggregate charges by unit
    // CRITICAL: monthNames defined here for monthlyBreakdown formatting (used later too)
    const monthNames = ['July', 'August', 'September', 'October', 'November', 'December', 
                        'January', 'February', 'March', 'April', 'May', 'June'];
    const rateInCentavos = config.ratePerM3; // Already in centavos
    const unitTotals = {};
    
    quarterReadings.forEach(reading => {
      for (const [unitId, unitReading] of Object.entries(reading.data.readings || {})) {
        if (!unitTotals[unitId]) {
          unitTotals[unitId] = { 
            totalConsumption: 0, 
            monthlyBreakdown: [],
            carWashTotal: 0,
            boatWashTotal: 0
          };
        }
        
        // Extract current meter reading (handle both raw value and object format)
        let currentReading = 0;
        let consumption = 0;
        let washes = [];
        
        if (typeof unitReading === 'number') {
          // Raw meter value (e.g., {"101": 1767})
          currentReading = unitReading;
        } else if (typeof unitReading === 'object') {
          if (unitReading.reading !== undefined) {
            currentReading = unitReading.reading;
          }
          if (unitReading.consumption !== undefined) {
            consumption = unitReading.consumption; // Pre-calculated consumption
          }
          if (unitReading.washes && Array.isArray(unitReading.washes)) {
            washes = unitReading.washes;
          }
        }
        
        // Calculate consumption if not pre-calculated
        if (consumption === 0 && currentReading > 0) {
          const priorReading = priorReadings[unitId] || 0;
          consumption = Math.max(0, currentReading - priorReading);
          priorReadings[unitId] = currentReading; // Update for next month
        }
        
        const waterCharge = validateCentavos(consumption * rateInCentavos, 'waterCharge');
        
        // Extract car wash and boat wash counts
        let carWashCount = 0;
        let boatWashCount = 0;
        
        if (washes.length > 0) {
          carWashCount = washes.filter(w => w.type === 'car').length;
          boatWashCount = washes.filter(w => w.type === 'boat').length;
        } else if (typeof unitReading === 'object') {
          carWashCount = unitReading.carWashCount || 0;
          boatWashCount = unitReading.boatWashCount || 0;
        }
        
        const carWashCharge = validateCentavos(carWashCount * (config.rateCarWash || 0), 'carWashCharge');
        const boatWashCharge = validateCentavos(boatWashCount * (config.rateBoatWash || 0), 'boatWashCharge');
        
        unitTotals[unitId].totalConsumption += consumption;
        
        // Build monthly breakdown entry (matching old structure format exactly)
        // CRITICAL: month must be string name (e.g., "July"), not number, to match old structure
        const monthName = monthNames[reading.month];
        const monthlyTotal = validateCentavos(
          waterCharge + carWashCharge + boatWashCharge,
          `monthlyTotal[${unitId}][${reading.month}]`
        );
        
        const monthlyEntry = {
          washes: washes.length > 0 ? washes : [], // Always include washes array (even if empty)
          month: monthName, // String month name (e.g., "July") - CRITICAL: matches old structure
          consumption: consumption,
          waterCharge: waterCharge,
          carWashCount: carWashCount,
          boatWashCount: boatWashCount,
          carWashCharge: carWashCharge,
          boatWashCharge: boatWashCharge,
          totalAmount: monthlyTotal // Required field matching old structure
        };
        
        unitTotals[unitId].monthlyBreakdown.push(monthlyEntry);
        unitTotals[unitId].carWashTotal += carWashCharge;
        unitTotals[unitId].boatWashTotal += boatWashCharge;
      }
    });
    
    // 6. Generate bill ID using fiscal year-quarter format (e.g., 2026-Q1)
    // fiscalQuarter already calculated above (from options or auto-determined)
    const newBillId = `${year}-Q${fiscalQuarter}`;
    console.log(`Generating bill ID: ${newBillId}`);
    
    // Check if bill already exists - protect against overwriting bills with payments
    const existingBill = await billsRef.doc(newBillId).get();
    if (existingBill.exists) {
      const existingData = existingBill.data();
      // Check if any unit has payments - if so, block overwrite to prevent data loss
      const hasPayments = Object.values(existingData.bills?.units || {})
        .some(unit => unit.payments && unit.payments.length > 0);
      
      if (hasPayments) {
        throw new Error(`Cannot regenerate bill ${newBillId} - it has existing payments. Delete payments first or use a different bill ID.`);
      }
      console.log(`⚠️  Warning: Bill ${newBillId} exists but has no payments. It will be overwritten.`);
    }
    
    // 7. Calculate penalty start date (dueDate + penaltyDays)
    const penaltyStartDate = this._calculatePenaltyStartDate(dueDate, config.penaltyDays || 30);
    
    // 8. Run penalty recalculation before generating new bills
    console.log(`Running penalty recalculation for client ${clientId} before bill generation...`);
    await penaltyRecalculationService.recalculatePenaltiesForClient(clientId);
    
    // 9. Build bills for each unit
    const bills = {};
    let totalNewCharges = 0;
    let unitsWithBills = 0;
    
    for (const [unitId, unitData] of Object.entries(unitTotals)) {
      // Calculate total charges
      const totalWaterCharge = validateCentavos(
        unitData.totalConsumption * rateInCentavos, 
        'totalWaterCharge'
      );
      const totalAmount = validateCentavos(
        totalWaterCharge + unitData.carWashTotal + unitData.boatWashTotal,
        'totalAmount'
      );
      
      if (totalAmount > 0) {
        // Calculate aggregate wash counts across all months
        const totalCarWashCount = unitData.monthlyBreakdown.reduce((sum, m) => sum + (m.carWashCount || 0), 0);
        const totalBoatWashCount = unitData.monthlyBreakdown.reduce((sum, m) => sum + (m.boatWashCount || 0), 0);
        
        // Collect all washes arrays from monthly breakdowns
        const allWashes = unitData.monthlyBreakdown
          .filter(m => m.washes && m.washes.length > 0)
          .flatMap(m => m.washes);
        
        // CRITICAL: Unit bill structure must match importService.js generateQuarterBills() exactly
        // Field ordering should match old structure for Statement of Account compatibility
        bills[unitId] = {
          // Preserve washes array (always an array, even if empty) - matches old structure
          washes: allWashes,
          
          // Service counts (matching old structure field order)
          carWashCount: totalCarWashCount,
          boatWashCount: totalBoatWashCount,
          
          // Detailed charges (ALL IN CENTAVOS) - matching old structure
          carWashCharge: unitData.carWashTotal,
          boatWashCharge: unitData.boatWashTotal,
          importedLavadoCharge: 0, // Always 0 for UI-generated bills (imports have this from unitAccounting.json)
          
          // Penalty tracking (matching old structure)
          penaltyAmount: 0, // New bills start with no penalty
          penaltyPaid: 0,
          lastPenaltyUpdate: getNow().toISOString(),
          
          // Data source metadata (matching old structure for compatibility)
          dataSource: 'system', // UI-generated bills use 'system' (imports use 'sheets_import')
          importedAt: getNow().toISOString(), // Timestamp for compatibility
          
          // Payment tracking (matching old structure)
          payments: [],
          paidAmount: 0,
          basePaid: 0,
          status: 'unpaid',
          
          // Core financial fields (ALL IN CENTAVOS) - matching old structure
          totalAmount: totalAmount,
          monthlyBreakdown: unitData.monthlyBreakdown, // Array format matching old structure
          currentCharge: totalAmount,
          waterCharge: totalWaterCharge,
          
          // Consumption summary (matching old structure)
          totalConsumption: unitData.totalConsumption
        };
        
        totalNewCharges += totalAmount;
        unitsWithBills++;
      }
    }
    
    // 10. Create bills document (fiscalQuarter already calculated above)
    // CRITICAL: Structure must match importService.js generateQuarterBills() exactly
    // monthNames already defined above for monthlyBreakdown formatting
    
    // Calculate billDate as start of first month in quarter (matching importService logic)
    // Q1 (months 0-2): July = month 0, so billDate should be July 1
    // Q2 (months 3-5): October = month 3, so billDate should be Oct 1
    const firstReadingMonth = quarterReadings[0].month;
    const fiscalYearStartMonth = config.fiscalYearStartMonth || 7;
    
    // Calculate calendar month and year for billDate
    let billDateYear = year - 1; // Fiscal year 2026 starts in calendar year 2025
    let billDateMonth = firstReadingMonth + fiscalYearStartMonth - 1; // Adjust for fiscal year start
    
    // Handle year wraparound
    if (billDateMonth >= 12) {
      billDateMonth -= 12;
      billDateYear += 1;
    }
    
    // billDate should be the 1st of the first month in the quarter
    // Format as ISO timestamp in UTC (like old structure: "2025-07-01T05:00:00.000Z")
    const billDateObj = new Date(billDateYear, billDateMonth, 1);
    const billDateISO = billDateObj.toISOString(); // UTC format
    
    // VALIDATE AND CORRECT dueDate year based on quarter (CRITICAL FIX)
    // For Q1 FY2026 (July-September 2025), dueDate should be October 2025, not 2026
    // Calculate expected dueDate year: month after last month of quarter
    const lastMonthInQuarter = quarterReadings[quarterReadings.length - 1].month;
    let expectedDueDateYear = year - 1; // Start with previous calendar year
    let expectedDueDateMonth = lastMonthInQuarter + fiscalYearStartMonth + 1; // +1 for NEXT month after quarter end
    
    // Handle year wraparound for expected due date
    if (expectedDueDateMonth > 12) {
      expectedDueDateMonth -= 12;
      expectedDueDateYear += 1;
    }
    
    // Parse and validate dueDate from frontend
    let dueDateISO;
    if (typeof dueDate === 'string') {
      // Parse as Cancun local date
      const dueDateObj = new Date(dueDate + 'T00:00:00-05:00');
      let dueDateYear = dueDateObj.getFullYear();
      let dueDateMonth = dueDateObj.getMonth() + 1; // JavaScript months are 0-indexed
      const dueDateDay = dueDateObj.getDate();
      
      // CRITICAL VALIDATION: Correct year if it doesn't match expected quarter
      // If dueDate year is wrong (e.g., 2026 for Q1 FY2026 when it should be 2025), fix it
      if (dueDateMonth === expectedDueDateMonth && dueDateYear !== expectedDueDateYear) {
        console.log(`⚠️  Correcting dueDate year: ${dueDateYear} → ${expectedDueDateYear} for Q${fiscalQuarter} FY${year}`);
        dueDateYear = expectedDueDateYear;
      }
      
      // Format as ISO string with Cancun timezone offset (matching old structure exactly)
      dueDateISO = `${dueDateYear}-${String(dueDateMonth).padStart(2, '0')}-${String(dueDateDay).padStart(2, '0')}T00:00:00.000-05:00`;
    } else {
      // If dueDate is a Date object, convert to string first
      const dueDateStr = typeof dueDate === 'object' && dueDate.toISOString 
        ? dueDate.toISOString().split('T')[0] 
        : String(dueDate);
      const dueDateObj = new Date(dueDateStr + 'T00:00:00-05:00');
      let dueDateYear = dueDateObj.getFullYear();
      let dueDateMonth = dueDateObj.getMonth() + 1;
      const dueDateDay = dueDateObj.getDate();
      
      // Apply same validation
      if (dueDateMonth === expectedDueDateMonth && dueDateYear !== expectedDueDateYear) {
        console.log(`⚠️  Correcting dueDate year: ${dueDateYear} → ${expectedDueDateYear} for Q${fiscalQuarter} FY${year}`);
        dueDateYear = expectedDueDateYear;
      }
      
      dueDateISO = `${dueDateYear}-${String(dueDateMonth).padStart(2, '0')}-${String(dueDateDay).padStart(2, '0')}T00:00:00.000-05:00`;
    }
    
    // Build quarterMonths array (matching old structure format)
    const quarterMonthsArray = quarterReadings.map(r => monthNames[r.month]);
    
    // CRITICAL: Structure must match importService.js generateQuarterBills() EXACTLY
    // Field order: billDate, dueDate, penaltyStartDate FIRST, then billingPeriod, fiscalYear, etc.
    const billsData = {
      billDate: billDateISO, // ISO timestamp in UTC format (matching old structure)
      dueDate: dueDateISO, // ISO string with Cancun timezone offset (matching old structure)
      penaltyStartDate: penaltyStartDate, // Already formatted by _calculatePenaltyStartDate
      billingPeriod: 'quarterly', // CRITICAL: Must be exactly this string
      fiscalYear: year,
      fiscalQuarter: fiscalQuarter, // 1-4 (Q1, Q2, Q3, Q4)
      quarterMonths: quarterMonthsArray, // Human-readable month names array
      readingsIncluded: quarterReadings.map(r => ({ 
        month: r.month, 
        label: `${monthNames[r.month]} usage`,
        docId: r.docId 
      })),
      configSnapshot: {
        ratePerM3: config.ratePerM3,
        minimumCharge: 0, // Always 0 - no minimum charge (stored for compatibility with old structure)
        penaltyRate: config.penaltyRate || 0.05,
        penaltyDays: config.penaltyDays || 30,
        currency: config.currency || 'MXN',
        currencySymbol: config.currencySymbol || '$',
        rateCarWash: config.rateCarWash || 0,
        rateBoatWash: config.rateBoatWash || 0,
        compoundPenalty: config.compoundPenalty || false
      },
      bills: {
        units: bills
      },
      summary: {
        totalUnits: unitsWithBills,
        totalNewCharges: totalNewCharges,
        totalBilled: totalNewCharges,
        totalUnpaid: totalNewCharges,
        totalPaid: 0,
        currency: config.currency || 'MXN',
        currencySymbol: config.currencySymbol || '$'
      },
      metadata: {
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: 'system', // UI-generated bills use 'system' (imports use 'import-service')
        penaltiesApplied: false
      }
    };
    
    // 11. VALIDATION: Verify structure matches expected format (prevent future regressions)
    this._validateBillStructure(billsData, fiscalQuarter, year);
    
    // 12. Ensure waterBills document exists (prevent ghost status)
    const waterBillsRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills');
    
    const waterBillsDoc = await waterBillsRef.get();
    if (!waterBillsDoc.exists) {
      console.log('🔧 Creating waterBills document to prevent ghost status...');
      await waterBillsRef.set({
        _purgeMarker: 'DO_NOT_DELETE',
        _createdBy: 'waterBillsService',
        _createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _structure: 'waterBills'
      });
      console.log('✅ waterBills document created with properties');
    }
    
    // 13. Save bills document with sequential ID
    await billsRef.doc(newBillId).set(billsData);
    
    console.log(`✅ Bill ${newBillId} generated: ${unitsWithBills} units, ${quarterReadings.length} months, total: ${totalNewCharges} centavos`);
    
    // 14. Invalidate cache
    waterDataService.invalidate(clientId, year);
    
    // 15. Return billsData with bill ID for audit logging
    return {
      ...billsData,
      _billId: newBillId  // Add bill ID to response
    };
  }

  /**
   * Generate bills for a specific month using aggregated data
   * Now includes penalty calculation for unpaid previous bills
   */
  async generateBills(clientId, year, month, options = {}) {
    await this._initializeDb();
    
    // 1. Get optimized data for ONLY this month (not full year)
    const monthData = await waterDataService.buildSingleMonthData(clientId, year, month);
    
    if (!monthData) {
      throw new Error(`No data found for month ${month} of fiscal year ${year}`);
    }
    
    // 2. Check if bills already exist for this month
    const monthStr = String(month).padStart(2, '0');
    const existingBillsDoc = await this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(`${year}-${monthStr}`)
      .get();
    
    if (existingBillsDoc.exists) {
      throw new Error(`Bills already exist for ${monthData.monthName} ${monthData.calendarYear}`);
    }
    
    // 3. Get water billing config
    const config = await this.getBillingConfig(clientId);
    const rateInCentavos = config.ratePerM3; // Already in centavos from config
    const penaltyRate = config.penaltyRate || 0.05; // 5% per month default
    
    // 4. Calculate or use provided billDate and dueDate (MOVE EARLIER)
    // During import, billDate should be the actual bill month date (not current date)
    const billDate = options.billDate ? new Date(options.billDate) : getNow();
    const dueDate = options.dueDate ? (typeof options.dueDate === 'string' ? options.dueDate : new Date(options.dueDate).toISOString()) : this._calculateDueDate(billDate, config);
    
    // 5. CRITICAL: Run penalty recalculation before generating new bills
    console.log(`Running penalty recalculation for client ${clientId} before bill generation...`);
    await penaltyRecalculationService.recalculatePenaltiesForClient(clientId);
    
    // 6. Generate new bills from pre-calculated consumption
    const bills = {};
    let totalNewCharges = 0;
    let unitsWithBills = 0;
    
    for (const [unitId, data] of Object.entries(monthData.units || {})) {
      
      // Extract car wash and boat wash counts from washes array or legacy count fields
      let carWashCount = 0;
      let boatWashCount = 0;
      
      // Check if washes array exists (new format)
      if (data.currentReading?.washes && Array.isArray(data.currentReading.washes)) {
        carWashCount = data.currentReading.washes.filter(wash => wash.type === 'car').length;
        boatWashCount = data.currentReading.washes.filter(wash => wash.type === 'boat').length;
      } else {
        // Fallback to legacy count fields for backwards compatibility
        carWashCount = data.currentReading?.carWashCount || 0;
        boatWashCount = data.currentReading?.boatWashCount || 0;
      }
      
      // Calculate water consumption charges (in centavos)
      // CRITICAL: Validate all calculations to prevent floating point contamination
      let waterCharge = 0;
      if (data.consumption > 0 || config.minimumCharge > 0) {
        const consumptionCharge = validateCentavos(data.consumption * rateInCentavos, 'consumptionCharge');
        const minimumCharge = validateCentavos(config.minimumCharge || 0, 'minimumCharge');
        waterCharge = Math.max(consumptionCharge, minimumCharge);
      }
      
      // Calculate car wash charges (config values already in centavos)
      const carWashCharge = validateCentavos(carWashCount * (config.rateCarWash || 0), 'carWashCharge');
      
      // Calculate boat wash charges (config values already in centavos)
      const boatWashCharge = validateCentavos(boatWashCount * (config.rateBoatWash || 0), 'boatWashCharge');
      
      // Total charge for this month (in centavos)
      const newCharge = validateCentavos(waterCharge + carWashCharge + boatWashCharge, 'newCharge');
      
      // Removed Unit 203 debug logging to prevent confusion
      
      // Only create a bill if there are new charges for this month
      if (newCharge > 0) {
        // Generate bill notes for this unit
        const billNotes = this.generateWaterBillNotes(
          data.consumption, 
          carWashCount, 
          boatWashCount, 
          monthData.monthName + ' ' + monthData.calendarYear
        );
        
        bills[unitId] = {
          // Meter readings (match existing order)
          priorReading: data.priorReading,
          currentReading: data.currentReading?.reading || data.currentReading,
          consumption: data.consumption,
          
          // Service counts for billing transparency
          carWashCount: carWashCount,
          boatWashCount: boatWashCount,
          
          // Preserve original washes array for UI consumption
          washes: data.currentReading?.washes || [],
          
          // Detailed charges breakdown (ALL IN CENTAVOS - integers)
          // CRITICAL: Final validation before Firestore write
          waterCharge: validateCentavos(waterCharge, 'waterCharge'),
          carWashCharge: validateCentavos(carWashCharge, 'carWashCharge'),
          boatWashCharge: validateCentavos(boatWashCharge, 'boatWashCharge'),
          
          // Core financial fields (ALL IN CENTAVOS - integers, clean - no previousBalance/previousPenalty)
          currentCharge: newCharge,            // In centavos (already validated above)
          penaltyAmount: 0,                    // New bills start with no penalty
          totalAmount: newCharge,              // currentCharge + penaltyAmount (0 for new), in centavos
          status: 'unpaid',
          paidAmount: 0,                       // In centavos
          
          // Bill notes for detailed breakdown
          billNotes: billNotes,
          
          // Timestamp
          lastPenaltyUpdate: getNow().toISOString(),
          
          // Payment tracking (keep for payment service compatibility, in centavos)
          penaltyPaid: 0,
          basePaid: 0                          // Track base charge payments separately (in centavos)
        };
        
        totalNewCharges += newCharge;
        unitsWithBills++;
      }
    }
    
    // Add validation to prevent field recreation
    const ALLOWED_BILL_FIELDS = [
      'priorReading', 'currentReading', 'consumption',
      'carWashCount', 'boatWashCount', 'washes',
      'waterCharge', 'carWashCharge', 'boatWashCharge',
      'currentCharge', 'penaltyAmount', 'totalAmount',
      'status', 'paidAmount', 'penaltyPaid', 'basePaid',
      'billNotes', 'lastPenaltyUpdate', 'lastPayment',
      'payments', // Array of payment entries with transaction IDs
      'previousBalance' // Carryover from previous months (in centavos)
    ];

    // Clean any extra fields that might have been added
    for (const unitId in bills) {
      const cleanedBill = {};
      for (const field of ALLOWED_BILL_FIELDS) {
        if (bills[unitId][field] !== undefined) {
          cleanedBill[field] = bills[unitId][field];
        }
      }
      bills[unitId] = cleanedBill;
    }
    
    // 7. Create bills document with penalty information
    const billsData = {
      billDate: billDate.toISOString(),
      dueDate: dueDate,
      billingPeriod: `${monthData.monthName} ${monthData.calendarYear}`,
      fiscalYear: year,
      fiscalMonth: month,
      configSnapshot: {
        ratePerM3: config.ratePerM3,
        penaltyRate: penaltyRate,
        currency: config.currency || 'MXN',
        currencySymbol: config.currencySymbol || '$',
        minimumCharge: config.minimumCharge || 0,
        compoundPenalty: config.compoundPenalty || false
      },
      bills: {
        units: bills
      },
      summary: {
        totalUnits: unitsWithBills,
        totalNewCharges: totalNewCharges,        // New water charges this month only (in centavos)
        totalBilled: totalNewCharges,            // Just this month's charges (in centavos)
        totalUnpaid: totalNewCharges,            // Just this month's charges (new bills are unpaid, in centavos)
        totalPaid: 0,                            // New bills start unpaid (in centavos)
        currency: config.currency || 'MXN',
        currencySymbol: config.currencySymbol || '$'
      },
      metadata: {
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: 'system',
        readingsDocId: `${year}-${monthStr}`,
        penaltiesApplied: false
      }
    };
    
    // 8. CRITICAL FIX: Ensure waterBills document has properties to prevent ghost status
    const waterBillsRef = this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills');
    
    // Check if waterBills document exists, if not create it with a property
    const waterBillsDoc = await waterBillsRef.get();
    if (!waterBillsDoc.exists) {
      console.log('🔧 Creating waterBills document to prevent ghost status...');
      await waterBillsRef.set({
        _purgeMarker: 'DO_NOT_DELETE',
        _createdBy: 'waterBillsService',
        _createdAt: admin.firestore.FieldValue.serverTimestamp(),
        _structure: 'waterBills'
      });
      console.log('✅ waterBills document created with properties');
    }
    
    // 8. Save bills document
    await this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(`${year}-${monthStr}`)
      .set(billsData);
    
    // 9. Update previous unpaid bills to mark penalties as applied
    await this._markPenaltiesApplied(clientId, year, month);
    
    // 10. CRITICAL: Invalidate cache so next fetch shows bills
    waterDataService.invalidate(clientId, year);
    
    return billsData;
  }

  /**
   * Get bills for a specific month
   */
  async getBills(clientId, year, month, unpaidOnly = false) {
    await this._initializeDb();
    
    const monthStr = String(month).padStart(2, '0');
    const doc = await this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(`${year}-${monthStr}`)
      .get();
    
    if (!doc.exists) {
      return null;
    }
    
    const billsData = doc.data();
    
    // If unpaidOnly, filter out paid bills
    if (unpaidOnly && billsData.bills?.units) {
      const unpaidBills = {};
      for (const [unitId, bill] of Object.entries(billsData.bills.units)) {
        if (bill.status === 'unpaid') {
          unpaidBills[unitId] = bill;
        }
      }
      
      return {
        ...billsData,
        bills: {
          units: unpaidBills
        }
      };
    }
    
    return billsData;
  }

  /**
   * Check if a bill exists for a month (lightweight - document existence only)
   * For monthly billing: checks if document {year}-{month} exists
   * For quarterly billing: determines quarter and checks if {year}-Q{quarter} exists
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @param {number} month - Fiscal month (0-11)
   * @returns {Promise<boolean>} True if bill document exists
   */
  async billExists(clientId, year, month) {
    await this._initializeDb();
    
    // Get billing config to determine monthly vs quarterly
    const config = await this.getBillingConfig(clientId);
    const billingPeriod = config.billingPeriod || 'monthly';
    
    const monthStr = String(month).padStart(2, '0');
    let docId;
    
    if (billingPeriod === 'quarterly') {
      // Calculate which quarter this month belongs to
      // Q1 = months 0-2 (July-Sept), Q2 = 3-5 (Oct-Dec), Q3 = 6-8 (Jan-Mar), Q4 = 9-11 (Apr-Jun)
      const quarter = Math.floor(month / 3) + 1; // Q1=1, Q2=2, Q3=3, Q4=4
      docId = `${year}-Q${quarter}`;
    } else {
      // Monthly billing: document ID is {year}-{month}
      docId = `${year}-${monthStr}`;
    }
    
    // Just check if document exists (no data loading)
    const doc = await this.db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(docId)
      .get();
    
    return doc.exists;
  }

  /**
   * Batch check which months have bills (lightweight - document existence only)
   * Returns a map of month -> boolean indicating if bills exist
   * @param {string} clientId - Client ID
   * @param {number} year - Fiscal year
   * @returns {Promise<Object>} Map of month (0-11) -> boolean
   */
  async getBillsExistenceForYear(clientId, year) {
    await this._initializeDb();
    
    // Get billing config to determine monthly vs quarterly
    const config = await this.getBillingConfig(clientId);
    const billingPeriod = config.billingPeriod || 'monthly';
    
    const docRefs = [];
    const monthKeys = [];
    
    if (billingPeriod === 'quarterly') {
      // For quarterly: check Q1, Q2, Q3, Q4 documents
      // Map each month to its quarter
      const quarterMap = {}; // quarter -> months array
      for (let month = 0; month < 12; month++) {
        const quarter = Math.floor(month / 3) + 1;
        if (!quarterMap[quarter]) {
          quarterMap[quarter] = [];
          const docId = `${year}-Q${quarter}`;
          docRefs.push(
            this.db
              .collection('clients').doc(clientId)
              .collection('projects').doc('waterBills')
              .collection('bills').doc(docId)
          );
          monthKeys.push(quarter);
        }
        quarterMap[quarter].push(month);
      }
      
      // Batch fetch all quarterly bill documents
      const snapshots = await this.db.getAll(...docRefs);
      
      // Build results map: all months in a quarter get the same value
      const results = {};
      snapshots.forEach((snapshot, index) => {
        const quarter = monthKeys[index];
        const exists = snapshot.exists;
        // All months in this quarter have the same bill status
        const quarterMonths = quarterMap[quarter];
        quarterMonths.forEach(month => {
          results[month] = exists;
        });
      });
      
      return results;
    } else {
      // Monthly billing: check each month individually
      for (let month = 0; month < 12; month++) {
        const monthStr = String(month).padStart(2, '0');
        const docId = `${year}-${monthStr}`;
        docRefs.push(
          this.db
            .collection('clients').doc(clientId)
            .collection('projects').doc('waterBills')
            .collection('bills').doc(docId)
        );
        monthKeys.push(month);
      }
      
      // Batch fetch all monthly bill documents
      const snapshots = await this.db.getAll(...docRefs);
      
      // Build results map
      const results = {};
      snapshots.forEach((snapshot, index) => {
        const month = monthKeys[index];
        results[month] = snapshot.exists;
      });
      
      return results;
    }
  }

  /**
   * Get all quarterly bills for a fiscal year
   * Returns bills in quarterly format with YYYY-Q# IDs (e.g., 2026-Q1, 2026-Q2)
   */
  async getQuarterlyBillsForYear(clientId, year) {
    await this._initializeDb();
    
    const billsRef = this.db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills');
    
    // Get all bills for this year
    const snapshot = await billsRef.get();
    
    const quarterlyBills = [];
    const quarterlyPattern = /^\d{4}-Q[1-4]$/;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const billId = doc.id;
      
      // Include only quarterly bills (YYYY-Q#) for this fiscal year
      if (quarterlyPattern.test(billId) && data.fiscalYear === year && data.billingPeriod === 'quarterly') {
        quarterlyBills.push({
          ...data,
          _billId: billId
        });
      }
    });
    
    // Sort by quarter (Q1, Q2, Q3, Q4)
    quarterlyBills.sort((a, b) => {
      const qA = parseInt(a._billId.split('-Q')[1]);
      const qB = parseInt(b._billId.split('-Q')[1]);
      return qA - qB;
    });
    
    // Calculate penalties dynamically for display
    // (Penalties are calculated on-the-fly, not stored in bills)
    const config = await this.getBillingConfig(clientId);
    const currentDate = getNow();
    
    quarterlyBills.forEach(bill => {
      if (bill.bills && bill.bills.units) {
        Object.entries(bill.bills.units).forEach(([unitId, unitBill]) => {
          // Only calculate penalties for unpaid bills
          if (unitBill.status !== 'paid' && bill.dueDate) {
            const penaltyResult = penaltyRecalculationService.calculatePenaltyForBill(
              unitBill,
              currentDate,
              bill.dueDate,
              config
            );
            
            // Update penalty amounts for display (don't persist to DB)
            unitBill.penaltyAmount = penaltyResult.penaltyAmount;
            unitBill.totalAmount = unitBill.currentCharge + penaltyResult.penaltyAmount;
          }
        });
      }
    });
    
    return quarterlyBills;
  }

  /**
   * Get billing configuration
   */
  async getBillingConfig(clientId) {
    await this._initializeDb();
    
    const doc = await this.db
      .collection('clients').doc(clientId)
      .collection('config').doc('waterBills')
      .get();
    
    if (!doc.exists) {
      throw new Error('Water billing configuration not found');
    }
    
    return doc.data();
  }

  /**
   * Get unpaid bills using stored penalty amounts (from penalty recalculation service)
   * This replaces the old dynamic penalty calculation with stored data
   */
  async _getUnpaidBillsWithStoredPenalties(clientId, currentYear, currentMonth) {
    await this._initializeDb();
    
    const unpaidByUnit = {};
    
    // Check all previous months in the fiscal year
    for (let month = 0; month < currentMonth; month++) {
      const monthStr = String(month).padStart(2, '0');
      const billDoc = await this.db
        .collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(`${currentYear}-${monthStr}`)
        .get();
      
      if (billDoc.exists) {
        const billData = billDoc.data();
        const monthsOverdue = currentMonth - month; // How many months since this bill
        
        for (const [unitId, bill] of Object.entries(billData.bills.units || {})) {
          // Check if bill has any unpaid balance (regardless of status)
          const billTotal = (bill.previousBalance || 0) + (bill.currentCharge || 0) + (bill.penaltyAmount || 0);
          if (billTotal > bill.paidAmount) {
            const unpaidAmount = billTotal - bill.paidAmount;
            
            // Initialize unit record if needed
            if (!unpaidByUnit[unitId]) {
              unpaidByUnit[unitId] = {
                previousBalance: 0,
                penaltyAmount: 0,
                totalCarryover: 0,
                monthsOverdue: 0,
                details: []
              };
            }
            
            // Use STORED penalty amount (already calculated by recalc service)
            const storedPenalty = bill.penaltyAmount || 0;
            
            // Add to unit's totals using stored penalty data
            unpaidByUnit[unitId].previousBalance += unpaidAmount;
            unpaidByUnit[unitId].penaltyAmount += storedPenalty;
            unpaidByUnit[unitId].totalCarryover += (unpaidAmount + storedPenalty);
            unpaidByUnit[unitId].monthsOverdue = Math.max(unpaidByUnit[unitId].monthsOverdue, monthsOverdue);
            unpaidByUnit[unitId].details.push({
              month: billData.billingPeriod,
              amount: unpaidAmount,
              penalty: storedPenalty,
              monthsOverdue: monthsOverdue,
              lastPenaltyUpdate: bill.lastPenaltyUpdate || 'not-calculated'
            });
          }
        }
      }
    }
    
    // Also check previous fiscal year if we're in early months
    if (currentMonth < 3) {
      // Check last 3 months of previous fiscal year
      for (let month = 9; month < 12; month++) {
        const monthStr = String(month).padStart(2, '0');
        const billDoc = await this.db
          .collection('clients').doc(clientId)
          .collection('projects').doc('waterBills')
          .collection('bills').doc(`${currentYear - 1}-${monthStr}`)
          .get();
        
        if (billDoc.exists) {
          const billData = billDoc.data();
          const monthsOverdue = currentMonth + (12 - month); // Months from previous fiscal year
          
          for (const [unitId, bill] of Object.entries(billData.bills.units || {})) {
            if (bill.totalAmount > bill.paidAmount) {
              const unpaidAmount = bill.totalAmount - bill.paidAmount;
              
              if (!unpaidByUnit[unitId]) {
                unpaidByUnit[unitId] = {
                  previousBalance: 0,
                  penaltyAmount: 0,
                  totalCarryover: 0,
                  monthsOverdue: 0,
                  details: []
                };
              }
              
              // Use STORED penalty amount from previous fiscal year
              const storedPenalty = bill.penaltyAmount || 0;
              
              unpaidByUnit[unitId].previousBalance += unpaidAmount;
              unpaidByUnit[unitId].penaltyAmount += storedPenalty;
              unpaidByUnit[unitId].totalCarryover += (unpaidAmount + storedPenalty);
              unpaidByUnit[unitId].monthsOverdue = Math.max(unpaidByUnit[unitId].monthsOverdue, monthsOverdue);
              unpaidByUnit[unitId].details.push({
                month: billData.billingPeriod,
                amount: unpaidAmount,
                penalty: storedPenalty,
                monthsOverdue: monthsOverdue,
                lastPenaltyUpdate: bill.lastPenaltyUpdate || 'not-calculated'
              });
            }
          }
        }
      }
    }
    
    return unpaidByUnit;
  }

  /**
   * Get unpaid bills from previous months and calculate penalties
   * Penalties are 5% per month, compounded if configured
   * DEPRECATED: Use _getUnpaidBillsWithStoredPenalties instead
   */
  async _getUnpaidBillsWithPenalties(clientId, currentYear, currentMonth, penaltyRate) {
    await this._initializeDb();
    
    const unpaidByUnit = {};
    
    // Check all previous months in the fiscal year
    for (let month = 0; month < currentMonth; month++) {
      const monthStr = String(month).padStart(2, '0');
      const billDoc = await this.db
        .collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(`${currentYear}-${monthStr}`)
        .get();
      
      if (billDoc.exists) {
        const billData = billDoc.data();
        const monthsOverdue = currentMonth - month; // How many months since this bill
        
        for (const [unitId, bill] of Object.entries(billData.bills.units || {})) {
          // Check if bill has any unpaid balance (regardless of status)
          const billTotal = (bill.previousBalance || 0) + (bill.currentCharge || 0) + (bill.penaltyAmount || 0);
          if (billTotal > bill.paidAmount) {
            const unpaidAmount = billTotal - bill.paidAmount;
            
            // Initialize unit record if needed
            if (!unpaidByUnit[unitId]) {
              unpaidByUnit[unitId] = {
                previousBalance: 0,
                penaltyAmount: 0,
                totalCarryover: 0,
                monthsOverdue: 0,
                details: []
              };
            }
            
            // Calculate penalty (5% per month on the unpaid amount)
            let penalty = 0;
            const config = billData.configSnapshot || {};
            
            if (config.compoundPenalty) {
              // Compound: Amount * (1 + rate)^months - Amount
              penalty = unpaidAmount * (Math.pow(1 + penaltyRate, monthsOverdue) - 1);
            } else {
              // Simple: Amount * rate * months
              penalty = unpaidAmount * penaltyRate * monthsOverdue;
            }
            
            // Add to unit's totals
            unpaidByUnit[unitId].previousBalance += unpaidAmount;
            unpaidByUnit[unitId].penaltyAmount += penalty;
            unpaidByUnit[unitId].totalCarryover += (unpaidAmount + penalty);
            unpaidByUnit[unitId].monthsOverdue = Math.max(unpaidByUnit[unitId].monthsOverdue, monthsOverdue);
            unpaidByUnit[unitId].details.push({
              month: billData.billingPeriod,
              amount: unpaidAmount,
              penalty: penalty,
              monthsOverdue: monthsOverdue
            });
          }
        }
      }
    }
    
    // Also check previous fiscal year if we're in early months
    if (currentMonth < 3) {
      // Check last 3 months of previous fiscal year
      for (let month = 9; month < 12; month++) {
        const monthStr = String(month).padStart(2, '0');
        const billDoc = await this.db
          .collection('clients').doc(clientId)
          .collection('projects').doc('waterBills')
          .collection('bills').doc(`${currentYear - 1}-${monthStr}`)
          .get();
        
        if (billDoc.exists) {
          const billData = billDoc.data();
          const monthsOverdue = currentMonth + (12 - month); // Months from previous fiscal year
          
          for (const [unitId, bill] of Object.entries(billData.bills.units || {})) {
            if (bill.totalAmount > bill.paidAmount) {
              const unpaidAmount = bill.totalAmount - bill.paidAmount;
              
              if (!unpaidByUnit[unitId]) {
                unpaidByUnit[unitId] = {
                  previousBalance: 0,
                  penaltyAmount: 0,
                  totalCarryover: 0,
                  monthsOverdue: 0,
                  details: []
                };
              }
              
              const config = billData.configSnapshot || {};
              let penalty = 0;
              
              if (config.compoundPenalty) {
                penalty = unpaidAmount * (Math.pow(1 + penaltyRate, monthsOverdue) - 1);
              } else {
                penalty = unpaidAmount * penaltyRate * monthsOverdue;
              }
              
              unpaidByUnit[unitId].previousBalance += unpaidAmount;
              unpaidByUnit[unitId].penaltyAmount += penalty;
              unpaidByUnit[unitId].totalCarryover += (unpaidAmount + penalty);
              unpaidByUnit[unitId].monthsOverdue = Math.max(unpaidByUnit[unitId].monthsOverdue, monthsOverdue);
              unpaidByUnit[unitId].details.push({
                month: billData.billingPeriod,
                amount: unpaidAmount,
                penalty: penalty,
                monthsOverdue: monthsOverdue
              });
            }
          }
        }
      }
    }
    
    return unpaidByUnit;
  }

  /**
   * Mark that penalties have been applied to previous bills
   * This prevents double-charging penalties
   */
  async _markPenaltiesApplied(clientId, currentYear, currentMonth) {
    await this._initializeDb();
    
    const batch = this.db.batch();
    
    // Mark all previous months in current year
    for (let month = 0; month < currentMonth; month++) {
      const monthStr = String(month).padStart(2, '0');
      const billRef = this.db
        .collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(`${currentYear}-${monthStr}`);
      
      batch.update(billRef, {
        'metadata.penaltiesAppliedInMonth': currentMonth,
        'metadata.penaltiesAppliedAt': admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await batch.commit();
  }

  /**
   * Generate descriptive bill notes for water consumption and wash services
   */
  generateWaterBillNotes(consumption, carWashCount, boatWashCount, period) {
    const consumptionFormatted = consumption.toString().padStart(4, '0');
    
    let notes = `Water Consumption for ${period} - ${consumptionFormatted} m³`;
    
    const washServices = [];
    if (carWashCount > 0) {
      washServices.push(`${carWashCount} Car wash${carWashCount > 1 ? 'es' : ''}`);
    }
    if (boatWashCount > 0) {
      washServices.push(`${boatWashCount} Boat wash${boatWashCount > 1 ? 'es' : ''}`);
    }
    
    if (washServices.length > 0) {
      notes += `, ${washServices.join(', ')}`;
    }
    
    return notes;
  }

  // Helper methods
  _calculateDueDate(billDate, config) {
    const dueDate = new Date(billDate);
    dueDate.setDate(dueDate.getDate() + (config.penaltyDays || 10));
    return dueDate.toISOString();
  }

  _calculatePenaltyStartDate(dueDate, penaltyDays) {
    const date = typeof dueDate === 'string' ? new Date(dueDate) : new Date(dueDate);
    date.setDate(date.getDate() + penaltyDays);
    // Return ISO string with timezone offset to match old structure format
    // Format: "YYYY-MM-DDTHH:mm:ss.SSS-05:00" (Cancun timezone)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00.000-05:00`; // Cancun timezone offset
  }

  /**
   * VALIDATION: Verify bill structure matches expected format
   * This prevents regressions by ensuring critical fields are present and correctly formatted
   */
  _validateBillStructure(billsData, fiscalQuarter, fiscalYear) {
    const errors = [];
    
    // Validate top-level structure field order (critical for Statement of Account)
    const requiredTopLevelFields = [
      'billDate', 'dueDate', 'penaltyStartDate', 'billingPeriod', 
      'fiscalYear', 'fiscalQuarter', 'quarterMonths', 'readingsIncluded',
      'configSnapshot', 'bills', 'summary', 'metadata'
    ];
    
    const actualTopLevelFields = Object.keys(billsData);
    const missingFields = requiredTopLevelFields.filter(f => !actualTopLevelFields.includes(f));
    
    if (missingFields.length > 0) {
      errors.push(`Missing required top-level fields: ${missingFields.join(', ')}`);
    }
    
    // Validate billingPeriod
    if (billsData.billingPeriod !== 'quarterly') {
      errors.push(`billingPeriod must be exactly 'quarterly', got: ${billsData.billingPeriod}`);
    }
    
    // Validate fiscalQuarter
    if (billsData.fiscalQuarter !== fiscalQuarter) {
      errors.push(`fiscalQuarter mismatch: expected ${fiscalQuarter}, got ${billsData.fiscalQuarter}`);
    }
    
    // Validate fiscalYear
    if (billsData.fiscalYear !== fiscalYear) {
      errors.push(`fiscalYear mismatch: expected ${fiscalYear}, got ${billsData.fiscalYear}`);
    }
    
    // Validate metadata.generatedBy exists (metadata field, not used for filtering)
    if (!billsData.metadata?.generatedBy) {
      errors.push('metadata.generatedBy is required');
    }
    
    // Validate quarterMonths is an array
    if (!Array.isArray(billsData.quarterMonths)) {
      errors.push(`quarterMonths must be an array, got: ${typeof billsData.quarterMonths}`);
    }
    
    // Validate dueDate format (must have timezone offset)
    if (typeof billsData.dueDate === 'string' && !billsData.dueDate.includes('-05:00')) {
      errors.push(`dueDate must include Cancun timezone offset (-05:00), got: ${billsData.dueDate}`);
    }
    
    // Validate billDate format (must be UTC ISO)
    if (typeof billsData.billDate === 'string' && !billsData.billDate.endsWith('Z')) {
      errors.push(`billDate must be UTC ISO format (ending with Z), got: ${billsData.billDate}`);
    }
    
    // Note: minimumCharge is stored as 0 for compatibility but not used (0 consumption = 0 bill)
    
    // Log validation results
    if (errors.length > 0) {
      console.error('❌ BILL STRUCTURE VALIDATION FAILED:');
      errors.forEach(err => console.error(`  - ${err}`));
      throw new Error(`Bill structure validation failed: ${errors.join('; ')}`);
    } else {
      console.log('✅ Bill structure validation passed - all critical fields present and correctly formatted');
    }
  }
}

export default new WaterBillsService();
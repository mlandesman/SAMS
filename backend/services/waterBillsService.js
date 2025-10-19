// services/waterBillsService.js
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { waterDataService } from './waterDataService.js';
import penaltyRecalculationService from './penaltyRecalculationService.js';
import { getNow } from '../services/DateService.js';
import { pesosToCentavos, centavosToPesos } from '../utils/currencyUtils.js';
import { validateCentavos } from '../utils/centavosValidation.js';

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
}

export default new WaterBillsService();
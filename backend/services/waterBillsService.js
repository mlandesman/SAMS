// services/waterBillsService.js
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { waterDataService } from './waterDataService.js';
import penaltyRecalculationService from './penaltyRecalculationService.js';

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
    const rateInPesos = config.ratePerM3 / 100; // Convert centavos to pesos
    const penaltyRate = config.penaltyRate || 0.05; // 5% per month default
    
    // 4. Calculate or use provided due date (MOVE EARLIER)
    const billDate = new Date();
    const dueDate = options.dueDate ? new Date(options.dueDate).toISOString() : this._calculateDueDate(billDate, config);
    
    // 5. CRITICAL: Run penalty recalculation before generating new bills
    console.log(`Running penalty recalculation for client ${clientId} before bill generation...`);
    await penaltyRecalculationService.recalculatePenaltiesForClient(clientId);
    
    // 6. Generate new bills from pre-calculated consumption
    const bills = {};
    let totalNewCharges = 0;
    let unitsWithBills = 0;
    
    for (const [unitId, data] of Object.entries(monthData.units || {})) {
      
      // Calculate new charges for this month
      let newCharge = 0;
      if (data.consumption > 0 || config.minimumCharge > 0) {
        newCharge = Math.max(
          data.consumption * rateInPesos,
          (config.minimumCharge || 0) / 100
        );
      }
      
      // Removed Unit 203 debug logging to prevent confusion
      
      // Only create a bill if there are new charges for this month
      if (newCharge > 0) {
        bills[unitId] = {
          // Meter readings (match existing order)
          priorReading: data.priorReading,
          currentReading: data.currentReading,
          consumption: data.consumption,
          
          // Core financial fields (clean - no previousBalance/previousPenalty)
          currentCharge: newCharge,
          penaltyAmount: 0,                    // New bills start with no penalty
          totalAmount: newCharge,              // currentCharge + penaltyAmount (0 for new)
          status: 'unpaid',
          paidAmount: 0,
          
          // Timestamp
          lastPenaltyUpdate: new Date().toISOString(),
          
          // Payment tracking (keep for payment service compatibility)
          penaltyPaid: 0
        };
        
        totalNewCharges += newCharge;
        unitsWithBills++;
      }
    }
    
    // Add validation to prevent field recreation
    const ALLOWED_BILL_FIELDS = [
      'priorReading', 'currentReading', 'consumption',
      'currentCharge', 'penaltyAmount', 'totalAmount',
      'status', 'paidAmount', 'penaltyPaid',
      'lastPenaltyUpdate', 'lastPayment', 'basePaid'
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
        totalNewCharges: totalNewCharges,        // New water charges this month only
        totalBilled: totalNewCharges,            // Just this month's charges
        totalUnpaid: totalNewCharges,            // Just this month's charges (new bills are unpaid)
        totalPaid: 0,                            // New bills start unpaid
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

  // Helper methods
  _calculateDueDate(billDate, config) {
    const dueDate = new Date(billDate);
    dueDate.setDate(dueDate.getDate() + (config.penaltyDays || 10));
    return dueDate.toISOString();
  }
}

export default new WaterBillsService();
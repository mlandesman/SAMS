/**
 * Bill Data Service
 * 
 * Extracted from PaymentDistributionService (Phase 4 Task 4.5 Refactoring)
 * Handles module-specific data loading for bills
 * 
 * This service provides helper functions for loading and preparing bill data
 * before passing to the pure calculation service (PaymentDistributionService)
 */

import { getNow, parseDate, createDate, addDays } from './DateService.js';
import { pesosToCentavos, centavosToPesos } from '../utils/currencyUtils.js';
import { getDb } from '../../backend/firebase.js';
import { validatePenaltyConfig } from '../utils/configValidation.js';

/**
 * Round currency amounts to prevent floating point precision errors
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
export function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

/**
 * Get billing configuration for a client and module
 * @param {object} db - Firestore database instance
 * @param {string} clientId - Client ID
 * @param {string} moduleType - Module type ('water' or 'hoa')
 * @returns {object} Billing configuration
 */
export async function getBillingConfig(db, clientId, moduleType = 'water') {
  const docName = moduleType === 'water' ? 'waterBills' : 'hoaDues';
  
  const configDoc = await db
    .collection('clients')
    .doc(clientId)
    .collection('config')
    .doc(docName)
    .get();
  
  if (!configDoc.exists) {
    // Return default config
    return {
      penaltyRate: 0.05,
      penaltyDays: 10,
      ratePerM3: 5000
    };
  }
  
  return configDoc.data();
}

/**
 * Recalculate penalties for bills as of a specific date (for backdated payments)
 * @param {string} clientId - Client ID
 * @param {Array} bills - Array of bill objects (in centavos)
 * @param {Date} asOfDate - Date to calculate penalties as of
 * @param {object} config - Billing configuration
 * @returns {Array} Bills with recalculated penalties (in centavos)
 */
export async function recalculatePenaltiesAsOfDate(clientId, bills, asOfDate, config) {
  console.log(`🔄 Recalculating penalties as of ${asOfDate.toISOString()}`);
  
  // Use shared validation utility
  const validatedConfig = validatePenaltyConfig(config, `${clientId} bill data service`);
  const penaltyRate = validatedConfig.penaltyRate;
  const gracePeriodDays = validatedConfig.gracePeriodDays;
  
  const recalculatedBills = [];
  
  for (const bill of bills) {
    const billDate = parseDate(bill.billDate || bill.createdAt);
    
    // Get due date from bill period or use default grace period
    let dueDate;
    if (bill.dueDate) {
      dueDate = parseDate(bill.dueDate);
    } else {
      // Calculate due date based on bill period (e.g., "2026-00" = July 2025)
      const billPeriod = bill.billPeriod || bill.period;
      if (billPeriod) {
        const [fiscalYear, month] = billPeriod.split('-');
        const calendarYear = fiscalYear === '2026' ? 2025 : parseInt(fiscalYear);
        const monthIndex = parseInt(month) + 6; // Convert fiscal year months to calendar year months
        const day = 15 + gracePeriodDays;
        dueDate = createDate(calendarYear, monthIndex + 1, day); // createDate uses 1-based month
      } else {
        // Fallback: use bill date + grace period
        dueDate = addDays(billDate, gracePeriodDays);
      }
    }
    
    // Calculate days past due as of the payment date
    const daysPastDue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    
    let newPenaltyAmount = 0;
    if (daysPastDue > gracePeriodDays) {
      // Calculate penalty based on unpaid base charge
      const unpaidBase = bill.currentCharge - (bill.basePaid || 0);
      const monthsLate = Math.floor((daysPastDue - gracePeriodDays) / 30);
      newPenaltyAmount = Math.floor(unpaidBase * penaltyRate * monthsLate);
    }
    
    recalculatedBills.push({
      ...bill,
      penaltyAmount: newPenaltyAmount,
      totalAmount: bill.currentCharge + newPenaltyAmount,
      lastPenaltyUpdate: asOfDate.toISOString()
    });
  }
  
  console.log(`✅ Recalculated penalties for ${recalculatedBills.length} bills as of ${asOfDate.toISOString()}`);
  return recalculatedBills;
}

/**
 * Get unpaid bills for a unit from Water Bills storage structure
 * Module-specific implementation for Water Bills
 * 
 * @param {object} db - Firestore database instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @returns {Array} Array of unpaid bills (all amounts in centavos)
 */
export async function getUnpaidWaterBillsForUnit(db, clientId, unitId) {
  const bills = [];
  
  // Query all bill documents to find unpaid bills for this unit
  const billsSnapshot = await db.collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills')
    .orderBy('__name__') // Order by document name (YYYY-MM format - oldest first)
    .get();
  
  console.log(`🔍 [WATER BILLS] Found ${billsSnapshot.size} bill documents`);
  
  billsSnapshot.forEach(doc => {
    const billData = doc.data();
    const unitBill = billData.bills?.units?.[unitId];
    
    if (unitBill && unitBill.status !== 'paid') {
      const paidAmount = unitBill.paidAmount || 0;
      const basePaid = unitBill.basePaid || 0;
      const penaltyPaid = unitBill.penaltyPaid || 0;
      
      // Extract amounts from bill structure (already in centavos)
      const storedBaseAmount = unitBill.currentCharge || 0;
      const storedPenaltyAmount = unitBill.penaltyAmount || 0;
      const totalDue = storedBaseAmount + storedPenaltyAmount;
      
      // Calculate unpaid amounts
      const unpaidBaseAmount = storedBaseAmount - basePaid;
      const unpaidPenaltyAmount = storedPenaltyAmount - penaltyPaid;
      const totalUnpaidAmount = totalDue - paidAmount;
      
      if (totalUnpaidAmount > 0) {
        bills.push({
          id: doc.id,
          period: doc.id,
          billId: doc.id,
          billPeriod: doc.id,
          penaltyAmount: storedPenaltyAmount,
          totalAmount: unitBill.totalAmount || totalDue,
          currentCharge: storedBaseAmount,
          paidAmount: paidAmount,
          basePaid: basePaid,
          penaltyPaid: penaltyPaid,
          unpaidAmount: totalUnpaidAmount,
          status: unitBill.status,
          dueDate: billData.dueDate,
          billDate: billData.billDate || billData.createdAt,
          createdAt: billData.createdAt,
          lastPenaltyUpdate: unitBill.lastPenaltyUpdate || null
        });
      }
    }
  });
  
  console.log(`✅ [WATER BILLS] Loaded ${bills.length} unpaid bills for unit ${unitId}`);
  return bills;
}

/**
 * Filter bills by fiscal month index
 * @param {Array} bills - Array of bill objects
 * @param {number} maxMonthIndex - Maximum fiscal month index to include (0-11)
 * @returns {Array} Filtered bills
 */
export function filterBillsByMonth(bills, maxMonthIndex) {
  console.log(`🔍 [FILTER] Filtering bills to include only months up to index ${maxMonthIndex}`);
  
  const originalCount = bills.length;
  const filtered = bills.filter(bill => {
    const billPeriod = bill.period || bill.billId || bill.billPeriod;
    const billMonthMatch = billPeriod?.match(/\d{4}-(\d{2})/);
    if (billMonthMatch) {
      const billMonthIndex = parseInt(billMonthMatch[1]);
      const isIncluded = billMonthIndex <= maxMonthIndex;
      console.log(`🔍 Bill ${billPeriod}: month ${billMonthIndex} vs max ${maxMonthIndex} -> ${isIncluded ? 'INCLUDED' : 'EXCLUDED'}`);
      return isIncluded;
    }
    return true; // Include bills without period format
  });
  
  console.log(`🔍 [FILTER] Filtered from ${originalCount} to ${filtered.length} bills`);
  return filtered;
}


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
import { pesosToCentavos, centavosToPesos, roundPesos } from '../utils/currencyUtils.js';
import { getDb } from '../../backend/firebase.js';
import { validatePenaltyConfig } from '../utils/configValidation.js';
import { calculatePenaltyForBill } from './PenaltyRecalculationService.js';
import { logDebug, logInfo, logWarn, logError } from '../logger.js';

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
  logDebug(`🔄 Recalculating penalties as of ${asOfDate.toISOString()}`);
  
  // Use shared validation utility
  const validatedConfig = validatePenaltyConfig(config, `${clientId} bill data service`);
  
  const recalculatedBills = [];
  
  for (const bill of bills) {
    // CRITICAL: Use shared PenaltyRecalculationService for consistent compounding logic
    // This ensures both Water Bills and HOA Dues use the same penalty calculation
    const penaltyResult = calculatePenaltyForBill({
      bill,
      asOfDate,
      config: {
        penaltyRate: validatedConfig.penaltyRate,
        penaltyDays: validatedConfig.gracePeriodDays || validatedConfig.penaltyDays
      }
    });
    
    // Return bill with updated penalty in same format as before
    // The wrapper expects full bill objects, not just penalty results
    recalculatedBills.push({
      ...bill,
      penaltyAmount: penaltyResult.penaltyAmount,
      totalAmount: bill.currentCharge + penaltyResult.penaltyAmount,
      lastPenaltyUpdate: asOfDate.toISOString()
    });
  }
  
  logDebug(`✅ Recalculated penalties for ${recalculatedBills.length} bills as of ${asOfDate.toISOString()}`);
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
  
  logDebug(`🔍 [WATER BILLS] Found ${billsSnapshot.size} bill documents`);
  
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
  
  logDebug(`✅ [WATER BILLS] Loaded ${bills.length} unpaid bills for unit ${unitId}`);
  return bills;
}

/**
 * Filter bills by fiscal month index
 * @param {Array} bills - Array of bill objects
 * @param {number} maxMonthIndex - Maximum fiscal month index to include (0-11)
 * @returns {Array} Filtered bills
 */
export function filterBillsByMonth(bills, maxMonthIndex) {
  logDebug(`🔍 [FILTER] Filtering bills to include only months up to index ${maxMonthIndex}`);
  
  const originalCount = bills.length;
  const filtered = bills.filter(bill => {
    const billPeriod = bill.period || bill.billId || bill.billPeriod;
    const billMonthMatch = billPeriod?.match(/\d{4}-(\d{2})/);
    if (billMonthMatch) {
      const billMonthIndex = parseInt(billMonthMatch[1]);
      const isIncluded = billMonthIndex <= maxMonthIndex;
      logDebug(`🔍 Bill ${billPeriod}: month ${billMonthIndex} vs max ${maxMonthIndex} -> ${isIncluded ? 'INCLUDED' : 'EXCLUDED'}`);
      return isIncluded;
    }
    return true; // Include bills without period format
  });
  
  logDebug(`🔍 [FILTER] Filtered from ${originalCount} to ${filtered.length} bills`);
  return filtered;
}


/**
 * Payment Distribution Service
 * 
 * Extracted from Water Bills (Phase 3B - Priority 0B)
 * Refactored in Phase 4 Task 4.5 to be pure calculation service
 * 
 * ARCHITECTURE (Phase 4 Refactor):
 * - Module wrappers load data from their native storage (Water Bills, HOA Dues, etc.)
 * - Wrappers convert to standardized bills array format
 * - This service performs PURE CALCULATION only (no Firestore queries)
 * 
 * Core Algorithm:
 * 1. Receive pre-loaded bills array (already filtered and penalty-calculated)
 * 2. Apply existing credit balance first
 * 3. Apply payment amount
 * 4. For each bill (until funds exhausted):
 *    a. Pay penalties first (if any)
 *    b. Pay base charge
 *    c. Track what was paid
 * 5. If payment exceeds all bills, remainder becomes overpayment (credit)
 * 
 * All amounts in INTEGER CENTAVOS internally for precision
 * Returns amounts in PESOS for frontend display
 */

import { pesosToCentavos, centavosToPesos } from '../utils/currencyUtils.js';
import { getTotalOwed, getBaseOwed, getPenaltyOwed, getTotalDue } from '../utils/billCalculations.js';
import { logDebug, logInfo, logWarn, logError } from '../../../shared/logger.js';

/**
 * Round currency amounts to prevent floating point precision errors
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

// Helper functions for data loading moved to BillDataService.js (Phase 4 Task 4.5 refactor)

/**
 * Calculate payment distribution across unpaid bills
 * 
 * PHASE 4 REFACTOR: Pure calculation service (no Firestore queries)
 * Module wrappers must load/prepare bills before calling this function
 * 
 * This is the single source of truth for payment distribution calculations
 * 
 * @param {object} params - Calculation parameters
 * @param {Array} params.bills - REQUIRED: Pre-loaded unpaid bills array (in centavos, penalties already calculated)
 * @param {number} params.paymentAmount - REQUIRED: Payment amount in PESOS
 * @param {number} params.currentCreditBalance - Current credit balance in PESOS (default: 0)
 * @param {string} params.unitId - Unit ID (for logging)
 * 
 * @returns {object} Distribution result (all amounts in PESOS for frontend)
 * @returns {number} result.totalAvailableFunds - Total funds available (payment + credit)
 * @returns {Array} result.billPayments - Array of bill payments with amounts
 * @returns {number} result.totalBaseCharges - Total base charges paid
 * @returns {number} result.totalPenalties - Total penalties paid
 * @returns {number} result.creditUsed - Existing credit used
 * @returns {number} result.overpayment - Excess payment (becomes credit)
 * @returns {number} result.currentCreditBalance - Current credit balance before payment
 * @returns {number} result.newCreditBalance - New credit balance after payment
 * @returns {number} result.totalBillsDue - Total bills due before payment
 */
export function calculatePaymentDistribution(params) {
  const {
    bills,
    paymentAmount,
    currentCreditBalance = 0,
    unitId = 'unknown'
  } = params;
  
  // Validation
  if (!bills || !Array.isArray(bills)) {
    throw new Error('bills parameter is required and must be an array');
  }
  
  if (paymentAmount === undefined || paymentAmount < 0) {
    throw new Error('paymentAmount must be a non-negative number');
  }
  
  logDebug(`💰 [PAYMENT DIST] Calculating distribution: Unit ${unitId}, Amount $${paymentAmount}, Credit $${currentCreditBalance}`);
  logDebug(`📋 [PAYMENT DIST] Processing ${bills.length} pre-loaded bills`);
  
  // Calculate total available funds in PESOS and CENTAVOS
  const totalAvailableFundsPesos = roundCurrency(paymentAmount + currentCreditBalance);
  const totalAvailableFundsCentavos = pesosToCentavos(totalAvailableFundsPesos);
  
  logDebug(`💰 Available funds: Payment $${paymentAmount} + Credit $${currentCreditBalance} = Total $${totalAvailableFundsPesos} (${totalAvailableFundsCentavos} centavos)`);
  
  // Use pre-loaded bills (already filtered to unpaid by wrapper)
  // Wrappers are responsible for filtering to reduce overhead
  const unpaidBills = bills;
  
  logDebug(`📋 [PAYMENT DIST] Received ${unpaidBills.length} unpaid bills from wrapper`);
  
  // Calculate total bills due in centavos
  // Use getTotalOwed() getter for fresh calculation from source fields
  const totalBillsDueCentavos = unpaidBills.reduce((sum, bill) => {
    const unpaidAmount = getTotalOwed(bill);
    return sum + unpaidAmount;
  }, 0);
  
  const paymentAmountCentavos = pesosToCentavos(paymentAmount);
  
  // Process bills individually in priority order (allows partial payments)
  // CRITICAL: Bills are already sorted by priority and due date by unifiedPaymentWrapper
  // This ensures payments are applied to oldest/highest priority bills first
  // Per Mexican Civil Code Articles 2281-2282: payments must be applied to oldest installments first
  logDebug(`📋 [PAYMENT DIST] Processing ${unpaidBills.length} bills individually (partial payments allowed)`);
  
  // Apply funds to bills one at a time (in CENTAVOS for precision)
  let remainingFundsCentavos = totalAvailableFundsCentavos;
  const billPayments = [];
  let totalBaseChargesPaidCentavos = 0;
  let totalPenaltiesPaidCentavos = 0;
  
  // Initialize all unpaid bills with zero payments
  for (const bill of unpaidBills) {
    billPayments.push({
      unitId: unitId,
      billId: bill.id,
      billPeriod: bill.period,
      amountPaid: 0,
      baseChargePaid: 0,
      penaltyPaid: 0,
      newStatus: 'unpaid'
    });
  }
  
  // Process bills one at a time in priority order
  // Apply partial payments when funds are insufficient
  for (let i = 0; i < unpaidBills.length; i++) {
    if (remainingFundsCentavos <= 0) break;
    
    const bill = unpaidBills[i];
    const billIndex = i;
    const billPayment = billPayments[billIndex];
    
    // Skip excluded bills (marked by unifiedPaymentWrapper)
    if (bill._metadata?.excluded) {
      logDebug(`  ⏭️  Bill ${bill.period} excluded - skipping`);
      continue;
    }
    
    // Use getter functions for fresh calculation from source fields
    const totalOwedCentavos = getTotalOwed(bill);
    const baseOwedCentavos = getBaseOwed(bill);
    const penaltyOwedCentavos = getPenaltyOwed(bill);
    
    if (totalOwedCentavos <= 0) {
      // Bill already fully paid - skip
      logDebug(`  ℹ️  Bill ${bill.period} already paid - skipping`);
      continue;
    }
    
    // Calculate how much we can apply to this bill (partial or full)
    const amountToApplyCentavos = Math.min(remainingFundsCentavos, totalOwedCentavos);
    
    // Within bill: penalties first, then base (per Mexican Civil Code)
    let penaltyPaymentCentavos = Math.min(amountToApplyCentavos, penaltyOwedCentavos);
    let basePaymentCentavos = amountToApplyCentavos - penaltyPaymentCentavos;
    
    // Ensure base payment doesn't exceed base owed
    basePaymentCentavos = Math.min(basePaymentCentavos, baseOwedCentavos);
    
    // Update bill payment record
    billPayment.amountPaid = amountToApplyCentavos;
    billPayment.baseChargePaid = basePaymentCentavos;
    billPayment.penaltyPaid = penaltyPaymentCentavos;
    
    // Determine bill status
    const remainingOwedAfterPayment = totalOwedCentavos - amountToApplyCentavos;
    if (remainingOwedAfterPayment <= 0) {
      billPayment.newStatus = 'paid';
      logDebug(`  ✅ Bill ${bill.period} paid in full: ${amountToApplyCentavos} centavos ($${centavosToPesos(amountToApplyCentavos)})`);
    } else {
      billPayment.newStatus = 'partial';
      logDebug(`  💰 Bill ${bill.period} partial payment: ${amountToApplyCentavos} centavos ($${centavosToPesos(amountToApplyCentavos)}) of ${totalOwedCentavos} centavos ($${centavosToPesos(totalOwedCentavos)})`);
    }
    
    // Update totals
    totalBaseChargesPaidCentavos += basePaymentCentavos;
    totalPenaltiesPaidCentavos += penaltyPaymentCentavos;
    remainingFundsCentavos -= amountToApplyCentavos;
  }
  
  // Calculate credit usage vs overpayment
  // Calculate total amount actually applied to bills
  const totalBillsPaidCentavos = totalBaseChargesPaidCentavos + totalPenaltiesPaidCentavos;
  const totalBillsPaidPesos = roundCurrency(centavosToPesos(totalBillsPaidCentavos));
  
  // Key distinction: overpayment is ONLY from payment amount, not from existing credit
  // If payment > bills paid: overpayment = payment - bills (credit not used)
  // If payment < bills paid: credit was used to make up difference, no overpayment
  let creditUsed = 0;
  let overpayment = 0;
  
  if (paymentAmountCentavos >= totalBillsPaidCentavos) {
    // Payment covered all bills - no credit needed
    creditUsed = 0;
    overpayment = roundCurrency(centavosToPesos(paymentAmountCentavos - totalBillsPaidCentavos));
  } else {
    // Payment didn't cover all bills - used credit to make up difference
    const creditNeededCentavos = totalBillsPaidCentavos - paymentAmountCentavos;
    creditUsed = roundCurrency(centavosToPesos(creditNeededCentavos));
    overpayment = 0;
  }
  
  // New credit balance = current balance - credit used + overpayment
  const newCreditBalance = roundCurrency(currentCreditBalance - creditUsed + overpayment);
  
  logDebug(`💰 [PAYMENT DIST] Calculations: Bills paid $${totalBillsPaidPesos}, Remaining $${centavosToPesos(remainingFundsCentavos)}, Credit used $${creditUsed}, Overpayment $${overpayment}`);
  
  logDebug(`💰 Distribution calculated: Credit used $${creditUsed}, Overpaid $${overpayment}, New balance $${newCreditBalance}`);
  
  // Convert billPayments to PESOS for return
  const billPaymentsForReturn = billPayments.map(bp => {
    const originalBill = unpaidBills.find(bill => bill.period === bp.billPeriod);
    if (!originalBill) {
      // Fallback if bill not found
      return {
        ...bp,
        amountPaid: centavosToPesos(bp.amountPaid),
        baseChargePaid: centavosToPesos(bp.baseChargePaid),
        penaltyPaid: centavosToPesos(bp.penaltyPaid),
        totalBaseDue: centavosToPesos(bp.baseChargePaid),
        totalPenaltyDue: centavosToPesos(bp.penaltyPaid),
        totalDue: centavosToPesos(bp.amountPaid)
      };
    }
    
    // Calculate original due amounts (before any payments)
    const totalDueCentavos = getTotalDue(originalBill);
    
    // Get original base and penalty amounts (not owed, but total due)
    const baseAmount = originalBill.baseAmount ?? originalBill.baseCharge ?? originalBill.currentCharge ?? 0;
    const penaltyAmount = originalBill.penaltyAmount ?? 0;
    
    return {
      ...bp,
      amountPaid: centavosToPesos(bp.amountPaid),
      baseChargePaid: centavosToPesos(bp.baseChargePaid),
      penaltyPaid: centavosToPesos(bp.penaltyPaid),
      totalBaseDue: centavosToPesos(baseAmount), // Original base due
      totalPenaltyDue: centavosToPesos(penaltyAmount), // Original penalty due
      totalDue: centavosToPesos(totalDueCentavos) // Original total due
    };
  });
  
  // Return all amounts in PESOS for frontend
  return {
    totalAvailableFunds: totalAvailableFundsPesos,
    billPayments: billPaymentsForReturn,
    totalBaseCharges: centavosToPesos(totalBaseChargesPaidCentavos),
    totalPenalties: centavosToPesos(totalPenaltiesPaidCentavos),
    totalApplied: totalBillsPaidPesos,  // Total amount applied to bills
    creditUsed: creditUsed,
    overpayment: overpayment,
    currentCreditBalance: currentCreditBalance,
    newCreditBalance: newCreditBalance,
    totalBillsDue: centavosToPesos(totalBillsDueCentavos)
  };
}

/**
 * Export helper functions for testing
 */
export const __testing = {
  roundCurrency
};


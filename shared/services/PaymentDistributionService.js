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
  
  console.log(`💰 [PAYMENT DIST] Calculating distribution: Unit ${unitId}, Amount $${paymentAmount}, Credit $${currentCreditBalance}`);
  console.log(`📋 [PAYMENT DIST] Processing ${bills.length} pre-loaded bills`);
  
  // Calculate total available funds in PESOS and CENTAVOS
  const totalAvailableFundsPesos = roundCurrency(paymentAmount + currentCreditBalance);
  const totalAvailableFundsCentavos = pesosToCentavos(totalAvailableFundsPesos);
  
  console.log(`💰 Available funds: Payment $${paymentAmount} + Credit $${currentCreditBalance} = Total $${totalAvailableFundsPesos} (${totalAvailableFundsCentavos} centavos)`);
  
  // Use pre-loaded bills (already filtered to unpaid by wrapper)
  // Wrappers are responsible for filtering to reduce overhead
  const unpaidBills = bills;
  
  console.log(`📋 [PAYMENT DIST] Received ${unpaidBills.length} unpaid bills from wrapper`);
  
  // Calculate total bills due in centavos
  const totalBillsDueCentavos = unpaidBills.reduce((sum, bill) => {
    const unpaidAmount = bill.totalAmount - (bill.paidAmount || 0);
    return sum + unpaidAmount;
  }, 0);
  
  const paymentAmountCentavos = pesosToCentavos(paymentAmount);
  
  // Apply funds to bills (in CENTAVOS for precision)
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
  
  // Apply funds to bills (in CENTAVOS for precision)
  // SIMPLE RULE: Pay bills in full until you can't afford the next full bill
  // Remainder becomes credit (NO partial payments)
  for (let i = 0; i < unpaidBills.length; i++) {
    const bill = unpaidBills[i];
    const billPayment = billPayments[i];
    
    if (remainingFundsCentavos <= 0) break;
    
    const unpaidAmount = bill.totalAmount - (bill.paidAmount || 0);
    const baseUnpaid = bill.currentCharge - (bill.basePaid || 0);
    const penaltyUnpaid = bill.penaltyAmount - (bill.penaltyPaid || 0);
    
    console.log(`📄 Bill ${bill.period}: Total due ${unpaidAmount} centavos ($${centavosToPesos(unpaidAmount)}) (Base: ${baseUnpaid}, Penalties: ${penaltyUnpaid})`);
    
    if (remainingFundsCentavos >= unpaidAmount) {
      // Can afford to pay this bill in full - pay it!
      billPayment.amountPaid = unpaidAmount;
      billPayment.baseChargePaid = baseUnpaid;
      billPayment.penaltyPaid = penaltyUnpaid;
      billPayment.newStatus = 'paid';
      
      totalBaseChargesPaidCentavos += baseUnpaid;
      totalPenaltiesPaidCentavos += penaltyUnpaid;
      remainingFundsCentavos -= unpaidAmount;
      
      console.log(`✅ Bill ${bill.period} paid in full: ${unpaidAmount} centavos ($${centavosToPesos(unpaidAmount)})`);
      
    } else {
      // Can't afford this bill - STOP HERE
      // Remainder becomes credit (no partial payment)
      console.log(`⏭️  Bill ${bill.period} skipped - insufficient funds ($${centavosToPesos(remainingFundsCentavos)} < $${centavosToPesos(unpaidAmount)}), remainder becomes credit`);
      break;
    }
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
  
  console.log(`💰 [PAYMENT DIST] Calculations: Bills paid $${totalBillsPaidPesos}, Remaining $${centavosToPesos(remainingFundsCentavos)}, Credit used $${creditUsed}, Overpayment $${overpayment}`);
  
  console.log(`💰 Distribution calculated: Credit used $${creditUsed}, Overpaid $${overpayment}, New balance $${newCreditBalance}`);
  
  // Convert billPayments to PESOS for return
  const billPaymentsForReturn = billPayments.map(bp => {
    const originalBill = unpaidBills.find(bill => bill.period === bp.billPeriod);
    const unpaidBaseDue = originalBill ? originalBill.currentCharge - (originalBill.basePaid || 0) : bp.baseChargePaid;
    const unpaidPenaltyDue = originalBill ? originalBill.penaltyAmount - (originalBill.penaltyPaid || 0) : bp.penaltyPaid;
    const totalUnpaidDue = unpaidBaseDue + unpaidPenaltyDue;
    
    return {
      ...bp,
      amountPaid: centavosToPesos(bp.amountPaid),
      baseChargePaid: centavosToPesos(bp.baseChargePaid),
      penaltyPaid: centavosToPesos(bp.penaltyPaid),
      totalBaseDue: centavosToPesos(unpaidBaseDue),
      totalPenaltyDue: centavosToPesos(unpaidPenaltyDue),
      totalDue: centavosToPesos(totalUnpaidDue)
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


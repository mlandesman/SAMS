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
  
  // Group bills by due date (for quarterly billing)
  // Bills with the same due date must be paid together as a group
  const billGroups = {};
  unpaidBills.forEach((bill, index) => {
    const dueDate = bill.dueDate ? bill.dueDate.split('T')[0] : `group_${index}`;
    if (!billGroups[dueDate]) {
      billGroups[dueDate] = [];
    }
    billGroups[dueDate].push(bill);
  });
  
  const groups = Object.values(billGroups);
  console.log(`📦 [PAYMENT DIST] Grouped ${unpaidBills.length} bills into ${groups.length} due date group(s)`);
  
  // Apply funds to bill groups (in CENTAVOS for precision)
  // CRITICAL FIX: Track payment and credit separately to enforce credit constraint
  let remainingPaymentCentavos = paymentAmountCentavos;
  let remainingCreditCentavos = pesosToCentavos(currentCreditBalance);
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
  
  // Apply funds to bill groups (entire group must be paid together)
  // RULE FOR GROUPED BILLS: Pay entire group or skip entire group (no partial groups)
  // CRITICAL: Only use credit if payment is insufficient AND credit is available
  for (const group of groups) {
    const totalRemainingFundsCentavos = remainingPaymentCentavos + remainingCreditCentavos;
    if (totalRemainingFundsCentavos <= 0) break;
    
    // Calculate total for this group
    const groupTotalCentavos = group.reduce((sum, bill) => {
      return sum + (bill.totalAmount - (bill.paidAmount || 0));
    }, 0);
    
    const groupTotalPesos = centavosToPesos(groupTotalCentavos);
    const groupDueDate = group[0].dueDate?.split('T')[0] || 'unknown';
    
    console.log(`📦 Group (due: ${groupDueDate}): ${group.length} bill(s), Total $${groupTotalPesos} (${groupTotalCentavos} centavos)`);
    console.log(`   💰 Available: Payment ${remainingPaymentCentavos} centavos, Credit ${remainingCreditCentavos} centavos, Total ${totalRemainingFundsCentavos} centavos`);
    
    // CRITICAL FIX: Check if group contains partially paid bills
    // For partial bills, we can complete them by paying the remaining amount
    // For unpaid bills, we still require full payment (no new partial payments)
    const hasPartialBills = group.some(bill => bill.status === 'partial');
    
    if (hasPartialBills) {
      console.log(`   🔄 Group contains partially paid bills - allowing completion of remaining balance`);
    }
    
    // Check if we can afford this group with available funds (payment + credit)
    if (totalRemainingFundsCentavos >= groupTotalCentavos) {
      // Can afford entire group - pay all bills in this group!
      // Use payment first, then credit if needed
      let paymentUsedForGroup = Math.min(remainingPaymentCentavos, groupTotalCentavos);
      let creditUsedForGroup = groupTotalCentavos - paymentUsedForGroup;
      
      // CRITICAL: Cap credit used to available credit
      creditUsedForGroup = Math.min(creditUsedForGroup, remainingCreditCentavos);
      
      // If we still can't afford it after capping credit, skip the group
      if (paymentUsedForGroup + creditUsedForGroup < groupTotalCentavos) {
        console.log(`⏭️  Group skipped - insufficient funds after credit cap ($${centavosToPesos(paymentUsedForGroup + creditUsedForGroup)} < $${groupTotalPesos})`);
        break;
      }
      
      for (const bill of group) {
        const billIndex = unpaidBills.findIndex(b => b.period === bill.period);
        const billPayment = billPayments[billIndex];
        
        const unpaidAmount = bill.totalAmount - (bill.paidAmount || 0);
        const baseUnpaid = bill.currentCharge - (bill.basePaid || 0);
        const penaltyUnpaid = bill.penaltyAmount - (bill.penaltyPaid || 0);
        
        billPayment.amountPaid = unpaidAmount;
        billPayment.baseChargePaid = baseUnpaid;
        billPayment.penaltyPaid = penaltyUnpaid;
        billPayment.newStatus = 'paid';
        
        totalBaseChargesPaidCentavos += baseUnpaid;
        totalPenaltiesPaidCentavos += penaltyUnpaid;
        
        console.log(`  ✅ Bill ${bill.period} paid: ${unpaidAmount} centavos ($${centavosToPesos(unpaidAmount)})`);
      }
      
      // Update remaining funds
      remainingPaymentCentavos -= paymentUsedForGroup;
      remainingCreditCentavos -= creditUsedForGroup;
      
      console.log(`✅ Group paid in full: ${groupTotalCentavos} centavos ($${groupTotalPesos})`);
      console.log(`   💰 Payment used: ${paymentUsedForGroup} centavos, Credit used: ${creditUsedForGroup} centavos`);
      
    } else if (hasPartialBills) {
      // CRITICAL FIX: Group has partially paid bills - allow completion if we can pay FULL remaining amount
      // Business rule: "no partial payments" means we can't make NEW partial payments
      // But we CAN complete existing partial bills by paying the FULL remaining amount
      // Check if we have enough total funds (payment + credit) to pay the full remaining amount
      
      if (totalRemainingFundsCentavos >= groupTotalCentavos) {
        // We have enough to complete the partial bills - pay them in full
        console.log(`   💳 Completing partially paid bills: $${centavosToPesos(totalRemainingFundsCentavos)} available, need $${groupTotalPesos}`);
        
        // Use payment first, then credit if needed
        let paymentUsedForGroup = Math.min(remainingPaymentCentavos, groupTotalCentavos);
        let creditUsedForGroup = groupTotalCentavos - paymentUsedForGroup;
        
        // CRITICAL: Cap credit used to available credit
        creditUsedForGroup = Math.min(creditUsedForGroup, remainingCreditCentavos);
        
        // If we still can't afford it after capping credit, skip the group
        if (paymentUsedForGroup + creditUsedForGroup < groupTotalCentavos) {
          console.log(`⏭️  Partial bills skipped - insufficient funds after credit cap ($${centavosToPesos(paymentUsedForGroup + creditUsedForGroup)} < $${groupTotalPesos})`);
          break;
        }
        
        // Pay all bills in the group (completing the partial payments)
        for (const bill of group) {
          const billIndex = unpaidBills.findIndex(b => b.period === bill.period);
          const billPayment = billPayments[billIndex];
          
          const unpaidAmount = bill.totalAmount - (bill.paidAmount || 0);
          const baseUnpaid = bill.currentCharge - (bill.basePaid || 0);
          const penaltyUnpaid = bill.penaltyAmount - (bill.penaltyPaid || 0);
          
          billPayment.amountPaid = unpaidAmount;
          billPayment.baseChargePaid = baseUnpaid;
          billPayment.penaltyPaid = penaltyUnpaid;
          billPayment.newStatus = 'paid';
          
          totalBaseChargesPaidCentavos += baseUnpaid;
          totalPenaltiesPaidCentavos += penaltyUnpaid;
          
          console.log(`  ✅ Bill ${bill.period} completed: ${unpaidAmount} centavos ($${centavosToPesos(unpaidAmount)})`);
        }
        
        // Update remaining funds
        remainingPaymentCentavos -= paymentUsedForGroup;
        remainingCreditCentavos -= creditUsedForGroup;
        
        console.log(`✅ Partially paid bills completed: ${groupTotalCentavos} centavos ($${groupTotalPesos})`);
        console.log(`   💰 Payment used: ${paymentUsedForGroup} centavos, Credit used: ${creditUsedForGroup} centavos`);
      } else {
        // Don't have enough to complete partial bills - skip (maintain "no new partial payments" rule)
        console.log(`⏭️  Partial bills skipped - insufficient funds to complete ($${centavosToPesos(totalRemainingFundsCentavos)} < $${groupTotalPesos}), remainder becomes credit`);
        break;
      }
      
    } else {
      // Can't afford this entire group and no partial bills - SKIP IT
      // Remainder becomes credit (no partial group payment for unpaid bills)
      console.log(`⏭️  Group skipped - insufficient funds ($${centavosToPesos(totalRemainingFundsCentavos)} < $${groupTotalPesos}), remainder becomes credit`);
      break;
    }
  }
  
  // Calculate credit usage vs overpayment
  // Calculate total amount actually applied to bills
  const totalBillsPaidCentavos = totalBaseChargesPaidCentavos + totalPenaltiesPaidCentavos;
  const totalBillsPaidPesos = roundCurrency(centavosToPesos(totalBillsPaidCentavos));
  
  // Calculate credit used and overpayment from tracked values
  // Credit used = original credit - remaining credit
  const creditUsedCentavos = pesosToCentavos(currentCreditBalance) - remainingCreditCentavos;
  const creditUsed = roundCurrency(centavosToPesos(creditUsedCentavos));
  
  // Overpayment = remaining payment (excess payment becomes credit)
  const overpayment = roundCurrency(centavosToPesos(remainingPaymentCentavos));
  
  // New credit balance = remaining credit + overpayment (excess payment)
  // Final credit = original credit - credit used + overpayment
  const newCreditBalance = roundCurrency(centavosToPesos(remainingCreditCentavos + remainingPaymentCentavos));
  
  // CRITICAL: Ensure credit balance never goes negative (shouldn't happen with new logic, but safety check)
  if (newCreditBalance < 0) {
    console.warn(`⚠️ [PAYMENT DIST] Credit balance would be negative (${newCreditBalance}), capping to 0`);
    newCreditBalance = 0;
  }
  
  const totalRemainingFundsCentavos = remainingPaymentCentavos + remainingCreditCentavos;
  console.log(`💰 [PAYMENT DIST] Calculations: Bills paid $${totalBillsPaidPesos}, Payment remaining $${centavosToPesos(remainingPaymentCentavos)}, Credit remaining $${centavosToPesos(remainingCreditCentavos)}, Total remaining $${centavosToPesos(totalRemainingFundsCentavos)}, Credit used $${creditUsed}, Overpayment $${overpayment}`);
  
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


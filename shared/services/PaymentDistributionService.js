/**
 * Payment Distribution Service
 * 
 * Extracted from Water Bills (Phase 3B - Priority 0B)
 * Provides payment distribution logic reusable across all billing modules (Water Bills, HOA Dues, Propane, etc.)
 * 
 * Core Algorithm:
 * 1. Get all unpaid bills for unit (oldest first)
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

import { getNow } from './DateService.js';
import { pesosToCentavos, centavosToPesos } from '../utils/currencyUtils.js';
import { getDb } from '../../backend/firebase.js';

/**
 * Round currency amounts to prevent floating point precision errors
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

/**
 * Get billing configuration for a client and module
 * @param {object} db - Firestore database instance
 * @param {string} clientId - Client ID
 * @param {string} moduleType - Module type ('water' or 'hoa')
 * @returns {object} Billing configuration
 */
async function getBillingConfig(db, clientId, moduleType = 'water') {
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
async function recalculatePenaltiesAsOfDate(clientId, bills, asOfDate, config) {
  console.log(`🔄 Recalculating penalties as of ${asOfDate.toISOString()}`);
  
  const penaltyRate = config.penaltyRate || 0.05; // 5% per month default
  const gracePeriodDays = config.penaltyDays || 10; // 10 days grace period default
  
  const recalculatedBills = [];
  
  for (const bill of bills) {
    const billDate = new Date(bill.billDate || bill.createdAt);
    
    // Get due date from bill period or use default grace period
    let dueDate;
    if (bill.dueDate) {
      dueDate = new Date(bill.dueDate);
    } else {
      // Calculate due date based on bill period (e.g., "2026-00" = July 2025)
      const billPeriod = bill.billPeriod || bill.period;
      if (billPeriod) {
        const [fiscalYear, month] = billPeriod.split('-');
        const calendarYear = fiscalYear === '2026' ? 2025 : parseInt(fiscalYear);
        const monthIndex = parseInt(month) + 6; // Convert fiscal year months to calendar year months
        dueDate = new Date(calendarYear, monthIndex, 15 + gracePeriodDays);
      } else {
        // Fallback: use bill date + grace period
        dueDate = new Date(billDate.getTime() + (gracePeriodDays * 24 * 60 * 60 * 1000));
      }
    }
    
    // Calculate days past due as of the payment date
    const daysPastDue = Math.max(0, Math.floor((asOfDate - dueDate) / (1000 * 60 * 60 * 24)));
    
    let recalculatedPenaltyAmount = 0;
    
    if (daysPastDue > gracePeriodDays) {
      // Calculate penalty based on actual calendar months past due
      const dueDateObj = new Date(dueDate);
      const paymentDateObj = new Date(asOfDate);
      
      // Calculate actual calendar months between dates
      let monthsPastDue = (paymentDateObj.getFullYear() - dueDateObj.getFullYear()) * 12;
      monthsPastDue += paymentDateObj.getMonth() - dueDateObj.getMonth();
      
      // If payment date is on or after the same day of the month as due date, add 1 month
      if (paymentDateObj.getDate() >= dueDateObj.getDate()) {
        monthsPastDue += 1;
      }
      
      // Ensure minimum of 1 month if past grace period
      monthsPastDue = Math.max(1, monthsPastDue);
      
      console.log(`   Calendar months calculation: ${dueDateObj.toDateString()} to ${paymentDateObj.toDateString()} = ${monthsPastDue} months`);
      
      // CRITICAL: Calculate penalty on UNPAID base amount, not full original charge
      const unpaidBaseAmount = bill.currentCharge - (bill.basePaid || 0);
      recalculatedPenaltyAmount = Math.round(unpaidBaseAmount * penaltyRate * monthsPastDue);
      
      console.log(`   Penalty calculation: unpaidBase=$${unpaidBaseAmount/100} × ${penaltyRate} × ${monthsPastDue} months = $${recalculatedPenaltyAmount/100}`);
    }
    
    const recalculatedTotalAmount = bill.currentCharge + recalculatedPenaltyAmount;
    
    console.log(`   Bill ${bill.billId}: ${daysPastDue} days past due, penalty: ${bill.penaltyAmount} → ${recalculatedPenaltyAmount}`);
    
    recalculatedBills.push({
      ...bill,
      penaltyAmount: recalculatedPenaltyAmount,
      totalAmount: recalculatedTotalAmount
    });
  }
  
  return recalculatedBills;
}

/**
 * Get unpaid bills for a unit with stored penalty data
 * @param {object} db - Firestore database instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {string} moduleType - Module type ('water' or 'hoa')
 * @returns {Array} Array of unpaid bills (all amounts in centavos)
 */
async function getUnpaidBillsForUnit(db, clientId, unitId, moduleType = 'water') {
  const bills = [];
  const collectionPath = moduleType === 'water' ? 'waterBills' : 'hoaDues';
  
  // Query all bill documents to find unpaid bills for this unit
  const billsSnapshot = await db.collection('clients').doc(clientId)
    .collection('projects').doc(collectionPath)
    .collection('bills')
    .orderBy('__name__') // Order by document name (YYYY-MM format - oldest first)
    .get();
  
  console.log(`🔍 [DEBUG] getUnpaidBillsForUnit: Found ${billsSnapshot.size} bill documents for unit ${unitId}`);
  
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
          lastPenaltyUpdate: unitBill.lastPenaltyUpdate || null
        });
      }
    }
  });
  
  console.log(`🔍 [DEBUG] getUnpaidBillsForUnit: Returning ${bills.length} unpaid bills`);
  
  return bills; // Already sorted oldest first by document name
}

/**
 * Calculate payment distribution across unpaid bills
 * 
 * This is the single source of truth for payment distribution calculations
 * 
 * @param {object} params - Calculation parameters
 * @param {string} params.clientId - Client ID
 * @param {string} params.unitId - Unit ID
 * @param {number} params.paymentAmount - Payment amount in PESOS
 * @param {number} params.currentCreditBalance - Current credit balance in PESOS (default: 0)
 * @param {string} params.moduleType - 'water' or 'hoa' (default: 'water')
 * @param {Date|string} params.payOnDate - Optional payment date for backdated payments
 * @param {number} params.selectedMonth - Optional month index to filter bills (0-11)
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
export async function calculatePaymentDistribution(params) {
  const {
    clientId,
    unitId,
    paymentAmount,
    currentCreditBalance = 0,
    moduleType = 'water',
    payOnDate = null,
    selectedMonth = null
  } = params;
  
  console.log(`💧 Calculating payment distribution: Unit ${unitId}, Amount $${paymentAmount}, Credit $${currentCreditBalance}`);
  console.log(`🔍 [PARAMETERS] Module: ${moduleType}, payOnDate: ${payOnDate}, selectedMonth: ${selectedMonth}`);
  
  // Initialize database
  const db = await getDb();
  
  // Calculate total available funds in PESOS and CENTAVOS
  const totalAvailableFundsPesos = roundCurrency(paymentAmount + currentCreditBalance);
  const totalAvailableFundsCentavos = pesosToCentavos(totalAvailableFundsPesos);
  
  console.log(`💰 Available funds: Payment $${paymentAmount} + Credit $${currentCreditBalance} = Total $${totalAvailableFundsPesos} (${totalAvailableFundsCentavos} centavos)`);
  
  // Get unpaid bills (oldest first)
  let unpaidBills = await getUnpaidBillsForUnit(db, clientId, unitId, moduleType);
  console.log(`📋 Found ${unpaidBills.length} unpaid bills for distribution`);
  
  // Filter bills by selected month if provided
  if (selectedMonth !== null && selectedMonth !== undefined) {
    console.log(`🔍 [MONTH FILTERING] Filtering to only include months up to index ${selectedMonth}`);
    
    const originalCount = unpaidBills.length;
    unpaidBills = unpaidBills.filter(bill => {
      const billPeriod = bill.period || bill.billId || bill.billPeriod;
      const billMonthMatch = billPeriod?.match(/\d{4}-(\d{2})/);
      if (billMonthMatch) {
        const billMonthIndex = parseInt(billMonthMatch[1]);
        const isIncluded = billMonthIndex <= selectedMonth;
        console.log(`🔍 [MONTH FILTERING] Bill ${billPeriod}: month index ${billMonthIndex} vs selected ${selectedMonth} -> ${isIncluded ? 'INCLUDED' : 'EXCLUDED'}`);
        return isIncluded;
      }
      return true; // Include bills without period format
    });
    
    console.log(`🔍 [MONTH FILTERING] Filtered from ${originalCount} to ${unpaidBills.length} bills`);
  }
  
  // Handle backdated payments by recalculating penalties as of payment date
  if (payOnDate) {
    const paymentDate = typeof payOnDate === 'string' ? new Date(payOnDate) : payOnDate;
    console.log(`📅 Recalculating penalties as of payment date: ${paymentDate.toISOString()}`);
    
    const config = await getBillingConfig(db, clientId, moduleType);
    const recalculatedBills = await recalculatePenaltiesAsOfDate(clientId, unpaidBills, paymentDate, config);
    unpaidBills = recalculatedBills;
  }
  
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
  for (let i = 0; i < unpaidBills.length; i++) {
    const bill = unpaidBills[i];
    const billPayment = billPayments[i];
    
    if (remainingFundsCentavos <= 0) break;
    
    const unpaidAmount = bill.totalAmount - (bill.paidAmount || 0);
    const baseUnpaid = bill.currentCharge - (bill.basePaid || 0);
    const penaltyUnpaid = bill.penaltyAmount - (bill.penaltyPaid || 0);
    
    console.log(`📄 Bill ${bill.period}: Total due ${unpaidAmount} centavos ($${centavosToPesos(unpaidAmount)}) (Base: ${baseUnpaid}, Penalties: ${penaltyUnpaid})`);
    
    if (remainingFundsCentavos >= unpaidAmount) {
      // Pay bill in full
      billPayment.amountPaid = unpaidAmount;
      billPayment.baseChargePaid = baseUnpaid;
      billPayment.penaltyPaid = penaltyUnpaid;
      billPayment.newStatus = 'paid';
      
      totalBaseChargesPaidCentavos += baseUnpaid;
      totalPenaltiesPaidCentavos += penaltyUnpaid;
      remainingFundsCentavos -= unpaidAmount;
      
      console.log(`✅ Bill ${bill.period} paid in full: ${unpaidAmount} centavos ($${centavosToPesos(unpaidAmount)})`);
      
    } else if (remainingFundsCentavos > 0) {
      // Partial payment - prioritize penalties over base charges
      let amountToApply = remainingFundsCentavos;
      let basePortionPaid = 0;
      let penaltyPortionPaid = 0;
      
      if (penaltyUnpaid > 0) {
        penaltyPortionPaid = Math.min(amountToApply, penaltyUnpaid);
        amountToApply -= penaltyPortionPaid;
      }
      
      if (amountToApply > 0 && baseUnpaid > 0) {
        basePortionPaid = Math.min(amountToApply, baseUnpaid);
      }
      
      billPayment.amountPaid = remainingFundsCentavos;
      billPayment.baseChargePaid = basePortionPaid;
      billPayment.penaltyPaid = penaltyPortionPaid;
      billPayment.newStatus = 'partial';
      
      totalBaseChargesPaidCentavos += basePortionPaid;
      totalPenaltiesPaidCentavos += penaltyPortionPaid;
      
      console.log(`🔸 Bill ${bill.period} partial payment: ${remainingFundsCentavos} centavos (Base: ${basePortionPaid}, Penalties: ${penaltyPortionPaid})`);
      
      remainingFundsCentavos = 0;
    }
  }
  
  // Calculate credit usage vs overpayment
  let creditUsed = 0;
  let overpayment = 0;
  let newCreditBalance = 0;
  
  // Logic: Compare PAYMENT AMOUNT to bills due, not total funds
  if (paymentAmountCentavos >= totalBillsDueCentavos) {
    // Payment covers all bills - no credit needed
    creditUsed = 0;
    // Excess payment goes to credit balance
    const excessPaymentCentavos = paymentAmountCentavos - totalBillsDueCentavos;
    overpayment = roundCurrency(centavosToPesos(excessPaymentCentavos));
    newCreditBalance = roundCurrency(currentCreditBalance + overpayment);
  } else {
    // Payment doesn't cover bills - use credit to make up difference
    const shortfallCentavos = totalBillsDueCentavos - paymentAmountCentavos;
    const creditNeededCentavos = Math.min(shortfallCentavos, pesosToCentavos(currentCreditBalance));
    creditUsed = roundCurrency(centavosToPesos(creditNeededCentavos));
    newCreditBalance = roundCurrency(currentCreditBalance - creditUsed);
    overpayment = 0;
  }
  
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
  roundCurrency,
  getBillingConfig,
  recalculatePenaltiesAsOfDate,
  getUnpaidBillsForUnit
};


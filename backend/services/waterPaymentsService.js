import { getDb } from '../firebase.js';
import { waterDataService } from './waterDataService.js';
import { createTransaction } from '../controllers/transactionsController.js';
import { databaseFieldMappings } from '../utils/databaseFieldMappings.js';
// import { calculateCurrentPenalties } from '../utils/penaltyCalculator.js'; // DEPRECATED - now using stored penalty data
import axios from 'axios';
import { getNow } from '../services/DateService.js';
import { CreditAPI } from '../api/creditAPI.js';
import { pesosToCentavos, centavosToPesos } from '../utils/currencyUtils.js';

const { dollarsToCents, centsToDollars } = databaseFieldMappings;

// Create axios instance for internal API calls to HOA module
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://sams-backend.vercel.app/api'
    : 'http://localhost:5001/api'
});

/**
 * Create Water Bills allocations from bill payments (mirrors HOA Dues pattern)
 * @param {Array} billPayments - Array of bill payment objects
 * @param {string} unitId - Unit identifier
 * @param {object} paymentData - Payment data containing credit info
 * @returns {Array} Array of allocation objects
 */
function createWaterBillsAllocations(billPayments, unitId, paymentData) {
  const allocations = [];
  let allocationIndex = 0;
  
  console.log(`🔍 Creating allocations for ${billPayments.length} bill payments:`, billPayments);
  
  // Add allocations for each bill payment (base charges and penalties)
  if (billPayments && billPayments.length > 0) {
    billPayments.forEach((billPayment) => {
      // Add base charge allocation
      if (billPayment.baseChargePaid > 0) {
        allocations.push({
          id: `alloc_${String(++allocationIndex).padStart(3, '0')}`,
          type: "water_bill",
          targetId: `bill_${billPayment.billId}`,
          targetName: `${billPayment.billPeriod} - Unit ${unitId}`,
          amount: billPayment.baseChargePaid, // Keep in dollars - transactionController will convert to cents
          percentage: null,
          categoryName: "Water Consumption",
          categoryId: "water-consumption",
          data: {
            unitId: unitId,
            billId: billPayment.billId,
            billPeriod: billPayment.billPeriod,
            billType: "base_charge"
          },
          metadata: {
            processingStrategy: "water_bills",
            cleanupRequired: true,
            auditRequired: true,
            createdAt: getNow().toISOString()
          }
        });
      }
      
      // Add penalty allocation (only if penalties exist)
      if (billPayment.penaltyPaid > 0) {
        allocations.push({
          id: `alloc_${String(++allocationIndex).padStart(3, '0')}`,
          type: "water_penalty",
          targetId: `penalty_${billPayment.billId}`,
          targetName: `${billPayment.billPeriod} Penalties - Unit ${unitId}`,
          amount: billPayment.penaltyPaid, // Keep in dollars - transactionController will convert to cents
          percentage: null,
          categoryName: "Water Penalties",
          categoryId: "water-penalties",
          data: {
            unitId: unitId,
            billId: billPayment.billId,
            billPeriod: billPayment.billPeriod,
            billType: "penalty"
          },
          metadata: {
            processingStrategy: "water_bills",
            cleanupRequired: true,
            auditRequired: true,
            createdAt: getNow().toISOString()
          }
        });
      }
    });
  }
  
  // Add Credit Balance allocation for overpayments (positive) or usage (negative)
  if (paymentData && paymentData.overpayment && paymentData.overpayment > 0) {
    // Overpayment: Credit balance is ADDED (positive allocation)
    allocations.push({
      id: `alloc_${String(++allocationIndex).padStart(3, '0')}`,
      type: "water_credit",
      targetId: `credit_${unitId}_water`,
      targetName: `Account Credit - Unit ${unitId}`,
      amount: paymentData.overpayment, // Keep in dollars - transactionController will convert to cents
      percentage: null,
      categoryName: "Account Credit",
      categoryId: "account-credit",
      data: {
        unitId: unitId,
        creditType: "water_overpayment"
      },
      metadata: {
        processingStrategy: "account_credit",
        cleanupRequired: true,
        auditRequired: true,
        createdAt: getNow().toISOString()
      }
    });
  } else if (paymentData && paymentData.creditUsed && paymentData.creditUsed > 0) {
    // Credit was used to help pay bills (negative allocation)
    allocations.push({
      id: `alloc_${String(++allocationIndex).padStart(3, '0')}`,
      type: "water_credit",
      targetId: `credit_${unitId}_water`,
      targetName: `Account Credit - Unit ${unitId}`,
      amount: -paymentData.creditUsed, // Keep in dollars (negative for credit usage) - transactionController will convert to cents
      percentage: null,
      categoryName: "Account Credit",
      categoryId: "account-credit",
      data: {
        unitId: unitId,
        creditType: "water_credit_used"
      },
      metadata: {
        processingStrategy: "account_credit",
        cleanupRequired: true,
        auditRequired: true,
        createdAt: getNow().toISOString()
      }
    });
  }
  
  return allocations;
}

/**
 * Create allocation summary for transaction
 * @param {Array} billPayments - Array of bill payment objects
 * @param {number} totalAmountCents - Total transaction amount in cents
 * @returns {Object} Allocation summary object
 */
function createWaterBillsAllocationSummary(billPayments, totalAmountCents) {
  if (!billPayments || billPayments.length === 0) {
    return {
      totalAllocated: 0,
      allocationCount: 0,
      allocationType: null,
      hasMultipleTypes: false
    };
  }
  
  // Calculate total allocated (bills + penalties) in cents for comparison
  const totalAllocated = billPayments.reduce((sum, payment) => {
    return sum + dollarsToCents(payment.baseChargePaid) + dollarsToCents(payment.penaltyPaid);
  }, 0);
  
  // Check if we have multiple types (bills + penalties)
  const hasPenalties = billPayments.some(p => p.penaltyPaid > 0);
  
  return {
    totalAllocated: totalAllocated,
    allocationCount: billPayments.length * (hasPenalties ? 2 : 1), // Count base + penalty as separate
    allocationType: "water_bill",
    hasMultipleTypes: hasPenalties, // True if both bills and penalties exist
    // Verify allocation integrity
    integrityCheck: {
      expectedTotal: totalAmountCents,
      actualTotal: totalAllocated,
      isValid: Math.abs(totalAmountCents - totalAllocated) < 100 // Allow 1 peso tolerance
    }
  };
}

class WaterPaymentsService {
  constructor() {
    this.db = null;
  }

  async _initializeDb() {
    if (!this.db) {
      this.db = await getDb();
    }
  }
  
  /**
   * Round currency amounts to prevent floating point precision errors
   */
  _roundCurrency(amount) {
    return Math.round(amount * 100) / 100;
  }
  
  /**
   * Get billing configuration for a client
   * @param {string} clientId - Client ID
   * @returns {object} Billing configuration
   */
  async _getBillingConfig(clientId) {
    const configDoc = await this.db
      .collection('clients')
      .doc(clientId)
      .collection('config')
      .doc('waterBills')
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
   * @param {Array} bills - Array of bill objects
   * @param {Date} asOfDate - Date to calculate penalties as of
   * @returns {Array} Bills with recalculated penalties
   */
  async _recalculatePenaltiesAsOfDate(clientId, bills, asOfDate) {
    console.log(`🔄 Recalculating penalties as of ${asOfDate.toISOString()}`);
    
    // Get billing config for penalty rate
    const config = await this._getBillingConfig(clientId);
    const penaltyRate = config.penaltyRate || 0.05; // 5% per month default
    const gracePeriodDays = config.penaltyDays || 10; // 10 days grace period default (penaltyDays is the grace period)
    
    const recalculatedBills = [];
    
    for (const bill of bills) {
      const billDate = new Date(bill.billDate || bill.createdAt);
      
      // Get due date from bill period or use default grace period
      let dueDate;
      if (bill.dueDate) {
        dueDate = new Date(bill.dueDate);
      } else {
        // Calculate due date based on bill period (e.g., "2026-00" = July 2025)
        // Default: 15th of the month + 7 days grace period = 22nd
        const billPeriod = bill.billPeriod || bill.period;
        if (billPeriod) {
          const [fiscalYear, month] = billPeriod.split('-');
          const calendarYear = fiscalYear === '2026' ? 2025 : parseInt(fiscalYear);
          const monthIndex = parseInt(month) + 6; // Convert fiscal year months to calendar year months (July = 0 in fiscal, 6 in calendar)
          dueDate = new Date(calendarYear, monthIndex, 15 + gracePeriodDays); // 15th + grace period
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
        
        recalculatedPenaltyAmount = Math.round(bill.currentCharge * penaltyRate * monthsPastDue);
      }
      
      const recalculatedTotalAmount = bill.currentCharge + recalculatedPenaltyAmount;
      
      console.log(`   Bill ${bill.billId}: ${daysPastDue} days past due, penalty: ${bill.penaltyAmount} → ${recalculatedPenaltyAmount}`);
      
      recalculatedBills.push({
        ...bill,
        penaltyAmount: recalculatedPenaltyAmount,
        totalAmount: recalculatedTotalAmount,
        // Reset paid amounts since we're recalculating
        paidAmount: 0,
        penaltyPaid: 0,
        basePaid: 0
      });
    }
    
    return recalculatedBills;
  }
  
  /**
   * Calculate payment distribution for preview or actual payment
   * This is the single source of truth for payment calculations
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {number} paymentAmount - Payment amount in PESOS
   * @param {number} currentCreditBalance - Current credit balance in PESOS
   * @param {Date|string} payOnDate - Optional payment date for backdated payments (defaults to current date)
   * @param {number} selectedMonth - Optional month index to filter bills (only consider bills up to this month)
   * @returns {object} Distribution breakdown with allocations (all amounts in PESOS)
   */
  async calculatePaymentDistribution(clientId, unitId, paymentAmount, currentCreditBalance = 0, payOnDate = null, selectedMonth = null) {
    await this._initializeDb();
    
    console.log(`💧 Calculating payment distribution: Unit ${unitId}, Amount $${paymentAmount}, Credit $${currentCreditBalance}`);
    console.log(`🔍 [PARAMETERS] payOnDate: ${payOnDate}, selectedMonth: ${selectedMonth}`);
    
    // Calculate total available funds in PESOS and CENTAVOS
    const totalAvailableFundsPesos = this._roundCurrency(paymentAmount + currentCreditBalance);
    const totalAvailableFundsCentavos = pesosToCentavos(totalAvailableFundsPesos);
    
    console.log(`💰 Available funds calculation: Payment $${paymentAmount} + Credit $${currentCreditBalance} = Total $${totalAvailableFundsPesos} (${totalAvailableFundsCentavos} centavos)`);
    
    // Get unpaid water bills (oldest first)
    let unpaidBills = await this._getUnpaidBillsForUnit(clientId, unitId);
    console.log(`🔍 [MONTH FILTERING] Raw unpaidBills from _getUnpaidBillsForUnit:`, unpaidBills.map(b => ({ id: b.id, billId: b.billId, billPeriod: b.billPeriod, unpaidAmount: b.unpaidAmount })));
    
    // Filter bills to only include those up to and including the selected month
    if (selectedMonth !== null && selectedMonth !== undefined) {
      console.log(`🔍 [MONTH FILTERING] Starting with ${unpaidBills.length} unpaid bills`);
      console.log(`🔍 [MONTH FILTERING] Filtering to only include months up to index ${selectedMonth}`);
      
      const originalCount = unpaidBills.length;
      unpaidBills = unpaidBills.filter(bill => {
        // Extract month index from bill period (e.g., "2026-01" -> 1)
        // The bills have a 'period' property that contains the fiscal period like "2026-00"
        const billPeriod = bill.period || bill.billId || bill.billPeriod;
        const billMonthMatch = billPeriod?.match(/\d{4}-(\d{2})/);
        if (billMonthMatch) {
          const billMonthIndex = parseInt(billMonthMatch[1]);
          const isIncluded = billMonthIndex <= selectedMonth;
          console.log(`🔍 [MONTH FILTERING] Bill ${billPeriod}: month index ${billMonthIndex} vs selected ${selectedMonth} -> ${isIncluded ? 'INCLUDED' : 'EXCLUDED'}`);
          return isIncluded;
        } else {
          console.log(`🔍 [MONTH FILTERING] Bill ${billPeriod}: no period format found -> INCLUDED`);
          return true; // Include bills without period format
        }
      });
      
      console.log(`🔍 [MONTH FILTERING] Filtered from ${originalCount} to ${unpaidBills.length} bills`);
      console.log(`🔍 [MONTH FILTERING] Remaining bills:`, unpaidBills.map(b => `${b.period || b.billId || b.billPeriod} ($${b.unpaidAmount})`).join(', '));
    } else {
      console.log(`🔍 [MONTH FILTERING] No selectedMonth provided - using all ${unpaidBills.length} bills`);
    }
    
    console.log(`📋 Found ${unpaidBills.length} unpaid bills for distribution calculation`);
    
    // Handle backdated payments by recalculating penalties as of payment date
    if (payOnDate) {
      const paymentDate = typeof payOnDate === 'string' ? new Date(payOnDate) : payOnDate;
      console.log(`📅 Recalculating penalties as of payment date: ${paymentDate.toISOString()}`);
      console.log(`📅 BEFORE recalculation - sample bill:`, unpaidBills[0] ? {
        billId: unpaidBills[0].billId,
        billPeriod: unpaidBills[0].billPeriod,
        dueDate: unpaidBills[0].dueDate,
        currentCharge: unpaidBills[0].currentCharge,
        penaltyAmount: unpaidBills[0].penaltyAmount,
        totalAmount: unpaidBills[0].totalAmount
      } : 'No bills found');
      
      // For backdated payments, ALWAYS recalculate penalties based on the payment date
      // This overrides any stored penalty data to ensure accurate backdated calculations
      console.log(`📅 Recalculating penalties for all ${unpaidBills.length} bills based on payment date`);
      const recalculatedBills = await this._recalculatePenaltiesAsOfDate(clientId, unpaidBills, paymentDate);
      
      console.log(`📅 AFTER recalculation - sample bill:`, recalculatedBills[0] ? {
        billId: recalculatedBills[0].billId,
        penaltyAmount: recalculatedBills[0].penaltyAmount,
        totalAmount: recalculatedBills[0].totalAmount
      } : 'No bills found');
      
      unpaidBills = recalculatedBills;
    }
    
    // Calculate total bills due in centavos
    const totalBillsDueCentavos = unpaidBills.reduce((sum, bill) => {
      // Use the recalculated totalAmount (includes penalty adjustments)
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
      const unpaidAmount = bill.totalAmount - (bill.paidAmount || 0);
      const baseUnpaid = bill.currentCharge - (bill.basePaid || 0);
      const penaltyUnpaid = bill.penaltyAmount - (bill.penaltyPaid || 0);
      
      billPayments.push({
        unitId: unitId,
        billId: bill.id,
        billPeriod: bill.period,
        amountPaid: 0,                    // Start with zero payment
        baseChargePaid: 0,                // Start with zero payment
        penaltyPaid: 0,                   // Start with zero payment
        newStatus: 'unpaid'               // Start as unpaid
      });
    }
    
    // Now apply funds to bills (in CENTAVOS for precision)
    for (let i = 0; i < unpaidBills.length; i++) {
      const bill = unpaidBills[i];
      const billPayment = billPayments[i];
      
      if (remainingFundsCentavos <= 0) break;
      
      // Bills are in centavos
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
        // Partial payment - prioritize penalties over base charges (accounting convention)
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
    
    // Calculate credit usage vs overpayment (in PESOS for return)
    const remainingFundsPesos = centavosToPesos(remainingFundsCentavos);
    
    let creditUsed = 0;
    let overpayment = 0;
    let newCreditBalance = 0;
    
    // Calculate based on TOTAL AVAILABLE FUNDS (payment + credit) vs total bills due
    const totalFundsCentavos = paymentAmountCentavos + pesosToCentavos(currentCreditBalance);
    
    if (totalFundsCentavos < totalBillsDueCentavos) {
      // Underpayment scenario - use all available credit
      creditUsed = this._roundCurrency(currentCreditBalance);
      newCreditBalance = 0;
      overpayment = 0;
    } else {
      // Overpayment scenario - excess funds go to credit balance
      const excessFundsCentavos = totalFundsCentavos - totalBillsDueCentavos;
      overpayment = this._roundCurrency(centavosToPesos(excessFundsCentavos));
      newCreditBalance = this._roundCurrency(currentCreditBalance + overpayment);
      creditUsed = 0;
    }
    
    console.log(`💰 Distribution calculated: Credit used $${creditUsed}, Overpaid $${overpayment}, New balance $${newCreditBalance}`);
    console.log(`🔍 DEBUG: paymentAmountCentavos=${paymentAmountCentavos}, totalBillsDueCentavos=${totalBillsDueCentavos}, remainingFundsCentavos=${remainingFundsCentavos}`);
    console.log(`🔍 DEBUG: Payment $${paymentAmount} vs Bills $${centavosToPesos(totalBillsDueCentavos)} = ${paymentAmountCentavos < totalBillsDueCentavos ? 'UNDERPAYMENT' : 'OVERPAYMENT'}`);
    if (paymentAmountCentavos >= totalBillsDueCentavos) {
      const excessPaymentCentavos = paymentAmountCentavos - totalBillsDueCentavos;
      console.log(`🔍 OVERPAYMENT DEBUG: excessPaymentCentavos=${excessPaymentCentavos}, excessPaymentPesos=$${centavosToPesos(excessPaymentCentavos)}`);
    }
    
    // Convert billPayments to PESOS for return to frontend
    const billPaymentsForAllocations = billPayments.map(bp => {
      // Find the original bill to get UNPAID amounts due (for frontend display)
      const originalBill = unpaidBills.find(bill => bill.period === bp.billPeriod);
      
      // Calculate UNPAID portions (what's still owed after previous payments)
      const unpaidBaseDue = originalBill ? originalBill.currentCharge - (originalBill.basePaid || 0) : bp.baseChargePaid;
      const unpaidPenaltyDue = originalBill ? originalBill.penaltyAmount - (originalBill.penaltyPaid || 0) : bp.penaltyPaid;
      const totalUnpaidDue = unpaidBaseDue + unpaidPenaltyDue;
      
      return {
        ...bp,
        amountPaid: centavosToPesos(bp.amountPaid),
        baseChargePaid: centavosToPesos(bp.baseChargePaid),
        penaltyPaid: centavosToPesos(bp.penaltyPaid),
        // Return UNPAID amounts (what's still owed) for frontend display
        // This ensures the modal shows correct "Total Due" that doesn't change when payment amount changes
        totalBaseDue: centavosToPesos(unpaidBaseDue),
        totalPenaltyDue: centavosToPesos(unpaidPenaltyDue),
        totalDue: centavosToPesos(totalUnpaidDue)
      };
    });
    
    // Generate allocations using existing function
    const paymentDataForAllocations = {
      creditUsed: creditUsed,
      overpayment: overpayment,
      newCreditBalance: newCreditBalance
    };
    
    const allocations = createWaterBillsAllocations(billPaymentsForAllocations, unitId, paymentDataForAllocations);
    const allocationSummary = createWaterBillsAllocationSummary(billPaymentsForAllocations, dollarsToCents(paymentAmount));
    
    // Return everything in PESOS for frontend display
    return {
      totalAvailableFunds: totalAvailableFundsPesos,
      billPayments: billPaymentsForAllocations, // In pesos
      allocations: allocations,
      allocationSummary: allocationSummary,
      totalBaseCharges: centavosToPesos(totalBaseChargesPaidCentavos),
      totalPenalties: centavosToPesos(totalPenaltiesPaidCentavos),
      creditUsed: creditUsed,
      overpayment: overpayment,
      currentCreditBalance: currentCreditBalance, // Add this for frontend
      newCreditBalance: newCreditBalance,
      totalBillsDue: centavosToPesos(totalBillsDueCentavos) // Add missing field
    };
  }
  
  /**
   * Record a payment against water bills using credit balance integration
   * Follows identical logic to HOA Dues payment system
   */
  async recordPayment(clientId, unitId, paymentData) {
    await this._initializeDb();
    
    const { 
      amount, 
      paymentDate = getNow().toISOString().split('T')[0], 
      paymentMethod = 'cash',
      paymentMethodId,
      reference = '',
      notes = '',
      accountId,
      accountType,
      selectedMonth  // FIX #1: Extract selectedMonth from paymentData
    } = paymentData;
    
    // Validate required fields
    if (!unitId || !amount || amount <= 0) {
      throw new Error('Unit ID and positive payment amount are required');
    }
    
    if (!accountId || !accountType) {
      throw new Error('Account ID and account type are required for transaction creation');
    }
    
    console.log(`💧 Recording water payment: Unit ${unitId}, Amount $${amount} (${pesosToCentavos(amount)} centavos)`);
    
    // STEP 1: Get current credit balance from HOA Dues module (in pesos)
    const { getFiscalYear } = await import('../utils/fiscalYearUtils.js');
    const fiscalYear = getFiscalYear(getNow(), 7); // AVII uses July start
    const creditResponse = await this._getCreditBalance(clientId, unitId, fiscalYear);
    const currentCreditBalance = creditResponse.creditBalance || 0; // In pesos (HOA module uses pesos)
    
    console.log(`💰 Current credit balance: $${currentCreditBalance}`);
    
    // STEP 2: Use centralized calculation method (single source of truth)
    // Pass payment date for backdated payment penalty recalculation
    // FIX #1: Pass selectedMonth to filter bills correctly (matches preview behavior)
    const distribution = await this.calculatePaymentDistribution(clientId, unitId, amount, currentCreditBalance, paymentDate, selectedMonth);
    
    console.log(`📊 Distribution calculated: ${distribution.billPayments.length} bills, Credit used: $${distribution.creditUsed}, Overpayment: $${distribution.overpayment}`);
    
    // STEP 3: Handle no-bills case (entire amount goes to credit)
    if (distribution.billPayments.length === 0) {
      await this._updateCreditBalance(clientId, unitId, fiscalYear, {
        newBalance: distribution.newCreditBalance,
        changeAmount: amount,
        changeType: 'water_overpayment',
        description: `Water bill overpayment - no bills due`,
        transactionId: null // Will be updated after transaction creation
      });
      
      // Create transaction for the overpayment with allocations
      const transactionData = {
        amount: amount, // In pesos - transactionController converts to centavos
        type: 'income',
        categoryId: 'account-credit',
        categoryName: 'Account Credit',
        description: `Water bill credit - Unit ${unitId}`,
        unitId: unitId,
        accountId: accountId,
        accountType: accountType,
        paymentMethod: paymentMethod,
        paymentMethodId: paymentMethodId,
        reference: reference,
        notes: notes || `Water bill overpayment - no bills due`,
        date: paymentDate,
        allocations: distribution.allocations,
        allocationSummary: distribution.allocationSummary
      };
      
      const transactionResult = await createTransaction(clientId, transactionData);
      
      return {
        success: true,
        paymentType: 'credit_only',
        totalFundsAvailable: distribution.totalAvailableFunds,
        billsPaid: [],
        newCreditBalance: distribution.newCreditBalance,
        creditUsed: 0,
        overpayment: amount,
        transactionId: transactionResult
      };
    }
    
    // STEP 4: Use distribution data (from centralized calculation)
    // Convert billPayments back to centavos for bill updates
    const billPayments = distribution.billPayments.map(bp => ({
      ...bp,
      amountPaid: pesosToCentavos(bp.amountPaid),
      baseChargePaid: pesosToCentavos(bp.baseChargePaid),
      penaltyPaid: pesosToCentavos(bp.penaltyPaid)
    }));
    
    const totalBaseChargesPaidCentavos = pesosToCentavos(distribution.totalBaseCharges);
    const totalPenaltiesPaidCentavos = pesosToCentavos(distribution.totalPenalties);
    const newCreditBalance = distribution.newCreditBalance;
    const creditUsed = distribution.creditUsed;
    const overpayment = distribution.overpayment;
    
    // Note: Credit balance will be updated AFTER transaction creation so we can include transaction ID
    
    // STEP 5: Use allocations from distribution (already generated by calculatePaymentDistribution)
    const { default: waterBillsService } = await import('./waterBillsService.js');
    
    console.log(`📊 Using ${distribution.allocations.length} allocations from distribution calculation`);
    
    // Enhanced transaction data with water bill details AND allocations
    const transactionData = {
      amount: amount, // In pesos - transactionController converts to centavos
      type: 'income',
      categoryId: 'water-consumption',
      categoryName: 'Water Consumption',
      vendorId: 'deposit',
      description: await this._generateEnhancedTransactionDescription(distribution.billPayments, distribution.totalBaseCharges, distribution.totalPenalties, unitId, clientId, waterBillsService),
      unitId: unitId,
      accountId: accountId,
      accountType: accountType,
      paymentMethod: paymentMethod,
      paymentMethodId: paymentMethodId,
      reference: reference,
      notes: await this._generateEnhancedTransactionNotes(distribution.billPayments, distribution.totalBaseCharges, distribution.totalPenalties, unitId, notes, amount, clientId, waterBillsService),
      date: paymentDate,
      
      // Use allocations from distribution calculation
      allocations: distribution.allocations,
      allocationSummary: distribution.allocationSummary,
      
      // Add metadata for water bills context to support future receipt generation
      metadata: {
        billPayments: distribution.billPayments.map(bp => ({
          period: bp.billPeriod,
          amountPaid: bp.amountPaid,
          baseChargePaid: bp.baseChargePaid,
          penaltyPaid: bp.penaltyPaid
        })),
        totalBaseCharges: distribution.totalBaseCharges,
        totalPenalties: distribution.totalPenalties,
        paymentType: distribution.billPayments.length > 0 ? 'bills_and_credit' : 'credit_only'
      }
    };
    
    // Set category to "-Split-" when multiple allocations exist (following HOA Dues pattern)
    if (distribution.allocations.length > 1) {
      transactionData.categoryName = "-Split-";
      transactionData.categoryId = "-split-";
      console.log(`✂️ Multiple allocations detected - setting category to "-Split-"`);
    }
    
    const transactionResult = await createTransaction(clientId, transactionData);
    console.log(`💳 Transaction created:`, { transactionId: transactionResult, vendorId: transactionData.vendorId });
    
    // STEP 7: Update credit balance with actual transaction ID (moved here from before transaction creation)
    await this._updateCreditBalance(clientId, unitId, fiscalYear, {
      newBalance: newCreditBalance,
      changeAmount: overpayment > 0 ? overpayment : -creditUsed,
      changeType: overpayment > 0 ? 'water_overpayment' : 'water_credit_used',
      description: this._generateCreditDescription(billPayments, centavosToPesos(totalBaseChargesPaidCentavos), centavosToPesos(totalPenaltiesPaidCentavos)),
      transactionId: transactionResult // Now we have the actual transaction ID!
    });
    console.log(`✅ Credit balance updated with transaction ID: ${transactionResult}`);
    
    // STEP 8: Update water bills with payment info (billPayments are in centavos)
    await this._updateBillsWithPayments(clientId, unitId, billPayments, paymentMethod, paymentDate, reference, transactionResult, amount);
    
    // Payment complete - frontend will fetch fresh data on next read
    console.log(`✅ [PAYMENT] Payment recorded successfully - bill documents updated`);
    
    return {
      success: true,
      paymentType: 'bills_and_credit',
      totalFundsAvailable: distribution.totalAvailableFunds,
      billsPaid: billPayments, // In centavos
      newCreditBalance: newCreditBalance, // In pesos
      creditUsed: creditUsed, // In pesos
      overpayment: overpayment, // In pesos
      totalBaseChargesPaid: centavosToPesos(totalBaseChargesPaidCentavos), // Convert to pesos for response
      totalPenaltiesPaid: centavosToPesos(totalPenaltiesPaidCentavos), // Convert to pesos for response
      transactionId: transactionResult
    };
  }
  
  /**
   * Get credit balance using new /credit endpoint (Task 2 Issue 1 fix)
   */
  async _getCreditBalance(clientId, unitId, year) {
    try {
      console.log(`📊 Getting credit balance via /credit endpoint: Unit ${unitId}, Year ${year}`);
      
      const creditData = await CreditAPI.getCreditBalance(clientId, unitId);
      
      console.log(`📊 Credit balance accessed by water_bills: Unit ${unitId}, Year ${year}, Balance: $${creditData.creditBalance || 0}`);
      
      return {
        creditBalance: creditData.creditBalance || 0, // Already in dollars from CreditAPI
        creditBalanceHistory: creditData.creditBalanceHistory || []
      };
      
    } catch (error) {
      console.error('Error getting credit balance via /credit endpoint:', error);
      // Return zero balance if credit endpoint unavailable (graceful degradation)
      return { creditBalance: 0, creditBalanceHistory: [] };
    }
  }
  
  /**
   * Update credit balance using new /credit endpoint (Task 2 Issue 1 fix)
   */
  async _updateCreditBalance(clientId, unitId, year, updateData) {
    try {
      const { newBalance, changeAmount, changeType, description, transactionId } = updateData;
      
      console.log(`💰 Updating credit balance via /credit endpoint: Unit ${unitId}, New balance: $${newBalance}`);
      
      // Calculate amount change in cents for CreditAPI
      const amountChangeInCents = dollarsToCents(changeAmount);
      
      // Use the new CreditAPI
      const result = await CreditAPI.updateCreditBalance(clientId, unitId, {
        amount: amountChangeInCents,
        transactionId: transactionId,
        note: description || `Water Bills payment - ${changeType}`,
        source: 'waterBills'
      });
      
      console.log(`✅ Credit balance updated by water_bills via /credit endpoint: $${newBalance}`);
      
      return {
        success: true,
        newBalance: newBalance,
        changeAmount: changeAmount
      };
      
    } catch (error) {
      console.error('Error updating credit balance via /credit endpoint:', error);
      throw new Error('Failed to update credit balance via /credit endpoint');
    }
  }
  
  /**
   * Get unpaid bills for a unit with DYNAMIC penalty calculation
   * Bills store base amounts + due dates, penalties calculated in real-time
   */
  async _getUnpaidBillsForUnit(clientId, unitId) {
    const bills = [];
    
    // Query all bill documents to find unpaid bills for this unit
    const billsSnapshot = await this.db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills')
      .orderBy('__name__') // Order by document name (YYYY-MM format - oldest first)
      .get();
    
    console.log(`🔍 [DEBUG] _getUnpaidBillsForUnit: Found ${billsSnapshot.size} bill documents for unit ${unitId}`);
    
    // Collect bill metadata (no longer need penalty calculation data)
    const billsMetadata = [];
    
    billsSnapshot.forEach(doc => {
      const billData = doc.data();
      const unitBill = billData.bills?.units?.[unitId];
      
      console.log(`🔍 [DEBUG] Bill ${doc.id}: unitBill exists=${!!unitBill}, status=${unitBill?.status}, currentCharge=${unitBill?.currentCharge}, paidAmount=${unitBill?.paidAmount}`);
      
      if (unitBill && unitBill.status !== 'paid') {
        const paidAmount = unitBill.paidAmount || 0;
        const basePaid = unitBill.basePaid || 0;
        const penaltyPaid = unitBill.penaltyPaid || 0;
        
        // Extract amounts from bill structure
        const storedBaseAmount = unitBill.currentCharge || 0;
        const storedPenaltyAmount = unitBill.penaltyAmount || 0;
        const totalDue = storedBaseAmount + storedPenaltyAmount;
        
        // Calculate unpaid amounts - use the correct logic
        const unpaidBaseAmount = storedBaseAmount - basePaid;
        const unpaidPenaltyAmount = storedPenaltyAmount - penaltyPaid;
        const totalUnpaidAmount = totalDue - paidAmount;
        
        console.log(`🔍 [DEBUG] Bill ${doc.id}: storedBaseAmount=${storedBaseAmount}, basePaid=${basePaid}, unpaidBaseAmount=${unpaidBaseAmount}`);
        console.log(`🔍 [DEBUG] Bill ${doc.id}: storedPenaltyAmount=${storedPenaltyAmount}, penaltyPaid=${penaltyPaid}, unpaidPenaltyAmount=${unpaidPenaltyAmount}`);
        console.log(`🔍 [DEBUG] Bill ${doc.id}: totalDue=${totalDue}, paidAmount=${paidAmount}, totalUnpaidAmount=${totalUnpaidAmount}`);
        
        if (totalUnpaidAmount > 0) {
          // Use existing waterDataService fiscal-to-calendar conversion
          // Format: YYYY-MM where YYYY is fiscal year and MM is fiscal month (00-11)
          const [fiscalYearStr, fiscalMonthStr] = doc.id.split('-');
          const fiscalYear = parseInt(fiscalYearStr);
          const fiscalMonth = parseInt(fiscalMonthStr);
          
          // Use waterDataService methods for proper fiscal year conversion
          const calendarYear = waterDataService.getCalendarYear(fiscalYear, fiscalMonth);
          
          // Convert fiscal month to calendar month using existing logic
          // Fiscal month 0 (July) = calendar month 7, etc.
          const calendarMonth = fiscalMonth + 7; // July = 7, adjust if > 12
          const actualCalendarMonth = calendarMonth > 12 ? calendarMonth - 12 : calendarMonth;
          
          const dueDate = `${calendarYear}-${String(actualCalendarMonth).padStart(2, '0')}-01`;
          
          console.log(`📅 Bill ${doc.id}: Fiscal FY${fiscalYear}-${fiscalMonthStr} → Calendar ${dueDate} (${waterDataService.getMonthName(fiscalMonth)})`);
          
          // Store metadata for bill construction
          billsMetadata.push({
            id: doc.id,
            period: doc.id,
            originalData: unitBill,
            billData: billData, // Store bill document data for dueDate access
            paidAmount,
            basePaid,
            penaltyPaid: unitBill.penaltyPaid || 0,
            status: unitBill.status,
            totalUnpaidAmount: totalUnpaidAmount,
            unpaidBaseAmount: unpaidBaseAmount,
            unpaidPenaltyAmount: unpaidPenaltyAmount
          });
        }
      }
    });
    
    // Use STORED penalty data (from penalty recalculation service)
    // No dynamic calculation needed - penalties are pre-calculated and stored
    for (const metadata of billsMetadata) {
      const unitBill = metadata.originalData;
      const billData = metadata.billData; // Get bill document data
      
      // Use stored penalty amounts from the bill document
      const storedPenaltyAmount = unitBill.penaltyAmount || 0;
      const storedTotalAmount = unitBill.totalAmount || unitBill.currentCharge || 0;
      const currentCharge = unitBill.currentCharge || 0;
      
      // Use the calculated total unpaid amount from metadata
      const totalCurrentlyDue = metadata.totalUnpaidAmount;
      
      if (totalCurrentlyDue > 0) {
        bills.push({
          id: metadata.id,
          period: metadata.period,
          penaltyAmount: storedPenaltyAmount,
          totalAmount: storedTotalAmount,
          currentCharge: currentCharge, // Add missing currentCharge property
          paidAmount: metadata.paidAmount,
          basePaid: metadata.basePaid,
          penaltyPaid: metadata.penaltyPaid,
          unpaidAmount: totalCurrentlyDue,
          status: metadata.status,
          monthsOverdue: 0, // Will be calculated during penalty recalc
          daysOverdue: 0,   // Will be calculated during penalty recalc
          dueDate: billData.dueDate, // Use actual due date from bill document
          lastPenaltyUpdate: unitBill.lastPenaltyUpdate || null,
          // Debug info
          _dynamicCalculation: false,
          _usingStoredPenalties: true,
          _originalTotalAmount: unitBill.totalAmount
        });
      }
    }
    
    console.log(`🔍 [DEBUG] _getUnpaidBillsForUnit: Returning ${bills.length} unpaid bills:`, bills.map(b => ({ period: b.period, unpaidAmount: b.unpaidAmount, status: b.status })));
    
    return bills; // Already sorted oldest first by document name
  }
  
  /**
   * Update water bills with payment information
   */
  async _updateBillsWithPayments(clientId, unitId, billPayments, paymentMethod, paymentDate, reference, transactionResult, paymentAmount) {
    const batch = this.db.batch();
    
    // Convert paymentAmount from pesos to centavos for audit trail
    const paymentAmountCentavos = pesosToCentavos(paymentAmount);
    
    console.log(`💳 Recording payment distribution for ${billPayments.length} bills (Total: $${paymentAmount})`);
    
    for (const payment of billPayments) {
      const billRef = this.db.collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(payment.billId);
      
      // Get current bill data to calculate new totals
      const billDoc = await billRef.get();
      const currentBill = billDoc.data()?.bills?.units?.[unitId];
      
      if (!currentBill) {
        console.error(`Bill not found for unit ${unitId} in period ${payment.billId}`);
        continue;
      }
      
      // Calculate new payment totals (ALL IN CENTAVOS - integers)
      const newBasePaid = (currentBill.basePaid || 0) + payment.baseChargePaid;
      const newPenaltyPaid = (currentBill.penaltyPaid || 0) + payment.penaltyPaid;
      
      // FIX: paidAmount should ONLY reflect the actual amount paid to THIS bill
      // This ensures UI calculations (currentCharge - basePaid) work correctly
      const newPaidAmount = newBasePaid + newPenaltyPaid;
      
      console.log(`💰 Bill ${payment.billId}: basePaid=${newBasePaid}, penaltyPaid=${newPenaltyPaid}, paidAmount=${newPaidAmount} centavos`);
      
      // Get existing payments array or initialize it
      const existingPayments = currentBill.payments || [];
      
      // Create new payment entry (following HOA Dues pattern, ALL IN CENTAVOS)
      // Store the FULL transaction amount in the payments array entry for audit trail
      const paymentEntry = {
        amount: paymentAmountCentavos,           // Full transaction amount for audit trail
        baseChargePaid: payment.baseChargePaid,  // Portion allocated to this bill's base
        penaltyPaid: payment.penaltyPaid,        // Portion allocated to this bill's penalty
        date: paymentDate,
        method: paymentMethod,
        reference: reference,
        transactionId: transactionResult || null,
        recordedAt: getNow().toISOString()
      };
      
      // Append to payments array
      const updatedPayments = [...existingPayments, paymentEntry];
      
      batch.update(billRef, {
        [`bills.units.${unitId}.paidAmount`]: newPaidAmount,       // In centavos - sum of base + penalty
        [`bills.units.${unitId}.basePaid`]: newBasePaid,           // In centavos
        [`bills.units.${unitId}.penaltyPaid`]: newPenaltyPaid,     // In centavos
        [`bills.units.${unitId}.status`]: payment.newStatus,
        [`bills.units.${unitId}.payments`]: updatedPayments
      });
    }
    
    await batch.commit();
  }
  
  /**
   * Generate transaction description for payment (simple description)
   */
  _generateTransactionDescription(billPayments, totalBaseCharges, totalPenalties, unitId) {
    if (billPayments.length === 0) {
      return `Water bill credit - Unit ${unitId}`;
    }
    
    return `Water bill payment - Unit ${unitId}`;
  }
  
  /**
   * Generate enhanced transaction description using water bill details
   */
  async _generateEnhancedTransactionDescription(billPayments, totalBaseCharges, totalPenalties, unitId, clientId, waterBillsService) {
    if (billPayments.length === 0) {
      return `Water bill credit - Unit ${unitId}`;
    }
    
    // Get the first bill period for the primary description
    const firstBillPeriod = billPayments[0].billPeriod;
    const readableDate = this._convertPeriodToReadableDate(firstBillPeriod);
    
    // Try to get consumption and wash details from the bill
    try {
      const billData = await this._getBillDataForTransaction(clientId, firstBillPeriod, unitId);
      if (billData) {
        // Use existing generateWaterBillNotes function for consistent formatting
        const billNotes = waterBillsService.generateWaterBillNotes(
          billData.consumption || 0,
          billData.carWashCount || 0,
          billData.boatWashCount || 0,
          readableDate
        );
        return `Water Bill Payment - ${billNotes}`;
      }
    } catch (error) {
      console.warn('Could not get enhanced bill details for transaction description:', error);
    }
    
    // Fallback to simple description
    return `Water bill payment - Unit ${unitId} - ${readableDate}`;
  }
  
  /**
   * Generate enhanced transaction notes using water bill details
   */
  async _generateEnhancedTransactionNotes(billPayments, totalBaseCharges, totalPenalties, unitId, userNotes = '', totalAmount, clientId, waterBillsService) {
    if (billPayments.length === 0) {
      const notesText = userNotes ? ` - ${userNotes}` : '';
      return `Water bill payment for Unit ${unitId} - No bills due${notesText} - $${totalAmount.toFixed(2)} credit`;
    }
    
    // Convert periods to readable dates and try to get enhanced details
    const enhancedPeriods = [];
    
    for (const payment of billPayments) {
      const readableDate = this._convertPeriodToReadableDate(payment.billPeriod);
      
      try {
        const billData = await this._getBillDataForTransaction(clientId, payment.billPeriod, unitId);
        if (billData) {
          // Use existing generateWaterBillNotes function for consistent formatting
          const billNotes = waterBillsService.generateWaterBillNotes(
            billData.consumption || 0,
            billData.carWashCount || 0,
            billData.boatWashCount || 0,
            readableDate
          );
          enhancedPeriods.push(billNotes);
        } else {
          enhancedPeriods.push(readableDate);
        }
      } catch (error) {
        console.warn(`Could not get enhanced details for ${payment.billPeriod}:`, error);
        enhancedPeriods.push(readableDate);
      }
    }
    
    const periodsText = enhancedPeriods.join(', ');
    
    // Build breakdown text
    let breakdown = '';
    if (totalBaseCharges > 0 && totalPenalties > 0) {
      breakdown = `$${totalBaseCharges.toFixed(2)} charges + $${totalPenalties.toFixed(2)} penalties`;
    } else if (totalBaseCharges > 0) {
      breakdown = `$${totalBaseCharges.toFixed(2)} charges`;
    } else if (totalPenalties > 0) {
      breakdown = `$${totalPenalties.toFixed(2)} penalties`;
    }
    
    // Format: "Water bill payment for Unit 203 - Water Consumption for Jul 2025 - 0018 m³, 1 Car wash - Test payment - $900 charges"
    const userNotesText = userNotes ? ` - ${userNotes}` : '';
    return `Water bill payment for Unit ${unitId} - ${periodsText}${userNotesText} - ${breakdown}`;
  }
  
  /**
   * Get bill data for transaction description enhancement
   */
  async _getBillDataForTransaction(clientId, billPeriod, unitId) {
    try {
      const billRef = this.db.collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(billPeriod);
      
      const billDoc = await billRef.get();
      if (!billDoc.exists) {
        return null;
      }
      
      const billData = billDoc.data();
      const unitBill = billData.bills?.units?.[unitId];
      
      if (!unitBill) {
        return null;
      }
      
      return {
        consumption: unitBill.consumption || 0,
        carWashCount: unitBill.carWashCount || 0,
        boatWashCount: unitBill.boatWashCount || 0,
        currentCharge: unitBill.currentCharge || 0,
        waterCharge: unitBill.waterCharge || 0,
        carWashCharge: unitBill.carWashCharge || 0,
        boatWashCharge: unitBill.boatWashCharge || 0
      };
    } catch (error) {
      console.error('Error getting bill data for transaction:', error);
      return null;
    }
  }

  /**
   * Generate detailed transaction notes following HOA pattern
   * Format: "Water bill payment for Unit [X] - [Month Year] - [User Notes] - $[Amount] [breakdown]"
   */
  _generateTransactionNotes(billPayments, totalBaseCharges, totalPenalties, unitId, userNotes = '', totalAmount) {
    if (billPayments.length === 0) {
      const notesText = userNotes ? ` - ${userNotes}` : '';
      return `Water bill payment for Unit ${unitId} - No bills due${notesText} - $${totalAmount.toFixed(2)} credit`;
    }
    
    // Convert periods to readable dates
    const readablePeriods = billPayments.map(p => this._convertPeriodToReadableDate(p.billPeriod));
    const periodsText = readablePeriods.join(', ');
    
    // Build breakdown text
    let breakdown = '';
    if (totalBaseCharges > 0 && totalPenalties > 0) {
      breakdown = `$${totalBaseCharges.toFixed(2)} charges + $${totalPenalties.toFixed(2)} penalties`;
    } else if (totalBaseCharges > 0) {
      breakdown = `$${totalBaseCharges.toFixed(2)} charges`;
    } else if (totalPenalties > 0) {
      breakdown = `$${totalPenalties.toFixed(2)} penalties`;
    }
    
    // Format: "Water bill payment for Unit 203 - Jul 2025, Aug 2025 - Test payment - $4400 charges + $600 penalties"
    const userNotesText = userNotes ? ` - ${userNotes}` : '';
    return `Water bill payment for Unit ${unitId} - ${periodsText}${userNotesText} - ${breakdown}`;
  }
  
  /**
   * Convert period format (2026-00) to readable date (Jul 2025)
   */
  _convertPeriodToReadableDate(period) {
    const [fiscalYearStr, fiscalMonthStr] = period.split('-');
    const fiscalYear = parseInt(fiscalYearStr);
    const fiscalMonth = parseInt(fiscalMonthStr);
    
    // Use waterDataService methods for consistent conversion
    const monthName = waterDataService.getMonthName(fiscalMonth);
    const calendarYear = waterDataService.getCalendarYear(fiscalYear, fiscalMonth);
    
    return `${monthName} ${calendarYear}`;
  }
  
  /**
   * Generate credit balance change description
   */
  _generateCreditDescription(billPayments, totalBaseCharges, totalPenalties) {
    if (billPayments.length === 0) {
      return 'Water bill overpayment - no bills due';
    }
    
    const billPeriods = billPayments.map(p => p.billPeriod).join(', ');
    return `Water bills paid: ${billPeriods} (Base: $${totalBaseCharges.toFixed(2)}, Penalties: $${totalPenalties.toFixed(2)})`;
  }
  
  /**
   * Get payment history for a unit from bill records
   */
  async getPaymentHistory(clientId, unitId, year = null) {
    await this._initializeDb();
    
    const payments = [];
    let query = this.db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills');
    
    if (year) {
      // Filter by year prefix in document name
      query = query.where('__name__', '>=', `${year}-01`)
                   .where('__name__', '<=', `${year}-12`);
    }
    
    const snapshot = await query.orderBy('__name__', 'desc').get();
    
    snapshot.forEach(doc => {
      const billData = doc.data();
      const unitBill = billData.bills?.units?.[unitId];
      
      if (unitBill?.lastPayment) {
        payments.push({
          id: doc.id,
          period: doc.id,
          ...unitBill.lastPayment
        });
      }
    });
    
    return payments;
  }
  
  /**
   * Get unpaid bills summary for payment modal (PUBLIC METHOD)
   */
  async getUnpaidBillsSummary(clientId, unitId) {
    await this._initializeDb();
    
    try {
      console.log(`🔍 Getting unpaid bills summary for client ${clientId}, unit ${unitId}`);
      
      const unpaidBills = await this._getUnpaidBillsForUnit(clientId, unitId);
      console.log(`📋 Found ${unpaidBills?.length || 0} unpaid bills`);
      
      // Also get current credit balance
      const { getFiscalYear } = await import('../utils/fiscalYearUtils.js');
      const fiscalYear = getFiscalYear(getNow(), 7); // AVII uses July start
      console.log(`💰 Getting credit balance for year ${fiscalYear}`);
      const creditData = await this._getCreditBalance(clientId, unitId, fiscalYear);
      console.log(`💰 Credit balance: $${creditData?.creditBalance || 0}`);
      
      // Convert unpaid bills from centavos to pesos for frontend
      const unpaidBillsInPesos = (unpaidBills || []).map(bill => ({
        ...bill,
        penaltyAmount: centavosToPesos(bill.penaltyAmount || 0),
        totalAmount: centavosToPesos(bill.totalAmount || 0),
        currentCharge: centavosToPesos(bill.currentCharge || 0),
        paidAmount: centavosToPesos(bill.paidAmount || 0),
        basePaid: centavosToPesos(bill.basePaid || 0),
        penaltyPaid: centavosToPesos(bill.penaltyPaid || 0),
        unpaidAmount: centavosToPesos(bill.unpaidAmount || 0)
      }));
      
      const result = {
        unpaidBills: unpaidBillsInPesos,
        currentCreditBalance: creditData?.creditBalance || 0, // Already in pesos from credit system
        creditHistory: creditData?.creditBalanceHistory || []
      };
      
      console.log(`✅ Returning summary:`, {
        unpaidBillsCount: result.unpaidBills.length,
        creditBalance: result.currentCreditBalance,
        creditHistoryCount: result.creditHistory.length
      });
      
      return result;
      
    } catch (error) {
      console.error('Error in getUnpaidBillsSummary:', error);
      
      // Return safe defaults instead of throwing
      return {
        unpaidBills: [],
        currentCreditBalance: 0,
        creditHistory: [],
        error: error.message
      };
    }
  }

}

export const waterPaymentsService = new WaterPaymentsService();
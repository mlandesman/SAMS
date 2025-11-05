/**
 * Unified Payment Wrapper Service
 * 
 * Phase: Unified Payment System
 * Created: November 2, 2025
 * 
 * PURPOSE:
 * Aggregates bills from multiple modules (HOA Dues, Water Bills) and applies
 * business-rule-based payment distribution across all bills.
 * 
 * ARCHITECTURE:
 * This is a "super wrapper" that:
 * 1. Loads bills from multiple module wrappers
 * 2. Normalizes and prioritizes bills based on business rules
 * 3. Calls existing PaymentDistributionService for allocation
 * 4. Splits results back by module for individual recording
 * 
 * BUSINESS RULES (Priority Order):
 * 1. Past due HOA + penalties (oldest first)
 * 2. Past due Water + penalties (oldest first)
 * 3. Current HOA (this month)
 * 4. Current Water (this month)
 * 5. Future HOA (complete months only - prepaid allowed)
 * 6. Credit Balance (remainder)
 * 
 * KEY CONSTRAINTS:
 * - Pay each bill completely (base + penalty) before moving to next
 * - Water bills do NOT allow future payments (postpaid model)
 * - HOA dues ALLOW future payments (prepaid model)
 * - All amounts in INTEGER CENTAVOS internally for precision
 * - Returns amounts in PESOS for frontend display
 * 
 * INTEGRATION:
 * - Uses existing PaymentDistributionService (no duplicate logic)
 * - Coordinates with HOA and Water module wrappers
 * - Respects module-specific configurations
 */

import { getNow } from '../../shared/services/DateService.js';
import { calculatePaymentDistribution } from '../../shared/services/PaymentDistributionService.js';
import { pesosToCentavos, centavosToPesos } from '../../shared/utils/currencyUtils.js';
import { getCreditBalance } from '../../shared/services/CreditBalanceService.js';
import { getDb } from '../firebase.js';
import { createTransaction } from '../controllers/transactionsController.js';

// Import module-specific functions
import { 
  getHOABillingConfig,
  updateHOADuesWithPayment
} from '../controllers/hoaDuesController.js';

import { 
  getUnpaidWaterBillsForUnit,
  getBillingConfig as getWaterBillingConfig,
  recalculatePenaltiesAsOfDate as calculateWaterPenalties
} from '../../shared/services/BillDataService.js';

import { waterPaymentsService } from './waterPaymentsService.js';

import { getFiscalYearBounds, getFiscalYear } from '../utils/fiscalYearUtils.js';
import { parseDate } from '../../shared/services/DateService.js';
import { calculatePenaltyForBill } from '../../shared/services/PenaltyRecalculationService.js';

/**
 * Round currency amounts to prevent floating point precision errors
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
function roundCurrency(amount) {
  return Math.round(amount * 100) / 100;
}

/**
 * UnifiedPaymentWrapper Class
 * 
 * Orchestrates cross-module payment processing
 */
export class UnifiedPaymentWrapper {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection
   * @private
   */
  async _initializeDb() {
    if (!this.db) {
      this.db = await getDb();
    }
  }

  /**
   * Preview unified payment across HOA and Water Bills
   * 
   * Shows how a payment will be distributed across both modules
   * without actually recording it.
   * 
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {number} paymentAmount - Payment amount in PESOS
   * @param {Date|string} paymentDate - Payment date (for penalty calculation)
   * @returns {object} Unified payment distribution preview
   */
  async previewUnifiedPayment(clientId, unitId, paymentAmount, paymentDate = null) {
    await this._initializeDb();
    
    console.log(`🌐 [UNIFIED WRAPPER] Preview payment: ${clientId}/${unitId}, Amount: $${paymentAmount}`);
    
    // Parse payment date
    const calculationDate = paymentDate ? new Date(paymentDate) : getNow();
    console.log(`   📅 Calculation date: ${calculationDate.toISOString()}`);
    
    // Step 1: Aggregate bills from both modules
    const { allBills, configs } = await this._aggregateBills(clientId, unitId, calculationDate);
    
    if (allBills.length === 0) {
      console.log(`   ℹ️  No unpaid bills found for unit ${unitId}`);
      // Get current credit balance
      const creditData = await getCreditBalance(clientId, unitId);
      
      return {
        totalAmount: paymentAmount,
        currentCreditBalance: creditData.creditBalance || 0,
        newCreditBalance: roundCurrency((creditData.creditBalance || 0) + paymentAmount),
        hoa: { billsPaid: [], totalPaid: 0, monthsAffected: [] },
        water: { billsPaid: [], totalPaid: 0, billsAffected: [] },
        credit: {
          used: 0,
          added: paymentAmount,
          final: roundCurrency((creditData.creditBalance || 0) + paymentAmount)
        },
        summary: {
          totalBills: 0,
          totalAllocated: 0,
          allocationCount: 0
        }
      };
    }
    
    // Step 2: Prioritize and sort bills
    const sortedBills = this._prioritizeAndSortBills(
      allBills, 
      calculationDate, 
      configs.fiscalYearStartMonth
    );
    
    // CRITICAL FIX: Make periods unique by adding module prefix
    // This prevents HOA "2026-02" from conflicting with Water "2026-02"
    const billsWithUniquePeroids = sortedBills.map(bill => ({
      ...bill,
      period: `${bill._metadata.moduleType}:${bill.period}`,
      _originalPeriod: bill.period // Keep original for reference
    }));
    
    // Step 3: Get current credit balance
    const creditData = await getCreditBalance(clientId, unitId);
    const currentCredit = creditData.creditBalance || 0;
    console.log(`   💰 Current credit balance: $${currentCredit}`);
    
    // Step 4: MULTI-PASS PRIORITY ALGORITHM
    // Simple approach: Pass payment and credit separately to distribution service
    // Let it handle the combination and track remaining funds
    console.log(`   🔄 Starting multi-pass priority processing`);
    
    const allPaidBills = [];
    let remainingFunds = paymentAmount + currentCredit;  // Total available
    let paymentForNextLevel = paymentAmount;  // Track payment portion for distribution service
    let creditForNextLevel = currentCredit;   // Track credit portion for distribution service
    
    // Process priority levels 1-5 sequentially
    for (let priorityLevel = 1; priorityLevel <= 5; priorityLevel++) {
      if (remainingFunds <= 0) break;
      
      const billsAtThisLevel = billsWithUniquePeroids.filter(
        b => b._metadata.priority === priorityLevel
      );
      
      if (billsAtThisLevel.length === 0) continue;
      
      console.log(`   💸 Priority ${priorityLevel}: ${billsAtThisLevel.length} bills, $${remainingFunds.toFixed(2)} available`);
      
      // Call PaymentDistributionService with payment and credit separate
      const levelDistribution = calculatePaymentDistribution({
        bills: billsAtThisLevel,
        paymentAmount: paymentForNextLevel,
        currentCreditBalance: creditForNextLevel,
        unitId
      });
      
      // Collect paid bills from this level
      levelDistribution.billPayments.forEach(bp => {
        if (bp.amountPaid > 0) {
          allPaidBills.push(bp);
        }
      });
      
      // Update remaining funds for next level
      // The newCreditBalance from PaymentDistributionService is the total remaining
      remainingFunds = levelDistribution.newCreditBalance || 0;
      
      // For next level: all remaining funds become "payment" with 0 credit
      // This simplifies tracking while maintaining correct total
      paymentForNextLevel = remainingFunds;
      creditForNextLevel = 0;
      
      console.log(`      ✓ Paid ${levelDistribution.billPayments.filter(b => b.amountPaid > 0).length} bills, $${remainingFunds.toFixed(2)} remaining`);
    }
    
    // Calculate final results
    const totalPaidAmount = allPaidBills.reduce((sum, bp) => sum + bp.amountPaid, 0);
    const finalCreditBalance = remainingFunds;
    
    // NET credit change calculation (as per your logic):
    // New Credit Added = Remaining Total - Original Credit Balance
    const netCreditAdded = finalCreditBalance - currentCredit;
    
    console.log(`   ✅ Multi-pass complete: ${allPaidBills.length} bills paid`);
    console.log(`      💰 Final: Bills paid $${totalPaidAmount.toFixed(2)}, Credit change $${netCreditAdded.toFixed(2)}, Final balance $${finalCreditBalance.toFixed(2)}`);
    
    // Reconstruct distribution object for splitting
    const distribution = {
      totalAvailableFunds: paymentAmount + currentCredit,
      currentCreditBalance: currentCredit,
      newCreditBalance: roundCurrency(finalCreditBalance),
      creditUsed: netCreditAdded < 0 ? roundCurrency(-netCreditAdded) : 0,  // If negative, credit was used
      overpayment: netCreditAdded > 0 ? roundCurrency(netCreditAdded) : 0,  // If positive, credit was added
      netCreditAdded: roundCurrency(netCreditAdded),  // Can be positive or negative
      totalApplied: roundCurrency(totalPaidAmount),
      billPayments: allPaidBills
    };
    
    // Step 5: Split results by module (use bills with unique periods for accurate matching)
    const splitResults = this._splitDistributionByModule(distribution, billsWithUniquePeroids);
    
    // Add netCreditAdded to the split results
    splitResults.netCreditAdded = distribution.netCreditAdded;
    splitResults.currentCreditBalance = currentCredit;
    
    console.log(`✅ [UNIFIED WRAPPER] Preview complete`);
    console.log(`   HOA: ${splitResults.hoa.billsPaid.length} bills, $${splitResults.hoa.totalPaid}`);
    console.log(`   Water: ${splitResults.water.billsPaid.length} bills, $${splitResults.water.totalPaid}`);
    console.log(`   Credit: Used $${splitResults.credit.used}, Added $${splitResults.credit.added}, Final $${splitResults.credit.final}`);
    
    return splitResults;
  }

  /**
   * Record unified payment across HOA and Water Bills
   * 
   * Records a payment that spans multiple modules, creating
   * appropriate transactions and updating bills in each module.
   * 
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {object} paymentData - Payment data (amount, date, method, etc.)
   * @param {object} transaction - Transaction reference (optional)
   * @returns {object} Recording result with module-specific outcomes
   */
  async recordUnifiedPayment(clientId, unitId, paymentData, transaction = null) {
    await this._initializeDb();
    
    console.log(`🌐 [UNIFIED WRAPPER] Record payment: ${clientId}/${unitId}, Amount: $${paymentData.amount}`);
    
    // Extract payment data
    const { 
      amount, 
      paymentDate, 
      paymentMethod, 
      reference = null, 
      notes = null,
      preview,
      userId = 'system',
      accountId, // Required - no default
      accountType // Required - no default
    } = paymentData;
    
    // Validate required fields
    if (!amount || !paymentDate || !paymentMethod || !preview) {
      throw new Error('Missing required payment data: amount, paymentDate, paymentMethod, and preview are required');
    }
    
    console.log(`   📋 Payment details: Method=${paymentMethod}, Date=${paymentDate}, Reference=${reference || 'none'}`);
    
    // Step 1: Verify preview data matches current state
    console.log(`   🔍 Verifying preview data matches current state...`);
    const currentPreview = await this.previewUnifiedPayment(clientId, unitId, amount, paymentDate);
    
    // Compare totals (allow small floating point differences)
    const previewTotal = preview.summary?.totalAllocated || 0;
    const currentTotal = currentPreview.summary?.totalAllocated || 0;
    
    if (Math.abs(previewTotal - currentTotal) > 0.01) {
      console.error(`   ❌ Preview mismatch: Expected $${previewTotal}, Current $${currentTotal}`);
      throw new Error('Bill status changed since preview. Please refresh and try again.');
    }
    
    console.log(`   ✅ Preview verified: $${currentTotal} allocation matches`);
    
    // Parse payment date
    const paymentDateObj = parseDate(paymentDate);
    
    // Get fiscal year configuration
    const configs = await this._getMergedConfig(clientId);
    const fiscalYear = getFiscalYear(paymentDateObj, configs.fiscalYearStartMonth || 1);
    
    // Step 2: Generate consolidated transaction notes
    console.log(`   📝 Generating consolidated transaction notes...`);
    
    // Format payment date for notes
    const formattedDate = paymentDateObj.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Cancun',
      timeZoneName: 'short'
    });
    
    // Create comprehensive notes with payment details
    const paymentHeader = `Posted: MXN ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} on ${formattedDate}`;
    const transactionNotes = this._generateConsolidatedNotes(preview, configs.fiscalYearStartMonth || 1);
    const paymentFooter = `Payment: ${paymentMethod}`;
    
    // Note: Sequence will be added after transaction creation
    const notesWithoutSeq = [paymentHeader, transactionNotes, paymentFooter].join('\n');
    
    // Step 3: Create unified transaction document FIRST (for the transaction ID)
    console.log(`   💾 Creating unified transaction document...`);
    
    // Combine notes with user notes (sequence will be added after transaction creation)
    const combinedNotes = notes 
      ? `${notesWithoutSeq}\n${notes}` 
      : notesWithoutSeq;
    
    // Build allocations array for TransactionView
    const allocations = [];
    let allocationIndex = 1;
    
    // Add HOA allocations (split into base and penalty)
    if (preview.hoa && preview.hoa.monthsAffected) {
      preview.hoa.monthsAffected.forEach(month => {
        // Base charge allocation
        if (month.basePaid > 0) {
          allocations.push({
            id: `alloc_${String(allocationIndex).padStart(3, '0')}`,
            type: 'hoa_month',
            targetId: `month_${month.monthIndex}_${fiscalYear}`,
            targetName: this._getMonthName(month.monthIndex, fiscalYear),
            amount: month.basePaid, // In pesos - createTransaction will convert to centavos
            categoryName: 'HOA Dues',
            categoryId: 'hoa_dues',
            data: {
              unitId: unitId,
              month: month.monthIndex, // FIXED: Use fiscal month index (0-11), not calendar month
              year: fiscalYear
            }
          });
          allocationIndex++;
        }
        
        // Penalty allocation (separate line item)
        if (month.penaltyPaid > 0) {
          allocations.push({
            id: `alloc_${String(allocationIndex).padStart(3, '0')}`,
            type: 'hoa_penalty',
            targetId: `penalty_${month.monthIndex}_${fiscalYear}`,
            targetName: this._getMonthName(month.monthIndex, fiscalYear),
            amount: month.penaltyPaid, // In pesos - createTransaction will convert to centavos
            categoryName: 'HOA Penalties',
            categoryId: 'hoa_penalties',
            data: {
              unitId: unitId,
              month: month.monthIndex, // FIXED: Use fiscal month index (0-11), not calendar month
              year: fiscalYear
            }
          });
          allocationIndex++;
        }
      });
    }
    
    // Add Water allocations (split into base and penalty)
    if (preview.water && preview.water.billsAffected) {
      preview.water.billsAffected.forEach(bill => {
        // Base charge allocation
        if (bill.basePaid > 0) {
          allocations.push({
            id: `alloc_${String(allocationIndex).padStart(3, '0')}`,
            type: 'water_consumption',
            targetId: `water_${bill.billPeriod}`,
            targetName: `Water Bill ${bill.billPeriod}`,
            amount: bill.basePaid, // In pesos - createTransaction will convert to centavos
            categoryName: 'Water Consumption',
            categoryId: 'water-consumption',
            data: {
              unitId: unitId,
              billPeriod: bill.billPeriod
            }
          });
          allocationIndex++;
        }
        
        // Penalty allocation (separate line item)
        if (bill.penaltyPaid > 0) {
          allocations.push({
            id: `alloc_${String(allocationIndex).padStart(3, '0')}`,
            type: 'water_penalty',
            targetId: `water_penalty_${bill.billPeriod}`,
            targetName: `Water Bill ${bill.billPeriod}`,
            amount: bill.penaltyPaid, // In pesos - createTransaction will convert to centavos
            categoryName: 'Water Penalties',
            categoryId: 'water_penalties',
            data: {
              unitId: unitId,
              billPeriod: bill.billPeriod
            }
          });
          allocationIndex++;
        }
      });
    }
    
    // Add Credit allocations
    // SIMPLIFIED ALLOCATION LOGIC:
    // - Payment allocations must sum to the payment amount
    // - If netCreditAdded is negative, credit was used (negative allocation)
    // - If netCreditAdded is positive, credit was added (positive allocation)
    
    const totalBillsPaid = (preview.hoa?.totalPaid || 0) + (preview.water?.totalPaid || 0);
    
    if (preview.credit && preview.netCreditAdded !== undefined && preview.netCreditAdded !== 0) {
      if (preview.netCreditAdded < 0) {
        // Credit was used (negative allocation)
        allocations.push({
          id: `alloc_${String(allocationIndex).padStart(3, '0')}`,
          type: 'credit_used',
          targetId: `credit_used_${unitId}`,
          targetName: 'Credit Balance',
          amount: preview.netCreditAdded, // NEGATIVE value
          categoryName: 'Credit Used',
          categoryId: 'credit_used',
          data: {
            unitId: unitId,
            balanceBefore: preview.currentCreditBalance,
            balanceAfter: preview.credit.final
          }
        });
        allocationIndex++;
      } else {
        // Credit was added (positive allocation)
        allocations.push({
          id: `alloc_${String(allocationIndex).padStart(3, '0')}`,
          type: 'credit_added',
          targetId: `credit_added_${unitId}`,
          targetName: 'Credit Balance',
          amount: preview.netCreditAdded, // POSITIVE value
          categoryName: 'Credit Added',
          categoryId: 'credit_added',
          data: {
            unitId: unitId,
            balanceBefore: preview.currentCreditBalance,
            balanceAfter: preview.credit.final
          }
        });
        allocationIndex++;
      }
    }
    
    // Calculate allocation summary
    // totalAllocated must be in CENTAVOS to match stored allocation amounts
    // (createTransaction converts individual allocation.amount but not the summary total)
    const totalAllocatedPesos = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    const totalAllocatedCentavos = pesosToCentavos(totalAllocatedPesos);
    
    const allocationSummary = {
      totalAllocated: totalAllocatedCentavos, // In centavos to match allocation amounts
      allocationCount: allocations.length,
      allocationType: allocations.length > 0 ? allocations[0].type : null,
      hasMultipleTypes: allocations.length > 1 && 
        new Set(allocations.map(a => a.type)).size > 1
    };
    
    const transactionData = {
      date: paymentDate, // Use original date string (yyyy-MM-dd format)
      amount: amount, // Pass in pesos - createTransaction will convert to centavos
      type: 'income',
      categoryId: '-split-', // Split transaction (lowercase with hyphens)
      categoryName: '-Split-', // Split transaction (capital S with hyphens)
      notes: combinedNotes, // Combined: consolidated allocation + user notes
      paymentMethod: paymentMethod,
      reference: reference || null,
      unitId: unitId,
      enteredBy: userId,
      source: 'unified_payment_system',
      accountId: accountId,
      accountType: accountType,
      vendorId: 'deposit', // Standard vendor for all deposits
      vendorName: 'Deposit', // Display name for reporting
      allocations: allocations, // CRITICAL: TransactionView needs this for split display
      allocationSummary: allocationSummary,
      metadata: {
        hoaBillsPaid: preview.hoa?.billsPaid?.length || 0,
        waterBillsPaid: preview.water?.billsPaid?.length || 0,
        creditUsed: preview.credit?.used || 0,
        creditAdded: preview.credit?.added || 0
      }
    };
    
    console.log(`   💾 Transaction Data Being Sent:`);
    console.log(`      Amount: ${transactionData.amount} pesos`);
    console.log(`      Account: ${transactionData.accountId} (${transactionData.accountType})`);
    console.log(`      Allocations: ${allocations.length}`);
    console.log(`      AllocationSummary.totalAllocated: ${allocationSummary.totalAllocated}`);
    
    const transactionId = await createTransaction(clientId, transactionData);
    console.log(`   ✅ Unified transaction created: ${transactionId}`);
    
    // Now add the transaction ID to the comprehensive notes
    const comprehensiveNotesWithSeq = `${notesWithoutSeq}\nTxnID: ${transactionId}`;
    
    // Step 4: Update HOA dues in Firestore (if HOA bills were paid)
    if (preview.hoa && preview.hoa.monthsAffected && preview.hoa.monthsAffected.length > 0) {
      console.log(`   🏠 Updating ${preview.hoa.monthsAffected.length} HOA months in Firestore...`);
      
      // Build months data from preview (already calculated)
      const monthsData = preview.hoa.monthsAffected.map(month => ({
        month: month.month,
        basePaid: pesosToCentavos(month.basePaid), // Convert to centavos
        penaltyPaid: pesosToCentavos(month.penaltyPaid), // Convert to centavos
        notes: comprehensiveNotesWithSeq // Add comprehensive notes to each month
      }));
      
      // Call lightweight Firestore update function
      await updateHOADuesWithPayment(
        clientId,
        unitId,
        fiscalYear,
        monthsData,
        transactionId,
        paymentDate,
        paymentMethod,
        reference,
        userId,
        preview.credit // {final, used, added}
      );
      
      console.log(`      ✅ HOA payments updated in Firestore`);
    }
    
    // Step 5: Update Water bills in Firestore (if Water bills were paid)
    if (preview.water && preview.water.billsAffected && preview.water.billsAffected.length > 0) {
      console.log(`   💧 Updating ${preview.water.billsAffected.length} Water bills in Firestore...`);
      
      // Build bills data from preview (already calculated, already in PESOS)
      const billsData = preview.water.billsAffected.map(bill => ({
        billPeriod: bill.billPeriod,
        basePaid: bill.basePaid, // In pesos
        penaltyPaid: bill.penaltyPaid, // In pesos
        amountPaid: bill.totalPaid // In pesos
      }));
      
      // Call lightweight Firestore update function
      await waterPaymentsService.updateWaterBillsWithPayment(
        clientId,
        unitId,
        billsData,
        transactionId,
        paymentDate,
        paymentMethod,
        reference
      );
      
      console.log(`      ✅ Water bills updated in Firestore`);
    }
    
    // Step 6: Return result summary
    const result = {
      success: true,
      transactionId: transactionId,
      summary: {
        totalAmount: amount,
        hoaBillsPaid: preview.hoa?.billsPaid?.length || 0,
        waterBillsPaid: preview.water?.billsPaid?.length || 0,
        creditUsed: preview.credit?.used || 0,
        creditAdded: preview.credit?.added || 0,
        finalCreditBalance: preview.credit?.final || 0
      },
      details: {
        hoa: {
          billsPaid: preview.hoa?.billsPaid?.length || 0,
          totalPaid: preview.hoa?.totalPaid || 0,
          monthsAffected: preview.hoa?.monthsAffected || []
        },
        water: {
          billsPaid: preview.water?.billsPaid?.length || 0,
          totalPaid: preview.water?.totalPaid || 0,
          billsAffected: preview.water?.billsAffected || []
        },
        credit: preview.credit
      },
      timestamp: getNow().toISOString()
    };
    
    console.log(`✅ [UNIFIED WRAPPER] Payment recorded successfully`);
    console.log(`   Transaction ID: ${transactionId}`);
    console.log(`   HOA Bills: ${result.summary.hoaBillsPaid}, Water Bills: ${result.summary.waterBillsPaid}`);
    console.log(`   Credit Balance: $${result.summary.finalCreditBalance}`);
    
    return result;
  }

  /**
   * Aggregate bills from both HOA and Water modules
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Date} calculationDate - Date for penalty calculations
   * @returns {object} Aggregated bills with metadata
   */
  async _aggregateBills(clientId, unitId, calculationDate) {
    console.log(`📋 [UNIFIED WRAPPER] Aggregating bills from HOA and Water modules`);
    
    // Get configurations for both modules
    const configs = await this._getMergedConfig(clientId);
    
    // Aggregate HOA bills
    const hoaBills = await this._getHOABills(clientId, unitId, calculationDate, configs.hoa);
    console.log(`   📋 HOA: ${hoaBills.length} bills loaded`);
    
    // Aggregate Water bills
    const waterBills = await this._getWaterBills(clientId, unitId, calculationDate, configs.water);
    console.log(`   📋 Water: ${waterBills.length} bills loaded`);
    
    // Combine all bills
    const allBills = [...hoaBills, ...waterBills];
    console.log(`✅ [UNIFIED WRAPPER] Total bills aggregated: ${allBills.length} (HOA: ${hoaBills.length}, Water: ${waterBills.length})`);
    
    return {
      allBills,
      hoaBills,
      waterBills,
      configs
    };
  }

  /**
   * Get HOA bills with unified metadata
   * 
   * Uses internal HOA conversion functions directly since they need to be accessed
   * for the unified wrapper to work properly.
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Date} calculationDate - Date for penalty calculations
   * @param {object} config - HOA billing configuration
   * @returns {Array} HOA bills with unified metadata
   */
  async _getHOABills(clientId, unitId, calculationDate, config) {
    console.log(`   🏠 [HOA] Loading bills for unit ${unitId}`);
    
    try {
      // Determine fiscal year from calculation date
      const fiscalYear = getFiscalYear(calculationDate, config.fiscalYearStartMonth || 1);
      
      // Load HOA dues document
      const duesRef = this.db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').doc(fiscalYear.toString());
      
      const duesSnap = await duesRef.get();
      
      if (!duesSnap.exists) {
        console.log(`   ⚠️  [HOA] No dues document found for ${unitId}/${fiscalYear}`);
        return [];
      }
      
      const hoaDuesDoc = duesSnap.data();
      
      // Import conversion functions directly (they're not exported, so we need to replicate logic)
      // Convert HOA dues monthly array to bills format
      const bills = this._convertHOADuesToBills(hoaDuesDoc, clientId, unitId, fiscalYear, config);
      
      // Calculate penalties in-memory for payment date
      const billsWithPenalties = this._calculateHOAPenaltiesInMemory(bills, calculationDate, config);
      
      // Filter to unpaid bills only
      const unpaidBills = billsWithPenalties.filter(b => b.status !== 'paid');
      
      // Enhance with unified metadata
      const enhancedBills = unpaidBills.map(bill => ({
        ...bill,
        _metadata: {
          moduleType: 'hoa',
          monthIndex: bill._hoaMetadata?.monthIndex,
          billPeriod: bill.period,
          priority: null // Will be calculated later
        }
      }));
      
      console.log(`   ✅ [HOA] ${enhancedBills.length} unpaid bills with metadata`);
      return enhancedBills;
      
    } catch (error) {
      console.error(`   ❌ [HOA] Error loading bills:`, error);
      // Return empty array on error - log but continue with Water bills
      return [];
    }
  }

  /**
   * Convert HOA Dues monthly payment array to bill array
   * (Replicated from hoaDuesController since it's not exported)
   * 
   * @private
   */
  _convertHOADuesToBills(hoaDuesDoc, clientId, unitId, year, config = {}) {
    const bills = [];
    
    if (!hoaDuesDoc.scheduledAmount) {
      throw new Error(`scheduledAmount not found in HOA dues document for unit ${unitId}, year ${year}`);
    }
    
    const monthlyAmount = hoaDuesDoc.scheduledAmount;
    const paymentsArray = hoaDuesDoc.payments || [];
    
    console.log(`      🔄 Converting HOA dues to bills: 12 fiscal months`);
    
    // Generate bills for all 12 fiscal months (0-11)
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const payment = paymentsArray[monthIndex] || null;
      const month = monthIndex + 1;
      const fiscalMonth = monthIndex;
      
      // Calculate due date
      const { startDate } = getFiscalYearBounds(year, config.fiscalYearStartMonth || 1);
      const dueDate = parseDate(startDate);
      
      // Validate dueDate before using it
      if (isNaN(dueDate.getTime())) {
        throw new Error(`Invalid dueDate calculated for fiscal year ${year}, month ${fiscalMonth}. startDate: ${startDate}`);
      }
      
      dueDate.setMonth(dueDate.getMonth() + fiscalMonth);
      
      const paidAmount = payment?.amount || 0;
      const baseCharge = monthlyAmount;
      const penaltyAmount = 0; // Calculated fresh later
      const penaltyPaid = payment?.penaltyPaid || 0;
      
      const totalDue = baseCharge + penaltyAmount;
      const totalPaid = paidAmount + penaltyPaid;
      
      let billStatus;
      if (totalPaid >= totalDue && totalDue > 0) {
        billStatus = 'paid';
      } else if (totalPaid > 0) {
        billStatus = 'partial';
      } else {
        billStatus = 'unpaid';
      }
      
      const isPaid = billStatus === 'paid';
      
      bills.push({
        billId: `${year}-${String(fiscalMonth).padStart(2, '0')}`,
        period: `${year}-${String(fiscalMonth).padStart(2, '0')}`,
        unitId: unitId,
        currentCharge: baseCharge,
        paidAmount: paidAmount,
        basePaid: paidAmount,
        penaltyAmount: penaltyAmount,
        penaltyPaid: penaltyPaid,
        totalAmount: totalDue,
        status: billStatus,
        paid: isPaid,
        dueDate: dueDate.toISOString(),
        billDate: dueDate.toISOString(),
        paidDate: payment?.date ? (() => {
          const dateObj = new Date(payment.date);
          return isNaN(dateObj.getTime()) ? null : dateObj.toISOString();
        })() : null,
        _hoaMetadata: {
          monthIndex: monthIndex,
          month: month,
          originalPayment: payment ? { ...payment } : null
        }
      });
    }
    
    console.log(`      ✅ Converted ${bills.length} months to bills`);
    return bills;
  }

  /**
   * Calculate penalties in-memory for HOA bills
   * (Replicated from hoaDuesController since it's not exported)
   * 
   * @private
   */
  _calculateHOAPenaltiesInMemory(bills, asOfDate, config) {
    console.log(`      💰 Calculating penalties for ${bills.length} bills as of ${asOfDate.toISOString()}`);
    
    // Validate penalty configuration
    if (config.penaltyRate === undefined || config.penaltyRate === null || 
        config.penaltyDays === undefined || config.penaltyDays === null) {
      const missing = [];
      if (config.penaltyRate === undefined || config.penaltyRate === null) missing.push('penaltyRate');
      if (config.penaltyDays === undefined || config.penaltyDays === null) missing.push('penaltyDays');
      throw new Error(`Penalty configuration incomplete. Missing: ${missing.join(', ')}`);
    }
    
    // Recalculate each bill's penalty
    const updatedBills = bills.map(bill => {
      const penaltyResult = calculatePenaltyForBill({
        bill,
        asOfDate,
        config: {
          penaltyRate: config.penaltyRate,
          penaltyDays: config.penaltyDays
        }
      });
      
      return {
        ...bill,
        penaltyAmount: penaltyResult.penaltyAmount,
        totalAmount: bill.currentCharge + penaltyResult.penaltyAmount
      };
    });
    
    const totalPenalties = updatedBills.reduce((sum, b) => sum + (b.penaltyAmount || 0), 0);
    console.log(`      ✅ Recalculated penalties: Total $${centavosToPesos(totalPenalties)}`);
    
    return updatedBills;
  }

  /**
   * Get Water bills with unified metadata
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Date} calculationDate - Date for penalty calculations
   * @param {object} config - Water billing configuration
   * @returns {Array} Water bills with unified metadata
   */
  async _getWaterBills(clientId, unitId, calculationDate, config) {
    console.log(`   💧 [WATER] Loading bills for unit ${unitId}`);
    
    try {
      // Load water bills (already unpaid only)
      let bills = await getUnpaidWaterBillsForUnit(this.db, clientId, unitId);
      
      // Recalculate penalties for payment date
      bills = await calculateWaterPenalties(clientId, bills, calculationDate, config);
      
      // Enhance with unified metadata
      const enhancedBills = bills.map(bill => {
        // Extract fiscal month index from period (e.g., "2026-00" -> 0)
        const periodMatch = bill.period?.match(/\d{4}-(\d{2})/);
        const monthIndex = periodMatch ? parseInt(periodMatch[1]) : null;
        
        return {
          ...bill,
          _metadata: {
            moduleType: 'water',
            monthIndex: monthIndex,
            billPeriod: bill.period,
            priority: null // Will be calculated later
          }
        };
      });
      
      console.log(`   ✅ [WATER] ${enhancedBills.length} unpaid bills with metadata`);
      return enhancedBills;
      
    } catch (error) {
      console.error(`   ❌ [WATER] Error loading bills:`, error);
      // Return empty array on error - log but continue with HOA bills
      return [];
    }
  }

  /**
   * Calculate priority for a bill based on business rules
   * 
   * Priority Order:
   * 1. Past due HOA + penalties (oldest first)
   * 2. Past due Water + penalties (oldest first)  
   * 3. Current HOA (this month)
   * 4. Current Water (this month)
   * 5. Future HOA (prepaid allowed)
   * 6. Water future bills excluded (postpaid only)
   * 
   * @private
   * @param {object} bill - Bill object with metadata
   * @param {Date} currentDate - Current date for comparison
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
   * @returns {number} Priority value (lower = higher priority)
   */
  _calculatePriority(bill, currentDate, fiscalYearStartMonth = 1) {
    const moduleType = bill._metadata.moduleType;
    const dueDate = new Date(bill.dueDate);
    
    // Determine bill timing relative to current date
    const isPastDue = dueDate < currentDate;
    const isCurrent = this._isCurrentPeriod(dueDate, currentDate, fiscalYearStartMonth);
    const isFuture = dueDate > currentDate && !isCurrent;
    
    // Apply business rules for priority
    if (moduleType === 'hoa' && isPastDue) {
      return 1; // Highest priority: Past due HOA
    }
    
    if (moduleType === 'water' && isPastDue) {
      return 2; // Second priority: Past due Water
    }
    
    if (moduleType === 'hoa' && isCurrent) {
      return 3; // Third priority: Current HOA
    }
    
    if (moduleType === 'water' && isCurrent) {
      return 4; // Fourth priority: Current Water
    }
    
    if (moduleType === 'hoa' && isFuture) {
      return 5; // Fifth priority: Future HOA (prepaid allowed)
    }
    
    // Water future bills should be excluded (postpaid only)
    if (moduleType === 'water' && isFuture) {
      return 99; // Lowest priority - will be filtered out
    }
    
    // Fallback (should not reach here)
    return 50;
  }

  /**
   * Determine if a due date is in the current fiscal period
   * 
   * @private
   * @param {Date} dueDate - Bill due date
   * @param {Date} currentDate - Current date
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
   * @returns {boolean} True if bill is in current period
   */
  _isCurrentPeriod(dueDate, currentDate, fiscalYearStartMonth) {
    // Get current fiscal month
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
    const currentYear = currentDate.getFullYear();
    
    // Calculate current fiscal month index (0-11)
    let currentFiscalMonthIndex = currentMonth - fiscalYearStartMonth;
    if (currentFiscalMonthIndex < 0) {
      currentFiscalMonthIndex += 12;
    }
    
    // Get bill's fiscal month
    const billMonth = dueDate.getMonth() + 1;
    const billYear = dueDate.getFullYear();
    
    // Calculate bill's fiscal month index (0-11)
    let billFiscalMonthIndex = billMonth - fiscalYearStartMonth;
    if (billFiscalMonthIndex < 0) {
      billFiscalMonthIndex += 12;
    }
    
    // Bills are "current" if they're in the same fiscal month as today
    // and in the same calendar year (to avoid false matches across years)
    return billFiscalMonthIndex === currentFiscalMonthIndex && billYear === currentYear;
  }

  /**
   * Add priority to all bills and sort them
   * 
   * @private
   * @param {Array} bills - Array of bills with metadata
   * @param {Date} currentDate - Current date for priority calculation
   * @param {number} fiscalYearStartMonth - Fiscal year start month
   * @returns {Array} Sorted bills with priority assigned
   */
  _prioritizeAndSortBills(bills, currentDate, fiscalYearStartMonth) {
    console.log(`🔢 [UNIFIED WRAPPER] Calculating priorities for ${bills.length} bills`);
    
    // Calculate priority for each bill
    const billsWithPriority = bills.map(bill => ({
      ...bill,
      _metadata: {
        ...bill._metadata,
        priority: this._calculatePriority(bill, currentDate, fiscalYearStartMonth)
      }
    }));
    
    // Filter out future water bills (priority 99)
    const payableBills = billsWithPriority.filter(b => b._metadata.priority < 99);
    console.log(`   ℹ️  Filtered out ${billsWithPriority.length - payableBills.length} future water bills (postpaid only)`);
    
    // Sort by priority (then by due date for same priority)
    const sortedBills = this._sortBillsByPriority(payableBills);
    
    console.log(`✅ [UNIFIED WRAPPER] Bills prioritized and sorted: ${sortedBills.length} payable bills`);
    console.log(`   Priority breakdown:`, {
      priority1_pastHOA: sortedBills.filter(b => b._metadata.priority === 1).length,
      priority2_pastWater: sortedBills.filter(b => b._metadata.priority === 2).length,
      priority3_currentHOA: sortedBills.filter(b => b._metadata.priority === 3).length,
      priority4_currentWater: sortedBills.filter(b => b._metadata.priority === 4).length,
      priority5_futureHOA: sortedBills.filter(b => b._metadata.priority === 5).length
    });
    
    return sortedBills;
  }

  /**
   * Sort bills by priority
   * 
   * @private
   * @param {Array} bills - Array of bills with priority metadata
   * @returns {Array} Sorted bills (highest priority first)
   */
  _sortBillsByPriority(bills) {
    return bills.sort((a, b) => {
      // Primary sort: priority (lower number = higher priority)
      if (a._metadata.priority !== b._metadata.priority) {
        return a._metadata.priority - b._metadata.priority;
      }
      
      // Secondary sort: due date (older first)
      const dateA = new Date(a.dueDate);
      const dateB = new Date(b.dueDate);
      return dateA - dateB;
    });
  }

  /**
   * Split distribution results by module
   * 
   * Takes the unified distribution from PaymentDistributionService
   * and splits it back into module-specific results for recording.
   * 
   * @private
   * @param {object} distribution - Payment distribution from shared service
   * @param {Array} allBills - Original bills array with metadata
   * @returns {object} Module-specific distribution results
   */
  _splitDistributionByModule(distribution, allBills) {
    console.log(`🔄 [UNIFIED WRAPPER] Splitting distribution by module`);
    
    // Create a map using the period from bills (already has module prefix at this point)
    const billMap = new Map();
    allBills.forEach(bill => {
      billMap.set(bill.period, bill);
    });
    
    // Initialize result structure
    const result = {
      totalAmount: distribution.totalAvailableFunds || 0,
      currentCreditBalance: distribution.currentCreditBalance || 0,
      newCreditBalance: distribution.newCreditBalance || 0,
      hoa: {
        billsPaid: [],
        totalPaid: 0,
        monthsAffected: []
      },
      water: {
        billsPaid: [],
        totalPaid: 0,
        billsAffected: []
      },
      credit: {
        used: distribution.creditUsed || 0,
        added: distribution.netCreditAdded > 0 ? distribution.netCreditAdded : 0,  // Only positive values
        final: distribution.newCreditBalance || 0
      },
      summary: {
        totalBills: allBills.length,
        totalAllocated: distribution.totalApplied || 0,
        allocationCount: distribution.billPayments?.length || 0
      }
    };
    
    // Split bill payments by module
    // ONLY include bills that were actually paid (amountPaid > 0)
    (distribution.billPayments || []).forEach(payment => {
      // Skip bills with $0 payment (not actually paid)
      if (!payment.amountPaid || payment.amountPaid === 0) {
        return;
      }
      
      // Look up bill using the unique period (includes module prefix)
      const originalBill = billMap.get(payment.billPeriod);
      
      if (!originalBill) {
        console.warn(`   ⚠️  Could not find original bill for period: ${payment.billPeriod}`);
        return;
      }
      
      const moduleType = originalBill._metadata.moduleType;
      const displayPeriod = originalBill._originalPeriod || payment.billPeriod;
      
      if (moduleType === 'hoa') {
        // Add to HOA results
        result.hoa.billsPaid.push(payment);
        result.hoa.totalPaid = roundCurrency(result.hoa.totalPaid + (payment.amountPaid || 0));
        
        // Format for HOA-specific response (use original period without module prefix)
        result.hoa.monthsAffected.push({
          month: originalBill._hoaMetadata?.month,
          monthIndex: originalBill._metadata.monthIndex,
          billPeriod: displayPeriod,
          basePaid: payment.baseChargePaid || 0,
          penaltyPaid: payment.penaltyPaid || 0,
          totalPaid: payment.amountPaid || 0,
          status: payment.newStatus,
          priority: originalBill._metadata.priority  // For frontend sorting
        });
        
      } else if (moduleType === 'water') {
        // Add to Water results
        result.water.billsPaid.push(payment);
        result.water.totalPaid = roundCurrency(result.water.totalPaid + (payment.amountPaid || 0));
        
        // Format for Water-specific response (use original period without module prefix)
        result.water.billsAffected.push({
          billPeriod: displayPeriod,
          basePaid: payment.baseChargePaid || 0,
          penaltyPaid: payment.penaltyPaid || 0,
          totalPaid: payment.amountPaid || 0,
          status: payment.newStatus,
          priority: originalBill._metadata.priority  // For frontend sorting
        });
      }
    });
    
    console.log(`✅ [UNIFIED WRAPPER] Distribution split complete`);
    console.log(`   HOA: ${result.hoa.billsPaid.length} bills, Total: $${result.hoa.totalPaid}`);
    console.log(`   Water: ${result.water.billsPaid.length} bills, Total: $${result.water.totalPaid}`);
    
    return result;
  }

  /**
   * Get month name for allocation display
   * 
   * @private
   * @param {number} month - Month number (1-12)
   * @param {number} year - Year
   * @returns {string} Month name with year (e.g., "October 2025")
   */
  _getMonthName(month, year) {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[month - 1]} ${year}`;
  }

  /**
   * Generate consolidated transaction notes
   * 
   * Format: "HOA: Jan - Feb 2026. Water: Jul - Oct 2026. Credit: +$200"
   * 
   * @private
   * @param {object} preview - Preview data from unified payment
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
   * @returns {string} Consolidated notes string
   */
  _generateConsolidatedNotes(preview, fiscalYearStartMonth = 1) {
    const parts = [];
    
    // Month names array
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    // Helper to get calendar month name from fiscal period
    const getPeriodMonthName = (period, fiscalStart) => {
      // Remove any module prefix (e.g., "hoa:2026-00" or "water:2026-00")
      const cleanPeriod = period.includes(':') ? period.split(':')[1] : period;
      
      // Period format: "2026-00" where 00 is fiscal month index (0-11)
      const [year, fiscalMonthStr] = cleanPeriod.split('-');
      const fiscalMonth = parseInt(fiscalMonthStr);
      
      // Convert fiscal month index to calendar month (0-11)
      let calendarMonth = (fiscalStart - 1 + fiscalMonth) % 12;
      
      return { monthName: monthNames[calendarMonth], year };
    };
    
    // Helper to format month range
    const formatMonthRange = (months, year) => {
      if (months.length === 1) {
        return `${months[0]} ${year}`;
      }
      return `${months[0]} - ${months[months.length - 1]} ${year}`;
    };
    
    // HOA bills paid
    if (preview.hoa && preview.hoa.billsPaid && preview.hoa.billsPaid.length > 0) {
      const hoaMonths = preview.hoa.billsPaid
        .map(bill => getPeriodMonthName(bill.billPeriod, fiscalYearStartMonth))
        .sort((a, b) => {
          // Sort by year, then by month order in array
          if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
          return monthNames.indexOf(a.monthName) - monthNames.indexOf(b.monthName);
        });
      
      // Group by year
      const yearGroups = {};
      hoaMonths.forEach(({ monthName, year }) => {
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push(monthName);
      });
      
      // Format as range: "Jan - Feb 2026"
      const hoaParts = Object.entries(yearGroups).map(([year, months]) => {
        return formatMonthRange(months, year);
      });
      
      parts.push(`HOA: ${hoaParts.join('; ')}`);
    }
    
    // Water bills paid
    if (preview.water && preview.water.billsPaid && preview.water.billsPaid.length > 0) {
      const waterMonths = preview.water.billsPaid
        .map(bill => getPeriodMonthName(bill.billPeriod, fiscalYearStartMonth))
        .sort((a, b) => {
          // Sort by year, then by month order in array
          if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
          return monthNames.indexOf(a.monthName) - monthNames.indexOf(b.monthName);
        });
      
      // Group by year
      const yearGroups = {};
      waterMonths.forEach(({ monthName, year }) => {
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push(monthName);
      });
      
      // Format as range: "Jul - Oct 2026"
      const waterParts = Object.entries(yearGroups).map(([year, months]) => {
        return formatMonthRange(months, year);
      });
      
      parts.push(`Water: ${waterParts.join('; ')}`);
    }
    
    // Credit balance change
    if (preview.credit && (preview.credit.used > 0 || preview.credit.added > 0)) {
      const netChange = preview.credit.added - preview.credit.used;
      if (netChange !== 0) {
        const sign = netChange > 0 ? '+' : '';
        parts.push(`Credit: ${sign}$${netChange.toFixed(2)}`);
      }
    }
    
    // If no parts, return generic message
    if (parts.length === 0) {
      return 'Unified payment';
    }
    
    return parts.join('. ');
  }

  /**
   * Get merged configuration from both modules
   * 
   * @private
   * @param {string} clientId - Client ID
   * @returns {object} Merged configuration
   */
  async _getMergedConfig(clientId) {
    // Get configurations from both modules
    const hoaConfig = await getHOABillingConfig(clientId);
    const waterConfig = await getWaterBillingConfig(this.db, clientId, 'water');
    
    // Note: Each module maintains separate config
    // Return both for module-specific penalty calculations
    return {
      hoa: hoaConfig,
      water: waterConfig,
      // Client-level fiscal year config (system-wide)
      fiscalYearStartMonth: hoaConfig.fiscalYearStartMonth || 1
    };
  }
}

/**
 * Export singleton instance
 */
export const unifiedPaymentWrapper = new UnifiedPaymentWrapper();


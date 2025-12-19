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

import { getNow, createDate, toISOString } from '../../shared/services/DateService.js';
import { calculatePaymentDistribution } from '../../shared/services/PaymentDistributionService.js';
import { pesosToCentavos, centavosToPesos } from '../../shared/utils/currencyUtils.js';
import { getCreditBalance } from '../../shared/services/CreditBalanceService.js';
import { getDb } from '../firebase.js';
import { createTransaction } from '../controllers/transactionsController.js';
import creditService from './creditService.js';
import admin from 'firebase-admin';
import { createNotesEntry, getNotesArray } from '../../shared/utils/formatUtils.js';

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
  async previewUnifiedPayment(clientId, unitId, paymentAmount, paymentDate = null, zeroAmountRequest = false) {
    await this._initializeDb();
    
    console.log(`🌐 [UNIFIED WRAPPER] Preview payment: ${clientId}/${unitId}, Amount: $${paymentAmount}${zeroAmountRequest ? ' (zero-amount request)' : ''}`);
    
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
    
    // Handle zero-amount request: set credit to 0 and remove next fiscal year payments
    if (zeroAmountRequest) {
      console.log(`   🔧 Zero-amount request: Setting credit to 0 and removing next fiscal year payments`);
      console.log(`   🔧 Before override - credit.added: ${splitResults.credit.added}, credit.final: ${splitResults.credit.final}, netCreditAdded: ${splitResults.netCreditAdded}`);
      
      // Set credit-related fields to 0
      splitResults.credit.added = 0;
      splitResults.credit.final = currentCredit; // Keep current credit, don't add any
      splitResults.netCreditAdded = 0;
      splitResults.newCreditBalance = currentCredit; // Also update newCreditBalance to match
      
      // Set additionalPaidToCredit to 0 if it exists (for compatibility)
      if (splitResults.additionalPaidToCredit !== undefined) {
        splitResults.additionalPaidToCredit = 0;
      }
      if (splitResults.additionalPaidToCredit_cents !== undefined) {
        splitResults.additionalPaidToCredit_cents = 0;
      }
      
      // Remove next fiscal year payments if present
      if (splitResults.hoa?.nextFiscalYearPayments) {
        delete splitResults.hoa.nextFiscalYearPayments;
      }
      
      console.log(`   🔧 After override - credit.added: ${splitResults.credit.added}, credit.final: ${splitResults.credit.final}, newCreditBalance: ${splitResults.newCreditBalance}`);
    } else {
      // Normal request with actual payment amount - credit should be calculated correctly
      console.log(`   💰 Normal payment request - Credit calculation:`);
      console.log(`      Payment Amount: $${paymentAmount}`);
      console.log(`      Bills Paid: $${splitResults.hoa.totalPaid + splitResults.water.totalPaid}`);
      console.log(`      Current Credit: $${currentCredit}`);
      console.log(`      Credit Added: $${splitResults.credit.added}`);
      console.log(`      Final Credit: $${splitResults.credit.final}`);
      console.log(`      New Credit Balance: $${splitResults.newCreditBalance}`);
    }
    
    console.log(`✅ [UNIFIED WRAPPER] Preview complete`);
    console.log(`   HOA: ${splitResults.hoa.billsPaid.length} bills, $${splitResults.hoa.totalPaid}`);
    console.log(`   Water: ${splitResults.water.billsPaid.length} bills, $${splitResults.water.totalPaid}`);
    console.log(`   Credit: Used $${splitResults.credit.used}, Added $${splitResults.credit.added}, Final $${splitResults.credit.final}`);
    
    // Debug: Log first few HOA months
    console.log(`   🔍 HOA Months Sample:`, splitResults.hoa.monthsAffected.slice(0, 3).map(m => ({
      billPeriod: m.billPeriod,
      monthIndex: m.monthIndex,
      month: m.month
    })));
    
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
    
    // Step 3: Prepare atomic batch for all writes
    console.log(`   💾 Preparing atomic batch (transaction + HOA + Water + Credit)...`);
    const batch = this.db.batch();
    
    // Combine notes with user notes (sequence will be added after transaction creation)
    const combinedNotes = notes 
      ? `${notesWithoutSeq}\n${notes}` 
      : notesWithoutSeq;
    
    // Build allocations array for TransactionView
    const allocations = [];
    let allocationIndex = 1;
    
    // Add HOA allocations (split into base and penalty)
    if (preview.hoa && preview.hoa.monthsAffected) {
      preview.hoa.monthsAffected.forEach(entry => {
        // Determine target ID and name based on whether it's quarterly or monthly
        let targetId, targetName;
        if (entry.isQuarterly) {
          const quarterNum = (entry.quarterIndex || 0) + 1;
          targetId = `Q${quarterNum}_${fiscalYear}`;
          targetName = `Q${quarterNum} ${fiscalYear}`;
        } else {
          targetId = `month_${entry.monthIndex}_${fiscalYear}`;
          targetName = this._getMonthName((entry.monthIndex || 0) + 1, fiscalYear); // Convert 0-11 to 1-12
        }
        
        // Base charge allocation
        if (entry.basePaid > 0) {
          allocations.push({
            id: `alloc_${String(allocationIndex).padStart(3, '0')}`,
            type: 'hoa_month',
            targetId: targetId,
            targetName: targetName,
            amount: entry.basePaid, // In pesos - createTransaction will convert to centavos
            categoryName: 'HOA Dues',
            categoryId: 'hoa-dues',
            data: {
              unitId: unitId,
              month: entry.monthIndex, // Keep for compatibility
              ...(entry.quarterIndex !== undefined && { quarter: entry.quarterIndex }), // Only include if defined
              year: fiscalYear
            }
          });
          allocationIndex++;
        }
        
        // Penalty allocation (separate line item)
        if (entry.penaltyPaid > 0) {
          allocations.push({
            id: `alloc_${String(allocationIndex).padStart(3, '0')}`,
            type: 'hoa_penalty',
            targetId: `penalty_${targetId}`,
            targetName: targetName,
            amount: entry.penaltyPaid, // In pesos - createTransaction will convert to centavos
            categoryName: 'HOA Penalties',
            categoryId: 'hoa-penalties',
            data: {
              unitId: unitId,
              month: entry.monthIndex, // Keep for compatibility
              ...(entry.quarterIndex !== undefined && { quarter: entry.quarterIndex }), // Only include if defined
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
            categoryId: 'water-penalties',
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
    
    console.log(`   💾 Transaction Data for Batch:`);
    console.log(`      Amount: ${transactionData.amount} pesos`);
    console.log(`      Account: ${transactionData.accountId} (${transactionData.accountType})`);
    console.log(`      Allocations: ${allocations.length}`);
    console.log(`      AllocationSummary.totalAllocated: ${allocationSummary.totalAllocated}`);
    
    // Step 3a: Create transaction using batch mode (Option B)
    const transactionId = await createTransaction(clientId, transactionData, { batch });
    console.log(`   ✅ Transaction added to batch: ${transactionId}`);
    
    // Now add the transaction ID to the comprehensive notes
    const comprehensiveNotesWithSeq = `${notesWithoutSeq}\nTxnID: ${transactionId}`;
    
    // Step 3b: Prepare HOA dues updates for batch (if HOA bills were paid)
    if (preview.hoa && preview.hoa.monthsAffected && preview.hoa.monthsAffected.length > 0) {
      console.log(`   🏠 Preparing ${preview.hoa.monthsAffected.length} HOA entries for batch...`);
      
      // Prepare HOA batch updates
      await this._prepareHOABatchUpdates(
        batch,
        clientId,
        unitId,
        preview.hoa,
        transactionId,
        comprehensiveNotesWithSeq,
        paymentDate,
        paymentMethod,
        reference
      );
      
      console.log(`      ✅ HOA updates prepared for batch`);
    }
    
    // Step 3c: Prepare Water bills updates for batch (if Water bills were paid)
    if (preview.water && preview.water.billsAffected && preview.water.billsAffected.length > 0) {
      console.log(`   💧 Preparing ${preview.water.billsAffected.length} Water bills for batch...`);
      
      // Prepare Water batch updates
      await this._prepareWaterBatchUpdates(
        batch,
        clientId,
        unitId,
        preview.water,
        transactionId,
        paymentDate,
        paymentMethod,
        reference
      );
      
      console.log(`      ✅ Water updates prepared for batch`);
    }
    
    // Step 3d: Prepare Credit balance update for batch (if credit changed)
    const creditChange = (preview.credit?.added || 0) - (preview.credit?.used || 0);
    if (Math.abs(creditChange) > 0.01) {
      console.log(`   💰 Preparing credit balance update for batch...`);
      
      await this._prepareCreditBatchUpdate(
        batch,
        clientId,
        unitId,
        preview.credit,
        transactionId
      );
      
      console.log(`      ✅ Credit update prepared for batch`);
    }
    
    // Step 4: ATOMIC COMMIT - All or nothing
    const hoaCount = preview.hoa?.monthsAffected?.length || 0;
    const waterCount = preview.water?.billsAffected?.length || 0;
    const creditStatus = Math.abs(creditChange) > 0.01 ? 'yes' : 'no';
    
    console.log(`   💾 Committing atomic batch: transaction + ${hoaCount} HOA + ${waterCount} Water + credit(${creditStatus})`);
    await batch.commit();
    console.log(`   ✅ Atomic batch committed successfully - ALL operations completed`);
    
    // Step 5: Return result summary
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
      const billsWithPenalties = await this._calculateHOAPenaltiesInMemory(bills, calculationDate, config);
      
      // Filter to unpaid bills only
      const unpaidBills = billsWithPenalties.filter(b => b.status !== 'paid');
      
      // Check if month 0 is unpaid - if so, scan backward into prior year
      const month0Unpaid = unpaidBills.find(bill => 
        bill._hoaMetadata?.monthIndex === 0
      );
      
      let allUnpaidBills = [...unpaidBills];
      
      if (month0Unpaid) {
        console.log(`   📅 [HOA] Month 0 is unpaid, scanning prior year ${fiscalYear - 1}`);
        
        // Load prior year HOA dues document
        const priorYear = fiscalYear - 1;
        const priorDuesRef = this.db.collection('clients').doc(clientId)
          .collection('units').doc(unitId)
          .collection('dues').doc(priorYear.toString());
        
        const priorDuesSnap = await priorDuesRef.get();
        
        if (priorDuesSnap.exists) {
          const priorDuesDoc = priorDuesSnap.data();
          
          // Convert prior year dues to bills
          const priorBills = this._convertHOADuesToBills(priorDuesDoc, clientId, unitId, priorYear, config);
          const priorBillsWithPenalties = await this._calculateHOAPenaltiesInMemory(priorBills, calculationDate, config);
          
          // Scan backward from month 11 to 0
          const priorUnpaidBills = [];
          for (let monthIndex = 11; monthIndex >= 0; monthIndex--) {
            const bill = priorBillsWithPenalties.find(b => b._hoaMetadata?.monthIndex === monthIndex);
            
            if (!bill) continue;
            
            // Stop at first paid bill (status === 'paid' && paidAmount > 0)
            if (bill.status === 'paid' && bill.paidAmount > 0) {
              console.log(`   🛑 [HOA] Stopping at paid bill: Month ${monthIndex} (${bill.period})`);
              break;
            }
            
            // Add unpaid bills to collection
            if (bill.status === 'unpaid') {
              priorUnpaidBills.unshift(bill); // Add to beginning to maintain chronological order
            }
          }
          
          if (priorUnpaidBills.length > 0) {
            console.log(`   📊 [HOA] Found ${priorUnpaidBills.length} unpaid bills from prior year ${priorYear}`);
            // Add prior year bills to the beginning of the array (they have higher priority)
            allUnpaidBills = [...priorUnpaidBills, ...allUnpaidBills];
          } else {
            console.log(`   ℹ️  [HOA] No additional unpaid bills found in prior year ${priorYear}`);
          }
        } else {
          console.log(`   ℹ️  [HOA] No prior year dues document found for ${unitId}/${priorYear}`);
        }
      }
      
      // Enhance with unified metadata
      const enhancedBills = allUnpaidBills.map(bill => ({
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
   * Calculate frequency-aware due date for HOA Dues
   * (Replicated from hoaDuesController - FIXED)
   * 
   * FIXED: Correctly calculates calendar year from fiscal year
   * Fiscal years are named by their ending year, so FY 2026 starts in 2025
   * 
   * @private
   */
  _calculateFrequencyAwareDueDate(fiscalMonthIndex, fiscalYear, frequency, fiscalYearStartMonth) {
    // Validate inputs
    if (fiscalMonthIndex < 0 || fiscalMonthIndex > 11) {
      throw new Error(`fiscalMonthIndex must be 0-11, got ${fiscalMonthIndex}`);
    }
    
    if (!['monthly', 'quarterly'].includes(frequency)) {
      throw new Error(`Unsupported duesFrequency: ${frequency}. Expected 'monthly' or 'quarterly'.`);
    }
    
    // Calculate the actual calendar month and year
    // This correctly handles fiscal years that span calendar years
    
    if (frequency === 'monthly') {
      // For monthly, each fiscal month has its own due date
      const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
      const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
      
      const dueDate = createDate(calendarYear, calendarMonth + 1, 1);
      return toISOString(dueDate);
    }
    
    if (frequency === 'quarterly') {
      // For quarterly, months share due dates by quarter
      const quarterStartFiscalMonth = Math.floor(fiscalMonthIndex / 3) * 3;
      const calendarMonth = ((fiscalYearStartMonth - 1) + quarterStartFiscalMonth) % 12;
      const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + quarterStartFiscalMonth) / 12);
      
      const dueDate = createDate(calendarYear, calendarMonth + 1, 1);
      return toISOString(dueDate);
    }
    
    throw new Error(`Unsupported frequency: ${frequency}`);
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
    const isQuarterly = config.duesFrequency === 'quarterly';
    
    console.log(`      🔄 Converting HOA dues to bills: ${isQuarterly ? '4 quarters' : '12 fiscal months'}`);
    
    if (isQuarterly) {
      // Generate bills for 4 quarters (Q1-Q4)
      for (let quarter = 0; quarter < 4; quarter++) {
        const quarterStartMonth = quarter * 3;
        const quarterEndMonth = quarterStartMonth + 2;
        
        // Sum up payments and charges for the quarter
        let quarterBaseCharge = 0;
        let quarterBasePaid = 0;
        let quarterPenaltyPaid = 0;
        let quarterTotalPaid = 0;
        let allMonthsPaid = true;
        
        for (let monthIndex = quarterStartMonth; monthIndex <= quarterEndMonth; monthIndex++) {
          const payment = paymentsArray[monthIndex] || null;
          quarterBaseCharge += monthlyAmount;
          quarterBasePaid += payment?.basePaid || 0;
          quarterPenaltyPaid += payment?.penaltyPaid || 0;
          quarterTotalPaid += payment?.amount || 0;
          
          if (!payment || payment.amount < monthlyAmount) {
            allMonthsPaid = false;
          }
        }
        
        // Calculate frequency-aware due date for the quarter (first month of quarter)
        const dueDateISO = this._calculateFrequencyAwareDueDate(
          quarterStartMonth,
          year,
          config.duesFrequency,
          config.fiscalYearStartMonth || 1
        );
        const dueDate = parseDate(dueDateISO);
        
        const penaltyAmount = 0; // Calculated fresh later
        const totalDue = quarterBaseCharge + penaltyAmount;
        
        // Calculate what's still owed (for partial payments)
        const baseOwed = quarterBaseCharge - quarterBasePaid;
        const penaltyOwed = penaltyAmount - quarterPenaltyPaid; // Will be recalculated with penalties
        const totalOwed = totalDue - quarterTotalPaid;
        
        // Determine bill status based on payment state
        let billStatus;
        if (quarterTotalPaid >= totalDue && totalDue > 0) {
          billStatus = 'paid';
        } else if (quarterTotalPaid > 0) {
          billStatus = 'partial';
        } else {
          billStatus = 'unpaid';
        }
        
        bills.push({
          billId: `${year}-Q${quarter + 1}`,
          period: `${year}-Q${quarter + 1}`,
          unitId: unitId,
          currentCharge: quarterBaseCharge,
          baseCharge: quarterBaseCharge,
          penaltyAmount: penaltyAmount,
          totalCharge: totalDue,
          paidAmount: quarterTotalPaid,
          basePaid: quarterBasePaid,
          penaltyPaid: quarterPenaltyPaid,
          baseOwed: baseOwed,
          penaltyOwed: penaltyOwed,
          totalOwed: totalOwed,
          status: billStatus,
          billDate: dueDate.toISOString(),
          dueDate: dueDate.toISOString(),  // Required for penalty calculation
          paidDate: allMonthsPaid && quarterTotalPaid > 0 ? dueDate.toISOString() : null,
          _hoaMetadata: {
            monthIndex: quarterStartMonth, // First month of quarter
            quarterIndex: quarter,
            monthsInQuarter: [quarterStartMonth, quarterStartMonth + 1, quarterStartMonth + 2],
            isQuarterly: true,
            originalPayments: [
              paymentsArray[quarterStartMonth] || null,
              paymentsArray[quarterStartMonth + 1] || null,
              paymentsArray[quarterStartMonth + 2] || null
            ]
          }
        });
      }
    } else {
      // Generate bills for all 12 fiscal months (0-11)
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const payment = paymentsArray[monthIndex] || null;
      const month = monthIndex + 1;
      const fiscalMonth = monthIndex;
      
      // Calculate frequency-aware due date using the same logic as hoaDuesController
      const dueDateISO = this._calculateFrequencyAwareDueDate(
        fiscalMonth,
        year,
        config.duesFrequency || 'monthly',
        config.fiscalYearStartMonth || 1
      );
      const dueDate = parseDate(dueDateISO);
      
      // Read existing partial payment state from payment entry
      const basePaid = payment?.basePaid || 0;
      const penaltyPaid = payment?.penaltyPaid || 0;
      const totalPaid = payment?.amount || 0;
      
      const baseCharge = monthlyAmount;
      const penaltyAmount = 0; // Calculated fresh later
      
      // Calculate what's still owed (for partial payments)
      const baseOwed = baseCharge - basePaid;
      const penaltyOwed = penaltyAmount - penaltyPaid; // Will be recalculated with penalties
      const totalDue = baseCharge + penaltyAmount;
      const totalOwed = totalDue - totalPaid;
      
      // Determine bill status based on payment state
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
        paidAmount: totalPaid,
        basePaid: basePaid,
        penaltyAmount: penaltyAmount,
        penaltyPaid: penaltyPaid,
        totalAmount: totalDue,
        baseOwed: baseOwed,
        penaltyOwed: penaltyOwed,
        totalOwed: totalOwed,
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
    }
    
    console.log(`      ✅ Converted ${bills.length} ${isQuarterly ? 'quarters' : 'months'} to bills`);
    return bills;
  }

  /**
   * Calculate penalties in-memory for HOA bills
   * (Replicated from hoaDuesController since it's not exported)
   * 
   * @private
   */
  async _calculateHOAPenaltiesInMemory(bills, asOfDate, config) {
    console.log(`      💰 Calculating penalties for ${bills.length} bills as of ${asOfDate.toISOString()}`);
    
    // Validate penalty configuration
    if (config.penaltyRate === undefined || config.penaltyRate === null || 
        config.penaltyDays === undefined || config.penaltyDays === null) {
      const missing = [];
      if (config.penaltyRate === undefined || config.penaltyRate === null) missing.push('penaltyRate');
      if (config.penaltyDays === undefined || config.penaltyDays === null) missing.push('penaltyDays');
      throw new Error(`Penalty configuration incomplete. Missing: ${missing.join(', ')}`);
    }
    
    // Import the grouped penalty recalculation from PenaltyRecalculationService
    const { recalculatePenalties } = await import('../../shared/services/PenaltyRecalculationService.js');
    
    // Use grouped penalty recalculation (Phase 5)
    const result = await recalculatePenalties({
      bills,
      asOfDate,
      config: {
        penaltyRate: config.penaltyRate,
        penaltyDays: config.penaltyDays
      }
    });
    
    const totalPenalties = result.totalPenaltiesAdded;
    console.log(`      ✅ Recalculated penalties (grouped): Total $${centavosToPesos(totalPenalties)}, ${result.billsUpdated} bills updated`);
    
    // CRITICAL: Recalculate *Owed fields after penalty recalculation
    // Penalty recalculation updates bill.penaltyAmount, so we need to update penaltyOwed and totalOwed
    const billsWithUpdatedOwed = result.updatedBills.map(bill => {
      // Recalculate penaltyOwed based on new penaltyAmount
      const penaltyOwed = (bill.penaltyAmount || 0) - (bill.penaltyPaid || 0);
      // Recalculate totalOwed = baseOwed + penaltyOwed
      const totalOwed = (bill.baseOwed || 0) + penaltyOwed;
      
      return {
        ...bill,
        penaltyOwed: penaltyOwed,
        totalOwed: totalOwed
      };
    });
    
    return billsWithUpdatedOwed;
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
        const isQuarterly = originalBill._hoaMetadata?.isQuarterly;
        const hoaMonth = {
          month: originalBill._hoaMetadata?.month,
          monthIndex: originalBill._metadata.monthIndex,
          billPeriod: displayPeriod,
          basePaid: payment.baseChargePaid || 0,
          penaltyPaid: payment.penaltyPaid || 0,
          totalPaid: payment.amountPaid || 0,
          status: payment.newStatus,
          priority: originalBill._metadata.priority,  // For frontend sorting
          isQuarterly: isQuarterly,
          quarterIndex: originalBill._hoaMetadata?.quarterIndex,
          monthsInQuarter: originalBill._hoaMetadata?.monthsInQuarter
        };
        
        console.log(`   🎯 [HOA ${isQuarterly ? 'Quarter' : 'Month'}] ${displayPeriod}: monthIndex=${hoaMonth.monthIndex}${isQuarterly ? `, Q${hoaMonth.quarterIndex + 1}` : `, month=${hoaMonth.month}`}`);
        result.hoa.monthsAffected.push(hoaMonth);
        
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
      
      // Check if this is a quarterly period (e.g., "2026-Q1")
      if (cleanPeriod.includes('-Q')) {
        const [year, quarter] = cleanPeriod.split('-Q');
        return { monthName: `Q${quarter}`, year, isQuarter: true };
      }
      
      // Period format: "2026-00" where 00 is fiscal month index (0-11)
      const [year, fiscalMonthStr] = cleanPeriod.split('-');
      const fiscalMonth = parseInt(fiscalMonthStr);
      
      // Convert fiscal month index to calendar month (0-11)
      let calendarMonth = (fiscalStart - 1 + fiscalMonth) % 12;
      
      return { monthName: monthNames[calendarMonth], year, isQuarter: false };
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
          // Sort by year first
          if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
          
          // For quarters, sort by quarter number
          if (a.isQuarter && b.isQuarter) {
            return parseInt(a.monthName.substring(1)) - parseInt(b.monthName.substring(1));
          }
          
          // For months, sort by month order
          if (!a.isQuarter && !b.isQuarter) {
            return monthNames.indexOf(a.monthName) - monthNames.indexOf(b.monthName);
          }
          
          // Quarters come before months in the same year
          return a.isQuarter ? -1 : 1;
        });
      
      // Group by year
      const yearGroups = {};
      hoaMonths.forEach(({ monthName, year }) => {
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push(monthName);
      });
      
      // Format as range or list
      const hoaParts = Object.entries(yearGroups).map(([year, items]) => {
        // For quarters, just list them
        if (items.some(item => item.startsWith('Q'))) {
          return `${items.join(', ')} ${year}`;
        }
        // For months, format as range
        return formatMonthRange(items, year);
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

  /**
   * Prepare HOA dues updates for batch commit
   * @private
   */
  async _prepareHOABatchUpdates(batch, clientId, unitId, hoaData, transactionId, notes, paymentDate, paymentMethod, reference) {
    // Group by fiscal year since we might have bills from multiple years
    const entriesByYear = {};
    hoaData.monthsAffected.forEach(entry => {
      // Extract year from billPeriod (e.g., "2024-09" -> 2024 or "2024-Q1" -> 2024)
      const year = parseInt(entry.billPeriod.split('-')[0]);
      if (!entriesByYear[year]) {
        entriesByYear[year] = [];
      }
      
      // Prepare data based on whether it's quarterly or monthly
      if (entry.isQuarterly) {
        // Quarterly payment - record payment for all 3 months in the quarter
        const quarterIndex = entry.quarterIndex || 0;
        const startMonth = quarterIndex * 3; // 0, 3, 6, 9
        
        // Create entries for each month in the quarter
        for (let i = 0; i < 3; i++) {
          const monthIndex = startMonth + i;
          const monthPaymentEntry = {
            month: monthIndex + 1, // Convert 0-based to 1-based
            basePaid: pesosToCentavos(entry.basePaid / 3), // Split equally among 3 months
            penaltyPaid: i === 0 ? pesosToCentavos(entry.penaltyPaid) : 0, // Penalty only on first month
            notes: notes + ` (Q${quarterIndex + 1} Month ${i + 1}/3)`
          };
          entriesByYear[year].push(monthPaymentEntry);
        }
      } else {
        // Monthly payment
        const paymentEntry = {
          month: entry.month,
          basePaid: pesosToCentavos(entry.basePaid),
          penaltyPaid: pesosToCentavos(entry.penaltyPaid),
          notes: notes
        };
        entriesByYear[year].push(paymentEntry);
      }
    });
    
    // Prepare batch updates for each year's document
    for (const [year, paymentsData] of Object.entries(entriesByYear)) {
      const duesRef = this.db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').doc(year.toString());
      
      const duesDoc = await duesRef.get();
      if (!duesDoc.exists) {
        console.warn(`HOA dues document not found for ${unitId}/${year} - skipping`);
        continue;
      }
      
      const duesData = duesDoc.data();
      const currentPayments = Array.isArray(duesData.payments) ? duesData.payments : [];
      
      // Update payment entries - MERGE logic for partial payment support
      const updatedPayments = [...currentPayments];
      const monthlyAmount = duesData.scheduledAmount || 0; // Base monthly charge
      
      paymentsData.forEach(paymentEntry => {
        const monthIndex = paymentEntry.month - 1; // Convert 1-based to 0-based
        
        if (monthIndex < 0 || monthIndex > 11) {
          console.warn(`Invalid month index ${monthIndex}, skipping`);
          return;
        }
        
        // Get existing payment or initialize with zeros
        const existingPayment = updatedPayments[monthIndex] || {
          amount: 0,
          basePaid: 0,
          penaltyPaid: 0,
          notes: []
        };
        
        // ACCUMULATE amounts (MERGE, not overwrite)
        const newAmount = (existingPayment.amount || 0) + paymentEntry.basePaid + paymentEntry.penaltyPaid;
        const newBasePaid = (existingPayment.basePaid || 0) + paymentEntry.basePaid;
        const newPenaltyPaid = (existingPayment.penaltyPaid || 0) + paymentEntry.penaltyPaid;
        
        // Calculate status based on accumulated totals vs monthly due
        // Note: Penalty calculation happens on read, so we compare against base charge here
        let status;
        if (newBasePaid >= monthlyAmount && newPenaltyPaid >= 0) {
          // Base is fully paid and any penalties are covered
          status = 'paid';
        } else if (newAmount > 0) {
          // Some payment made but not complete
          status = 'partial';
        } else {
          status = 'unpaid';
        }
        
        // Build notes entry with full audit details
        const noteEntry = createNotesEntry({
          transactionId: transactionId,
          timestamp: paymentDate,
          text: paymentEntry.notes || 'Payment',
          amount: paymentEntry.basePaid + paymentEntry.penaltyPaid,
          basePaid: paymentEntry.basePaid,
          penaltyPaid: paymentEntry.penaltyPaid
        });
        
        // Merge notes arrays (handle legacy string format)
        const existingNotes = getNotesArray(existingPayment.notes);
        const mergedNotes = [...existingNotes, noteEntry];
        
        // Update payment entry with accumulated values
        updatedPayments[monthIndex] = {
          amount: newAmount,                    // ACCUMULATED total
          basePaid: newBasePaid,                // ACCUMULATED base
          penaltyPaid: newPenaltyPaid,          // ACCUMULATED penalty
          status: status,                       // Calculated status
          date: paymentDate,                    // Most recent payment date
          paid: status === 'paid',              // Legacy boolean for compatibility
          reference: transactionId,             // Most recent transaction ID
          paymentMethod: paymentMethod,
          notes: mergedNotes                    // ARRAY of payment notes
        };
      });
      
      // Calculate new total paid
      const newTotalPaid = updatedPayments.reduce((sum, p) => sum + (p?.amount || 0), 0);
      
      // Add to batch
      batch.update(duesRef, {
        payments: updatedPayments,
        totalPaid: newTotalPaid,
        creditBalance: admin.firestore.FieldValue.delete(), // Remove legacy field
        creditBalanceHistory: admin.firestore.FieldValue.delete(), // Remove legacy field
        updated: getNow().toISOString()
      });
      
      console.log(`      📅 HOA batch update prepared for year ${year}: ${paymentsData.length} months`);
    }
  }

  /**
   * Prepare Water bills updates for batch commit
   * @private
   */
  async _prepareWaterBatchUpdates(batch, clientId, unitId, waterData, transactionId, paymentDate, paymentMethod, reference) {
    for (const billData of waterData.billsAffected) {
      const billId = billData.billPeriod;
      const billRef = this.db.collection('clients').doc(clientId)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(billId);
      
      const billDoc = await billRef.get();
      if (!billDoc.exists) {
        console.warn(`Water bill ${billId} not found - skipping`);
        continue;
      }
      
      const currentBill = billDoc.data()?.bills?.units?.[unitId];
      if (!currentBill) {
        console.warn(`Unit ${unitId} not found in water bill ${billId} - skipping`);
        continue;
      }
      
      // Calculate new values (amounts in pesos, convert to centavos for storage)
      const basePaidCentavos = pesosToCentavos(billData.basePaid);
      const penaltyPaidCentavos = pesosToCentavos(billData.penaltyPaid);
      const totalPaidCentavos = basePaidCentavos + penaltyPaidCentavos;
      
      const newPaidAmount = (currentBill.paidAmount || 0) + totalPaidCentavos;
      const newBasePaid = (currentBill.basePaid || 0) + basePaidCentavos;
      const newPenaltyPaid = (currentBill.penaltyPaid || 0) + penaltyPaidCentavos;
      
      // Determine new status
      const totalAmount = currentBill.totalAmount || 0;
      let newStatus = 'unpaid';
      if (newPaidAmount >= totalAmount) {
        newStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newStatus = 'partial';
      }
      
      // Create payment record
      const paymentRecord = {
        transactionId: transactionId,
        date: paymentDate,
        amount: totalPaidCentavos,
        baseChargePaid: basePaidCentavos,
        penaltyPaid: penaltyPaidCentavos,
        paymentMethod: paymentMethod,
        reference: reference || null
      };
      
      // Get existing payments array
      const currentPayments = currentBill.payments || [];
      const updatedPayments = [...currentPayments, paymentRecord];
      
      // Add to batch
      batch.update(billRef, {
        [`bills.units.${unitId}.paidAmount`]: newPaidAmount,
        [`bills.units.${unitId}.basePaid`]: newBasePaid,
        [`bills.units.${unitId}.penaltyPaid`]: newPenaltyPaid,
        [`bills.units.${unitId}.status`]: newStatus,
        [`bills.units.${unitId}.payments`]: updatedPayments
      });
      
      console.log(`      💧 Water batch update prepared for ${billId}: ${billData.totalPaid} pesos`);
    }
  }

  /**
   * Prepare Credit balance update for batch commit
   * @private
   */
  async _prepareCreditBatchUpdate(batch, clientId, unitId, creditData, transactionId) {
    const creditBalancesRef = this.db.collection('clients').doc(clientId)
      .collection('units').doc('creditBalances');
    
    const creditDoc = await creditBalancesRef.get();
    const allCreditBalances = creditDoc.exists ? creditDoc.data() : {};
    
    const currentUnitData = allCreditBalances[unitId] || { creditBalance: 0, history: [] };
    const creditChangeCentavos = pesosToCentavos((creditData.added || 0) - (creditData.used || 0));
    const newBalanceCentavos = (currentUnitData.creditBalance || 0) + creditChangeCentavos;
    
    // Validate balance
    if (newBalanceCentavos < 0) {
      throw new Error(`Credit balance cannot be negative: ${newBalanceCentavos} centavos`);
    }
    
    // Create history entry
    const now = getNow();
    const historyEntry = {
      id: `credit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now.toISOString(),
      amount: creditChangeCentavos,
      balance: newBalanceCentavos,
      transactionId: transactionId,
      note: creditData.added > 0 
        ? `Unified payment overpayment +$${creditData.added.toFixed(2)}`
        : `Unified payment credit used -$${creditData.used.toFixed(2)}`,
      source: 'unifiedPayment'
    };
    
    const updatedHistory = [...(currentUnitData.history || []), historyEntry];
    
    // Update the credit balances document
    const fiscalYear = getFiscalYear(now, 7); // AVII uses July start (TODO: get from client config)
    allCreditBalances[unitId] = {
      creditBalance: newBalanceCentavos,
      lastChange: {
        year: fiscalYear.toString(),
        historyIndex: updatedHistory.length - 1,
        timestamp: now.toISOString()
      },
      history: updatedHistory
    };
    
    batch.set(creditBalancesRef, allCreditBalances);
    
    console.log(`      💰 Credit balance prepared: ${currentUnitData.creditBalance} → ${newBalanceCentavos} centavos ($${(creditChangeCentavos/100).toFixed(2)} change)`);
  }
}

/**
 * Export singleton instance
 */
export const unifiedPaymentWrapper = new UnifiedPaymentWrapper();


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
import { pesosToCentavos, centavosToPesos, formatCurrency } from '../../shared/utils/currencyUtils.js';
import { getCreditBalance, createCreditHistoryEntry } from '../../shared/utils/creditBalanceUtils.js';
import { getDb } from '../firebase.js';
import { createTransaction } from '../controllers/transactionsController.js';
import creditService from './creditService.js';
import admin from 'firebase-admin';
import { createNotesEntry, getNotesArray } from '../../shared/utils/formatUtils.js';
import { generateUPCData } from './generateUPCData.js';
import { logDebug, logInfo, logWarn, logError } from '../../shared/logger.js';

// Import module-specific functions
import { 
  getHOABillingConfig,
  updateHOADuesWithPayment,
  updatePriorYearClosedFlag
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
import { hasActivity } from '../utils/clientFeatures.js';

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
   * @param {boolean} zeroAmountRequest - Whether this is a zero-amount request
   * @param {Array} waivedPenalties - Array of penalty waivers {billId, amount, reason, notes}
   * @param {Array} excludedBills - Array of excluded bill periods
   * @returns {object} Unified payment distribution preview
   */
  async previewUnifiedPayment(clientId, unitId, paymentAmount, paymentDate = null, _deprecated = false, waivedPenalties = [], excludedBills = []) {
    await this._initializeDb();
    
    logInfo(`🌐 [UNIFIED WRAPPER] Preview payment: ${clientId}/${unitId}, Amount: $${paymentAmount}`);
    
    // Parse payment date
    const calculationDate = paymentDate ? new Date(paymentDate) : getNow();
    logDebug(`   📅 Calculation date: ${calculationDate.toISOString()}`);
    
    // Step 1: Get UPC-specific projection from generateUPCData()
    // This is the SINGLE data source for bills, credit, and discrepancy
    const upcData = await generateUPCData({
      clientId,
      unitId,
      asOfDate: calculationDate,
      waivedPenalties: waivedPenalties || [],
      excludedBills: excludedBills || []
    });
    
    // Extract data from UPC projection
    let allBills = upcData.bills;
    const currentCredit = upcData.creditAvailable || 0; // In pesos
    const discrepancy = upcData.discrepancy;
    
    logDebug(`   📋 UPC Data: ${allBills.length} bills, $${upcData.totalRemaining} remaining, $${currentCredit} credit`);
    
    // Step 1.5: Mark excluded bills (for any that weren't already filtered by generateUPCData)
    if (excludedBills && excludedBills.length > 0) {
      logDebug(`   🚫 Marking ${excludedBills.length} bills as excluded`);
      allBills.forEach(bill => {
        const billPeriod = `${bill._metadata.moduleType}:${bill.period}`;
        const isExcluded = excludedBills.includes(billPeriod) || excludedBills.includes(bill.period);
        if (isExcluded) {
          logDebug(`      ✗ Marking bill as excluded: ${billPeriod}`);
          bill._metadata.excluded = true;
        }
      });
    }
    
    // Get fiscal year config for priority calculation
    const configs = await this._getMergedConfig(clientId);
    
    if (allBills.length === 0) {
      logDebug(`   ℹ️  No unpaid bills found for unit ${unitId}`);
      
      return {
        totalAmount: paymentAmount,
        currentCreditBalance: currentCredit,
        newCreditBalance: roundCurrency(currentCredit + paymentAmount),
        hoa: { billsPaid: [], totalPaid: 0, monthsAffected: [] },
        water: { billsPaid: [], totalPaid: 0, billsAffected: [] },
        credit: {
          used: 0,
          added: paymentAmount,
          final: roundCurrency(currentCredit + paymentAmount)
        },
        summary: {
          totalBills: 0,
          totalAllocated: 0,
          allocationCount: 0
        },
        discrepancy: discrepancy
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
    
    // Credit balance already loaded from generateUPCData()
    logDebug(`   💰 Current credit balance: $${currentCredit}`);
    
    // Step 4: MULTI-PASS PRIORITY ALGORITHM
    // Simple approach: Pass payment and credit separately to distribution service
    // Let it handle the combination and track remaining funds
    logDebug(`   🔄 Starting multi-pass priority processing`);
    
    const allPaidBills = [];
    let remainingFunds = paymentAmount + currentCredit;  // Total available
    let paymentForNextLevel = paymentAmount;  // Track payment portion for distribution service
    let creditForNextLevel = currentCredit;   // Track credit portion for distribution service
    
    // Process priority levels 1-5 sequentially
    for (let priorityLevel = 1; priorityLevel <= 5; priorityLevel++) {
      if (remainingFunds <= 0) break;
      
      const billsAtThisLevel = billsWithUniquePeroids.filter(
        b => b._metadata.priority === priorityLevel && !b._metadata.excluded  // Skip excluded bills
      );
      
      if (billsAtThisLevel.length === 0) continue;
      
      logDebug(`   💸 Priority ${priorityLevel}: ${billsAtThisLevel.length} bills, $${remainingFunds.toFixed(2)} available`);
      
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
      
      logDebug(`      ✓ Paid ${levelDistribution.billPayments.filter(b => b.amountPaid > 0).length} bills, $${remainingFunds.toFixed(2)} remaining`);
    }
    
    // Calculate final results
    const totalPaidAmount = allPaidBills.reduce((sum, bp) => sum + bp.amountPaid, 0);
    const finalCreditBalance = remainingFunds;
    
    // NET credit change calculation (as per your logic):
    // New Credit Added = Remaining Total - Original Credit Balance
    const netCreditAdded = finalCreditBalance - currentCredit;
    
    logDebug(`   ✅ Multi-pass complete: ${allPaidBills.length} bills paid`);
    logDebug(`      💰 Final: Bills paid $${totalPaidAmount.toFixed(2)}, Credit change $${netCreditAdded.toFixed(2)}, Final balance $${finalCreditBalance.toFixed(2)}`);
    
    // Create a map of paid bills by period for quick lookup
    const paidBillsMap = new Map();
    allPaidBills.forEach(bp => {
      paidBillsMap.set(bp.billPeriod, bp);
    });
    
    // Include ALL bills in response (even if $0 allocated or excluded)
    // This ensures frontend can display all bills with checkboxes
    const allEligibleBillPayments = billsWithUniquePeroids.map(bill => {
      // Check if this bill was paid
      const paidBill = paidBillsMap.get(bill.period);
      
      if (paidBill) {
        // Bill was paid - use the payment distribution result
        return paidBill;
      } else {
        // Bill is eligible but not paid - include with $0 amounts
        // This allows Statement of Account to show upcoming bills
        // CRITICAL: Include actual bill amounts so frontend can display them
        const moduleType = bill._metadata.moduleType;
        const displayPeriod = bill._originalPeriod || bill.period.replace(`${moduleType}:`, '');
        
        const baseOwedCentavos = bill.baseAmount ?? bill.baseCharge ?? bill.currentCharge ?? 0;
        const penaltyOwedCentavos = bill.penaltyAmount ?? 0;
        const totalOwedCentavos = baseOwedCentavos + penaltyOwedCentavos;

        // Convert to pesos for consistency with PaymentDistributionService output
        const baseOwedPesos = centavosToPesos(baseOwedCentavos);
        const penaltyOwedPesos = centavosToPesos(penaltyOwedCentavos);
        const totalOwedPesos = centavosToPesos(totalOwedCentavos);
        
        return {
          billPeriod: bill.period,
          amountPaid: 0,
          baseChargePaid: 0,
          penaltyPaid: 0,
          // Include actual bill amounts so frontend can display them
          totalBaseDue: baseOwedPesos,
          totalPenaltyDue: penaltyOwedPesos,
          totalDue: totalOwedPesos,
          newStatus: bill.status || 'unpaid',
          dueDate: bill.dueDate,
          // Include metadata for proper formatting in _splitDistributionByModule
          _metadata: bill._metadata,
          _hoaMetadata: bill._hoaMetadata,
          _originalPeriod: displayPeriod
        };
      }
    });
    
    logDebug(`   📋 Including ${allEligibleBillPayments.length} bills in response (${allPaidBills.length} paid, ${allEligibleBillPayments.length - allPaidBills.length} unpaid)`);
    
    // Reconstruct distribution object for splitting
    const distribution = {
      totalAvailableFunds: paymentAmount + currentCredit,
      currentCreditBalance: currentCredit,
      newCreditBalance: roundCurrency(finalCreditBalance),
      creditUsed: netCreditAdded < 0 ? roundCurrency(-netCreditAdded) : 0,  // If negative, credit was used
      overpayment: netCreditAdded > 0 ? roundCurrency(netCreditAdded) : 0,  // If positive, credit was added
      netCreditAdded: roundCurrency(netCreditAdded),  // Can be positive or negative
      totalApplied: roundCurrency(totalPaidAmount),
      billPayments: allEligibleBillPayments  // Now includes all eligible bills, not just paid ones
    };
    
    // Step 5: Split results by module (use bills with unique periods for accurate matching)
    const splitResults = this._splitDistributionByModule(distribution, billsWithUniquePeroids);
    
    // Add netCreditAdded and discrepancy to the split results
    splitResults.netCreditAdded = distribution.netCreditAdded;
    splitResults.currentCreditBalance = currentCredit;
    splitResults.discrepancy = discrepancy;
    
    // UPC totals from generateUPCData() (bill-document authoritative)
    splitResults.upcTotalRemaining = upcData.totalRemaining;
    splitResults.upcTotalRemainingCentavos = upcData.totalRemainingCentavos;
    
    // Log payment calculation details
    logDebug(`   💰 Payment calculation - Credit allocation:`);
    logDebug(`      Payment Amount: $${paymentAmount}`);
    logDebug(`      Bills Paid: $${splitResults.hoa.totalPaid + splitResults.water.totalPaid}`);
    logDebug(`      Current Credit: $${currentCredit}`);
    logDebug(`      Credit Used: $${splitResults.credit.used}`);
    logDebug(`      Credit Added: $${splitResults.credit.added}`);
    logDebug(`      Final Credit: $${splitResults.credit.final}`);
    logDebug(`      New Credit Balance: $${splitResults.newCreditBalance}`);
    
    logInfo(`✅ [UNIFIED WRAPPER] Preview complete`);
    logDebug(`   HOA: ${splitResults.hoa.billsPaid.length} bills, $${splitResults.hoa.totalPaid}`);
    logDebug(`   Water: ${splitResults.water.billsPaid.length} bills, $${splitResults.water.totalPaid}`);
    logDebug(`   Credit: Used $${splitResults.credit.used}, Added $${splitResults.credit.added}, Final $${splitResults.credit.final}`);
    
    // Debug: Log first few HOA months
    logDebug(`   🔍 HOA Months Sample:`, splitResults.hoa.monthsAffected.slice(0, 3).map(m => ({
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
    
    logDebug(`🌐 [UNIFIED WRAPPER] Record payment: ${clientId}/${unitId}, Amount: $${paymentData.amount}`);
    
    // Extract payment data
    const { 
      amount, 
      paymentDate, 
      paymentMethod, 
      reference = null, 
      notes = null,
      waivedPenalties = [],
      excludedBills = [],
      documents = [], // Optional: array of document IDs
      preview,
      userId = 'system',
      accountId, // Required - no default
      accountType // Required - no default
    } = paymentData;
    
    // Validate required fields
    // Note: amount can be 0 (credit only payment), so check for null/undefined explicitly
    if (amount === null || amount === undefined || !paymentDate || !paymentMethod || !preview) {
      throw new Error('Missing required payment data: amount, paymentDate, paymentMethod, and preview are required');
    }
    
    // Validate amount is a valid number (including 0)
    if (typeof amount !== 'number' || amount < 0) {
      throw new Error('Invalid amount: must be a non-negative number');
    }
    
    logDebug(`   📋 Payment details: Method=${paymentMethod}, Date=${paymentDate}, Reference=${reference || 'none'}`);
    
    // Step 1: Sanity check preview totals (do NOT recalculate)
    logDebug(`   🔍 Verifying preview totals match payment amount...`);
    const previewTotal = preview.summary?.totalAllocated || 0;
    const netCreditAdded = preview.netCreditAdded ?? ((preview.credit?.added || 0) - (preview.credit?.used || 0));
    const expectedPayment = roundCurrency(previewTotal + netCreditAdded);

    if (Math.abs(expectedPayment - amount) > 0.01) {
      logError(`   ❌ Preview mismatch: Expected payment $${expectedPayment}, Received $${amount}`);
      throw new Error('Preview total does not match payment amount. Please refresh and try again.');
    }

    logDebug(`   ✅ Preview verified: $${expectedPayment} matches payment amount`);
    
    // Parse payment date
    const paymentDateObj = parseDate(paymentDate);
    
    // Get fiscal year configuration
    const configs = await this._getMergedConfig(clientId);
    const fiscalYear = getFiscalYear(paymentDateObj, configs.fiscalYearStartMonth || 1);
    
    // Track whether fast path was used (for priorYearClosed flag optimization)
    // Check current dues document to see if priorYearClosed flag is set
    const currentDuesDoc = await this._loadDuesDocument(clientId, unitId, fiscalYear);
    const usedFastPath = currentDuesDoc?.priorYearClosed === true;
    
    // Step 2: Generate consolidated transaction notes
    logDebug(`   📝 Generating consolidated transaction notes...`);
    
    // Generate clean, concise transaction notes
    // Format: "HOA: Oct - Dec 2025 (eTransfer)" - NOT verbose multi-line format
    const transactionNotes = this._generateConsolidatedNotes(preview, configs.fiscalYearStartMonth || 1);
    
    // Add payment method in parentheses at the end
    const notesWithMethod = `${transactionNotes} (${paymentMethod})`;
    
    // Add penalty waiver notes if any
    const waiverNotes = this._generateWaiverNotes(waivedPenalties);
    
    // Note: Sequence will be added after transaction creation
    const notesWithoutSeq = waiverNotes
      ? `${notesWithMethod}. ${waiverNotes}`
      : notesWithMethod;
    
    // Step 3: Prepare atomic batch for all writes
    logDebug(`   💾 Preparing atomic batch (transaction + HOA + Water + Credit)...`);
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
    
    // CRITICAL: Determine category based on whether there are allocations
    // - No allocations (everything to credit) → "account-credit" for proper deletion reversal
    // - Has allocations (split across bills) → "-split-" for split transaction handling
    const hasBillAllocations = allocations.length > 0;
    const categoryId = hasBillAllocations ? '-split-' : 'account-credit';
    const categoryName = hasBillAllocations ? '-Split-' : 'Account Credit';
    
    logDebug(`   🏷️  Transaction category: ${categoryName} (${allocations.length} allocations)`);
    
    const transactionData = {
      date: paymentDate, // Use original date string (yyyy-MM-dd format)
      amount: amount, // Pass in pesos - createTransaction will convert to centavos
      type: 'income',
      categoryId: categoryId,
      categoryName: categoryName,
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
      documents: documents || [], // Include document IDs in transaction
      metadata: {
        hoaBillsPaid: preview.hoa?.billsPaid?.length || 0,
        waterBillsPaid: preview.water?.billsPaid?.length || 0,
        creditUsed: preview.credit?.used || 0,
        creditAdded: preview.credit?.added || 0
      }
    };
    
    logDebug(`   💾 Transaction Data for Batch:`);
    logDebug(`      Amount: ${transactionData.amount} pesos`);
    logDebug(`      Account: ${transactionData.accountId} (${transactionData.accountType})`);
    logDebug(`      Allocations: ${allocations.length}`);
    logDebug(`      AllocationSummary.totalAllocated: ${allocationSummary.totalAllocated}`);
    if (documents && documents.length > 0) {
      logDebug(`      Documents: ${documents.length} document(s) to link`);
    }
    
    // Step 3a: Create transaction using batch mode (Option B)
    const transactionId = await createTransaction(clientId, transactionData, { batch });
    logDebug(`   ✅ Transaction added to batch: ${transactionId}`);
    
    // Note: Documents are included in transactionData.documents array, which will be stored in the transaction
    // Frontend's linkDocumentsToTransaction() will update document's linkedTo field for bidirectional linking
    
    // Now add the transaction ID to the comprehensive notes
    const comprehensiveNotesWithSeq = `${notesWithoutSeq}\nTxnID: ${transactionId}`;
    
    // Step 3b: Prepare HOA dues updates for batch (if HOA bills were paid)
    if (preview.hoa && preview.hoa.monthsAffected && preview.hoa.monthsAffected.length > 0) {
      logDebug(`   🏠 Preparing ${preview.hoa.monthsAffected.length} HOA entries for batch...`);
      
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
      
      logDebug(`      ✅ HOA updates prepared for batch`);
    }
    
    // Step 3c: Prepare Water bills updates for batch (if Water bills were paid)
    if (preview.water && preview.water.billsAffected && preview.water.billsAffected.length > 0) {
      logDebug(`   💧 Preparing ${preview.water.billsAffected.length} Water bills for batch...`);
      
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
      
      logDebug(`      ✅ Water updates prepared for batch`);
    }
    
    // Step 3d: Prepare Credit balance update for batch (if credit changed)
    const creditChange = (preview.credit?.added || 0) - (preview.credit?.used || 0);
    if (Math.abs(creditChange) > 0.01) {
      logDebug(`   💰 Preparing credit balance update for batch...`);
      
      await this._prepareCreditBatchUpdate(
        batch,
        clientId,
        unitId,
        preview.credit,
        transactionId
      );
      
      logDebug(`      ✅ Credit update prepared for batch`);
    }
    
    // Step 4: ATOMIC COMMIT - All or nothing
    const hoaCount = preview.hoa?.monthsAffected?.length || 0;
    const waterCount = preview.water?.billsAffected?.length || 0;
    const creditStatus = Math.abs(creditChange) > 0.01 ? 'yes' : 'no';
    
    logDebug(`   💾 Committing atomic batch: transaction + ${hoaCount} HOA + ${waterCount} Water + credit(${creditStatus})`);
    await batch.commit();
    logDebug(`   ✅ Atomic batch committed successfully - ALL operations completed`);
    
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
    
    logDebug(`✅ [UNIFIED WRAPPER] Payment recorded successfully`);
    logDebug(`   Transaction ID: ${transactionId}`);
    logDebug(`   HOA Bills: ${result.summary.hoaBillsPaid}, Water Bills: ${result.summary.waterBillsPaid}`);
    logDebug(`   Credit Balance: $${result.summary.finalCreditBalance}`);
    
    // Update priorYearClosed flag if we used slow path
    // If fast path was used, flag is already true and payment can't change it
    if (!usedFastPath && preview.hoa && preview.hoa.monthsAffected && preview.hoa.monthsAffected.length > 0) {
      logDebug(`   🏷️ [HOA] Updating priorYearClosed flag after slow path payment`);
      try {
        await updatePriorYearClosedFlag(clientId, unitId, fiscalYear);
      } catch (error) {
        // Log but don't fail the payment - flag update is optimization
        logError(`   ⚠️ [HOA] Failed to update priorYearClosed flag:`, error.message);
      }
    } else if (usedFastPath) {
      logDebug(`   🚀 [HOA] Fast path used - skipping priorYearClosed flag update (already true)`);
    }
    
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
    logDebug(`📋 [UNIFIED WRAPPER] Aggregating bills from HOA and Water modules`);
    
    // Get configurations for both modules
    const configs = await this._getMergedConfig(clientId);
    
    // Aggregate HOA bills
    const hoaBills = await this._getHOABills(clientId, unitId, calculationDate, configs.hoa);
    logDebug(`   📋 HOA: ${hoaBills.length} bills loaded`);
    
    // Aggregate Water bills (only if client has water service)
    // Issue #60: Skip water bill fetch for clients without water service (e.g., MTC)
    const waterBills = configs.hasWaterService
      ? await this._getWaterBills(clientId, unitId, calculationDate, configs.water)
      : [];
    logDebug(`   📋 Water: ${waterBills.length} bills loaded${!configs.hasWaterService ? ' (no water service)' : ''}`);
    
    // Combine all bills
    const allBills = [...hoaBills, ...waterBills];
    logDebug(`✅ [UNIFIED WRAPPER] Total bills aggregated: ${allBills.length} (HOA: ${hoaBills.length}, Water: ${waterBills.length})`);
    
    return {
      allBills,
      hoaBills,
      waterBills,
      configs
    };
  }

  /**
   * Load a dues document for a specific year
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {number} year - Fiscal year
   * @returns {Promise<object|null>} Dues document data or null if not found
   */
  async _loadDuesDocument(clientId, unitId, year) {
    const duesRef = this.db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    const duesSnap = await duesRef.get();
    
    if (!duesSnap.exists) {
      return null;
    }
    
    return duesSnap.data();
  }

  /**
   * Get unpaid bills from a single year's dues document
   * 
   * @private
   * @param {object} duesDoc - Dues document data
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {number} year - Fiscal year
   * @param {object} config - HOA billing configuration
   * @param {Date} calculationDate - Date for penalty calculations
   * @returns {Promise<Array>} Array of unpaid bills
   */
  async _getUnpaidBillsFromYear(duesDoc, clientId, unitId, year, config, calculationDate) {
    // Convert HOA dues monthly array to bills format
    const bills = this._convertHOADuesToBills(duesDoc, clientId, unitId, year, config);
    
    // Calculate penalties in-memory for payment date
    const billsWithPenalties = await this._calculateHOAPenaltiesInMemory(bills, calculationDate, config);
    
    // Filter to unpaid bills only
    return billsWithPenalties.filter(b => b.status !== 'paid');
  }

  /**
   * Perform full backward scan for unpaid bills across multiple years
   * Stops when it finds a year with priorYearClosed flag set to true
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {number} startYear - Starting fiscal year (most recent)
   * @param {object} config - HOA billing configuration
   * @param {Date} calculationDate - Date for penalty calculations
   * @returns {Promise<Array>} Array of unpaid bills from all scanned years
   */
  async _fullLookbackScan(clientId, unitId, startYear, config, calculationDate) {
    const MINIMUM_YEAR = startYear - 5; // Safety limit
    let allUnpaidBills = [];
    let year = startYear;
    
    // Get current year unpaid bills first
    const currentDuesDoc = await this._loadDuesDocument(clientId, unitId, year);
    if (!currentDuesDoc) {
      logDebug(`   📭 [HOA] No dues document for year ${year}`);
      return [];
    }
    
    const currentYearBills = await this._getUnpaidBillsFromYear(
      currentDuesDoc, 
      clientId, 
      unitId, 
      year, 
      config, 
      calculationDate
    );
    
    // Check if month 0 is unpaid - only scan backward if it is
    const month0Unpaid = currentYearBills.find(bill => 
      bill._hoaMetadata?.monthIndex === 0
    );
    
    // Add current year bills
    allUnpaidBills = [...currentYearBills];
    
    // Only scan backward if month 0 is unpaid
    if (!month0Unpaid) {
      logDebug(`   🛑 [HOA] Month 0 is paid in year ${year}, no lookback needed`);
      return allUnpaidBills;
    }
    
    logDebug(`   📅 [HOA] Month 0 is unpaid, scanning prior years`);
    
    // Scan backward through prior years
    year = startYear - 1;
    while (year >= MINIMUM_YEAR) {
      const duesDoc = await this._loadDuesDocument(clientId, unitId, year);
      
      if (!duesDoc) {
        logDebug(`   📭 [HOA] No dues document for year ${year}, stopping`);
        break;
      }
      
      // Check if THIS year's prior year is closed
      if (duesDoc.priorYearClosed) {
        logDebug(`   🔒 [HOA] Year ${year-1} is closed, stopping lookback`);
        // Get unpaid bills from THIS year and stop
        const yearBills = await this._getUnpaidBillsFromYear(duesDoc, clientId, unitId, year, config, calculationDate);
        
        // Scan backward from month 11 to 0, stop at first paid bill
        const priorUnpaidBills = [];
        for (let monthIndex = 11; monthIndex >= 0; monthIndex--) {
          const bill = yearBills.find(b => b._hoaMetadata?.monthIndex === monthIndex);
          
          if (!bill) continue;
          
          // Stop at first paid bill
          if (bill.status === 'paid' && bill.paidAmount > 0) {
            logDebug(`   🛑 [HOA] Stopping at paid bill: Month ${monthIndex} (${bill.period})`);
            break;
          }
          
          // Add unpaid bills to collection
          if (bill.status === 'unpaid') {
            priorUnpaidBills.unshift(bill); // Add to beginning to maintain chronological order
          }
        }
        
        if (priorUnpaidBills.length > 0) {
          allUnpaidBills = [...priorUnpaidBills, ...allUnpaidBills];
        }
        break;
      }
      
      // Get unpaid bills from this year
      const yearBills = await this._getUnpaidBillsFromYear(duesDoc, clientId, unitId, year, config, calculationDate);
      
      // Scan backward from month 11 to 0, stop at first paid bill
      const priorUnpaidBills = [];
      for (let monthIndex = 11; monthIndex >= 0; monthIndex--) {
        const bill = yearBills.find(b => b._hoaMetadata?.monthIndex === monthIndex);
        
        if (!bill) continue;
        
        // Stop at first paid bill
        if (bill.status === 'paid' && bill.paidAmount > 0) {
          logDebug(`   🛑 [HOA] Stopping at paid bill: Month ${monthIndex} (${bill.period})`);
          break;
        }
        
        // Add unpaid bills to collection
        if (bill.status === 'unpaid') {
          priorUnpaidBills.unshift(bill); // Add to beginning to maintain chronological order
        }
      }
      
      if (priorUnpaidBills.length > 0) {
        logDebug(`   📊 [HOA] Found ${priorUnpaidBills.length} unpaid bills from year ${year}`);
        allUnpaidBills = [...priorUnpaidBills, ...allUnpaidBills];
      } else {
        logDebug(`   ℹ️  [HOA] No additional unpaid bills found in year ${year}`);
        break; // No unpaid bills, stop scanning
      }
      
      // Continue to prior year
      year--;
    }
    
    return allUnpaidBills;
  }

  /**
   * Get HOA bills with unified metadata
   * 
   * Uses internal HOA conversion functions directly since they need to be accessed
   * for the unified wrapper to work properly.
   * 
   * Optimized with priorYearClosed flag: when true, skips lookback entirely (fast path).
   * When false or undefined, runs full backward scan (slow path).
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Date} calculationDate - Date for penalty calculations
   * @param {object} config - HOA billing configuration
   * @returns {Array} HOA bills with unified metadata
   */
  async _getHOABills(clientId, unitId, calculationDate, config) {
    logDebug(`   🏠 [HOA] Loading bills for unit ${unitId}`);
    
    try {
      // Determine fiscal year from calculation date
      const fiscalYear = getFiscalYear(calculationDate, config.fiscalYearStartMonth || 1);
      
      // Load current year dues document
      const currentDuesDoc = await this._loadDuesDocument(clientId, unitId, fiscalYear);
      
      if (!currentDuesDoc) {
        logDebug(`   ⚠️  [HOA] No dues document found for ${unitId}/${fiscalYear}`);
        return [];
      }
      
      // FAST PATH: Prior year closed - only get current year bills
      if (currentDuesDoc.priorYearClosed) {
        logDebug(`   🚀 [HOA] Prior year closed - skipping lookback`);
        const unpaidBills = await this._getUnpaidBillsFromYear(
          currentDuesDoc, 
          clientId, 
          unitId, 
          fiscalYear, 
          config, 
          calculationDate
        );
        
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
        
        logDebug(`   ✅ [HOA] ${enhancedBills.length} unpaid bills with metadata (fast path)`);
        return enhancedBills;
      }
      
      // SLOW PATH: Must run full lookback
      logDebug(`   🔍 [HOA] Prior year NOT closed - running lookback`);
      const allUnpaidBills = await this._fullLookbackScan(
        clientId, 
        unitId, 
        fiscalYear, 
        config, 
        calculationDate
      );
      
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
      
      logDebug(`   ✅ [HOA] ${enhancedBills.length} unpaid bills with metadata (slow path)`);
      return enhancedBills;
      
    } catch (error) {
      logError(`   ❌ [HOA] Error loading bills:`, error);
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
    // Calculate the actual calendar month and year
    // Fiscal year naming rule: Fiscal year = calendar year of the last month (month 11) of that fiscal year
    // - January start: Last month (Dec) is in same calendar year → fiscal year = calendar year
    // - Other starts: Last month is in next calendar year → fiscal year = last month's year
    // This approach directly implements the business rule and is more self-documenting
    
    if (frequency === 'monthly') {
      // For monthly, each fiscal month has its own due date
      const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
      
      // Calculate what calendar year the last month (month 11) of this fiscal year is in
      const lastMonthFloor = Math.floor(((fiscalYearStartMonth - 1) + 11) / 12);
      // Calculate what calendar year the current month is in (base calculation)
      const currentMonthFloor = Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
      // Fiscal year = calendar year of last month, so adjust current month relative to that
      const calendarYear = fiscalYear + currentMonthFloor - lastMonthFloor;
      
      const dueDate = createDate(calendarYear, calendarMonth + 1, 1);
      return toISOString(dueDate);
    }
    
    if (frequency === 'quarterly') {
      // For quarterly, months share due dates by quarter
      const quarterStartFiscalMonth = Math.floor(fiscalMonthIndex / 3) * 3;
      const calendarMonth = ((fiscalYearStartMonth - 1) + quarterStartFiscalMonth) % 12;
      
      // Calculate what calendar year the last month (month 11) of this fiscal year is in
      const lastMonthFloor = Math.floor(((fiscalYearStartMonth - 1) + 11) / 12);
      // Calculate what calendar year the quarter start month is in (base calculation)
      const quarterStartFloor = Math.floor(((fiscalYearStartMonth - 1) + quarterStartFiscalMonth) / 12);
      // Fiscal year = calendar year of last month, so adjust quarter start relative to that
      const calendarYear = fiscalYear + quarterStartFloor - lastMonthFloor;
      
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
    
    logDebug(`      🔄 Converting HOA dues to bills: ${isQuarterly ? '4 quarters' : '12 fiscal months'}`);
    
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
          
          // Normalize payment data: derive basePaid/penaltyPaid from amount if not set
          // Legacy data only has 'amount', newer data has explicit basePaid/penaltyPaid
          const monthBasePaid = payment?.basePaid ?? Math.min(payment?.amount || 0, monthlyAmount);
          const monthPenaltyPaid = payment?.penaltyPaid ?? Math.max(0, (payment?.amount || 0) - monthlyAmount);
          
          quarterBasePaid += monthBasePaid;
          quarterPenaltyPaid += monthPenaltyPaid;
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
        
        // NOTE: *Owed fields are NOT stored - they are calculated on-demand by getter functions
        // This prevents stale data bugs when penaltyAmount is modified by penalty recalculation
        
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
          // NOTE: baseOwed, penaltyOwed, totalOwed NOT stored - use getter functions
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
      // Normalize payment data: derive basePaid/penaltyPaid from amount if not set
      // Legacy data only has 'amount', newer data has explicit basePaid/penaltyPaid
      const totalPaid = payment?.amount || 0;
      const basePaid = payment?.basePaid ?? Math.min(totalPaid, monthlyAmount);
      const penaltyPaid = payment?.penaltyPaid ?? Math.max(0, totalPaid - monthlyAmount);
      
      const baseCharge = monthlyAmount;
      const penaltyAmount = 0; // Calculated fresh later
      const totalDue = baseCharge + penaltyAmount;
      
      // NOTE: *Owed fields are NOT stored - they are calculated on-demand by getter functions
      // This prevents stale data bugs when penaltyAmount is modified by penalty recalculation
      
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
        // NOTE: baseOwed, penaltyOwed, totalOwed NOT stored - use getter functions
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
    
    logDebug(`      ✅ Converted ${bills.length} ${isQuarterly ? 'quarters' : 'months'} to bills`);
    return bills;
  }

  /**
   * Calculate penalties in-memory for HOA bills
   * (Replicated from hoaDuesController since it's not exported)
   * 
   * @private
   */
  async _calculateHOAPenaltiesInMemory(bills, asOfDate, config) {
    logDebug(`      💰 Calculating penalties for ${bills.length} bills as of ${asOfDate.toISOString()}`);
    
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
    logDebug(`      ✅ Recalculated penalties (grouped): Total $${centavosToPesos(totalPenalties)}, ${result.billsUpdated} bills updated`);
    
    // NOTE: No need to recalculate *Owed fields - getter functions calculate them on-demand
    // from the updated penaltyAmount field. This eliminates stale data bugs.
    return result.updatedBills;
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
    logDebug(`   💧 [WATER] Loading bills for unit ${unitId}`);
    
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
      
      logDebug(`   ✅ [WATER] ${enhancedBills.length} unpaid bills with metadata`);
      return enhancedBills;
      
    } catch (error) {
      logError(`   ❌ [WATER] Error loading bills:`, error);
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
    
    // Water bills are manually generated on demand - if the document exists, it's payable
    // No such thing as "future" water bill - they're generated when ready to bill
    if (moduleType === 'water' && isFuture) {
      return 4; // Treat as current water - it exists, so it's payable
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
    logDebug(`🔢 [UNIFIED WRAPPER] Calculating priorities for ${bills.length} bills`);
    
    // 15-day buffer for HOA bills (allows payment preview before quarter starts)
    const HOA_BUFFER_DAYS = 15;
    
    // Filter bills to include:
    // 1. All past-due and current bills (existing behavior)
    // 2. Future HOA bills within 15-day buffer (NEW)
    // 3. Exclude future water bills (they're post-paid)
    const eligibleBills = bills.filter(bill => {
      const dueDate = new Date(bill.dueDate);
      const moduleType = bill._metadata?.moduleType;
      
      // Water bills: always include if document exists (manually generated = ready to pay)
      // No "future" concept for water bills - they're generated on demand
      if (moduleType === 'water') {
        return true;
      }
      
      // HOA bills: include if within 15-day buffer
      if (moduleType === 'hoa') {
        const bufferDate = new Date(dueDate);
        bufferDate.setDate(bufferDate.getDate() - HOA_BUFFER_DAYS);
        return currentDate >= bufferDate; // Current date is at or past buffer start
      }
      
      // Default: include if past due (fallback for unknown types)
      return dueDate <= currentDate;
    });
    
    logDebug(`   ℹ️  Filtered to ${eligibleBills.length} eligible bills (HOA buffer: ${HOA_BUFFER_DAYS} days)`);
    
    // Calculate priority for each eligible bill
    const billsWithPriority = eligibleBills.map(bill => ({
      ...bill,
      _metadata: {
        ...bill._metadata,
        priority: this._calculatePriority(bill, currentDate, fiscalYearStartMonth)
      }
    }));
    
    // Filter out any bills with priority 99 (safety valve - should not occur with current logic)
    // Note: Water bills no longer get priority 99; if a water bill exists, it's payable
    const payableBills = billsWithPriority.filter(b => b._metadata.priority < 99);
    if (billsWithPriority.length !== payableBills.length) {
      logDebug(`   ℹ️  Filtered out ${billsWithPriority.length - payableBills.length} bills with priority 99`);
    }
    
    // Sort by priority (then by due date for same priority)
    const sortedBills = this._sortBillsByPriority(payableBills);
    
    logDebug(`✅ [UNIFIED WRAPPER] Bills prioritized and sorted: ${sortedBills.length} payable bills`);
    logDebug(`   Priority breakdown:`, {
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
    logDebug(`🔄 [UNIFIED WRAPPER] Splitting distribution by module`);
    
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
    // Include ALL eligible bills (even with $0 payment) so Statement of Account shows upcoming bills
    (distribution.billPayments || []).forEach(payment => {
      // Include bills even if amountPaid is 0 - needed for Statement of Account to show upcoming bills
      // Only skip if amountPaid is null/undefined (shouldn't happen, but safety check)
      if (payment.amountPaid === null || payment.amountPaid === undefined) {
        return;
      }
      
      // Look up bill using the unique period (includes module prefix)
      // For $0 payments, metadata may be embedded in payment object
      const originalBill = billMap.get(payment.billPeriod);
      
      if (!originalBill && !payment._metadata) {
        logWarn(`   ⚠️  Could not find original bill for period: ${payment.billPeriod}`);
        return;
      }
      
      // Use metadata from payment object if available (for $0 payments), otherwise from originalBill
      const moduleType = payment._metadata?.moduleType || originalBill?._metadata?.moduleType;
      const displayPeriod = payment._originalPeriod || originalBill?._originalPeriod || payment.billPeriod.replace(`${moduleType}:`, '');
      
      // For $0 payments, use embedded metadata; otherwise use originalBill
      const billToUse = originalBill || {
        _metadata: payment._metadata,
        _hoaMetadata: payment._hoaMetadata,
        _originalPeriod: displayPeriod
      };
      
      if (moduleType === 'hoa') {
        // Add to HOA results
        result.hoa.billsPaid.push(payment);
        result.hoa.totalPaid = roundCurrency(result.hoa.totalPaid + (payment.amountPaid || 0));
        
        // Format for HOA-specific response (use original period without module prefix)
        const isQuarterly = billToUse._hoaMetadata?.isQuarterly;
        
        // Always include both due amounts and paid amounts for proper frontend display
        const baseDue = payment.totalBaseDue || 0;
        const penaltyDue = payment.totalPenaltyDue || 0;
        const totalDue = payment.totalDue || 0;
        const basePaid = payment.baseChargePaid || 0;
        const penaltyPaid = payment.penaltyPaid || 0;
        const totalPaid = payment.amountPaid || 0;
        
        // CRITICAL: Get remaining amounts from original bill (from generateUPCData)
        // These reflect prior payments, not just this payment preview
        const baseRemainingCentavos = originalBill?.remainingCentavos ?? billToUse.remainingCentavos ?? 0;
        const penaltyRemainingCentavos = originalBill?.penaltyRemainingCentavos ?? billToUse.penaltyRemainingCentavos ?? 0;
        const totalRemainingCentavos = originalBill?.totalRemainingCentavos ?? billToUse.totalRemainingCentavos ?? 0;
        const billStatus = originalBill?.status ?? billToUse.status ?? 'unpaid';
        const isPartial = billStatus === 'partial';
        
        const hoaMonth = {
          month: billToUse._hoaMetadata?.month,
          monthIndex: billToUse._metadata?.monthIndex,
          billPeriod: displayPeriod,
          dueDate: originalBill?.dueDate || payment.dueDate,  // Payment date for auto-pay
          // Due amounts (always present) - ORIGINAL amounts for display
          baseDue: baseDue,
          penaltyDue: penaltyDue,
          totalDue: totalDue,
          // Remaining amounts (reflects prior payments) - for actual payment calculation
          remainingDue: centavosToPesos(totalRemainingCentavos),
          baseRemaining: centavosToPesos(baseRemainingCentavos),
          penaltyRemaining: centavosToPesos(penaltyRemainingCentavos),
          // Paid amounts (0 when no payment, actual amounts when payment > 0)
          basePaid: basePaid,
          penaltyPaid: penaltyPaid,
          totalPaid: totalPaid,
          status: payment.newStatus || billStatus,
          isPartial: isPartial,
          priority: billToUse._metadata?.priority,  // For frontend sorting
          isQuarterly: isQuarterly,
          quarterIndex: billToUse._hoaMetadata?.quarterIndex,
          monthsInQuarter: billToUse._hoaMetadata?.monthsInQuarter
        };
        
        logDebug(`   🎯 [HOA ${isQuarterly ? 'Quarter' : 'Month'}] ${displayPeriod}: monthIndex=${hoaMonth.monthIndex}${isQuarterly ? `, Q${hoaMonth.quarterIndex + 1}` : `, month=${hoaMonth.month}`}, remaining=$${hoaMonth.remainingDue}, isPartial=${isPartial}`);
        result.hoa.monthsAffected.push(hoaMonth);
        
      } else if (moduleType === 'water') {
        // Add to Water results
        result.water.billsPaid.push(payment);
        result.water.totalPaid = roundCurrency(result.water.totalPaid + (payment.amountPaid || 0));
        
        // Format for Water-specific response (use original period without module prefix)
        // Always include both due amounts and paid amounts for proper frontend display
        const waterBaseDue = payment.totalBaseDue || 0;
        const waterPenaltyDue = payment.totalPenaltyDue || 0;
        const waterTotalDue = payment.totalDue || 0;
        const waterBasePaid = payment.baseChargePaid || 0;
        const waterPenaltyPaid = payment.penaltyPaid || 0;
        const waterTotalPaid = payment.amountPaid || 0;
        
        // CRITICAL: Get remaining amounts from original bill (from generateUPCData)
        // These reflect prior payments, not just this payment preview
        const waterBaseRemainingCentavos = originalBill?.remainingCentavos ?? billToUse.remainingCentavos ?? 0;
        const waterPenaltyRemainingCentavos = originalBill?.penaltyRemainingCentavos ?? billToUse.penaltyRemainingCentavos ?? 0;
        const waterTotalRemainingCentavos = originalBill?.totalRemainingCentavos ?? billToUse.totalRemainingCentavos ?? 0;
        const waterBillStatus = originalBill?.status ?? billToUse.status ?? 'unpaid';
        const waterIsPartial = waterBillStatus === 'partial';
        
        result.water.billsAffected.push({
          billPeriod: displayPeriod,
          dueDate: originalBill?.dueDate || payment.dueDate,  // Payment date for auto-pay
          // Due amounts (always present) - ORIGINAL amounts for display
          baseDue: waterBaseDue,
          penaltyDue: waterPenaltyDue,
          totalDue: waterTotalDue,
          // Remaining amounts (reflects prior payments) - for actual payment calculation
          remainingDue: centavosToPesos(waterTotalRemainingCentavos),
          baseRemaining: centavosToPesos(waterBaseRemainingCentavos),
          penaltyRemaining: centavosToPesos(waterPenaltyRemainingCentavos),
          // Paid amounts (0 when no payment, actual amounts when payment > 0)
          basePaid: waterBasePaid,
          penaltyPaid: waterPenaltyPaid,
          totalPaid: waterTotalPaid,
          status: payment.newStatus || waterBillStatus,
          isPartial: waterIsPartial,
          priority: billToUse._metadata?.priority  // For frontend sorting
        });
      }
    });
    
    logInfo(`✅ [UNIFIED WRAPPER] Distribution split complete`);
    logDebug(`   HOA: ${result.hoa.billsPaid.length} bills, Total: $${result.hoa.totalPaid}`);
    logDebug(`   Water: ${result.water.billsPaid.length} bills, Total: $${result.water.totalPaid}`);
    
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
   * Generate penalty waiver notes
   * 
   * Format: "Penalties waived: Q1 2026 ($1,532.59) - Property sale"
   * 
   * @private
   * @param {Array} waivedPenalties - Array of waived penalties
   * @returns {string|null} Waiver notes string or null if no waivers
   */
  _generateWaiverNotes(waivedPenalties) {
    if (!waivedPenalties || waivedPenalties.length === 0) {
      return null;
    }
    
    const waiverLines = waivedPenalties.map(waiver => {
      // Frontend sends amount in pesos, not centavos
      const amountStr = `$${waiver.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const notesStr = waiver.notes ? ` (${waiver.notes})` : '';
      return `${waiver.billId} (${amountStr}) - ${waiver.reason}${notesStr}`;
    });
    
    return `Penalties waived: ${waiverLines.join('; ')}`;
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
    
    // Issue #60/#161: Check if client has water service via activities menu
    // AVII has WaterBills activity enabled, MTC does not
    const hasWaterService = await hasActivity(this.db, clientId, 'WaterBills');
    
    // Note: Each module maintains separate config
    // Return both for module-specific penalty calculations
    return {
      hoa: hoaConfig,
      water: waterConfig,
      // Client-level fiscal year config (system-wide)
      fiscalYearStartMonth: hoaConfig.fiscalYearStartMonth || 1,
      // Issue #60/#161: Flag indicating whether client has water service
      hasWaterService
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
        // Quarterly payment - pass as single entry, distribution handled below
        // where we have access to existing payment data
        const quarterIndex = entry.quarterIndex || 0;
        const quarterPaymentEntry = {
          isQuarterly: true,
          quarterIndex: quarterIndex,
          startMonth: quarterIndex * 3, // 0, 3, 6, 9
          basePaid: pesosToCentavos(entry.basePaid), // Total base paid for quarter
          penaltyPaid: pesosToCentavos(entry.penaltyPaid), // Total penalty paid
          notes: notes
        };
        entriesByYear[year].push(quarterPaymentEntry);
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
        logWarn(`HOA dues document not found for ${unitId}/${year} - skipping`);
        continue;
      }
      
      const duesData = duesDoc.data();
      const currentPayments = Array.isArray(duesData.payments) ? duesData.payments : [];
      
      // Update payment entries - MERGE logic for partial payment support
      const updatedPayments = [...currentPayments];
      const monthlyAmount = duesData.scheduledAmount || 0; // Base monthly charge
      
      paymentsData.forEach(paymentEntry => {
        // Handle quarterly vs monthly entries differently
        if (paymentEntry.isQuarterly) {
          // QUARTERLY PAYMENT: Distribute based on what each month STILL OWES
          const startMonth = paymentEntry.startMonth;
          const quarterNum = paymentEntry.quarterIndex + 1;
          
          // Calculate what each month in the quarter still owes
          const monthOwed = [];
          let totalOwed = 0;
          for (let i = 0; i < 3; i++) {
            const monthIdx = startMonth + i;
            const existingPayment = updatedPayments[monthIdx] || { basePaid: 0 };
            const owed = Math.max(0, monthlyAmount - (existingPayment.basePaid || 0));
            monthOwed.push({ monthIndex: monthIdx, owed: owed });
            totalOwed += owed;
          }
          
          logDebug(`      📊 Q${quarterNum} distribution: Total owed ${totalOwed} centavos, Payment ${paymentEntry.basePaid} centavos`);
          logDebug(`         Month details:`, monthOwed.map(m => `M${m.monthIndex}: owes ${m.owed}`).join(', '));
          
          // Distribute payment proportionally based on what each month owes
          let remainingBasePaid = paymentEntry.basePaid;
          let remainingPenaltyPaid = paymentEntry.penaltyPaid;
          let penaltyApplied = false;
          
          monthOwed.forEach((monthData, i) => {
            const monthIndex = monthData.monthIndex;
            const monthOwedAmount = monthData.owed;
            
            // Skip months that don't owe anything
            if (monthOwedAmount <= 0 && remainingBasePaid <= 0) {
              logDebug(`         M${monthIndex}: Already paid, skipping`);
              return;
            }
            
            // Calculate how much to allocate to this month
            // Allocate up to what the month owes, or remaining payment if less
            const baseAllocation = Math.min(monthOwedAmount, remainingBasePaid);
            remainingBasePaid -= baseAllocation;
            
            // Apply penalty to first month that gets a base allocation
            let penaltyAllocation = 0;
            if (!penaltyApplied && baseAllocation > 0 && remainingPenaltyPaid > 0) {
              penaltyAllocation = remainingPenaltyPaid;
              remainingPenaltyPaid = 0;
              penaltyApplied = true;
            }
            
            // Skip if nothing to allocate
            if (baseAllocation <= 0 && penaltyAllocation <= 0) {
              return;
            }
            
            // Get existing payment or initialize with zeros
            const existingPayment = updatedPayments[monthIndex] || {
              amount: 0,
              basePaid: 0,
              penaltyPaid: 0,
              notes: []
            };
            
            // ACCUMULATE amounts
            const newBasePaid = (existingPayment.basePaid || 0) + baseAllocation;
            const newPenaltyPaid = (existingPayment.penaltyPaid || 0) + penaltyAllocation;
            const newAmount = newBasePaid + newPenaltyPaid;
            
            // Calculate status
            let status;
            if (newBasePaid >= monthlyAmount) {
              status = 'paid';
            } else if (newAmount > 0) {
              status = 'partial';
            } else {
              status = 'unpaid';
            }
            
            // Build notes entry
            const noteEntry = createNotesEntry({
              transactionId: transactionId,
              timestamp: paymentDate,
              text: (paymentEntry.notes || 'Payment') + ` (Q${quarterNum} Month ${i + 1}/3)`,
              amount: baseAllocation + penaltyAllocation,
              basePaid: baseAllocation,
              penaltyPaid: penaltyAllocation
            });
            
            // Merge notes arrays
            const existingNotes = getNotesArray(existingPayment.notes);
            const mergedNotes = [...existingNotes, noteEntry];
            
            // Update payment entry
            updatedPayments[monthIndex] = {
              amount: newAmount,
              basePaid: newBasePaid,
              penaltyPaid: newPenaltyPaid,
              status: status,
              date: paymentDate,
              paid: status === 'paid',
              reference: transactionId,
              paymentMethod: paymentMethod,
              notes: mergedNotes
            };
            
            logDebug(`         M${monthIndex}: Allocated base ${baseAllocation} + penalty ${penaltyAllocation} → status: ${status}`);
          });
          
        } else {
          // MONTHLY PAYMENT: Original logic
          const monthIndex = paymentEntry.month - 1; // Convert 1-based to 0-based
          
          if (monthIndex < 0 || monthIndex > 11) {
            logWarn(`Invalid month index ${monthIndex}, skipping`);
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
          let status;
          if (newBasePaid >= monthlyAmount && newPenaltyPaid >= 0) {
            status = 'paid';
          } else if (newAmount > 0) {
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
            amount: newAmount,
            basePaid: newBasePaid,
            penaltyPaid: newPenaltyPaid,
            status: status,
            date: paymentDate,
            paid: status === 'paid',
            reference: transactionId,
            paymentMethod: paymentMethod,
            notes: mergedNotes
          };
        }
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
      
      logDebug(`      📅 HOA batch update prepared for year ${year}: ${paymentsData.length} months`);
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
        logWarn(`Water bill ${billId} not found - skipping`);
        continue;
      }
      
      const currentBill = billDoc.data()?.bills?.units?.[unitId];
      if (!currentBill) {
        logWarn(`Unit ${unitId} not found in water bill ${billId} - skipping`);
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
      
      logDebug(`      💧 Water batch update prepared for ${billId}: ${billData.totalPaid} pesos`);
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
    
    const currentUnitData = allCreditBalances[unitId] || { history: [] };
    const creditChangeCentavos = pesosToCentavos((creditData.added || 0) - (creditData.used || 0));
    
    // Calculate current balance using getter (always fresh)
    const currentBalanceCentavos = getCreditBalance(currentUnitData);
    const newBalanceCentavos = currentBalanceCentavos + creditChangeCentavos;
    
    // Validate balance
    if (newBalanceCentavos < 0) {
      throw new Error(`Credit balance cannot be negative: ${newBalanceCentavos} centavos`);
    }
    
    // Create history entry (clean - no stale balance fields)
    const historyEntry = createCreditHistoryEntry({
      amount: creditChangeCentavos,
      transactionId: transactionId,
      notes: creditData.added > 0 
        ? `Overpayment of ${formatCurrency(creditChangeCentavos)} added to credit`
        : `Credit of ${formatCurrency(Math.abs(creditChangeCentavos))} applied to payment`,
      type: creditData.added > 0 ? 'credit_added' : 'credit_used'
    });
    
    const updatedHistory = [...(currentUnitData.history || []), historyEntry];
    
    // Update the credit balances document
    // DO NOT write creditBalance field - it becomes stale
    const now = getNow();
    const fiscalYear = getFiscalYear(now, 7); // AVII uses July start (TODO: get from client config)
    allCreditBalances[unitId] = {
      lastChange: {
        year: fiscalYear.toString(),
        historyIndex: updatedHistory.length - 1,
        timestamp: now.toISOString()
      },
      history: updatedHistory
    };
    
    batch.set(creditBalancesRef, allCreditBalances);
    
    logDebug(`      💰 Credit balance prepared: ${currentBalanceCentavos} → ${newBalanceCentavos} centavos ($${(creditChangeCentavos/100).toFixed(2)} change)`);
  }
}

/**
 * Export singleton instance
 */
export const unifiedPaymentWrapper = new UnifiedPaymentWrapper();


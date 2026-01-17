/**
 * Generate UPC Data Service
 * 
 * Created: 2026-01-17
 * Task: Issue #150 - Task 2B
 * 
 * PURPOSE:
 * Generates UPC-specific projection from raw data.
 * UPC shows per-bill remaining for payment application.
 * This is a DIFFERENT projection than Statement (running balance).
 * 
 * ARCHITECTURE (Per SAMS Accounting & Payment Architecture):
 * - SofA and UPC are different VIEWS of the same underlying data
 * - Bill documents are AUTHORITATIVE for UPC per-bill remaining
 * - Credits are FLOATING until consumed (not pre-applied)
 * - Discrepancies are SURFACED, not auto-corrected
 * 
 * KEY DIFFERENCES FROM unifiedPaymentWrapper.previewUnifiedPayment():
 * - This function READS bill documents as authoritative source
 * - previewUnifiedPayment CALCULATES what to pay
 * - This function is for DISPLAY of current bill state
 * - previewUnifiedPayment is for PAYMENT PREVIEW
 */

import { getNow } from '../../shared/services/DateService.js';
import { getDb } from '../firebase.js';
import { getCreditBalance } from '../../shared/services/CreditBalanceService.js';
import { getFiscalYear } from '../utils/fiscalYearUtils.js';
import { centavosToPesos, pesosToCentavos } from '../utils/currencyUtils.js';
import { queryTransactions } from '../controllers/transactionsController.js';
import { getHOABillingConfig } from '../controllers/hoaDuesController.js';

/**
 * Generate UPC-specific projection from raw data.
 * 
 * UPC shows per-bill remaining for payment application.
 * This is a DIFFERENT projection than Statement (running balance).
 * 
 * @param {Object} options
 * @param {string} options.clientId - Client ID
 * @param {string} options.unitId - Unit ID
 * @param {Date} options.asOfDate - Date for calculations (optional, defaults to now)
 * @param {Array} options.waivedPenalties - Penalties to waive [{billId, amount, reason}]
 * @param {Array} options.excludedBills - Bills to exclude [billId, ...]
 * @returns {Object} UPC projection
 */
export async function generateUPCData({
  clientId,
  unitId,
  asOfDate = null,
  waivedPenalties = [],
  excludedBills = []
}) {
  const db = await getDb();
  const effectiveDate = asOfDate || getNow();
  
  console.log(`📊 [generateUPCData] Starting for ${clientId}/${unitId} as of ${effectiveDate.toISOString()}`);
  
  // 1. GATHER: Collect raw data (same sources as Statement)
  const rawData = await gatherRawData(db, clientId, unitId, effectiveDate);
  
  // 2. COMPUTE: Per-bill remaining (UPC-specific)
  const bills = computePerBillRemaining(rawData, waivedPenalties, excludedBills);
  
  // 3. DISCREPANCY: Per-bill diagnostic (bill docs vs transaction allocations)
  const discrepancy = computeBillDiscrepancies(bills, rawData.transactions);
  
  // 4. CREDIT: Get floating credit balance
  const creditData = await getCreditBalance(clientId, unitId);
  const creditAvailable = creditData.creditBalance || 0; // In pesos
  
  // 6. Calculate total remaining
  const totalRemainingCentavos = bills.reduce((sum, b) => sum + (b.totalRemainingCentavos || 0), 0);
  
  console.log(`✅ [generateUPCData] Complete: ${bills.length} bills, total remaining ${centavosToPesos(totalRemainingCentavos)} pesos`);
  
  // 7. RETURN: UPC projection
  return {
    bills,
    totalRemaining: centavosToPesos(totalRemainingCentavos),
    totalRemainingCentavos,
    creditAvailable, // In pesos
    creditAvailableCentavos: pesosToCentavos(creditAvailable),
    discrepancy,
    asOfDate: effectiveDate.toISOString(),
    generatedAt: getNow().toISOString()
  };
}

/**
 * Gather raw data from same sources as Statement
 * 
 * @param {object} db - Firestore database instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {Date} asOfDate - Effective date for calculations
 * @returns {object} Raw data object
 */
async function gatherRawData(db, clientId, unitId, asOfDate) {
  console.log(`   📂 Gathering raw data...`);
  
  // Get client config for fiscal year
  const hoaConfig = await getHOABillingConfig(clientId);
  const fiscalYearStartMonth = hoaConfig.fiscalYearStartMonth || 7;
  const duesFrequency = hoaConfig.duesFrequency || 'monthly';
  const fiscalYear = getFiscalYear(asOfDate, fiscalYearStartMonth);
  
  console.log(`   📅 Fiscal year: ${fiscalYear}, Start month: ${fiscalYearStartMonth}, Frequency: ${duesFrequency}`);
  
  // Gather data in parallel
  const [hoaDues, waterBills, transactions] = await Promise.all([
    getHOADuesForUnit(db, clientId, unitId, fiscalYear, fiscalYearStartMonth, duesFrequency),
    getWaterBillsForUnit(db, clientId, unitId),
    getTransactionsForUnit(db, clientId, unitId, fiscalYear)
  ]);
  
  console.log(`   ✅ Gathered: ${hoaDues.length} HOA dues, ${waterBills.length} water bills, ${transactions.length} transactions`);
  
  return {
    hoaDues,
    waterBills,
    transactions,
    config: {
      fiscalYearStartMonth,
      fiscalYear,
      duesFrequency: hoaConfig.duesFrequency || 'monthly',
      penaltyRate: hoaConfig.penaltyRate,
      penaltyDays: hoaConfig.penaltyDays
    }
  };
}

/**
 * Get HOA Dues for a unit from Firestore
 * 
 * @param {object} db - Firestore database instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} fiscalYear - Fiscal year
 * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
 * @param {string} duesFrequency - Dues frequency from client config ('monthly' or 'quarterly')
 * @returns {Array} HOA dues array
 */
async function getHOADuesForUnit(db, clientId, unitId, fiscalYear, fiscalYearStartMonth, duesFrequency = 'monthly') {
  const dues = [];
  
  // Load current and prior year (for lookback)
  const yearsToCheck = [fiscalYear, fiscalYear - 1];
  
  for (const year of yearsToCheck) {
    const duesRef = db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    const duesDoc = await duesRef.get();
    if (!duesDoc.exists) continue;
    
    const duesData = duesDoc.data();
    const payments = duesData.payments || [];
    const scheduledAmount = duesData.scheduledAmount || 0; // Monthly amount in centavos
    
    // Use frequency from client config (passed as parameter)
    const isQuarterly = duesFrequency === 'quarterly';
    
    if (isQuarterly) {
      // Generate quarterly bills
      for (let quarter = 0; quarter < 4; quarter++) {
        const quarterAmount = scheduledAmount * 3; // 3 months per quarter
        const quarterStartMonth = quarter * 3;
        
        // Sum payments for this quarter
        let quarterPaid = 0;
        let quarterBasePaid = 0;
        let quarterPenaltyPaid = 0;
        
        for (let m = quarterStartMonth; m < quarterStartMonth + 3; m++) {
          const payment = payments[m];
          if (payment) {
            quarterPaid += payment.amount || 0;
            quarterBasePaid += payment.basePaid || Math.min(payment.amount || 0, scheduledAmount);
            quarterPenaltyPaid += payment.penaltyPaid || 0;
          }
        }
        
        const billId = `${year}-Q${quarter + 1}`;
        const dueDate = calculateQuarterDueDate(quarterStartMonth, year, fiscalYearStartMonth);
        
        dues.push({
          billId,
          billType: 'hoa',
          fiscalYear: year,
          quarter: quarter + 1,
          isQuarterly: true,
          description: `HOA Dues Q${quarter + 1} ${year}`,
          originalCentavos: quarterAmount,
          paidCentavos: quarterPaid,
          basePaidCentavos: quarterBasePaid,
          penaltyPaidCentavos: quarterPenaltyPaid,
          penaltyCentavos: duesData[`q${quarter + 1}Penalty`] || 0,
          dueDate: dueDate,
          payments: payments.slice(quarterStartMonth, quarterStartMonth + 3)
        });
      }
    } else {
      // Generate monthly bills
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const payment = payments[monthIndex] || {};
        const billId = `${year}-${String(monthIndex).padStart(2, '0')}`;
        const dueDate = calculateMonthDueDate(monthIndex, year, fiscalYearStartMonth);
        
        dues.push({
          billId,
          billType: 'hoa',
          fiscalYear: year,
          monthIndex,
          isQuarterly: false,
          description: `HOA Dues ${getMonthName(monthIndex, fiscalYearStartMonth)} ${getCalendarYear(monthIndex, year, fiscalYearStartMonth)}`,
          originalCentavos: scheduledAmount,
          paidCentavos: payment.amount || 0,
          basePaidCentavos: payment.basePaid || Math.min(payment.amount || 0, scheduledAmount),
          penaltyPaidCentavos: payment.penaltyPaid || 0,
          penaltyCentavos: payment.penaltyAmount || 0,
          dueDate: dueDate,
          payment: payment
        });
      }
    }
  }
  
  return dues;
}

/**
 * Get Water Bills for a unit from Firestore
 * 
 * @param {object} db - Firestore database instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @returns {Array} Water bills array
 */
async function getWaterBillsForUnit(db, clientId, unitId) {
  const bills = [];
  
  const billsSnapshot = await db.collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills')
    .orderBy('__name__')
    .get();
  
  billsSnapshot.forEach(doc => {
    const billData = doc.data();
    const unitBill = billData.bills?.units?.[unitId];
    
    if (unitBill) {
      const billId = doc.id;
      
      bills.push({
        billId,
        billType: 'water',
        description: `Water Bill ${billId}`,
        originalCentavos: unitBill.currentCharge || unitBill.totalAmount || 0,
        paidCentavos: unitBill.paidAmount || 0,
        basePaidCentavos: unitBill.basePaid || 0,
        penaltyCentavos: unitBill.penaltyAmount || 0,
        penaltyPaidCentavos: unitBill.penaltyPaid || 0,
        dueDate: billData.dueDate,
        status: unitBill.status,
        consumption: unitBill.totalConsumption || unitBill.consumption || 0
      });
    }
  });
  
  return bills;
}

/**
 * Get transactions for a unit
 * 
 * @param {object} db - Firestore database instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} fiscalYear - Fiscal year for filtering
 * @returns {Array} Transactions array
 */
async function getTransactionsForUnit(db, clientId, unitId, fiscalYear) {
  try {
    // Query all transactions for client
    const allTxns = await queryTransactions(clientId, {});
    
    // Filter for this unit
    const unitTxns = allTxns.filter(t => {
      const tUnitId = t.unitId || '';
      const metaUnitId = t.metadata?.unitId;
      const allocUnitIds = (t.allocations || []).map(a => a.data?.unitId).filter(Boolean);
      
      return tUnitId === unitId || 
             tUnitId.startsWith(unitId + ' ') || 
             tUnitId.startsWith(unitId + '(') ||
             metaUnitId === unitId ||
             allocUnitIds.includes(unitId);
    });
    
    return unitTxns;
  } catch (error) {
    console.error(`   ❌ Error fetching transactions: ${error.message}`);
    return [];
  }
}

/**
 * Compute per-bill remaining from bill documents
 * Bill documents are AUTHORITATIVE for UPC
 * 
 * @param {object} rawData - Raw data from gatherRawData
 * @param {Array} waivedPenalties - Penalties to waive
 * @param {Array} excludedBills - Bills to exclude
 * @returns {Array} Bills with computed remaining amounts
 */
function computePerBillRemaining(rawData, waivedPenalties, excludedBills) {
  const bills = [];
  
  // Process HOA Bills
  for (const hoaBill of rawData.hoaDues) {
    if (excludedBills.includes(hoaBill.billId)) {
      console.log(`   ⏭️ Excluding HOA bill: ${hoaBill.billId}`);
      continue;
    }
    
    const originalCentavos = hoaBill.originalCentavos || 0;
    const totalPaidCentavos = hoaBill.paidCentavos || 0; // Total paid (base + penalty combined)
    let penaltyCentavos = hoaBill.penaltyCentavos || 0;
    
    // Handle penalty waiver
    const waiver = waivedPenalties.find(w => w.billId === hoaBill.billId);
    if (waiver) {
      const waiverCentavos = pesosToCentavos(waiver.amount);
      penaltyCentavos = Math.max(0, penaltyCentavos - waiverCentavos);
      console.log(`   🚫 Waived penalty for ${hoaBill.billId}: ${centavosToPesos(waiverCentavos)} pesos`);
    }
    
    // Calculate total due and remaining
    const totalDueCentavos = originalCentavos + penaltyCentavos;
    const totalRemainingCentavos = Math.max(0, totalDueCentavos - totalPaidCentavos);
    
    // Infer base vs penalty paid from total paid
    // Payment applies to base first, then penalty
    const basePaidCentavos = Math.min(totalPaidCentavos, originalCentavos);
    const baseRemainingCentavos = Math.max(0, originalCentavos - basePaidCentavos);
    const penaltyPaidCentavos = Math.max(0, totalPaidCentavos - originalCentavos);
    const penaltyRemainingCentavos = Math.max(0, penaltyCentavos - penaltyPaidCentavos);
    
    // Determine status based on total remaining
    let status;
    if (totalRemainingCentavos <= 0) {
      status = 'PAID';
    } else if (totalPaidCentavos > 0) {
      status = 'PARTIAL';
    } else {
      status = 'UNPAID';
    }
    
    bills.push({
      billId: hoaBill.billId,
      billType: 'hoa',
      description: hoaBill.description,
      originalCentavos,
      paidCentavos: basePaidCentavos,
      remainingCentavos: baseRemainingCentavos,
      penaltyCentavos,
      penaltyPaidCentavos,
      penaltyRemainingCentavos,
      totalPaidCentavos,
      totalRemainingCentavos,
      dueDate: hoaBill.dueDate,
      status,
      isQuarterly: hoaBill.isQuarterly || false,
      fiscalYear: hoaBill.fiscalYear
    });
  }
  
  // Process Water Bills
  for (const waterBill of rawData.waterBills) {
    if (excludedBills.includes(waterBill.billId)) {
      console.log(`   ⏭️ Excluding water bill: ${waterBill.billId}`);
      continue;
    }
    
    const originalCentavos = waterBill.originalCentavos || 0;
    const totalPaidCentavos = waterBill.paidCentavos || 0; // Total paid (base + penalty combined)
    let penaltyCentavos = waterBill.penaltyCentavos || 0;
    
    // Handle penalty waiver
    const waiver = waivedPenalties.find(w => w.billId === waterBill.billId);
    if (waiver) {
      const waiverCentavos = pesosToCentavos(waiver.amount);
      penaltyCentavos = Math.max(0, penaltyCentavos - waiverCentavos);
      console.log(`   🚫 Waived penalty for ${waterBill.billId}: ${centavosToPesos(waiverCentavos)} pesos`);
    }
    
    // Calculate total due and remaining
    const totalDueCentavos = originalCentavos + penaltyCentavos;
    const totalRemainingCentavos = Math.max(0, totalDueCentavos - totalPaidCentavos);
    
    // Infer base vs penalty paid from total paid
    // Payment applies to base first, then penalty
    const basePaidCentavos = Math.min(totalPaidCentavos, originalCentavos);
    const baseRemainingCentavos = Math.max(0, originalCentavos - basePaidCentavos);
    const penaltyPaidCentavos = Math.max(0, totalPaidCentavos - originalCentavos);
    const penaltyRemainingCentavos = Math.max(0, penaltyCentavos - penaltyPaidCentavos);
    
    // Determine status based on total remaining
    let status;
    if (totalRemainingCentavos <= 0) {
      status = 'PAID';
    } else if (totalPaidCentavos > 0) {
      status = 'PARTIAL';
    } else {
      status = 'UNPAID';
    }
    
    bills.push({
      billId: waterBill.billId,
      billType: 'water',
      description: waterBill.description,
      originalCentavos,
      paidCentavos: basePaidCentavos,
      remainingCentavos: baseRemainingCentavos,
      penaltyCentavos,
      penaltyPaidCentavos,
      penaltyRemainingCentavos,
      totalPaidCentavos,
      totalRemainingCentavos,
      dueDate: waterBill.dueDate,
      status,
      consumption: waterBill.consumption
    });
  }
  
  // Filter to only unpaid/partial bills (those with remaining amounts)
  const unpaidBills = bills.filter(b => b.totalRemainingCentavos > 0);
  
  console.log(`   📋 Computed ${unpaidBills.length} unpaid/partial bills (from ${bills.length} total)`);
  
  return unpaidBills;
}

/**
 * Compute per-bill discrepancy between bill document and transaction allocations.
 * This is DIAGNOSTIC - it tells you exactly which bill has a mismatch and why.
 * 
 * @param {Array} bills - Computed bills array
 * @param {Array} transactions - Transaction array
 * @returns {Object} Discrepancy info with per-bill details
 */
function computeBillDiscrepancies(bills, transactions) {
  console.log(`   🔍 Computing per-bill discrepancies (bill docs vs transaction allocations)...`);
  
  // Build map of allocated amounts per bill from transactions, with related txn IDs
  const allocatedMap = new Map(); // billId -> { totalCentavos, transactionIds }
  
  for (const tx of transactions) {
    if (!tx.allocations) continue;
    
    const txId = tx.transactionId || tx.id || tx._id || 'unknown';
    
    for (const alloc of tx.allocations) {
      const billId = extractBillIdFromAllocation(alloc);
      if (!billId) continue;
      
      const current = allocatedMap.get(billId) || { totalCentavos: 0, transactionIds: [] };
      // Allocations are stored in centavos (negative for payments)
      const allocAmount = Math.abs(alloc.amount || 0);
      current.totalCentavos += allocAmount;
      if (!current.transactionIds.includes(txId)) {
        current.transactionIds.push(txId);
      }
      allocatedMap.set(billId, current);
    }
  }
  
  // Find bills with mismatches
  const mismatches = [];
  
  for (const bill of bills) {
    const allocData = allocatedMap.get(bill.billId) || { totalCentavos: 0, transactionIds: [] };
    const billDocPaidCentavos = bill.totalPaidCentavos || 0;
    const transactionDerivedPaidCentavos = allocData.totalCentavos;
    
    // Calculate remaining based on each source
    const totalDueCentavos = (bill.originalCentavos || 0) + (bill.penaltyCentavos || 0);
    const billDocRemainingCentavos = Math.max(0, totalDueCentavos - billDocPaidCentavos);
    const transactionDerivedRemainingCentavos = Math.max(0, totalDueCentavos - transactionDerivedPaidCentavos);
    
    const deltaCentavos = billDocRemainingCentavos - transactionDerivedRemainingCentavos;
    
    // Only flag if variance > 1 centavo (to avoid floating point noise)
    if (Math.abs(deltaCentavos) > 1) {
      // Determine suspected cause
      let suspectedCause = 'unknown';
      if (transactionDerivedPaidCentavos > billDocPaidCentavos) {
        suspectedCause = 'bill document under-reports paid amount (missing allocation sync)';
      } else if (transactionDerivedPaidCentavos < billDocPaidCentavos) {
        suspectedCause = 'bill document over-reports paid amount (orphaned allocation or manual adjustment)';
      }
      if (allocData.transactionIds.length === 0) {
        suspectedCause = 'no transaction allocations found for bill';
      }
      
      console.warn(`   ⚠️ Mismatch: ${bill.billId} (${bill.billType}) ` +
        `delta=${centavosToPesos(deltaCentavos)} pesos ` +
        `[billDoc=${centavosToPesos(billDocRemainingCentavos)}, txns=${centavosToPesos(transactionDerivedRemainingCentavos)}]`);
      
      mismatches.push({
        billId: bill.billId,
        billType: bill.billType,
        expectedRemainingCentavos: billDocRemainingCentavos,
        transactionDerivedRemainingCentavos,
        deltaCentavos,
        suspectedCause,
        relatedTransactionIds: allocData.transactionIds
      });
    }
  }
  
  if (mismatches.length === 0) {
    console.log(`   ✅ No discrepancies detected - bill documents match transaction allocations`);
    return { detected: false };
  }
  
  console.log(`   ⚠️ ${mismatches.length} bill(s) have discrepancies`);
  
  // Return first mismatch as primary (most actionable), include all in array
  const primary = mismatches[0];
  return {
    detected: true,
    billId: primary.billId,
    billType: primary.billType,
    expectedRemainingCentavos: primary.expectedRemainingCentavos,
    transactionDerivedRemainingCentavos: primary.transactionDerivedRemainingCentavos,
    deltaCentavos: primary.deltaCentavos,
    suspectedCause: primary.suspectedCause,
    relatedTransactionIds: primary.relatedTransactionIds,
    // Include all mismatches if more than one
    allMismatches: mismatches.length > 1 ? mismatches : undefined
  };
}

/**
 * Extract bill ID from allocation object
 * 
 * @param {object} alloc - Allocation object
 * @returns {string|null} Bill ID or null
 */
function extractBillIdFromAllocation(alloc) {
  // HOA allocations
  if (alloc.type === 'hoa_month' || alloc.type === 'hoa-month') {
    const year = alloc.data?.year;
    const month = alloc.data?.month;
    const quarter = alloc.data?.quarter;
    
    if (year && quarter !== undefined) {
      return `${year}-Q${quarter + 1}`;
    }
    if (year && month !== undefined) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }
  
  // HOA penalty allocations
  if (alloc.type === 'hoa_penalty' || alloc.type === 'hoa-penalty') {
    const year = alloc.data?.year;
    const month = alloc.data?.month;
    const quarter = alloc.data?.quarter;
    
    if (year && quarter !== undefined) {
      return `${year}-Q${quarter + 1}`;
    }
    if (year && month !== undefined) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }
  
  // Water allocations
  if (alloc.type === 'water_consumption' || alloc.type === 'water-consumption' ||
      alloc.type === 'water_bill' || alloc.type === 'water-bill') {
    return alloc.data?.billPeriod || null;
  }
  
  // Water penalty allocations
  if (alloc.type === 'water_penalty' || alloc.type === 'water-penalty') {
    return alloc.data?.billPeriod || null;
  }
  
  return null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate quarter due date
 */
function calculateQuarterDueDate(quarterStartMonth, fiscalYear, fiscalYearStartMonth) {
  // Convert fiscal month to calendar month
  const calendarMonth = ((fiscalYearStartMonth - 1) + quarterStartMonth) % 12;
  const calendarYear = fiscalYear - (fiscalYearStartMonth > 1 ? 1 : 0) + 
    Math.floor(((fiscalYearStartMonth - 1) + quarterStartMonth) / 12);
  
  return new Date(calendarYear, calendarMonth, 1).toISOString();
}

/**
 * Calculate month due date
 */
function calculateMonthDueDate(monthIndex, fiscalYear, fiscalYearStartMonth) {
  const calendarMonth = ((fiscalYearStartMonth - 1) + monthIndex) % 12;
  const calendarYear = fiscalYear - (fiscalYearStartMonth > 1 ? 1 : 0) + 
    Math.floor(((fiscalYearStartMonth - 1) + monthIndex) / 12);
  
  return new Date(calendarYear, calendarMonth, 1).toISOString();
}

/**
 * Get month name from fiscal month index
 */
function getMonthName(fiscalMonthIndex, fiscalYearStartMonth) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
  return monthNames[calendarMonth];
}

/**
 * Get calendar year from fiscal month index
 */
function getCalendarYear(fiscalMonthIndex, fiscalYear, fiscalYearStartMonth) {
  return fiscalYear - (fiscalYearStartMonth > 1 ? 1 : 0) + 
    Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
}

/**
 * Generate UPC data in Statement-compatible format.
 * 
 * Returns the same shape as generateStatementData() for plug-compatibility
 * with the UPC modal, but all values come from bill-level facts and
 * creditBalance getters - NOT from ledger calculations.
 * 
 * @param {Object} options - Same options as generateUPCData
 * @returns {Object} Statement-compatible format with rows and summary
 */
export async function generateUPCDataForModal({
  clientId,
  unitId,
  asOfDate = null,
  waivedPenalties = [],
  excludedBills = []
}) {
  // Get bill-level data
  const upcData = await generateUPCData({
    clientId,
    unitId,
    asOfDate,
    waivedPenalties,
    excludedBills
  });
  
  // Transform bills into Statement-compatible rows
  // Each unpaid/partial bill becomes a "charge" row showing REMAINING amount
  const rows = [];
  let cumulativeBalance = 0;
  
  // Sort bills by due date for chronological order
  const sortedBills = [...upcData.bills].sort((a, b) => {
    const dateA = new Date(a.dueDate || 0);
    const dateB = new Date(b.dueDate || 0);
    return dateA - dateB;
  });
  
  for (const bill of sortedBills) {
    // Base charge row (remaining amount)
    const baseRemaining = centavosToPesos(bill.remainingCentavos || 0);
    if (baseRemaining > 0) {
      cumulativeBalance = Math.round((cumulativeBalance + baseRemaining) * 100) / 100;
      
      rows.push({
        type: 'charge',
        description: bill.description,
        date: bill.dueDate ? bill.dueDate.split('T')[0] : null,
        sortDate: bill.dueDate ? new Date(bill.dueDate).getTime() : 0,
        amount: baseRemaining,
        amountCentavos: bill.remainingCentavos || 0,
        charge: baseRemaining,
        payment: 0,
        balance: cumulativeBalance,
        category: bill.billType,
        billRef: {
          billId: bill.billId,
          billType: bill.billType,
          isQuarterly: bill.isQuarterly || false,
          fiscalYear: bill.fiscalYear,
          originalAmount: centavosToPesos(bill.originalCentavos || 0),
          paidAmount: centavosToPesos(bill.totalPaidCentavos || 0),
          remainingAmount: baseRemaining
        },
        chargeRef: bill.isQuarterly 
          ? { fiscalYear: bill.fiscalYear, quarter: bill.billId.split('-Q')[1] }
          : { fiscalYear: bill.fiscalYear, month: parseInt(bill.billId.split('-')[1]) + 1 },
        isPenalty: false,
        isAdjustment: false,
        status: bill.status
      });
    }
    
    // Penalty row (remaining penalty amount)
    const penaltyRemaining = centavosToPesos(bill.penaltyRemainingCentavos || 0);
    if (penaltyRemaining > 0) {
      cumulativeBalance = Math.round((cumulativeBalance + penaltyRemaining) * 100) / 100;
      
      rows.push({
        type: 'charge',
        description: `${bill.description} - Penalty`,
        date: bill.dueDate ? bill.dueDate.split('T')[0] : null,
        sortDate: bill.dueDate ? new Date(bill.dueDate).getTime() + 1 : 1, // +1 to sort after base
        amount: penaltyRemaining,
        amountCentavos: bill.penaltyRemainingCentavos || 0,
        charge: penaltyRemaining,
        payment: 0,
        balance: cumulativeBalance,
        category: bill.billType,
        billRef: {
          billId: bill.billId,
          billType: bill.billType,
          isQuarterly: bill.isQuarterly || false
        },
        penaltyRef: {
          billId: bill.billId,
          originalPenalty: centavosToPesos(bill.penaltyCentavos || 0),
          paidPenalty: centavosToPesos(bill.penaltyPaidCentavos || 0),
          remainingPenalty: penaltyRemaining
        },
        isPenalty: true,
        isAdjustment: false,
        status: bill.status
      });
    }
  }
  
  // Build summary from bill-level totals (NOT ledger calculations)
  const totalRemainingPesos = centavosToPesos(upcData.totalRemainingCentavos);
  
  return {
    rows,
    summary: {
      openingBalance: 0,  // UPC doesn't use opening balance concept
      finalBalance: totalRemainingPesos,
      amountDue: totalRemainingPesos,
      totalCharges: totalRemainingPesos,  // In UPC context, charges = remaining due
      totalPayments: 0,  // UPC shows what's due, not payment history
      // UPC-specific additions
      creditAvailable: upcData.creditAvailable,
      netDue: Math.max(0, totalRemainingPesos - upcData.creditAvailable),
      billCount: upcData.bills.length
    },
    // Include raw bill data for components that need it
    bills: upcData.bills,
    creditAvailable: upcData.creditAvailable,
    creditAvailableCentavos: upcData.creditAvailableCentavos,
    discrepancy: upcData.discrepancy,
    asOfDate: upcData.asOfDate,
    generatedAt: upcData.generatedAt
  };
}

export default { generateUPCData, generateUPCDataForModal };

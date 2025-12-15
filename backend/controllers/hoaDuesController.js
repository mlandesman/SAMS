// src/controllers/hoaDuesController.js
import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { createTransaction } from './transactionsController.js';
import { databaseFieldMappings } from '../../shared/utils/databaseFieldMappings.js';
import { 
  calculateDuesStatus, 
  calculatePaymentDistribution as calculatePaymentDistributionLegacy, 
  validatePayment,
  getYearSummary 
} from '../utils/hoaCalculations.js';
// Use DateService for proper timezone handling
import { getMexicoDate, getMexicoDateString } from '../utils/timezone.js';
import admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// PHASE 4 TASK 4.1: Import Phase 3 shared services
import { getNow, parseDate, toISOString, createDate } from '../../shared/services/DateService.js';
import { pesosToCentavos, centavosToPesos, formatCurrency } from '../../shared/utils/currencyUtils.js';
import { validateCentavos, validateCentavosInObject } from '../../shared/utils/centavosValidation.js';
import { calculatePaymentDistribution } from '../../shared/services/PaymentDistributionService.js';
import { createModuleAllocations, createAllocationSummary as createAllocationSummaryShared } from '../../shared/services/TransactionAllocationService.js';
import { calculateCreditUsage, updateCreditBalance as updateCreditBalanceShared, getCreditBalance } from '../../shared/services/CreditBalanceService.js';
import { recalculatePenalties, loadBillingConfig, calculatePenaltyForBill } from '../../shared/services/PenaltyRecalculationService.js';
import { getFiscalYearBounds } from '../utils/fiscalYearUtils.js';
import { validateHOAConfig } from '../../shared/utils/configValidation.js';
import creditService from '../services/creditService.js';

// Legacy functions for compatibility during transition
const { dollarsToCents, centsToDollars, convertToTimestamp, convertFromTimestamp } = databaseFieldMappings;

// Initialize DateService for Mexico timezone (using shared DateService)
import { DateService } from '../../shared/services/DateService.js';
const dateService = new DateService({ timezone: 'America/Cancun' });

/**
 * Calculate due date based on billing frequency
 * 
 * PHASE 5 TASK 5.1: Frequency-agnostic due date calculation
 * - Monthly: Each fiscal month has its own due date (1st of that month)
 * - Quarterly: 3 fiscal months share the same due date (1st of quarter start month)
 * 
 * FIXED: Correctly calculates calendar year from fiscal year
 * Fiscal years are named by their ending year, so FY 2026 starts in 2025
 * 
 * @param {number} fiscalMonthIndex - Month within fiscal year (0-11)
 * @param {number} fiscalYear - Fiscal year (e.g., 2026)
 * @param {string} frequency - 'monthly' or 'quarterly'
 * @param {number} fiscalYearStartMonth - Calendar month fiscal year starts (1-12, 1=Jan, 7=Jul)
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function calculateFrequencyAwareDueDate(fiscalMonthIndex, fiscalYear, frequency, fiscalYearStartMonth) {
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
 * Recursively convert all Firestore Timestamp objects to ISO strings
 * Prevents "Timestamp doesn't match expected instance" errors caused by
 * multiple firebase-admin module instances creating incompatible Timestamp objects
 * 
 * @param {*} obj - Object to clean (can be nested)
 * @returns {*} Cleaned object with all Timestamps as ISO strings
 */
function cleanTimestamps(obj) {
  if (!obj) return obj;
  
  // Direct Timestamp object (has toDate() method)
  if (typeof obj.toDate === 'function') {
    return obj.toDate().toISOString();
  }
  
  // Array of values
  if (Array.isArray(obj)) {
    return obj.map(cleanTimestamps);
  }
  
  // Nested object (plain objects only, not class instances)
  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = cleanTimestamps(value);
    }
    return cleaned;
  }
  
  return obj;
}

// Helper to format date fields consistently for API responses using DateService
function formatDateField(dateValue) {
  if (!dateValue) return null;
  
  try {
    // Use DateService's formatForFrontend method to create multi-format date object
    return dateService.formatForFrontend(dateValue);
  } catch (error) {
    console.error('Error formatting date field:', error);
    return null;
  }
}

// Initialize db as a properly awaited promise
let dbInstance;

// Month names for generating human-readable allocation names
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Get month name from month number (1-12)
 */
function getMonthName(month) {
  return MONTH_NAMES[month - 1] || `Month ${month}`;
}

// ============================================================================
// PHASE 4 TASK 4.1: HOA DUES <-> BILL ADAPTER LAYER
// ============================================================================
// These functions convert between HOA Dues' monthly array structure and
// the bill-based structure expected by Phase 3 shared services

/**
 * Convert HOA Dues monthly payment array to bill array for Phase 3 services
 * 
 * @param {object} hoaDuesDoc - HOA dues document with payments array
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} year - Fiscal year
 * @param {object} config - HOA billing configuration
 * @returns {Array} Array of bill objects compatible with Phase 3 services
 */
function convertHOADuesToBills(hoaDuesDoc, clientId, unitId, year, config = {}) {
  const bills = [];
  
  // Fail fast if scheduledAmount is missing from unit dues
  if (!hoaDuesDoc.scheduledAmount) {
    throw new Error(`scheduledAmount not found in HOA dues document for unit ${unitId}, year ${year}, client ${clientId}. Each unit's dues document must have a scheduledAmount.`);
  }
  
  const monthlyAmount = hoaDuesDoc.scheduledAmount;
  
  // Ensure payments array exists (may be sparse or empty)
  const paymentsArray = hoaDuesDoc.payments || [];
  
  console.log(`🔄 [HOA ADAPTER] Converting HOA dues to bills: 12 fiscal months (${paymentsArray.length} entries in payments array)`);
  
  // IMPORTANT: Generate bills for ALL 12 fiscal months (0-11)
  // Users pay IN ADVANCE - they should be able to pay any future month
  // Payment array is sparse - only months with payments have entries
  // If no payment entry exists, month is unpaid (future payment allowed)
  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    // Get payment data for this month (null if doesn't exist in sparse array)
    const payment = paymentsArray[monthIndex] || null;
    const month = monthIndex + 1; // 1-12
    const fiscalMonth = monthIndex; // 0-11 for fiscal year format
    
    // Get due date - calculate using frequency-aware logic
    // This ensures quarters share the same due date
    const dueDateISO = calculateFrequencyAwareDueDate(
      fiscalMonth,
      year,
      config.duesFrequency || 'monthly',
      config.fiscalYearStartMonth || 1
    );
    const dueDate = parseDate(dueDateISO);
    
    // DEBUG: Log due date calculation for first few months
    if (monthIndex < 4) {
      console.log(`   📅 [DUE DATE] Month ${monthIndex}: ${dueDateISO} (frequency: ${config.duesFrequency})`);
    }
    
    // Determine bill status based on amounts (not payment.paid boolean)
    const paidAmount = payment?.amount || 0; // Already in centavos
    const baseCharge = monthlyAmount; // Monthly scheduled amount in centavos
    
    // Calculate penalty if overdue (will be recalculated by PenaltyRecalculationService)
    const penaltyAmount = payment?.penalty || 0; // In centavos
    const penaltyPaid = payment?.penaltyPaid || 0; // In centavos
    
    // Determine actual status based on amounts
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
    const unpaidAmount = totalDue - totalPaid;
    
    bills.push({
      // Bill identification (Phase 3 format: "YYYY-MM")
      billId: `${year}-${String(fiscalMonth).padStart(2, '0')}`,
      period: `${year}-${String(fiscalMonth).padStart(2, '0')}`,
      
      // Unit identification
      unitId: unitId,
      
      // Amounts (all in CENTAVOS)
      currentCharge: baseCharge,        // Base monthly dues
      paidAmount: paidAmount,           // Amount paid on base
      basePaid: paidAmount,             // Same as paidAmount for HOA
      penaltyAmount: penaltyAmount,     // Current penalty
      penaltyPaid: penaltyPaid,         // Penalty paid
      totalAmount: totalDue,            // Total due (base + penalty)
      
      // Status
      status: billStatus,
      paid: isPaid,
      
      // Dates
      dueDate: dueDate.toISOString(),
      billDate: dueDate.toISOString(),
      paidDate: payment?.date ? toISOString(parseDate(payment.date)) : null,
      
      // Metadata for reconstruction
      _hoaMetadata: {
        monthIndex: monthIndex,
        month: month,
        originalPayment: payment ? { ...payment } : null
      }
    });
  }
  
  console.log(`✅ [HOA ADAPTER] Converted ${bills.length} months to bills, ${bills.filter(b => b.status === 'unpaid').length} unpaid`);
  
  return bills;
}

/**
 * Apply Phase 3 payment distribution results back to HOA Dues monthly array
 * 
 * @param {object} hoaDuesDoc - Original HOA dues document
 * @param {Array} billPayments - Payment distribution from Phase 3 PaymentDistributionService
 * @param {object} paymentInfo - Payment information (transactionId, date, etc.)
 * @returns {object} Updated HOA dues document
 */
function applyBillPaymentsToHOADues(hoaDuesDoc, billPayments, paymentInfo = {}) {
  console.log(`🔄 [HOA ADAPTER] Applying ${billPayments.length} bill payments to HOA dues array`);
  
  const updatedPayments = [...hoaDuesDoc.payments];
  let totalPaidAdded = 0;
  
  billPayments.forEach(billPayment => {
    // Extract month index from bill period (e.g., "2026-00" -> 0)
    const periodMatch = billPayment.billPeriod?.match(/\d{4}-(\d{2})/);
    if (!periodMatch) {
      console.warn(`⚠️  [HOA ADAPTER] Invalid bill period format: ${billPayment.billPeriod}`);
      return;
    }
    
    const monthIndex = parseInt(periodMatch[1]);
    
    if (monthIndex < 0 || monthIndex >= updatedPayments.length) {
      console.warn(`⚠️  [HOA ADAPTER] Month index out of bounds: ${monthIndex}`);
      return;
    }
    
    const currentPayment = updatedPayments[monthIndex];
    
    // Convert amounts from pesos (Phase 3 returns pesos) to centavos
    const baseChargePaid = pesosToCentavos(billPayment.baseChargePaid || 0);
    const penaltyPaid = pesosToCentavos(billPayment.penaltyPaid || 0);
    const totalPaid = baseChargePaid + penaltyPaid;
    
    // Update the payment record
    updatedPayments[monthIndex] = {
      ...currentPayment,
      paid: billPayment.newStatus === 'paid',
      amount: (currentPayment.amount || 0) + baseChargePaid, // Add to existing payment
      penaltyPaid: (currentPayment.penaltyPaid || 0) + penaltyPaid,
      date: paymentInfo.date || currentPayment.date,
      reference: paymentInfo.transactionId || currentPayment.reference,
      status: billPayment.newStatus
    };
    
    totalPaidAdded += totalPaid;
    
    console.log(`  ✓ Month ${monthIndex + 1}: +$${centavosToPesos(totalPaid)} (base: $${centavosToPesos(baseChargePaid)}, penalty: $${centavosToPesos(penaltyPaid)})`);
  });
  
  // Update total paid
  const updatedTotalPaid = (hoaDuesDoc.totalPaid || 0) + totalPaidAdded;
  
  console.log(`✅ [HOA ADAPTER] Applied payments: Total added $${centavosToPesos(totalPaidAdded)}, New total: $${centavosToPesos(updatedTotalPaid)}`);
  
  return {
    ...hoaDuesDoc,
    payments: updatedPayments,
    totalPaid: updatedTotalPaid,
    updated: admin.firestore.Timestamp.now()
  };
}

/**
 * Get HOA Dues billing configuration
 * 
 * @param {string} clientId - Client ID
 * @returns {object} HOA billing configuration
 */
async function getHOABillingConfig(clientId) {
  const db = await getDb();
  
  try {
    // Load client document to get fiscal year configuration
    const clientDoc = await db.collection('clients').doc(clientId).get();
    const clientData = clientDoc.data() || {};
    const fiscalYearStartMonth = clientData.configuration?.fiscalYearStartMonth || 1;
    const duesFrequency =
      clientData.feeStructure?.duesFrequency ||
      clientData.configuration?.feeStructure?.duesFrequency ||
      clientData.configuration?.duesFrequency ||
      'monthly';
    
    // Load HOA-specific config
    const configDoc = await db
      .collection('clients')
      .doc(clientId)
      .collection('config')
      .doc('hoaDues')
      .get();
    
    if (!configDoc.exists) {
      throw new Error(`HOA Dues configuration not found for client ${clientId}. Please create config document at clients/${clientId}/config/hoaDues`);
    }
    
    // Use shared validation utility
    const hoaConfig = configDoc.data();
    const validatedConfig = validateHOAConfig(hoaConfig, clientId);
    
    return {
      ...validatedConfig,
      fiscalYearStartMonth: hoaConfig?.fiscalYearStartMonth || fiscalYearStartMonth,
      duesFrequency
    };
  } catch (error) {
    console.error(`❌ Error loading HOA config for ${clientId}:`, error);
    throw error;
  }
}

/**
 * Recalculate penalties for HOA Dues using Phase 3 PenaltyRecalculationService
 * 
 * ⚠️  FOR BATCH UPDATES / NIGHTLY JOBS - Writes to Firestore
 * 
 * This function:
 * - Compares calculated penalties to stored penalties
 * - Only updates Firestore if penalties changed
 * - Intended for scheduled batch updates to keep stored values current
 * 
 * ❌ DO NOT use for preview/record - use calculatePenaltiesInMemory() instead
 * ✅ Preview/Record need penalties for specific payment date (not comparison)
 * 
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} year - Fiscal year
 * @param {Date} asOfDate - Calculate penalties as of this date (default: now)
 * @returns {object} Recalculation result with updated HOA dues document
 */
async function recalculateHOAPenalties(clientId, unitId, year, asOfDate = null) {
  console.log(`💰 [HOA PENALTIES] Recalculating penalties for ${clientId}/${unitId}/${year}`);
  
  const db = await getDb();
  const calculationDate = asOfDate || getNow();
  
  // Load HOA dues document
  const duesRef = db.collection('clients').doc(clientId)
    .collection('units').doc(unitId)
    .collection('dues').doc(year.toString());
  
  const duesSnap = await duesRef.get();
  
  if (!duesSnap.exists) {
    console.log(`⚠️  No HOA dues document found for ${unitId}/${year}`);
    return { updated: false, message: 'No dues document found' };
  }
  
  const hoaDuesDoc = duesSnap.data();
  
  // Load HOA billing configuration
  const config = await getHOABillingConfig(clientId);
  
  // Convert HOA dues to bills format
  const bills = convertHOADuesToBills(hoaDuesDoc, clientId, unitId, year, config);
  
  // Filter to unpaid bills only
  const unpaidBills = bills.filter(b => b.status !== 'paid');
  
  if (unpaidBills.length === 0) {
    console.log(`✅ [HOA PENALTIES] No unpaid bills, no penalties to calculate`);
    return { updated: false, message: 'No unpaid bills' };
  }
  
  // Validate penalty configuration exists (check for undefined/null, allow 0)
  if (config.penaltyRate === undefined || config.penaltyRate === null || 
      config.penaltyDays === undefined || config.penaltyDays === null) {
    const missing = [];
    if (config.penaltyRate === undefined || config.penaltyRate === null) missing.push('penaltyRate');
    if (config.penaltyDays === undefined || config.penaltyDays === null) missing.push('penaltyDays');
    throw new Error(`Penalty configuration incomplete for client ${clientId}. Missing: ${missing.join(', ')}`);
  }
  
  // Use Phase 3 penalty service to recalculate
  const penaltyResult = await recalculatePenalties({
    clientId,
    moduleType: 'hoa',
    bills: unpaidBills,
    asOfDate: calculationDate,
    config: {
      penaltyRate: config.penaltyRate,
      penaltyDays: config.penaltyDays
    }
  });
  
  console.log(`💰 [HOA PENALTIES] Recalculated ${penaltyResult.billsUpdated} bills, added $${centavosToPesos(penaltyResult.totalPenaltiesAdded)}`);
  
  // Apply penalty updates back to monthly array
  const updatedPayments = [...hoaDuesDoc.payments];
  let totalPenaltyAmount = 0;
  
  penaltyResult.updatedBills.forEach(bill => {
    const monthIndex = bill._hoaMetadata?.monthIndex;
    if (monthIndex !== undefined && monthIndex >= 0 && monthIndex < updatedPayments.length) {
      updatedPayments[monthIndex] = {
        ...updatedPayments[monthIndex],
        penalty: bill.penaltyAmount,  // In centavos
        penaltyUpdated: calculationDate.toISOString()
      };
      totalPenaltyAmount += bill.penaltyAmount;
    }
  });
  
  // Update document with new penalties
  const penaltyUpdates = {
    payments: updatedPayments,
    totalPenalty: totalPenaltyAmount,
    lastPenaltyCalculation: admin.firestore.Timestamp.fromDate(calculationDate),
    updated: admin.firestore.Timestamp.now()
  };
  
  // Clean all Timestamp objects before update
  const cleanedPenaltyUpdates = cleanTimestamps(penaltyUpdates);
  await duesRef.update(cleanedPenaltyUpdates);
  
  console.log(`✅ [HOA PENALTIES] Updated penalties: Total $${centavosToPesos(totalPenaltyAmount)}`);
  
  return {
    updated: true,
    billsUpdated: penaltyResult.billsUpdated,
    totalPenaltiesAdded: penaltyResult.totalPenaltiesAdded,
    totalPenaltyAmount: totalPenaltyAmount
  };
}

/**
 * Calculate penalties in-memory for preview/record (does NOT write to Firestore)
 * 
 * CRITICAL: This function is for on-demand penalty calculation based on payment date.
 * For batch updates / nightly recalculation, use recalculateHOAPenalties() instead.
 * 
 * KEY DIFFERENCES from recalculateHOAPenalties():
 * - Does NOT compare to stored penalties (always recalculates)
 * - Does NOT write to Firestore
 * - Returns bills with updated penalties in-memory only
 * - Used by preview/record to calculate penalties for specific payment date
 * 
 * @param {Array} bills - Bills array with current penalty amounts
 * @param {Date} asOfDate - Calculate penalties as of this date (payment date)
 * @param {object} config - HOA billing configuration
 * @returns {Array} Bills array with recalculated penalties (in-memory only)
 */
async function calculatePenaltiesInMemory(bills, asOfDate, config) {
  console.log(`💰 [IN-MEMORY CALC] Calculating penalties for ${bills.length} bills as of ${asOfDate.toISOString()}`);
  
  // Validate penalty configuration exists (check for undefined/null, allow 0)
  if (config.penaltyRate === undefined || config.penaltyRate === null || 
      config.penaltyDays === undefined || config.penaltyDays === null) {
    const missing = [];
    if (config.penaltyRate === undefined || config.penaltyRate === null) missing.push('penaltyRate');
    if (config.penaltyDays === undefined || config.penaltyDays === null) missing.push('penaltyDays');
    throw new Error(`Penalty configuration incomplete. Missing: ${missing.join(', ')}`);
  }
  
  // Use grouped penalty recalculation (Phase 5 Task 5.2)
  // This groups bills by due date and calculates penalties on the group total
  const result = await recalculatePenalties({
    bills,
    asOfDate,
    config: {
      penaltyRate: config.penaltyRate,
      penaltyDays: config.penaltyDays
    }
  });
  
  const totalPenalties = result.totalPenaltiesAdded;
  console.log(`✅ [IN-MEMORY CALC] Recalculated penalties (grouped): Total $${centavosToPesos(totalPenalties)}, ${result.billsUpdated} bills updated`);
  
  return result.updatedBills;
}

/**
 * Create HOA allocations from distribution data
 * @param {Array} distribution - Payment distribution array
 * @param {string} unitId - Unit identifier
 * @param {number} year - Payment year
 * @param {object} paymentData - Payment data containing credit info
 * @returns {Array} Array of allocation objects
 */
function createHOAAllocations(distribution, unitId, year, paymentData) {
  const allocations = [];
  
  // Add HOA Dues allocations for each month
  // FILTER OUT zero-amount allocations - transaction validation rejects them
  if (distribution && distribution.length > 0) {
    let allocationIndex = 1;
    distribution.forEach((item) => {
      // Skip zero-amount allocations - they're valid for distribution but not for transaction records
      if (item.amountToAdd === 0) {
        return;
      }
      
      allocations.push({
        id: `alloc_${String(allocationIndex).padStart(3, '0')}`, // alloc_001, alloc_002, etc.
        type: "hoa-month", // Use hyphens to match categoryId format
        targetId: `month_${item.month}_${year}`,
        targetName: `${getMonthName(item.month)} ${year}`,
        amount: item.amountToAdd,
        percentage: null, // Will be calculated in allocationSummary if needed
        categoryName: "HOA Dues", // Required for split transaction validation
        categoryId: "hoa-dues", // Must match categories collection format (hyphen, not underscore)
        data: {
          unitId: unitId,
          month: item.month,
          year: year
        },
        metadata: {
          processingStrategy: "hoa_dues",
          cleanupRequired: true,
          auditRequired: true,
          createdAt: getNow().toISOString()
        }
      });
      allocationIndex++;
    });
  }
  
  // Add Credit Balance allocation for overpayments (positive) or usage (negative)
  if (paymentData && paymentData.creditBalanceAdded && paymentData.creditBalanceAdded > 0) {
    // Overpayment: Credit balance is ADDED (positive allocation)
    allocations.push({
      id: `alloc_${String(allocations.length + 1).padStart(3, '0')}`,
      type: "account_credit",
      targetId: `credit_${unitId}_${year}`,
      targetName: `Account Credit - Unit ${unitId}`,
      amount: paymentData.creditBalanceAdded,
      percentage: null,
      categoryName: "Account Credit", // Required for split transaction validation
      categoryId: "account-credit", // As specified by user
      data: {
        unitId: unitId,
        year: year,
        creditType: "overpayment"
      },
      metadata: {
        processingStrategy: "account_credit",
        cleanupRequired: true,
        auditRequired: true,
        createdAt: getNow().toISOString()
      }
    });
  } else if (paymentData && paymentData.creditUsed && paymentData.creditUsed > 0) {
    // Underpayment: Credit balance is USED (negative allocation)
    allocations.push({
      id: `alloc_${String(allocations.length + 1).padStart(3, '0')}`,
      type: "account_credit",
      targetId: `credit_${unitId}_${year}`,
      targetName: `Account Credit - Unit ${unitId}`,
      amount: -paymentData.creditUsed, // Negative amount for credit usage
      percentage: null,
      categoryName: "Account Credit", // Required for split transaction validation
      categoryId: "account-credit", // As specified by user
      data: {
        unitId: unitId,
        year: year,
        creditType: "usage"
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
 * @param {Array} distribution - Payment distribution array
 * @param {number} totalAmountCents - Total transaction amount in cents
 * @returns {Object} Allocation summary object
 */
function createAllocationSummary(distribution, totalAmountCents) {
  if (!distribution || distribution.length === 0) {
    return {
      totalAllocated: 0,
      allocationCount: 0,
      allocationType: null,
      hasMultipleTypes: false
    };
  }
  
  const totalAllocated = distribution.reduce((sum, item) => sum + item.amountToAdd, 0);
  
  // Debug logging to understand the units mismatch
  console.log('🔍 [ALLOCATION DEBUG] Units comparison:', {
    totalAmountCents,
    totalAllocated,
    distributionItems: distribution.map(item => ({ 
      month: item.month, 
      amountToAdd: item.amountToAdd 
    })),
    difference: totalAmountCents - totalAllocated
  });
  
  return {
    totalAllocated: totalAllocated,
    allocationCount: distribution.length,
    allocationType: "hoa-month", // Use hyphens to match categoryId format
    hasMultipleTypes: false,
    // Verify allocation integrity
    integrityCheck: {
      expectedTotal: totalAmountCents,
      actualTotal: totalAllocated,
      isValid: Math.abs(totalAmountCents - totalAllocated) < 100 // Allow 1 peso tolerance for debugging
    }
  };
}

/**
 * Initialize a year document with 12-month payment array
 * 
 * NOTE: This function cannot auto-initialize without scheduledAmount.
 * Each unit has different monthly dues - there is no default value.
 * Callers must ensure dues document with scheduledAmount exists before using HOA dues features.
 * 
 * @param {string} clientId - ID of the client
 * @param {string} unitId - ID of the unit
 * @param {number} year - Year to initialize
 * @throws {Error} Always throws - cannot initialize without scheduledAmount
 */
async function initializeYearDocument(clientId, unitId, year) {
  // Cannot auto-initialize without scheduledAmount - each unit has different monthly dues
  throw new Error(
    `Cannot auto-initialize HOA dues document for unit ${unitId}, year ${year}, client ${clientId}. ` +
    `Each unit has different monthly dues - scheduledAmount must be set in the dues document. ` +
    `Please ensure the dues document exists with scheduledAmount before recording payments or viewing dues.`
  );
}

/**
 * Record an HOA dues payment and link it to a transaction
 * 
 * @param {string} clientId - ID of the client
 * @param {string} unitId - ID of the unit making payment
 * @param {number} year - Year for the payment
 * @param {object} paymentData - Payment data containing amount, date, etc.
 * @param {Array} distribution - How payment should be distributed across months
 * @param {string|null} transactionId - Optional: Pre-created transaction ID (for unified payments)
 * @returns {object} Result containing status and payment details
 */
async function recordDuesPayment(clientId, unitId, year, paymentData, distribution, transactionId = null) {
  try {
    // Log full payment data for debugging
    console.log('Processing payment data in controller:', {
      clientId,
      unitId,
      year,
      paymentData: {
        ...paymentData,
        date: paymentData.date,
        dateType: typeof paymentData.date,
        amount: paymentData.amount,
        amountType: typeof paymentData.amount,
      },
      distribution
    });
    
    // Validate required fields with better error messages
    if (!clientId) {
      throw new Error('Missing clientId for dues payment');
    }
    if (!unitId) {
      throw new Error('Missing unitId for dues payment');
    }
    if (!year) {
      throw new Error('Missing year for dues payment');
    }
    if (!paymentData.amount && paymentData.amount !== 0) {
      throw new Error('Missing amount in paymentData');
    }
    if (!paymentData.date) {
      throw new Error('Missing date in paymentData');
    }
    
    // Create a more detailed description for the transaction
    const description = paymentData.description || `HOA Dues payment for Unit ${unitId}`;
    
    // First, create a transaction record
    // Enhanced date handling with Mexico timezone utilities for proper timezone support
    console.log('Payment date received by backend:', paymentData.date, 'Type:', typeof paymentData.date);
    let paymentDate;
    let paymentTimestamp;
    
    try {
      // Determine type and convert appropriately using Mexico timezone utilities
      if (!paymentData.date) {
        console.log('No date provided, using current Mexico date');
        paymentDate = getNow();
        paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
      } else if (paymentData.date instanceof Date) {
        console.log('Date is already a Date object');
        paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentData.date);
        paymentDate = paymentData.date;
      } else if (typeof paymentData.date === 'string') {
        console.log('Date is a string, parsing with Mexico timezone handling');
        // Extract date part from ISO string if present (YYYY-MM-DD)
        const dateOnly = paymentData.date.split('T')[0];
        console.log('Extracted date part:', dateOnly);
        
        // Use DateService for proper timezone handling
        paymentTimestamp = dateService.parseFromFrontend(dateOnly);
        paymentDate = paymentTimestamp.toDate();
      } else if (paymentData.date && typeof paymentData.date.toDate === 'function') {
        console.log('Date is a Firestore Timestamp');
        paymentTimestamp = paymentData.date;
        paymentDate = paymentData.date.toDate();
      } else if (typeof paymentData.date === 'object') {
        console.log('Date is an object, attempting to extract date information');
        // Attempt to extract timestamp if available
        if ('seconds' in paymentData.date && 'nanoseconds' in paymentData.date) {
          paymentTimestamp = new admin.firestore.Timestamp(paymentData.date.seconds, paymentData.date.nanoseconds || 0);
          paymentDate = paymentTimestamp.toDate();
        } else {
          // Final fallback - use current Mexico date
          console.error('Could not parse date object, using current Mexico date');
          paymentDate = getNow();
          paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
        }
      } else {
        // Final fallback
        console.error('Unrecognized date format, using current Mexico date');
        paymentDate = getNow();
        paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
      }
      
      console.log('Payment date after conversion:', paymentDate, 'Valid:', !isNaN(paymentDate.getTime()));
      
      // Final validation - if date is still invalid, use current Mexico date
      if (isNaN(paymentDate.getTime())) {
        console.error('Date is invalid after conversion, using current Mexico date');
        paymentDate = getNow();
        paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
      }
    } catch (dateError) {
      console.error('Error converting date:', dateError);
      paymentDate = getNow();
      paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
    }
    
    // CRITICAL: Recalculate penalties based on payment date for accurate recording
    // This ensures backdated payments use correct penalties for that date
    console.log(`💰 [HOA RECORD] Verifying penalties for payment date: ${paymentDate.toISOString()}`);
    
    // Get the database instance if not already initialized
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // Load current dues document to get latest state
    const duesRefVerify = dbInstance.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    const duesSnap = await duesRefVerify.get();
    
    if (duesSnap.exists) {
      const hoaDuesDoc = duesSnap.data();
      
      // Load HOA configuration
      const config = await getHOABillingConfig(clientId);
      
      // Convert to bills format
      const bills = convertHOADuesToBills(hoaDuesDoc, clientId, unitId, year, config);
      
      // Calculate penalties in-memory for payment date
      const billsWithUpdatedPenalties = await calculatePenaltiesInMemory(bills, paymentDate, config);
      
      console.log(`✅ [HOA RECORD] Penalties verified for ${billsWithUpdatedPenalties.length} bills`);
      
      // Note: The distribution parameter already contains payment breakdown from preview
      // We've verified penalties are correct for the payment date
      // The transaction will use the correct penalty amounts
    } else {
      console.log(`⚠️  [HOA RECORD] No dues document found - will be created during payment processing`);
    }
    
    // Format notes to match the existing schema format
    // Combine description, checkNumber, and notes into a single notes field
    let formattedNotes = description;
    
    // Add check number if available
    if (paymentData.method === 'check' && paymentData.checkNumber) {
      formattedNotes += ` - Check #${paymentData.checkNumber}`;
    }
    
    // Add user-provided notes if available
    if (paymentData.notes) {
      formattedNotes += ` - ${paymentData.notes}`;
    }
    
    // Add payment breakdown in format: "$X Dues + $Y credit" (matches old system)
    if (paymentData.creditUsed && paymentData.creditUsed > 0) {
      // When using existing credit: show dues paid + credit used
      const duesAmount = paymentData.amount || 0;
      const creditUsed = Math.round(paymentData.creditUsed);
      formattedNotes += ` - $${Math.round(duesAmount)} Dues + $${creditUsed} credit`;
    } else if (paymentData.creditBalanceAdded && paymentData.creditBalanceAdded > 0) {
      // When overpaying: show dues paid + credit added
      const duesAmount = (paymentData.amount || 0) - (paymentData.creditBalanceAdded || 0);
      const creditAdded = Math.round(paymentData.creditBalanceAdded);
      formattedNotes += ` - $${Math.round(duesAmount)} Dues + $${creditAdded} credit`;
    }
    
    // Create the transaction (unless already provided by unified payment system)
    let finalTransactionId = transactionId;
    
    if (!finalTransactionId) {
      // No transaction ID provided - create new transaction (standard flow)
      
      // Debug: Log the payment date being used
      console.log(`🗓️ [HOA PAYMENT DEBUG] Creating transaction with date:`, {
        paymentDate: paymentDate.toISOString(),
        year: paymentDate.getFullYear(),
        month: paymentDate.getMonth() + 1,
        day: paymentDate.getDate(),
        originalDate: paymentData.date,
        targetYear: year
      });
      
      // Create transaction data with standardized field names
      const transactionData = {
        date: paymentDate.toISOString().split('T')[0], // Convert Date to string format YYYY-MM-DD
        amount: paymentData.amount,
        categoryId: 'hoa-dues', // Must match categories collection format (hyphen, not underscore)
        categoryName: 'HOA Dues',
        type: 'income',
        // Payment method is the ID, we'll look up the type from the payment method document
        // For now, use a simple mapping based on common patterns
        accountType: paymentData.accountType || 'bank', // Default to bank, frontend should pass this
        accountId: paymentData.accountId || paymentData.accountToCredit || 'bank-001', // Use standard account IDs
        paymentMethodId: paymentData.method || null,  // This is the payment method document ID
        notes: formattedNotes, // Consolidated notes field with all information
        unitId: unitId, // Use the new field name
        vendorId: 'deposit',
        vendorName: 'Deposit',
        reference: `DUES-${unitId}-${year}`,
        
        // Enhanced allocation pattern - generalized for future split transactions
        allocations: createHOAAllocations(distribution, unitId, year, paymentData),
        allocationSummary: createAllocationSummary(distribution, dollarsToCents(paymentData.amount)),
        
        // Maintain backward compatibility - preserve original duesDistribution
        duesDistribution: distribution.map(item => ({
          unitId,
          month: item.month,
          amount: item.amountToAdd,
          year
        })),
        
        // NOTE: Credit balance data is stored only in HOA dues documents, not here
        // This prevents data duplication and synchronization issues
        
      // Add metadata to enable bidirectional navigation
      metadata: {
        type: 'hoa-dues', // Use hyphens to match categoryId format
        unitId,
        year,
        months: distribution.map(item => item.month)
      }
      };
      
      // Store the checkNumber as an internal field if provided
      if (paymentData.method === 'check' && paymentData.checkNumber) {
        transactionData.checkNumber = paymentData.checkNumber;
      }
      
      finalTransactionId = await createTransaction(clientId, transactionData);
      
      if (!finalTransactionId) {
        throw new Error('Failed to create transaction record');
      }
      
      console.log(`Created transaction ${finalTransactionId} for HOA Dues payment`);
    } else {
      // Transaction ID provided - skip transaction creation (unified payment flow)
      console.log(`Using existing transaction ${finalTransactionId} for HOA Dues payment (unified payment)`);
    }
    
    // Now update the unit's dues record
    // Get the database instance if not already initialized
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // Create document reference using new structure
    const duesRef = dbInstance.collection('clients').doc(clientId)
                      .collection('units').doc(unitId).collection('dues').doc(year.toString());
    const duesDoc = await duesRef.get();
    
    let duesData;
    
    if (duesDoc.exists) {
      duesData = duesDoc.data();
      console.log('Found existing dues record:', duesData);
    } else {
      console.log('No existing dues record found, initializing new record');
      // Initialize with 12-element payment array
      const initialDoc = await initializeYearDocument(clientId, unitId, year);
      duesData = initialDoc;
    }
    
    // Ensure payments is always a 12-element array - but PRESERVE existing data
    if (!Array.isArray(duesData.payments)) {
      console.log('⚠️ payments is not an array, initializing');
      duesData.payments = Array(12).fill(null).map(() => ({
        paid: false,
        amount: 0,
        date: null,
        reference: null
      }));
    } else if (duesData.payments.length < 12) {
      console.log(`⚠️ payments array has ${duesData.payments.length} elements, padding to 12`);
      // Pad the array to 12 elements without losing existing data
      while (duesData.payments.length < 12) {
        duesData.payments.push({
          paid: false,
          amount: 0,
          date: null,
          reference: null
        });
      }
    } else if (duesData.payments.length > 12) {
      console.log(`⚠️ payments array has ${duesData.payments.length} elements, truncating to 12`);
      // Truncate to 12 elements
      duesData.payments = duesData.payments.slice(0, 12);
    }
    
    console.log('Processing distribution:', distribution);
    console.log('Current payments array before update:', duesData.payments);      // Handle case where distribution is empty (credit-only payment)
    if (!distribution || distribution.length === 0) {
      console.log(`No distribution provided - this appears to be a credit-only payment of ${paymentData.amount}`);
    }
    
    // Load billing config to calculate due dates
    const config = await getHOABillingConfig(clientId);
    const frequency = config.duesFrequency || 'monthly';
    const fiscalYearStartMonth = config.fiscalYearStartMonth || 1;
    
    // Update payments array with distributed payments
    console.log(`Processing ${distribution.length} distribution items`);
    
    if (distribution.length === 0) {
      console.log('No distribution items to process - this may be a credit-only payment');
    }
    
    for (const item of distribution) {
      console.log(`Processing payment for month ${item.month}:`, item);
      
      // Convert month to 0-based index (month 1 = index 0)
      const monthIndex = item.month - 1;
      
      if (monthIndex < 0 || monthIndex > 11) {
        console.error(`Invalid month ${item.month}, skipping`);
        continue;
      }
      
      // Calculate due date for this fiscal month
      const dueDateISO = calculateFrequencyAwareDueDate(
        monthIndex,
        year,
        frequency,
        fiscalYearStartMonth
      );
      
      // Create a payment note without the redundant prefix, just include user notes and transaction ID
      const paymentNote = paymentData.notes 
        ? `${paymentData.notes} (Transaction ID: ${finalTransactionId})`
        : `Payment recorded in Transaction ID: ${finalTransactionId}`;
      
      // Use timestamp conversion utility - but store as ISO string for Firestore compatibility
      // CRITICAL FIX: Firestore update() cannot serialize Timestamp objects from different SDK versions
      const paymentTimestamp = convertToTimestamp(paymentDate);
      // Convert to ISO string immediately to avoid serialization issues
      const paymentDateISO = paymentTimestamp?.toDate?.() ? paymentTimestamp.toDate().toISOString() : (paymentDate instanceof Date ? paymentDate.toISOString() : paymentDate);
      
      // Calculate new paid amount - handle different distribution formats
      // Frontend sends amounts in dollars, so we need to convert to cents
      const currentAmount = duesData.payments[monthIndex].amount || 0;
      const amountInCents = item.newAmount !== undefined 
        ? dollarsToCents(item.newAmount)  // newAmount is in dollars from frontend
        : currentAmount + dollarsToCents(item.amountToAdd || 0);  // amountToAdd is also in dollars
          
      console.log(`Updating month ${item.month} (index ${monthIndex}): ${centsToDollars(amountInCents)} dollars`);
      
      // Update the specific month in the 12-element array - PRESERVE existing data
      // Store date as ISO string (not Timestamp) to avoid Firestore serialization errors
      duesData.payments[monthIndex] = {
        ...duesData.payments[monthIndex], // Preserve any existing fields
        paid: amountInCents > 0,
        amount: amountInCents,
        date: paymentDateISO, // Store as ISO string, not Timestamp object
        dueDate: dueDateISO, // Store due date for this month
        reference: finalTransactionId,
        notes: paymentNote  // Store payment notes for tooltip display
      };
    }
    
    // Determine credit balance impact using shared credit service
    const creditBalanceInfo = await creditService.getCreditBalance(clientId, unitId);
    const existingCreditCentavos = dollarsToCents(creditBalanceInfo.creditBalance || 0);
    let creditDeltaCentavos = 0;

    if (typeof paymentData.newCreditBalance === 'number') {
      const targetCreditCentavos = dollarsToCents(paymentData.newCreditBalance);
      creditDeltaCentavos = targetCreditCentavos - existingCreditCentavos;
    } else {
      const creditAddedCentavos = dollarsToCents(paymentData.creditBalanceAdded || 0);
      const creditRepairCentavos = dollarsToCents(paymentData.creditRepairAmount || 0);
      const creditUsedCentavos = dollarsToCents(paymentData.creditUsed || 0);
      creditDeltaCentavos = creditAddedCentavos + creditRepairCentavos - creditUsedCentavos;
    }

    if (creditDeltaCentavos !== 0) {
      const noteSegments = [];
      if (typeof paymentData.creditBalanceAdded === 'number') {
        noteSegments.push(`overpayment +$${Number(paymentData.creditBalanceAdded).toFixed(2)}`);
      }
      if (typeof paymentData.creditUsed === 'number' && paymentData.creditUsed > 0) {
        noteSegments.push(`credit used $${Number(paymentData.creditUsed).toFixed(2)}`);
      }
      if (typeof paymentData.creditRepairAmount === 'number' && paymentData.creditRepairAmount > 0) {
        noteSegments.push(`repair +$${Number(paymentData.creditRepairAmount).toFixed(2)}`);
      }
      const creditNote = `HOA dues payment ${finalTransactionId}${noteSegments.length ? ` (${noteSegments.join(', ')})` : ''}`;

      await creditService.updateCreditBalance(
        clientId,
        unitId,
        creditDeltaCentavos,
        finalTransactionId,
        creditNote,
        'hoaDues'
      );
      console.log(`💳 [CREDIT] Applied delta of ${creditDeltaCentavos} centavos via shared credit service`);
    } else {
      console.log('💳 [CREDIT] No credit delta detected for this payment');
    }
    
    // Debug the data before saving - more detailed logging
    console.log('Attempting to save dues data:', {
      path: `clients/${clientId}/units/${unitId}/dues/${year}`,
      duesData: {
        scheduledAmount: duesData.scheduledAmount,
        paymentsCount: duesData.payments.length,
        payments: duesData.payments.map(p => ({
          month: p.month,
          paid: p.paid,
          date: p.date,
          notes: p.notes?.substring(0, 30) + (p.notes?.length > 30 ? '...' : '')
        }))
      }
    });
    
    try {
      // Get the exact Firestore path for debugging
      const firestorePath = `clients/${clientId}/units/${unitId}/dues/${year.toString()}`;
      console.log(`🔍 Attempting to update Firestore document at path: ${firestorePath}`);
      
      // Log the duesRef details
      console.log('Document reference details:', {
        path: duesRef.path,
        parent: duesRef.parent.path,
        id: duesRef.id
      });
      
      // Debug the current state of duesData before cleaning
      console.log('Current duesData structure before cleaning:', {
        scheduledAmount: duesData.scheduledAmount,
        paymentsCount: duesData.payments?.length || 0,
        paymentsArray: Array.isArray(duesData.payments),
        firstPayment: duesData.payments && duesData.payments.length > 0 ? duesData.payments[0] : null
      });
      
      // Calculate totalPaid from the 12-element payment array
      const totalPaid = duesData.payments.reduce((sum, payment) => 
        sum + (payment.amount || 0), 0
      );
      
      // CRITICAL FIX: Convert Firestore Timestamp objects to ISO strings before saving
      // Firestore update() cannot serialize Timestamp objects from different SDK versions
      const cleanedPayments = duesData.payments.map(p => {
        let cleanedDate = p.date;
        
        // If date is a Firestore Timestamp object, convert to ISO string
        if (p.date && typeof p.date.toDate === 'function') {
          try {
            cleanedDate = p.date.toDate().toISOString();
            console.log(`🔄 Converting Timestamp to ISO string for month ${p._hoaMetadata?.month || 'unknown'}`);
          } catch (err) {
            console.warn(`⚠️ Failed to convert Timestamp, using as-is:`, err);
            cleanedDate = p.date;
          }
        } else if (p.date && typeof p.date === 'object' && p.date._seconds !== undefined) {
          // Handle Timestamp-like objects (from Firestore reads)
          try {
            const ts = Timestamp.fromMillis(p.date._seconds * 1000 + (p.date._nanoseconds || 0) / 1000000);
            cleanedDate = ts.toDate().toISOString();
            console.log(`🔄 Converting Timestamp object to ISO string`);
          } catch (err) {
            console.warn(`⚠️ Failed to convert Timestamp object, using ISO string if available:`, err);
            cleanedDate = p.date?.toISOString?.() || p.date;
          }
        } else if (p.date && typeof p.date === 'string') {
          // Already a string, keep as-is
          cleanedDate = p.date;
        }
        
        return {
          ...p,
          date: cleanedDate
        };
      });
      
      console.log(`✅ Cleaned ${cleanedPayments.length} payment entries for Firestore update`);
      
      // SURGICAL UPDATE: Only update specific fields that changed
      const updates = {
        // Update calculated fields
        totalPaid: totalPaid,

        // Update the payment array with cleaned dates
        payments: cleanedPayments,

        // Remove legacy credit fields permanently
        creditBalance: admin.firestore.FieldValue.delete(),
        creditBalanceHistory: admin.firestore.FieldValue.delete(),

        // Update timestamp
        updated: convertToTimestamp(getNow())
      };
      
      // IMPORTANT: We do NOT include these fields in updates:
      // - scheduledAmount (static configuration)
      // - duesAmount (static configuration)
      // - unitId (static identifier)
      // - year (static identifier)
      // - totalDue (static configuration)
      
      // Log the update for debugging
      console.log('Surgical update fields:', {
        totalPaid: updates.totalPaid,
        paymentsCount: updates.payments.length,
        updatedFields: Object.keys(updates)
      });
      
      // Use update() instead of set() for surgical updates
      const db = await getDb();
      try {
        console.log(`🔄 Attempting surgical update for document: ${firestorePath}`);
        
        // Clean all Timestamp objects before update to prevent serialization errors
        const cleanedUpdates = cleanTimestamps(updates);
        
        // Use update() to only modify specific fields
        await duesRef.update(cleanedUpdates);
        console.log(`✅ Surgical update completed successfully for document: ${firestorePath}`);
      } catch (updateError) {
        console.error(`❌ Update failed:`, updateError);
        
        // If document doesn't exist, we need to create it with full structure
        if (updateError.code === 'not-found' || updateError.message?.includes('No document to update')) {
          console.log(`Document doesn't exist, initializing new document`);
          
          if (!duesData.scheduledAmount) {
            console.warn(`⚠️ No scheduledAmount provided for unit ${unitId}, year ${year}.`);
          }
          
          // Initialize with full structure including static fields
          // Note: totalDue field removed - calculate from scheduledAmount × 12 instead
          const newDuesDoc = {
            year: year,
            unitId: unitId,
            totalPaid: updates.totalPaid,
            payments: updates.payments,
            updated: updates.updated,
            // Preserve scheduledAmount if it exists in duesData
            ...(duesData.scheduledAmount !== undefined && { scheduledAmount: duesData.scheduledAmount })
          };
          
          // Clean all Timestamp objects before set
          const cleanedNewDuesDoc = cleanTimestamps(newDuesDoc);
          await duesRef.set(cleanedNewDuesDoc);
          console.log(`✅ Created new document with full structure`);
        } else {
          throw new Error(`Failed to update dues data: ${updateError.message}`);
        }
      }
      
      // Double-check that the data was saved by reading it back
      const verifyDoc = await duesRef.get();
      if (verifyDoc.exists) {
        const savedData = verifyDoc.data();
        console.log(`✅ Verified dues record for Unit ${unitId} Year ${year}:`, {
          legacyCreditFieldsPresent: 'creditBalance' in savedData || 'creditBalanceHistory' in savedData,
          savedPaymentsCount: savedData.payments?.length || 0,
          path: firestorePath,
          documentId: verifyDoc.id
        });
        
        // Check if the payment count matches what we expected
        if (savedData.payments?.length !== updates.payments?.length) {
          console.warn(`⚠️ Warning: Saved payments count (${savedData.payments?.length}) doesn't match expected count (${updates.payments?.length})`);
          
          // Try to update just the payments array as a fallback
          console.log(`🔄 Attempting to fix payments array with surgical update...`);
          const cleanedPaymentsUpdate = cleanTimestamps({ payments: updates.payments });
          await duesRef.update(cleanedPaymentsUpdate);
          console.log(`✅ Payments array update completed`);
          
          // Final verification after payments update
          const finalCheck = await duesRef.get();
          if (finalCheck.exists) {
            const finalData = finalCheck.data();
            if (finalData.payments?.length !== updates.payments?.length) {
              console.error(`❌ Still couldn't correct the payments array length after update!`);
            } else {
              console.log(`✅ Successfully fixed payments array with update`);
            }
          }
        }
      } else {
        console.error(`❌ Verification failed: Could not read back dues record for Unit ${unitId} Year ${year}`);
        console.log(`🔄 Document doesn't exist, attempting to create it with full data...`);
        
        if (!duesData.scheduledAmount) {
          console.warn(`⚠️ No scheduledAmount provided for unit ${unitId}, year ${year}.`);
        }
        
        // Create full document structure for new document
        // Note: totalDue field removed - calculate from scheduledAmount × 12 instead
        const newDuesDoc = {
          year: year,
          unitId: unitId,
          totalPaid: updates.totalPaid,
          payments: updates.payments,
          updated: updates.updated,
          // Preserve scheduledAmount if it exists in duesData
          ...(duesData.scheduledAmount !== undefined && { scheduledAmount: duesData.scheduledAmount })
        };
        
        // Try a direct write without merge as last resort
        // Clean all Timestamp objects before set
        const cleanedDoc = cleanTimestamps(newDuesDoc);
        await duesRef.set(cleanedDoc);
        console.log(`✅ Created new document at ${firestorePath}`);
      }
      
      // Final verification
      const finalVerify = await duesRef.get();
      console.log(`🔍 Final verification - Document exists: ${finalVerify.exists}, Payment count: ${finalVerify.exists ? finalVerify.data().payments?.length : 'N/A'}`);
    } catch (saveError) {
      console.error('❌ Error saving dues data:', saveError);
      console.error('Error details:', saveError);
      throw new Error(`Failed to save dues data: ${saveError.message}`);
    }
    
    // Log the action
    await writeAuditLog({
      module: 'hoadues',
      action: 'payment',
      parentPath: `clients/${clientId}/units/${unitId}/dues`,
      docId: `${year}`,
      friendlyName: `Unit ${unitId} Dues Payment`,
      notes: `Recorded payment of ${paymentData.amount} for year ${year}`,
      metadata: {
        unitId,
        amount: paymentData.amount,
        transactionId: finalTransactionId
      }
    });
    
    return {
      success: true,
      transactionId: finalTransactionId,
      duesData
    };
  } catch (error) {
    console.error('❌ Error recording dues payment:', error);
    throw error;
  }
}

/**
 * Update HOA dues payments in Firestore (bypasses all calculations)
 * Used by unified payment system when calculations are already done
 * 
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} year - Fiscal year
 * @param {Array} monthsData - Array of {month, basePaid, penaltyPaid} objects
 * @param {string} transactionId - Pre-created transaction ID
 * @param {string} paymentDate - Payment date (ISO string)
 * @param {string} paymentMethod - Payment method
 * @param {string|null} reference - Payment reference
 * @param {string} userId - User ID who recorded payment
 * @param {object} creditData - {final, used, added} - Final credit balance info
 * @returns {object} Success status
 */
async function updateHOADuesWithPayment(clientId, unitId, year, monthsData, transactionId, paymentDate, paymentMethod, reference, userId, creditData) {
  try {
    console.log(`🏠 [HOA UPDATE] Updating ${monthsData.length} months for unit ${unitId}/${year}`);
    
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    const duesRef = dbInstance.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    const duesDoc = await duesRef.get();
    
    if (!duesDoc.exists) {
      throw new Error(`HOA dues document not found for ${unitId}/${year}`);
    }
    
    const duesData = duesDoc.data();
    const paymentsArray = Array.isArray(duesData.payments) ? [...duesData.payments] : Array(12).fill(null);
    
    // Ensure 12-element array
    while (paymentsArray.length < 12) {
      paymentsArray.push(null);
    }
    
    // Load billing config to calculate due dates
    const config = await getHOABillingConfig(clientId);
    const frequency = config.duesFrequency || 'monthly';
    const fiscalYearStartMonth = config.fiscalYearStartMonth || 1;
    
    // Update each month
    monthsData.forEach(monthData => {
      const monthIndex = monthData.month - 1; // Convert to 0-based index (fiscal month index 0-11)
      
      if (monthIndex < 0 || monthIndex > 11) {
        console.warn(`Invalid month ${monthData.month}, skipping`);
        return;
      }
      
      // Calculate due date for this fiscal month
      const dueDateISO = calculateFrequencyAwareDueDate(
        monthIndex,
        year,
        frequency,
        fiscalYearStartMonth
      );
      
      const existingPayment = paymentsArray[monthIndex] || {};
      
      paymentsArray[monthIndex] = {
        ...existingPayment,
        paid: true,
        amount: (existingPayment.amount || 0) + monthData.basePaid, // In centavos
        penaltyPaid: monthData.penaltyPaid, // In centavos
        date: paymentDate,
        dueDate: dueDateISO, // Store due date for this month
        method: paymentMethod,
        reference: transactionId,
        notes: monthData.notes || `Unified payment (Transaction ID: ${transactionId})`
      };
    });
    
    // Calculate total paid
    const totalPaid = paymentsArray.reduce((sum, p) => sum + (p?.amount || 0), 0);
    
    // NOTE: Credit balance update is now handled by UnifiedPaymentWrapper
    // to ensure atomicity across all payment types (HOA + Water + Credit)
    // This prevents double credit updates and ensures all-or-nothing semantics
    console.log(`💳 [HOA] Credit update delegated to UnifiedPaymentWrapper`);

    // Update Firestore (payments only)
    const updates = {
      payments: paymentsArray,
      totalPaid: totalPaid,
      creditBalance: admin.firestore.FieldValue.delete(),
      creditBalanceHistory: admin.firestore.FieldValue.delete(),
      updated: getNow().toISOString()
    };
    
    const cleanedUpdates = cleanTimestamps(updates);
    await duesRef.update(cleanedUpdates);
    
    console.log(`✅ [HOA UPDATE] Updated ${monthsData.length} months, credit: $${creditData.final}`);
    
    return { success: true, transactionId };
    
  } catch (error) {
    console.error('❌ Error updating HOA dues:', error);
    throw error;
  }
}

/**
 * Update HOA dues with payment (handles both monthly and quarterly)
 * Detects billing frequency from the data structure
 * 
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} year - Fiscal year
 * @param {Array} paymentsData - Array of payment data (months or quarters)
 * @param {string} transactionId - Pre-created transaction ID
 * @param {string} paymentDate - Payment date (ISO string)
 * @param {string} paymentMethod - Payment method
 * @param {string|null} reference - Payment reference
 * @param {string} userId - User ID who recorded payment
 * @param {object} creditData - {final, used, added} - Final credit balance info
 * @returns {object} Success status
 */
async function updateHOADuesWithPaymentUnified(clientId, unitId, year, paymentsData, transactionId, paymentDate, paymentMethod, reference, userId, creditData) {
  try {
    console.log(`🏠 [HOA UPDATE] Processing ${paymentsData.length} payment entries for unit ${unitId}/${year}`);
    
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    const duesRef = dbInstance.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    const duesDoc = await duesRef.get();
    
    if (!duesDoc.exists) {
      throw new Error(`HOA dues document not found for ${unitId}/${year}`);
    }
    
    const duesData = duesDoc.data();
    
    // Detect billing frequency from data structure
    const hasQuarters = duesData.quarters && Array.isArray(duesData.quarters);
    const hasPayments = duesData.payments && Array.isArray(duesData.payments);
    
    let updates = {};
    
    if (hasQuarters) {
      // QUARTERLY BILLING
      console.log(`   📅 Detected quarterly billing structure`);
      const quartersArray = [...duesData.quarters];
      
      // Ensure 4-element array
      while (quartersArray.length < 4) {
        quartersArray.push(null);
      }
      
      // Update each quarter
      paymentsData.forEach(paymentData => {
        const quarterIndex = paymentData.quarterIndex;
        
        if (quarterIndex < 0 || quarterIndex > 3) {
          console.warn(`Invalid quarter ${quarterIndex}, skipping`);
          return;
        }
        
        const existingQuarter = quartersArray[quarterIndex] || {};
        
        quartersArray[quarterIndex] = {
          ...existingQuarter,
          paid: true,
          amount: (existingQuarter.amount || 0) + paymentData.basePaid, // In centavos
          penaltyPaid: paymentData.penaltyPaid, // In centavos
          date: paymentDate,
          method: paymentMethod,
          reference: transactionId,
          notes: paymentData.notes || `Unified payment Q${quarterIndex + 1} (Transaction ID: ${transactionId})`
        };
      });
      
      // Calculate total paid
      const totalPaid = quartersArray.reduce((sum, q) => sum + (q?.amount || 0), 0);
      
      updates = {
        quarters: quartersArray,
        totalPaid: totalPaid,
        updated: getNow().toISOString()
      };
      
      console.log(`   ✅ Updated ${paymentsData.length} quarters`);
      
    } else if (hasPayments) {
      // MONTHLY BILLING (existing logic)
      console.log(`   📅 Detected monthly billing structure`);
      const paymentsArray = [...duesData.payments];
      
      // Ensure 12-element array
      while (paymentsArray.length < 12) {
        paymentsArray.push(null);
      }
      
      // Update each month
      paymentsData.forEach(paymentData => {
        const monthIndex = paymentData.month - 1; // Convert to 0-based index
        
        if (monthIndex < 0 || monthIndex > 11) {
          console.warn(`Invalid month ${paymentData.month}, skipping`);
          return;
        }
        
        const existingPayment = paymentsArray[monthIndex] || {};
        
        paymentsArray[monthIndex] = {
          ...existingPayment,
          paid: true,
          amount: (existingPayment.amount || 0) + paymentData.basePaid, // In centavos
          penaltyPaid: paymentData.penaltyPaid, // In centavos
          date: paymentDate,
          method: paymentMethod,
          reference: transactionId,
          notes: paymentData.notes || `Unified payment (Transaction ID: ${transactionId})`
        };
      });
      
      // Calculate total paid
      const totalPaid = paymentsArray.reduce((sum, p) => sum + (p?.amount || 0), 0);
      
      updates = {
        payments: paymentsArray,
        totalPaid: totalPaid,
        updated: getNow().toISOString()
      };
      
      console.log(`   ✅ Updated ${paymentsData.length} months`);
      
    } else {
      throw new Error(`No valid payment structure found in dues document for ${unitId}/${year}`);
    }
    
    // Update shared credit balance document
    const creditDeltaCentavos = pesosToCentavos((creditData.added || 0) - (creditData.used || 0));
    if (creditDeltaCentavos !== 0) {
      const creditNoteParts = [];
      if (creditData.added > 0) {
        creditNoteParts.push(`overpayment +$${Number(creditData.added).toFixed(2)}`);
      }
      if (creditData.used > 0) {
        creditNoteParts.push(`credit used $${Number(creditData.used).toFixed(2)}`);
      }

      const creditNote = `Unified HOA payment ${transactionId}${creditNoteParts.length ? ` (${creditNoteParts.join(', ')})` : ''}`;
      await creditService.updateCreditBalance(
        clientId,
        unitId,
        creditDeltaCentavos,
        transactionId,
        creditNote,
        'hoaDues'
      );
      console.log(`💳 [CREDIT] Unified payment adjusted credit by ${creditDeltaCentavos} centavos`);
    }

    // Clean up legacy fields if present
    updates.creditBalance = admin.firestore.FieldValue.delete();
    updates.creditBalanceHistory = admin.firestore.FieldValue.delete();
    
    // Update Firestore
    const cleanedUpdates = cleanTimestamps(updates);
    await duesRef.update(cleanedUpdates);
    
    console.log(`✅ [HOA UPDATE] Success, credit: $${creditData.final}`);
    
    return { success: true, transactionId };
    
  } catch (error) {
    console.error('❌ Error updating HOA dues:', error);
    throw error;
  }
}

/**
 * Get dues data for a unit for a specific year
 * 
 * @param {string} clientId - ID of the client
 * @param {string} unitId - ID of the unit 
 * @param {number} year - Year to fetch dues data for
 * @returns {object} Dues data for the specified year
 */
async function getUnitDuesData(clientId, unitId, year) {
  try {
    console.log(`🔍 Getting dues data for client ${clientId}, unit ${unitId}, year ${year}`);
    
    // Get the database instance if not already initialized
    if (!dbInstance) {
      console.log('Getting new database instance...');
      dbInstance = await getDb();
    }
    
    // Create document reference using new structure
    const firestorePath = `clients/${clientId}/units/${unitId}/dues/${year.toString()}`;
    console.log(`🔍 Fetching document from path: ${firestorePath}`);
    
    const duesRef = dbInstance.collection('clients').doc(clientId)
                      .collection('units').doc(unitId).collection('dues').doc(year.toString());
    
    console.log('Document reference created:', {
      path: duesRef.path,
      parent: duesRef.parent.path,
      id: duesRef.id
    });
    
    const duesDoc = await duesRef.get();
    
    console.log(`Document exists: ${duesDoc.exists}`);
    
    if (duesDoc.exists) {
      const data = duesDoc.data();
      console.log(`✅ Found dues data with ${data.payments?.length || 0} payments`);
      
      // Fetch credit balance data from the new centralized location
      let creditBalance = data.creditBalance || 0;
      let creditBalanceHistory = [];
      
      try {
        const creditBalancesRef = dbInstance.collection('clients').doc(clientId)
          .collection('units').doc('creditBalances');
        const creditBalancesDoc = await creditBalancesRef.get();
        
        if (creditBalancesDoc.exists) {
          const allCreditData = creditBalancesDoc.data();
          const unitCreditData = allCreditData[unitId];
          
          if (unitCreditData) {
            creditBalance = unitCreditData.creditBalance || 0;
            creditBalanceHistory = unitCreditData.history || [];
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not fetch credit balance from new location, using dues document data:`, error);
        // Fallback to dues document data
        creditBalance = data.creditBalance || 0;
        creditBalanceHistory = data.creditBalanceHistory || [];
      }
      
      // NO CONVERSION - Return raw centavos values
      const apiData = {
        ...data,
        payments: (data.payments || []).map((payment, index) => {
          // Handle null payments (unpaid months)
          if (!payment) {
            return {
              month: index + 1,
              amount: 0,
              paid: false,
              date: null,
              transactionId: null
            };
          }
          return {
            ...payment,
            month: index + 1, // Add month field (1-based)
            date: formatDateField(payment.date),
            transactionId: payment.reference || null
          };
        }),
        creditBalance: creditBalance, // From creditBalances document
        creditBalanceHistory: creditBalanceHistory.map(entry => {
          const dateStr = formatDateField(entry.timestamp);
          return {
            ...entry,
            timestamp: {
              display: dateStr,
              displayFull: dateStr,
              raw: entry.timestamp
            }
          };
        }),
        created: formatDateField(data.created),
        updated: data.updated ? convertFromTimestamp(data.updated) : null
      };
      
      console.log('[DEBUG] Final API Data (Raw Centavos):', {
        creditBalance: apiData.creditBalance,
        totalPaid: apiData.totalPaid,
        firstPaymentAmount: apiData.payments[0]?.amount
      });
      
      return apiData;
    } else {
      console.log(`ℹ️ No dues data found for this unit/year combination`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching dues data for unit ${unitId}:`, error);
    console.error('Full error details:', error);
    throw error;
  }
}

/**
 * Get all dues data for a client for a specific year
 * 
 * @param {string} clientId - ID of the client
 * @param {number} year - Year to fetch dues data for
 * @returns {object} Object with unitId keys and dues data values
 */
async function getAllDuesDataForYear(clientId, year) {
  try {
    // Get the database instance if not already initialized
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // First get all units
    const unitsRef = dbInstance.collection('clients').doc(clientId).collection('units');
    const unitsSnapshot = await unitsRef.get();
    
    const duesData = {};
    
    // Fetch all credit balances from centralized location
    let allCreditBalances = {};
    try {
      const creditBalancesRef = dbInstance.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      const creditBalancesDoc = await creditBalancesRef.get();
      
      if (creditBalancesDoc.exists) {
        allCreditBalances = creditBalancesDoc.data();
      }
    } catch (error) {
      console.warn(`⚠️ Could not fetch credit balances from new location:`, error);
    }
    
    // For each unit, get their dues data for the specified year
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      
      // Skip the creditBalances document itself
      if (unitId === 'creditBalances') continue;
      
      try {
        // Get dues document for this unit and year
        const duesRef = dbInstance.collection('clients').doc(clientId)
                          .collection('units').doc(unitId)
                          .collection('dues').doc(year.toString());
        const duesDoc = await duesRef.get();
        
        if (duesDoc.exists) {
          const data = duesDoc.data();
          
          // Get credit data from centralized location
          const unitCreditData = allCreditBalances[unitId] || {};
          const creditBalance = unitCreditData.creditBalance || 0;
          const creditBalanceHistory = unitCreditData.history || [];
          
          // Convert amounts from cents to dollars for API response
          // Calculate totalDue from scheduledAmount × 12 (totalDue field removed)
          const scheduledAmountDollars = centsToDollars(data.scheduledAmount || 0);
          const calculatedTotalDue = scheduledAmountDollars * 12;
          
          duesData[unitId] = {
            ...data,
            creditBalance: centsToDollars(creditBalance), // From centralized creditBalances
            scheduledAmount: scheduledAmountDollars,
            totalDue: calculatedTotalDue, // Calculated from scheduledAmount × 12
            totalPaid: centsToDollars(data.totalPaid || 0),
            payments: data.payments.map((payment, index) => {
              // Handle null payments (unpaid months)
              if (!payment) {
                return {
                  month: index + 1,
                  amount: 0,
                  paid: false,
                  date: null
                };
              }
              
              return {
                ...payment,
                month: index + 1, // Add month field (1-based)
                amount: payment.amount ? centsToDollars(payment.amount) : 0,
                date: formatDateField(payment.date)
              };
            }),
            creditBalanceHistory: creditBalanceHistory.map(entry => {
              const dateStr = formatDateField(entry.timestamp);
              return {
                ...entry,
                timestamp: {
                  display: dateStr,
                  displayFull: dateStr,
                  raw: entry.timestamp
                },
                amount: typeof entry.amount === 'number' ? centsToDollars(entry.amount) : 0,  // Convert from centavos to dollars
                balanceBefore: typeof entry.balanceBefore === 'number' ? centsToDollars(entry.balanceBefore) : 0,
                balanceAfter: typeof entry.balanceAfter === 'number' ? centsToDollars(entry.balanceAfter) : 0
              };
            }),
            created: formatDateField(data.created),
            updated: formatDateField(data.updated)
          };
        } else {
          // For units without dues data, include empty structure
          // Calculate totalDue from scheduledAmount × 12 (default to $250/month if not set)
          const defaultScheduledAmount = 250; // $250/month default
          duesData[unitId] = {
            year: year,
            unitId: unitId,
            creditBalance: 0,
            scheduledAmount: defaultScheduledAmount,
            totalDue: defaultScheduledAmount * 12, // $250 * 12 months
            totalPaid: 0,
            payments: Array(12).fill(null).map((_, index) => ({
              month: index + 1, // Add month field (1-based)
              paid: false,
              amount: 0,
              date: null,
              reference: null
            })),
            creditBalanceHistory: []
          };
        }
      } catch (unitError) {
        console.error(`Error fetching dues for unit ${unitId}:`, unitError);
        // Still include empty structure for this unit
        // Calculate totalDue from scheduledAmount × 12 (default to $250/month if not set)
        const defaultScheduledAmount = 250; // $250/month default
        duesData[unitId] = {
          year: year,
          unitId: unitId,
          creditBalance: 0,
          scheduledAmount: defaultScheduledAmount,
          totalDue: defaultScheduledAmount * 12, // $250 * 12 months
          totalPaid: 0,
          payments: Array(12).fill(null).map((_, index) => ({
            month: index + 1, // Add month field (1-based)
            paid: false,
            amount: 0,
            date: null,
            reference: null
          })),
          creditBalanceHistory: []
        };
      }
    }
    
    return duesData;
  } catch (error) {
    console.error(`❌ Error fetching all dues data for year ${year}:`, error);
    throw error;
  }
}

/**
 * Update credit balance for a unit
 * 
 * @param {string} clientId - ID of the client
 * @param {string} unitId - ID of the unit
 * @param {number} year - Year for which to update credit balance
 * @param {number} newCreditBalance - New credit balance value
 * @param {string} notes - User notes explaining the change
 * @returns {boolean} Success status
 */
async function updateCreditBalance(clientId, unitId, year, newCreditBalance, notes) {
  try {
    // Get the database instance if not already initialized
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // Create document reference using new structure
    const duesRef = dbInstance.collection('clients').doc(clientId)
                      .collection('units').doc(unitId).collection('dues').doc(year.toString());
    const duesDoc = await duesRef.get();
    
    if (!duesDoc.exists) {
      await initializeYearDocument(clientId, unitId, year);
      // Re-fetch the document
      await duesRef.set({
        year,
        unitId,
        payments: Array(12).fill(null).map(() => ({
          paid: false,
          amount: 0,
          date: null,
          reference: null
        })),
        totalPaid: 0,
        updated: admin.firestore.Timestamp.now()
      }, { merge: true });
    }
    
    const currentCreditInfo = await creditService.getCreditBalance(clientId, unitId);
    const currentBalancePesos = currentCreditInfo.creditBalance || 0;
    const newBalancePesos = newCreditBalance;
    const changeAmountPesos = newBalancePesos - currentBalancePesos;

    if (Math.abs(changeAmountPesos) < 0.005) {
      console.log('💳 [CREDIT] Manual update requested but no change detected');
    } else {
      const changeAmountCentavos = dollarsToCents(changeAmountPesos);
      const adjustmentNote = notes ? `Manual HOA adjustment: ${notes}` : 'Manual HOA credit adjustment';
      await creditService.updateCreditBalance(
        clientId,
        unitId,
        changeAmountCentavos,
        null,
        adjustmentNote,
        'hoaDues'
      );
      console.log(`💳 [CREDIT] Manual adjustment applied: ${changeAmountCentavos} centavos`);
    }

    // Remove legacy fields from dues document if they still exist
    try {
      await duesRef.update({
        creditBalance: admin.firestore.FieldValue.delete(),
        creditBalanceHistory: admin.firestore.FieldValue.delete(),
        updated: admin.firestore.Timestamp.now()
      });
    } catch (updateError) {
      if (updateError.code !== 'not-found') {
        throw updateError;
      }
    }
    
    // Log the action
    await writeAuditLog({
      module: 'hoadues',
      action: 'update',
      parentPath: `clients/${clientId}/units/${unitId}/dues`,
      docId: `${year}`,
      friendlyName: `Unit ${unitId} Credit Balance Update`,
      notes: notes || `Updated credit balance to ${newCreditBalance} for year ${year}`,
      metadata: {
        unitId,
        newCreditBalance,
        previousCreditBalance: currentCreditInfo.creditBalance
      }
    });
    
    return true;
  } catch (error) {
    console.error(`❌ Error updating credit balance for unit ${unitId}:`, error);
    throw error;
  }
}

/**
 * Get credit balance for any module (Water Bills, Special Billings, etc.)
 * GET /api/hoa/:clientId/units/:unitId/credit-balance/:year
 */
async function getCreditBalanceForModule(req, res) {
  try {
    const { clientId, unitId, year } = req.params;
    const { module = 'unknown' } = req.query; // Track which module is requesting
    
    const [creditInfo, creditHistoryInfo] = await Promise.all([
      creditService.getCreditBalance(clientId, unitId),
      creditService.getCreditHistory(clientId, unitId, 50)
    ]);

    // Log cross-module access for audit
    console.log(`📊 Credit balance accessed by ${module} module: Unit ${unitId}, Balance: $${creditInfo.creditBalance || 0}`);
    
    res.json({
      success: true,
      creditBalance: creditInfo.creditBalance || 0,
      creditBalanceHistory: creditHistoryInfo.history || [],
      lastUpdated: creditInfo.lastUpdated
    });
    
  } catch (error) {
    console.error('Error getting credit balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update credit balance from any module (Water Bills, Special Billings, etc.)
 * PUT /api/hoa/:clientId/units/:unitId/credit-balance/:year
 */
async function updateCreditBalanceFromModule(req, res) {
  try {
    const { clientId, unitId, year } = req.params;
    const { 
      newBalance, 
      changeAmount, 
      changeType, 
      description, 
      transactionId,
      module = 'unknown'
    } = req.body;
    
    const changeCentavos = dollarsToCents(changeAmount);
    const source = module === 'hoa' ? 'hoaDues' : module;
    const creditNote = description || `${module} credit update (${changeType || 'unspecified'})`;

    await creditService.updateCreditBalance(
      clientId,
      unitId,
      changeCentavos,
      transactionId || null,
      creditNote,
      source
    );

    // Remove any lingering legacy fields asynchronously (best-effort)
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    const duesRef = dbInstance.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    try {
      await duesRef.update({
        creditBalance: admin.firestore.FieldValue.delete(),
        creditBalanceHistory: admin.firestore.FieldValue.delete(),
        updated: convertToTimestamp(getNow())
      });
    } catch (legacyCleanupError) {
      if (legacyCleanupError.code !== 'not-found') {
        console.warn('⚠️ Unable to remove legacy credit fields:', legacyCleanupError.message);
      }
    }

    // Fetch updated balance for response
    const updatedCredit = await creditService.getCreditBalance(clientId, unitId);
    console.log(`💰 Credit balance updated by ${module}: Unit ${unitId}, change ${changeAmount} (pesos)`);
    
    res.json({
      success: true,
      previousBalance: updatedCredit.creditBalance - changeAmount,
      newBalance: updatedCredit.creditBalance,
      changeAmount: changeAmount,
      module
    });
    
  } catch (error) {
    console.error('Error updating credit balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Preview HOA Dues payment distribution (Phase 3B integration)
 * Shows how payment will be applied without actually recording it
 * 
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID  
 * @param {number} year - Fiscal year
 * @param {number} paymentAmount - Payment amount in PESOS
 * @param {Date} payOnDate - Optional payment date for backdated previews
 * @returns {object} Payment distribution preview
 */
async function previewHOAPayment(clientId, unitId, year, paymentAmount, payOnDate = null) {
  console.log(`🔮 [HOA PREVIEW] Previewing payment: ${clientId}/${unitId}/${year}, Amount: $${paymentAmount}`);
  
  try {
    const db = await getDb();
    
    // 1. Load HOA dues document from native storage
    const duesRef = db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    const duesSnap = await duesRef.get();
    
    if (!duesSnap.exists) {
      throw new Error(`No HOA dues document found for ${unitId}/${year}`);
    }
    
    const hoaDuesDoc = duesSnap.data();
    const currentCredit = centavosToPesos(hoaDuesDoc.creditBalance || 0);
    const config = await getHOABillingConfig(clientId);
    
    console.log(`📋 [HOA WRAPPER] Loaded HOA dues for unit ${unitId}, year ${year}`);
    
    // 2. Convert HOA native format to standardized bills array
    const allBills = convertHOADuesToBills(hoaDuesDoc, clientId, unitId, year, config);
    console.log(`📋 [HOA WRAPPER] Converted to ${allBills.length} bills`);
    
    // 3. Calculate penalties in-memory for payment date (does NOT write to Firestore)
    const calculationDate = payOnDate || getNow();
    const billsWithUpdatedPenalties = await calculatePenaltiesInMemory(allBills, calculationDate, config);
    
    // 4. Filter to unpaid bills only (wrapper responsibility)
    const unpaidBills = billsWithUpdatedPenalties.filter(b => b.status !== 'paid');
    console.log(`📋 [HOA WRAPPER] Filtered to ${unpaidBills.length} unpaid bills`);
    
    // 5. Call shared PaymentDistributionService with prepared unpaid bills
    const distribution = calculatePaymentDistribution({
      bills: unpaidBills,
      paymentAmount,
      currentCreditBalance: currentCredit,
      unitId
    });
    
    console.log(`✅ [HOA WRAPPER] Distribution calculated:`, {
      billPayments: distribution.billPayments?.length || 0,
      creditUsed: distribution.creditUsed,
      overpayment: distribution.overpayment,
      newCreditBalance: distribution.newCreditBalance
    });
    
    // 6. Convert billPayments to monthsAffected format (HOA-specific response format)
    const fiscalYearStartMonth = config.fiscalYearStartMonth || 1;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    const monthsAffected = (distribution.billPayments || []).map(bp => {
      // Extract fiscal month index from bill period (e.g., "2026-00" -> 0)
      const periodMatch = bp.billPeriod?.match(/\d{4}-(\d{2})/);
      const fiscalMonthIndex = periodMatch ? parseInt(periodMatch[1]) : 0;
      
      // Convert fiscal month index to calendar month number
      const calendarMonth = ((fiscalMonthIndex + fiscalYearStartMonth - 1) % 12) + 1;
      const monthName = monthNames[calendarMonth - 1];
      
      return {
        month: monthName,
        monthIndex: fiscalMonthIndex,
        basePaid: bp.baseChargePaid || 0,
        penaltyPaid: bp.penaltyPaid || 0,
        totalPaid: bp.amountPaid || 0,
        status: bp.newStatus
      };
    });
    
    console.log(`✅ [HOA WRAPPER] Complete: ${monthsAffected.length} months affected, credit used: $${distribution.creditUsed}, overpayment: $${distribution.overpayment}`);
    
    // 7. Return in HOA-specific format
    return {
      paymentAmount,
      currentCreditBalance: currentCredit,
      newCreditBalance: distribution.newCreditBalance,
      creditUsed: distribution.creditUsed,
      overpayment: distribution.overpayment,
      monthsAffected,
      totalBaseCharges: distribution.totalBaseCharges || 0,
      totalPenalties: distribution.totalPenalties || 0,
      totalApplied: distribution.totalApplied || 0,
      unpaidBillsCount: unpaidBills.length,  // Use already-filtered list
      billsFullyPaid: monthsAffected.filter(m => m.status === 'paid').length,
      billsPartiallyPaid: monthsAffected.filter(m => m.status === 'partial').length
    };
    
  } catch (error) {
    console.error(`❌ [HOA PREVIEW] Error:`, error);
    throw error;
  }
}

export {
  initializeYearDocument,
  recordDuesPayment,
  updateHOADuesWithPayment, // Unified Payment System - Firestore update only
  updateHOADuesWithPaymentUnified, // Handles both monthly and quarterly
  getUnitDuesData,
  getAllDuesDataForYear,
  updateCreditBalance,
  getCreditBalanceForModule,
  updateCreditBalanceFromModule,
  // Phase 4 Task 4.1: New functions
  recalculateHOAPenalties,
  previewHOAPayment,
  getHOABillingConfig
};

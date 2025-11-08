/**
 * Penalty Recalculation Service
 * 
 * Extracted from Water Bills (Phase 3C - Priority 0B)
 * Provides penalty calculation logic reusable across all billing modules
 * 
 * Penalty Rules (Per Condominium Contract):
 * - Bills are due on specified date (default: 1st of month)
 * - Grace period: configurable days (default 10)
 * - After grace period: Compounding penalty applied monthly
 * - Penalty rate: configurable % (default 10%)
 * - Formula: Penalty = (Principal + Previous Penalty) × rate × months
 * 
 * Compounding Example (10% rate):
 * - Month 1: $1000 × 10% = $100 penalty
 * - Month 2: ($1000 + $100) × 10% = $110 penalty (total $210)
 * - Month 3: ($1000 + $210) × 10% = $121 penalty (total $331)
 * 
 * All amounts in INTEGER CENTAVOS internally for precision
 */

import { getNow, parseDate, createDate, addDays } from './DateService.js';
import { centavosToPesos } from '../utils/currencyUtils.js';
import { getDb } from '../../backend/firebase.js';
import { validatePenaltyConfig as validatePenaltyConfigShared } from '../utils/configValidation.js';

/**
 * Validate penalty configuration
 * 
 * @param {object} config - Billing configuration
 * @param {number} config.penaltyRate - Penalty rate (default 0.10 = 10%)
 * @param {number} config.penaltyDays - Grace period days (default 10)
 * @returns {object} Validated configuration with defaults
 * @throws {Error} If config has invalid values
 */
export function validatePenaltyConfig(config) {
  // Use shared validation utility for required fields check
  const validated = validatePenaltyConfigShared(config, 'penalty recalculation');
  
  // Add local type validation
  if (typeof validated.penaltyRate !== 'number' || validated.penaltyRate < 0) {
    throw new Error('penaltyRate must be a non-negative number');
  }
  
  if (typeof validated.penaltyDays !== 'number' || validated.penaltyDays < 0) {
    throw new Error('penaltyDays must be a non-negative number');
  }
  
  // Return with penaltyFrequency added
  return {
    ...validated,
    penaltyFrequency: config.penaltyFrequency || 'monthly'
  };
}

/**
 * Calculate due date for a bill
 * 
 * Default logic: 1st day of month + grace period
 * If bill has explicit dueDate, use that instead
 * 
 * @param {object} bill - Bill object
 * @param {string} bill.billId - Bill ID (format: YYYY-MM)
 * @param {string} bill.dueDate - Optional explicit due date
 * @param {object} config - Billing configuration
 * @returns {Date} Due date
 */
export function calculateDueDate(bill, config) {
  // If bill has explicit due date, use it
  if (bill.dueDate) {
    return parseDate(bill.dueDate);
  }
  
  // Parse bill ID to get month/year
  // Format: "2026-00" where 2026 = fiscal year, 00 = month (0-11)
  const [fiscalYearStr, monthStr] = bill.billId.split('-');
  const fiscalYear = parseInt(fiscalYearStr);
  const fiscalMonth = parseInt(monthStr);
  
  // Convert fiscal month to calendar month
  // Fiscal month 0 (July) = calendar month 7
  let calendarMonth = fiscalMonth + 6;
  let calendarYear = fiscalYear - 1; // Fiscal year 2026 starts in calendar year 2025
  
  // Handle year wraparound (fiscal months 6-11 are Jan-June of next calendar year)
  if (calendarMonth >= 12) {
    calendarMonth -= 12;
    calendarYear += 1;
  }
  
  // Create due date: 1st of the month (createDate uses 1-based month)
  const dueDate = createDate(calendarYear, calendarMonth + 1, 1);
  
  return dueDate;
}

/**
 * Calculate months overdue
 * 
 * CRITICAL BUSINESS LOGIC: Penalties start IMMEDIATELY after grace period ends
 * - Any time past grace period = at least 1 month penalty
 * - Additional months calculated based on days elapsed / 30
 * 
 * @param {Date} dueDate - Bill due date
 * @param {Date} asOfDate - Current date or payment date
 * @param {number} gracePeriodDays - Grace period in days
 * @returns {number} Number of months overdue (minimum 1 if past grace, 0 if within grace)
 */
export function calculateMonthsOverdue(dueDate, asOfDate, gracePeriodDays = 10) {
  // Calculate grace period end date
  const gracePeriodEnd = addDays(dueDate, gracePeriodDays);
  
  // If not yet past grace period, return 0
  if (asOfDate <= gracePeriodEnd) {
    return 0;
  }
  
  // Calculate days past grace period
  const daysPastGrace = Math.floor((asOfDate.getTime() - gracePeriodEnd.getTime()) / (24 * 60 * 60 * 1000));
  
  // Penalties start immediately after grace period ends
  // Calculate fractional months (30 days = 1 month) and round UP
  // This ensures even 1 day past grace = 1 month penalty
  const monthsOverdue = Math.ceil(daysPastGrace / 30);
  
  // Minimum 1 month if past grace period at all
  return Math.max(1, monthsOverdue);
}

/**
 * Calculate compounding penalty amount
 * 
 * Compounding formula: Each month, penalty applies to (principal + previous penalties)
 * 
 * @param {number} baseAmount - Base charge in CENTAVOS
 * @param {number} previousPenalty - Existing penalty in CENTAVOS (default 0)
 * @param {number} monthsOverdue - Number of months overdue
 * @param {number} penaltyRate - Penalty rate (default 0.10 = 10%)
 * @returns {number} Total penalty amount in CENTAVOS
 */
export function calculateCompoundingPenalty(baseAmount, previousPenalty = 0, monthsOverdue, penaltyRate = 0.10) {
  if (monthsOverdue <= 0) {
    return 0;
  }
  
  // Compounding logic: Start with base (unpaid principal)
  let runningTotal = baseAmount;
  let totalPenalty = 0;
  
  console.log(`🧮 [COMPOUND_CALC] Starting: base=${baseAmount} centavos, months=${monthsOverdue}, rate=${penaltyRate}`);
  
  for (let month = 1; month <= monthsOverdue; month++) {
    const monthlyPenalty = runningTotal * penaltyRate;
    totalPenalty += monthlyPenalty;
    runningTotal += monthlyPenalty;
    
    console.log(`🧮 [COMPOUND_CALC] Month ${month}: ${Math.round(runningTotal)} centavos × ${penaltyRate} = ${Math.round(monthlyPenalty)} penalty (total: ${Math.round(totalPenalty)} centavos)`);
  }
  
  return Math.round(totalPenalty);
}

/**
 * Group bills by their due date
 * 
 * PHASE 5 TASK 5.2: Bills sharing the same due date are grouped together
 * This enables frequency-agnostic penalty calculation:
 * - Monthly: Each bill has unique due date → 1 bill per group
 * - Quarterly: 3 bills share due date → 3 bills per group
 * 
 * @param {Array} bills - Array of bills with dueDate property
 * @returns {Object} Map of dueDate -> array of bills
 */
export function groupBillsByDueDate(bills) {
  const groups = {};
  
  bills.forEach(bill => {
    // Normalize due date to string (YYYY-MM-DD format)
    let dueDateStr;
    if (typeof bill.dueDate === 'string') {
      dueDateStr = bill.dueDate.split('T')[0]; // Extract date part from ISO string
    } else if (bill.dueDate instanceof Date) {
      dueDateStr = bill.dueDate.toISOString().split('T')[0];
    } else {
      console.warn(`⚠️  Bill ${bill.billId} has invalid dueDate:`, bill.dueDate);
      dueDateStr = 'unknown';
    }
    
    if (!groups[dueDateStr]) {
      groups[dueDateStr] = [];
    }
    
    groups[dueDateStr].push(bill);
  });
  
  console.log(`📦 [GROUPING] Grouped ${bills.length} bills into ${Object.keys(groups).length} due date group(s)`);
  Object.entries(groups).forEach(([date, groupBills]) => {
    console.log(`   ${date}: ${groupBills.length} bill(s)`);
  });
  
  return groups;
}

/**
 * Calculate penalty for a single bill
 * 
 * Core penalty calculation algorithm with compounding logic
 * 
 * @param {object} params - Calculation parameters
 * @param {object} params.bill - Bill object
 * @param {number} params.bill.currentCharge - Base charge in CENTAVOS
 * @param {number} params.bill.paidAmount - Amount paid in CENTAVOS
 * @param {number} params.bill.penaltyAmount - Existing penalty in CENTAVOS
 * @param {Date} params.asOfDate - Calculate penalties as of this date
 * @param {object} params.config - Billing configuration
 * @returns {object} Penalty calculation result
 * @returns {number} result.penaltyAmount - New penalty amount in CENTAVOS
 * @returns {boolean} result.updated - Whether penalty was updated
 * @returns {object} result.details - Calculation details
 */
export function calculatePenaltyForBill(params) {
  const { bill, asOfDate, config } = params;
  
  // Validate config
  const validatedConfig = validatePenaltyConfig(config);
  
  const result = {
    penaltyAmount: bill.penaltyAmount || 0,  // Start with existing penalty
    updated: false,
    details: {
      overdueAmount: Math.max(0, (bill.currentCharge || 0) - (bill.paidAmount || 0)),
      chargeAmount: bill.currentCharge || 0,
      penaltyRate: validatedConfig.penaltyRate,
      graceDays: validatedConfig.penaltyDays,
      lastUpdate: bill.lastPenaltyUpdate
    }
  };
  
  // Calculate due date
  const dueDate = calculateDueDate(bill, validatedConfig);
  const gracePeriodEnd = addDays(dueDate, validatedConfig.penaltyDays);
  
  // Check if past grace period
  // CRITICAL FIX: Use >= instead of > so that payment on grace period end date applies penalties
  // This matches the logic in calculateMonthsOverdue() which uses <= for "not overdue"
  const pastGracePeriod = asOfDate >= gracePeriodEnd;
  
  console.log(`📅 Date Check - Current: ${asOfDate.toISOString()}, Due: ${dueDate.toISOString()}, Grace End: ${gracePeriodEnd.toISOString()}, Past: ${pastGracePeriod}`);
  
  // Calculate overdue amount (unpaid principal, excluding penalties)
  const overdueAmount = Math.max(0, (bill.currentCharge || 0) - (bill.paidAmount || 0));
  
  console.log(`🔍 [PENALTY_DEBUG] Bill: charge=${bill.currentCharge}, paid=${bill.paidAmount}, currentPenalty=${bill.penaltyAmount}`);
  console.log(`🔍 [PENALTY_DEBUG] Overdue: ${overdueAmount} centavos ($${centavosToPesos(overdueAmount)})`);
  
  if (pastGracePeriod && overdueAmount > 0) {
    // Calculate months overdue
    const monthsOverdue = calculateMonthsOverdue(dueDate, asOfDate, validatedConfig.penaltyDays);
    console.log(`🔢 Months overdue: ${monthsOverdue}`);
    
    // Calculate compounding penalty
    const expectedPenalty = calculateCompoundingPenalty(
      overdueAmount,
      0, // Start fresh each time (full recalculation)
      monthsOverdue,
      validatedConfig.penaltyRate
    );
    
    // Update if penalty changed (allow 1 centavo tolerance for rounding)
    if (Math.abs(result.penaltyAmount - expectedPenalty) > 1) {
      console.log(`💰 Updating penalty: ${result.penaltyAmount} → ${expectedPenalty} centavos`);
      result.penaltyAmount = expectedPenalty;
      result.updated = true;
      result.details.lastUpdate = asOfDate.toISOString();
      result.details.monthsOverdue = monthsOverdue;
    } else {
      console.log(`✅ Penalty up-to-date: ${result.penaltyAmount} centavos`);
    }
  }
  
  return result;
}

/**
 * Recalculate penalties for multiple bills with DUE DATE GROUPING
 * 
 * PHASE 5 TASK 5.2: Frequency-agnostic penalty calculation
 * - Groups bills by due date
 * - Calculates penalty on group total
 * - Distributes penalty equally across unpaid bills in group
 * 
 * Module-agnostic penalty recalculation for water, hoa, or any billing module
 * 
 * @param {object} params - Recalculation parameters
 * @param {string} params.clientId - Client ID
 * @param {string} params.moduleType - 'water' or 'hoa'
 * @param {Array} params.bills - Array of bill objects to recalculate
 * @param {Date} params.asOfDate - Calculate penalties as of this date (default: now)
 * @param {object} params.config - Billing configuration
 * 
 * @returns {object} Recalculation result
 * @returns {Array} result.updatedBills - Bills with recalculated penalties
 * @returns {number} result.totalPenaltiesAdded - Total penalty amount added (centavos)
 * @returns {number} result.billsUpdated - Count of bills with penalty changes
 * @returns {number} result.billsProcessed - Total bills processed
 */
export async function recalculatePenalties(params) {
  const {
    clientId,
    moduleType = 'water',
    bills,
    asOfDate = getNow(),
    config
  } = params;
  
  console.log(`🔄 [PENALTY_RECALC] Starting for ${moduleType}: ${bills.length} bills`);
  console.log(`📅 [PENALTY_RECALC] Calculation date: ${asOfDate.toISOString()}`);
  
  // Validate configuration
  const validatedConfig = validatePenaltyConfig(config);
  
  const result = {
    clientId,
    moduleType,
    updatedBills: [],
    totalPenaltiesAdded: 0,
    billsUpdated: 0,
    billsProcessed: 0,
    billsSkipped: 0,
    groupsProcessed: 0
  };
  
  // PHASE 5 TASK 5.2: Group bills by due date
  const billGroups = groupBillsByDueDate(bills);
  
  // Process each due date group
  for (const [dueDate, groupBills] of Object.entries(billGroups)) {
    result.groupsProcessed++;
    
    console.log(`\n💰 [GROUP ${result.groupsProcessed}] Processing due date: ${dueDate} (${groupBills.length} bills)`);
    
    // Filter to unpaid bills only
    const unpaidBills = groupBills.filter(b => b.status !== 'paid');
    const paidBills = groupBills.filter(b => b.status === 'paid');
    
    console.log(`   📊 Unpaid: ${unpaidBills.length}, Paid: ${paidBills.length}`);
    
    if (unpaidBills.length === 0) {
      console.log(`   ✅ All bills paid - no penalties to calculate`);
      result.billsSkipped += groupBills.length;
      
      // Add paid bills to result with zero penalty
      paidBills.forEach(bill => {
        result.updatedBills.push({
          ...bill,
          penaltyAmount: 0,
          totalAmount: bill.currentCharge
        });
      });
      continue;
    }
    
    // Calculate total unpaid amount for this group
    const totalUnpaid = unpaidBills.reduce((sum, bill) => {
      return sum + Math.max(0, (bill.currentCharge || 0) - (bill.paidAmount || 0));
    }, 0);
    
    console.log(`   💵 Total unpaid in group: ${totalUnpaid} centavos ($${centavosToPesos(totalUnpaid)})`);
    
    // Calculate due date and grace period for group
    const dueDateObj = parseDate(dueDate);
    const gracePeriodEnd = addDays(dueDateObj, validatedConfig.penaltyDays);
    const pastGracePeriod = asOfDate >= gracePeriodEnd;
    
    console.log(`   📅 Due: ${dueDate}, Grace End: ${gracePeriodEnd.toISOString().split('T')[0]}, Past Grace: ${pastGracePeriod}`);
    
    if (!pastGracePeriod || totalUnpaid === 0) {
      console.log(`   ⏭️  No penalty (within grace period or fully paid)`);
      result.billsSkipped += groupBills.length;
      
      // Add all bills with zero penalty
      groupBills.forEach(bill => {
        result.updatedBills.push({
          ...bill,
          penaltyAmount: 0,
          totalAmount: bill.currentCharge
        });
      });
      continue;
    }
    
    // Calculate months overdue for the group
    const monthsOverdue = calculateMonthsOverdue(dueDateObj, asOfDate, validatedConfig.penaltyDays);
    console.log(`   🔢 Months overdue: ${monthsOverdue}`);
    
    // Calculate compounding penalty on GROUP TOTAL
    const totalPenalty = calculateCompoundingPenalty(
      totalUnpaid,
      0, // Starting penalty (fresh calculation)
      monthsOverdue,
      validatedConfig.penaltyRate
    );

    console.log(`   💰 Group total penalty: ${totalPenalty} centavos ($${centavosToPesos(totalPenalty)})`);
    
    // Distribute penalty equally across unpaid bills in group
    const penaltyPerBill = Math.round(totalPenalty / unpaidBills.length);
    console.log(`   📤 Penalty per unpaid bill: ${penaltyPerBill} centavos ($${centavosToPesos(penaltyPerBill)})`);
    
    // Handle rounding: last bill gets adjustment
    let distributedSoFar = 0;
    
    groupBills.forEach((bill, index) => {
      result.billsProcessed++;
      
      if (bill.status === 'paid') {
        // Paid bills get zero penalty
        result.updatedBills.push({
          ...bill,
          penaltyAmount: 0,
          totalAmount: bill.currentCharge
        });
        return;
      }
      
      // Calculate this bill's penalty share
      const isLastUnpaidBill = (index === groupBills.length - 1) || 
                                (groupBills.slice(index + 1).every(b => b.status === 'paid'));
      
      const billPenalty = isLastUnpaidBill 
        ? totalPenalty - distributedSoFar  // Last bill gets rounding adjustment
        : penaltyPerBill;
      
      distributedSoFar += billPenalty;
      
      // Check if penalty changed
      const oldPenalty = bill.penaltyAmount || 0;
      if (Math.abs(oldPenalty - billPenalty) > 1) {
        result.billsUpdated++;
        result.totalPenaltiesAdded += (billPenalty - oldPenalty);
        console.log(`   ✏️  Bill ${bill.billId}: ${oldPenalty} → ${billPenalty} centavos`);
      }
      
      result.updatedBills.push({
        ...bill,
        penaltyAmount: billPenalty,
        totalAmount: (bill.currentCharge || 0) + billPenalty,
        lastPenaltyUpdate: asOfDate.toISOString()
      });
    });
    
    console.log(`   ✅ Group complete: ${unpaidBills.length} bills with penalties`);
  }
  
  console.log(`\n✅ [PENALTY_RECALC] Complete: ${result.groupsProcessed} groups, ${result.billsUpdated} bills updated, ${result.billsSkipped} skipped`);
  console.log(`   💰 Total penalties added: ${result.totalPenaltiesAdded} centavos ($${centavosToPesos(result.totalPenaltiesAdded)})`);
  
  return result;
}

/**
 * Load billing configuration for penalty calculation
 * 
 * Module-agnostic: loads config from appropriate collection
 * 
 * @param {string} clientId - Client ID
 * @param {string} moduleType - 'water' or 'hoa'
 * @returns {Promise<object>} Billing configuration
 */
export async function loadBillingConfig(clientId, moduleType = 'water') {
  const db = await getDb();
  const configDocName = moduleType === 'water' ? 'waterBills' : 'hoaDues';
  
  const configDoc = await db
    .collection('clients').doc(clientId)
    .collection('config').doc(configDocName)
    .get();
  
  if (!configDoc.exists) {
    // Fail fast - no defaults
    throw new Error(`Billing configuration not found for client ${clientId}, module ${moduleType}`);
  }
  
  return configDoc.data();
}

/**
 * Export helper functions for testing
 */
export const __testing = {
  calculateDueDate,
  calculateMonthsOverdue,
  calculateCompoundingPenalty
};


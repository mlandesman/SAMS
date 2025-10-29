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

import { getNow } from './DateService.js';
import { centavosToPesos } from '../utils/currencyUtils.js';
import { getDb } from '../../backend/firebase.js';

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
  const validated = {
    penaltyRate: config.penaltyRate || 0.10, // Default 10%
    penaltyDays: config.penaltyDays || 10,    // Default 10 days grace
    penaltyFrequency: config.penaltyFrequency || 'monthly'
  };
  
  // Validate penalty rate
  if (typeof validated.penaltyRate !== 'number' || validated.penaltyRate < 0) {
    throw new Error('penaltyRate must be a non-negative number');
  }
  
  // Validate grace period
  if (typeof validated.penaltyDays !== 'number' || validated.penaltyDays < 0) {
    throw new Error('penaltyDays must be a non-negative number');
  }
  
  return validated;
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
    return new Date(bill.dueDate);
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
  
  // Create due date: 1st of the month
  const dueDate = new Date(calendarYear, calendarMonth, 1);
  
  return dueDate;
}

/**
 * Calculate months overdue
 * 
 * Returns number of complete months between due date (+ grace period) and current date
 * 
 * @param {Date} dueDate - Bill due date
 * @param {Date} asOfDate - Current date or payment date
 * @param {number} gracePeriodDays - Grace period in days
 * @returns {number} Number of complete months overdue (0 if not yet overdue)
 */
export function calculateMonthsOverdue(dueDate, asOfDate, gracePeriodDays = 10) {
  // Calculate grace period end date
  const gracePeriodEnd = new Date(dueDate);
  gracePeriodEnd.setDate(dueDate.getDate() + gracePeriodDays);
  
  // If not yet past grace period, return 0
  if (asOfDate <= gracePeriodEnd) {
    return 0;
  }
  
  // Calculate complete months between grace period end and current date
  const months = (asOfDate.getFullYear() - gracePeriodEnd.getFullYear()) * 12 + 
                 (asOfDate.getMonth() - gracePeriodEnd.getMonth());
  
  return Math.max(0, months);
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
  const gracePeriodEnd = new Date(dueDate);
  gracePeriodEnd.setDate(dueDate.getDate() + validatedConfig.penaltyDays);
  
  // Check if past grace period
  const pastGracePeriod = asOfDate > gracePeriodEnd;
  
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
 * Recalculate penalties for multiple bills
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
  
  // Validate configuration
  const validatedConfig = validatePenaltyConfig(config);
  
  const result = {
    clientId,
    moduleType,
    updatedBills: [],
    totalPenaltiesAdded: 0,
    billsUpdated: 0,
    billsProcessed: 0,
    billsSkipped: 0
  };
  
  for (const bill of bills) {
    result.billsProcessed++;
    
    // Skip paid bills (they can't accumulate penalties)
    if (bill.status === 'paid') {
      result.billsSkipped++;
      continue;
    }
    
    // Calculate penalty for this bill
    const penaltyResult = calculatePenaltyForBill({
      bill,
      asOfDate,
      config: validatedConfig
    });
    
    if (penaltyResult.updated) {
      // Update bill with new penalty
      const updatedBill = {
        ...bill,
        penaltyAmount: penaltyResult.penaltyAmount,
        totalAmount: (bill.currentCharge || 0) + penaltyResult.penaltyAmount,
        lastPenaltyUpdate: penaltyResult.details.lastUpdate
      };
      
      result.updatedBills.push(updatedBill);
      result.totalPenaltiesAdded += (penaltyResult.penaltyAmount - (bill.penaltyAmount || 0));
      result.billsUpdated++;
      
      console.log(`Updated ${moduleType} penalty for bill ${bill.billId}: $${centavosToPesos(penaltyResult.penaltyAmount)}`);
    }
  }
  
  console.log(`✅ [PENALTY_RECALC] Complete: ${result.billsUpdated} bills updated, ${result.billsSkipped} skipped`);
  
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
    // Return default config
    console.warn(`⚠️  No ${moduleType} billing config found for ${clientId}, using defaults`);
    return {
      penaltyRate: 0.10,  // 10% default
      penaltyDays: 10     // 10 days grace default
    };
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


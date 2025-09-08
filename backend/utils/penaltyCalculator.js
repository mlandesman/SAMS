/**
 * Dynamic Penalty Calculator for Water Bills
 * Calculates real-time penalties based on current date vs due date
 * Supports both simple and compound penalty calculations
 */

import { normalizeDate } from './timestampUtils.js';
import { getMexicoDate, getMexicoDateString } from './timezone.js';

/**
 * Calculate current penalties for an array of base amounts and due dates
 * @param {Array} bills - Array of {baseAmount, dueDate, gracePeriodsInDays, penaltyRate, compoundPenalty}
 * @param {Date} currentDate - Current date for calculation (defaults to now)
 * @returns {Array} Array of {baseAmount, penaltyAmount, totalAmount, daysOverdue, monthsOverdue, dueDate}
 */
export function calculateCurrentPenalties(bills, currentDate = null) {
  const defaultGracePeriod = 10; // 10 days grace period
  const defaultPenaltyRate = 0.05; // 5% per month
  
  // Use Mexico timezone for current date if not provided
  const calcDate = currentDate ? normalizeDate(currentDate) : getMexicoDate();
  
  return bills.map(bill => {
    const {
      baseAmount,
      dueDate,
      gracePeriodInDays = defaultGracePeriod,
      penaltyRate = defaultPenaltyRate,
      compoundPenalty = true // Default to compound like HOA Dues
    } = bill;
    
    // Parse due date using proper timezone utilities
    const dueDateObj = normalizeDate(dueDate);
    if (isNaN(dueDateObj.getTime())) {
      console.error(`Invalid due date format: ${dueDate}, type: ${typeof dueDate}`);
      // Return safe defaults for invalid dates
      return {
        baseAmount,
        penaltyAmount: 0,
        totalAmount: baseAmount,
        daysOverdue: 0,
        monthsOverdue: 0,
        dueDate: getMexicoDateString(),
        graceEndDate: getMexicoDateString(),
        _error: `Invalid due date: ${dueDate}`
      };
    }
    
    const graceEndDate = new Date(dueDateObj);
    graceEndDate.setDate(graceEndDate.getDate() + gracePeriodInDays);
    
    // Calculate days overdue (after grace period)
    const daysOverdue = Math.max(0, Math.floor((calcDate - graceEndDate) / (1000 * 60 * 60 * 24)));
    
    let penaltyAmount = 0;
    
    if (daysOverdue > 0) {
      // Calculate months overdue (rounded up to nearest month)
      const monthsOverdue = Math.ceil(daysOverdue / 30);
      
      if (compoundPenalty) {
        // Compound: Amount * (1 + rate)^months - Amount
        penaltyAmount = baseAmount * (Math.pow(1 + penaltyRate, monthsOverdue) - 1);
      } else {
        // Simple: Amount * rate * months
        penaltyAmount = baseAmount * penaltyRate * monthsOverdue;
      }
    }
    
    const roundedPenalty = Math.round(penaltyAmount * 100) / 100; // Round to 2 decimal places
    const roundedTotal = Math.round((baseAmount + roundedPenalty) * 100) / 100; // Round total to prevent precision drift
    
    return {
      baseAmount,
      penaltyAmount: roundedPenalty,
      totalAmount: roundedTotal,
      daysOverdue,
      monthsOverdue: daysOverdue > 0 ? Math.ceil(daysOverdue / 30) : 0,
      dueDate: getMexicoDateString(dueDateObj), // Return as YYYY-MM-DD in Mexico timezone
      graceEndDate: getMexicoDateString(graceEndDate)
    };
  });
}

/**
 * Calculate penalty for a single bill amount
 * @param {number} baseAmount - Base amount owed
 * @param {string|Date} dueDate - Due date (ISO string or Date object)
 * @param {Object} options - Penalty calculation options
 * @returns {Object} {penaltyAmount, daysOverdue, monthsOverdue}
 */
export function calculateSinglePenalty(baseAmount, dueDate, options = {}) {
  const {
    gracePeriodInDays = 10,
    penaltyRate = 0.05,
    compoundPenalty = true,
    currentDate = new Date()
  } = options;
  
  const result = calculateCurrentPenalties([{
    baseAmount,
    dueDate,
    gracePeriodInDays,
    penaltyRate,
    compoundPenalty
  }], currentDate);
  
  return result[0];
}

/**
 * Create standard due date for a bill (first day of month + 10 day grace = due on 11th)
 * @param {number} year - Calendar year  
 * @param {number} month - Calendar month (1-12)
 * @returns {string} Due date in YYYY-MM-DD format
 */
export function createStandardDueDate(year, month) {
  // Bills are due on the 1st of the month (grace period handled in penalty calculation)
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Validate and normalize penalty calculation inputs
 * @param {Array} bills - Input bills array
 * @returns {Array} Normalized bills array
 */
export function normalizePenaltyInputs(bills) {
  return bills.map(bill => {
    if (typeof bill.baseAmount !== 'number' || bill.baseAmount < 0) {
      throw new Error(`Invalid baseAmount: ${bill.baseAmount}`);
    }
    
    if (!bill.dueDate) {
      throw new Error('Missing dueDate');
    }
    
    // Ensure due date is valid
    const testDate = new Date(bill.dueDate);
    if (isNaN(testDate.getTime())) {
      throw new Error(`Invalid dueDate: ${bill.dueDate}`);
    }
    
    return {
      ...bill,
      dueDate: testDate.toISOString().split('T')[0] // Normalize to YYYY-MM-DD
    };
  });
}
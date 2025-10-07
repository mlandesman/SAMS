/**
 * Backend Fiscal Year Utilities
 * 
 * This module provides fiscal year calculation utilities for backend services.
 * It mirrors the frontend fiscal year utilities to ensure consistency across the application.
 * Supports any fiscal year configuration (not just July-June) and works seamlessly
 * for both calendar year and fiscal year clients.
 * 
 * Key concepts:
 * - Calendar Month: Standard 1-12 (January-December)
 */

import { getNow } from '../services/DateService.js';
 * - Fiscal Month: Position 1-12 within the fiscal year
 * - Fiscal Year Start Month: The calendar month when fiscal year begins (1-12)
 * - Fiscal Year naming: Named by the ending year (e.g., FY 2025 = July 2024 - June 2025)
 */

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Validate month number is between 1 and 12
 * @param {number} month - Month number to validate
 * @param {string} paramName - Parameter name for error message
 * @throws {Error} If month is invalid
 */
function validateMonth(month, paramName) {
  if (typeof month !== 'number' || isNaN(month) || month < 1 || month > 12) {
    throw new Error(`${paramName} must be a number between 1 and 12, received: ${month}`);
  }
}

/**
 * Validate Date object
 * @param {Date} date - Date to validate
 * @param {string} paramName - Parameter name for error message
 * @throws {Error} If date is invalid
 */
function validateDate(date, paramName) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error(`${paramName} must be a valid Date object`);
  }
}

/**
 * Validate fiscal year configuration from client config
 * @param {Object} clientConfig - Client configuration object
 * @returns {number} Valid fiscalYearStartMonth (defaults to 1 if not configured)
 * @throws {Error} If fiscalYearStartMonth is invalid
 */
function validateFiscalYearConfig(clientConfig) {
  const fiscalYearStartMonth = clientConfig?.configuration?.fiscalYearStartMonth || 1;
  
  try {
    validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  } catch (error) {
    console.error(`[FISCAL YEAR] Invalid fiscalYearStartMonth in client config: ${fiscalYearStartMonth}`);
    throw new Error(`Invalid fiscalYearStartMonth configuration: ${fiscalYearStartMonth}. Must be between 1 and 12.`);
  }
  
  return fiscalYearStartMonth;
}

/**
 * Get fiscal year for a given date
 * @param {Date} date - JavaScript Date object
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @returns {number} Fiscal year
 * @example
 * // For July-June fiscal year (FY named by ending year)
 * getFiscalYear(new Date('2024-07-15'), 7) => 2025  // July 2024 is in FY 2025
 * getFiscalYear(new Date('2025-06-15'), 7) => 2025  // June 2025 is in FY 2025
 * getFiscalYear(new Date('2025-07-01'), 7) => 2026  // July 2025 is in FY 2026
 */
function getFiscalYear(date, fiscalYearStartMonth) {
  validateDate(date, 'date');
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // Convert to 1-based
  
  // DEBUG: Log fiscal year calculation
  console.log('[FISCAL YEAR] Calculating fiscal year:', {
    date: date.toISOString(),
    year,
    month,
    fiscalYearStartMonth,
  });
  
  // Special case: Calendar year (starts in January)
  if (fiscalYearStartMonth === 1) {
    console.log('[FISCAL YEAR] Calendar year result:', year);
    return year;
  }
  
  // For fiscal years named by their ending year:
  // If we're in or after the fiscal year start month, we're in the NEXT fiscal year
  if (month >= fiscalYearStartMonth) {
    const fiscalYear = year + 1;
    console.log('[FISCAL YEAR] In or after start month, fiscal year:', fiscalYear);
    return fiscalYear;
  }
  
  // Otherwise we're still in the current fiscal year
  console.log('[FISCAL YEAR] Before start month, fiscal year:', year);
  return year;
}

/**
 * Get fiscal year boundaries
 * @param {number} fiscalYear - The fiscal year
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @returns {Object} {startDate: Date, endDate: Date}
 * @example
 * // FY 2025 = July 2024 to June 2025
 * getFiscalYearBounds(2025, 7) => {
 *   startDate: new Date('2024-07-01'),
 *   endDate: new Date('2025-06-30')
 * }
 */
function getFiscalYearBounds(fiscalYear, fiscalYearStartMonth) {
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  // For fiscal years named by ending year:
  // FY 2025 (July-June) = July 2024 to June 2025
  let startYear, endYear;
  
  if (fiscalYearStartMonth === 1) {
    // Calendar year: Jan 2025 to Dec 2025
    startYear = fiscalYear;
    endYear = fiscalYear;
  } else {
    // Fiscal year: Start is in previous calendar year
    startYear = fiscalYear - 1;
    endYear = fiscalYear;
  }
  
  // Start date: First day of start month
  const startDate = new Date(startYear, fiscalYearStartMonth - 1, 1);
  
  // End date: Last day of month before start month
  const endMonth = fiscalYearStartMonth === 1 ? 12 : fiscalYearStartMonth - 1;
  const endDate = new Date(endYear, endMonth, 0); // Day 0 gets last day of previous month
  
  console.log('[FISCAL YEAR] Calculated bounds:', {
    fiscalYear,
    fiscalYearStartMonth,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
  
  return { startDate, endDate };
}

/**
 * Get current fiscal month for today or given date
 * @param {Object} clientConfig - Client configuration containing fiscalYearStartMonth
 * @param {Date} date - Date to check (defaults to today)
 * @returns {number} Current fiscal month (1-12)
 * @example
 * // If today is July 15, 2025
 * getCurrentFiscalMonth({configuration: {fiscalYearStartMonth: 7}}) => 1  // July is month 1
 * getCurrentFiscalMonth({configuration: {fiscalYearStartMonth: 1}}) => 7  // July is month 7
 */
function getCurrentFiscalMonth(clientConfig, date = getNow()) {
  if (!date) {
    date = getNow();
  }
  validateDate(date, 'date');
  
  const fiscalYearStartMonth = validateFiscalYearConfig(clientConfig);
  const calendarMonth = date.getMonth() + 1; // Convert to 1-based
  
  let fiscalMonth = calendarMonth - fiscalYearStartMonth + 1;
  if (fiscalMonth <= 0) {
    fiscalMonth += 12;
  }
  
  console.log('[FISCAL YEAR] Current fiscal month:', {
    date: date.toISOString(),
    calendarMonth,
    fiscalYearStartMonth,
    fiscalMonth
  });
  
  return fiscalMonth;
}

/**
 * Get month name for a fiscal month
 * @param {number} month - Month number (1-12, can be fiscal or calendar month)
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @param {Object} options - {short: boolean} for abbreviated names
 * @returns {string} Month name
 * @example
 * // For calendar month
 * getFiscalMonthName(7, 1) => "July"
 * // For fiscal month in July-June fiscal year
 * getFiscalMonthName(1, 7) => "July"  // Month 1 = July
 */
function getFiscalMonthName(month, fiscalYearStartMonth, options = {}) {
  validateMonth(month, 'month');
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  // If fiscal year starts in January, month is already calendar month
  let calendarMonth = month;
  
  // If fiscal year starts in another month, convert fiscal month to calendar month
  if (fiscalYearStartMonth !== 1) {
    calendarMonth = month + fiscalYearStartMonth - 1;
    if (calendarMonth > 12) {
      calendarMonth -= 12;
    }
  }
  
  const monthNames = options.short ? MONTH_NAMES_SHORT : MONTH_NAMES_FULL;
  return monthNames[calendarMonth - 1];
}

/**
 * Format fiscal year label for display
 * @param {number} year - The year number
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @returns {string} Formatted year label
 * @example
 * getFiscalYearLabel(2025, 1) => "2025"      // Calendar year
 * getFiscalYearLabel(2025, 7) => "FY 2025"   // Fiscal year
 */
function getFiscalYearLabel(year, fiscalYearStartMonth) {
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  // Calendar year doesn't need special label
  if (fiscalYearStartMonth === 1) {
    return String(year);
  }
  
  return `FY ${year}`;
}

/**
 * Check if we're in a fiscal year system
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @returns {boolean} True if fiscal year (not calendar year)
 */
function isFiscalYear(fiscalYearStartMonth) {
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  return fiscalYearStartMonth !== 1;
}

export {
  getFiscalYear,
  getFiscalYearBounds,
  getCurrentFiscalMonth,
  getFiscalMonthName,
  getFiscalYearLabel,
  isFiscalYear,
  validateFiscalYearConfig,
  // Export validation functions for testing
  validateMonth,
  validateDate
};
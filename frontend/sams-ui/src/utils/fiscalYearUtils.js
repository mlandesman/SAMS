/**
 * Fiscal Year Utilities
 * 
 * This module provides comprehensive utilities for handling fiscal year calculations.
 * It supports any fiscal year configuration (not just July-June) and works seamlessly
 * for both calendar year and fiscal year clients.
 * 
 * Key concepts:
 * - Calendar Month: Standard 1-12 (January-December)
 * - Fiscal Month: Position 1-12 within the fiscal year
 * - Fiscal Year Start Month: The calendar month when fiscal year begins (1-12)
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
    throw new Error(`${paramName} must be a number between 1 and 12`);
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
 * Convert calendar month to fiscal month position
 * @param {number} calendarMonth - Calendar month (1-12)
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @returns {number} Fiscal month position (1-12)
 * @example
 * // For July-June fiscal year (start month = 7)
 * calendarToFiscalMonth(7, 7) => 1   // July is month 1
 * calendarToFiscalMonth(6, 7) => 12  // June is month 12
 * calendarToFiscalMonth(1, 7) => 7   // January is month 7
 */
export function calendarToFiscalMonth(calendarMonth, fiscalYearStartMonth) {
  validateMonth(calendarMonth, 'calendarMonth');
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  let fiscalMonth = calendarMonth - fiscalYearStartMonth + 1;
  if (fiscalMonth <= 0) {
    fiscalMonth += 12;
  }
  
  return fiscalMonth;
}

/**
 * Convert fiscal month position to calendar month
 * @param {number} fiscalMonth - Fiscal month position (1-12)
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @returns {number} Calendar month (1-12)
 * @example
 * // For July-June fiscal year (start month = 7)
 * fiscalToCalendarMonth(1, 7) => 7   // Month 1 = July
 * fiscalToCalendarMonth(12, 7) => 6  // Month 12 = June
 */
export function fiscalToCalendarMonth(fiscalMonth, fiscalYearStartMonth) {
  validateMonth(fiscalMonth, 'fiscalMonth');
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  let calendarMonth = fiscalMonth + fiscalYearStartMonth - 1;
  if (calendarMonth > 12) {
    calendarMonth -= 12;
  }
  
  return calendarMonth;
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
export function getFiscalYear(date, fiscalYearStartMonth) {
  validateDate(date, 'date');
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // Convert to 1-based
  
  // DEBUG: Log what we're calculating
  console.log('🔍 getFiscalYear called with:');
  console.log('  Date:', date.toISOString());
  console.log('  Year:', year);
  console.log('  Month:', month);
  console.log('  Fiscal Year Start Month:', fiscalYearStartMonth);
  
  // Special case: Calendar year (starts in January)
  if (fiscalYearStartMonth === 1) {
    console.log('  Result: Calendar year (January start):', year);
    return year;
  }
  
  // For fiscal years named by their ending year:
  // If we're in or after the fiscal year start month, we're in the NEXT fiscal year
  if (month >= fiscalYearStartMonth) {
    console.log('  Result: Next fiscal year:', year + 1);
    return year + 1;
  }
  
  // Otherwise we're still in the current fiscal year
  console.log('  Result: Current fiscal year:', year);
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
export function getFiscalYearBounds(fiscalYear, fiscalYearStartMonth) {
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
  
  return { startDate, endDate };
}

/**
 * Get month name for a fiscal month
 * @param {number} fiscalMonth - Fiscal month position (1-12)
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @param {Object} options - {short: boolean} for abbreviated names
 * @returns {string} Month name
 * @example
 * getFiscalMonthName(1, 7) => "July"
 * getFiscalMonthName(1, 7, {short: true}) => "Jul"
 */
export function getFiscalMonthName(fiscalMonth, fiscalYearStartMonth, options = {}) {
  validateMonth(fiscalMonth, 'fiscalMonth');
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  const calendarMonth = fiscalToCalendarMonth(fiscalMonth, fiscalYearStartMonth);
  const monthNames = options.short ? MONTH_NAMES_SHORT : MONTH_NAMES_FULL;
  
  return monthNames[calendarMonth - 1];
}

/**
 * Get array of month names in fiscal year order
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @param {Object} options - {short: boolean} for abbreviated names
 * @returns {string[]} Array of 12 month names in fiscal order
 * @example
 * getFiscalMonthNames(7) => ["July", "August", ..., "June"]
 * getFiscalMonthNames(1) => ["January", "February", ..., "December"]
 */
export function getFiscalMonthNames(fiscalYearStartMonth, options = {}) {
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  const monthNames = options.short ? MONTH_NAMES_SHORT : MONTH_NAMES_FULL;
  const result = [];
  
  for (let fiscalMonth = 1; fiscalMonth <= 12; fiscalMonth++) {
    const calendarMonth = fiscalToCalendarMonth(fiscalMonth, fiscalYearStartMonth);
    result.push(monthNames[calendarMonth - 1]);
  }
  
  return result;
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
export function getFiscalYearLabel(year, fiscalYearStartMonth) {
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  // Calendar year doesn't need special label
  if (fiscalYearStartMonth === 1) {
    return String(year);
  }
  
  return `FY ${year}`;
}

/**
 * Get current fiscal month for today or given date
 * @param {Date} date - Date to check (defaults to today)
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @returns {number} Current fiscal month (1-12)
 * @example
 * // If today is July 15, 2025
 * getCurrentFiscalMonth(null, 7) => 1  // July is month 1 for July-June FY
 * getCurrentFiscalMonth(null, 1) => 7  // July is month 7 for calendar year
 */
export function getCurrentFiscalMonth(date = new Date(), fiscalYearStartMonth) {
  if (!date) {
    date = new Date();
  }
  validateDate(date, 'date');
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  const calendarMonth = date.getMonth() + 1; // Convert to 1-based
  return calendarToFiscalMonth(calendarMonth, fiscalYearStartMonth);
}

/**
 * Get fiscal quarter for a fiscal month
 * @param {number} fiscalMonth - Fiscal month (1-12)
 * @returns {number} Quarter (1-4)
 * @example
 * getFiscalQuarter(1) => 1   // Month 1 is in Q1
 * getFiscalQuarter(7) => 3   // Month 7 is in Q3
 */
export function getFiscalQuarter(fiscalMonth) {
  validateMonth(fiscalMonth, 'fiscalMonth');
  
  return Math.ceil(fiscalMonth / 3);
}

/**
 * Check if we're in a fiscal year system
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12)
 * @returns {boolean} True if fiscal year (not calendar year)
 */
export function isFiscalYear(fiscalYearStartMonth) {
  validateMonth(fiscalYearStartMonth, 'fiscalYearStartMonth');
  
  return fiscalYearStartMonth !== 1;
}

/**
 * Convert fiscal period format (2026-00) to readable date (Jul 2025)
 * @param {string} period - Period in format "YYYY-MM" where MM is 0-based fiscal month
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12, default 7 for AVII)
 * @returns {string} Readable date like "Jul 2025"
 * @example
 * convertPeriodToReadableDate("2026-00", 7) => "Jul 2025"
 * convertPeriodToReadableDate("2026-01", 7) => "Aug 2025"
 */
export function convertPeriodToReadableDate(period, fiscalYearStartMonth = 7) {
  const [fiscalYearStr, fiscalMonthStr] = period.split('-');
  const fiscalYear = parseInt(fiscalYearStr);
  const fiscalMonthZeroBased = parseInt(fiscalMonthStr); // 0-11
  const fiscalMonthOneBased = fiscalMonthZeroBased + 1;  // 1-12
  
  // Get the calendar month and year
  const calendarMonth = fiscalToCalendarMonth(fiscalMonthOneBased, fiscalYearStartMonth);
  
  // For fiscal months 1-6 (Jul-Dec), use previous calendar year
  // For fiscal months 7-12 (Jan-Jun), use same calendar year as fiscal year
  const calendarYear = fiscalMonthOneBased <= 6 ? fiscalYear - 1 : fiscalYear;
  
  const monthName = MONTH_NAMES_SHORT[calendarMonth - 1];
  return `${monthName} ${calendarYear}`;
}
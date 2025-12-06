/**
 * Fiscal Year Utilities for Mobile
 * Copied from SAMS desktop to ensure consistency
 */

import { getMexicoDateTime } from './timezone.js';

/**
 * Get current fiscal year for a given date
 * @param {Date} date - Date to check (defaults to current Mexico time)
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12, default 7 for AVII)
 * @returns {number} Fiscal year
 * @example
 * // If today is July 15, 2025 and fiscal year starts in July
 * getFiscalYear(new Date('2025-07-15'), 7) => 2025
 * // If today is June 15, 2025 and fiscal year starts in July  
 * getFiscalYear(new Date('2025-06-15'), 7) => 2024
 */
export function getFiscalYear(date = getMexicoDateTime(), fiscalYearStartMonth = 7) {
  const calendarMonth = date.getMonth() + 1; // Convert to 1-based
  const calendarYear = date.getFullYear();
  
  // Special case: Calendar year (starts in January)
  if (fiscalYearStartMonth === 1) {
    return calendarYear;
  }
  
  if (calendarMonth >= fiscalYearStartMonth) {
    // We're in the fiscal year that started this calendar year
    // September 2025 with July start = FY 2026 (starts July 2025)
    return calendarYear + 1;
  } else {
    // We're in the fiscal year that started last calendar year
    // June 2025 with July start = FY 2025 (started July 2024)
    return calendarYear;
  }
}

/**
 * Get current fiscal month for a given date
 * @param {Date} date - Date to check (defaults to current Mexico time)
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12, default 7 for AVII)
 * @returns {number} Fiscal month (1-12)
 * @example
 * // If today is July 15, 2025 and fiscal year starts in July
 * getCurrentFiscalMonth(new Date('2025-07-15'), 7) => 1  // July is month 1
 * // If today is September 15, 2025 and fiscal year starts in July
 * getCurrentFiscalMonth(new Date('2025-09-15'), 7) => 3  // September is month 3
 */
export function getCurrentFiscalMonth(date = getMexicoDateTime(), fiscalYearStartMonth = 7) {
  const calendarMonth = date.getMonth() + 1; // Convert to 1-based
  
  // Special case: Calendar year (starts in January)
  if (fiscalYearStartMonth === 1) {
    return calendarMonth; // January = 1, February = 2, etc.
  }
  
  if (calendarMonth >= fiscalYearStartMonth) {
    // July = 1, August = 2, etc.
    return calendarMonth - fiscalYearStartMonth + 1;
  } else {
    // January = 7, February = 8, etc. (for July-June fiscal year)
    return calendarMonth + (12 - fiscalYearStartMonth) + 1;
  }
}

/**
 * Get current fiscal period in SAMS format
 * @param {Date} date - Date to check (defaults to current Mexico time)
 * @param {number} fiscalYearStartMonth - First month of fiscal year (1-12, default 7 for AVII)
 * @returns {Object} {year: fiscalYear, month: fiscalMonth, period: "YYYY-MM"}
 * @example
 * // If today is September 15, 2025 and fiscal year starts in July
 * getCurrentFiscalPeriod() => {year: 2025, month: 3, period: "2025-02"}
 * // Note: month is 1-based but period format uses 0-based month (3 becomes "02")
 */
export function getCurrentFiscalPeriod(date = getMexicoDateTime(), fiscalYearStartMonth = 7) {
  const fiscalYear = getFiscalYear(date, fiscalYearStartMonth);
  const fiscalMonth = getCurrentFiscalMonth(date, fiscalYearStartMonth);
  
  // Format as YYYY-MM where MM is 0-based fiscal month (for API compatibility)
  const periodMonth = fiscalMonth - 1; // Convert to 0-based
  const period = `${fiscalYear}-${String(periodMonth).padStart(2, '0')}`;
  
  return {
    year: fiscalYear,
    month: fiscalMonth,
    period: period
  };
}

/**
 * Get previous fiscal period
 * @param {string} currentPeriod - Current period in "YYYY-MM" format
 * @returns {string} Previous period in "YYYY-MM" format
 * @example
 * getPreviousFiscalPeriod("2025-02") => "2025-01"
 * getPreviousFiscalPeriod("2025-00") => "2024-11"
 */
export function getPreviousFiscalPeriod(currentPeriod) {
  const [yearStr, monthStr] = currentPeriod.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  
  if (month === 0) {
    // January (month 0), go to December (month 11) of previous fiscal year
    return `${year - 1}-11`;
  } else {
    // Go to previous month
    return `${year}-${String(month - 1).padStart(2, '0')}`;
  }
}
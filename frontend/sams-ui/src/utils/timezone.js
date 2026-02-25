/**
 * Timezone utilities for Mexico (America/Cancun)
 * Frontend version of timezone utilities
 */

import { getFiscalYear, getFiscalYearBounds } from './fiscalYearUtils';

const MEXICO_TIMEZONE = 'America/Cancun';

/**
 * Get current date in Mexico timezone
 * @returns {Date} Date object representing current time in Mexico
 */
export function getMexicoDate() {
  // Create a new date in Mexico timezone using Intl.DateTimeFormat
  const now = new Date();
  const mexTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  
  return new Date(mexTime + 'T00:00:00');
}

/**
 * Get date string in YYYY-MM-DD format for Mexico timezone
 * @param {Date} date - Optional date, defaults to current Mexico time
 * @returns {string} Date in YYYY-MM-DD format
 */
export function getMexicoDateString(date) {
  if (date) {
    // For provided dates, just format them
    return date.toISOString().split('T')[0];
  }
  
  // For current date, get Mexico timezone date
  const now = new Date();
  const mexDateString = new Intl.DateTimeFormat('en-CA', {
    timeZone: MEXICO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  
  return mexDateString;
}

/**
 * Get yesterday's date string in Mexico timezone
 * @returns {string} Yesterday's date in YYYY-MM-DD format
 */
export function getMexicoYesterdayString() {
  const today = getMexicoDate();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Get Mexico timezone date range for filtering
 * Converts Mexico local time boundaries to UTC for Firestore queries
 * @param {Date} date - Date in Mexico timezone
 * @returns {Object} { startUTC, endUTC } - UTC boundaries for the day
 */
export function getMexicoDateRange(date) {
  // Extract year, month, day from the input date
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();
  
  // Create start of day in Cancun timezone (00:00:00)
  // Cancun is UTC-5, so we add 5 hours to get UTC
  const startUTC = new Date(Date.UTC(year, month, day, 5, 0, 0, 0));
  
  // Create end of day in Cancun timezone (23:59:59.999)
  // We add 5 hours to 23:59:59.999 which gives us next day 04:59:59.999 UTC
  const endUTC = new Date(Date.UTC(year, month, day + 1, 4, 59, 59, 999));
  
  return { startUTC, endUTC };
}

/**
 * Get date in Mexico timezone with time
 * @param {string|Date} dateInput - Optional date input. If string, should be YYYY-MM-DD format
 * @returns {Date} Date object representing the intended date
 * 
 * IMPORTANT: JavaScript Date objects are always UTC internally. This function ensures
 * that date strings are interpreted as Cancun local dates, not UTC dates.
 * America/Cancun is UTC-5 year-round (no DST).
 */
export function getMexicoDateTime(dateInput) {
  if (!dateInput) {
    // No input - return current time
    // This is already correct since new Date() gives current moment
    return new Date();
  }
  
  // Handle string date input (e.g., "2025-07-31" or "2025-07-31T00:00:00.000-05:00")
  if (typeof dateInput === 'string') {
    // If already has time/timezone (contains "T"), parse as-is
    if (dateInput.includes('T')) {
      return new Date(dateInput);
    }
    // CRITICAL: For date-only strings, avoid UTC midnight interpretation
    // "2025-07-31" as UTC midnight would display as July 30 in Cancun (UTC-5)
    // Using noon UTC ensures the date stays correct when displayed in any timezone
    return new Date(dateInput + 'T12:00:00');
  }
  
  // Handle Date object input
  if (dateInput instanceof Date) {
    // Date objects are already valid timestamps
    // We cannot and should not try to "convert" them to a timezone
    // The timezone conversion happens during display/formatting
    return dateInput;
  }
  
  // Fallback for other types
  return new Date(dateInput);
}

/**
 * Get date range for transaction filters in Mexico timezone
 * @param {string} filterType - Type of filter (today, yesterday, etc.)
 * @param {Object} clientConfig - Client configuration containing fiscalYearStartMonth
 * @returns {Object} { startUTC, endUTC } - Date range in UTC for queries
 */
export function getDateRangeForFilter(filterType, clientConfig = null) {
  const fiscalYearStartMonth = clientConfig?.configuration?.fiscalYearStartMonth || 1;
  const nowMexico = getMexicoDateTime();
  const today = new Date(nowMexico);
  
  switch (filterType) {
    case 'today':
      return getMexicoDateRange(today);
      
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return getMexicoDateRange(yesterday);
    }
    
    case 'thisWeek': {
      const dayOfWeek = today.getDay(); // 0 = Sunday
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dayOfWeek);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + (6 - dayOfWeek));
      
      return {
        startUTC: getMexicoDateRange(weekStart).startUTC,
        endUTC: getMexicoDateRange(weekEnd).endUTC
      };
    }
    
    case 'lastWeek': {
      const dayOfWeek = today.getDay();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dayOfWeek - 7);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - dayOfWeek - 1);
      
      return {
        startUTC: getMexicoDateRange(weekStart).startUTC,
        endUTC: getMexicoDateRange(weekEnd).endUTC
      };
    }
    
    case 'currentMonth': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      return {
        startUTC: getMexicoDateRange(monthStart).startUTC,
        endUTC: getMexicoDateRange(monthEnd).endUTC
      };
    }
    
    case 'previousMonth': {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      
      return {
        startUTC: getMexicoDateRange(monthStart).startUTC,
        endUTC: getMexicoDateRange(monthEnd).endUTC
      };
    }
    
    case 'yearToDate': {
      if (fiscalYearStartMonth === 1) {
        // Calendar year: January 1 to today
        const yearStart = new Date(today.getFullYear(), 0, 1);
        return {
          startUTC: getMexicoDateRange(yearStart).startUTC,
          endUTC: getMexicoDateRange(today).endUTC
        };
      } else {
        // Fiscal year: Start of current fiscal year to today
        const currentFiscalYear = getFiscalYear(today, fiscalYearStartMonth);
        const { startDate } = getFiscalYearBounds(currentFiscalYear, fiscalYearStartMonth);
        return {
          startUTC: getMexicoDateRange(startDate).startUTC,
          endUTC: getMexicoDateRange(today).endUTC
        };
      }
    }
    
    case 'previousYear': {
      if (fiscalYearStartMonth === 1) {
        // Calendar year: Previous calendar year
        const yearStart = new Date(today.getFullYear() - 1, 0, 1);
        const yearEnd = new Date(today.getFullYear() - 1, 11, 31);
        return {
          startUTC: getMexicoDateRange(yearStart).startUTC,
          endUTC: getMexicoDateRange(yearEnd).endUTC
        };
      } else {
        // Fiscal year: Previous fiscal year
        const currentFiscalYear = getFiscalYear(today, fiscalYearStartMonth);
        const { startDate, endDate } = getFiscalYearBounds(currentFiscalYear - 1, fiscalYearStartMonth);
        return {
          startUTC: getMexicoDateRange(startDate).startUTC,
          endUTC: getMexicoDateRange(endDate).endUTC
        };
      }
    }
    
    case 'previous3Months': {
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      
      return {
        startUTC: getMexicoDateRange(threeMonthsAgo).startUTC,
        endUTC: getMexicoDateRange(today).endUTC
      };
    }
    
    case 'all':
    default: {
      const farPast = new Date(today.getFullYear() - 20, 0, 1);
      const farFuture = new Date(today.getFullYear() + 5, 11, 31);
      
      return {
        startUTC: getMexicoDateRange(farPast).startUTC,
        endUTC: getMexicoDateRange(farFuture).endUTC
      };
    }
  }
}

/**
 * Log current time in Mexico timezone for debugging
 */
export function logMexicoTime() {
  const mexDate = getMexicoDate();
  const mexTime = mexDate.toLocaleString("en-US", { 
    timeZone: MEXICO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
  // Timezone debugging - uncomment these lines when troubleshooting timezone issues
  // console.log(`🌎 Current Mexico time: ${mexTime}`);
  // console.log(`📅 Mexico date string: ${getMexicoDateString()}`);
}

/**
 * Format a timestamp for display in America/Cancun timezone
 * @param {Date|number|{seconds: number}|{_seconds: number}|{toDate: function}} ts - Timestamp (Date, ms, Firestore format, or serialized)
 * @returns {string} Formatted date/time string
 */
export function formatTimestampMexico(ts) {
  if (!ts) return '—';
  let date;
  try {
    if (ts instanceof Date) {
      date = ts;
    } else if (typeof ts?.toDate === 'function') {
      date = ts.toDate();
    } else {
      const sec = ts.seconds ?? ts._seconds;
      if (sec != null) {
        date = new Date(sec * 1000);
      } else if (typeof ts === 'string' || typeof ts === 'number') {
        date = new Date(ts);
      } else {
        return '—';
      }
    }
    return new Intl.DateTimeFormat('en-US', {
      timeZone: MEXICO_TIMEZONE,
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return '—';
  }
}

export { MEXICO_TIMEZONE };
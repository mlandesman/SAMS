/**
 * Timezone utilities for Mexico (America/Cancun)
 * Mobile app version of timezone utilities
 */

const MEXICO_TIMEZONE = 'America/Cancun';

/**
 * Get current date and time in Mexico timezone (America/Cancun)
 * @param {string|Date} dateInput - Optional date input. If string, should be YYYY-MM-DD format
 * @returns {Date} Date object representing the intended date
 * 
 * IMPORTANT: JavaScript Date objects are always UTC internally. This function ensures
 * that date strings are interpreted as Cancun local dates, not UTC dates.
 * America/Cancun is UTC-5 year-round (no DST).
 */
export function getMexicoDateTime(dateInput) {
  if (!dateInput) {
    // Return current Mexico time
    const now = new Date();
    const mexicoTime = new Date(now.toLocaleString("en-US", {timeZone: MEXICO_TIMEZONE}));
    return mexicoTime;
  }
  
  if (typeof dateInput === 'string') {
    // For date strings like "2025-09-16", interpret as noon Mexico time
    // This avoids timezone shift issues where date could shift to previous day
    return new Date(dateInput + 'T12:00:00');
  }
  
  if (dateInput instanceof Date) {
    return dateInput;
  }
  
  // Try to convert other types to Date
  return new Date(dateInput);
}

/**
 * Get current date in Mexico timezone
 * @returns {Date} Date object representing current time in Mexico
 */
export function getMexicoDate() {
  return getMexicoDateTime();
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
 * Format a date string for display (America/Cancun, no timezone drift).
 * Parses YYYY-MM-DD with noon anchor to avoid UTC-midnight shift in western timezones.
 * @param {string|Date} dateInput - Date string (YYYY-MM-DD) or Date object
 * @returns {string} Formatted date (e.g., "Mar 17, 2026") or "—" if invalid
 */
export function formatDateForDisplay(dateInput) {
  if (!dateInput) return '—';
  const d = typeof dateInput === 'string'
    ? new Date(dateInput + 'T12:00:00')
    : (dateInput instanceof Date ? dateInput : new Date(dateInput));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: MEXICO_TIMEZONE
  });
}

export { MEXICO_TIMEZONE };
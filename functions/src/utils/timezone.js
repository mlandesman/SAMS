/**
 * Timezone utilities for Mexico (America/Cancun)
 * Updated with Intl.DateTimeFormat for accurate timezone handling
 */

const MEXICO_TIMEZONE = 'America/Cancun';

/**
 * Get current date in Mexico timezone
 * @returns {Date} Date object representing current time in Mexico
 */
function getMexicoDate() {
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
function getMexicoDateString(date) {
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
 * Get yesterday's date in Mexico timezone
 * @returns {Date} Yesterday's date in Mexico timezone
 */
function getMexicoYesterday() {
  const today = getMexicoDate();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}

/**
 * Get yesterday's date string in YYYY-MM-DD format for Mexico timezone
 * @returns {string} Yesterday's date in YYYY-MM-DD format
 */
function getMexicoYesterdayString() {
  return getMexicoDateString(getMexicoYesterday());
}

/**
 * Get a date N days ago in Mexico timezone
 * @param {number} daysAgo - Number of days ago
 * @returns {Date} Date N days ago in Mexico timezone
 */
function getMexicoDateDaysAgo(daysAgo) {
  const today = getMexicoDate();
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - daysAgo);
  return pastDate;
}

/**
 * Get a date N days ago as string in Mexico timezone
 * @param {number} daysAgo - Number of days ago
 * @returns {string} Date N days ago in YYYY-MM-DD format
 */
function getMexicoDateDaysAgoString(daysAgo) {
  return getMexicoDateString(getMexicoDateDaysAgo(daysAgo));
}

/**
 * Log current time in Mexico timezone for debugging
 */
function logMexicoTime() {
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
  console.log(`🌎 Current Mexico time: ${mexTime}`);
  console.log(`📅 Mexico date string: ${getMexicoDateString()}`);
}

export {
  MEXICO_TIMEZONE,
  getMexicoDate,
  getMexicoDateString,
  getMexicoYesterday,
  getMexicoYesterdayString,
  getMexicoDateDaysAgo,
  getMexicoDateDaysAgoString,
  logMexicoTime
};
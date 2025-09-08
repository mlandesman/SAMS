// utils/debug.js
// Environment-aware debug logging utility for SAMS application

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG === 'true';

/**
 * Conditionally log messages based on environment
 * @param {...any} args - Arguments to pass to console.log
 */
export const debugLog = (...args) => {
  if (isDevelopment || isDebugEnabled) {
    console.log(...args);
  }
};

/**
 * Conditionally group console logs
 * @param {string} label - Group label
 * @param {Function} fn - Function containing grouped logs
 */
export const debugGroup = (label, fn) => {
  if (isDevelopment || isDebugEnabled) {
    console.group(label);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  }
};

/**
 * Conditionally display data in table format
 * @param {any} data - Data to display in table
 */
export const debugTable = (data) => {
  if (isDevelopment || isDebugEnabled) {
    console.table(data);
  }
};

/**
 * Always log errors regardless of environment
 * @param {...any} args - Arguments to pass to console.error
 */
export const logError = (...args) => {
  console.error(...args);
};

/**
 * Always log warnings regardless of environment
 * @param {...any} args - Arguments to pass to console.warn
 */
export const logWarn = (...args) => {
  console.warn(...args);
};

/**
 * Log structured data for better debugging
 * @param {string} context - Context/component name
 * @param {object} data - Data object to log
 */
export const debugStructured = (context, data) => {
  if (isDevelopment || isDebugEnabled) {
    console.log(`[${context}]`, data);
  }
};

/**
 * Performance timing helper
 * @param {string} label - Timer label
 */
export const debugTime = (label) => {
  if (isDevelopment || isDebugEnabled) {
    console.time(label);
  }
};

/**
 * End performance timing
 * @param {string} label - Timer label
 */
export const debugTimeEnd = (label) => {
  if (isDevelopment || isDebugEnabled) {
    console.timeEnd(label);
  }
};

// Export a default debug object for convenience
export default {
  log: debugLog,
  group: debugGroup,
  table: debugTable,
  error: logError,
  warn: logWarn,
  structured: debugStructured,
  time: debugTime,
  timeEnd: debugTimeEnd
};
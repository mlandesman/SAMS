/**
 * Shared database field mappings and conversion utilities
 * Used by all frontend components and hooks
 * Note: Frontend doesn't have firebase-admin, uses different approach
 */

// Timezone configuration - America/Cancun (no DST)
const CANCUN_TIMEZONE = 'America/Cancun';
const CANCUN_OFFSET = -5; // UTC-5, no DST changes

export const databaseFieldMappings = {
  // ===== TIMESTAMP CONVERSIONS =====
  /**
   * Convert Firestore Timestamp to Date object in Cancun timezone
   * @param {Object} timestamp - Firestore timestamp with _seconds
   * @returns {Date} JavaScript Date object
   */
  timestampToDate: (timestamp) => {
    if (!timestamp) return null;
    
    if (timestamp._seconds !== undefined) {
      return new Date(timestamp._seconds * 1000);
    }
    
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    if (typeof timestamp === 'string') {
      // If string doesn't have timezone, assume it's Cancun time
      if (!timestamp.includes('Z') && !timestamp.match(/[+-]\d{2}:\d{2}$/)) {
        const localDateStr = timestamp.includes('T') ? timestamp : `${timestamp}T00:00:00`;
        return new Date(`${localDateStr}-05:00`);
      }
      return new Date(timestamp);
    }
    
    return null;
  },

  /**
   * Format timestamp for display in Cancun timezone
   * @param {Object|Date|string} timestamp 
   * @returns {string} Formatted date string
   */
  formatTimestamp: (timestamp) => {
    const date = databaseFieldMappings.timestampToDate(timestamp);
    if (!date) return '';
    
    // Use Intl.DateTimeFormat with Cancun timezone
    return new Intl.DateTimeFormat('en-US', {
      timeZone: CANCUN_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  },

  /**
   * Format timestamp with time for display in Cancun timezone
   * @param {Object|Date|string} timestamp 
   * @returns {string} Formatted date and time string
   */
  formatTimestampWithTime: (timestamp) => {
    const date = databaseFieldMappings.timestampToDate(timestamp);
    if (!date) return '';
    
    return new Intl.DateTimeFormat('en-US', {
      timeZone: CANCUN_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  },

  /**
   * Get start of day in Cancun timezone
   * @param {Date|string} date - Input date
   * @returns {Date} Start of day in Cancun time
   */
  getStartOfDayCancun: (date = new Date()) => {
    const d = new Date(date);
    const cancunDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00-05:00`;
    return new Date(cancunDateStr);
  },

  /**
   * Get end of day in Cancun timezone
   * @param {Date|string} date - Input date
   * @returns {Date} End of day in Cancun time
   */
  getEndOfDayCancun: (date = new Date()) => {
    const d = new Date(date);
    const cancunDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T23:59:59.999-05:00`;
    return new Date(cancunDateStr);
  },

  // ===== AMOUNT CONVERSIONS =====
  /**
   * Convert cents to dollars for display
   * @param {number} cents 
   * @returns {number} Amount in dollars
   */
  centsToDollars: (cents) => {
    if (!cents && cents !== 0) return 0;
    return cents / 100;
  },

  /**
   * Format amount for display with currency
   * @param {number} cents - Amount in cents
   * @param {string} currency - Currency code (USD, EUR, etc.)
   * @returns {string} Formatted currency string
   */
  formatCurrency: (cents, currency = 'USD') => {
    const dollars = databaseFieldMappings.centsToDollars(cents);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(dollars);
  },

  /**
   * Convert dollars to cents for form submissions
   * @param {number|string} dollars 
   * @returns {number} Amount in cents
   */
  dollarsToCents: (dollars) => {
    if (!dollars && dollars !== 0) return 0;
    const amount = parseFloat(dollars);
    return Math.round(amount * 100);
  },

  // ===== FIELD MAPPINGS =====
  /**
   * Map API response fields to component props
   */
  mapUserFields: (userData) => {
    return {
      ...userData,
      propertyAccess: userData.propertyAccess || userData.clientAccess || {},
      // Remove old field to prevent confusion
      clientAccess: undefined
    };
  },

  /**
   * Map transaction for display
   */
  mapTransactionFields: (transaction) => {
    return {
      ...transaction,
      displayAmount: databaseFieldMappings.centsToDollars(transaction.amount),
      displayDate: databaseFieldMappings.formatTimestamp(transaction.date || transaction.created)
    };
  },

  // ===== VALIDATION =====
  /**
   * Validate amount input (for forms)
   */
  validateAmount: (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0;
  },

  /**
   * Get display name for property access role
   */
  getRoleDisplayName: (role) => {
    const roleMap = {
      'owner': 'Owner',
      'administrator': 'Administrator',
      'accountant': 'Accountant',
      'viewer': 'Viewer'
    };
    return roleMap[role] || role;
  }
};

// For backward compatibility if components import default
export default databaseFieldMappings;
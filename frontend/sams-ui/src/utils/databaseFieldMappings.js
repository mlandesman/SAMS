/**
 * Frontend database field mappings and conversion utilities
 * Mirrors backend functionality for consistent data handling
 */

// Timezone configuration - America/Cancun (no DST)
const CANCUN_TIMEZONE = 'America/Cancun';
const CANCUN_OFFSET = -5; // UTC-5, no DST changes

export const databaseFieldMappings = {
  // ===== TIMESTAMP CONVERSIONS =====
  /**
   * Convert various date formats to timestamp-compatible format
   * @param {Date|string|number|Object} dateValue - Input date in any format
   * @returns {Date} JavaScript Date object
   */
  convertToTimestamp: (dateValue) => {
    if (!dateValue) return null;
    
    // Already a Date
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // Nested timestampValue from API
    if (dateValue.timestampValue) {
      return new Date(dateValue.timestampValue);
    }
    
    // Firestore Timestamp object with toDate method
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // Firestore Timestamp object with _seconds
    if (dateValue._seconds !== undefined) {
      return new Date(dateValue._seconds * 1000);
    }
    
    // String or number
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      // If the date string didn't include timezone info, treat it as Cancun time
      if (typeof dateValue === 'string' && !dateValue.includes('Z') && !dateValue.match(/[+-]\d{2}:\d{2}$/)) {
        const localDateStr = dateValue.includes('T') ? dateValue : `${dateValue}T00:00:00`;
        return new Date(`${localDateStr}-05:00`);
      }
      return new Date(dateValue);
    }
    
    return null;
  },

  /**
   * Convert timestamp to formatted string for display
   * @param {Date|Object} timestamp 
   * @returns {string} Formatted date string
   */
  convertFromTimestamp: (timestamp) => {
    if (!timestamp) return null;
    
    let date;
    if (timestamp._seconds !== undefined) {
      date = new Date(timestamp._seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return null;
    }
    
    // Return ISO string
    return date.toISOString();
  },

  /**
   * Format timestamp for display in UI (short date format)
   * @param {Date|Object} timestamp 
   * @returns {string} Formatted date string (MM/DD/YYYY)
   */
  formatTimestamp: (timestamp) => {
    if (!timestamp) return '';
    
    const date = databaseFieldMappings.convertToTimestamp(timestamp);
    if (!date) return '';
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${month}/${day}/${year}`;
  },

  // ===== AMOUNT CONVERSIONS =====
  /**
   * Convert dollar amount to cents (for storage)
   * @param {number|string} dollars 
   * @returns {number} Amount in cents
   */
  dollarsToCents: (dollars) => {
    if (!dollars && dollars !== 0) return 0;
    const amount = parseFloat(dollars);
    return Math.round(amount * 100);
  },

  /**
   * Convert cents to dollars (for display)
   * @param {number} cents 
   * @returns {number} Amount in dollars
   */
  centsToDollars: (cents) => {
    if (!cents && cents !== 0) return 0;
    return cents / 100;
  },

  /**
   * Format currency for display
   * @param {number} cents - Amount in cents
   * @param {string} currency - Currency code (default: USD)
   * @param {boolean} showCents - Whether to show cents (default: true)
   * @returns {string} Formatted currency string
   */
  formatCurrency: (cents, currency = 'USD', showCents = true) => {
    const dollars = databaseFieldMappings.centsToDollars(cents);
    const fractionDigits = showCents ? 2 : 0;
    
    // For MXN (Mexican Peso), use appropriate formatting
    if (currency === 'MXN' || currency === 'MX') {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits
      }).format(dollars);
    }
    
    // Default USD formatting
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(dollars);
  },

  /**
   * Validate amount format
   * @param {string|number} amount 
   * @returns {boolean} True if valid amount
   */
  validateAmount: (amount) => {
    if (!amount && amount !== 0) return false;
    const num = parseFloat(amount);
    return !isNaN(num) && num >= 0;
  },

  // ===== DOCUMENT ID GENERATORS =====
  // NOTE: Transaction IDs are generated server-side by the backend
  // This ensures consistency across all clients (desktop, mobile, automations)

  // ===== FIELD MAPPINGS =====
  /**
   * Map old field names to new field names
   */
  fieldMappings: {
    users: {
      'clientAccess': 'propertyAccess', // Main refactoring change
      'isActive': 'accountState',
      'unit': 'unitId'
    },
    transactions: {
      // Most transaction fields remain the same
      // But amounts are now in cents
    },
    hoaDues: {
      // Payments structure changed but field names similar
    }
  },

  // ===== FIELD STANDARDS =====
  /**
   * Standard field names used across collections
   */
  FIELD_STANDARDS: {
    timestamps: ['created', 'updated', 'lastLogin', 'createdAt', 'updatedAt', 'date'],
    amounts: ['amount', 'creditBalance', 'balance', 'totalPaid', 'totalDue', 'duesAmount'],
    references: ['unitId', 'clientId', 'userId', 'propertyId'],
    
    // Fields that should be removed during cleanup
    migrationArtifacts: ['_reverted', 'migrationData', 'creationMethod', 'id'],
    
    // Document ID patterns by collection
    docIdPatterns: {
      users: 'Firebase Auth UID',
      transactions: 'YYYY-MM-DD_HHMMSS_nnn',
      units: 'Unit identifier (e.g., PH4D)',
      hoaDues: 'Year (e.g., 2025)'
    }
  },

  // ===== VALIDATION HELPERS =====
  /**
   * Check if a field name is a timestamp field
   */
  isTimestampField: (fieldName) => {
    return databaseFieldMappings.FIELD_STANDARDS.timestamps.includes(fieldName);
  },

  /**
   * Check if a field name is an amount field
   */
  isAmountField: (fieldName) => {
    return databaseFieldMappings.FIELD_STANDARDS.amounts.includes(fieldName);
  },

  /**
   * Clean migration artifacts from an object
   */
  cleanMigrationArtifacts: (obj) => {
    const cleaned = { ...obj };
    databaseFieldMappings.FIELD_STANDARDS.migrationArtifacts.forEach(field => {
      delete cleaned[field];
    });
    return cleaned;
  }
};

// Default export for convenience
export default databaseFieldMappings;
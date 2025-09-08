/**
 * Shared database field mappings and conversion utilities
 * Used by all backend controllers and services
 */

import admin from 'firebase-admin';

// Timezone configuration - America/Cancun (no DST)
const CANCUN_TIMEZONE = 'America/Cancun';
const CANCUN_OFFSET = -5; // UTC-5, no DST changes

export const databaseFieldMappings = {
  // ===== TIMESTAMP CONVERSIONS =====
  /**
   * Convert various date formats to Firestore Timestamp
   * Always stores the timestamp as if it were in Cancun timezone
   * @param {Date|string|number|Object} dateValue - Input date in any format
   * @returns {admin.firestore.Timestamp} Firestore Timestamp
   */
  convertToTimestamp: (dateValue) => {
    if (!dateValue) return null;

    // Already a Firestore Timestamp
    if (dateValue._seconds !== undefined) {
      return dateValue;
    }

    // Convert to Date first
    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      return null;
    }

    // Check for valid date
    if (isNaN(date.getTime())) {
      return null;
    }

    // Convert to Cancun timezone components
    const cancunDateStr = date.toLocaleDateString("en-CA", {
      timeZone: "America/Cancun",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    const cancunTimeStr = date.toLocaleTimeString("en-CA", {
      timeZone: "America/Cancun",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    // Reconstruct the date preserving Cancun time
    // This ensures the stored timestamp represents the intended Cancun time
    const localDateTime = new Date(`${cancunDateStr}T${cancunTimeStr}`);

    return admin.firestore.Timestamp.fromDate(localDateTime);
  },

  /**
   * Convert Firestore Timestamp to ISO string for API responses
   * Returns the timestamp in Cancun timezone
   * @param {admin.firestore.Timestamp|Object} timestamp 
   * @returns {string} ISO date string in Cancun timezone
   */
  convertFromTimestamp: (timestamp) => {
    if (!timestamp) return null;
    
    let date;
    if (timestamp._seconds !== undefined) {
      date = new Date(timestamp._seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      return null;
    }
    
    // Format as Cancun time with explicit offset
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours() - 5).padStart(2, '0'); // Adjust for Cancun
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    
    // Handle date rollover when adjusting hours
    let adjustedDate = new Date(date);
    adjustedDate.setUTCHours(adjustedDate.getUTCHours() - 5);
    
    const adjustedYear = adjustedDate.getUTCFullYear();
    const adjustedMonth = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
    const adjustedDay = String(adjustedDate.getUTCDate()).padStart(2, '0');
    const adjustedHours = String(adjustedDate.getUTCHours()).padStart(2, '0');
    
    return `${adjustedYear}-${adjustedMonth}-${adjustedDay}T${adjustedHours}:${minutes}:${seconds}.${ms}-05:00`;
  },

  /**
   * Get start of day in Cancun timezone
   * @param {Date|string} date - Input date
   * @returns {admin.firestore.Timestamp} Start of day in Cancun time
   */
  getStartOfDayCancun: (date = new Date()) => {
    const d = new Date(date);
    // Set to midnight Cancun time
    const cancunDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00-05:00`;
    return databaseFieldMappings.convertToTimestamp(cancunDateStr);
  },

  /**
   * Get end of day in Cancun timezone
   * @param {Date|string} date - Input date
   * @returns {admin.firestore.Timestamp} End of day in Cancun time
   */
  getEndOfDayCancun: (date = new Date()) => {
    const d = new Date(date);
    // Set to 23:59:59.999 Cancun time
    const cancunDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T23:59:59.999-05:00`;
    return databaseFieldMappings.convertToTimestamp(cancunDateStr);
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

  // ===== DOCUMENT ID GENERATORS =====
  /**
   * Generate transaction document ID in Cancun timezone
   * Format: YYYY-MM-DD_HHMMSS_nnn
   * @param {string} [isoDateString] - Optional ISO date string for historical imports. If not provided, uses current timestamp
   * @returns {string} Document ID
   */
  /**
   * FIXED: July 23, 2025 - Corrected invalid date handling that was causing 000000_000 timestamps
   * For audit trail compliance, new transactions always use current timestamp
   * ENHANCED: July 25, 2025 - Added retry mechanism to ensure unique IDs
   */
  generateTransactionId: async (isoDateString) => {
    // Track recently generated IDs to ensure uniqueness
    if (!global._recentTransactionIds) {
      global._recentTransactionIds = new Set();
    }
    
    const maxRetries = 5;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      // Use provided date for historical imports, or current timestamp for real-time entries
      const now = isoDateString ? new Date(isoDateString) : new Date();

      // Convert to Cancun time using proper timezone handling
      // Use toLocaleString with America/Cancun timezone to get local time components
      const cancunTimeString = now.toLocaleString("en-CA", {
        timeZone: "America/Cancun",
        year: "numeric",
        month: "2-digit", 
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      
      // Parse the formatted string: "2025-01-07, 15:51:22"
      const [datePart, timePart] = cancunTimeString.split(', ');
      const [year, month, day] = datePart.split('-');
      const [hours, minutes, seconds] = timePart.split(':');
      const ms = String(now.getMilliseconds()).padStart(3, '0');
      
      const transactionId = `${year}-${month}-${day}_${hours}${minutes}${seconds}_${ms}`;
      
      // Check if this ID was recently generated
      if (!global._recentTransactionIds.has(transactionId)) {
        global._recentTransactionIds.add(transactionId);
        
        // Clean up old IDs after 1 second
        setTimeout(() => {
          global._recentTransactionIds.delete(transactionId);
        }, 1000);
        
        return transactionId;
      }
      
      // If duplicate, wait a tiny bit and retry
      retryCount++;
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2)); // Wait 2ms
      }
    }
    
    // If all retries failed, append a random suffix to ensure uniqueness
    const now = isoDateString ? new Date(isoDateString) : new Date();
    const cancunTimeString = now.toLocaleString("en-CA", {
      timeZone: "America/Cancun",
      year: "numeric",
      month: "2-digit", 
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    
    const [datePart, timePart] = cancunTimeString.split(', ');
    const [year, month, day] = datePart.split('-');
    const [hours, minutes, seconds] = timePart.split(':');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `${year}-${month}-${day}_${hours}${minutes}${seconds}_${randomSuffix}`;
  },

  // ===== FIELD MAPPINGS =====
  /**
   * Map old field names to new field names
   */
  fieldMappings: {
    users: {
      'propertyAccess': 'propertyAccess',
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
    timestamps: ['created', 'updated', 'lastLogin', 'createdAt', 'updatedAt'],
    amounts: ['amount', 'creditBalance', 'balance', 'totalPaid', 'totalDue'],
    references: ['unitId', 'clientId', 'userId', 'propertyId'],
    
    
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

};

// Default export for convenience
export default databaseFieldMappings;
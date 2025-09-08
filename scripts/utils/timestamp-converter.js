/**
 * timestamp-converter.js
 * Enhanced timestamp conversion utilities for SAMS import scripts
 * Handles all date/timestamp conversions according to field specifications
 */

import { Timestamp } from 'firebase-admin/firestore';

/**
 * Converts various date formats to Firestore Timestamp
 * @param {*} dateValue - Date value in various formats
 * @returns {Timestamp|null} - Firestore Timestamp or null
 */
function toFirestoreTimestamp(dateValue) {
  if (!dateValue) return null;
  
  // Already a Firestore Timestamp
  if (dateValue instanceof Timestamp) return dateValue;
  
  // Handle Firebase Timestamp-like objects (with _seconds property)
  if (dateValue._seconds !== undefined) {
    return new Timestamp(dateValue._seconds, dateValue._nanoseconds || 0);
  }
  
  // Handle JavaScript Date
  if (dateValue instanceof Date) {
    return Timestamp.fromDate(dateValue);
  }
  
  // Handle ISO string or other string formats
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }
  
  // Handle Unix timestamp (seconds since epoch)
  if (typeof dateValue === 'number') {
    return Timestamp.fromDate(new Date(dateValue * 1000));
  }
  
  console.error(`Cannot convert to Timestamp: ${JSON.stringify(dateValue)}`);
  return null;
}

/**
 * Converts Firestore Timestamp to JavaScript Date
 * @param {Timestamp} timestamp - Firestore Timestamp
 * @returns {Date|null} - JavaScript Date or null
 */
function timestampToDate(timestamp) {
  if (!timestamp) return null;
  
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  
  if (timestamp._seconds !== undefined) {
    return new Timestamp(timestamp._seconds, timestamp._nanoseconds || 0).toDate();
  }
  
  return null;
}

/**
 * Converts Firestore Timestamp to ISO string
 * @param {Timestamp} timestamp - Firestore Timestamp
 * @returns {string|null} - ISO date string or null
 */
function timestampToISO(timestamp) {
  const date = timestampToDate(timestamp);
  return date ? date.toISOString() : null;
}

/**
 * Generates transaction document ID with timestamp format
 * @param {Date|Timestamp} date - Date for the transaction
 * @param {number} sequenceNumber - Sequence number for uniqueness
 * @returns {string} - Document ID in format: YYYY-MM-DD_HHMMSS_001
 */
function generateTransactionDocId(date = new Date(), sequenceNumber = 1) {
  const jsDate = date instanceof Timestamp ? date.toDate() : date;
  
  // Convert to Cancun timezone (America/Cancun)
  const cancunTime = new Date(jsDate.toLocaleString("en-US", {timeZone: "America/Cancun"}));
  
  const year = cancunTime.getFullYear();
  const month = String(cancunTime.getMonth() + 1).padStart(2, '0');
  const day = String(cancunTime.getDate()).padStart(2, '0');
  const hours = String(cancunTime.getHours()).padStart(2, '0');
  const minutes = String(cancunTime.getMinutes()).padStart(2, '0');
  const seconds = String(cancunTime.getSeconds()).padStart(2, '0');
  const seq = String(sequenceNumber).padStart(3, '0');
  
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}_${seq}`;
}

/**
 * Get next available counter for a given datetime prefix
 * @param {Object} db - Firestore database instance
 * @param {string} clientId - Client ID
 * @param {Date} date - Transaction date
 * @returns {Promise<number>} Next available counter
 */
async function getNextTransactionCounter(db, clientId, date) {
  const jsDate = date instanceof Timestamp ? date.toDate() : date;
  const cancunTime = new Date(jsDate.toLocaleString("en-US", {timeZone: "America/Cancun"}));
  
  const year = cancunTime.getFullYear();
  const month = String(cancunTime.getMonth() + 1).padStart(2, '0');
  const day = String(cancunTime.getDate()).padStart(2, '0');
  const hours = String(cancunTime.getHours()).padStart(2, '0');
  const minutes = String(cancunTime.getMinutes()).padStart(2, '0');
  const seconds = String(cancunTime.getSeconds()).padStart(2, '0');
  
  const prefix = `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
  
  // Query for existing documents with the same datetime prefix
  const transactionsRef = db.collection(`clients/${clientId}/transactions`);
  
  // Get all documents with similar IDs and filter
  const snapshot = await transactionsRef
    .orderBy('__name__')
    .startAt(`${prefix}_000`)
    .endBefore(`${prefix}_999`)
    .get();
  
  // Find the highest counter used
  let maxCounter = 0;
  snapshot.docs.forEach(doc => {
    const docId = doc.id;
    const counterMatch = docId.match(/_(\d{3})$/);
    if (counterMatch) {
      const counter = parseInt(counterMatch[1], 10);
      if (counter > maxCounter) {
        maxCounter = counter;
      }
    }
  });
  
  return maxCounter + 1;
}

/**
 * Convert amount to cents (integer)
 * @param {number|string} amount - Amount value
 * @returns {number} Amount in cents
 */
function amountToCents(amount) {
  if (typeof amount === 'string') {
    amount = parseFloat(amount);
  }
  
  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  
  // If already in cents (large number), return as-is
  if (amount >= 10000) {
    return Math.round(amount);
  }
  
  // Convert pesos to cents
  return Math.round(amount * 100);
}

/**
 * Processes a data object and converts all date fields to Firestore Timestamps
 * @param {Object} data - Object containing data with date fields
 * @param {Array<string>} dateFields - Array of field names that should be timestamps
 * @returns {Object} - Object with date fields converted to Timestamps
 */
function convertDateFieldsToTimestamps(data, dateFields = []) {
  if (!data || typeof data !== 'object') return data;
  
  const result = { ...data };
  
  // Convert specified date fields
  dateFields.forEach(field => {
    if (result[field] !== undefined) {
      result[field] = toFirestoreTimestamp(result[field]);
    }
  });
  
  // Always convert 'updated' field if present (as per specifications)
  if (result.updated !== undefined) {
    result.updated = toFirestoreTimestamp(result.updated);
  }
  
  return result;
}

/**
 * Validates that a value is a proper Firestore Timestamp
 * @param {*} value - Value to validate
 * @returns {boolean} - True if valid Timestamp
 */
function isValidTimestamp(value) {
  return value instanceof Timestamp || 
         (value && value._seconds !== undefined && value._nanoseconds !== undefined);
}

/**
 * Gets current Firestore Timestamp
 * @returns {Timestamp} - Current timestamp
 */
function getCurrentTimestamp() {
  return Timestamp.now();
}

/**
 * Parses date from various Excel/CSV formats
 * @param {*} value - Date value from Excel/CSV
 * @returns {Date|null} - JavaScript Date or null
 */
function parseExcelDate(value) {
  if (!value) return null;
  
  // Handle Excel serial dates (days since 1900-01-01)
  if (typeof value === 'number' && value > 25569 && value < 50000) {
    // Excel dates start from 1900-01-01, JavaScript from 1970-01-01
    // 25569 = days between 1900-01-01 and 1970-01-01
    return new Date((value - 25569) * 86400 * 1000);
  }
  
  // Try standard date parsing
  const date = new Date(value);
  return !isNaN(date.getTime()) ? date : null;
}

export {
  toFirestoreTimestamp,
  timestampToDate,
  timestampToISO,
  generateTransactionDocId,
  getNextTransactionCounter,
  amountToCents,
  convertDateFieldsToTimestamps,
  isValidTimestamp,
  getCurrentTimestamp,
  parseExcelDate
};
/**
 * Date Normalization Utility
 * Converts various date formats to consistent JavaScript Date objects
 * for proper Firestore storage and frontend display compatibility.
 * 
 * This fixes the issue where import scripts create Firestore Timestamp objects
 * while UI-created transactions use JavaScript Date strings.
 */

/**
 * Normalize date fields for consistent Firestore storage
 * Converts various date formats to JavaScript Date objects
 * @param {Object} data - Transaction or document data
 * @returns {Object} - Data with normalized date fields
 */
export function normalizeDateFields(data) {
  const normalized = { ...data };
  
  // Normalize 'date' field
  if (normalized.date) {
    normalized.date = convertToDate(normalized.date);
  }
  
  // Normalize 'createdAt' field  
  if (normalized.createdAt) {
    normalized.createdAt = convertToDate(normalized.createdAt);
  }
  
  // Normalize 'updatedAt' field
  if (normalized.updatedAt) {
    normalized.updatedAt = convertToDate(normalized.updatedAt);
  }
  
  return normalized;
}

/**
 * Convert various date formats to JavaScript Date objects
 * @param {any} dateValue - Date in various formats
 * @returns {Date} - JavaScript Date object
 */
function convertToDate(dateValue) {
  // Handle Firestore Timestamp objects
  if (dateValue && typeof dateValue === 'object' && dateValue._seconds !== undefined) {
    return new Date(dateValue._seconds * 1000 + (dateValue._nanoseconds || 0) / 1000000);
  }
  
  // Handle Firebase Admin SDK Timestamp objects
  if (dateValue && typeof dateValue === 'object' && dateValue.toDate && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  }
  
  // Handle ISO strings and other string formats
  if (typeof dateValue === 'string') {
    return new Date(dateValue);
  }
  
  // Handle Date objects (pass through)
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Handle Unix timestamps (in milliseconds)
  if (typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  
  console.warn('Unknown date format:', dateValue);
  return new Date(); // Fallback to current date
}

/**
 * Validate that a date field is a proper JavaScript Date object
 * @param {any} dateValue - Value to validate
 * @returns {boolean} - True if valid JavaScript Date
 */
export function isValidJavaScriptDate(dateValue) {
  return dateValue instanceof Date && !isNaN(dateValue.getTime());
}

/**
 * Batch normalize date fields for multiple documents
 * @param {Array} documents - Array of documents to normalize
 * @returns {Array} - Array of documents with normalized dates
 */
export function normalizeDocumentDates(documents) {
  return documents.map(doc => normalizeDateFields(doc));
}
/**
 * Centavos Integer Validation Utility
 * 
 * Purpose: Eliminate floating point contamination in centavos fields before Firestore writes.
 * SAMS uses integer centavos architecture to avoid JavaScript floating point precision errors.
 * 
 * This utility validates that all centavos values are proper integers before being written
 * to Firestore, preventing contamination like 3972.9999999999995 or 189978.00000000023.
 * 
 * Architecture:
 * - STORAGE LAYER (Firestore): ALL amounts stored as INTEGER CENTAVOS
 * - BACKEND PROCESSING: ALL math performed in INTEGER CENTAVOS
 * - API RESPONSE: Amounts converted to PESOS (floating point)
 * - FRONTEND: Receives and displays PESOS only
 * 
 * Reusability: 100% across Water Bills, HOA Dues, Reports, Propane Tanks
 * 
 * @module shared/utils/centavosValidation
 */

/**
 * Validates and cleans a single centavos value
 * 
 * Handles null/undefined gracefully (returns 0)
 * Validates numeric values and ensures they are integers
 * Applies tolerance-based rounding for floating point errors
 * Throws errors if value exceeds tolerance threshold
 * 
 * @param {number|string|null|undefined} value - The centavos value to validate
 * @param {string} fieldName - Name of the field for error reporting
 * @param {number} [tolerance=0.2] - Maximum floating point tolerance in centavos
 * @returns {number} - Clean integer centavos value
 * @throws {Error} - If value exceeds tolerance threshold
 * 
 * @example
 * validateCentavos(10050, 'amount');           // 10050 (already integer)
 * validateCentavos(10050.01, 'amount', 0.2);   // 10050 (rounded, within tolerance)
 * validateCentavos(null, 'amount');            // 0 (null defaults to 0)
 * validateCentavos('100.5', 'amount');         // Error (not in centavos)
 */
export function validateCentavos(value, fieldName, tolerance = 0.2) {
  // Handle null/undefined - default to 0
  if (value === null || value === undefined) {
    return 0;
  }
  
  // Convert string to number if needed
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Validate it's a number
  if (isNaN(numValue)) {
    console.warn(`Centavos validation warning: ${fieldName} is NaN, defaulting to 0`);
    return 0;
  }
  
  // Check if already a proper integer
  if (Number.isInteger(numValue)) {
    return numValue;
  }
  
  // Apply tolerance-based rounding
  const rounded = Math.round(numValue);
  const difference = Math.abs(numValue - rounded);
  
  if (difference <= tolerance) {
    console.warn(`Centavos rounding: ${fieldName} ${numValue} → ${rounded} (diff: ${difference.toFixed(4)})`);
    return rounded;
  }
  
  // Beyond tolerance - throw error
  throw new Error(
    `CRITICAL: ${fieldName} floating point error exceeds tolerance. ` +
    `Value: ${numValue}, Difference: ${difference.toFixed(4)}, Tolerance: ${tolerance}`
  );
}

/**
 * Validates all centavos fields in an object recursively
 * 
 * Common centavos field patterns:
 * - *Amount, *Balance, *Due, *Paid, *Total, *Credit, *Debit
 * - waterBillAmount, previousBalance, totalDue, amountPaid
 * - billedAmount, paidAmount, balanceAmount
 * 
 * Handles nested objects and arrays recursively
 * Preserves non-centavos fields unchanged
 * Logs warnings for automatic corrections
 * 
 * @param {Object} obj - Object containing potential centavos fields
 * @param {string} [parentPath=''] - Path prefix for nested objects (for error reporting)
 * @returns {Object} - Object with all centavos values validated and cleaned
 * 
 * @example
 * const bill = {
 *   waterBillAmount: 10050.01,  // Will be rounded to 10050
 *   previousBalance: 5000,       // Already integer, unchanged
 *   unitId: 'A101',              // Non-centavos field, unchanged
 *   penalties: {
 *     penaltyAmount: 250.99      // Nested, will be rounded to 251
 *   }
 * };
 * const clean = validateCentavosInObject(bill);
 */
export function validateCentavosInObject(obj, parentPath = '') {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item, index) => 
      validateCentavosInObject(item, `${parentPath}[${index}]`)
    );
  }
  
  // Process object fields
  const cleaned = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const fieldPath = parentPath ? `${parentPath}.${key}` : key;
    
    // Check if this field is a centavos field (by naming convention)
    if (isCentavosField(key)) {
      cleaned[key] = validateCentavos(value, fieldPath);
    }
    // Recursively validate nested objects
    else if (value && typeof value === 'object') {
      cleaned[key] = validateCentavosInObject(value, fieldPath);
    }
    // Keep non-centavos primitives as-is
    else {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

/**
 * Determines if a field name represents a centavos value
 * 
 * Uses naming pattern recognition to identify centavos fields:
 * - Fields ending with: Amount, Balance, Due, Paid, Total, Credit, Debit, etc.
 * - Fields containing: centavos
 * - Exact matches: amount, balance, due, paid, total, credit, debit
 * 
 * @param {string} fieldName - Name of the field to check
 * @returns {boolean} - True if field is a centavos field
 * 
 * @example
 * isCentavosField('waterBillAmount');  // true
 * isCentavosField('totalDue');         // true
 * isCentavosField('unitId');           // false
 * isCentavosField('description');      // false
 * 
 * @private
 */
function isCentavosField(fieldName) {
  const centavosPatterns = [
    /Amount$/i,
    /Balance$/i,
    /Due$/i,
    /Paid$/i,
    /Total$/i,
    /Credit$/i,
    /Debit$/i,
    /Price$/i,
    /Cost$/i,
    /Fee$/i,
    /Charge$/i,
    /Payment$/i,
    /^amount$/i,
    /^balance$/i,
    /^due$/i,
    /^paid$/i,
    /^total$/i,
    /^credit$/i,
    /^debit$/i,
    /centavos/i
  ];
  
  return centavosPatterns.some(pattern => pattern.test(fieldName));
}

/**
 * Validates centavos fields in a batch of objects
 * Useful for bulk imports and migrations
 * 
 * @param {Array<Object>} objects - Array of objects to validate
 * @param {string} [batchName='batch'] - Name for error reporting
 * @returns {Array<Object>} - Array with all centavos values validated
 * 
 * @example
 * const bills = [
 *   { waterBillAmount: 10050.01, unitId: 'A101' },
 *   { waterBillAmount: 5000, unitId: 'A102' }
 * ];
 * const cleanBills = validateCentavosBatch(bills, 'waterBills');
 */
export function validateCentavosBatch(objects, batchName = 'batch') {
  if (!Array.isArray(objects)) {
    throw new Error(`validateCentavosBatch expects an array, got ${typeof objects}`);
  }
  
  return objects.map((obj, index) => 
    validateCentavosInObject(obj, `${batchName}[${index}]`)
  );
}

/**
 * Validates specific centavos fields in an object
 * Use when you know exactly which fields need validation
 * More efficient than full object validation for large objects
 * 
 * @param {Object} obj - Object containing centavos fields
 * @param {Array<string>} fieldNames - Array of field names to validate
 * @returns {Object} - Object with specified fields validated
 * 
 * @example
 * const bill = {
 *   waterBillAmount: 10050.01,
 *   previousBalance: 5000.99,
 *   unitId: 'A101',
 *   description: 'Monthly bill'
 * };
 * const clean = validateSpecificCentavos(bill, ['waterBillAmount', 'previousBalance']);
 * // Only waterBillAmount and previousBalance are validated, others unchanged
 */
export function validateSpecificCentavos(obj, fieldNames) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const cleaned = { ...obj };
  
  for (const fieldName of fieldNames) {
    if (fieldName in cleaned) {
      cleaned[fieldName] = validateCentavos(cleaned[fieldName], fieldName);
    }
  }
  
  return cleaned;
}

/**
 * Utility to manually clean a known floating point contamination
 * Used when you need to fix a specific value without full validation
 * 
 * @param {number} value - Contaminated floating point value
 * @returns {number} - Clean integer value
 * 
 * @example
 * cleanCentavosValue(3972.9999999999995);  // 3973
 * cleanCentavosValue(189978.00000000023);  // 189978
 * cleanCentavosValue(10050);               // 10050 (unchanged)
 */
export function cleanCentavosValue(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Math.round(value);
}


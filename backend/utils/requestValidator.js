/**
 * Request Validator Utility
 * Provides validation functions for API request data
 * Includes water meter specific validation
 */

/**
 * Validate required fields in request
 * @param {Object} data - Data object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} Validation result
 */
export function validateRequiredFields(data, requiredFields) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Invalid data object']
    };
  }
  
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate water meter reading value
 * @param {number} value - Reading value
 * @param {number} [previousValue] - Previous reading for comparison
 * @returns {Object} Validation result
 */
export function validateMeterReading(value, previousValue = null) {
  const errors = [];
  
  // Check if value is a number
  if (typeof value !== 'number' || isNaN(value)) {
    errors.push('Reading must be a valid number');
    return errors; // Stop validation if not a valid number
  }
  
  // Check if non-negative
  if (value < 0) {
    errors.push('Reading cannot be negative');
  }
  
  // Check reasonable range (0-999999)
  if (value > 999999) {
    errors.push('Reading exceeds maximum meter value (999999)');
  }
  
  // Check decimal places (max 2)
  const decimalPlaces = (value.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    errors.push('Reading can have maximum 2 decimal places');
  }
  
  // Warning for suspicious increase
  const warnings = [];
  if (previousValue !== null && value > previousValue) {
    const increase = value - previousValue;
    if (increase > 200) {
      warnings.push(`High consumption detected: ${increase} m³`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate billing dates
 * @param {string|Date} billingDate - Billing date
 * @param {string|Date} dueDate - Due date
 * @returns {Object} Validation result
 */
export function validateBillingDates(billingDate, dueDate) {
  const errors = [];
  
  // Parse dates
  const billing = new Date(billingDate);
  const due = new Date(dueDate);
  
  // Check valid dates
  if (isNaN(billing.getTime())) {
    errors.push('Invalid billing date');
  }
  
  if (isNaN(due.getTime())) {
    errors.push('Invalid due date');
  }
  
  // Due date must be after billing date
  if (billing >= due) {
    errors.push('Due date must be after billing date');
  }
  
  // Due date shouldn't be more than 30 days after billing
  const daysDiff = Math.floor((due - billing) / (1000 * 60 * 60 * 24));
  if (daysDiff > 30) {
    errors.push('Due date cannot be more than 30 days after billing date');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate payment amount
 * @param {number} amount - Payment amount in dollars
 * @param {number} billAmount - Bill amount in cents
 * @returns {Object} Validation result
 */
export function validatePaymentAmount(amount, billAmount) {
  const errors = [];
  const warnings = [];
  
  if (typeof amount !== 'number' || amount <= 0) {
    errors.push('Payment amount must be positive');
  }
  
  // Convert to cents for comparison
  const paymentCents = Math.round(amount * 100);
  
  // Warning for overpayment
  if (paymentCents > billAmount * 1.5) {
    warnings.push('Payment is more than 150% of bill amount');
  }
  
  // Warning for small partial payment
  if (paymentCents < billAmount * 0.1) {
    warnings.push('Payment is less than 10% of bill amount');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate batch readings array
 * @param {Array} readings - Array of reading objects
 * @returns {Object} Validation result
 */
export function validateBatchReadings(readings) {
  if (!Array.isArray(readings)) {
    return {
      valid: false,
      errors: ['Readings must be an array']
    };
  }
  
  if (readings.length === 0) {
    return {
      valid: false,
      errors: ['At least one reading is required']
    };
  }
  
  const errors = [];
  const validatedReadings = [];
  
  readings.forEach((reading, index) => {
    if (!reading.unitId) {
      errors.push(`Reading ${index + 1}: unitId is required`);
    }
    
    if (typeof reading.value !== 'number') {
      errors.push(`Reading ${index + 1}: value must be a number`);
    }
    
    const validation = validateMeterReading(reading.value);
    if (!validation.valid) {
      errors.push(`Reading ${index + 1} (${reading.unitId}): ${validation.errors.join(', ')}`);
    }
    
    validatedReadings.push({
      ...reading,
      validation
    });
  });
  
  return {
    valid: errors.length === 0,
    errors,
    readings: validatedReadings
  };
}

/**
 * Sanitize meter reading input
 * @param {any} value - Raw input value
 * @returns {number|null} Sanitized value or null
 */
export function sanitizeMeterReading(value) {
  // Handle string numbers
  if (typeof value === 'string') {
    // Remove spaces and commas
    const cleaned = value.replace(/[\s,]/g, '');
    const parsed = parseFloat(cleaned);
    
    if (!isNaN(parsed)) {
      // Round to 2 decimal places
      return Math.round(parsed * 100) / 100;
    }
  }
  
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.round(value * 100) / 100;
  }
  
  return null;
}

/**
 * Sanitize unit ID
 * @param {string} unitId - Unit identifier
 * @returns {string} Sanitized unit ID
 */
export function sanitizeUnitId(unitId) {
  if (typeof unitId !== 'string') {
    return '';
  }
  
  // For AVII, unit IDs are numeric strings like "101", "102", "201", etc.
  // Just trim whitespace, don't uppercase (they're numbers)
  return unitId.trim();
}

/**
 * Validate unit ID format for AVII
 * @param {string} unitId - Unit identifier
 * @returns {Object} Validation result
 */
export function validateUnitId(unitId) {
  const errors = [];
  
  if (!unitId || typeof unitId !== 'string') {
    errors.push('Unit ID must be a string');
    return { valid: false, errors };
  }
  
  // AVII uses numeric unit IDs like "101", "102", "201", etc.
  const numericPattern = /^\d{3}$/;
  if (!numericPattern.test(unitId)) {
    errors.push('Unit ID must be a 3-digit number (e.g., "101", "102")');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
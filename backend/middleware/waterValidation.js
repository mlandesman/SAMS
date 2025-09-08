/**
 * Water Meter Validation Middleware
 * Validates water meter specific requests
 */

import { 
  validateMeterReading, 
  validateBillingDates,
  validatePaymentAmount,
  validateBatchReadings,
  sanitizeMeterReading,
  sanitizeUnitId,
  validateUnitId,
  validateRequiredFields
} from '../utils/requestValidator.js';
import { writeAuditLog } from '../utils/auditLogger.js';

/**
 * Middleware to validate water meter readings
 */
export function validateReadingsInput(req, res, next) {
  const { clientId, readings } = req.body;
  
  // Check required fields
  if (!clientId) {
    writeAuditLog({
      module: 'waterMeter',
      action: 'validation_failed',
      parentPath: 'waterMeter/readings',
      docId: 'validation',
      friendlyName: 'Water reading validation failed',
      notes: 'Missing clientId',
      clientId: null
    });
    
    return res.status(400).json({
      error: 'Client ID is required'
    });
  }
  
  // Validate readings array
  const validation = validateBatchReadings(readings);
  
  if (!validation.valid) {
    writeAuditLog({
      module: 'waterMeter',
      action: 'validation_failed',
      parentPath: `clients/${clientId}/waterMeter/readings`,
      docId: 'validation',
      friendlyName: 'Water reading validation failed',
      notes: validation.errors.join('; '),
      clientId
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.errors
    });
  }
  
  // Check for warnings and log them
  const warningReadings = validation.readings.filter(r => r.validation.warnings && r.validation.warnings.length > 0);
  if (warningReadings.length > 0) {
    warningReadings.forEach(reading => {
      console.warn(`⚠️ Water reading warning for unit ${reading.unitId}: ${reading.validation.warnings.join(', ')}`);
    });
  }
  
  // Add validated readings to request
  req.validatedReadings = validation.readings;
  
  next();
}

/**
 * Middleware to validate bill generation input
 */
export function validateBillGeneration(req, res, next) {
  const { clientId, year, month, billingDate, dueDate } = req.body;
  
  const errors = [];
  
  // Required fields
  if (!clientId) errors.push('Client ID is required');
  if (!year) errors.push('Year is required');
  if (!month) errors.push('Month is required');
  
  // Validate year and month
  const currentYear = new Date().getFullYear();
  if (year && (year < 2024 || year > currentYear + 1)) {
    errors.push('Invalid year');
  }
  
  if (month && (month < 1 || month > 12)) {
    errors.push('Month must be between 1 and 12');
  }
  
  // Validate dates if provided
  if (billingDate && dueDate) {
    const dateValidation = validateBillingDates(billingDate, dueDate);
    if (!dateValidation.valid) {
      errors.push(...dateValidation.errors);
    }
  }
  
  if (errors.length > 0) {
    writeAuditLog({
      module: 'waterMeter',
      action: 'validation_failed',
      parentPath: `clients/${clientId}/waterMeter/bills`,
      docId: 'validation',
      friendlyName: 'Bill generation validation failed',
      notes: errors.join('; '),
      clientId
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }
  
  next();
}

/**
 * Middleware to validate payment input
 */
export function validatePaymentInput(req, res, next) {
  const { clientId, unitId, billId, amount, paymentDate } = req.body;
  
  const errors = [];
  
  // Required fields
  if (!clientId) errors.push('Client ID is required');
  if (!unitId) errors.push('Unit ID is required');
  if (!billId) errors.push('Bill ID is required');
  if (amount === undefined) errors.push('Amount is required');
  
  // Validate unit ID format for AVII
  if (unitId) {
    const unitValidation = validateUnitId(unitId);
    if (!unitValidation.valid) {
      errors.push(...unitValidation.errors);
    }
  }
  
  // Validate bill ID format (bill-YYYY-mon-xxxxx)
  const billIdPattern = /^bill-\d{4}-[a-z]{3}-[a-z0-9]+$/;
  if (billId && !billIdPattern.test(billId)) {
    errors.push('Invalid bill ID format');
  }
  
  // Validate amount
  if (typeof amount !== 'number' || amount <= 0) {
    errors.push('Amount must be a positive number');
  }
  
  // Validate payment date if provided
  if (paymentDate) {
    const date = new Date(paymentDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid payment date');
    }
  }
  
  if (errors.length > 0) {
    writeAuditLog({
      module: 'waterMeter',
      action: 'validation_failed',
      parentPath: `clients/${clientId}/waterMeter/payments`,
      docId: 'validation',
      friendlyName: 'Payment validation failed',
      notes: errors.join('; '),
      clientId
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }
  
  next();
}

/**
 * Middleware to sanitize water meter inputs
 */
export function sanitizeWaterInputs(req, res, next) {
  // Sanitize readings if present
  if (req.body.readings && Array.isArray(req.body.readings)) {
    req.body.readings = req.body.readings.map(reading => {
      // For values, only sanitize if it's a string - don't auto-round numbers
      let sanitizedValue = reading.value;
      if (typeof reading.value === 'string') {
        sanitizedValue = sanitizeMeterReading(reading.value);
      }
      
      return {
        ...reading,
        unitId: sanitizeUnitId(reading.unitId),
        value: sanitizedValue
      };
    });
  }
  
  // Sanitize single reading value
  if (req.body.value !== undefined) {
    req.body.value = sanitizeMeterReading(req.body.value);
  }
  
  // Sanitize unit ID
  if (req.body.unitId) {
    req.body.unitId = sanitizeUnitId(req.body.unitId);
  }
  
  // Sanitize amount (convert to number if string)
  if (req.body.amount !== undefined) {
    if (typeof req.body.amount === 'string') {
      const parsed = parseFloat(req.body.amount.replace(/[\s,]/g, ''));
      if (!isNaN(parsed)) {
        req.body.amount = parsed;
      }
    }
  }
  
  next();
}

/**
 * Middleware to validate single reading input
 */
export function validateSingleReading(req, res, next) {
  const { clientId, unitId, value } = req.body;
  
  const errors = [];
  
  // Required fields
  if (!clientId) errors.push('Client ID is required');
  if (!unitId) errors.push('Unit ID is required');
  if (value === undefined) errors.push('Reading value is required');
  
  // Validate unit ID
  if (unitId) {
    const unitValidation = validateUnitId(unitId);
    if (!unitValidation.valid) {
      errors.push(...unitValidation.errors);
    }
  }
  
  // Validate reading value
  if (value !== undefined) {
    const readingValidation = validateMeterReading(value);
    if (!readingValidation.valid) {
      errors.push(...readingValidation.errors);
    }
    
    // Add warnings to response header if any
    if (readingValidation.warnings && readingValidation.warnings.length > 0) {
      res.set('X-Validation-Warnings', readingValidation.warnings.join('; '));
    }
  }
  
  if (errors.length > 0) {
    writeAuditLog({
      module: 'waterMeter',
      action: 'validation_failed',
      parentPath: `clients/${clientId}/units/${unitId}/waterMeter`,
      docId: 'validation',
      friendlyName: 'Single reading validation failed',
      notes: errors.join('; '),
      clientId
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }
  
  next();
}
/**
 * Unified Payment Controller
 * 
 * Phase: Unified Payment System
 * Task: Task 2 - Controller Endpoints
 * Created: November 3, 2025
 * 
 * PURPOSE:
 * Exposes UnifiedPaymentWrapper service via RESTful API endpoints
 * for frontend preview and recording of cross-module payments.
 * 
 * ENDPOINTS:
 * - POST /payments/unified/preview - Preview payment allocation
 * - POST /payments/unified/record - Record payment to database
 * 
 * CRITICAL REQUIREMENTS:
 * - ES6 module format (export, not module.exports)
 * - Input validation for all parameters
 * - Proper error handling with user-friendly messages
 * - Firebase Auth middleware integration
 * - Uses existing UnifiedPaymentWrapper service
 */

import { unifiedPaymentWrapper } from '../services/unifiedPaymentWrapper.js';
import { getNow } from '../../shared/services/DateService.js';
import { pesosToCentavos, centavosToPesos } from '../../shared/utils/currencyUtils.js';

/**
 * Validate client ID
 * @param {string} clientId - Client ID to validate
 * @returns {object} Validation result
 */
function validateClientId(clientId) {
  if (!clientId) {
    return { valid: false, error: 'clientId is required' };
  }
  
  if (typeof clientId !== 'string') {
    return { valid: false, error: 'clientId must be a string' };
  }
  
  // No hardcoded list - trust frontend and auth middleware
  // Client list is dynamic and loaded from Firestore
  
  return { valid: true };
}

/**
 * Validate unit ID
 * @param {string} unitId - Unit ID to validate
 * @returns {object} Validation result
 */
function validateUnitId(unitId) {
  if (!unitId) {
    return { valid: false, error: 'unitId is required' };
  }
  
  if (typeof unitId !== 'string') {
    return { valid: false, error: 'unitId must be a string' };
  }
  
  if (unitId.trim().length === 0) {
    return { valid: false, error: 'unitId cannot be empty' };
  }
  
  return { valid: true };
}

/**
 * Validate payment amount
 * @param {number} amount - Payment amount in CENTAVOS
 * @returns {object} Validation result
 */
function validateAmount(amount) {
  // Special case: 0, null, or undefined are allowed for "show all bills" preview
  if (amount === 0 || amount === null || amount === undefined) {
    return { valid: true, isZeroAmount: true };
  }
  
  if (typeof amount !== 'number') {
    return { valid: false, error: 'amount must be a number' };
  }
  
  if (isNaN(amount)) {
    return { valid: false, error: 'amount must be a valid number' };
  }
  
  if (amount < 0) {
    return { valid: false, error: 'amount cannot be negative' };
  }
  
  // Reasonable upper limit: 10 million pesos = 1 billion centavos
  // This allows payments up to $10,000,000 MXN which covers any realistic scenario
  if (amount > 1000000000) {
    return { valid: false, error: 'amount exceeds maximum allowed (10,000,000 pesos)' };
  }
  
  return { valid: true, isZeroAmount: false };
}

/**
 * Validate payment date
 * @param {string} paymentDate - Payment date ISO string
 * @returns {object} Validation result
 */
function validatePaymentDate(paymentDate) {
  if (!paymentDate) {
    return { valid: false, error: 'paymentDate is required' };
  }
  
  if (typeof paymentDate !== 'string') {
    return { valid: false, error: 'paymentDate must be a string (ISO 8601 format)' };
  }
  
  // Try to parse the date
  const date = new Date(paymentDate);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'paymentDate must be a valid ISO date string' };
  }
  
  // Date cannot be too far in the future (1 year)
  const now = getNow();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  
  if (date > oneYearFromNow) {
    return { valid: false, error: 'paymentDate cannot be more than 1 year in the future' };
  }
  
  // Date cannot be too far in the past (5 years for retroactive payments)
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  
  if (date < fiveYearsAgo) {
    return { valid: false, error: 'paymentDate cannot be more than 5 years in the past' };
  }
  
  return { valid: true };
}

/**
 * Validate payment method
 * @param {string} paymentMethod - Payment method
 * @returns {object} Validation result
 */
function validatePaymentMethod(paymentMethod) {
  if (!paymentMethod) {
    return { valid: false, error: 'paymentMethod is required' };
  }
  
  if (typeof paymentMethod !== 'string') {
    return { valid: false, error: 'paymentMethod must be a string' };
  }
  
  // No hardcoded list - payment methods are configured per client in Firestore
  // Frontend loads from /clients/{clientId}/paymentMethods collection
  // Trust that frontend sent a valid value
  
  return { valid: true };
}

/**
 * Preview unified payment allocation
 * 
 * POST /payments/unified/preview
 * 
 * Shows how a payment will be distributed across HOA and Water Bills
 * without actually recording it to the database.
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
export const previewUnifiedPayment = async (req, res) => {
  try {
    console.log('🌐 [UNIFIED PAYMENT CONTROLLER] Preview request received');
    
    // Extract parameters from request body
    const { clientId, unitId, amount, paymentDate } = req.body;
    
    // Validate all required fields
    const clientValidation = validateClientId(clientId);
    if (!clientValidation.valid) {
      return res.status(400).json({
        success: false,
        error: clientValidation.error,
        details: { field: 'clientId' }
      });
    }
    
    const unitValidation = validateUnitId(unitId);
    if (!unitValidation.valid) {
      return res.status(400).json({
        success: false,
        error: unitValidation.error,
        details: { field: 'unitId' }
      });
    }
    
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return res.status(400).json({
        success: false,
        error: amountValidation.error,
        details: { field: 'amount' }
      });
    }
    
    const dateValidation = validatePaymentDate(paymentDate);
    if (!dateValidation.valid) {
      return res.status(400).json({
        success: false,
        error: dateValidation.error,
        details: { field: 'paymentDate' }
      });
    }
    
    // Handle special zero/null/undefined amount case
    let effectiveAmount = amount;
    let zeroAmountRequest = false;
    
    if (amountValidation.isZeroAmount) {
      // Use a very large amount (999,999,999 pesos = 99,999,999,900 centavos)
      // This ensures all bills and penalties are included
      effectiveAmount = 99999999900; // 999,999,999 pesos in centavos
      zeroAmountRequest = true;
      console.log(`   ℹ️  Zero/null amount request detected - using effective amount: ${effectiveAmount} centavos`);
    }
    
    // Convert centavos to pesos for the wrapper service
    // Frontend sends centavos, but wrapper expects pesos
    const amountInPesos = centavosToPesos(effectiveAmount);
    
    // Log validated request
    console.log(`   ℹ️  Client: ${clientId}, Unit: ${unitId}, Amount: ${amount} centavos (effective: ${effectiveAmount} centavos = $${amountInPesos}), Date: ${paymentDate}`);
    
    // Call UnifiedPaymentWrapper service (expects PESOS)
    const preview = await unifiedPaymentWrapper.previewUnifiedPayment(
      clientId,
      unitId,
      amountInPesos,
      paymentDate,
      zeroAmountRequest // Pass flag to wrapper
    );
    
    // Return successful preview
    console.log('✅ [UNIFIED PAYMENT CONTROLLER] Preview generated successfully');
    return res.status(200).json({
      success: true,
      preview: preview
    });
    
  } catch (error) {
    console.error('❌ [UNIFIED PAYMENT CONTROLLER] Preview error:', error);
    
    // Check for specific error types
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
        details: { type: 'not_found' }
      });
    }
    
    // Generic error response
    return res.status(500).json({
      success: false,
      error: 'Failed to generate payment preview',
      details: { 
        message: error.message,
        type: 'internal_error'
      }
    });
  }
};

/**
 * Record unified payment to database
 * 
 * POST /payments/unified/record
 * 
 * Records a payment that spans multiple modules (HOA and Water),
 * creating appropriate transactions and updating bills.
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
export const recordUnifiedPayment = async (req, res) => {
  try {
    console.log('🌐 [UNIFIED PAYMENT CONTROLLER] Record request received');
    
    // Extract parameters from request body
    const { 
      clientId, 
      unitId, 
      amount, 
      paymentDate, 
      paymentMethod, 
      reference, 
      notes,
      preview 
    } = req.body;
    
    // Validate all required fields
    const clientValidation = validateClientId(clientId);
    if (!clientValidation.valid) {
      return res.status(400).json({
        success: false,
        error: clientValidation.error,
        details: { field: 'clientId' }
      });
    }
    
    const unitValidation = validateUnitId(unitId);
    if (!unitValidation.valid) {
      return res.status(400).json({
        success: false,
        error: unitValidation.error,
        details: { field: 'unitId' }
      });
    }
    
    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return res.status(400).json({
        success: false,
        error: amountValidation.error,
        details: { field: 'amount' }
      });
    }
    
    const dateValidation = validatePaymentDate(paymentDate);
    if (!dateValidation.valid) {
      return res.status(400).json({
        success: false,
        error: dateValidation.error,
        details: { field: 'paymentDate' }
      });
    }
    
    const methodValidation = validatePaymentMethod(paymentMethod);
    if (!methodValidation.valid) {
      return res.status(400).json({
        success: false,
        error: methodValidation.error,
        details: { field: 'paymentMethod' }
      });
    }
    
    // Validate preview data
    if (!preview || typeof preview !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'preview data is required (must match data from preview endpoint)',
        details: { field: 'preview' }
      });
    }
    
    // Convert centavos to pesos for the wrapper service
    // Frontend sends centavos, but wrapper expects pesos
    const amountInPesos = centavosToPesos(amount);
    
    // Log validated request
    console.log(`   ℹ️  Client: ${clientId}, Unit: ${unitId}, Amount: ${amount} centavos ($${amountInPesos}), Method: ${paymentMethod}`);
    if (reference) console.log(`   ℹ️  Reference: ${reference}`);
    if (notes) console.log(`   ℹ️  Notes: ${notes}`);
    
    // Prepare payment data (include user ID from auth middleware)
    const paymentData = {
      amount: amountInPesos,  // Convert to pesos for wrapper
      paymentDate,
      paymentMethod,
      reference: reference || null,
      notes: notes || null,
      preview,
      userId: req.user?.uid || 'system',
      accountId: req.body.accountId || 'bank-001', // Required for account balance updates
      accountType: req.body.accountType || 'bank'  // Required for account balance updates
    };
    
    // Call UnifiedPaymentWrapper service to record payment
    const result = await unifiedPaymentWrapper.recordUnifiedPayment(
      clientId,
      unitId,
      paymentData
    );
    
    // Return successful recording
    console.log('✅ [UNIFIED PAYMENT CONTROLLER] Payment recorded successfully');
    console.log(`   Transaction ID: ${result.transactionId}`);
    return res.status(200).json({
      success: true,
      result: result
    });
    
  } catch (error) {
    console.error('❌ [UNIFIED PAYMENT CONTROLLER] Record error:', error);
    
    // Check for specific error types
    if (error.message && error.message.includes('changed since preview')) {
      return res.status(409).json({
        success: false,
        error: error.message,
        details: { 
          type: 'conflict',
          message: 'Bills have changed since preview. Please refresh and try again.'
        }
      });
    }
    
    if (error.message && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message,
        details: { type: 'not_found' }
      });
    }
    
    // Check for database errors
    if (error.code && error.code.includes('firestore')) {
      return res.status(500).json({
        success: false,
        error: 'Database error while recording payment',
        details: { 
          type: 'database_error',
          message: error.message
        }
      });
    }
    
    // Generic error response
    return res.status(500).json({
      success: false,
      error: 'Failed to record payment',
      details: { 
        message: error.message,
        type: 'internal_error'
      }
    });
  }
};


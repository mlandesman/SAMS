/**
 * Enterprise Data Validation System
 * Comprehensive validation rules and security measures
 * Phase 2: Data Validation & Security Implementation
 */

import { getDbEnterprise, releaseDbConnection } from '../firebase-enterprise.js';

// Enterprise validation configuration
const VALIDATION_CONFIG = {
  // String length limits
  maxStringLength: {
    description: 500,
    name: 100,
    email: 254,
    phone: 20,
    address: 200,
    category: 50,
    vendor: 100,
    currency: 3,
    notes: 1000
  },

  // Numeric limits
  numericLimits: {
    amount: { min: -999999999.99, max: 999999999.99 },
    percentage: { min: 0, max: 100 },
    unitCount: { min: 1, max: 10000 },
    year: { min: 1900, max: 2100 }
  },

  // Security patterns
  securityPatterns: {
    sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b|['";]|--|\*\/|\*\*)/i,
    xssPatterns: /(<script|javascript:|on\w+\s*=|<iframe|<object|<embed)/i,
    pathTraversal: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\)/i,
    maliciousFiles: /\.(exe|bat|cmd|sh|ps1|vbs|jar|scr|pif|com)$/i
  },

  // Data format patterns
  formatPatterns: {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[\+]?[1-9][\d]{0,15}$/,
    currency: /^[A-Z]{3}$/,
    mongoId: /^[0-9a-fA-F]{24}$/,
    uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i
  }
};

/**
 * Enterprise validation result structure
 */
class ValidationResult {
  constructor() {
    this.valid = true;
    this.errors = [];
    this.warnings = [];
    this.sanitized = {};
    this.securityIssues = [];
  }

  addError(field, message, severity = 'error') {
    this.valid = false;
    this.errors.push({ field, message, severity, timestamp: new Date().toISOString() });
  }

  addWarning(field, message) {
    this.warnings.push({ field, message, timestamp: new Date().toISOString() });
  }

  addSecurityIssue(field, issue, severity = 'high') {
    this.valid = false;
    this.securityIssues.push({
      field,
      issue,
      severity,
      timestamp: new Date().toISOString(),
      remoteAddr: process.env.CLIENT_IP || 'unknown'
    });
  }

  setSanitized(field, value) {
    this.sanitized[field] = value;
  }
}

/**
 * Enterprise data sanitizer
 */
class DataSanitizer {
  /**
   * Sanitize string input to prevent security issues
   */
  static sanitizeString(input, options = {}) {
    if (typeof input !== 'string') {
      return input;
    }

    let sanitized = input;

    sanitized = sanitized.replace(/\0/g, '');

    // Trim whitespace
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }

    if (options.allowNewlines) {
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    } else {
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    }

    // Escape HTML if requested
    if (options.escapeHtml) {
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    // Limit length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumber(input, options = {}) {
    if (typeof input === 'number') {
      if (!isFinite(input)) {
        return null;
      }
      return input;
    }

    if (typeof input === 'string') {
      const parsed = parseFloat(input);
      if (isNaN(parsed) || !isFinite(parsed)) {
        return null;
      }

      // Apply rounding if specified
      if (options.decimals !== undefined) {
        return Math.round(parsed * Math.pow(10, options.decimals)) / Math.pow(10, options.decimals);
      }

      return parsed;
    }

    return null;
  }

  /**
   * Sanitize email address
   */
  static sanitizeEmail(input) {
    if (typeof input !== 'string') {
      return null;
    }

    const sanitized = this.sanitizeString(input, { trim: true }).toLowerCase();

    if (!VALIDATION_CONFIG.formatPatterns.email.test(sanitized)) {
      return null;
    }

    return sanitized;
  }

  /**
   * Sanitize date input
   */
  static sanitizeDate(input) {
    if (input instanceof Date) {
      return isNaN(input.getTime()) ? null : input;
    }

    if (typeof input === 'string') {
      const date = new Date(input);
      return isNaN(date.getTime()) ? null : date;
    }

    if (typeof input === 'number') {
      const date = new Date(input);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }
}

/**
 * Enterprise field validator
 */
class FieldValidator {
  /**
   * Validate transaction data
   */
  static validateTransaction(data) {
    const result = new ValidationResult();

    if (!data || typeof data !== 'object') {
      result.addError('root', 'Transaction data must be a valid object');
      return result;
    }

    if (data.amount === undefined || data.amount === null) {
      result.addError('amount', 'Amount is required');
    } else {
      const sanitizedAmount = DataSanitizer.sanitizeNumber(data.amount, { decimals: 2 });
      if (sanitizedAmount === null) {
        result.addError('amount', 'Amount must be a valid number');
      } else if (sanitizedAmount === 0) {
        result.addError('amount', 'Amount cannot be zero');
      } else if (sanitizedAmount < VALIDATION_CONFIG.numericLimits.amount.min ||
                 sanitizedAmount > VALIDATION_CONFIG.numericLimits.amount.max) {
        result.addError('amount', `Amount must be between ${VALIDATION_CONFIG.numericLimits.amount.min} and ${VALIDATION_CONFIG.numericLimits.amount.max}`);
      } else {
        result.setSanitized('amount', sanitizedAmount);
      }
    }

    if (!data.description || typeof data.description !== 'string') {
      result.addError('description', 'Description is required and must be a string');
    } else {
      this._validateStringField(result, 'description', data.description, {
        required: true,
        maxLength: VALIDATION_CONFIG.maxStringLength.description
      });
    }

    this._validateOptionalStringField(result, 'category', data.category, VALIDATION_CONFIG.maxStringLength.category);
    this._validateOptionalStringField(result, 'vendor', data.vendor, VALIDATION_CONFIG.maxStringLength.vendor);
    this._validateOptionalStringField(result, 'notes', data.notes, VALIDATION_CONFIG.maxStringLength.notes);

    if (data.currency) {
      if (typeof data.currency !== 'string') {
        result.addError('currency', 'Currency must be a string');
      } else if (!VALIDATION_CONFIG.formatPatterns.currency.test(data.currency)) {
        result.addError('currency', 'Currency must be a valid 3-letter code (e.g., USD, EUR, MXN)');
      } else {
        result.setSanitized('currency', data.currency.toUpperCase());
      }
    }

    if (data.date) {
      const sanitizedDate = DataSanitizer.sanitizeDate(data.date);
      if (sanitizedDate === null) {
        result.addError('date', 'Date must be a valid date');
      } else {
        result.setSanitized('date', sanitizedDate);
      }
    }

    return result;
  }

  /**
   * Validate balance data
   */
  static validateBalance(data) {
    const result = new ValidationResult();

    if (!data || typeof data !== 'object') {
      result.addError('root', 'Balance data must be a valid object');
      return result;
    }

    const requiredFields = ['totalIncome', 'totalExpenses', 'netBalance'];
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        result.addError(field, `${field} is required`);
      } else {
        const sanitizedValue = DataSanitizer.sanitizeNumber(data[field], { decimals: 2 });
        if (sanitizedValue === null) {
          result.addError(field, `${field} must be a valid number`);
        } else if (sanitizedValue < VALIDATION_CONFIG.numericLimits.amount.min ||
                   sanitizedValue > VALIDATION_CONFIG.numericLimits.amount.max) {
          result.addError(field, `${field} must be within acceptable range`);
        } else {
          result.setSanitized(field, sanitizedValue);
        }
      }
    }

    if (data.currency) {
      if (typeof data.currency !== 'string') {
        result.addError('currency', 'Currency must be a string');
      } else if (!VALIDATION_CONFIG.formatPatterns.currency.test(data.currency)) {
        result.addError('currency', 'Currency must be a valid 3-letter code');
      } else {
        result.setSanitized('currency', data.currency.toUpperCase());
      }
    }

    this._validateOptionalStringField(result, 'notes', data.notes, VALIDATION_CONFIG.maxStringLength.notes);

    return result;
  }

  /**
   * Validate user data
   */
  static validateUser(data) {
    const result = new ValidationResult();

    if (!data || typeof data !== 'object') {
      result.addError('root', 'User data must be a valid object');
      return result;
    }

    if (!data.email) {
      result.addError('email', 'Email is required');
    } else {
      const sanitizedEmail = DataSanitizer.sanitizeEmail(data.email);
      if (sanitizedEmail === null) {
        result.addError('email', 'Email must be a valid email address');
      } else {
        result.setSanitized('email', sanitizedEmail);
      }
    }

    this._validateStringField(result, 'name', data.name, {
      required: true,
      maxLength: VALIDATION_CONFIG.maxStringLength.name
    });

    this._validateOptionalStringField(result, 'phone', data.phone, VALIDATION_CONFIG.maxStringLength.phone);
    this._validateOptionalStringField(result, 'address', data.address, VALIDATION_CONFIG.maxStringLength.address);

    return result;
  }

  /**
   * Validate string field with security checks
   */
  static _validateStringField(result, fieldName, value, options = {}) {
    if (options.required && (!value || typeof value !== 'string')) {
      result.addError(fieldName, `${fieldName} is required and must be a string`);
      return;
    }

    if (!value) {
      return; // Optional field not provided
    }

    if (typeof value !== 'string') {
      result.addError(fieldName, `${fieldName} must be a string`);
      return;
    }

    // Security checks
    this._performSecurityChecks(result, fieldName, value);

    // Sanitize the value
    const sanitized = DataSanitizer.sanitizeString(value, {
      trim: true,
      maxLength: options.maxLength,
      allowNewlines: options.allowNewlines,
      escapeHtml: options.escapeHtml
    });

    // Length validation
    if (options.maxLength && sanitized.length > options.maxLength) {
      result.addError(fieldName, `${fieldName} cannot exceed ${options.maxLength} characters`);
      return;
    }

    if (options.minLength && sanitized.length < options.minLength) {
      result.addError(fieldName, `${fieldName} must be at least ${options.minLength} characters`);
      return;
    }

    // Empty after sanitization
    if (options.required && sanitized.length === 0) {
      result.addError(fieldName, `${fieldName} cannot be empty`);
      return;
    }

    result.setSanitized(fieldName, sanitized);
  }

  /**
   * Validate optional string field
   */
  static _validateOptionalStringField(result, fieldName, value, maxLength) {
    if (value !== undefined && value !== null) {
      this._validateStringField(result, fieldName, value, { maxLength });
    }
  }

  /**
   * Perform security checks on string data
   */
  static _performSecurityChecks(result, fieldName, value) {
    // SQL Injection check
    if (VALIDATION_CONFIG.securityPatterns.sqlInjection.test(value)) {
      result.addSecurityIssue(fieldName, 'Potential SQL injection attempt detected', 'critical');
    }

    // XSS check
    if (VALIDATION_CONFIG.securityPatterns.xssPatterns.test(value)) {
      result.addSecurityIssue(fieldName, 'Potential XSS attempt detected', 'critical');
    }

    // Path traversal check
    if (VALIDATION_CONFIG.securityPatterns.pathTraversal.test(value)) {
      result.addSecurityIssue(fieldName, 'Potential path traversal attempt detected', 'high');
    }

    if (value.length > 10000) {
      result.addSecurityIssue(fieldName, 'Excessively long input detected', 'medium');
    }

    const repeatedPattern = /(.)\1{50,}/;
    if (repeatedPattern.test(value)) {
      result.addSecurityIssue(fieldName, 'Repeated character pattern detected', 'low');
    }
  }
}

/**
 * Security audit logger
 */
class SecurityAuditLogger {
  /**
   * Log security issue
   */
  static async logSecurityIssue(issue, context = {}) {
    try {
      const db = await getDbEnterprise();

      try {
        const auditRef = db.collection('security_audit').doc();

        await auditRef.set({
          ...issue,
          context,
          timestamp: new Date(),
          environment: process.env.NODE_ENV || 'development',
          userAgent: context.userAgent || 'unknown',
          ipAddress: context.ipAddress || 'unknown',
          severity: issue.severity || 'medium',
          resolved: false
        });

        // Also log to console for immediate attention
        console.warn(`🚨 SECURITY ISSUE: ${issue.issue} in field ${issue.field}`, {
          severity: issue.severity,
          context
        });

      } finally {
        releaseDbConnection();
      }

    } catch (error) {
      console.error('❌ Failed to log security issue:', error);
      // Don't throw - security logging failure shouldn't break application
    }
  }

  /**
   * Log validation failure
   */
  static async logValidationFailure(validation, context = {}) {
    if (validation.securityIssues.length > 0) {
      for (const issue of validation.securityIssues) {
        await this.logSecurityIssue(issue, context);
      }
    }
  }
}

/**
 * Enterprise data validator - main interface
 */
class EnterpriseDataValidator {
  /**
   * Validate and sanitize transaction data
   */
  static async validateTransaction(data, context = {}) {
    const validation = FieldValidator.validateTransaction(data);

    if (validation.securityIssues.length > 0) {
      await SecurityAuditLogger.logValidationFailure(validation, context);
    }

    return validation;
  }

  /**
   * Validate and sanitize balance data
   */
  static async validateBalance(data, context = {}) {
    const validation = FieldValidator.validateBalance(data);

    if (validation.securityIssues.length > 0) {
      await SecurityAuditLogger.logValidationFailure(validation, context);
    }

    return validation;
  }

  /**
   * Validate and sanitize user data
   */
  static async validateUser(data, context = {}) {
    const validation = FieldValidator.validateUser(data);

    if (validation.securityIssues.length > 0) {
      await SecurityAuditLogger.logValidationFailure(validation, context);
    }

    return validation;
  }

  /**
   * Validate client ID for multi-tenant security
   */
  static validateClientId(clientId, userId) {
    const result = new ValidationResult();

    if (!clientId || typeof clientId !== 'string') {
      result.addError('clientId', 'Client ID is required and must be a string');
      return result;
    }

    // Sanitize client ID
    const sanitized = DataSanitizer.sanitizeString(clientId, { trim: true });

    if (sanitized.length === 0) {
      result.addError('clientId', 'Client ID cannot be empty');
      return result;
    }

    if (sanitized.length > 50) {
      result.addError('clientId', 'Client ID cannot exceed 50 characters');
      return result;
    }

    // Security checks
    FieldValidator._performSecurityChecks(result, 'clientId', sanitized);

    result.setSanitized('clientId', sanitized);
    return result;
  }

  /**
   * Get validation configuration (for frontend)
   */
  static getValidationConfig() {
    return {
      maxLengths: VALIDATION_CONFIG.maxStringLength,
      numericLimits: VALIDATION_CONFIG.numericLimits,
      formatPatterns: {
        email: VALIDATION_CONFIG.formatPatterns.email.toString(),
        phone: VALIDATION_CONFIG.formatPatterns.phone.toString(),
        currency: VALIDATION_CONFIG.formatPatterns.currency.toString()
      }
    };
  }
}

export {
  EnterpriseDataValidator,
  DataSanitizer,
  FieldValidator,
  ValidationResult,
  SecurityAuditLogger,
  VALIDATION_CONFIG
};
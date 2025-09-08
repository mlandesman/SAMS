/**
 * field-validator.js
 * Comprehensive field validation utilities for SAMS import scripts
 * Validates data against field specifications for all collections
 */

import { Timestamp } from 'firebase-admin/firestore';
import { isValidTimestamp } from './timestamp-converter.js';

/**
 * Base validation functions
 */
const validators = {
  required: (value, fieldName) => {
    if (value === undefined || value === null) {
      throw new Error(`Missing required field: ${fieldName}`);
    }
  },
  
  string: (value, fieldName) => {
    if (value !== null && typeof value !== 'string') {
      throw new Error(`Field ${fieldName} must be a string, got ${typeof value}`);
    }
  },
  
  number: (value, fieldName) => {
    if (value !== null && typeof value !== 'number') {
      throw new Error(`Field ${fieldName} must be a number, got ${typeof value}`);
    }
  },
  
  boolean: (value, fieldName) => {
    if (value !== null && typeof value !== 'boolean') {
      throw new Error(`Field ${fieldName} must be a boolean, got ${typeof value}`);
    }
  },
  
  timestamp: (value, fieldName) => {
    if (value !== null && !isValidTimestamp(value)) {
      throw new Error(`Field ${fieldName} must be a Firestore Timestamp`);
    }
  },
  
  enum: (value, fieldName, allowedValues) => {
    if (value !== null && !allowedValues.includes(value)) {
      throw new Error(`Field ${fieldName} must be one of: ${allowedValues.join(', ')}, got ${value}`);
    }
  },
  
  array: (value, fieldName, length = null) => {
    if (value !== null) {
      if (!Array.isArray(value)) {
        throw new Error(`Field ${fieldName} must be an array`);
      }
      if (length !== null && value.length !== length) {
        throw new Error(`Field ${fieldName} must have exactly ${length} elements, got ${value.length}`);
      }
    }
  },
  
  object: (value, fieldName) => {
    if (value !== null && (typeof value !== 'object' || Array.isArray(value))) {
      throw new Error(`Field ${fieldName} must be an object`);
    }
  },
  
  positiveNumber: (value, fieldName) => {
    if (value !== null) {
      validators.number(value, fieldName);
      if (value < 0) {
        throw new Error(`Field ${fieldName} must be a positive number`);
      }
    }
  },
  
  email: (value, fieldName) => {
    if (value !== null) {
      validators.string(value, fieldName);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error(`Field ${fieldName} must be a valid email address`);
      }
    }
  },
  
  phoneNumber: (value, fieldName) => {
    if (value !== null) {
      validators.string(value, fieldName);
      // Basic phone validation - accepts formats with country code
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(value) || value.length < 10) {
        throw new Error(`Field ${fieldName} must be a valid phone number`);
      }
    }
  },
  
  url: (value, fieldName) => {
    if (value !== null) {
      validators.string(value, fieldName);
      try {
        new URL(value);
      } catch {
        throw new Error(`Field ${fieldName} must be a valid URL`);
      }
    }
  }
};

/**
 * Collection-specific field specifications
 */
const fieldSpecs = {
  clients: {
    required: ['clientId', 'name', 'status', 'basicInfo', 'contactInfo'],
    fields: {
      clientId: { type: 'string' },
      name: { type: 'string' },
      status: { type: 'enum', values: ['active', 'inactive', 'suspended'] },
      basicInfo: {
        type: 'object',
        required: ['clientType', 'legalType', 'displayName'],
        fields: {
          clientType: { type: 'enum', values: ['HOA', 'Condo', 'SingleFamily', 'Commercial'] },
          legalType: { type: 'enum', values: ['AC', 'SC', 'Individual', 'Trust'] },
          displayName: { type: 'string' },
          description: { type: 'string' }
        }
      },
      contactInfo: {
        type: 'object',
        required: ['primaryEmail'],
        fields: {
          primaryEmail: { type: 'email' },
          secondaryEmail: { type: 'email' },
          primaryPhone: { type: 'phoneNumber' },
          secondaryPhone: { type: 'phoneNumber' }
        }
      },
      propertyInfo: { type: 'object' },
      branding: { type: 'object' },
      configuration: { type: 'object' },
      notes: { type: 'string' },
      updated: { type: 'timestamp', required: true }
    }
  },
  
  users: {
    required: ['email', 'displayName', 'isSuperAdmin', 'propertyAccess', 'profile', 'notifications', 'accountState', 'updated'],
    fields: {
      email: { type: 'email' },
      displayName: { type: 'string' },
      isSuperAdmin: { type: 'boolean' },
      propertyAccess: { type: 'object' },
      profile: {
        type: 'object',
        required: ['firstName', 'lastName'],
        fields: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'phoneNumber' },
          preferredCurrency: { type: 'enum', values: ['MXN', 'USD', 'CAD'] },
          preferredLanguage: { type: 'enum', values: ['english', 'spanish'] },
          taxId: { type: 'string' }
        }
      },
      notifications: {
        type: 'object',
        required: ['email', 'sms', 'duesReminders'],
        fields: {
          email: { type: 'boolean' },
          sms: { type: 'boolean' },
          duesReminders: { type: 'boolean' }
        }
      },
      mustChangePassword: { type: 'boolean' },
      accountState: { type: 'enum', values: ['active', 'suspended', 'pending'] },
      lastPasswordResetDate: { type: 'timestamp' },
      updated: { type: 'timestamp' }
    }
  },
  
  transactions: {
    required: ['date', 'amount', 'transactionType', 'vendorId', 'vendorName', 'categoryName', 'accountId', 'accountName', 'updated'],
    fields: {
      date: { type: 'timestamp' },
      amount: { type: 'positiveNumber' },
      transactionType: { type: 'enum', values: ['income', 'expense'] },
      vendorId: { type: 'string' },
      vendorName: { type: 'string' },
      categoryName: { type: 'string' },
      unitId: { type: 'string' },
      accountId: { type: 'string' },
      accountName: { type: 'string' },
      paymentMethod: { type: 'string' },
      checkNumber: { type: 'string' },
      reference: { type: 'string' },
      notes: { type: 'string' },
      documents: { type: 'array', default: [] },
      duesDistribution: { type: 'array' },
      updated: { type: 'timestamp' }
    }
  },
  
  categories: {
    required: ['categoryId', 'categoryName', 'clientId', 'updated'],
    fields: {
      categoryId: { type: 'string' },
      categoryName: { type: 'string' },
      clientId: { type: 'string' },
      updated: { type: 'timestamp' }
    }
  },
  
  vendors: {
    required: ['vendorId', 'vendorName', 'vendorType', 'updated'],
    fields: {
      vendorId: { type: 'string' },
      vendorName: { type: 'string' },
      vendorType: { type: 'enum', values: ['income', 'expense'] },
      clientId: { type: 'string' },
      taxId: { type: 'string' },
      email: { type: 'email' },
      phone: { type: 'phoneNumber' },
      website: { type: 'url' },
      serviceDescription: { type: 'string' },
      accountNumber: { type: 'string' },
      notes: { type: 'string' },
      updated: { type: 'timestamp' }
    }
  },
  
  units: {
    required: ['unitId', 'unitNumber', 'owner', 'updated'],
    fields: {
      unitId: { type: 'string' },
      unitNumber: { type: 'string' },
      owner: { type: 'string' },
      tenant: { type: 'string' },
      contractSigner: { type: 'string' },
      notes: { type: 'string' },
      squareFeet: { type: 'positiveNumber' },
      ownershipPercentage: { type: 'positiveNumber' },
      additionalNotes: { type: 'string' },
      updated: { type: 'timestamp' }
    }
  },
  
  hoaDues: {
    required: ['year', 'scheduledAmount', 'payments', 'updated'],
    fields: {
      year: { type: 'string' },
      scheduledAmount: { type: 'positiveNumber' },
      creditBalance: { type: 'number', default: 0 },
      payments: { type: 'array', length: 12 },
      updated: { type: 'timestamp' },
      creditBalanceHistory: { type: 'array' }
    }
  }
};

/**
 * Validates a single field value against its specification
 * @param {*} value - Value to validate
 * @param {Object} fieldSpec - Field specification
 * @param {string} fieldName - Field name for error messages
 */
function validateField(value, fieldSpec, fieldName) {
  // Apply default if value is undefined
  if (value === undefined && fieldSpec.default !== undefined) {
    return fieldSpec.default;
  }
  
  // Skip validation if value is null (unless required)
  if (value === null || value === undefined) {
    return value;
  }
  
  // Validate based on type
  switch (fieldSpec.type) {
    case 'string':
      validators.string(value, fieldName);
      break;
    case 'number':
      validators.number(value, fieldName);
      break;
    case 'positiveNumber':
      validators.positiveNumber(value, fieldName);
      break;
    case 'boolean':
      validators.boolean(value, fieldName);
      break;
    case 'timestamp':
      validators.timestamp(value, fieldName);
      break;
    case 'email':
      validators.email(value, fieldName);
      break;
    case 'phoneNumber':
      validators.phoneNumber(value, fieldName);
      break;
    case 'url':
      validators.url(value, fieldName);
      break;
    case 'enum':
      validators.enum(value, fieldName, fieldSpec.values);
      break;
    case 'array':
      validators.array(value, fieldName, fieldSpec.length);
      break;
    case 'object':
      validators.object(value, fieldName);
      // Recursively validate nested object if spec provided
      if (fieldSpec.fields && value !== null) {
        validateNestedObject(value, fieldSpec, fieldName);
      }
      break;
  }
  
  return value;
}

/**
 * Validates nested object fields
 * @param {Object} obj - Object to validate
 * @param {Object} spec - Object specification
 * @param {string} parentField - Parent field name
 */
function validateNestedObject(obj, spec, parentField) {
  // Check required fields
  if (spec.required) {
    spec.required.forEach(field => {
      validators.required(obj[field], `${parentField}.${field}`);
    });
  }
  
  // Validate each field
  if (spec.fields) {
    Object.keys(spec.fields).forEach(field => {
      if (obj[field] !== undefined) {
        obj[field] = validateField(obj[field], spec.fields[field], `${parentField}.${field}`);
      }
    });
  }
}

/**
 * Validates data against collection field specifications
 * @param {Object} data - Data to validate
 * @param {string} collectionName - Collection name
 * @returns {Object} - Validated and cleaned data
 */
function validateCollectionData(data, collectionName) {
  const spec = fieldSpecs[collectionName];
  if (!spec) {
    throw new Error(`No field specification found for collection: ${collectionName}`);
  }
  
  // Check required fields
  spec.required.forEach(field => {
    validators.required(data[field], field);
  });
  
  // Validate each field
  const validatedData = {};
  Object.keys(spec.fields).forEach(field => {
    const fieldSpec = spec.fields[field];
    const isRequired = spec.required.includes(field) || fieldSpec.required;
    
    if (data[field] !== undefined || isRequired || fieldSpec.default !== undefined) {
      validatedData[field] = validateField(data[field], fieldSpec, field);
    }
  });
  
  return validatedData;
}

/**
 * Validates document ID format for specific collections
 * @param {string} docId - Document ID to validate
 * @param {string} collectionName - Collection name
 * @returns {boolean} - True if valid
 */
function validateDocumentId(docId, collectionName) {
  switch (collectionName) {
    case 'transactions':
      // Format: YYYY-MM-DD_HHMMSS_nnn
      const transactionRegex = /^\d{4}-\d{2}-\d{2}_\d{6}_\d{3}$/;
      return transactionRegex.test(docId);
    
    case 'clients':
      // Uppercase code
      return /^[A-Z]+$/.test(docId);
    
    case 'hoaDues':
      // Year as string
      return /^\d{4}$/.test(docId);
    
    case 'users':
      // Should be Firebase Auth UID (28 chars)
      return typeof docId === 'string' && docId.length === 28;
    
    default:
      // Basic validation for other collections
      return typeof docId === 'string' && docId.length > 0;
  }
}

/**
 * Removes deprecated fields from data
 * @param {Object} data - Data object
 * @param {string} collectionName - Collection name
 * @returns {Object} - Cleaned data
 */
function removeDeprecatedFields(data, collectionName) {
  const deprecatedFields = {
    users: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'globalRole', 'isActive', 'lastLogin'],
    transactions: ['updatedAt', 'createdAt', 'createdBy', 'updatedBy', 'categoryId', 'accountType', 'metadata'],
    categories: ['budgetAmount', 'sortOrder'],
    vendors: ['categoryName'],
    units: ['createdAt', 'updatedAt'],
    hoaDues: ['month'] // in payments array elements
  };
  
  const fieldsToRemove = deprecatedFields[collectionName] || [];
  const cleanedData = { ...data };
  
  fieldsToRemove.forEach(field => {
    delete cleanedData[field];
  });
  
  // Special handling for hoaDues payments array
  if (collectionName === 'hoaDues' && cleanedData.payments) {
    cleanedData.payments = cleanedData.payments.map(payment => {
      if (payment && typeof payment === 'object') {
        const { month, ...cleanPayment } = payment;
        return cleanPayment;
      }
      return payment;
    });
  }
  
  return cleanedData;
}

/**
 * Validates batch of documents
 * @param {Array} documents - Array of documents to validate
 * @param {string} collectionName - Collection name
 * @returns {Object} - Validation results
 */
function validateBatch(documents, collectionName) {
  const results = {
    valid: [],
    invalid: [],
    total: documents.length
  };
  
  documents.forEach((doc, index) => {
    try {
      const validatedData = validateCollectionData(doc, collectionName);
      results.valid.push({
        index,
        data: validatedData
      });
    } catch (error) {
      results.invalid.push({
        index,
        data: doc,
        error: error.message
      });
    }
  });
  
  results.validCount = results.valid.length;
  results.invalidCount = results.invalid.length;
  results.successRate = (results.validCount / results.total * 100).toFixed(2) + '%';
  
  return results;
}

export {
  validators,
  fieldSpecs,
  validateField,
  validateCollectionData,
  validateDocumentId,
  removeDeprecatedFields,
  validateBatch
};

// Add missing export
export function validateRequiredFields(data, requiredFields) {
  const errors = [];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  return errors;
}

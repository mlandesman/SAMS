/**
 * Document Validation Utility
 * 
 * Centralized validation for all Firestore documents
 * Prevents field creep and ensures data integrity
 */

import { transactionSchema } from '../schemas/transactionSchema.js';
// Import other schemas as they're created
// import { vendorSchema } from '../schemas/vendorSchema.js';
// import { categorySchema } from '../schemas/categorySchema.js';
// import { unitSchema } from '../schemas/unitSchema.js';
// import { propertySchema } from '../schemas/propertySchema.js';
// import { hoaDuesSchema } from '../schemas/hoaDuesSchema.js';

// Central schema registry
const schemas = {
  transactions: transactionSchema,
  // Add other schemas here as they're created
  // vendors: vendorSchema,
  // categories: categorySchema,
  // units: unitSchema,
  // properties: propertySchema,
  // dues: hoaDuesSchema,
};

/**
 * Validates a document against its collection schema
 * @param {string} collectionName - Name of the collection (e.g., 'transactions', 'vendors')
 * @param {object} documentData - The document data to validate
 * @param {string} operation - 'create' or 'update' (affects required field validation)
 * @returns {object} - { isValid: boolean, errors: string[], data: object }
 */
export function validateDocument(collectionName, documentData, operation = 'create') {
  // Get the schema for this collection
  const schema = schemas[collectionName];
  if (!schema) {
    return {
      isValid: false,
      errors: [`No validation schema found for collection '${collectionName}'`],
      data: null
    };
  }
  
  const errors = [];
  const cleaned = {};
  
  // Check for forbidden fields FIRST (most important validation)
  if (schema.forbidden && schema.forbidden.length > 0) {
    for (const field of schema.forbidden) {
      if (field in documentData) {
        const hint = getFieldHint(field);
        errors.push(`Forbidden field '${field}' cannot be used${hint ? '. ' + hint : ''}`);
      }
    }
  }
  
  // If we found forbidden fields, return immediately
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      data: null
    };
  }
  
  // For create operations, check all required fields
  if (operation === 'create' && schema.required) {
    for (const field of schema.required) {
      if (!(field in documentData) || documentData[field] === null || documentData[field] === undefined) {
        errors.push(`Required field '${field}' is missing`);
      }
    }
  }
  
  // Validate each provided field
  for (const [field, value] of Object.entries(documentData)) {
    const fieldDef = schema.fields[field];
    
    // Skip validation for fields not in schema (flexibility for future fields)
    if (!fieldDef) {
      // Could enable strict mode here if needed
      // errors.push(`Unknown field '${field}' is not allowed`);
      continue;
    }
    
    // Skip auto-generated fields
    if (fieldDef.autoGenerate) {
      continue;
    }
    
    // Type validation
    const typeError = validateFieldType(field, value, fieldDef);
    if (typeError) {
      errors.push(typeError);
      continue;
    }
    
    // Enum validation
    if (fieldDef.type === 'enum' && fieldDef.values) {
      if (!fieldDef.values.includes(value)) {
        errors.push(`Field '${field}' must be one of: ${fieldDef.values.join(', ')} (got '${value}')`);
      }
    }
    
    // String length validation
    if (fieldDef.type === 'string' && fieldDef.maxLength && value.length > fieldDef.maxLength) {
      errors.push(`Field '${field}' exceeds maximum length of ${fieldDef.maxLength} characters`);
    }
    
    // Add to cleaned data
    cleaned[field] = value;
    
    // Check requiredWith constraints
    if (fieldDef.requiredWith) {
      for (const requiredField of fieldDef.requiredWith) {
        if (!(requiredField in documentData)) {
          errors.push(`Field '${field}' requires '${requiredField}' to also be present`);
        }
      }
    }
  }
  
  // Run custom validations if no errors so far
  if (errors.length === 0 && schema.customValidations) {
    for (const validation of schema.customValidations) {
      const error = validation.validate(cleaned);
      if (error) {
        errors.push(error);
      }
    }
  }
  
  // Return validation result
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? cleaned : null
  };
}

/**
 * Get helpful hint for forbidden field
 */
function getFieldHint(field) {
  const hints = {
    'vendor': "Use 'vendorId' and 'vendorName' instead",
    'category': "Use 'categoryId' and 'categoryName' instead", 
    'account': "Use 'accountId', 'accountName', and 'accountType' instead",
    'client': "Use 'clientId' instead",
    'unit': "Use 'unitId' instead",
    'transactionType': "Use 'type' instead",
    'createdAt': "Use 'created' instead",
    'updatedAt': "Use 'updated' instead"
  };
  return hints[field] || '';
}

/**
 * Validate field type
 */
function validateFieldType(field, value, fieldDef) {
  const { type } = fieldDef;
  
  // Handle array of types (e.g., ['string', 'null'])
  if (Array.isArray(type)) {
    let valid = false;
    for (const allowedType of type) {
      if (allowedType === 'null' && value === null) {
        valid = true;
        break;
      } else if (allowedType === 'string' && typeof value === 'string') {
        valid = true;
        break;
      } else if (allowedType === 'number' && typeof value === 'number' && !isNaN(value)) {
        valid = true;
        break;
      } else if (allowedType === 'boolean' && typeof value === 'boolean') {
        valid = true;
        break;
      } else if (allowedType === 'array' && Array.isArray(value)) {
        valid = true;
        break;
      } else if (allowedType === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        valid = true;
        break;
      }
    }
    if (!valid) {
      return `Field '${field}' must be one of: ${type.join(', ')}`;
    }
    return null;
  }
  
  // Handle single type
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return `Field '${field}' must be a string`;
      }
      break;
      
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `Field '${field}' must be a valid number`;
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Field '${field}' must be a boolean (true/false)`;
      }
      break;
      
    case 'timestamp':
      // Accept Date objects, Firebase Timestamps, or valid date strings
      if (!isValidTimestamp(value)) {
        return `Field '${field}' must be a valid date/timestamp`;
      }
      break;
      
    case 'array':
      if (!Array.isArray(value)) {
        return `Field '${field}' must be an array`;
      }
      // Validate array items if specified
      if (fieldDef.items === 'string') {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'string') {
            return `Field '${field}' must contain only strings (item ${i} is not a string)`;
          }
        }
      }
      break;
      
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return `Field '${field}' must be an object`;
      }
      break;
      
    case 'enum':
      // Enum validation happens separately
      break;
      
    default:
      console.warn(`Unknown field type '${type}' for field '${field}'`);
  }
  
  return null;
}

/**
 * Check if value is a valid timestamp
 */
function isValidTimestamp(value) {
  // Firebase Timestamp
  if (value && typeof value === 'object' && '_seconds' in value) {
    return true;
  }
  // Firestore Timestamp with toDate method
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return true;
  }
  // JavaScript Date
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  // Date string
  if (typeof value === 'string') {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return false;
}

/**
 * Get list of all collections with validation schemas
 */
export function getValidatedCollections() {
  return Object.keys(schemas);
}

/**
 * Get schema for a specific collection (useful for documentation)
 */
export function getCollectionSchema(collectionName) {
  return schemas[collectionName] || null;
}
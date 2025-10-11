/**
 * Field Validation Middleware
 * Prevents forbidden field names from being processed in request bodies
 * 
 * Critical Security Implementation - July 21, 2025
 * Addresses CRITICAL field validation vulnerabilities identified in security audit
 */

/**
 * Middleware to reject forbidden field names in request body
 * Returns clear error messages indicating proper field names to use instead
 */
export const validateFields = (req, res, next) => {
  try {
    const forbiddenFields = {
      'vendor': 'vendorId',
      'category': 'categoryId', 
      'account': 'accountId',
      'unit': 'unitId',
      'client': 'clientId'
    };

    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    // Check for forbidden fields in request body
    const foundForbiddenFields = [];
    
    function checkObject(obj, path = '') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const fullPath = path ? `${path}.${key}` : key;
          
          if (forbiddenFields.hasOwnProperty(key)) {
            foundForbiddenFields.push({
              field: fullPath,
              forbidden: key,
              suggested: forbiddenFields[key]
            });
          }
          
          // Recursively check nested objects
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            checkObject(obj[key], fullPath);
          }
        }
      }
    }

    checkObject(req.body);

    if (foundForbiddenFields.length > 0) {
      console.warn(`🚫 Field validation failed - forbidden fields detected:`, foundForbiddenFields);
      
      return res.status(400).json({
        error: 'Invalid field names detected',
        code: 'FORBIDDEN_FIELDS',
        details: foundForbiddenFields.map(f => ({
          field: f.field,
          message: `Invalid field '${f.forbidden}'. Use '${f.suggested}' instead`
        })),
        suggestion: 'Please update your request to use proper field names'
      });
    }

    console.log('✅ Field validation passed');
    next();
  } catch (error) {
    console.error('Field validation error:', error);
    res.status(500).json({ 
      error: 'Internal server error during field validation',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * Middleware specifically for user data operations
 * Includes additional validation for user-specific forbidden fields
 */
export const validateUserFields = (req, res, next) => {
  try {
    const userForbiddenFields = {
      'vendor': 'vendorId',
      'category': 'categoryId',
      'account': 'accountId', 
      'unit': 'unitId',
      'client': 'clientId',
      'manager': 'managerId',
      'property': 'propertyId'
    };

    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    const foundForbiddenFields = [];
    
    function checkUserObject(obj, path = '') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const fullPath = path ? `${path}.${key}` : key;
          
          if (userForbiddenFields.hasOwnProperty(key)) {
            foundForbiddenFields.push({
              field: fullPath,
              forbidden: key,
              suggested: userForbiddenFields[key]
            });
          }
          
          // Recursively check nested objects
          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            checkUserObject(obj[key], fullPath);
          }
        }
      }
    }

    checkUserObject(req.body);

    if (foundForbiddenFields.length > 0) {
      console.warn(`🚫 User field validation failed - forbidden fields detected:`, foundForbiddenFields);
      
      return res.status(400).json({
        error: 'Invalid user field names detected',
        code: 'FORBIDDEN_USER_FIELDS',
        details: foundForbiddenFields.map(f => ({
          field: f.field,
          message: `Invalid field '${f.forbidden}'. Use '${f.suggested}' instead`
        })),
        suggestion: 'Please update your request to use proper user field names'
      });
    }

    console.log('✅ User field validation passed');
    next();
  } catch (error) {
    console.error('User field validation error:', error);
    res.status(500).json({ 
      error: 'Internal server error during user field validation',
      code: 'USER_VALIDATION_ERROR'
    });
  }
};

/**
 * Sanitize request body by removing any forbidden fields
 * Alternative approach that removes fields instead of rejecting the request
 */
export const sanitizeForbiddenFields = (req, res, next) => {
  try {
    const forbiddenFields = ['vendor', 'category', 'account', 'unit', 'client', 'manager', 'property'];

    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    function sanitizeObject(obj) {
      const sanitized = { ...obj };
      
      forbiddenFields.forEach(field => {
        if (sanitized.hasOwnProperty(field)) {
          console.warn(`🧹 Sanitizing forbidden field: ${field}`);
          delete sanitized[field];
        }
      });

      // Recursively sanitize nested objects
      for (const key in sanitized) {
        if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
          sanitized[key] = sanitizeObject(sanitized[key]);
        }
      }

      return sanitized;
    }

    const originalBody = req.body;
    req.body = sanitizeObject(originalBody);
    
    console.log('✅ Field sanitization completed');
    next();
  } catch (error) {
    console.error('Field sanitization error:', error);
    res.status(500).json({ 
      error: 'Internal server error during field sanitization',
      code: 'SANITIZATION_ERROR'
    });
  }
};
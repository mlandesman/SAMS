/**
 * Document ID Generator Utilities
 * 
 * Generates sanitized document IDs for various collections
 * to ensure consistent, readable IDs instead of auto-generated ones
 */

/**
 * Sanitize a string to be used as a Firestore document ID
 * @param {string} input - The string to sanitize
 * @returns {string} A valid Firestore document ID
 */
export function sanitizeDocumentId(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input for document ID');
  }
  
  return input
    .toLowerCase()
    .trim()
    .replace(/_/g, '-')            // Convert underscores to hyphens FIRST (categories use hyphens only)
    .replace(/[^a-z0-9-]/g, '-')   // Replace invalid chars with hyphens (removed underscore from allowed chars)
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .substring(0, 100);            // Firestore ID limit is 1500, but keep it reasonable
}

/**
 * Generate a vendor document ID from vendor name
 * @param {string} vendorName - The vendor name
 * @returns {string} A sanitized vendor ID
 */
export function generateVendorId(vendorName) {
  const base = sanitizeDocumentId(vendorName);
  if (!base) {
    throw new Error('Cannot generate vendor ID from empty name');
  }
  return base;
}

/**
 * Generate a category document ID from category name
 * @param {string} categoryName - The category name
 * @returns {string} A sanitized category ID
 */
export function generateCategoryId(categoryName) {
  const base = sanitizeDocumentId(categoryName);
  if (!base) {
    throw new Error('Cannot generate category ID from empty name');
  }
  return base;
}

/**
 * Generate a payment method document ID from method name
 * @param {string} methodName - The payment method name
 * @returns {string} A sanitized payment method ID
 */
export function generatePaymentMethodId(methodName) {
  const base = sanitizeDocumentId(methodName);
  if (!base) {
    throw new Error('Cannot generate payment method ID from empty name');
  }
  return base;
}

/**
 * Check if a document ID already exists and generate a unique one if needed
 * @param {Object} db - Firestore database instance
 * @param {string} collectionPath - The collection path
 * @param {string} baseId - The base ID to check
 * @returns {Promise<string>} A unique document ID
 */
export async function ensureUniqueDocumentId(db, collectionPath, baseId) {
  let id = baseId;
  let counter = 1;
  
  while (true) {
    const docRef = db.doc(`${collectionPath}/${id}`);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return id;
    }
    
    // If document exists, append a counter
    id = `${baseId}-${counter}`;
    counter++;
    
    // Safety check to prevent infinite loop
    if (counter > 100) {
      throw new Error(`Cannot generate unique ID for ${baseId}`);
    }
  }
}
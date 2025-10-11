/**
 * Email Document ID Utilities
 * 
 * Provides consistent email sanitization for use as Firestore document IDs
 * This ensures email-based document IDs work across all environments
 */

/**
 * Sanitize email address for use as Firestore document ID
 * @param {string} email - Email address to sanitize
 * @returns {string} - Sanitized document ID
 */
export function sanitizeEmailForDocId(email) {
  if (!email) {
    throw new Error('Email is required for document ID sanitization');
  }
  
  // Use base64URL encoding which is Firestore-safe and reversible
  // This preserves all original characters and can be decoded back
  // Example: john.doe@gmail.com becomes am9obi5kb2VAZ21haWwuY29t
  const base64 = Buffer.from(email.toLowerCase().trim()).toString('base64');
  // Convert to base64URL by replacing + with -, / with _, and removing =
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode base64URL back to email address
 * @param {string} docId - Base64URL encoded document ID
 * @returns {string} - Original email address
 */
export function unsanitizeDocId(docId) {
  if (!docId) {
    throw new Error('Document ID is required for unsanitization');
  }
  
  // Add back padding if needed
  const padding = (4 - (docId.length % 4)) % 4;
  const base64 = docId
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    + '='.repeat(padding);
  
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Check if a document ID is in email format (base64URL encoded)
 * @param {string} docId - Document ID to check
 * @returns {boolean} - True if it appears to be an email-based ID
 */
export function isEmailDocId(docId) {
  if (!docId) return false;
  
  try {
    // Try to decode it as base64URL
    const decoded = unsanitizeDocId(docId);
    // Check if decoded value looks like an email
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decoded);
  } catch (e) {
    // If decoding fails, it's not a base64URL email ID
    return false;
  }
}

/**
 * Check if a document ID is in UID format
 * @param {string} docId - Document ID to check
 * @returns {boolean} - True if it appears to be a Firebase UID
 */
export function isUidDocId(docId) {
  if (!docId) return false;
  
  // Firebase UIDs are typically 20-30 chars of mixed case alphanumeric
  // They don't contain - or _ (which base64URL does)
  return /^[a-zA-Z0-9]{20,30}$/.test(docId) && !docId.includes('-') && !docId.includes('_');
}
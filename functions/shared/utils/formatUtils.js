/**
 * Format and manipulation utilities for notes and other display fields
 * Supports both legacy string format and new array format for backwards compatibility
 */

/**
 * Format notes for display - handles both legacy string and new array format
 * @param {string|Array} notes - Notes field (string or array)
 * @returns {string} Formatted notes string for display
 */
export function formatNotesForDisplay(notes) {
  if (!notes) return '';
  
  // Legacy string format
  if (typeof notes === 'string') return notes;
  
  // New array format
  if (Array.isArray(notes)) {
    return notes.map(n => n.text).join(' | ');
  }
  
  return '';
}

/**
 * Get notes entries as array - handles both formats
 * @param {string|Array} notes - Notes field
 * @returns {Array} Array of note entries
 */
export function getNotesArray(notes) {
  if (!notes) return [];
  if (Array.isArray(notes)) return notes;
  
  // Convert legacy string to array entry
  if (typeof notes === 'string' && notes.length > 0) {
    return [{ text: notes, transactionId: null, amount: null, basePaid: null, penaltyPaid: null }];
  }
  
  return [];
}

/**
 * Create a new notes entry for a payment
 * @param {Object} params - Payment parameters
 * @param {string} params.transactionId - Transaction ID
 * @param {string} params.timestamp - ISO timestamp
 * @param {string} params.text - Note text
 * @param {number} params.amount - Total amount in centavos
 * @param {number} params.basePaid - Base amount paid in centavos
 * @param {number} params.penaltyPaid - Penalty amount paid in centavos
 * @returns {Object} Notes entry object
 */
export function createNotesEntry({ transactionId, timestamp, text, amount, basePaid, penaltyPaid }) {
  return {
    transactionId,
    timestamp,
    text: text || 'Payment',
    amount,
    basePaid,
    penaltyPaid
  };
}

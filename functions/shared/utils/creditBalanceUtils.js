/**
 * Credit Balance Utilities
 * 
 * ARCHITECTURAL PRINCIPLE: Never store derived values that can become stale.
 * Always calculate credit balance fresh from the history journal.
 * 
 * @module shared/utils/creditBalanceUtils
 */

import { getNow } from '../services/DateService.js';

/**
 * Calculate current credit balance from history entries.
 * This is the ONLY source of truth for credit balance.
 * 
 * ARCHITECTURAL PRINCIPLE: amount field is the single source of truth.
 * - Positive amount = credit added
 * - Negative amount = credit used
 * 
 * @param {Object} creditDoc - The credit balance document from Firestore
 * @returns {number} Credit balance in centavos
 */
export function getCreditBalance(creditDoc) {
  if (!creditDoc?.history || !Array.isArray(creditDoc.history)) {
    return 0;
  }
  
  return creditDoc.history.reduce((sum, entry) => {
    const amount = typeof entry.amount === 'number' ? entry.amount : 0;
    return sum + amount;
  }, 0);
}

/**
 * Get credit balance in dollars (for display).
 * 
 * @param {Object} creditDoc - The credit balance document from Firestore
 * @returns {number} Credit balance in dollars
 */
export function getCreditBalanceDollars(creditDoc) {
  return getCreditBalance(creditDoc) / 100;
}

/**
 * Create a new credit history entry with ONLY the required fields.
 * DO NOT include balance, balanceBefore, or balanceAfter - they become stale.
 * 
 * @param {Object} params - Entry parameters
 * @param {number} params.amount - Required: centavos (positive = added, negative = used)
 * @param {string} params.transactionId - Required: links to transaction
 * @param {string} params.notes - Required: human-readable description (use 'notes' not 'note' for consistency)
 * @param {string} params.note - Deprecated: use 'notes' instead (backward compatibility)
 * @param {string} [params.type='payment'] - Optional: 'payment', 'credit_added', 'credit_used', 'adjustment'
 * @param {string|Date} [params.timestamp] - Optional: ISO string or Date (defaults to now)
 * @param {string} [params.source='unifiedPayment'] - Optional: Source module (e.g., 'unifiedPayment', 'waterBills', 'hoaDues', 'admin')
 * @returns {Object} Clean history entry
 */
export function createCreditHistoryEntry({
  amount,
  transactionId,
  notes,
  note,  // Backward compatibility - will be mapped to 'notes'
  type = 'payment',
  timestamp,
  source = 'unifiedPayment'
}) {
  // Use getNow() for timestamp if not provided
  let timestampValue;
  if (timestamp) {
    if (timestamp instanceof Date) {
      timestampValue = timestamp.toISOString();
    } else {
      timestampValue = timestamp;
    }
  } else {
    timestampValue = getNow().toISOString();
  }
  
  // Use 'notes' if provided, otherwise fall back to 'note' for backward compatibility
  const notesValue = notes || note || '';
  
  return {
    id: `credit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    amount,
    transactionId,
    notes: notesValue,  // Always use 'notes' (plural) for consistency
    type,
    timestamp: timestampValue,
    source
  };
}


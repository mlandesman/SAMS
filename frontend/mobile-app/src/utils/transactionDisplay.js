/**
 * Transaction display utilities — shared by AdminTransactions and TransactionsList
 */

/**
 * Format transaction date for display (handles API object or string)
 */
export function formatTransactionDate(dateValue) {
  if (!dateValue) return '—';
  if (typeof dateValue === 'object' && dateValue !== null) {
    return dateValue.unambiguous_long_date || dateValue.display || dateValue.ISO_8601 || '—';
  }
  return String(dateValue);
}

/**
 * Allowed source values for credit history entries.
 * Keep this list tight so reporting/classification logic remains predictable.
 */
export const ALLOWED_CREDIT_SOURCES = Object.freeze([
  'admin',
  'correction',
  'reconciliation',
  'running_balance_computation',
  'unifiedPayment',
  'hoaDues',
  'waterBills',
  'year_end_rollover',
  'import',
  'imported'
]);

const ALLOWED_SET = new Set(ALLOWED_CREDIT_SOURCES);

export function normalizeCreditSource(source) {
  return String(source || '').trim();
}

export function isAllowedCreditSource(source) {
  return ALLOWED_SET.has(normalizeCreditSource(source));
}

export function buildInvalidCreditSourceMessage(source) {
  return `Invalid source "${normalizeCreditSource(source)}". Allowed values: ${ALLOWED_CREDIT_SOURCES.join(', ')}`;
}

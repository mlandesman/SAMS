/**
 * Decimal text-input helpers for amount fields (no number spinners / wheel increments).
 */

const POSITIVE_DECIMAL_PATTERN = /^\d*\.?\d{0,2}$/;
const SIGNED_DECIMAL_PATTERN = /^-?\d*\.?\d{0,2}$/;

export function sanitizeDecimalInput(value, { allowNegative = false } = {}) {
  if (value === '') {
    return '';
  }
  const pattern = allowNegative ? SIGNED_DECIMAL_PATTERN : POSITIVE_DECIMAL_PATTERN;
  return pattern.test(value) ? value : null;
}

export function handleDecimalAmountChange(event, setter, options = {}) {
  const next = sanitizeDecimalInput(event.target.value, options);
  if (next !== null) {
    setter(next);
  }
}

export function parseDecimalInput(value) {
  const trimmed = (value ?? '').toString().trim();
  if (!trimmed) {
    return NaN;
  }
  return parseFloat(trimmed);
}

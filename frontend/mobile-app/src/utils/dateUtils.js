import { DateTime } from 'luxon';

/**
 * Parse a date string or Date object safely in Cancun timezone.
 * Copied from functions/shared/services/DateService.js — pure Luxon, no server deps.
 * @param {string|Date} dateInput
 * @returns {Date|null}
 */
export const parseDate = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  const dt = DateTime.fromISO(String(dateInput), { zone: 'America/Cancun' });
  if (dt.isValid) return dt.toJSDate();
  return new Date(dateInput);
};

/**
 * Parse transaction `date` field from API responses.
 * Handles: timestamp objects (with _seconds), object fields like iso / ISO_8601 /
 * unambiguous_long_date / display (aligned with transactionDisplay), plain strings.
 * Matches desktop TransactionsView.jsx date handling.
 * @param {any} dateValue - transaction.date in any API shape
 * @returns {Date|null}
 */
export const parseTransactionDate = (dateValue) => {
  if (dateValue == null) return null;
  if (typeof dateValue === 'object' && dateValue.timestamp) {
    return dateValue.timestamp._seconds
      ? new Date(dateValue.timestamp._seconds * 1000)
      : new Date(dateValue.timestamp);
  }
  if (typeof dateValue === 'object' && dateValue !== null) {
    if (typeof dateValue.iso === 'string') return parseDate(dateValue.iso);
    if (typeof dateValue.ISO_8601 === 'string') return parseDate(dateValue.ISO_8601);
    if (typeof dateValue.unambiguous_long_date === 'string') {
      return parseDate(dateValue.unambiguous_long_date);
    }
    if (typeof dateValue.display === 'string') return parseDate(dateValue.display);
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    return parseDate(String(dateValue));
  }
  return null;
};

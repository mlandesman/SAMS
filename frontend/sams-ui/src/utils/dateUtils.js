/**
 * Frontend date utilities — Luxon-based, aligned with shared DateService.
 * Browser-safe (no firebase-admin). See Date_Handling_Guide.md.
 */
import { DateTime } from 'luxon';

const CANCUN_ZONE = 'America/Cancun';

/**
 * Parse a date string safely in America/Cancun (mirrors mobile dateUtils / DateService).
 * @param {string|Date} dateInput
 * @returns {Date|null}
 */
export function parseDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;

  const dt = DateTime.fromISO(String(dateInput), { zone: CANCUN_ZONE });
  if (dt.isValid) return dt.toJSDate();

  const fromFormat = DateTime.fromFormat(String(dateInput), 'yyyy-MM-dd', { zone: CANCUN_ZONE });
  if (fromFormat.isValid) return fromFormat.toJSDate();

  return null;
}

/**
 * Serialize a calendar date (YYYY-MM-DD from <input type="date">) to ISO UTC
 * for backend persistence. Midnight America/Cancun — no `new Date()` parsing.
 * @param {string} dateInput - YYYY-MM-DD or ISO string with time component
 * @returns {string} ISO-8601 UTC string
 */
export function dateOnlyInputToMexicoISO(dateInput) {
  if (!dateInput) {
    return dateInput;
  }

  const raw = String(dateInput).trim();

  if (raw.includes('T')) {
    const dt = DateTime.fromISO(raw, { zone: CANCUN_ZONE });
    if (!dt.isValid) {
      throw new Error(`Invalid date: ${dateInput}`);
    }
    return dt.toUTC().toISO();
  }

  const dt = DateTime.fromFormat(raw, 'yyyy-MM-dd', { zone: CANCUN_ZONE });
  if (!dt.isValid) {
    throw new Error(`Invalid date: ${dateInput}`);
  }

  return dt.startOf('day').toUTC().toISO();
}

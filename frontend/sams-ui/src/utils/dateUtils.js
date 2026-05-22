/**
 * Frontend date utilities — Luxon-based, aligned with shared DateService.
 * Browser-safe (no firebase-admin). See Date_Handling_Guide.md.
 */
import { DateTime } from 'luxon';

const CANCUN_ZONE = 'America/Cancun';

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

/**
 * Format a stored timestamp for <input type="date"> in America/Cancun (yyyy-MM-dd).
 * @param {string|Date|{ raw?: string, _seconds?: number }} timestamp
 * @returns {string}
 */
export function timestampToMexicoDateInput(timestamp) {
  if (!timestamp) {
    return '';
  }

  if (typeof timestamp === 'string') {
    const dt = DateTime.fromISO(timestamp, { zone: CANCUN_ZONE });
    return dt.isValid ? dt.toFormat('yyyy-MM-dd') : '';
  }

  if (typeof timestamp === 'object' && timestamp !== null) {
    if (typeof timestamp.raw === 'string') {
      const dt = DateTime.fromISO(timestamp.raw, { zone: CANCUN_ZONE });
      return dt.isValid ? dt.toFormat('yyyy-MM-dd') : '';
    }
    if (typeof timestamp._seconds === 'number') {
      const dt = DateTime.fromSeconds(timestamp._seconds, { zone: CANCUN_ZONE });
      return dt.isValid ? dt.toFormat('yyyy-MM-dd') : '';
    }
  }

  if (timestamp instanceof Date) {
    const dt = DateTime.fromJSDate(timestamp).setZone(CANCUN_ZONE);
    return dt.isValid ? dt.toFormat('yyyy-MM-dd') : '';
  }

  return '';
}

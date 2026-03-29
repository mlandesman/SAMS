/**
 * Mobile transaction date windows — Luxon in America/Cancun (same as functions/shared/services/DateService).
 * Admin preset matching uses parseTransactionDate / parseDate from DateService (desktop TransactionsView parity).
 */
import { DateTime } from 'luxon';
import { parseDate, parseTransactionDate } from '@sams/date-service';

const CANCUN = 'America/Cancun';

function cancunNow() {
  return DateTime.now().setZone(CANCUN);
}

function toYmd(dt) {
  return dt.toFormat('yyyy-MM-dd');
}

/**
 * Owner fetch window: full selected year, or preset range (overrides year chips).
 * @param {number} selectedYear
 * @param {null | 'currentMonth' | 'prior3Months' | 'currentYear'} datePreset
 */
export function getOwnerTransactionFetchRange(selectedYear, datePreset) {
  if (!datePreset) {
    return {
      startDate: `${selectedYear}-01-01`,
      endDate: `${selectedYear}-12-31`,
    };
  }

  const now = cancunNow();

  if (datePreset === 'currentYear') {
    const y = now.year;
    return {
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
    };
  }

  if (datePreset === 'currentMonth') {
    const start = now.startOf('month');
    const end = now.endOf('month');
    return { startDate: toYmd(start), endDate: toYmd(end) };
  }

  if (datePreset === 'prior3Months') {
    const start = now.minus({ months: 2 }).startOf('month');
    const end = now.endOf('month');
    return { startDate: toYmd(start), endDate: toYmd(end) };
  }

  return {
    startDate: `${selectedYear}-01-01`,
    endDate: `${selectedYear}-12-31`,
  };
}

/** No overlap with loaded year (admin preset). */
const EMPTY_RANGE = { start: '9999-01-01', end: '9999-01-02' };

function intersectRangeWithSelectedYear(start, end, selectedYear) {
  const ys = `${selectedYear}-01-01`;
  const ye = `${selectedYear}-12-31`;
  if (end < ys || start > ye) return EMPTY_RANGE;
  const clippedStart = start > ys ? start : ys;
  const clippedEnd = end < ye ? end : ye;
  if (clippedStart > clippedEnd) return EMPTY_RANGE;
  return { start: clippedStart, end: clippedEnd };
}

/**
 * Admin client-side preset range (intersect with already-fetched calendar year).
 * @param {number} selectedYear
 * @param {null | 'currentMonth' | 'prior3Months' | 'currentYear'} datePreset
 * @returns {{ start: string, end: string } | null}
 */
export function getAdminPresetDateRange(selectedYear, datePreset) {
  if (!datePreset || datePreset === 'currentYear') return null;

  const now = cancunNow();

  if (datePreset === 'currentMonth') {
    const start = toYmd(now.startOf('month'));
    const end = toYmd(now.endOf('month'));
    return intersectRangeWithSelectedYear(start, end, selectedYear);
  }

  if (datePreset === 'prior3Months') {
    const start = toYmd(now.minus({ months: 2 }).startOf('month'));
    const end = toYmd(now.endOf('month'));
    return intersectRangeWithSelectedYear(start, end, selectedYear);
  }

  return null;
}

/** Admin: optional date preset on top of year-scoped fetch (desktop-style Date comparison). */
export function transactionMatchesAdminDatePreset(txDate, selectedYear, datePreset) {
  const range = getAdminPresetDateRange(selectedYear, datePreset);
  if (!range) return true;
  const txD = parseTransactionDate(txDate);
  if (!txD || Number.isNaN(txD.getTime())) return false;
  const startD = parseDate(range.start);
  const endD = parseDate(`${range.end}T23:59:59.999`);
  if (!startD || !endD || Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) return false;
  return txD >= startD && txD <= endD;
}

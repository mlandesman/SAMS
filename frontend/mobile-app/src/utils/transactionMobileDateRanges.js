/**
 * Mobile transaction date windows — Luxon in America/Cancun (aligned with DateService timezone).
 * Admin preset matching uses parseTransactionDate / parseDate from local dateUtils (no server bundle).
 * Fiscal year bounds from getFiscalYearDateRange (per-client fiscalYearStartMonth).
 */
import { DateTime } from 'luxon';
import { parseDate, parseTransactionDate } from './dateUtils';
import { getFiscalYear, getFiscalYearDateRange } from './fiscalYearUtils.js';
import { getMexicoDate } from './timezone.js';

const CANCUN = 'America/Cancun';

function cancunNow() {
  return DateTime.now().setZone(CANCUN);
}

function toYmd(dt) {
  return dt.toFormat('yyyy-MM-dd');
}

/**
 * Owner fetch window: full selected fiscal year, or preset range (overrides year chips).
 * @param {number} selectedYear - Fiscal year from chips
 * @param {null | 'currentMonth' | 'prior3Months' | 'currentYear'} datePreset
 * @param {number} fiscalYearStartMonth
 */
export function getOwnerTransactionFetchRange(selectedYear, datePreset, fiscalYearStartMonth) {
  const fyDefault = () => getFiscalYearDateRange(selectedYear, fiscalYearStartMonth);

  if (!datePreset) {
    return fyDefault();
  }

  const now = cancunNow();

  if (datePreset === 'currentYear') {
    const y = getFiscalYear(getMexicoDate(), fiscalYearStartMonth);
    return getFiscalYearDateRange(y, fiscalYearStartMonth);
  }

  if (datePreset === 'currentMonth') {
    const start = now.startOf('month');
    const end = now.endOf('month');
    return { startDate: toYmd(start), endDate: toYmd(end) };
  }

  if (datePreset === 'prior3Months') {
    const end = now.minus({ months: 1 }).endOf('month');
    const start = end.minus({ months: 2 }).startOf('month');
    return { startDate: toYmd(start), endDate: toYmd(end) };
  }

  return fyDefault();
}

/** No overlap with loaded fiscal year (admin preset). */
const EMPTY_RANGE = { start: '9999-01-01', end: '9999-01-02' };

function intersectRangeWithSelectedFiscalYear(start, end, selectedYear, fiscalYearStartMonth) {
  const { startDate: ys, endDate: ye } = getFiscalYearDateRange(selectedYear, fiscalYearStartMonth);
  if (end < ys || start > ye) return EMPTY_RANGE;
  const clippedStart = start > ys ? start : ys;
  const clippedEnd = end < ye ? end : ye;
  if (clippedStart > clippedEnd) return EMPTY_RANGE;
  return { start: clippedStart, end: clippedEnd };
}

/**
 * Admin client-side preset range (intersect with already-fetched fiscal year).
 * @param {number} selectedYear
 * @param {null | 'currentMonth' | 'prior3Months' | 'currentYear'} datePreset
 * @param {number} fiscalYearStartMonth
 * @returns {{ start: string, end: string } | null}
 */
export function getAdminPresetDateRange(selectedYear, datePreset, fiscalYearStartMonth) {
  if (!datePreset || datePreset === 'currentYear') return null;

  const now = cancunNow();

  if (datePreset === 'currentMonth') {
    const start = toYmd(now.startOf('month'));
    const end = toYmd(now.endOf('month'));
    return intersectRangeWithSelectedFiscalYear(start, end, selectedYear, fiscalYearStartMonth);
  }

  if (datePreset === 'prior3Months') {
    const endDt = now.minus({ months: 1 }).endOf('month');
    const startDt = endDt.minus({ months: 2 }).startOf('month');
    return intersectRangeWithSelectedFiscalYear(
      toYmd(startDt),
      toYmd(endDt),
      selectedYear,
      fiscalYearStartMonth
    );
  }

  return null;
}

/** Admin: optional date preset on top of year-scoped fetch (desktop-style Date comparison). */
export function transactionMatchesAdminDatePreset(
  txDate,
  selectedYear,
  datePreset,
  fiscalYearStartMonth
) {
  const range = getAdminPresetDateRange(selectedYear, datePreset, fiscalYearStartMonth);
  if (!range) return true;
  const txD = parseTransactionDate(txDate);
  if (!txD || Number.isNaN(txD.getTime())) return false;
  const startD = parseDate(range.start);
  const endD = parseDate(`${range.end}T23:59:59.999`);
  if (!startD || !endD || Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) return false;
  return txD >= startD && txD <= endD;
}

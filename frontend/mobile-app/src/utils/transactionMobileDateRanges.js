/**
 * Date ranges for mobile transaction filters (America/Cancun via getMexicoDate / getMexicoDateString).
 */
import { getMexicoDate, getMexicoDateString } from './timezone.js';

/** @returns {{ y: number, m: number, d: number }} */
function parseMexicoYmd() {
  const s = getMexicoDateString();
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  return { y, m, d };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Last calendar day (1–31) for month M (1–12) in year Y (no Date() — pre-PR / timezone rule). */
function daysInMonth(y, m) {
  const monthLengths = [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return leap ? 29 : 28;
  }
  return monthLengths[m - 1];
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

  const { y, m, d } = parseMexicoYmd();

  if (datePreset === 'currentYear') {
    return {
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
    };
  }

  if (datePreset === 'currentMonth') {
    const dim = daysInMonth(y, m);
    return {
      startDate: `${y}-${pad2(m)}-01`,
      endDate: `${y}-${pad2(m)}-${pad2(dim)}`,
    };
  }

  if (datePreset === 'prior3Months') {
    let startY = y;
    let startM = m - 2;
    while (startM < 1) {
      startM += 12;
      startY -= 1;
    }
    const endDim = daysInMonth(y, m);
    return {
      startDate: `${startY}-${pad2(startM)}-01`,
      endDate: `${y}-${pad2(m)}-${pad2(endDim)}`,
    };
  }

  return {
    startDate: `${selectedYear}-01-01`,
    endDate: `${selectedYear}-12-31`,
  };
}

/**
 * Admin client-side preset range (intersect with already-fetched year). Null = no extra date filter.
 * @param {number} selectedYear
 * @param {null | 'currentMonth' | 'prior3Months' | 'currentYear'} datePreset
 * @returns {{ start: string, end: string } | null}
 */
export function getAdminPresetDateRange(selectedYear, datePreset) {
  if (!datePreset) return null;

  const { y, m } = parseMexicoYmd();

  if (datePreset === 'currentYear') {
    return {
      start: `${selectedYear}-01-01`,
      end: `${selectedYear}-12-31`,
    };
  }

  if (datePreset === 'currentMonth') {
    if (y !== selectedYear) {
      return { start: '9999-01-01', end: '9999-01-02' };
    }
    const dim = daysInMonth(y, m);
    return {
      start: `${y}-${pad2(m)}-01`,
      end: `${y}-${pad2(m)}-${pad2(dim)}`,
    };
  }

  if (datePreset === 'prior3Months') {
    let startY = y;
    let startM = m - 2;
    while (startM < 1) {
      startM += 12;
      startY -= 1;
    }
    const endDim = daysInMonth(y, m);
    return {
      start: `${startY}-${pad2(startM)}-01`,
      end: `${y}-${pad2(m)}-${pad2(endDim)}`,
    };
  }

  return null;
}

/** Compare YYYY-MM-DD strings lexicographically. */
export function dateStringInRange(dateStr, start, end) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const day = dateStr.slice(0, 10);
  return day >= start && day <= end;
}

/** Admin: optional date preset on top of year-scoped fetch. */
export function transactionMatchesAdminDatePreset(txDate, selectedYear, datePreset) {
  const range = getAdminPresetDateRange(selectedYear, datePreset);
  if (!range) return true;
  return dateStringInRange(txDate, range.start, range.end);
}

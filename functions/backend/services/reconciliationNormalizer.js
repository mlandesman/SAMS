/**
 * Group Scotia raw rows by reference number; BBVA is 1:1 passthrough.
 * Amounts are INTEGER CENTAVOS (same as Firestore transactions).
 */

import { pesosToCentavos } from '../../shared/utils/currencyUtils.js';

/**
 * ISO YYYY-MM-DD inclusive bounds (string compare).
 */
export function bankRowDateInStatementPeriod(rowDate, startDate, endDate) {
  if (!startDate || !endDate) return true;
  if (rowDate == null || rowDate === '') return false;
  const d = String(rowDate).slice(0, 10);
  return d >= startDate && d <= endDate;
}

/** Parser rows (pre-normalization): drop anything outside the reconciliation period. */
export function filterBankRowsByStatementPeriod(bankRows, startDate, endDate) {
  if (!Array.isArray(bankRows)) return [];
  if (!startDate || !endDate) return bankRows;
  return bankRows.filter((row) => bankRowDateInStatementPeriod(row?.date, startDate, endDate));
}

/** Normalized row (has .date ISO) — same period rule for matching / workbench. */
export function normalizedRowInStatementPeriod(row, startDate, endDate) {
  return bankRowDateInStatementPeriod(row?.date, startDate, endDate);
}

function parseAmountPesos(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/**
 * @param {object[]} bankRows — raw rows from Scotia parser (pesos, positive amounts)
 * @returns {object[]} normalized row objects (without Firestore ids)
 */
export function normalizeScotiabankRows(bankRows) {
  const byRef = new Map();

  for (const row of bankRows) {
    const ref = row.referenceNumber != null ? String(row.referenceNumber) : `__noref_${row.rowIndex}`;
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref).push(row);
  }

  const normalizedRows = [];

  for (const [, group] of byRef) {
    const sumCentavos = group.reduce(
      (acc, r) => acc + pesosToCentavos(parseAmountPesos(r.amount)),
      0
    );
    let primary = group[0];
    for (const r of group) {
      if (
        pesosToCentavos(parseAmountPesos(r.amount)) >
        pesosToCentavos(parseAmountPesos(primary.amount))
      ) {
        primary = r;
      }
    }
    const firstByDate = [...group].sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];

    normalizedRows.push({
      date: firstByDate.date,
      amount: sumCentavos,
      type: primary.type,
      description: primary.description || '',
      sourceRowIds: group.map((r) => r.id),
      matchStatus: 'unmatched',
      matchedTransactionId: null
    });
  }

  return normalizedRows;
}

/**
 * @param {string} bankFormat
 * @param {object[]} bankRows
 */
export function normalizeRowsForSession(bankFormat, bankRows) {
  if (bankFormat === 'bbva') {
    return bankRows.map((row) => ({
      date: row.date,
      amount: pesosToCentavos(parseAmountPesos(row.amount)),
      type: row.type,
      description: row.description || '',
      sourceRowIds: [row.id],
      matchStatus: 'unmatched',
      matchedTransactionId: null
    }));
  }
  return normalizeScotiabankRows(bankRows);
}

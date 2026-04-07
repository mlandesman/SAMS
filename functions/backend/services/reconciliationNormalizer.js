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
 * Lines at or above this peso amount are treated as a SPEI "principal" leg; IVA ($0.80) and SPEI fee ($5)
 * stay below so a single payment {0.8, 5, 12000} stays one group.
 */
const SCOTIA_PRINCIPAL_SPLIT_THRESHOLD_PESOS = 1000;

/**
 * Scotia CSV repeats the same numeric **Referencia** on IVA + SPEI fee + principal for one outflow.
 * Some exports reuse that reference for a **second** full chain on the same day (second admin wire + fees).
 * Merging by ref alone would sum both into one bank line and hide a payment.
 *
 * When a ref group contains **more than one** principal-scale line (≥ threshold pesos), split into legs using
 * **CSV order**: each leg is rows from just after the previous principal through this principal (inclusive).
 * Typical pattern `IVA, SPEI, principal, IVA, SPEI, principal` → two legs of three rows each.
 *
 * @param {object[]} group — raw rows sharing one referenceNumber
 * @returns {object[][]} one or more disjoint row clusters
 */
export function splitScotiabankRefGroupIntoPaymentLegs(group) {
  if (!group?.length) return [];
  const sorted = [...group].sort((a, b) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0));
  const isPrincipalLine = (r) => Math.abs(parseAmountPesos(r.amount)) >= SCOTIA_PRINCIPAL_SPLIT_THRESHOLD_PESOS;

  const principalIndices = [];
  sorted.forEach((r, i) => {
    if (isPrincipalLine(r)) principalIndices.push(i);
  });
  if (principalIndices.length <= 1) {
    return [sorted];
  }

  const legs = [];
  for (let k = 0; k < principalIndices.length; k++) {
    const start = k === 0 ? 0 : principalIndices[k - 1] + 1;
    const end = principalIndices[k];
    legs.push(sorted.slice(start, end + 1));
  }
  return legs;
}

function buildNormalizedScotiaLeg(group, refKey, legIndex) {
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
  const isSyntheticRef = String(refKey).startsWith('__noref_');

  return {
    date: firstByDate.date,
    amount: sumCentavos,
    type: primary.type,
    description: primary.description || '',
    sourceRowIds: group.map((r) => r.id),
    referenceNumber: isSyntheticRef ? null : refKey,
    referenceLegIndex: legIndex,
    matchStatus: 'unmatched',
    matchedTransactionId: null
  };
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

  for (const [refKey, group] of byRef) {
    const legs = splitScotiabankRefGroupIntoPaymentLegs(group);
    legs.forEach((leg, legIndex) => {
      normalizedRows.push(buildNormalizedScotiaLeg(leg, refKey, legIndex));
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

import { DateTime } from 'luxon';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';

const TOL = 0.01;
const MS_PER_DAY = 86400000;

function txnDateToMillis(txn) {
  const d = txn.date;
  if (d && typeof d.toDate === 'function') return d.toDate().getTime();
  if (d instanceof Date) return d.getTime();
  if (typeof d === 'string') return DateTime.fromISO(d, { zone: 'America/Cancun' }).toMillis();
  return NaN;
}

function bankDateToMillis(isoDate) {
  return DateTime.fromISO(String(isoDate), { zone: 'America/Cancun' }).startOf('day').toMillis();
}

function daysBetween(bankIso, txn) {
  const a = bankDateToMillis(bankIso);
  const b = txnDateToMillis(txn);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 999;
  return Math.abs(a - b) / MS_PER_DAY;
}

function absPesosFromCentavos(centavos) {
  return Math.abs(centavosToPesos(centavos || 0));
}

function typeMatchesBank(bankType, txn) {
  const t = txn.type;
  const amt = txn.amount || 0;
  if (bankType === 'ABONO') {
    if (t === 'income') return amt > 0;
    if (t === 'adjustment') return amt > 0;
    return false;
  }
  if (bankType === 'CARGO') {
    if (t === 'expense') return amt < 0;
    if (t === 'adjustment') return amt < 0;
    return false;
  }
  return false;
}

function txnTotalPesos(txn) {
  let cents = txn.amount || 0;
  if (txn.allocations?.length) {
    for (const a of txn.allocations) {
      if (a && typeof a.amount === 'number') cents += a.amount;
    }
  }
  return centavosToPesos(cents);
}

function amountsClose(a, b) {
  return Math.abs(a - b) <= TOL;
}

/**
 * @param {object[]} normalizedRows — id, date, amount (pesos), type, ...
 * @param {object[]} samsTransactions — raw Firestore-shaped: id, amount centavos, type, date, accountId, clearedDate, allocations?
 */
export function runMatchingAlgorithm(normalizedRows, samsTransactions) {
  const matches = [];
  const usedTxn = new Set();
  const usedNorm = new Set();

  const pool = normalizedRows.map((r) => ({ ...r }));
  const txns = samsTransactions.filter(
    (t) =>
      t &&
      (t.amount || 0) !== 0 &&
      !t.clearedDate &&
      t.accountId
  );

  const stats = { exact: 0, dateDrift: 0, feeAdjusted: 0, unmatched: 0 };

  function tryExact(maxDays) {
    for (const nr of pool) {
      if (usedNorm.has(nr.id)) continue;
      for (const txn of txns) {
        if (usedTxn.has(txn.id)) continue;
        if (txn.accountId !== nr._accountId) continue;
        if (!typeMatchesBank(nr.type, txn)) continue;
        const tp = txnTotalPesos(txn);
        const cmp = nr.type === 'CARGO' ? Math.abs(tp) : tp;
        if (!amountsClose(cmp, nr.amount)) continue;
        const dd = daysBetween(nr.date, txn);
        if (dd > maxDays) continue;
        matches.push({
          normalizedRowId: nr.id,
          transactionId: txn.id,
          matchType: maxDays <= 1 ? 'auto-exact' : 'auto-date-drift'
        });
        if (maxDays <= 1) stats.exact += 1;
        else stats.dateDrift += 1;
        usedTxn.add(txn.id);
        usedNorm.add(nr.id);
        break;
      }
    }
  }

  tryExact(1);
  tryExact(7);

  // Fee-adjusted: subset of 2–5 transactions, same account, date within ±1 day of bank row
  for (const nr of pool) {
    if (usedNorm.has(nr.id)) continue;
    if (nr.type !== 'CARGO') continue;

    const candidates = txns.filter((txn) => {
      if (usedTxn.has(txn.id)) return false;
      if (txn.accountId !== nr._accountId) return false;
      if (!typeMatchesBank(nr.type, txn)) return false;
      return daysBetween(nr.date, txn) <= 1;
    });

    if (candidates.length < 2) continue;

    const target = nr.amount;
    const ids = candidates.map((t) => t.id);
    const pesos = candidates.map((t) => absPesosFromCentavos(t.amount));

    let found = null;
    const n = candidates.length;
    function search(startIdx, depthLeft, sum, picked) {
      if (found) return;
      if (depthLeft === 0) {
        if (amountsClose(sum, target)) found = [...picked];
        return;
      }
      for (let i = startIdx; i < n; i++) {
        picked.push(ids[i]);
        search(i + 1, depthLeft - 1, sum + pesos[i], picked);
        picked.pop();
        if (found) return;
      }
    }

    for (let k = 2; k <= Math.min(5, n); k++) {
      search(0, k, 0, []);
      if (found) break;
    }

    if (found && found.length >= 2) {
      for (const tid of found) usedTxn.add(tid);
      usedNorm.add(nr.id);
      stats.feeAdjusted += 1;
      matches.push({
        normalizedRowId: nr.id,
        transactionId: found[0],
        matchType: 'auto-fee-adjusted',
        feeGroupTransactionIds: found
      });
    }
  }

  const unmatchedBankRows = pool.filter((nr) => !usedNorm.has(nr.id)).map((nr) => nr.id);
  const unmatchedTransactions = txns.filter((t) => !usedTxn.has(t.id)).map((t) => t.id);

  stats.unmatched = unmatchedBankRows.length + unmatchedTransactions.length;

  return {
    matches,
    unmatchedBankRows,
    unmatchedTransactions,
    stats
  };
}

/**
 * Attach accountId from session onto normalized rows for matching.
 */
export function attachAccountForMatching(normalizedRows, accountId) {
  return normalizedRows.map((nr) => ({ ...nr, _accountId: accountId }));
}

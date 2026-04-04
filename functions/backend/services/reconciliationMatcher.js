import { DateTime } from 'luxon';

/** Compare integer centavos (same storage as SAMS transactions). */
const TOL_CENTAVOS = 0;
const MS_PER_DAY = 86400000;

/**
 * Scotia Movimientos / SPEI (business accounts): bank CARGO often includes transfer fee + IVA
 * ($5.00 + $0.80) while SAMS may only record the principal until fee lines are split.
 * Not used for BBVA — e.g. MTC uses a personal BBVA account without this SPEI/factura fee pattern.
 */
export const SCOTIABANK_SPEI_FEE_GAP_CENTAVOS = 580;

/** Max |bank − SAMS cash| for a suggested rounding match (UI can "adjust to bank" via small allocation). */
export const ROUNDING_TOLERANCE_CENTAVOS = 2;

function bankDateToMillis(isoDate) {
  return DateTime.fromISO(String(isoDate), { zone: 'America/Cancun' }).startOf('day').toMillis();
}

/**
 * Same calendar day as SAMS UI / Cancun business date — start of day in America/Cancun.
 * Must match bankDateToMillis semantics so "same day" means dd ≈ 0, not raw UTC vs Cancun.
 */
function txnCancunStartOfDayMillis(txn) {
  const d = txn.date;
  if (d && typeof d.toDate === 'function') {
    const iso = DateTime.fromJSDate(d.toDate(), { zone: 'America/Cancun' }).toISODate();
    if (!iso) return NaN;
    return DateTime.fromISO(iso, { zone: 'America/Cancun' }).startOf('day').toMillis();
  }
  if (d instanceof Date) {
    const iso = DateTime.fromJSDate(d, { zone: 'America/Cancun' }).toISODate();
    if (!iso) return NaN;
    return DateTime.fromISO(iso, { zone: 'America/Cancun' }).startOf('day').toMillis();
  }
  if (typeof d === 'string') {
    return DateTime.fromISO(String(d), { zone: 'America/Cancun' }).startOf('day').toMillis();
  }
  return NaN;
}

function txnCancunSortKey(txn) {
  const d = txn.date;
  if (d && typeof d.toDate === 'function') {
    return DateTime.fromJSDate(d.toDate(), { zone: 'America/Cancun' }).toISODate() || '';
  }
  if (d instanceof Date) {
    return DateTime.fromJSDate(d, { zone: 'America/Cancun' }).toISODate() || '';
  }
  if (typeof d === 'string') return String(d).slice(0, 10);
  return '';
}

function daysBetween(bankIso, txn) {
  const a = bankDateToMillis(bankIso);
  const b = txnCancunStartOfDayMillis(txn);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 999;
  return Math.abs(a - b) / MS_PER_DAY;
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

/**
 * Centavos to compare to the bank statement. SAMS is **cash-based**: `txn.amount` is the
 * movement the bank would see. `allocations` are internal (category splits, credit balance
 * application, etc.) and must not be summed with `amount` for reconciliation.
 */
function txnMatchCentavos(txn) {
  return Math.round(txn.amount || 0);
}

function amountsCloseCentavos(a, b) {
  return Math.abs(a - b) <= TOL_CENTAVOS;
}

/**
 * @param {object[]} normalizedRows — id, date, amount (integer centavos), type, ...
 * @param {object[]} samsTransactions — raw Firestore-shaped: id, amount centavos, type, date, accountId, clearedDate, allocations?
 * @param {object} [options]
 * @param {'scotiabank'|'bbva'|null} [options.bankFormat] — enables Scotia-only rules (SPEI fee gap).
 * @param {number} [options.roundingToleranceCentavos=2] — match when cash amounts differ by 1…N centavos (rounding).
 */
export function runMatchingAlgorithm(normalizedRows, samsTransactions, options = {}) {
  const { bankFormat } = options;
  const roundingTol = Math.max(
    0,
    Number.isFinite(options.roundingToleranceCentavos)
      ? options.roundingToleranceCentavos
      : ROUNDING_TOLERANCE_CENTAVOS
  );
  // Scotia: SPEI fee+IVA gap (580¢). per Michael: apply same rule for any client on Scotia format —
  // other clients are extremely unlikely to hit an exact 580¢ mismatch except true SPEI fees.
  const scotiabankSpeiGap =
    bankFormat === 'scotiabank' ? SCOTIABANK_SPEI_FEE_GAP_CENTAVOS : null;

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

  const stats = {
    exact: 0,
    dateDrift: 0,
    roundingExact: 0,
    roundingDrift: 0,
    speiFeeGapExact: 0,
    speiFeeGapDrift: 0,
    feeAdjusted: 0,
    unmatched: 0
  };

  function tryExact(maxDays) {
    const poolSorted = [...pool].sort(
      (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id))
    );
    const txnsSorted = [...txns].sort(
      (a, b) => txnCancunSortKey(a).localeCompare(txnCancunSortKey(b)) || String(a.id).localeCompare(String(b.id))
    );
    for (const nr of poolSorted) {
      if (usedNorm.has(nr.id)) continue;
      for (const txn of txnsSorted) {
        if (usedTxn.has(txn.id)) continue;
        if (txn.accountId !== nr._accountId) continue;
        if (!typeMatchesBank(nr.type, txn)) continue;
        const tc = txnMatchCentavos(txn);
        const bankCentavos = nr.amount;
        if (nr.type === 'CARGO') {
          if (!amountsCloseCentavos(Math.abs(tc), bankCentavos)) continue;
        } else {
          if (!amountsCloseCentavos(tc, bankCentavos)) continue;
        }
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

  /**
   * Bank vs SAMS cash differs by 1…roundingTol centavos (display/rounding noise).
   * `roundingDeltaCentavos` = bank normalized amount minus |SAMS cash| in the same direction as ABONO/CARGO
   * (positive ⇒ bank line larger than SAMS magnitude — UI can "adjust to bank" later).
   */
  function tryRounding(maxDays) {
    if (roundingTol < 1) return;
    const poolSorted = [...pool].sort(
      (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id))
    );
    const txnsSorted = [...txns].sort(
      (a, b) => txnCancunSortKey(a).localeCompare(txnCancunSortKey(b)) || String(a.id).localeCompare(String(b.id))
    );
    for (const nr of poolSorted) {
      if (usedNorm.has(nr.id)) continue;
      for (const txn of txnsSorted) {
        if (usedTxn.has(txn.id)) continue;
        if (txn.accountId !== nr._accountId) continue;
        if (!typeMatchesBank(nr.type, txn)) continue;
        const tc = txnMatchCentavos(txn);
        const bankCentavos = nr.amount;
        const samsComparable = nr.type === 'CARGO' ? Math.abs(tc) : tc;
        const diff = Math.abs(bankCentavos - samsComparable);
        if (diff < 1 || diff > roundingTol) continue;
        const dd = daysBetween(nr.date, txn);
        if (dd > maxDays) continue;
        const roundingDeltaCentavos = bankCentavos - samsComparable;
        matches.push({
          normalizedRowId: nr.id,
          transactionId: txn.id,
          matchType: 'auto-rounding',
          roundingDeltaCentavos,
          // Auto-fix SAMS only for CARGO (expense); ABONO rounding stays match-only (manual edit if needed)
          ...(nr.type === 'CARGO'
            ? {
                autoFix: 'rounding',
                fixData: {
                  bankAmountCentavos: bankCentavos,
                  deltaCentavos: roundingDeltaCentavos
                }
              }
            : {})
        });
        if (maxDays <= 1) stats.roundingExact += 1;
        else stats.roundingDrift += 1;
        usedTxn.add(txn.id);
        usedNorm.add(nr.id);
        break;
      }
    }
  }

  tryRounding(1);
  tryRounding(7);

  /**
   * Fee-adjusted (2–5 txns summing to bank) runs **before** Scotia SPEI gap.
   * Otherwise: bank line = principal + 580¢ with SAMS split into principal + separate -580¢ fee
   * would be matched by SPEI gap to the principal only, leaving the fee txn orphaned.
   */
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

    const targetCentavos = nr.amount;
    const ids = candidates.map((t) => t.id);
    const absCentavos = candidates.map((t) => Math.abs(txnMatchCentavos(t)));

    let found = null;
    const n = candidates.length;
    function search(startIdx, depthLeft, sum, picked) {
      if (found) return;
      if (depthLeft === 0) {
        if (amountsCloseCentavos(sum, targetCentavos)) found = [...picked];
        return;
      }
      for (let i = startIdx; i < n; i++) {
        picked.push(ids[i]);
        search(i + 1, depthLeft - 1, sum + absCentavos[i], picked);
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

  /**
   * Scotia: CARGO bank total exceeds |txn.amount| by exactly 580¢ (fee+IVA not in SAMS yet).
   * Controller applies SAMS update (split + fee lines) per UnifiedExpenseEntry “Add Bank Fees” pattern.
   */
  function trySpeiFeeGap(maxDays) {
    if (scotiabankSpeiGap == null) return;
    const poolSorted = [...pool].sort(
      (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id))
    );
    const txnsSorted = [...txns].sort(
      (a, b) => txnCancunSortKey(a).localeCompare(txnCancunSortKey(b)) || String(a.id).localeCompare(String(b.id))
    );
    for (const nr of poolSorted) {
      if (usedNorm.has(nr.id)) continue;
      if (nr.type !== 'CARGO') continue;
      for (const txn of txnsSorted) {
        if (usedTxn.has(txn.id)) continue;
        if (txn.accountId !== nr._accountId) continue;
        if (!typeMatchesBank(nr.type, txn)) continue;
        const tc = txnMatchCentavos(txn);
        const bankCentavos = nr.amount;
        const absTxn = Math.abs(tc);
        if (Math.abs(bankCentavos - absTxn) !== scotiabankSpeiGap) continue;
        const dd = daysBetween(nr.date, txn);
        if (dd > maxDays) continue;
        matches.push({
          normalizedRowId: nr.id,
          transactionId: txn.id,
          matchType: 'auto-spei-fee-gap',
          speiFeeGapCentavos: scotiabankSpeiGap,
          autoFix: 'spei-fee',
          fixData: {
            bankAmountCentavos: bankCentavos,
            gapCentavos: scotiabankSpeiGap
          }
        });
        if (maxDays <= 1) stats.speiFeeGapExact += 1;
        else stats.speiFeeGapDrift += 1;
        usedTxn.add(txn.id);
        usedNorm.add(nr.id);
        break;
      }
    }
  }

  trySpeiFeeGap(1);
  trySpeiFeeGap(7);

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

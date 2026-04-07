/**
 * Shared SAMS transaction window for bank reconciliation matching and workbench pool.
 * Used by reconciliationController (Import & Match, workbench) and scripts/recon-match-dry-run.mjs.
 */
import { DateTime } from 'luxon';
import { getDb, toFirestoreTimestamp } from '../firebase.js';

/** Days before statement start and after statement end (America/Cancun) to include uncleared txns for pairing. */
export const SAMS_MATCHING_SLACK_DAYS = 7;

/**
 * @param {string} clientId
 * @param {string} accountId
 * @param {string} startIso — session/period start YYYY-MM-DD
 * @param {string} endIso — session/period end YYYY-MM-DD
 * @returns {Promise<object[]>} Firestore transaction docs on `accountId` in the widened date range
 */
export async function fetchTransactionsForMatching(clientId, accountId, startIso, endIso) {
  const db = await getDb();
  const start = DateTime.fromISO(startIso, { zone: 'America/Cancun' })
    .minus({ days: SAMS_MATCHING_SLACK_DAYS })
    .startOf('day');
  const end = DateTime.fromISO(endIso, { zone: 'America/Cancun' })
    .plus({ days: SAMS_MATCHING_SLACK_DAYS })
    .endOf('day');

  const snap = await db
    .collection(`clients/${clientId}/transactions`)
    .where('date', '>=', toFirestoreTimestamp(start.toJSDate()))
    .where('date', '<=', toFirestoreTimestamp(end.toJSDate()))
    .get();

  const out = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (d.accountId !== accountId) return;
    out.push({ id: doc.id, ...d });
  });
  return out;
}

#!/usr/bin/env node
/**
 * unit106OptionPStepA.js
 *
 * Stage 3 / Task 3.2b — Step a only: Q3.3 / Q4 priority reallocation.
 *
 * Read-only against Firestore in `--dry-mode`. In `--apply` mode, performs
 * exactly two writes:
 *
 *  1. UPDATE on `clients/AVII/transactions/2026-04-20_172802_372`:
 *     split the single `hoa_month` allocation (target `Q4_2026`, amount
 *     987868c) into two:
 *       - 426930c targeted to `Q3_2026` (month 8 = Q3.3)
 *       - 560938c targeted to `Q4_2026` (month 9 = Q4.1)
 *
 *  2. UPDATE on `clients/AVII/units/106/dues/2026.payments[8,9]`:
 *     - payments[8].basePaid: 775101 → 1202031 (Q3.3 closes)
 *     - payments[8].amount:   787797 → 1214727 (basePaid + penaltyPaid 12696 unchanged)
 *     - payments[8].transactionId: '2026-04-20_172637_586' (unchanged primary)
 *       (we add the additional contributing tx id in `transactionIds[]` array if the schema supports it)
 *     - payments[9].basePaid: 987868 → 560938 (Q4.1 partial)
 *     - payments[9].amount:   987868 → 560938
 *     - payments[9].transactionId: '2026-04-20_172802_372' (unchanged)
 *
 *  Reversibility: capture pre-state to test-results/unit106-option-p-step-a-{dry,apply}.json.
 *  The reverse operation is the exact inverse: re-merge the two allocations into one
 *  and restore m8 / m9 basePaid+amount to their pre-state values.
 *
 *  Centavos discipline throughout; getNow() not used (this script doesn't write dates).
 *
 *  Usage:
 *    node backend/scripts/unit106OptionPStepA.js --dry-mode
 *    node backend/scripts/unit106OptionPStepA.js --apply
 */

import fs from 'fs/promises';
import path from 'path';
import { getNow } from '../../shared/services/DateService.js';
import { getNotesArray, createNotesEntry } from '../../shared/utils/formatUtils.js';
import { getProdAwareDb, confirmProd } from './lib/prodAwareDb.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '106';
const FISCAL_YEAR = 2026;
const TX_ID = '2026-04-20_172802_372';
const MOVE_FROM_Q = 'Q4_2026';
const MOVE_TO_Q = 'Q3_2026';
const MOVE_FROM_MONTH_INDEX = 9; // Q4.1 = payments[9]
const MOVE_TO_MONTH_INDEX = 8;   // Q3.3 = payments[8]
const MOVE_AMOUNT_CENTAVOS = 426930; // $4,269.30
// Per Task 3.5 — re-derive paid/status/notes canonically (mirror unifiedPaymentWrapper.js
// lines 2185-2291). Step a moves base between months without going through the canonical
// payment flow, so paid/status/notes must be recomputed and the notes[] arrays updated.
const MOVE_TO_QUARTER_NUM = 3;   // human-readable Q3 (matches existing (Q3 Month 3/3) tag)
const MOVE_TO_MONTH_IN_QUARTER = 3; // 3/3 since payments[8] is the 3rd month of Q3
const MOVE_FROM_QUARTER_NUM = 4; // Q4
const MOVE_FROM_MONTH_IN_QUARTER = 1; // 1/3 (payments[9] = Q4.1)

function deriveStatusAndPaid(basePaid, penaltyPaid, scheduledAmount) {
  const amount = (basePaid || 0) + (penaltyPaid || 0);
  let status;
  if ((basePaid || 0) >= (scheduledAmount || 0)) {
    status = 'paid';
  } else if (amount > 0) {
    status = 'partial';
  } else {
    status = 'unpaid';
  }
  return { status, paid: status === 'paid' };
}

function txDateToIsoDay(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (typeof d?.toDate === 'function') return d.toDate().toISOString().slice(0, 10);
  if (typeof d?._seconds === 'number') return new Date(d._seconds * 1000).toISOString().slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return null;
}

function txNotesFirstLine(notes) {
  if (!notes) return 'Payment';
  if (typeof notes === 'string') return notes.split('\n')[0];
  if (Array.isArray(notes) && notes.length > 0) {
    const t = notes[0]?.text || '';
    return t.split('\n')[0];
  }
  return 'Payment';
}

const REPO_ROOT = '/Users/michael/Projects/SAMS';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry-mode') || !APPLY;
const IS_PROD = args.includes('--prod');

const OUT_PATH = path.join(
  REPO_ROOT,
  `test-results/unit106-option-p-step-a-${IS_PROD ? 'prod-' : ''}${APPLY ? 'apply' : 'dry'}.json`
);

async function main() {
  if (APPLY && DRY) {
    throw new Error('Cannot pass both --dry-mode and --apply.');
  }
  console.error(`[step a] mode = ${APPLY ? 'APPLY' : 'DRY'}${IS_PROD ? ' [PROD]' : ''}`);

  const { db, env, projectId } = await getProdAwareDb({ isProd: IS_PROD });
  console.error(`[step a] env=${env} projectId=${projectId}`);

  // For --prod --apply, require an explicit confirmation phrase from the operator.
  if (IS_PROD && APPLY) {
    const ok = await confirmProd('APPLY-TO-PROD-UNIT-106-STEP-A');
    if (!ok) {
      console.error('[step a] Prod confirmation failed — aborting.');
      process.exit(3);
    }
  }

  // Read pre-state
  const txRef = db.collection('clients').doc(CLIENT_ID)
    .collection('transactions').doc(TX_ID);
  const duesRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc(UNIT_ID)
    .collection('dues').doc(String(FISCAL_YEAR));

  const txSnap = await txRef.get();
  const duesSnap = await duesRef.get();
  if (!txSnap.exists) throw new Error(`Transaction ${TX_ID} not found`);
  if (!duesSnap.exists) throw new Error(`Dues doc ${CLIENT_ID}/${UNIT_ID}/${FISCAL_YEAR} not found`);

  const txPre = txSnap.data();
  const duesPre = duesSnap.data();

  // Validate pre-state matches expected
  const allocs = Array.isArray(txPre.allocations) ? txPre.allocations : [];
  const hoaAlloc = allocs.find((a) => a?.type === 'hoa_month' && a?.targetId === MOVE_FROM_Q);
  if (!hoaAlloc) {
    throw new Error(`Pre-state mismatch: expected hoa_month allocation to ${MOVE_FROM_Q} on tx ${TX_ID}, not found.`);
  }
  if (hoaAlloc.amount !== 987868) {
    throw new Error(`Pre-state mismatch: expected allocation amount 987868c, got ${hoaAlloc.amount}c.`);
  }

  const payments = Array.isArray(duesPre.payments) ? duesPre.payments : [];
  if (payments.length < 10) {
    throw new Error(`Pre-state mismatch: dues.payments has only ${payments.length} entries, expected >= 10.`);
  }
  const m8Pre = payments[MOVE_TO_MONTH_INDEX] || {};
  const m9Pre = payments[MOVE_FROM_MONTH_INDEX] || {};
  if (m8Pre.basePaid !== 775101) {
    throw new Error(`Pre-state mismatch: m9 (Q3.3) basePaid expected 775101c, got ${m8Pre.basePaid}c.`);
  }
  if (m9Pre.basePaid !== 987868) {
    throw new Error(`Pre-state mismatch: m10 (Q4.1) basePaid expected 987868c, got ${m9Pre.basePaid}c.`);
  }

  // Construct post-state for transaction (split allocation)
  const txPost = { ...txPre };
  const newAllocs = allocs.map((a) => ({ ...a }));
  // Find the index of the original Q4 hoa_month allocation
  const idx = newAllocs.findIndex((a) => a?.type === 'hoa_month' && a?.targetId === MOVE_FROM_Q);
  if (idx === -1) throw new Error('Failed to locate Q4 hoa_month allocation index.');

  // Replace one allocation with two
  const original = newAllocs[idx];
  const toQ3 = {
    ...original,
    amount: MOVE_AMOUNT_CENTAVOS,
    targetId: MOVE_TO_Q,
    data: {
      ...(original.data || {}),
      // Preserve existing structure; align quarter/month metadata to Q3 month index 8 (Q3.3)
      quarter: 2, // 0-indexed Q3 == 2
      month: 8
    }
  };
  const toQ4 = {
    ...original,
    amount: original.amount - MOVE_AMOUNT_CENTAVOS,
    targetId: MOVE_FROM_Q,
    data: {
      ...(original.data || {}),
      quarter: 3, // 0-indexed Q4 == 3
      month: 9
    }
  };
  newAllocs.splice(idx, 1, toQ3, toQ4);
  txPost.allocations = newAllocs;

  // Construct post-state for dues mirror
  const duesPost = { ...duesPre };
  const scheduledAmount = Number(duesPre.scheduledAmount || 0);
  if (!scheduledAmount) {
    throw new Error('Pre-state mismatch: dues doc has no scheduledAmount; cannot derive status canonically.');
  }
  const txIsoDay = txDateToIsoDay(txPre.date);
  const txDescPrefix = txNotesFirstLine(txPre.notes);

  const newPayments = payments.map((p) => p ? { ...p } : p);

  // ── m_to (Q3.3, payments[8]) gains MOVE_AMOUNT_CENTAVOS basePaid ────────────
  const m8 = { ...(newPayments[MOVE_TO_MONTH_INDEX] || {}) };
  const m8BasePost = (m8.basePaid || 0) + MOVE_AMOUNT_CENTAVOS;
  const m8PenPost = m8.penaltyPaid || 0;
  m8.basePaid = m8BasePost;
  m8.amount = m8BasePost + m8PenPost; // amount = basePaid + penaltyPaid by convention
  // Re-derive paid/status canonically (mirror unifiedPaymentWrapper.js §2185-2291)
  const m8Derived = deriveStatusAndPaid(m8BasePost, m8PenPost, scheduledAmount);
  m8.status = m8Derived.status;
  m8.paid = m8Derived.paid;
  // Notes: append a new entry for the step-a transfer, mirroring canonical createNotesEntry
  // shape. Idempotent: skip append if existing array already contains an entry tagged for
  // this tx routed to (Q3 Month 3/3).
  const m8NotesPre = getNotesArray(m8.notes);
  const m8RoutingTag = `(Q${MOVE_TO_QUARTER_NUM} Month ${MOVE_TO_MONTH_IN_QUARTER}/3)`;
  const m8AlreadyHasStepAEntry = m8NotesPre.some((n) => n && n.transactionId === TX_ID
    && typeof n.text === 'string' && n.text.endsWith(m8RoutingTag));
  let m8NotesPost = m8NotesPre;
  if (!m8AlreadyHasStepAEntry) {
    const m8NewEntry = createNotesEntry({
      transactionId: TX_ID,
      timestamp: txIsoDay,
      text: `${txDescPrefix}\nTxnID: ${TX_ID} ${m8RoutingTag}`,
      amount: MOVE_AMOUNT_CENTAVOS,
      basePaid: MOVE_AMOUNT_CENTAVOS,
      penaltyPaid: 0
    });
    m8NotesPost = [...m8NotesPre, m8NewEntry];
  }
  m8.notes = m8NotesPost;
  newPayments[MOVE_TO_MONTH_INDEX] = m8;

  // ── m_from (Q4.1, payments[9]) loses MOVE_AMOUNT_CENTAVOS basePaid ──────────
  const m9 = { ...(newPayments[MOVE_FROM_MONTH_INDEX] || {}) };
  const m9BasePost = (m9.basePaid || 0) - MOVE_AMOUNT_CENTAVOS;
  const m9PenPost = m9.penaltyPaid || 0;
  if (m9BasePost < 0) {
    throw new Error(`Post-state mismatch: m_from basePaid would go negative (pre=${m9.basePaid}c, move=${MOVE_AMOUNT_CENTAVOS}c).`);
  }
  m9.basePaid = m9BasePost;
  m9.amount = m9BasePost + m9PenPost;
  const m9Derived = deriveStatusAndPaid(m9BasePost, m9PenPost, scheduledAmount);
  m9.status = m9Derived.status;
  m9.paid = m9Derived.paid;
  // Notes: find existing entry for this tx with non-zero remaining base; update its amount
  // and basePaid to reflect the post-step-a remainder. If the move consumed the entire
  // entry (rare for unit 106 — its pre-state amount 987868c > MOVE_AMOUNT 426930c), remove
  // it from the array. Idempotent: re-runs are no-ops because the entry's amount will
  // already match the post-state.
  const m9NotesPre = getNotesArray(m9.notes);
  const m9RemainingFromTx = Math.max(0, (m9.basePaid || 0)); // residual base attributed to this tx slot
  const stepAEntryIdx = m9NotesPre.findIndex((n) => n && n.transactionId === TX_ID);
  let m9NotesPost = [...m9NotesPre];
  if (stepAEntryIdx === -1) {
    // No matching entry — script invariant is that pre-state had one. Don't crash if
    // running on already-corrected data; just leave notes untouched.
    console.error(`[step a] WARN: m_from notes[] has no entry for tx ${TX_ID}; leaving notes untouched.`);
  } else {
    const existingEntry = m9NotesPre[stepAEntryIdx];
    const remainingBaseForEntry = (existingEntry.basePaid || existingEntry.amount || 0) - MOVE_AMOUNT_CENTAVOS;
    if (remainingBaseForEntry <= 0) {
      // Entire allocation moved out of this month — drop the entry.
      m9NotesPost.splice(stepAEntryIdx, 1);
    } else {
      // Reduce the existing entry's amount/basePaid to reflect the remainder.
      const updatedEntry = {
        ...existingEntry,
        amount: remainingBaseForEntry + (existingEntry.penaltyPaid || 0),
        basePaid: remainingBaseForEntry
      };
      m9NotesPost[stepAEntryIdx] = updatedEntry;
    }
  }
  m9.notes = m9NotesPost;
  newPayments[MOVE_FROM_MONTH_INDEX] = m9;
  duesPost.payments = newPayments;

  const summary = {
    mode: APPLY ? 'APPLY' : 'DRY',
    capturedAt: getNow().toISOString(),
    transactionId: TX_ID,
    duesDocPath: `clients/${CLIENT_ID}/units/${UNIT_ID}/dues/${FISCAL_YEAR}`,
    pre: {
      tx_allocations: allocs,
      m8: m8Pre,
      m9: m9Pre
    },
    post: {
      tx_allocations: newAllocs,
      m8: m8,
      m9: m9
    },
    deltas: {
      m9_to_m8_basePaid_centavos: MOVE_AMOUNT_CENTAVOS,
      m8_basePaid_pre_centavos: m8Pre.basePaid,
      m8_basePaid_post_centavos: m8BasePost,
      m9_basePaid_pre_centavos: m9Pre.basePaid,
      m9_basePaid_post_centavos: m9BasePost
    },
    expected_effects: {
      Q3_3_closes: m8BasePost === 1202031,
      Q4_1_becomes_partial: m9BasePost === 560938,
      // Task 3.5 — paid/status/notes are now re-derived canonically
      m8_status_post: m8.status,
      m8_paid_post: m8.paid,
      m8_notes_count_post: (m8.notes || []).length,
      m9_status_post: m9.status,
      m9_paid_post: m9.paid,
      m9_notes_count_post: (m9.notes || []).length
    }
  };

  if (APPLY) {
    // Atomic batched write
    const batch = db.batch();
    batch.update(txRef, { allocations: newAllocs });
    batch.update(duesRef, { payments: newPayments });
    await batch.commit();
    summary.applyResult = { committed: true };
    console.error('[step a] APPLY committed (batched).');
  } else {
    console.error('[step a] DRY — no writes performed.');
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(summary, null, 2), 'utf8');
  console.error(`[step a] wrote ${APPLY ? 'apply' : 'dry'} report → ${OUT_PATH}`);
  console.error('[step a] effects:', JSON.stringify(summary.expected_effects));
}

main().catch((err) => {
  console.error('[step a] FATAL:', err && err.stack || err);
  process.exit(2);
});

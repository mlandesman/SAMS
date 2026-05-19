#!/usr/bin/env node
/**
 * task3-5StepAStatusNotesFix.js
 *
 * Stage 3 / Task 3.5 — Step-a side effects (paid/status/notes) cleanup for
 * current Dev state where Pass 2 step-a writes did NOT update those fields.
 *
 * This is a ONE-TIME Dev-cleanup script. The script-permanent fix is the
 * patches to `unit106OptionPStepA.js` and `aviiOptionPSteps2026May17.js` (Task 3.5).
 *
 * What it does, per affected unit:
 *   - m_to (gaining month): re-derive paid/status canonically; append a step-a
 *     transfer entry to notes[] if missing.
 *   - m_from (losing month): re-derive paid/status canonically; reduce or remove
 *     the matching notes[] entry to reflect the post-step-a remainder.
 *
 * Canonical pattern source: `functions/backend/services/unifiedPaymentWrapper.js`
 * lines 2185-2291 (`paid = status === 'paid'`; `status = newBasePaid >= monthlyAmount
 * ? 'paid' : (newAmount > 0 ? 'partial' : 'unpaid')`). Notes-entry shape via
 * `createNotesEntry()` and `getNotesArray()` from `shared/utils/formatUtils.js`.
 *
 * Atomic per unit. Idempotent: re-runs detect already-correct state and skip.
 *
 * Pre/post snapshots: `test-results/task-3-5-unit{ID}-{pre|post}-2026-05-17.json`
 *
 * Usage:
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/task3-5StepAStatusNotesFix.js --dry-mode
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/task3-5StepAStatusNotesFix.js --apply
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/task3-5StepAStatusNotesFix.js --apply --unit 106
 */

import fs from 'fs/promises';
import path from 'path';
import { getNow } from '../../shared/services/DateService.js';
import { getNotesArray, createNotesEntry } from '../../shared/utils/formatUtils.js';
import { getProdAwareDb, confirmProd } from './lib/prodAwareDb.js';

const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;
const REPO_ROOT = '/Users/michael/Projects/SAMS';

const args = process.argv.slice(2);
function getArg(flag, fallback = null) {
  const i = args.indexOf(flag);
  return (i === -1 || i + 1 >= args.length) ? fallback : args[i + 1];
}
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry-mode') || !APPLY;
const IS_PROD = args.includes('--prod');
const UNIT_FILTER = getArg('--unit', null);
// post = require post-step-a basePaid sentinels (Dev after Pass 2, or Prod after step-a apply).
// pre-preview = read-only Prod preview before replay; reports inconsistency without failing sentinel.
const SENTINEL_MODE = getArg('--sentinel-mode', 'post');

if (APPLY && args.includes('--dry-mode')) {
  console.error('Cannot pass both --dry-mode and --apply');
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-unit configurations (derived from Pass 2 logs + current Dev inspection)
// All amounts in centavos.
// ─────────────────────────────────────────────────────────────────────────────

// `mFromEntryPolicy`:
//   - { kind: 'remove' }                                 — entry was fully consumed; absent on post-state
//   - { kind: 'reduce', expectedBasePaid, expectedAmount, expectedPenaltyPaid } — entry's basePaid/amount
//                                                          should match these post-step-a values exactly
const UNIT_FIXES = {
  '106': {
    txId: '2026-04-20_172802_372',
    moveFromMonthIndex: 9, // Q4.1 = payments[9]
    moveToMonthIndex: 8,   // Q3.3 = payments[8]
    moveAmountCentavos: 426930, // $4,269.30
    sentinel: {
      mToBasePaidExpected: 1202031,    // Dev after Pass 2 + closing payment on m10
      mFromBasePaidExpected: 1202031
    },
    // Prod replay: run task 3.5 fix after step a (and a'–f) but BEFORE owner closing payment
    sentinelPostStepAOnly: {
      mToBasePaidExpected: 1202031,
      mFromBasePaidExpected: 560938
    },
    moveToRoutingTag: '(Q3 Month 3/3)',
    expectedMToNotesCountPost: 3,
    expectedMFromNotesCountPost: 2, // Dev (with closing payment on m10)
    expectedMFromNotesCountPostProd: 1, // Prod replay before closing: one reduced tx note
    mFromEntryPolicy: { kind: 'reduce', expectedBasePaid: 560938, expectedAmount: 560938, expectedPenaltyPaid: 0 }
  },
  '102': {
    txId: '2026-04-30_204438_638',
    moveFromMonthIndex: 9,
    moveToMonthIndex: 8,
    moveAmountCentavos: 264656, // $2,646.56 (entire allocation)
    sentinel: {
      mToBasePaidExpected: 705675,
      mFromBasePaidExpected: 0
    },
    moveToRoutingTag: '(Q3 Month 3/3)',
    expectedMToNotesCountPost: 3,
    expectedMFromNotesCountPost: 0,
    mFromEntryPolicy: { kind: 'remove' }
  },
  '203': {
    txId: '2026-04-30_204456_628',
    moveFromMonthIndex: 9,
    moveToMonthIndex: 8,
    moveAmountCentavos: 157500, // $1,575.00 (entire allocation)
    sentinel: {
      mToBasePaidExpected: 776970,
      mFromBasePaidExpected: 0
    },
    moveToRoutingTag: '(Q3 Month 3/3)',
    expectedMToNotesCountPost: 2,
    expectedMFromNotesCountPost: 0,
    mFromEntryPolicy: { kind: 'remove' }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (mirror unifiedPaymentWrapper canonical pattern)
// ─────────────────────────────────────────────────────────────────────────────

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

function deepStrip(value) {
  // Drop undefined fields so the snapshot is JSON-faithful.
  return JSON.parse(JSON.stringify(value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-unit fixer
// ─────────────────────────────────────────────────────────────────────────────

async function fixUnit(db, unitId, cfg, env = 'dev') {
  const txRef = db.collection('clients').doc(CLIENT_ID).collection('transactions').doc(cfg.txId);
  const duesRef = db.collection('clients').doc(CLIENT_ID).collection('units').doc(unitId)
    .collection('dues').doc(String(FISCAL_YEAR));

  const [txSnap, duesSnap] = await Promise.all([txRef.get(), duesRef.get()]);
  if (!txSnap.exists) throw new Error(`Transaction ${cfg.txId} not found for unit ${unitId}`);
  if (!duesSnap.exists) throw new Error(`Dues doc not found for unit ${unitId}/${FISCAL_YEAR}`);

  const txPre = txSnap.data();
  const duesPre = duesSnap.data();
  const payments = Array.isArray(duesPre.payments) ? duesPre.payments.map((p) => p ? { ...p } : p) : [];

  if (payments.length <= cfg.moveFromMonthIndex) {
    throw new Error(`Unit ${unitId} dues.payments has only ${payments.length} entries; need >=${cfg.moveFromMonthIndex + 1}`);
  }

  const scheduledAmount = Number(duesPre.scheduledAmount || 0);
  if (!scheduledAmount) {
    throw new Error(`Unit ${unitId} dues doc has no scheduledAmount; cannot derive canonical status.`);
  }

  const mToPre = { ...(payments[cfg.moveToMonthIndex] || {}) };
  const mFromPre = { ...(payments[cfg.moveFromMonthIndex] || {}) };

  const activeSentinel = (IS_PROD && cfg.sentinelPostStepAOnly && SENTINEL_MODE !== 'pre-preview')
    ? cfg.sentinelPostStepAOnly
    : cfg.sentinel;
  const expectedMFromNotesCountPost = (IS_PROD && cfg.expectedMFromNotesCountPostProd && SENTINEL_MODE !== 'pre-preview')
    ? cfg.expectedMFromNotesCountPostProd
    : cfg.expectedMFromNotesCountPost;

  // Pre-step-a sentinel values (Prod before replay) — from Pass 2 apply logs
  const PRE_STEP_A_SENTINEL = {
    '106': { mTo: 775101, mFrom: 987868 },
    '102': { mTo: 441019, mFrom: 264656 },
    '203': { mTo: 619470, mFrom: 157500 }
  };
  const preSentinel = PRE_STEP_A_SENTINEL[unitId];

  // ── Sentinel: confirm post-step-a basePaid values match Pass 2 expectations ──
  const mToBaseActual = Number(mToPre.basePaid || 0);
  const mFromBaseActual = Number(mFromPre.basePaid || 0);
  const postSentinelOk =
    mToBaseActual === activeSentinel.mToBasePaidExpected
    && mFromBaseActual === activeSentinel.mFromBasePaidExpected;
  const preSentinelOk = preSentinel
    ? mToBaseActual === preSentinel.mTo && mFromBaseActual === preSentinel.mFrom
    : false;

  let sentinelPreview = null;
  let sentinelOk = false;
  if (SENTINEL_MODE === 'pre-preview') {
    sentinelPreview = {
      mode: 'pre-preview',
      postStepAExpected: activeSentinel,
      preStepAMatches: preSentinelOk,
      postStepAMatches: postSentinelOk,
      actual: { mToBasePaid: mToBaseActual, mFromBasePaid: mFromBaseActual },
      mToPaidStatus: { paid: mToPre.paid, status: mToPre.status },
      mFromPaidStatus: { paid: mFromPre.paid, status: mFromPre.status },
      inconsistencyPresent:
        mToPre.paid === false || mToPre.status === 'partial'
        || mFromPre.paid === false || mFromPre.status === 'partial'
    };
    sentinelOk = true;
    console.error(
      `[${unitId}] pre-preview: preStepA=${preSentinelOk} postStepA=${postSentinelOk} ` +
      `mTo ${mToPre.paid}/${mToPre.status} mFrom ${mFromPre.paid}/${mFromPre.status} ` +
      `inconsistency=${sentinelPreview.inconsistencyPresent}`
    );
  } else if (!postSentinelOk) {
    throw new Error(
      `Sentinel FAIL: unit ${unitId} payments[${cfg.moveToMonthIndex}].basePaid expected ${activeSentinel.mToBasePaidExpected}c, got ${mToPre.basePaid}c; ` +
      `payments[${cfg.moveFromMonthIndex}].basePaid expected ${activeSentinel.mFromBasePaidExpected}c, got ${mFromPre.basePaid}c. ` +
      `Either step-a hasn't been applied yet or the source state isn't what we expected.`
    );
  } else {
    sentinelOk = true;
  }

  // ── Build canonical post-state ─────────────────────────────────────────────
  const txIsoDay = txDateToIsoDay(txPre.date);
  const txDescPrefix = txNotesFirstLine(txPre.notes);

  // m_to
  const mTo = { ...mToPre };
  const mToBase = Number(mTo.basePaid || 0);
  const mToPen = Number(mTo.penaltyPaid || 0);
  // amount stays consistent with basePaid+penaltyPaid (re-derive to ensure invariant)
  mTo.amount = mToBase + mToPen;
  const mToDerived = deriveStatusAndPaid(mToBase, mToPen, scheduledAmount);
  mTo.status = mToDerived.status;
  mTo.paid = mToDerived.paid;
  const mToNotesPre = getNotesArray(mTo.notes);
  const mToAlreadyHasEntry = mToNotesPre.some((n) => n && n.transactionId === cfg.txId
    && typeof n.text === 'string' && n.text.endsWith(cfg.moveToRoutingTag));
  let mToNotesPost = mToNotesPre;
  let mToAppended = false;
  if (!mToAlreadyHasEntry) {
    const newEntry = createNotesEntry({
      transactionId: cfg.txId,
      timestamp: txIsoDay,
      text: `${txDescPrefix}\nTxnID: ${cfg.txId} ${cfg.moveToRoutingTag}`,
      amount: cfg.moveAmountCentavos,
      basePaid: cfg.moveAmountCentavos,
      penaltyPaid: 0
    });
    mToNotesPost = [...mToNotesPre, newEntry];
    mToAppended = true;
  }
  mTo.notes = mToNotesPost;

  // m_from
  const mFrom = { ...mFromPre };
  const mFromBase = Number(mFrom.basePaid || 0);
  const mFromPen = Number(mFrom.penaltyPaid || 0);
  mFrom.amount = mFromBase + mFromPen;
  const mFromDerived = deriveStatusAndPaid(mFromBase, mFromPen, scheduledAmount);
  mFrom.status = mFromDerived.status;
  mFrom.paid = mFromDerived.paid;
  const mFromNotesPre = getNotesArray(mFrom.notes);
  // Idempotency: compare against the unit-specific expected post-state via mFromEntryPolicy.
  // This avoids the "keeps subtracting moveAmount on re-runs" bug — we no longer infer
  // post-state from the current entry's amount; we use the configured target instead.
  const stepAEntryIdx = mFromNotesPre.findIndex((n) => n && n.transactionId === cfg.txId);
  const policy = cfg.mFromEntryPolicy || { kind: 'remove' };
  let mFromNotesPost = [...mFromNotesPre];
  let mFromAction = 'none';
  if (policy.kind === 'remove') {
    if (stepAEntryIdx === -1) {
      mFromAction = 'no-entry-found';
    } else {
      mFromNotesPost.splice(stepAEntryIdx, 1);
      mFromAction = 'removed';
    }
  } else if (policy.kind === 'reduce') {
    if (stepAEntryIdx === -1) {
      mFromAction = 'no-entry-found';
      console.error(`[${unitId}] WARN: m_from notes has no entry for tx ${cfg.txId}; cannot reduce.`);
    } else {
      const existingEntry = mFromNotesPre[stepAEntryIdx];
      const alreadyCorrect = existingEntry.basePaid === policy.expectedBasePaid
                          && existingEntry.amount === policy.expectedAmount
                          && (existingEntry.penaltyPaid || 0) === (policy.expectedPenaltyPaid || 0);
      if (alreadyCorrect) {
        mFromAction = 'already-correct';
      } else {
        mFromNotesPost[stepAEntryIdx] = {
          ...existingEntry,
          amount: policy.expectedAmount,
          basePaid: policy.expectedBasePaid,
          penaltyPaid: policy.expectedPenaltyPaid || 0
        };
        mFromAction = 'reduced-to-expected';
      }
    }
  }
  mFrom.notes = mFromNotesPost;

  payments[cfg.moveToMonthIndex] = mTo;
  payments[cfg.moveFromMonthIndex] = mFrom;

  // ── Idempotency / no-op detection ──────────────────────────────────────────
  const isNoOp = !mToAppended
    && (mFromAction === 'already-correct' || mFromAction === 'no-entry-found')
    && mTo.status === mToPre.status
    && mTo.paid === mToPre.paid
    && mFrom.status === mFromPre.status
    && mFrom.paid === mFromPre.paid;

  const summary = {
    unit: unitId,
    mode: APPLY ? 'APPLY' : 'DRY',
    sentinelMode: SENTINEL_MODE,
    capturedAt: getNow().toISOString(),
    scheduledAmount,
    txId: cfg.txId,
    sentinelOk,
    sentinelPreview,
    pre: {
      mTo: deepStrip(mToPre),
      mFrom: deepStrip(mFromPre)
    },
    post: {
      mTo: deepStrip(mTo),
      mFrom: deepStrip(mFrom)
    },
    actions: {
      mToAppended,
      mToNotesCountPre: mToNotesPre.length,
      mToNotesCountPost: mToNotesPost.length,
      mFromAction,
      mFromNotesCountPre: mFromNotesPre.length,
      mFromNotesCountPost: mFromNotesPost.length,
      mToStatusChanged: mTo.status !== mToPre.status || mTo.paid !== mToPre.paid,
      mFromStatusChanged: mFrom.status !== mFromPre.status || mFrom.paid !== mFromPre.paid,
      isNoOp
    },
    expected: {
      mToNotesCountPost: cfg.expectedMToNotesCountPost,
      mFromNotesCountPost: expectedMFromNotesCountPost
    },
    verificationOk: mToNotesPost.length === cfg.expectedMToNotesCountPost
                    && mFromNotesPost.length === expectedMFromNotesCountPost
  };

  // Verbose dry-mode output
  console.error(`[${unitId}] sentinel PASS scheduledAmount=${scheduledAmount}c`);
  console.error(`[${unitId}]   m_to (payments[${cfg.moveToMonthIndex}]): ${mToPre.paid}/${mToPre.status} -> ${mTo.paid}/${mTo.status}; notes ${mToNotesPre.length}->${mToNotesPost.length} (${mToAppended ? 'appended' : 'unchanged'})`);
  console.error(`[${unitId}]   m_from (payments[${cfg.moveFromMonthIndex}]): ${mFromPre.paid}/${mFromPre.status} -> ${mFrom.paid}/${mFrom.status}; notes ${mFromNotesPre.length}->${mFromNotesPost.length} (${mFromAction})`);
  console.error(`[${unitId}]   verificationOk=${summary.verificationOk} isNoOp=${summary.actions.isNoOp}`);

  if (APPLY && !isNoOp) {
    await duesRef.update({ payments });
    summary.applyResult = { committed: true };
    console.error(`[${unitId}] APPLY committed.`);
  } else if (APPLY && isNoOp) {
    summary.applyResult = { committed: false, reason: 'no-op (idempotent)' };
    console.error(`[${unitId}] APPLY skipped (no-op).`);
  } else {
    console.error(`[${unitId}] DRY — no write.`);
  }

  const dateTag = env === 'prod' ? '2026-05-19' : '2026-05-17';
  const preFile = path.join(REPO_ROOT, `test-results/task-3-5-unit${unitId}-pre-${dateTag}.json`);
  const postFile = path.join(REPO_ROOT, `test-results/task-3-5-unit${unitId}-${APPLY ? 'post' : 'dry'}-${dateTag}.json`);
  await fs.writeFile(preFile, JSON.stringify(summary.pre, null, 2), 'utf8');
  await fs.writeFile(postFile, JSON.stringify(summary, null, 2), 'utf8');
  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.error(`[task 3.5] mode = ${APPLY ? 'APPLY' : 'DRY'}${IS_PROD ? ' [PROD]' : ''}`);

  const { db, env, projectId } = await getProdAwareDb({ isProd: IS_PROD });
  console.error(`[task 3.5] env=${env} projectId=${projectId}`);

  if (IS_PROD && APPLY) {
    const ok = await confirmProd('APPLY-TO-PROD-TASK-3-5-STEP-A-STATUS-NOTES-FIX');
    if (!ok) {
      console.error('[task 3.5] Prod confirmation failed — aborting.');
      process.exit(3);
    }
  }

  const unitIds = UNIT_FILTER ? [UNIT_FILTER] : Object.keys(UNIT_FIXES);

  const out = {
    metadata: {
      generatedAt: getNow().toISOString(),
      mode: APPLY ? 'APPLY' : 'DRY',
      env,
      projectId,
      isProd: IS_PROD,
      clientId: CLIENT_ID,
      fiscalYear: FISCAL_YEAR,
      unitsProcessed: unitIds
    },
    units: {}
  };

  for (const unitId of unitIds) {
    const cfg = UNIT_FIXES[unitId];
    if (!cfg) {
      console.error(`[${unitId}] no fix config; skipping`);
      continue;
    }
    try {
      const s = await fixUnit(db, unitId, cfg, env);
      out.units[unitId] = s;
    } catch (err) {
      console.error(`[${unitId}] FAILED:`, err && err.message);
      out.units[unitId] = { unit: unitId, error: err && err.message };
      // Don't continue on sentinel failures — Manager has explicit Stop-and-Surface guidance.
      throw err;
    }
  }

  const prodTag = IS_PROD ? 'prod-' : '';
  const dateTag = IS_PROD ? '2026-05-19' : '2026-05-17';
  const aggregatePath = path.join(REPO_ROOT, `test-results/task-3-5-aggregate-${prodTag}${APPLY ? 'apply' : 'dry'}-${dateTag}.json`);
  await fs.writeFile(aggregatePath, JSON.stringify(out, null, 2), 'utf8');
  console.error(`[task 3.5] wrote aggregate -> ${aggregatePath}`);
}

main().catch((err) => {
  console.error('[task 3.5] FATAL:', err && err.stack || err);
  process.exit(2);
});

#!/usr/bin/env node
/**
 * aviiOptionPSteps2026May17.js
 *
 * Stage 3 / Task 3.4 — Per-unit Option-P-pattern correction step executor.
 *
 * Handles step types: a, a-prime, b, b2, c, d, e, f.
 *
 * Uses canonical service paths:
 *   - water bill currentCharge writes -> waterBillsService.setUnitCurrentCharge
 *     (Task 3.2a §5.3 guarded; passes { force: true } when newCC < existingBasePaid)
 *   - credit balance writes -> creditService.updateCreditBalance
 *     (allowed sources: admin, correction, reconciliation, waterBills, hoaDues, ...)
 *   - water bill penaltyPaid writes -> direct Firestore (no canonical guard exists for this field)
 *   - HOA dues mirror m_n re-materialization + transaction allocation update -> direct
 *     Firestore (batch atomic; same pattern as unit106OptionPStepA.js)
 *
 * Zero-cash credit-only deposit retargeting (step a) is handled with explicit
 * pre-state validation and atomic batched writes. Dry-mode validates pre-state
 * and prints expected post-state without writes.
 *
 * Usage:
 *   node backend/scripts/aviiOptionPSteps2026May17.js --unit 105 --step b --dry-mode
 *   node backend/scripts/aviiOptionPSteps2026May17.js --unit 105 --step b --apply
 *   node backend/scripts/aviiOptionPSteps2026May17.js --unit 102 --step a --apply
 *   node backend/scripts/aviiOptionPSteps2026May17.js --unit 102 --step e --residual-centavos 1234 --apply
 */

import fs from 'fs/promises';
import path from 'path';
import { getDb } from '../firebase.js';
import { getNow } from '../../shared/services/DateService.js';
import waterBillsServiceDefault from '../services/waterBillsService.js';
import creditServiceDefault from '../services/creditService.js';

const waterBillsService = waterBillsServiceDefault.default || waterBillsServiceDefault;
const creditService = creditServiceDefault.default || creditServiceDefault;

const CLIENT_ID = 'AVII';
const REPO_ROOT = '/Users/michael/Projects/SAMS';

const args = process.argv.slice(2);
function getArg(flag, fallback = null) {
  const i = args.indexOf(flag);
  return (i === -1 || i + 1 >= args.length) ? fallback : args[i + 1];
}
const UNIT_ID = getArg('--unit', null);
const STEP = getArg('--step', null);
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry-mode') || !APPLY;
const RESIDUAL_CENTAVOS = Number(getArg('--residual-centavos', 0));

if (!UNIT_ID || !STEP) {
  console.error('Usage: --unit <id> --step <a|a-prime|b|b2|c|d|e|f> [--dry-mode|--apply] [--residual-centavos N]');
  process.exit(2);
}
if (APPLY && DRY === true && args.includes('--dry-mode')) {
  console.error('Cannot pass both --dry-mode and --apply');
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-unit configurations (values from Task 3.3 forensic + Task 3.4 Task Prompt)
// All amounts in centavos. Water assessed values from bill doc waterCharge+carWashCharge+boatWashCharge.
// ─────────────────────────────────────────────────────────────────────────────

const UNIT_CONFIGS = {
  '101': {
    b: { billDocId: '2026-Q1', newCurrentChargeCentavos: 125000, expectedExistingBasePaid: 125000, surplusCreditCentavos: 0, notes: 'Stage 3 Task 3.4-101 step b — water Q1 2026 currentCharge restoration; assessed value 125000 matches existing basePaid; no surplus.' },
    b2: { billDocId: '2026-Q2', newCurrentChargeCentavos: 115000, expectedExistingBasePaid: 140000, surplusCreditCentavos: 25000, notes: 'Stage 3 Task 3.4-101 step b2 — water Q2 2026 currentCharge restoration; over-payment $250.00 surplus to credit.' }
  },
  '102': {
    a: {
      txId: '2026-04-30_204438_638',
      moveFromTargetId: 'Q4_2026',
      moveToTargetId: 'Q3_2026',
      moveAmountCentavos: 264656, // $2,646.56 entire allocation
      moveFromMonthIndex: 9,
      moveToMonthIndex: 8,
      expectedAllocationAmount: 264656
    },
    b: { billDocId: '2026-Q1', newCurrentChargeCentavos: 105000, expectedExistingBasePaid: 95000, surplusCreditCentavos: 0, surplusSource: 'waterBills', notes: 'Stage 3 Task 3.4-102 step b — water Q1 2026 currentCharge restoration; assessed 105000 > existing basePaid 95000; under-paid by $100 (this $100 becomes a real water-Q1 remaining base after restoration).' },
    b2: { billDocId: '2026-Q2', newCurrentChargeCentavos: 220000, expectedExistingBasePaid: 220000, surplusCreditCentavos: 0, surplusSource: 'waterBills', notes: 'Stage 3 Task 3.4-102 step b2 — water Q2 2026 currentCharge restoration; assessed value 220000 matches existing basePaid; no surplus.' },
    // Pass 2: source changed from 'waterBills' to 'correction' per Manager adjudication.
    // 'correction' is in standalonesSources (statementDataService.js:2214) — entries absorb into SoA chronological,
    // dropping SoA by the credit amount alongside UPC net. This avoids the Pass 1 compensation pair on unit 102.
    c: { billDocId: '2026-Q1', newPenaltyPaidCentavos: 1527, expectedExistingPenaltyPaid: 25100, refundCentavos: 23573, refundSource: 'correction', notes: 'Stage 3 Task 3.4-102 step c (Pass 2) — water Q1 2026 over-paid penalty reconciliation; penaltyPaid reduced from 25100 to 1527 centavos to match assessed penaltyAmount; refund $235.73 to creditBalance via source=correction (Pass 2 change from waterBills) so SoA chronological absorbs the entry symmetrically with UPC net.' }
  },
  '105': {
    b: { billDocId: '2026-Q1', newCurrentChargeCentavos: 45000, expectedExistingBasePaid: 115000, surplusCreditCentavos: 70000, notes: 'Stage 3 Task 3.4-105 step b — water Q1 2026 currentCharge restoration; over-payment $700.00 surplus to credit.' }
  },
  '201': {
    b: { billDocId: '2026-Q1', newCurrentChargeCentavos: 5000, expectedExistingBasePaid: 5000, surplusCreditCentavos: 0, notes: 'Stage 3 Task 3.4-201 step b — water Q1 2026 currentCharge restoration; assessed 5000 matches existing basePaid; no surplus.' }
  },
  '203': {
    a: {
      txId: '2026-04-30_204456_628',
      moveFromTargetId: 'Q4_2026',
      moveToTargetId: 'Q3_2026',
      moveAmountCentavos: 157500, // $1,575.00 entire allocation
      moveFromMonthIndex: 9,
      moveToMonthIndex: 8,
      expectedAllocationAmount: 157500
    },
    b: { billDocId: '2026-Q1', newCurrentChargeCentavos: 520000, expectedExistingBasePaid: 546378, surplusCreditCentavos: 26378, notes: 'Stage 3 Task 3.4-203 step b — water Q1 2026 currentCharge restoration; over-payment $263.78 surplus to credit.' },
    c: { billDocId: '2026-Q1', newPenaltyPaidCentavos: 18886, expectedExistingPenaltyPaid: 29042, refundCentavos: 10156, notes: 'Stage 3 Task 3.4-203 step c — water Q1 2026 over-paid penalty reconciliation; penaltyPaid reduced from 29042 to 18886 centavos to match assessed penaltyAmount; refund $101.56 to creditBalance.' }
  },
  '204': {
    b: { billDocId: '2026-Q1', newCurrentChargeCentavos: 20000, expectedExistingBasePaid: 25000, surplusCreditCentavos: 5000, notes: 'Stage 3 Task 3.4-204 step b — water Q1 2026 currentCharge restoration; over-payment $50.00 surplus to credit.' },
    c: { billDocId: '2026-Q2', newPenaltyPaidCentavos: 0, expectedExistingPenaltyPaid: 1250, refundCentavos: 1250, notes: 'Stage 3 Task 3.4-204 step c — water Q2 2026 penalty over-pay reconciliation; penaltyAmount was 0 but penaltyPaid was 1250; refund $12.50 to creditBalance.' }
  }
};

// Step a-prime, d, e, f are sized at runtime (measured or fixed-per-task-prompt)
// a-prime: measured side-effect after step a (admin source)
// d: pre-step-a Q4 penalty value (hoaDues source) — measured at apply-time
// e: measured residual (reconciliation source)
// f: 99c (admin source) when needed

const RUNTIME_STEP_NOTES = {
  'a-prime': (unitId) => `Stage 3 Task 3.4-${unitId} step a' — Step a priority reallocation raised the unit's Q4 unpaid base, which triggered PenaltyRecalculationService to recompute Q4 penalty against the larger base. The increase is absorbed via admin-sourced credit so the SoA pre-payment amount matches the bill amount the owner was sent modulo the cent rounding via step f. (Same shape as Task 3.2b's step a' for unit 106.)`,
  'd': (unitId) => `Stage 3 Task 3.4-${unitId} step d — Q4 2026 HOA penalty waiver at original assessed value (pre-step-a; the +increase triggered by step a's priority reallocation is absorbed separately by step a' as admin adjustment per Task 3.2b's resolved framing). Waiving the original assessed value preserves the dual-projection contract integrity.`,
  'e': (unitId) => `Stage 3 Task 3.4-${unitId} step e — measured residual reconciliation after a, a', b, (b2,) (c,) (d,). Per architecture doc § "Handling Discrepancies", explicit adjustment entry to close the residual SoA/UPC variance to a clean closing-payment number.`,
  'f': (unitId) => `Stage 3 Task 3.4-${unitId} step f — closing-payment cent rounding so SoA amountDue and UPC payoff land on the per-unit gate target rounded to nearest peso.`
};

const cfg = UNIT_CONFIGS[UNIT_ID] || {};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function randomSuffix(len = 9) {
  return Math.random().toString(36).slice(2, 2 + len);
}

async function writeReport(stepKey, summary) {
  const OUT_PATH = path.join(REPO_ROOT, `test-results/unit${UNIT_ID}-task-3-4-step-${stepKey}-${APPLY ? 'apply' : 'dry'}.json`);
  await fs.writeFile(OUT_PATH, JSON.stringify(summary, null, 2), 'utf8');
  console.error(`[${UNIT_ID}/${stepKey}] wrote ${APPLY ? 'apply' : 'dry'} report → ${OUT_PATH}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Step implementations
// ─────────────────────────────────────────────────────────────────────────────

async function stepA(db) {
  const cfgA = cfg.a;
  if (!cfgA) throw new Error(`Unit ${UNIT_ID} has no step-a configuration`);

  const txRef = db.collection('clients').doc(CLIENT_ID).collection('transactions').doc(cfgA.txId);
  const duesRef = db.collection('clients').doc(CLIENT_ID).collection('units').doc(UNIT_ID).collection('dues').doc('2026');
  const txSnap = await txRef.get();
  const duesSnap = await duesRef.get();
  if (!txSnap.exists) throw new Error(`Transaction ${cfgA.txId} not found`);
  if (!duesSnap.exists) throw new Error(`Dues doc not found for unit ${UNIT_ID}`);

  const txPre = txSnap.data();
  const duesPre = duesSnap.data();
  const allocs = Array.isArray(txPre.allocations) ? txPre.allocations : [];
  const hoaAlloc = allocs.find((a) => a?.type === 'hoa_month' && a?.targetId === cfgA.moveFromTargetId);
  if (!hoaAlloc) throw new Error(`Pre-state: expected hoa_month allocation to ${cfgA.moveFromTargetId} on tx ${cfgA.txId} not found`);
  if (hoaAlloc.amount !== cfgA.expectedAllocationAmount) {
    throw new Error(`Pre-state: expected allocation amount ${cfgA.expectedAllocationAmount}c, got ${hoaAlloc.amount}c`);
  }

  const payments = Array.isArray(duesPre.payments) ? duesPre.payments : [];
  const mFromPre = payments[cfgA.moveFromMonthIndex] || {};
  const mToPre = payments[cfgA.moveToMonthIndex] || {};

  // Construct post-state allocations
  const newAllocs = allocs.map((a) => ({ ...a }));
  const idx = newAllocs.findIndex((a) => a?.type === 'hoa_month' && a?.targetId === cfgA.moveFromTargetId);
  const original = newAllocs[idx];
  const remainingAmt = original.amount - cfgA.moveAmountCentavos;
  if (remainingAmt < 0) throw new Error(`Move amount ${cfgA.moveAmountCentavos} exceeds original allocation ${original.amount}`);
  // Map fiscal-quarter→data.quarter (0-indexed: Q3==2, Q4==3) and fiscal-month index
  const moveToQuarterIdx = cfgA.moveToTargetId === 'Q3_2026' ? 2 : 3;
  const moveFromQuarterIdx = cfgA.moveFromTargetId === 'Q4_2026' ? 3 : 2;
  const toAlloc = { ...original, amount: cfgA.moveAmountCentavos, targetId: cfgA.moveToTargetId, data: { ...(original.data||{}), quarter: moveToQuarterIdx, month: cfgA.moveToMonthIndex } };
  if (remainingAmt > 0) {
    const remainAlloc = { ...original, amount: remainingAmt, targetId: cfgA.moveFromTargetId, data: { ...(original.data||{}), quarter: moveFromQuarterIdx, month: cfgA.moveFromMonthIndex } };
    newAllocs.splice(idx, 1, toAlloc, remainAlloc);
  } else {
    newAllocs.splice(idx, 1, toAlloc);
  }

  // Construct post-state payments
  const newPayments = payments.map((p) => p ? { ...p } : p);
  const mTo = { ...(newPayments[cfgA.moveToMonthIndex] || {}) };
  const mFrom = { ...(newPayments[cfgA.moveFromMonthIndex] || {}) };
  const mToBasePost = (mTo.basePaid || 0) + cfgA.moveAmountCentavos;
  const mToPenPost = mTo.penaltyPaid || 0;
  mTo.basePaid = mToBasePost;
  mTo.amount = mToBasePost + mToPenPost;
  newPayments[cfgA.moveToMonthIndex] = mTo;
  const mFromBasePost = (mFrom.basePaid || 0) - cfgA.moveAmountCentavos;
  const mFromPenPost = mFrom.penaltyPaid || 0;
  mFrom.basePaid = mFromBasePost;
  mFrom.amount = mFromBasePost + mFromPenPost;
  newPayments[cfgA.moveFromMonthIndex] = mFrom;

  const summary = {
    unit: UNIT_ID, step: 'a', mode: APPLY ? 'APPLY' : 'DRY', capturedAt: getNow().toISOString(),
    pre: { tx_allocations: allocs, mFrom: mFromPre, mTo: mToPre },
    post: { tx_allocations: newAllocs, mFrom, mTo },
    deltas: { moveAmountCentavos: cfgA.moveAmountCentavos, moveFromMonthIndex: cfgA.moveFromMonthIndex, moveToMonthIndex: cfgA.moveToMonthIndex }
  };

  if (APPLY) {
    const batch = db.batch();
    batch.update(txRef, { allocations: newAllocs });
    batch.update(duesRef, { payments: newPayments });
    await batch.commit();
    summary.applyResult = { committed: true };
    console.error(`[${UNIT_ID}/a] APPLY committed (batched).`);
  } else {
    console.error(`[${UNIT_ID}/a] DRY — no writes performed.`);
  }
  await writeReport('a', summary);
}

async function stepB(billDocIdKey, stepKey) {
  // stepKey is 'b' or 'b2'; billDocIdKey selects cfg.b or cfg.b2
  const cfgB = cfg[billDocIdKey];
  if (!cfgB) throw new Error(`Unit ${UNIT_ID} has no step-${stepKey} configuration`);
  const { billDocId, newCurrentChargeCentavos, expectedExistingBasePaid, surplusCreditCentavos, notes } = cfgB;

  // Pre-flight: validate pre-state
  const db = await getDb();
  const billRef = db.collection('clients').doc(CLIENT_ID).collection('projects').doc('waterBills').collection('bills').doc(billDocId);
  const billDoc = await billRef.get();
  if (!billDoc.exists) throw new Error(`Bill ${billDocId} not found`);
  const ub = billDoc.data()?.bills?.units?.[UNIT_ID] || {};
  if (Number(ub.currentCharge || 0) !== 0) {
    throw new Error(`Pre-state: ${billDocId} currentCharge expected 0 (drifted), got ${ub.currentCharge}`);
  }
  if (Number(ub.basePaid || 0) !== expectedExistingBasePaid) {
    throw new Error(`Pre-state: ${billDocId} basePaid expected ${expectedExistingBasePaid}, got ${ub.basePaid}`);
  }

  const willForce = newCurrentChargeCentavos < expectedExistingBasePaid;
  const summary = {
    unit: UNIT_ID, step: stepKey, mode: APPLY ? 'APPLY' : 'DRY', capturedAt: getNow().toISOString(),
    billDocId, newCurrentChargeCentavos, expectedExistingBasePaid, willForce,
    surplusCreditCentavos, source: 'waterBills', notes
  };

  const surplusSource = cfgB.surplusSource || 'waterBills';
  if (APPLY) {
    // 1. Write currentCharge via canonical service path
    const res = await waterBillsService.setUnitCurrentCharge(
      CLIENT_ID, billDocId, UNIT_ID, newCurrentChargeCentavos, { force: willForce }
    );
    summary.setUnitCurrentChargeResult = res;
    // 2. Issue surplus to credit (if any) via canonical creditService
    if (surplusCreditCentavos > 0) {
      const txnId = `task3-4-${UNIT_ID}-step-${stepKey}-${Date.now()}-${randomSuffix(4)}`;
      const cr = await creditService.updateCreditBalance(
        CLIENT_ID, UNIT_ID, surplusCreditCentavos, txnId, notes, surplusSource
      );
      summary.updateCreditBalanceResult = cr;
    }
    console.error(`[${UNIT_ID}/${stepKey}] APPLY: currentCharge -> ${newCurrentChargeCentavos}c${willForce ? ' (forced)' : ''}; credit +${surplusCreditCentavos}c (source=${surplusSource})`);
  } else {
    console.error(`[${UNIT_ID}/${stepKey}] DRY: would set currentCharge=${newCurrentChargeCentavos}c (force=${willForce}); credit +${surplusCreditCentavos}c (source=${surplusSource})`);
  }
  await writeReport(stepKey, summary);
}

async function stepC() {
  const cfgC = cfg.c;
  if (!cfgC) throw new Error(`Unit ${UNIT_ID} has no step-c configuration`);
  const { billDocId, newPenaltyPaidCentavos, expectedExistingPenaltyPaid, refundCentavos, notes } = cfgC;

  const db = await getDb();
  const billRef = db.collection('clients').doc(CLIENT_ID).collection('projects').doc('waterBills').collection('bills').doc(billDocId);
  const billDoc = await billRef.get();
  if (!billDoc.exists) throw new Error(`Bill ${billDocId} not found`);
  const ub = billDoc.data()?.bills?.units?.[UNIT_ID] || {};
  if (Number(ub.penaltyPaid || 0) !== expectedExistingPenaltyPaid) {
    throw new Error(`Pre-state: ${billDocId} penaltyPaid expected ${expectedExistingPenaltyPaid}, got ${ub.penaltyPaid}`);
  }

  const summary = {
    unit: UNIT_ID, step: 'c', mode: APPLY ? 'APPLY' : 'DRY', capturedAt: getNow().toISOString(),
    billDocId, fromPenaltyPaid: expectedExistingPenaltyPaid, toPenaltyPaid: newPenaltyPaidCentavos,
    refundCentavos, source: 'waterBills', notes
  };

  const refundSource = cfgC.refundSource || 'waterBills';
  if (APPLY) {
    // Penalty-paid write: no canonical service guard exists for this field; direct Firestore write is acceptable.
    await billRef.update({
      [`bills.units.${UNIT_ID}.penaltyPaid`]: newPenaltyPaidCentavos
    });
    summary.penaltyPaidWrite = { committed: true };
    // Refund surplus to credit
    if (refundCentavos > 0) {
      const txnId = `task3-4-${UNIT_ID}-step-c-${Date.now()}-${randomSuffix(4)}`;
      const cr = await creditService.updateCreditBalance(
        CLIENT_ID, UNIT_ID, refundCentavos, txnId, notes, refundSource
      );
      summary.updateCreditBalanceResult = cr;
    }
    console.error(`[${UNIT_ID}/c] APPLY: ${billDocId}.penaltyPaid ${expectedExistingPenaltyPaid}c -> ${newPenaltyPaidCentavos}c; credit +${refundCentavos}c (source=${refundSource})`);
  } else {
    console.error(`[${UNIT_ID}/c] DRY: would set ${billDocId}.penaltyPaid=${newPenaltyPaidCentavos}c; refund +${refundCentavos}c to credit (source=${refundSource})`);
  }
  await writeReport('c', summary);
}

async function creditOnlyStep(stepKey, source, amountCentavos, notesFn) {
  const notes = notesFn(UNIT_ID);
  const summary = {
    unit: UNIT_ID, step: stepKey, mode: APPLY ? 'APPLY' : 'DRY', capturedAt: getNow().toISOString(),
    source, amountCentavos, notes
  };

  if (APPLY) {
    const txnId = `task3-4-${UNIT_ID}-step-${stepKey}-${Date.now()}-${randomSuffix(4)}`;
    const cr = await creditService.updateCreditBalance(
      CLIENT_ID, UNIT_ID, amountCentavos, txnId, notes, source
    );
    summary.updateCreditBalanceResult = cr;
    console.error(`[${UNIT_ID}/${stepKey}] APPLY: credit +${amountCentavos}c (source=${source})`);
  } else {
    console.error(`[${UNIT_ID}/${stepKey}] DRY: would credit +${amountCentavos}c (source=${source})`);
  }
  await writeReport(stepKey, summary);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.error(`[unit ${UNIT_ID} step ${STEP}] mode = ${APPLY ? 'APPLY' : 'DRY'}`);
  const db = await getDb();

  switch (STEP) {
    case 'a':
      await stepA(db);
      break;
    case 'a-prime':
      if (!Number.isFinite(RESIDUAL_CENTAVOS) || RESIDUAL_CENTAVOS <= 0) {
        throw new Error('Step a-prime requires --residual-centavos <positive integer> (measured side effect from step a)');
      }
      await creditOnlyStep('a-prime', 'admin', RESIDUAL_CENTAVOS, RUNTIME_STEP_NOTES['a-prime']);
      break;
    case 'b':
      await stepB('b', 'b');
      break;
    case 'b2':
      await stepB('b2', 'b2');
      break;
    case 'c':
      await stepC();
      break;
    case 'd': {
      if (!Number.isFinite(RESIDUAL_CENTAVOS) || RESIDUAL_CENTAVOS <= 0) {
        throw new Error('Step d requires --residual-centavos <positive integer> (Q4 unposted-penalty value pre-step-a)');
      }
      // Pass 2 source override: unit 102 uses 'correction' (admin-class; absorbs into SoA chronological)
      // instead of 'hoaDues' (non-admin) per Manager adjudication, to avoid the Pass 1 compensation pair.
      const dSource = UNIT_ID === '102' ? 'correction' : 'hoaDues';
      await creditOnlyStep('d', dSource, RESIDUAL_CENTAVOS, RUNTIME_STEP_NOTES['d']);
      break;
    }
    case 'e':
      if (!Number.isFinite(RESIDUAL_CENTAVOS)) {
        throw new Error('Step e requires --residual-centavos <integer> (measured residual after a, a-prime, b, c, d)');
      }
      if (RESIDUAL_CENTAVOS === 0) {
        console.error('[step e] warning: residual is 0; this is a valid no-op only if the harness measurement showed zero residual.');
        console.error('[step e] no-op; skipping write.');
        await writeReport('e', { unit: UNIT_ID, step: 'e', mode: APPLY ? 'APPLY' : 'DRY', capturedAt: getNow().toISOString(), source: 'reconciliation', amountCentavos: 0, skipped: true });
        return;
      }
      await creditOnlyStep('e', 'reconciliation', RESIDUAL_CENTAVOS, RUNTIME_STEP_NOTES['e']);
      break;
    case 'f':
      // f is always 99c admin credit
      await creditOnlyStep('f', 'admin', 99, RUNTIME_STEP_NOTES['f']);
      break;
    default:
      throw new Error(`Unknown --step: ${STEP}`);
  }
}

main().catch((err) => {
  console.error(`[unit ${UNIT_ID} step ${STEP}] FATAL:`, err && err.stack || err);
  process.exit(2);
});

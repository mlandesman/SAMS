#!/usr/bin/env node
/**
 * unit106OptionPSteps.js
 *
 * Stage 3 / Task 3.2b — Option P continuation steps after step a.
 *
 * Executes one of: a-prime, b, c, d, e, f (one --step per invocation).
 *
 * Each step performs:
 *   - A credit-balance write (appends one entry to
 *     `clients/AVII/units/creditBalances.106.history[]`, updates `.106.creditBalance`,
 *     updates `.106.lastChange`).
 *   - For step b: additionally updates `clients/AVII/projects/waterBills/bills/2026-Q1.bills.units.106.currentCharge` from 0 → 165000 centavos.
 *   - For step c: additionally updates `clients/AVII/projects/waterBills/bills/2026-Q2.bills.units.106.penaltyPaid` from 33889 → 22038 centavos.
 *
 * Usage:
 *   node backend/scripts/unit106OptionPSteps.js --step a-prime --dry-mode
 *   node backend/scripts/unit106OptionPSteps.js --step a-prime --apply
 *   node backend/scripts/unit106OptionPSteps.js --step b --apply
 *   node backend/scripts/unit106OptionPSteps.js --step e --residual-centavos 1531 --apply
 */

import fs from 'fs/promises';
import path from 'path';
import { getNow } from '../../shared/services/DateService.js';
import { getProdAwareDb, confirmProd } from './lib/prodAwareDb.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '106';
const FISCAL_YEAR = 2026;
const REPO_ROOT = '/Users/michael/Projects/SAMS';

const args = process.argv.slice(2);
function getArg(flag, fallback = null) {
  const i = args.indexOf(flag);
  return (i === -1 || i + 1 >= args.length) ? fallback : args[i + 1];
}
const STEP = getArg('--step', null);
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry-mode') || !APPLY;
const IS_PROD = args.includes('--prod');
const RESIDUAL_CENTAVOS = Number(getArg('--residual-centavos', 0));

if (!STEP) {
  console.error('Missing --step (one of: a-prime, b, c, d, e, f)');
  process.exit(2);
}
if (APPLY && DRY) {
  console.error('Cannot pass both --dry-mode and --apply');
  process.exit(2);
}

// Step definitions (centavos)
const STEPS = {
  'a-prime': {
    label: "a' — Step a side-effect absorption",
    amountCentavos: 21347, // $213.47
    source: 'admin',
    type: 'step_a_side_effect_adjustment',
    notes: "Stage 3 Task 3.2b step a' — Step a (Q3.3/Q4 priority reallocation) raised Q4 unpaid base from $26,182.25 to $30,451.55, which triggered PenaltyRecalculationService to recompute Q4 penalty $1,309.11 -> $1,522.58. The $213.47 increase is absorbed via admin-sourced credit so the SoA pre-payment amount matches the bill amount the owner was sent ($30,177.99) modulo the 99c rounding via step f.",
    extraWrite: null
  },
  'b': {
    label: 'b — water:2026-Q1 over-payment to credit',
    amountCentavos: 13974, // $139.74
    source: 'waterBills',
    type: 'credit_added',
    notes: 'Stage 3 Task 3.2b step b — water Q1 2026 over-payment reconciliation; water:2026-Q1.currentCharge restored from 0 to 165000 centavos to remove the impossible-state shape (basePaid > 0 with currentCharge = 0). The $139.74 over-payment becomes credit balance for the unit and will be consumed by step g closing payment.',
    extraWrite: {
      kind: 'waterBillCurrentCharge',
      billDocId: '2026-Q1',
      fromCentavos: 0,
      toCentavos: 165000
    }
  },
  'c': {
    label: 'c — water:2026-Q2 over-paid penalty refund to credit',
    amountCentavos: 11851, // $118.51
    source: 'waterBills',
    type: 'credit_added',
    notes: 'Stage 3 Task 3.2b step c — water Q2 2026 over-paid penalty reconciliation; water:2026-Q2.penaltyPaid reduced from 33889 to 22038 centavos to match the assessed penaltyAmount. The $118.51 over-payment becomes credit balance for the unit and will be consumed by step g closing payment.',
    extraWrite: {
      kind: 'waterBillPenaltyPaid',
      billDocId: '2026-Q2',
      fromCentavos: 33889,
      toCentavos: 22038
    }
  },
  'd': {
    label: 'd — Q4 unposted-penalty waiver (at original $1,309.11)',
    amountCentavos: 130911, // $1,309.11 — NOT $1,522.58 per Manager adjudication
    source: 'hoaDues',
    type: 'penalty_waiver',
    notes: 'Stage 3 Task 3.2b step d — Q4 2026 HOA penalty waiver at original assessed value $1,309.11 (the value at bill-generation time). The +$213.47 inflation triggered by step a\'s priority reallocation is absorbed separately by step a\' as admin adjustment. Waiving the original assessed value preserves the dual-projection contract integrity: SoA\'s synthesized Q4 penalty row reflects the historical assessment; UPC\'s bill-state penalty is offset by this credit-balance entry.',
    extraWrite: null
  },
  'e': {
    label: 'e — residual reconciliation (measured)',
    amountCentavos: RESIDUAL_CENTAVOS,
    source: 'reconciliation',
    type: 'reconciliation_adjustment',
    notes: 'Stage 3 Task 3.2b step e — Stage 3 Task 3.1 forensic reconciliation residual measured after steps a, a\', b, c, d. Per architecture doc § "Handling Discrepancies", explicit adjustment entry to close the residual SoA/UPC variance to a clean closing-payment number.',
    extraWrite: null
  },
  'f': {
    label: 'f — closing-payment 99c rounding',
    amountCentavos: 99, // $0.99
    source: 'admin',
    type: 'credit_added',
    notes: 'Stage 3 Task 3.2b step f — closing-payment cent rounding so SoA amountDue and UPC payoff land on exactly $30,177.00.',
    extraWrite: null
  }
};

const stepDef = STEPS[STEP];
if (!stepDef) {
  console.error(`Unknown --step value: ${STEP}. Valid: a-prime, b, c, d, e, f`);
  process.exit(2);
}
if (STEP === 'e' && !Number.isFinite(RESIDUAL_CENTAVOS)) {
  console.error('Step e requires --residual-centavos <integer>');
  process.exit(2);
}
if (STEP === 'e' && RESIDUAL_CENTAVOS === 0) {
  console.error("[step e] warning: --residual-centavos is 0; this is a valid no-op only if the harness measurement showed zero residual.");
}

const OUT_PATH = path.join(
  REPO_ROOT,
  `test-results/unit106-option-p-step-${STEP}-${IS_PROD ? 'prod-' : ''}${APPLY ? 'apply' : 'dry'}.json`
);

function randomSuffix(len = 9) {
  return Math.random().toString(36).slice(2, 2 + len);
}

async function main() {
  console.error(`[${STEP}] mode = ${APPLY ? 'APPLY' : 'DRY'}${IS_PROD ? ' [PROD]' : ''}; amount = ${stepDef.amountCentavos}c; source = ${stepDef.source}; type = ${stepDef.type}`);

  const { db, env, projectId } = await getProdAwareDb({ isProd: IS_PROD });
  console.error(`[${STEP}] env=${env} projectId=${projectId}`);

  // For --prod --apply, require an explicit confirmation phrase.
  if (IS_PROD && APPLY) {
    const ok = await confirmProd(`APPLY-TO-PROD-UNIT-106-STEP-${STEP.toUpperCase()}`);
    if (!ok) {
      console.error(`[${STEP}] Prod confirmation failed — aborting.`);
      process.exit(3);
    }
  }

  // Read pre-state from creditBalances doc
  const creditDocRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances');
  const creditSnap = await creditDocRef.get();
  if (!creditSnap.exists) throw new Error(`creditBalances doc not found for ${CLIENT_ID}`);
  const creditData = creditSnap.data() || {};
  const unitCreditPre = creditData[UNIT_ID] || { history: [], creditBalance: 0 };
  const priorBalanceCentavos = Number(unitCreditPre.creditBalance || 0);
  const newBalanceCentavos = priorBalanceCentavos + stepDef.amountCentavos;
  const priorHistoryLength = Array.isArray(unitCreditPre.history) ? unitCreditPre.history.length : 0;

  // For step b: read water:2026-Q1 unit106 pre-state
  let waterPreState = null;
  let waterDocRef = null;
  let waterUpdatePath = null;
  let waterUpdateValue = null;
  if (stepDef.extraWrite) {
    waterDocRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(stepDef.extraWrite.billDocId);
    const waterSnap = await waterDocRef.get();
    if (!waterSnap.exists) throw new Error(`Water bill doc ${stepDef.extraWrite.billDocId} not found`);
    const waterData = waterSnap.data() || {};
    const unitBill = waterData?.bills?.units?.[UNIT_ID] || {};
    waterPreState = { ...unitBill };
    if (stepDef.extraWrite.kind === 'waterBillCurrentCharge') {
      if (Number(unitBill.currentCharge || 0) !== stepDef.extraWrite.fromCentavos) {
        throw new Error(`Pre-state mismatch: water:${stepDef.extraWrite.billDocId} currentCharge expected ${stepDef.extraWrite.fromCentavos}, got ${unitBill.currentCharge}`);
      }
      waterUpdatePath = `bills.units.${UNIT_ID}.currentCharge`;
      waterUpdateValue = stepDef.extraWrite.toCentavos;
    } else if (stepDef.extraWrite.kind === 'waterBillPenaltyPaid') {
      if (Number(unitBill.penaltyPaid || 0) !== stepDef.extraWrite.fromCentavos) {
        throw new Error(`Pre-state mismatch: water:${stepDef.extraWrite.billDocId} penaltyPaid expected ${stepDef.extraWrite.fromCentavos}, got ${unitBill.penaltyPaid}`);
      }
      waterUpdatePath = `bills.units.${UNIT_ID}.penaltyPaid`;
      waterUpdateValue = stepDef.extraWrite.toCentavos;
    }
  }

  // Construct the new credit-history entry
  const now = getNow();
  const newEntry = {
    id: `credit_${now.getTime()}_${randomSuffix()}`,
    amount: stepDef.amountCentavos,
    transactionId: null,
    notes: stepDef.notes,
    type: stepDef.type,
    timestamp: now.toISOString(),
    source: stepDef.source
  };

  const newHistory = [...(Array.isArray(unitCreditPre.history) ? unitCreditPre.history : []), newEntry];
  const unitCreditPost = {
    ...unitCreditPre,
    history: newHistory,
    creditBalance: newBalanceCentavos,
    lastChange: {
      year: String(FISCAL_YEAR),
      historyIndex: newHistory.length - 1,
      timestamp: now.toISOString()
    }
  };

  const summary = {
    step: STEP,
    mode: APPLY ? 'APPLY' : 'DRY',
    capturedAt: now.toISOString(),
    creditDocPath: `clients/${CLIENT_ID}/units/creditBalances`,
    creditBalance: {
      pre_centavos: priorBalanceCentavos,
      post_centavos: newBalanceCentavos,
      delta_centavos: stepDef.amountCentavos
    },
    historyEntry: newEntry,
    historyIndexPre: priorHistoryLength,
    historyIndexPost: newHistory.length - 1,
    extraWrite: stepDef.extraWrite ? {
      kind: stepDef.extraWrite.kind,
      docPath: `clients/${CLIENT_ID}/projects/waterBills/bills/${stepDef.extraWrite.billDocId}`,
      fieldPath: waterUpdatePath,
      pre: waterPreState,
      preValue: stepDef.extraWrite.fromCentavos,
      postValue: waterUpdateValue
    } : null
  };

  if (APPLY) {
    const batch = db.batch();
    batch.update(creditDocRef, {
      [`${UNIT_ID}`]: unitCreditPost
    });
    if (stepDef.extraWrite) {
      batch.update(waterDocRef, {
        [waterUpdatePath]: waterUpdateValue
      });
    }
    await batch.commit();
    summary.applyResult = { committed: true };
    console.error(`[${STEP}] APPLY committed (batched).`);
  } else {
    console.error(`[${STEP}] DRY — no writes performed.`);
  }

  await fs.writeFile(OUT_PATH, JSON.stringify(summary, null, 2), 'utf8');
  console.error(`[${STEP}] wrote ${APPLY ? 'apply' : 'dry'} report → ${OUT_PATH}`);
  console.error(`[${STEP}] credit balance ${priorBalanceCentavos / 100} -> ${newBalanceCentavos / 100} (Δ ${stepDef.amountCentavos / 100})`);
}

main().catch((err) => {
  console.error(`[${STEP}] FATAL:`, err && err.stack || err);
  process.exit(2);
});

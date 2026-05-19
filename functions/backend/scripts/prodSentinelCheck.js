#!/usr/bin/env node
/**
 * prodSentinelCheck.js
 *
 * Stage 3 / Task 3.5 Phase 5 + Task 3.2c — Production sentinel pre-flight.
 *
 * Verifies Prod is in the expected pre-Stage-3 state before any Production-replay.
 * READ-ONLY (ZERO Prod writes).
 *
 * Assertions:
 *   a1 — unit 106 dues payments[8].basePaid === 775101 (pre-Option-P)
 *   a2 — unit 106 credit balance (history-derived) === 0
 *   a3 — all 9 non-106 units: water:2026-Q1 currentCharge=0 with basePaid>0
 *   a4 — unit 102 pre-step-a dues mirror (step-a sentinel values from Pass 2)
 *   a5 — unit 203 pre-step-a dues mirror
 *   a6 — units 102/203 Q3-Q4 ordering violation present (pre-Stage-3 shape)
 *
 * Usage:
 *   export SAMS_PROD_OK=yes
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/prodSentinelCheck.js --prod
 */

import fs from 'fs/promises';
import path from 'path';
import { getProdAwareDb } from './lib/prodAwareDb.js';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';
import { getNow } from '../../shared/services/DateService.js';

const REPO_ROOT = '/Users/michael/Projects/SAMS';
const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;

const args = process.argv.slice(2);
const IS_PROD = args.includes('--prod');
const dateTag = '2026-05-19';
const OUT_PATH = path.join(
  REPO_ROOT,
  `test-results/${IS_PROD ? 'prod' : 'dev'}-sentinel-pre-flight-${dateTag}.json`
);

// Pre-step-a dues mirror sentinels (from Pass 2 apply logs on freshly-restored Dev = Prod shape)
const STEP_A_UNITS = {
  '102': {
    moveToMonthIndex: 8,
    moveFromMonthIndex: 9,
    mToBasePaidExpected: 441019,
    mFromBasePaidExpected: 264656,
    mToStatusExpected: 'paid', // month fully paid at m8 but quarter-level ordering still violated
    mFromStatusExpected: 'partial',
    scheduledAmount: 518846
  },
  '203': {
    moveToMonthIndex: 8,
    moveFromMonthIndex: 9,
    mToBasePaidExpected: 619470,
    mFromBasePaidExpected: 157500,
    mToStatusExpected: 'paid',
    mFromStatusExpected: 'partial',
    scheduledAmount: 619470
  }
};

async function readDuesMonth(db, unitId, monthIndex) {
  const snap = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc(unitId)
    .collection('dues').doc(String(FISCAL_YEAR))
    .get();
  if (!snap.exists) return { exists: false };
  const data = snap.data();
  const p = data?.payments?.[monthIndex] || null;
  return {
    exists: true,
    scheduledAmount: Number(data.scheduledAmount || 0),
    payment: p
  };
}

async function main() {
  const { db, env, projectId } = await getProdAwareDb({ isProd: IS_PROD });
  console.error(`[sentinel] env=${env} projectId=${projectId}`);

  const results = {
    metadata: { env, projectId, generatedAt: getNow().toISOString(), isProd: IS_PROD },
    assertions: [],
    allPass: true
  };

  // a1: unit 106 dues payments[8].basePaid === 775101
  const dues106 = await readDuesMonth(db, '106', 8);
  const m106BasePaid = dues106.payment?.basePaid;
  results.assertions.push({
    id: 'a1_unit106_m9_basePaid',
    expected: 775101,
    actual: m106BasePaid,
    pass: m106BasePaid === 775101,
    description: 'Unit 106 dues payments[8].basePaid (Q3.3) must equal pre-Option-P 775101c.'
  });

  // a2: unit 106 credit balance === 0
  const creditSnap = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances').get();
  const creditAll = creditSnap.exists ? creditSnap.data() : {};
  const unit106Balance = getCreditBalance(creditAll?.['106'] || { history: [] });
  results.assertions.push({
    id: 'a2_unit106_creditBalance',
    expected: 0,
    actual: unit106Balance,
    pass: unit106Balance === 0,
    description: 'Unit 106 credit balance derived from history must be 0.'
  });

  // a3: non-106 water Q1 drift
  const waterSnap = await db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('2026-Q1').get();
  const waterQ1 = waterSnap.exists ? waterSnap.data() : null;
  const non106Units = ['101', '102', '103', '104', '105', '201', '202', '203', '204'];
  const a3 = {
    id: 'a3_non106_water_q1_drift',
    expected: 'all 9 with currentCharge=0 AND basePaid>0',
    perUnit: [],
    pass: true
  };
  for (const u of non106Units) {
    const ub = waterQ1?.bills?.units?.[u] || {};
    const cc = Number(ub.currentCharge || 0);
    const bp = Number(ub.basePaid || 0);
    const okPerUnit = cc === 0 && bp > 0;
    if (!okPerUnit) a3.pass = false;
    a3.perUnit.push({ unit: u, currentCharge: cc, basePaid: bp, pass: okPerUnit });
  }
  results.assertions.push(a3);

  // a4/a5/a6: units 102 and 203 pre-step-a dues + ordering
  for (const [unitId, cfg] of Object.entries(STEP_A_UNITS)) {
    const dues = await readDuesMonth(db, unitId, cfg.moveToMonthIndex);
    const mTo = dues.payment || {};
    const duesFrom = await readDuesMonth(db, unitId, cfg.moveFromMonthIndex);
    const mFrom = duesFrom.payment || {};

    const aDues = {
      id: `a4_unit${unitId}_pre_step_a_dues`,
      unitId,
      expected: {
        mToBasePaid: cfg.mToBasePaidExpected,
        mFromBasePaid: cfg.mFromBasePaidExpected,
        mToStatus: cfg.mToStatusExpected,
        mFromStatus: cfg.mFromStatusExpected
      },
      actual: {
        mToBasePaid: mTo.basePaid,
        mFromBasePaid: mFrom.basePaid,
        mToStatus: mTo.status,
        mFromStatus: mFrom.status
      },
      pass:
        mTo.basePaid === cfg.mToBasePaidExpected
        && mFrom.basePaid === cfg.mFromBasePaidExpected
        && (mTo.status === cfg.mToStatusExpected || mTo.status == null)
        && (mFrom.status === cfg.mFromStatusExpected || mFrom.status == null),
      description: `Unit ${unitId} pre-step-a dues mirror sentinel (Pass 2 pre-state).`
    };
    results.assertions.push(aDues);

    const sched = dues.scheduledAmount || cfg.scheduledAmount;
    const mToPartial = (mTo.basePaid || 0) > 0 && (mTo.basePaid || 0) < sched;
    const mFromHasPayment = (mFrom.basePaid || 0) > 0 || (mFrom.penaltyPaid || 0) > 0;
    // Unit 102: classic shape — Q3.3 month partial + Q4.1 has payment (ordering violation).
    // Unit 203: Q3.3 month is fully paid at mirror level but Q4.1 still carries the
    // mis-allocated payment (step-a moves it); sentinel checks payment presence, not partial mTo.
    const orderingPass = unitId === '102'
      ? (mToPartial && mFromHasPayment)
      : (mFromHasPayment && mTo.basePaid === cfg.mToBasePaidExpected);

    results.assertions.push({
      id: `a6_unit${unitId}_q3_q4_ordering`,
      unitId,
      expected: unitId === '102'
        ? 'Q3 month partial AND Q4 month has payment'
        : 'Q4 month has payment while Q3.3 basePaid matches pre-step-a sentinel',
      actual: { mToPartial, mFromHasPayment, scheduledAmount: sched, mToBasePaid: mTo.basePaid },
      pass: orderingPass,
      description: `Unit ${unitId} pre-Stage-3 Q3/Q4 shape for step-a correction.`
    });
  }

  results.allPass = results.assertions.every((a) => a.pass);
  await fs.writeFile(OUT_PATH, JSON.stringify(results, null, 2), 'utf8');

  console.error(`=== Sentinel-state pre-flight (${env}) ===`);
  for (const a of results.assertions) {
    console.error(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.id}`);
    if (a.id === 'a3_non106_water_q1_drift') {
      for (const pu of a.perUnit) {
        console.error(`     unit ${pu.unit}: currentCharge=${pu.currentCharge} basePaid=${pu.basePaid} -> ${pu.pass ? 'PASS' : 'FAIL'}`);
      }
    } else if (a.actual && typeof a.actual === 'object' && !Array.isArray(a.actual)) {
      console.error(`     expected: ${JSON.stringify(a.expected)}`);
      console.error(`     actual:   ${JSON.stringify(a.actual)}`);
    } else {
      console.error(`     expected: ${a.expected}, actual: ${a.actual}`);
    }
  }
  console.error('');
  console.error(`=== Overall (${env}): ${results.allPass ? 'PASS ✓ pre-Stage-3 sentinel state' : 'FAIL ✗ NOT in pre-Stage-3 state — STOP'}`);
  console.error(`Report written: ${OUT_PATH}`);
  process.exit(results.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err && err.stack || err);
  process.exit(2);
});

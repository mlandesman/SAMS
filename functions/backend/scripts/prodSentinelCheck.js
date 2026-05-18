#!/usr/bin/env node
/**
 * prodSentinelCheck.js
 *
 * Stage 3 / Task 3.5 Phase 5 — Production sentinel pre-flight.
 *
 * Analogous to `pass2SentinelCheck.js` but reads PRODUCTION via ADC. Verifies
 * that Prod is in the expected pre-Stage-3 state before any Production-replay
 * is dispatched.
 *
 *   1. Unit 106 dues mirror `payments[8].basePaid` reads `775101` centavos
 *      (pre-Option-P value).
 *   2. Unit 106 creditBalance (history-derived) reads `0`.
 *   3. All 9 non-106 units' `water:2026-Q1` has `currentCharge=0` with
 *      `basePaid > 0` (the AVII-wide water-bill drift confirmed in Task 3.3).
 *
 * Exits 0 if all assertions PASS. Exits non-zero if any FAIL.
 *
 * READ-ONLY (sentinel verification, ZERO writes against Prod).
 *
 * Usage:
 *   export SAMS_PROD_OK=yes
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/prodSentinelCheck.js --prod
 *
 *   # For Dev sanity-check (no env var needed):
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/prodSentinelCheck.js
 */

import fs from 'fs/promises';
import path from 'path';
import { getProdAwareDb } from './lib/prodAwareDb.js';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const REPO_ROOT = '/Users/michael/Projects/SAMS';

const args = process.argv.slice(2);
const IS_PROD = args.includes('--prod');
const OUT_PATH = path.join(REPO_ROOT, `test-results/${IS_PROD ? 'prod' : 'dev'}-sentinel-pre-flight-2026-05-17.json`);

async function main() {
  const { db, env, projectId } = await getProdAwareDb({ isProd: IS_PROD });
  console.error(`[sentinel] env=${env} projectId=${projectId}`);

  const results = {
    metadata: { env, projectId, generatedAt: new Date().toISOString() },
    assertions: [],
    allPass: true
  };

  // Assertion 1: unit 106 dues payments[8].basePaid === 775101 (pre-Option-P)
  const duesSnap = await db.collection('clients').doc('AVII')
    .collection('units').doc('106').collection('dues').doc('2026').get();
  const dues = duesSnap.exists ? duesSnap.data() : null;
  const m9BasePaid = dues?.payments?.[8]?.basePaid;
  results.assertions.push({
    id: 'a1_unit106_m9_basePaid',
    expected: 775101,
    actual: m9BasePaid,
    pass: m9BasePaid === 775101,
    description: 'Unit 106 dues mirror payments[8].basePaid (Q3 month 9 = Q3.3) must equal pre-Option-P value 775101c ($7,751.01). If this fails on Prod, Stage 3 may have already been partially applied to Prod.'
  });

  // Assertion 2: unit 106 creditBalance (history-derived) === 0
  const creditSnap = await db.collection('clients').doc('AVII')
    .collection('units').doc('creditBalances').get();
  const creditAll = creditSnap.exists ? creditSnap.data() : {};
  const unit106Credit = creditAll?.['106'] || { history: [] };
  const unit106Balance = getCreditBalance(unit106Credit);
  results.assertions.push({
    id: 'a2_unit106_creditBalance',
    expected: 0,
    actual: unit106Balance,
    pass: unit106Balance === 0,
    description: 'Unit 106 credit balance derived from history must be 0 (pre-Stage-3).'
  });

  // Assertion 3: all 9 non-106 units have water:2026-Q1 currentCharge=0 with basePaid>0
  const waterSnap = await db.collection('clients').doc('AVII')
    .collection('projects').doc('waterBills')
    .collection('bills').doc('2026-Q1').get();
  const waterQ1 = waterSnap.exists ? waterSnap.data() : null;
  const non106Units = ['101', '102', '103', '104', '105', '201', '202', '203', '204'];
  const a3 = { id: 'a3_non106_water_q1_drift', expected: 'all 9 with currentCharge=0 AND basePaid>0', perUnit: [], pass: true };
  for (const u of non106Units) {
    const ub = waterQ1?.bills?.units?.[u] || {};
    const cc = Number(ub.currentCharge || 0);
    const bp = Number(ub.basePaid || 0);
    const okPerUnit = cc === 0 && bp > 0;
    if (!okPerUnit) a3.pass = false;
    a3.perUnit.push({ unit: u, currentCharge: cc, basePaid: bp, pass: okPerUnit });
  }
  results.assertions.push(a3);

  results.allPass = results.assertions.every((a) => a.pass);
  await fs.writeFile(OUT_PATH, JSON.stringify(results, null, 2), 'utf8');

  console.error(`=== Sentinel-state pre-flight (${env}) ===`);
  for (const a of results.assertions) {
    console.error(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.id}`);
    if (a.id === 'a3_non106_water_q1_drift') {
      for (const pu of a.perUnit) console.error(`     unit ${pu.unit}: currentCharge=${pu.currentCharge} basePaid=${pu.basePaid} -> ${pu.pass ? 'PASS' : 'FAIL'}`);
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

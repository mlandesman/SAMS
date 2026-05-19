#!/usr/bin/env node
/**
 * pass2SentinelCheck.js
 *
 * Stage 3 / Task 3.4 Pass 2 — sentinel-state pre-flight.
 *
 * Verifies Dev was freshly restored from Prod (i.e., Pass 1 writes are GONE):
 *   1. Unit 106 dues mirror payments[8].basePaid === 775101 (pre-Option-P value)
 *   2. Unit 106 creditBalance (UPC-derived from history) === 0
 *   3. All 9 non-106 units' water:2026-Q1 has currentCharge=0 with basePaid>0
 *
 * Exits 0 if all assertions PASS. Exits non-zero if any FAIL.
 * Writes JSON report to test-results/pass-2-pre-flight-sentinel-2026-05-17.json.
 *
 * READ-ONLY (sentinel verification, no writes).
 */

import fs from 'fs/promises';
import path from 'path';
import { getDb } from '../firebase.js';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const REPO_ROOT = '/Users/michael/Projects/SAMS';
const OUT_PATH = path.join(REPO_ROOT, 'test-results/pass-2-pre-flight-sentinel-2026-05-17.json');

async function main() {
  const db = await getDb();
  const results = { assertions: [], allPass: true };

  // Assertion 1: unit 106 dues payments[8].basePaid === 775101
  const duesSnap = await db.collection('clients').doc('AVII')
    .collection('units').doc('106').collection('dues').doc('2026').get();
  const dues = duesSnap.exists ? duesSnap.data() : null;
  const m9BasePaid = dues?.payments?.[8]?.basePaid;
  results.assertions.push({
    id: 'a1_unit106_m9_basePaid',
    expected: 775101,
    actual: m9BasePaid,
    pass: m9BasePaid === 775101,
    description: 'Unit 106 dues mirror payments[8].basePaid (Q3 month 9 = Q3.3) must equal pre-Option-P value 775101c ($7,751.01). Pass 1 set this to 1202031c.'
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
    description: 'Unit 106 credit balance derived from history must be 0 (Pass 1 left it at 179713c = $1,797.13).'
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

  console.error('=== Sentinel-state pre-flight ===');
  for (const a of results.assertions) {
    console.error(`  [${a.pass ? 'PASS' : 'FAIL'}] ${a.id}`);
    if (a.id === 'a3_non106_water_q1_drift') {
      for (const pu of a.perUnit) console.error(`     unit ${pu.unit}: currentCharge=${pu.currentCharge} basePaid=${pu.basePaid} -> ${pu.pass ? 'PASS' : 'FAIL'}`);
    } else {
      console.error(`     expected: ${a.expected}, actual: ${a.actual}`);
    }
  }
  console.error('');
  console.error(`=== Overall: ${results.allPass ? 'PASS ✓ Dev is freshly restored' : 'FAIL ✗ Dev is NOT freshly restored — STOP'}`);
  console.error(`Report written: ${OUT_PATH}`);
  process.exit(results.allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err && err.stack || err);
  process.exit(2);
});

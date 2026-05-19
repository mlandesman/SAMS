#!/usr/bin/env node
/**
 * prodReplayUnifiedWrapper.mjs
 *
 * Stage 3 — Full Pass-2 unified replay orchestrator (clean pre-Stage-3 baseline).
 * Orchestrates existing scripts from test-results/stage-3-unified-prod-replay-script-2026-05-17.md
 * with dry-mode delta checks, Proceed y/N gates, and post-apply Firestore verification.
 *
 * Usage (from functions/):
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/prodReplayUnifiedWrapper.mjs --dry-only
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/prodReplayUnifiedWrapper.mjs
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/prodReplayUnifiedWrapper.mjs --yes
 *   SAMS_PROD_OK=yes ... --prod   (propagates --prod to children; no bypass of confirmProd)
 */

import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { getProdAwareDb } from './lib/prodAwareDb.js';
import { getCreditBalanceCentavos } from '../../shared/utils/hoaCreditTotals.js';
import { getNow } from '../../shared/services/DateService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const FUNCTIONS_DIR = path.join(REPO_ROOT, 'functions');
const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;

const args = process.argv.slice(2);
const DRY_ONLY = args.includes('--dry-only');
const AUTO_YES = args.includes('--yes') || process.env.SAMS_WRAPPER_YES === '1';
const IS_PROD = args.includes('--prod');

if (IS_PROD && process.env.SAMS_PROD_OK !== 'yes') {
  console.error('FATAL: --prod requires SAMS_PROD_OK=yes');
  process.exit(2);
}

const PASS2_FINAL = {
  '101': { soa: 3801, upcNet: 3801, credit: 76027 },
  '102': { soa: 1674715, upcNet: 1674715, credit: 101400 },
  '103': { soa: 0, upcNet: -537294, credit: 537294 },
  '104': { soa: 1877, upcNet: -85, credit: 85 },
  '105': { soa: 0, upcNet: -70000, credit: 70000 },
  '106': { soa: 3017700, upcNet: 3017700, credit: 179713 },
  '201': { soa: 0, upcNet: 0, credit: 0 },
  '202': { soa: 236, upcNet: -14, credit: 14 },
  '203': { soa: 2414289, upcNet: 2414289, credit: 56792 },
  '204': { soa: 0, upcNet: -6250, credit: 6250 }
};

function prodTag() {
  return IS_PROD ? 'prod-' : '';
}

function runNode(scriptRel, scriptArgs, label, envExtra = {}, spawnOpts = {}) {
  const fullArgs = [
    path.join('backend/scripts', scriptRel),
    ...scriptArgs,
    ...(IS_PROD ? ['--prod'] : [])
  ];
  console.error(`\n━━━ ${label} ━━━`);
  console.error(`node ${fullArgs.join(' ')}`);
  const inheritStdio = spawnOpts.stdio === 'inherit';
  const r = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', ...fullArgs],
    {
      cwd: FUNCTIONS_DIR,
      encoding: inheritStdio ? undefined : 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules', ...envExtra },
      ...spawnOpts
    }
  );
  if (!inheritStdio) {
    if (r.stdout) process.stderr.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
  }
  if (r.error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
    console.error(`[wrapper] FATAL: child stdout exceeded maxBuffer — use stdio:inherit for verbose scripts`);
  }
  return { exitCode: r.status ?? 1, stdout: r.stdout || '', stderr: r.stderr || '' };
}

async function readJson(relPath) {
  const p = path.join(REPO_ROOT, relPath);
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function expectCreditDelta(deltaCentavos) {
  return (report) => {
    const predicted =
      report?.creditBalance?.delta_centavos ??
      report?.surplusCreditCentavos ??
      report?.refundCentavos ??
      report?.amountCentavos;
    if (predicted == null) {
      return { ok: false, message: 'Could not extract credit delta from dry report', predicted: null };
    }
    if (predicted !== deltaCentavos) {
      return {
        ok: false,
        message: `Credit delta mismatch: predicted=${predicted}c expected=${deltaCentavos}c`,
        predicted
      };
    }
    return { ok: true, message: `Credit Δ ${deltaCentavos}c`, predicted };
  };
}

function expectFields(checks) {
  return (report) => {
    for (const [key, val] of Object.entries(checks)) {
      const parts = key.split('.');
      let cur = report;
      for (const p of parts) cur = cur?.[p];
      if (cur !== val) {
        return { ok: false, message: `${key}: got ${cur}, expected ${val}`, predicted: cur };
      }
    }
    return { ok: true, message: JSON.stringify(checks), predicted: checks };
  };
}

const STEPS = [
  {
    id: 'sentinel',
    label: 'Phase 1 — prodSentinelCheck (pre-Stage-3)',
    kind: 'sentinel',
    reportRel: () => `test-results/${IS_PROD ? 'prod' : 'dev'}-sentinel-pre-flight-2026-05-19.json`
  },
  {
    id: '106-a',
    label: 'Unit 106 step a',
    script: 'unit106OptionPStepA.js',
    buildArgs: () => [],
    reportRel: (mode) => `test-results/unit106-option-p-step-a-${prodTag()}${mode}.json`,
    validate: expectFields({ 'deltas.m8_basePaid_post_centavos': 1202031 }),
    postVerify: async (db) => {
      const snap = await db.collection('clients').doc(CLIENT_ID).collection('units').doc('106')
        .collection('dues').doc(String(FISCAL_YEAR)).get();
      const bp = snap.data()?.payments?.[8]?.basePaid;
      if (bp !== 1202031) throw new Error(`106 m8.basePaid post-apply=${bp}, expected 1202031`);
    },
    unitId: '106'
  },
  {
    id: '106-a-prime',
    label: 'Unit 106 step a-prime',
    script: 'unit106OptionPSteps.js',
    buildArgs: () => ['--step', 'a-prime'],
    reportRel: (mode) => `test-results/unit106-option-p-step-a-prime-${prodTag()}${mode}.json`,
    validate: expectCreditDelta(21347),
    unitId: '106',
    creditDelta: 21347
  },
  {
    id: '106-b',
    label: 'Unit 106 step b',
    script: 'unit106OptionPSteps.js',
    buildArgs: () => ['--step', 'b'],
    reportRel: (mode) => `test-results/unit106-option-p-step-b-${prodTag()}${mode}.json`,
    validate: (r) => {
      const c = expectCreditDelta(13974)(r);
      if (!c.ok) return c;
      const cc = r?.extraWrite?.postValue;
      if (cc !== 165000) return { ok: false, message: `currentCharge post ${cc}, expected 165000`, predicted: cc };
      return { ok: true, message: 'credit +13974c, currentCharge→165000', predicted: { credit: 13974, cc: 165000 } };
    },
    unitId: '106',
    creditDelta: 13974
  },
  {
    id: '106-c',
    label: 'Unit 106 step c',
    script: 'unit106OptionPSteps.js',
    buildArgs: () => ['--step', 'c'],
    reportRel: (mode) => `test-results/unit106-option-p-step-c-${prodTag()}${mode}.json`,
    validate: expectCreditDelta(11851),
    unitId: '106',
    creditDelta: 11851
  },
  {
    id: '106-d',
    label: 'Unit 106 step d',
    script: 'unit106OptionPSteps.js',
    buildArgs: () => ['--step', 'd'],
    reportRel: (mode) => `test-results/unit106-option-p-step-d-${prodTag()}${mode}.json`,
    validate: expectCreditDelta(130911),
    unitId: '106',
    creditDelta: 130911
  },
  {
    id: '106-e',
    label: 'Unit 106 step e',
    script: 'unit106OptionPSteps.js',
    buildArgs: () => ['--step', 'e', '--residual-centavos', '1531'],
    reportRel: (mode) => `test-results/unit106-option-p-step-e-${prodTag()}${mode}.json`,
    validate: expectCreditDelta(1531),
    unitId: '106',
    creditDelta: 1531
  },
  {
    id: '106-f',
    label: 'Unit 106 step f',
    script: 'unit106OptionPSteps.js',
    buildArgs: () => ['--step', 'f'],
    reportRel: (mode) => `test-results/unit106-option-p-step-f-${prodTag()}${mode}.json`,
    validate: expectCreditDelta(99),
    unitId: '106',
    creditDelta: 99
  },
  aviiStep('105', 'b', [], { surplusCreditCentavos: 70000, newCurrentChargeCentavos: 45000 }),
  aviiStep('201', 'b', [], { surplusCreditCentavos: 0, newCurrentChargeCentavos: 5000 }),
  aviiStep('204', 'b', [], { surplusCreditCentavos: 5000, newCurrentChargeCentavos: 20000 }),
  aviiStep('204', 'c', [], { refundCentavos: 1250, toPenaltyPaidCentavos: 0 }),
  aviiStep('101', 'b', [], { surplusCreditCentavos: 0, newCurrentChargeCentavos: 125000 }),
  aviiStep('101', 'b2', [], { surplusCreditCentavos: 25000, newCurrentChargeCentavos: 115000 }),
  aviiStep('101', 'e', ['--residual-centavos', '51027'], { amountCentavos: 51027 }),
  aviiStep('203', 'a', [], { mToBasePaidPost: 776970 }),
  aviiStep('203', 'a-prime', ['--residual-centavos', '7875'], { amountCentavos: 7875 }),
  aviiStep('203', 'b', [], { surplusCreditCentavos: 26378, newCurrentChargeCentavos: 520000 }),
  aviiStep('203', 'c', [], { refundCentavos: 10156, toPenaltyPaidCentavos: 18886 }),
  aviiStep('203', 'e', ['--residual-centavos', '12383'], { amountCentavos: 12383 }),
  aviiStep('102', 'a', [], { mToBasePaidPost: 705675 }),
  aviiStep('102', 'b', [], { surplusCreditCentavos: 0, newCurrentChargeCentavos: 105000 }),
  aviiStep('102', 'b2', [], { surplusCreditCentavos: 0, newCurrentChargeCentavos: 220000 }),
  aviiStep('102', 'c', [], { refundCentavos: 23573 }),
  aviiStep('102', 'd', ['--residual-centavos', '77827'], { amountCentavos: 77827 }),
  {
    id: 'task-3-5',
    label: 'Task 3.5 step-a paid/status/notes fix',
    script: 'task3-5StepAStatusNotesFix.js',
    buildArgs: () => (DRY_ONLY ? ['--sentinel-mode', 'pre-preview'] : []),
    reportRel: (mode) => `test-results/task-3-5-aggregate-${prodTag()}${mode}-2026-05-17.json`,
    validate: () => ({ ok: true, message: 'aggregate report present', predicted: null }),
    postVerify: null
  },
  {
    id: 'forensic-final',
    label: 'Phase 10 — AVII-wide forensic',
    kind: 'forensic',
    reportRel: () => 'test-results/avii-units-forensic-2026-05-17.json'
  }
];

function expectStepAMToBasePaid(expectedBasePaid) {
  return (report) => {
    const actual = report?.post?.mTo?.basePaid;
    if (actual !== expectedBasePaid) {
      return {
        ok: false,
        message: `post.mTo.basePaid: got ${actual}, expected ${expectedBasePaid}`,
        predicted: actual
      };
    }
    return { ok: true, message: `post.mTo.basePaid=${expectedBasePaid}`, predicted: actual };
  };
}

function aviiStep(unit, step, extraArgs, expectedChecks) {
  const id = `${unit}-${step}`;
  const mToBasePaidExpected = expectedChecks.mToBasePaidPost;
  const validate =
    expectedChecks.amountCentavos != null
      ? expectCreditDelta(expectedChecks.amountCentavos)
      : expectedChecks.refundCentavos != null
        ? (r) => {
            const base = expectFields({
              refundCentavos: expectedChecks.refundCentavos,
              ...(expectedChecks.source ? { source: expectedChecks.source } : {}),
              ...(expectedChecks.toPenaltyPaidCentavos != null
                ? { toPenaltyPaid: expectedChecks.toPenaltyPaidCentavos }
                : {})
            })(r);
            return base;
          }
        : mToBasePaidExpected != null
          ? expectStepAMToBasePaid(mToBasePaidExpected)
          : expectFields({
              surplusCreditCentavos: expectedChecks.surplusCreditCentavos,
              newCurrentChargeCentavos: expectedChecks.newCurrentChargeCentavos
            });

  const stepDef = {
    id,
    label: `Unit ${unit} step ${step}`,
    script: 'aviiOptionPSteps2026May17.js',
    buildArgs: () => ['--unit', unit, '--step', step, ...extraArgs],
    reportRel: (mode) => `test-results/unit${unit}-task-3-4-step-${step}-${prodTag()}${mode}.json`,
    validate,
    unitId: unit,
    creditDelta:
      expectedChecks.amountCentavos ??
      expectedChecks.refundCentavos ??
      expectedChecks.surplusCreditCentavos ??
      null
  };

  if (mToBasePaidExpected != null) {
    stepDef.postVerify = async (db) => {
      const snap = await db.collection('clients').doc(CLIENT_ID).collection('units').doc(unit)
        .collection('dues').doc(String(FISCAL_YEAR)).get();
      const bp = snap.data()?.payments?.[8]?.basePaid;
      if (bp !== mToBasePaidExpected) {
        throw new Error(`Unit ${unit} m8.basePaid post-apply=${bp}, expected ${mToBasePaidExpected}`);
      }
    };
    stepDef.creditDelta = null;
  }

  return stepDef;
}

async function readUnitCredit(db, unitId) {
  const snap = await db.collection('clients').doc(CLIENT_ID).collection('units').doc('creditBalances').get();
  return getCreditBalanceCentavos(snap.data()?.[unitId] || {});
}

async function promptYesNo(question) {
  if (AUTO_YES) {
    console.error(`${question} [auto-yes]`);
    return true;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (a) => resolve(a.trim().toLowerCase()));
  });
  rl.close();
  return answer === 'y' || answer === 'yes';
}

async function runSentinelStep(stepRec) {
  const r = runNode('prodSentinelCheck.js', [], stepRec.label);
  const report = await readJson(stepRec.reportRel());
  const ok = r.exitCode === 0 && report?.allPass === true;
  return {
    stepId: stepRec.id,
    label: stepRec.label,
    mode: 'CHECK',
    exitCode: r.exitCode,
    deltaCheck: { ok, message: ok ? 'All 7 sentinel assertions PASS' : 'Sentinel FAIL or missing report', predicted: report?.allPass },
    reportPath: stepRec.reportRel()
  };
}

async function runForensicFinal(stepRec, db) {
  // Forensic harness logs large API payloads; inherit stdio to avoid spawnSync maxBuffer truncation.
  const r = runNode('aviiUnitsForensic2026May17.js', [], stepRec.label, {}, { stdio: 'inherit' });
  if (r.exitCode !== 0) {
    return { stepId: stepRec.id, label: stepRec.label, mode: 'CHECK', exitCode: r.exitCode, deltaCheck: { ok: false, message: 'Forensic harness failed' } };
  }
  const report = await readJson(stepRec.reportRel());
  const mismatches = [];
  for (const [unitId, exp] of Object.entries(PASS2_FINAL)) {
    const u = report?.units?.find((x) => x.unitId === unitId);
    if (!u) {
      mismatches.push({ unitId, error: 'missing from forensic output' });
      continue;
    }
    const bl = u.bottomLineCentavos || {};
    if (bl.soaAmountDueCentavos !== exp.soa || bl.upcPayoffCentavos !== exp.upcNet || bl.upcCurrentCreditBalanceCentavos !== exp.credit) {
      mismatches.push({
        unitId,
        expected: exp,
        actual: {
          soa: bl.soaAmountDueCentavos,
          upcNet: bl.upcPayoffCentavos,
          credit: bl.upcCurrentCreditBalanceCentavos
        }
      });
    }
  }
  const ok = mismatches.length === 0;
  return {
    stepId: stepRec.id,
    label: stepRec.label,
    mode: 'CHECK',
    exitCode: r.exitCode,
    deltaCheck: { ok, message: ok ? 'All 10 units match Pass-2 final' : `${mismatches.length} unit(s) diverge`, predicted: mismatches },
    reportPath: stepRec.reportRel()
  };
}

async function runScriptStep(stepDef, db, runLog) {
  const rec = { stepId: stepDef.id, label: stepDef.label, dry: null, apply: null };
  const scriptArgs = stepDef.buildArgs();

  const envExtra =
    stepDef.id === 'task-3-5' ? { SAMS_UNIFIED_WRAPPER_PRE_CLOSING: 'yes' } : {};

  // DRY
  const dryRun = runNode(
    stepDef.script,
    [...scriptArgs, '--dry-mode'],
    `${stepDef.label} (dry)`,
    envExtra
  );
  const dryReport = await readJson(stepDef.reportRel('dry'));
  const dryCheck = dryReport ? stepDef.validate(dryReport) : { ok: false, message: 'Dry report JSON not found', predicted: null };
  rec.dry = {
    exitCode: dryRun.exitCode,
    reportPath: stepDef.reportRel('dry'),
    deltaCheck: dryCheck,
    report: dryReport
  };
  if (dryRun.exitCode !== 0 || !dryCheck.ok) {
    return { ...rec, stopped: true, reason: 'dry-mode failed or delta mismatch' };
  }

  if (DRY_ONLY) {
    rec.mode = 'DRY-ONLY';
    return rec;
  }

  if (!(await promptYesNo(`Proceed with APPLY for ${stepDef.label}?`))) {
    return { ...rec, stopped: true, reason: 'User declined APPLY' };
  }

  const preCredit = stepDef.unitId ? await readUnitCredit(db, stepDef.unitId) : null;
  // Under --prod, inner scripts trigger an interactive confirmProd typed-phrase
  // gate. Default spawnSync stdio is 'pipe' for all three streams, so the user's
  // keyboard input can't reach the child and confirmProd times out. Inherit
  // stdio for --prod --apply only so the user can type the phrase. Post-apply
  // verification reads the apply report file from disk (not stdout), so
  // inherit doesn't break verification.
  const applyRun = runNode(
    stepDef.script,
    [...scriptArgs, '--apply'],
    `${stepDef.label} (apply)`,
    envExtra,
    IS_PROD ? { stdio: 'inherit' } : {}
  );
  rec.apply = { exitCode: applyRun.exitCode, reportPath: stepDef.reportRel('apply') };
  if (applyRun.exitCode !== 0) {
    return { ...rec, stopped: true, reason: 'apply exit non-zero' };
  }

  try {
    if (typeof stepDef.postVerify === 'function') {
      await stepDef.postVerify(db);
    } else if (stepDef.unitId && stepDef.creditDelta != null && preCredit != null) {
      const post = await readUnitCredit(db, stepDef.unitId);
      if (post !== preCredit + stepDef.creditDelta) {
        throw new Error(
          `Unit ${stepDef.unitId} credit ${preCredit}→${post}, expected +${stepDef.creditDelta}`
        );
      }
    }
    rec.postVerify = { ok: true, preCredit, creditDelta: stepDef.creditDelta ?? null };
  } catch (e) {
    rec.postVerify = { ok: false, error: e.message };
    return { ...rec, stopped: true, reason: `post-verify: ${e.message}` };
  }

  return rec;
}

async function main() {
  const started = getNow().toISOString();
  const { db, env, projectId } = await getProdAwareDb({ isProd: IS_PROD });
  console.error(`[wrapper] env=${env} projectId=${projectId} mode=${DRY_ONLY ? 'DRY-ONLY' : 'INTERACTIVE'} prod=${IS_PROD}`);

  const runLog = {
    metadata: {
      startedAt: started,
      env,
      projectId,
      isProd: IS_PROD,
      dryOnly: DRY_ONLY,
      autoYes: AUTO_YES
    },
    steps: []
  };

  for (const stepDef of STEPS) {
    let result;
    if (stepDef.kind === 'sentinel') {
      result = await runSentinelStep(stepDef);
      if (!result.deltaCheck.ok) {
        runLog.steps.push(result);
        break;
      }
    } else if (stepDef.kind === 'forensic') {
      if (DRY_ONLY) {
        result = {
          stepId: stepDef.id,
          label: stepDef.label,
          mode: 'SKIPPED',
          deltaCheck: { ok: true, message: 'Skipped in --dry-only (read-only; run full wrapper for D4)' }
        };
      } else {
        result = await runForensicFinal(stepDef, db);
      }
      runLog.steps.push(result);
      if (!DRY_ONLY) break;
      continue;
    } else {
      result = await runScriptStep(stepDef, db, runLog);
      runLog.steps.push(result);
      if (result.stopped) break;
    }
  }

  const ts = started.replace(/[:.]/g, '-');
  const signoffPath = process.env.WRAPPER_SIGNOFF_OUT;
  const outPath = signoffPath
    ? path.join(REPO_ROOT, signoffPath)
    : path.join(
        REPO_ROOT,
        `test-results/prod-replay-unified-wrapper-${IS_PROD ? 'prod' : 'dev'}-${ts}.json`
      );
  runLog.metadata.finishedAt = getNow().toISOString();
  runLog.metadata.stoppedEarly = runLog.steps.some((s) => s.stopped) || runLog.steps.at(-1)?.deltaCheck?.ok === false;
  await fs.writeFile(outPath, JSON.stringify(runLog, null, 2), 'utf8');
  console.error(`\n[wrapper] Wrote run log → ${outPath}`);

  const failed = runLog.metadata.stoppedEarly;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('[wrapper] FATAL:', err?.stack || err);
  process.exit(2);
});

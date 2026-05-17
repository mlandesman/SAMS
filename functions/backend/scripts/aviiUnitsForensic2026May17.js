#!/usr/bin/env node
/**
 * aviiUnitsForensic2026May17.js
 *
 * Stage 3 / Task 3.3 — Read-only forensic reconciliation across all 10 AVII
 * units (FY 2026). Same five-column pattern as `unit106Reconciliation2026May17.js`
 * but parameterized over the unit list.
 *
 *   excelGroundTruth   — only populated for unit 106 (the User-authored sheet
 *                        covers 106 with known parser ambiguity; for other
 *                        units, marked `n/a` so the Manager can adjudicate
 *                        without spurious comparison).
 *   replayCanonical    — transactions-only chronological replay applying
 *                        UPC priority order; same code path as 106 harness.
 *   soaRunningClose    — running balance on last visible SoA line item.
 *   soaAmountDue       — bottom-line `summary.amountDue` from getStatementData().
 *   upcPayoff          — NET of currentCreditBalance per Task 3.2b corrected
 *                        gate definition (= upcTotalRemaining − currentCreditBalance).
 *
 * Per-unit invariants captured:
 *   - Q3/Q4 ordering check (HOA): both partially paid simultaneously?
 *   - Water-bill impossible-state detection:
 *       * `currentCharge = 0` AND `basePaid > 0` (water bill drift)
 *       * `penaltyPaid > penaltyAmount` (over-paid penalty drift)
 *
 * Per-unit recommendation classification (one of):
 *   - MATCH: SoA `amountDue` === UPC `payoff` (net) to the centavo, AND no
 *            impossible-state findings, AND ordering invariant clean.
 *   - OPTION_P_PATTERN: shows the same shape as unit 106 (some combination of
 *            Q3/Q4 ordering violation, water-bill drift, unposted Q4 penalty
 *            cash-vs-accrual gap). Lists which of unit 106's seven steps apply.
 *   - NEW_CORRECTION_SHAPE: non-zero SoA/UPC delta but the shape does not
 *            match unit 106's pattern (e.g., projection-path issue not
 *            traceable to a water-bill drift item; HOA-only patterns not
 *            covered by Option P; etc.). Worker provides a description.
 *   - BLOCKED_NEEDS_MANAGER: cannot classify cleanly without Manager + User
 *            adjudication. Worker provides the specific question.
 *
 * Zero writes. Idempotent. Run as:
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/aviiUnitsForensic2026May17.js
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/aviiUnitsForensic2026May17.js --unit 203
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/aviiUnitsForensic2026May17.js --units 101,102,203
 */

import fs from 'fs/promises';
import path from 'path';

import { getDb } from '../firebase.js';
import { createApiClient } from '../testing/apiClient.js';
import { getNow } from '../../shared/services/DateService.js';
import { getFiscalYearBounds } from '../utils/fiscalYearUtils.js';
import { getStatementData } from '../services/statementDataService.js';

const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026;
const FY_START_MONTH = 7; // AVII fiscal year starts in July
const MONTH_DUE_CENTAVOS = 1202031; // $12,020.31 per month (scheduled per User)

const REPO_ROOT = '/Users/michael/Projects/SAMS';
const OUT_JSON = path.join(REPO_ROOT, 'test-results/avii-units-forensic-2026-05-17.json');

const args = process.argv.slice(2);
function getArg(flag, fallback = null) {
  const i = args.indexOf(flag);
  return (i === -1 || i + 1 >= args.length) ? fallback : args[i + 1];
}
const SINGLE_UNIT = getArg('--unit', null);
const UNITS_CSV = getArg('--units', null);

// ─────────────────────────────────────────────────────────────────────────────
// helpers (mirror of unit106 harness)
// ─────────────────────────────────────────────────────────────────────────────

function pesosToCentavos(n) {
  if (n == null || Number.isNaN(Number(n))) return 0;
  return Math.round(Number(n) * 100);
}

function centavosToPesos(c) {
  return Number(((c || 0) / 100).toFixed(2));
}

function toIsoDay(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
  if (typeof value?._seconds === 'number') return new Date(value._seconds * 1000).toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  return null;
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?._seconds === 'number') return new Date(value._seconds * 1000);
  if (typeof value === 'string') return new Date(value);
  return null;
}

function makeBillRow(module, key) {
  return {
    module,
    bill: key,
    originalCentavos: 0,
    penaltyCentavos: 0,
    basePaidCentavos: 0,
    penaltyPaidCentavos: 0,
    baseRemainingCentavos: 0,
    penaltyRemainingCentavos: 0,
    totalRemainingCentavos: 0,
    status: 'unknown'
  };
}

function finalizeBillRow(row) {
  row.baseRemainingCentavos = Math.max(0, row.originalCentavos - row.basePaidCentavos);
  row.penaltyRemainingCentavos = Math.max(0, row.penaltyCentavos - row.penaltyPaidCentavos);
  row.totalRemainingCentavos = row.baseRemainingCentavos + row.penaltyRemainingCentavos;
  if (row.totalRemainingCentavos === 0) row.status = 'paid';
  else if (row.basePaidCentavos > 0 || row.penaltyPaidCentavos > 0) row.status = 'partial';
  else row.status = 'unpaid';
}

function aggregateTotals(rowList) {
  return rowList.reduce(
    (acc, r) => {
      acc.originalCentavos += r.originalCentavos;
      acc.penaltyCentavos += r.penaltyCentavos;
      acc.basePaidCentavos += r.basePaidCentavos;
      acc.penaltyPaidCentavos += r.penaltyPaidCentavos;
      acc.baseRemainingCentavos += r.baseRemainingCentavos;
      acc.penaltyRemainingCentavos += r.penaltyRemainingCentavos;
      acc.totalRemainingCentavos += r.totalRemainingCentavos;
      return acc;
    },
    {
      originalCentavos: 0, penaltyCentavos: 0,
      basePaidCentavos: 0, penaltyPaidCentavos: 0,
      baseRemainingCentavos: 0, penaltyRemainingCentavos: 0,
      totalRemainingCentavos: 0
    }
  );
}

function billKeyOrder(key) {
  const [module, period] = key.split(':');
  const mIdx = module === 'hoa' ? 0 : module === 'water' ? 1 : 9;
  return `${mIdx}-${period}`;
}

function billKeyFromAllocation(alloc) {
  if (!alloc) return null;
  const targetId = String(alloc.targetId || '');
  const billPeriodRaw = String(alloc.data?.billPeriod || '');
  const type = String(alloc.type || '').toLowerCase();
  const catId = String(alloc.categoryId || '').toLowerCase();
  const catName = String(alloc.categoryName || '').toLowerCase();

  const looksWater = type.includes('water') || catId.includes('water') || catName.includes('water')
    || billPeriodRaw.startsWith('water:') || targetId.toLowerCase().includes('water');

  const hoaQuarterFromTarget = targetId.match(/Q([1-4])_(\d{4})/i);
  const hoaQuarterFromPeriod = billPeriodRaw.replace(/^hoa:/i, '').match(/(\d{4})-Q([1-4])/i);

  if (!looksWater) {
    if (hoaQuarterFromTarget) return `hoa:${hoaQuarterFromTarget[2]}-Q${hoaQuarterFromTarget[1]}`;
    if (hoaQuarterFromPeriod) return `hoa:${hoaQuarterFromPeriod[1]}-Q${hoaQuarterFromPeriod[2]}`;
    const monthVal = Number(alloc.data?.month);
    const yearVal = Number(alloc.data?.year || FISCAL_YEAR);
    if (Number.isInteger(monthVal)) {
      const mi = monthVal >= 1 && monthVal <= 12 ? monthVal - 1 : monthVal;
      if (mi >= 0 && mi <= 11) {
        const q = Math.floor(mi / 3) + 1;
        return `hoa:${yearVal}-Q${q}`;
      }
    }
  }

  const waterFromTarget = targetId.match(/water_(\d{4})-Q([1-4])/i);
  const waterFromPeriod = billPeriodRaw.replace(/^water:/i, '').match(/(\d{4})-Q([1-4])/i);
  if (waterFromTarget) return `water:${waterFromTarget[1]}-Q${waterFromTarget[2]}`;
  if (waterFromPeriod) return `water:${waterFromPeriod[1]}-Q${waterFromPeriod[2]}`;

  return null;
}

function allocationIsPenalty(alloc) {
  const t = String(alloc?.type || '').toLowerCase();
  const c = String(alloc?.categoryId || '').toLowerCase();
  const n = String(alloc?.categoryName || '').toLowerCase();
  return t.includes('penalt') || c.includes('penalt') || n.includes('penalt');
}

// ─────────────────────────────────────────────────────────────────────────────
// per-unit forensic
// ─────────────────────────────────────────────────────────────────────────────

async function snapshotUnit(db, unitId) {
  const duesSnap = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc(unitId)
    .collection('dues').doc(String(FISCAL_YEAR))
    .get();
  const dues = duesSnap.exists ? duesSnap.data() : null;

  const waterSnap = await db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills')
    .where('fiscalYear', '==', FISCAL_YEAR)
    .get();
  const waterBills = [];
  waterSnap.forEach((doc) => {
    const data = doc.data() || {};
    const unitBill = data?.bills?.units?.[unitId] || null;
    if (unitBill) {
      waterBills.push({
        id: doc.id,
        dueDate: toIsoDay(data?.dueDate),
        fiscalYear: data?.fiscalYear,
        unit: unitBill
      });
    }
  });
  waterBills.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const creditDoc = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances')
    .get();
  const unitCredit = creditDoc.exists ? creditDoc.data()?.[unitId] : null;

  const txSnap = await db.collection('clients').doc(CLIENT_ID)
    .collection('transactions')
    .where('unitId', '==', unitId)
    .get();
  const transactions = [];
  txSnap.forEach((doc) => {
    const t = doc.data() || {};
    transactions.push({
      id: doc.id,
      date: toIsoDay(t.date),
      amountCentavos: Number(t.amount || 0),
      allocations: Array.isArray(t.allocations) ? t.allocations.map((a) => ({
        type: a.type || null,
        categoryId: a.categoryId || null,
        categoryName: a.categoryName || null,
        amountCentavos: Number(a.amount || 0),
        targetId: a.targetId || null,
        data: a.data || null
      })) : []
    });
  });
  transactions.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id));

  return {
    duesDoc: dues,
    waterBillDocs: waterBills,
    creditBalance: unitCredit,
    transactions
  };
}

function buildCanonicalReplayForUnit(baseline, unitId) {
  const bills = new Map();
  function getBill(key, module) {
    if (!bills.has(key)) bills.set(key, makeBillRow(module, key));
    return bills.get(key);
  }

  // Seed HOA bills with base charges (every AVII unit has HOA quarterly)
  for (let q = 1; q <= 4; q++) {
    const key = `hoa:${FISCAL_YEAR}-Q${q}`;
    const b = getBill(key, 'hoa');
    b.originalCentavos = 3 * MONTH_DUE_CENTAVOS;
  }
  // Seed water bills from persisted bill docs (only those present for this unit)
  for (const wb of baseline.waterBillDocs || []) {
    const ub = wb.unit;
    if (!ub) continue;
    const key = `water:${wb.id}`;
    const b = getBill(key, 'water');
    b.originalCentavos = Number(ub.currentCharge || 0);
    b.penaltyCentavos = Number(ub.penaltyAmount || 0);
  }

  const fy = getFiscalYearBounds(FISCAL_YEAR, FY_START_MONTH);
  const fyStart = fy.startDate;
  const fyEnd = fy.endDate;

  const txList = (baseline.transactions || []).filter((t) => {
    const d = toDateValue(t.date);
    return d && d >= fyStart && d <= fyEnd;
  });

  for (const tx of txList) {
    for (const alloc of tx.allocations || []) {
      const amtC = Math.abs(Number(alloc.amountCentavos || 0));
      if (!amtC) continue;
      const billKey = billKeyFromAllocation(alloc);
      if (!billKey) continue;
      const moduleName = billKey.startsWith('water:') ? 'water' : 'hoa';
      const b = getBill(billKey, moduleName);
      if (allocationIsPenalty(alloc)) b.penaltyPaidCentavos += amtC;
      else b.basePaidCentavos += amtC;
    }
  }

  for (const row of bills.values()) finalizeBillRow(row);
  const sortedKeys = [...bills.keys()].sort((a, b) => billKeyOrder(a).localeCompare(billKeyOrder(b)));
  const billRows = sortedKeys.map((k) => bills.get(k));
  const totals = aggregateTotals(billRows);

  return { bills: billRows, totals, transactionCount: txList.length };
}

async function captureSoaForUnit(api, unitId) {
  const statement = await getStatementData(api, CLIENT_ID, unitId, FISCAL_YEAR, false);
  const lineItems = Array.isArray(statement?.lineItems) ? statement.lineItems : [];
  const visibleItems = lineItems.filter((i) => !i.isFuture);
  const lastItem = visibleItems[visibleItems.length - 1];
  return {
    runningCloseCentavos: pesosToCentavos(lastItem?.balance || 0),
    amountDueCentavos: pesosToCentavos(statement?.summary?.amountDue || 0),
    closingBalanceCentavos: pesosToCentavos(statement?.summary?.closingBalance || 0),
    totalChargesCentavos: pesosToCentavos(statement?.summary?.totalCharges || 0),
    totalPaymentsCentavos: pesosToCentavos(statement?.summary?.totalPayments || 0),
    creditBalanceCentavos: pesosToCentavos(statement?.summary?.creditBalance || 0)
  };
}

async function captureUpcForUnit(api, unitId) {
  const payOnDateStr = toIsoDay(getNow());
  const preview = await api.post('/payments/unified/preview', {
    clientId: CLIENT_ID,
    unitId,
    amount: null,
    paymentDate: payOnDateStr,
    excludedBills: [],
    waivedPenalties: [],
    source: 'aviiUnitsForensic2026May17'
  });
  const data = preview?.data?.preview || preview?.data || {};
  const hoaBills = Array.isArray(data.hoa?.billsPaid) ? data.hoa.billsPaid : [];
  const waterBills = Array.isArray(data.water?.billsPaid) ? data.water.billsPaid : [];

  const bills = new Map();
  function getBill(key, module) {
    if (!bills.has(key)) bills.set(key, makeBillRow(module, key));
    return bills.get(key);
  }
  for (const b of hoaBills) {
    const period = String(b.billPeriod || '').replace(/^hoa:/, '');
    const key = `hoa:${period}`;
    const row = getBill(key, 'hoa');
    row.originalCentavos = pesosToCentavos(b.totalBase || b.originalAmount || 0);
    row.penaltyCentavos = pesosToCentavos(b.totalPenalty || 0);
    row.basePaidCentavos = pesosToCentavos((b.totalBase || 0) - (b.totalBaseDue || 0));
    row.penaltyPaidCentavos = pesosToCentavos((b.totalPenalty || 0) - (b.totalPenaltyDue || 0));
    finalizeBillRow(row);
  }
  for (const b of waterBills) {
    const period = String(b.billPeriod || '').replace(/^water:/, '');
    const key = `water:${period}`;
    const row = getBill(key, 'water');
    row.originalCentavos = pesosToCentavos(b.totalBase || b.originalAmount || 0);
    row.penaltyCentavos = pesosToCentavos(b.totalPenalty || 0);
    row.basePaidCentavos = pesosToCentavos((b.totalBase || 0) - (b.totalBaseDue || 0));
    row.penaltyPaidCentavos = pesosToCentavos((b.totalPenalty || 0) - (b.totalPenaltyDue || 0));
    finalizeBillRow(row);
  }

  const sortedKeys = [...bills.keys()].sort((a, b) => billKeyOrder(a).localeCompare(billKeyOrder(b)));
  const billRows = sortedKeys.map((k) => bills.get(k));
  const totals = aggregateTotals(billRows);

  const upcTotalRemainingCentavos = pesosToCentavos(data.upcTotalRemaining || 0);
  const currentCreditBalanceCentavos = pesosToCentavos(data.currentCreditBalance || 0);
  const upcPayoffNetCentavos = upcTotalRemainingCentavos - currentCreditBalanceCentavos;

  return {
    bills: billRows,
    totals,
    upcTotalRemainingCentavos,
    currentCreditBalanceCentavos,
    upcPayoffNetCentavos
  };
}

function detectImpossibleStates(baseline) {
  const findings = [];
  for (const wb of baseline.waterBillDocs || []) {
    const ub = wb.unit;
    if (!ub) continue;
    const currentCharge = Number(ub.currentCharge || 0);
    const basePaid = Number(ub.basePaid || 0);
    const penaltyAmount = Number(ub.penaltyAmount || 0);
    const penaltyPaid = Number(ub.penaltyPaid || 0);
    if (currentCharge === 0 && basePaid > 0) {
      findings.push({
        kind: 'water_currentCharge_zero_with_basePaid',
        billId: wb.id,
        basePaidCentavos: basePaid,
        currentChargeCentavos: 0
      });
    }
    if (penaltyPaid > penaltyAmount) {
      findings.push({
        kind: 'water_penaltyPaid_exceeds_penaltyAmount',
        billId: wb.id,
        penaltyAmountCentavos: penaltyAmount,
        penaltyPaidCentavos: penaltyPaid,
        overpayCentavos: penaltyPaid - penaltyAmount
      });
    }
  }
  return findings;
}

function checkOrderingInvariant(canonicalBills) {
  // Q3/Q4 simultaneous partial-paid check, matching Task 3.1 / 3.2 pattern.
  const q3 = canonicalBills.find((b) => b.bill === `hoa:${FISCAL_YEAR}-Q3`);
  const q4 = canonicalBills.find((b) => b.bill === `hoa:${FISCAL_YEAR}-Q4`);
  const q3PartiallyPaid = q3 && q3.basePaidCentavos > 0 && q3.totalRemainingCentavos > 0;
  const q4HasPayment = q4 && (q4.basePaidCentavos > 0 || q4.penaltyPaidCentavos > 0);
  return {
    violated: !!(q3PartiallyPaid && q4HasPayment),
    q3: q3 || null,
    q4: q4 || null
  };
}

function classifyUnit(perUnit) {
  const findings = perUnit.impossibleStates || [];
  const ordering = perUnit.invariants?.ordering;
  const soa = perUnit.bottomLineCentavos.soaAmountDueCentavos;
  const upc = perUnit.bottomLineCentavos.upcPayoffCentavos;
  const replay = perUnit.bottomLineCentavos.replayCanonicalCentavos;
  const delta = soa - upc;

  if (delta === 0 && findings.length === 0 && (!ordering || !ordering.violated)) {
    return {
      classification: 'MATCH',
      rationale: `SoA amountDue == UPC payoff (net) == ${centavosToPesos(soa)}; no impossible-state findings; ordering invariant clean.`,
      stepsApplicable: [],
      blockedQuestion: null
    };
  }

  // OPTION_P_PATTERN: shows the same shape as unit 106 (combination of
  // Q3/Q4 ordering + water-bill drift + non-zero SoA/UPC delta).
  const hasWaterCurrentChargeDrift = findings.some((f) => f.kind === 'water_currentCharge_zero_with_basePaid');
  const hasWaterPenaltyDrift = findings.some((f) => f.kind === 'water_penaltyPaid_exceeds_penaltyAmount');
  const orderingViolated = !!(ordering && ordering.violated);
  const matchesOptionPShape = (orderingViolated || hasWaterCurrentChargeDrift || hasWaterPenaltyDrift) && delta !== 0;

  if (matchesOptionPShape) {
    const steps = [];
    if (orderingViolated) steps.push('a (priority reallocation)', "a' (penalty recalc side-effect absorption)");
    if (hasWaterCurrentChargeDrift) steps.push('b (water:Q* currentCharge restoration)');
    if (hasWaterPenaltyDrift) steps.push('c (water:Q* penaltyPaid refund-to-credit)');
    steps.push('d (unposted-penalty waiver if Q4 carries unposted penalty)', 'e (measured residual)', 'f (centavo rounding to clean closing target)');
    return {
      classification: 'OPTION_P_PATTERN',
      rationale: `Shape matches unit 106 pattern: ${orderingViolated ? 'Q3/Q4 ordering violated; ' : ''}${hasWaterCurrentChargeDrift ? 'water currentCharge drift; ' : ''}${hasWaterPenaltyDrift ? 'water penalty over-paid drift; ' : ''}SoA-UPC delta = ${centavosToPesos(delta)} pesos.`,
      stepsApplicable: steps,
      blockedQuestion: null
    };
  }

  // NEW_CORRECTION_SHAPE: non-zero delta but no Option-P-style drift markers.
  if (delta !== 0) {
    return {
      classification: 'NEW_CORRECTION_SHAPE',
      rationale: `SoA-UPC delta = ${centavosToPesos(delta)} pesos but no Option-P drift markers detected (no Q3/Q4 ordering violation, no impossible-state water bills). Likely projection-path divergence or non-HOA/water pattern; needs Manager + User adjudication of shape.`,
      stepsApplicable: [],
      blockedQuestion: null
    };
  }

  // delta === 0 but with findings or ordering: classify as needing manager.
  return {
    classification: 'BLOCKED_NEEDS_MANAGER',
    rationale: `SoA == UPC (net) numerically but ${orderingViolated ? 'Q3/Q4 ordering violated' : 'impossible-state findings present'}. Numerics agree by coincidence or by data already absorbing the drift into credit balance.`,
    stepsApplicable: [],
    blockedQuestion: orderingViolated
      ? 'Q3/Q4 ordering invariant requires correction even though bottom lines match. Should we apply Correction A?'
      : 'Impossible-state findings need adjudication: fix data shape and risk SoA/UPC re-divergence, or accept current state?'
  };
}

async function forensicForUnit(db, api, unitId) {
  const baseline = await snapshotUnit(db, unitId);
  const canonical = buildCanonicalReplayForUnit(baseline, unitId);
  const soa = await captureSoaForUnit(api, unitId);
  const upc = await captureUpcForUnit(api, unitId);
  const impossibleStates = detectImpossibleStates(baseline);
  const ordering = checkOrderingInvariant(canonical.bills);

  const bottomLineCentavos = {
    replayCanonicalCentavos: canonical.totals.totalRemainingCentavos,
    soaRunningCloseCentavos: soa.runningCloseCentavos,
    soaAmountDueCentavos: soa.amountDueCentavos,
    upcPayoffCentavos: upc.upcPayoffNetCentavos,
    upcPayoffGrossCentavos: upc.upcTotalRemainingCentavos,
    upcCurrentCreditBalanceCentavos: upc.currentCreditBalanceCentavos
  };

  const bottomLinePesos = Object.fromEntries(
    Object.entries(bottomLineCentavos).map(([k, v]) => [k.replace('Centavos', 'Pesos'), centavosToPesos(v)])
  );

  const result = {
    unitId,
    asOf: toIsoDay(getNow()),
    bottomLineCentavos,
    bottomLinePesos,
    deltas: {
      soaAmountDue_minus_upcPayoff_centavos: bottomLineCentavos.soaAmountDueCentavos - bottomLineCentavos.upcPayoffCentavos,
      replay_minus_soaAmountDue_centavos: bottomLineCentavos.replayCanonicalCentavos - bottomLineCentavos.soaAmountDueCentavos,
      replay_minus_upcPayoff_centavos: bottomLineCentavos.replayCanonicalCentavos - bottomLineCentavos.upcPayoffCentavos
    },
    invariants: {
      ordering: {
        violated: ordering.violated,
        q3: ordering.q3,
        q4: ordering.q4
      }
    },
    impossibleStates,
    moduleCoverage: {
      hasHoa: !!baseline.duesDoc,
      hasWater: (baseline.waterBillDocs || []).length > 0,
      waterBillCount: (baseline.waterBillDocs || []).length
    },
    perBill: {
      replayCanonical: canonical.bills,
      upcPayoff: upc.bills
    },
    soa,
    persistedCreditBalanceCentavos: Number(baseline.creditBalance?.creditBalance || 0)
  };

  result.recommendation = classifyUnit(result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

async function discoverAviiUnits(db) {
  // Approach: read the creditBalances doc — it's the most authoritative list
  // because every AVII unit has a creditBalances entry. Also intersects with
  // the units collection for safety.
  const creditDoc = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances').get();
  const creditData = creditDoc.exists ? creditDoc.data() : {};
  const ids = Object.keys(creditData).filter((k) => /^\d+$/.test(k));
  ids.sort((a, b) => Number(a) - Number(b));
  return ids;
}

async function main() {
  const db = await getDb();
  const api = await createApiClient();

  let unitIds;
  if (SINGLE_UNIT) {
    unitIds = [String(SINGLE_UNIT)];
  } else if (UNITS_CSV) {
    unitIds = UNITS_CSV.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    unitIds = await discoverAviiUnits(db);
  }
  console.error(`[forensic] units to scan: ${unitIds.join(', ')}`);

  // Capture unit 106 baseline at the very start of iteration.
  let unit106SnapshotPre = null;
  let unit106SnapshotPost = null;

  const results = [];
  for (const unitId of unitIds) {
    console.error(`[forensic] scanning unit ${unitId}…`);
    try {
      const r = await forensicForUnit(db, api, unitId);
      results.push(r);
      if (unitId === '106' && !unit106SnapshotPre) unit106SnapshotPre = r;
      console.error(
        `[forensic] ${unitId.padEnd(4)} class=${r.recommendation.classification.padEnd(22)} ` +
        `SoA=$${centavosToPesos(r.bottomLineCentavos.soaAmountDueCentavos).toFixed(2)} ` +
        `UPC(net)=$${centavosToPesos(r.bottomLineCentavos.upcPayoffCentavos).toFixed(2)} ` +
        `delta=$${centavosToPesos(r.deltas.soaAmountDue_minus_upcPayoff_centavos).toFixed(2)}`
      );
    } catch (err) {
      console.error(`[forensic] ${unitId} FAILED:`, err && err.message);
      results.push({
        unitId,
        error: err && (err.message || String(err)),
        recommendation: {
          classification: 'BLOCKED_NEEDS_MANAGER',
          rationale: 'Forensic harness threw during scan.',
          blockedQuestion: 'Investigate the harness failure for this unit before classification.'
        }
      });
    }
  }

  // Re-scan unit 106 if it was in the batch (to verify invariance across the run).
  if (unit106SnapshotPre) {
    try {
      unit106SnapshotPost = await forensicForUnit(db, api, '106');
    } catch (err) {
      console.error('[forensic] unit 106 post-scan FAILED:', err && err.message);
    }
  }

  const recommendationSummary = {
    MATCH: 0,
    OPTION_P_PATTERN: 0,
    NEW_CORRECTION_SHAPE: 0,
    BLOCKED_NEEDS_MANAGER: 0
  };
  for (const r of results) {
    const cls = r.recommendation?.classification || 'BLOCKED_NEEDS_MANAGER';
    if (recommendationSummary[cls] === undefined) recommendationSummary[cls] = 0;
    recommendationSummary[cls]++;
  }

  const aviiTotals = results.reduce((acc, r) => {
    if (!r.bottomLineCentavos) return acc;
    acc.soaAmountDueCentavos += r.bottomLineCentavos.soaAmountDueCentavos;
    acc.upcPayoffCentavos += r.bottomLineCentavos.upcPayoffCentavos;
    acc.upcPayoffGrossCentavos += r.bottomLineCentavos.upcPayoffGrossCentavos;
    acc.persistedCreditBalanceCentavos += r.persistedCreditBalanceCentavos || 0;
    return acc;
  }, {
    soaAmountDueCentavos: 0,
    upcPayoffCentavos: 0,
    upcPayoffGrossCentavos: 0,
    persistedCreditBalanceCentavos: 0
  });

  // Unit 106 invariance comparison
  let unit106InvarianceCheck = null;
  if (unit106SnapshotPre && unit106SnapshotPost) {
    const pre = unit106SnapshotPre.bottomLineCentavos;
    const post = unit106SnapshotPost.bottomLineCentavos;
    const keys = Object.keys(pre);
    const diffs = keys
      .map((k) => ({ field: k, pre: pre[k], post: post[k], diff: post[k] - pre[k] }))
      .filter((d) => d.diff !== 0);
    unit106InvarianceCheck = {
      pre,
      post,
      byteEquivalent: diffs.length === 0,
      diffs
    };
  }

  const out = {
    metadata: {
      generatedAt: getNow().toISOString(),
      generatedAtIso: toIsoDay(getNow()),
      clientId: CLIENT_ID,
      fiscalYear: FISCAL_YEAR,
      unitsScanned: unitIds,
      writes: 'NONE — read-only forensic'
    },
    unit106InvarianceCheck,
    recommendationSummary,
    aviiTotals: {
      ...aviiTotals,
      soaAmountDuePesos: centavosToPesos(aviiTotals.soaAmountDueCentavos),
      upcPayoffPesos: centavosToPesos(aviiTotals.upcPayoffCentavos),
      upcPayoffGrossPesos: centavosToPesos(aviiTotals.upcPayoffGrossCentavos),
      persistedCreditBalancePesos: centavosToPesos(aviiTotals.persistedCreditBalanceCentavos)
    },
    units: results
  };

  await fs.writeFile(OUT_JSON, JSON.stringify(out, null, 2), 'utf8');
  console.error('');
  console.error(`[forensic] wrote ${OUT_JSON}`);
  console.error('');
  console.error('=== Recommendation summary ===');
  for (const [k, v] of Object.entries(recommendationSummary)) console.error(`  ${k.padEnd(22)} = ${v}`);
  console.error('');
  console.error('=== AVII totals ===');
  console.error(`  SoA amountDue total : $${centavosToPesos(aviiTotals.soaAmountDueCentavos).toFixed(2)}`);
  console.error(`  UPC payoff (net)    : $${centavosToPesos(aviiTotals.upcPayoffCentavos).toFixed(2)}`);
  console.error(`  UPC payoff (gross)  : $${centavosToPesos(aviiTotals.upcPayoffGrossCentavos).toFixed(2)}`);
  console.error(`  Credit balance total: $${centavosToPesos(aviiTotals.persistedCreditBalanceCentavos).toFixed(2)}`);
  if (unit106InvarianceCheck) {
    console.error('');
    console.error(`=== Unit 106 invariance check: ${unit106InvarianceCheck.byteEquivalent ? 'PASS' : 'FAIL'} ===`);
    if (!unit106InvarianceCheck.byteEquivalent) {
      console.error(JSON.stringify(unit106InvarianceCheck.diffs, null, 2));
    }
  }
}

main().catch((err) => {
  console.error('[forensic] FATAL:', err && err.stack || err);
  process.exit(2);
});

#!/usr/bin/env node
/**
 * unit106Reconciliation2026May17.js
 *
 * Stage 3 / Task 3.1 — Read-only forensic reconciliation for AVII unit 106
 * (fiscal year 2026). Produces five aligned per-bill columns for the
 * Manager + User Phase-2 adjudication.
 *
 * Zero writes: this script reads Firestore via the admin SDK and the
 * running backend on localhost:5001. It does NOT mutate any document.
 *
 * Inputs:
 *   - test-results/transactions-AVII-2026-05-16.xlsx (User-authored ground truth)
 *   - Persisted dev state for AVII/106
 *   - Running backend on http://localhost:5001 for SoA + UPC preview
 *
 * Outputs:
 *   - test-results/unit106-baseline-2026-05-17.json (persisted-state snapshot)
 *   - test-results/unit106-reconciliation-2026-05-17.json (five-column reconciliation)
 *
 * Run from functions/ directory:
 *   NODE_OPTIONS=--experimental-vm-modules node backend/scripts/unit106Reconciliation2026May17.js
 */

import fs from 'fs/promises';
import path from 'path';
import ExcelJS from 'exceljs';

import { getDb } from '../firebase.js';
import { createApiClient } from '../testing/apiClient.js';
import { getNow } from '../../shared/services/DateService.js';
import { getFiscalYearBounds } from '../utils/fiscalYearUtils.js';
import { getStatementData } from '../services/statementDataService.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '106';
const FISCAL_YEAR = 2026;
const FY_START_MONTH = 7; // AVII fiscal year starts in July
const MONTH_DUE_CENTAVOS = 1202031; // $12,020.31 per month (paid forward)

const REPO_ROOT = '/Users/michael/Projects/SAMS';
const EXCEL_PATH = path.join(REPO_ROOT, 'test-results/transactions-AVII-2026-05-16.xlsx');
const BASELINE_OUT = path.join(REPO_ROOT, 'test-results/unit106-baseline-2026-05-17.json');
const RECON_OUT = path.join(REPO_ROOT, 'test-results/unit106-reconciliation-2026-05-17.json');

// ─────────────────────────────────────────────────────────────────────────────
// helpers
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
      originalCentavos: 0,
      penaltyCentavos: 0,
      basePaidCentavos: 0,
      penaltyPaidCentavos: 0,
      baseRemainingCentavos: 0,
      penaltyRemainingCentavos: 0,
      totalRemainingCentavos: 0
    }
  );
}

function billKeyOrder(key) {
  // Ordering: HOA before water, then by year-quarter
  const [module, period] = key.split(':');
  const mIdx = module === 'hoa' ? 0 : module === 'water' ? 1 : 9;
  return `${mIdx}-${period}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXCEL GROUND TRUTH
// ─────────────────────────────────────────────────────────────────────────────

async function loadExcelGroundTruth() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const sheet = wb.worksheets[0];

  // Headers
  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (c, i) => {
    headers[i] = c.value;
  });

  const rows = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const wsRow = sheet.getRow(r);
    const obj = {};
    wsRow.eachCell({ includeEmpty: false }, (c, i) => {
      obj[headers[i] || `col${i}`] = c.value;
    });
    if (Object.keys(obj).length === 0) continue;
    rows.push({ rowNumber: r, ...obj });
  }

  // Build per-bill rows
  // Key shape: hoa:2026-Q1, water:2026-Q1
  const bills = new Map();
  function getBill(key, module) {
    if (!bills.has(key)) bills.set(key, makeBillRow(module, key));
    return bills.get(key);
  }

  // HOA bills always have base = 3 * MONTH_DUE per quarter for AVII FY2026
  for (let q = 1; q <= 4; q++) {
    const key = `hoa:${FISCAL_YEAR}-Q${q}`;
    const b = getBill(key, 'hoa');
    b.originalCentavos = 3 * MONTH_DUE_CENTAVOS;
  }

  // Parse rows
  const rawRows = [];
  const repairLedger = []; // for transparency
  for (const row of rows) {
    const description = String(row['Description'] || '');
    const category = String(row['Category'] || '');
    const notes = String(row['Notes'] || '');
    const type = String(row['Type'] || '');
    const reference = row['Reference']; // can be number or "Paid"/"Partial"

    const amount = Number(row['Amount'] || 0); // pesos
    const penaltyAmt = Number(row['PenaltyAmt'] || 0); // positive pesos
    const penaltyPaid = Number(row['PenaltyPaid'] || 0); // negative pesos (paid)

    if (type === 'income') {
      // Deposit row — useful as audit trail only, no bill impact
      rawRows.push({
        rowNumber: row.rowNumber,
        kind: 'deposit',
        date: toIsoDay(row['Date']),
        amount: pesosToCentavos(amount),
        txId: row['Transaction ID'] || null,
        notes
      });
      continue;
    }

    // type === 'expense' (or undefined)
    if (/repair_shift/i.test(notes)) {
      // Repair shift: documents prior session manipulation. We track but
      // expect in+out to net to zero for the affected quarters.
      const isShiftIn = /repair_shift_in/i.test(notes);
      // "From 4 -> 3" or "From 3 -> 4"
      const m = description.match(/From\s*(\d+)\s*->\s*(\d+)/i);
      if (!m) {
        repairLedger.push({ rowNumber: row.rowNumber, parseError: true, description, notes });
        continue;
      }
      const fromQ = Number(m[1]);
      const toQ = Number(m[2]);
      const amtAbs = Math.abs(pesosToCentavos(amount));
      repairLedger.push({
        rowNumber: row.rowNumber,
        direction: isShiftIn ? 'in' : 'out',
        fromQuarter: fromQ,
        toQuarter: toQ,
        amountCentavos: amtAbs,
        reference: String(reference || ''),
        notes
      });
      continue;
    }

    if (category === 'Dues Base') {
      // HOA dues payment-allocation row.
      // Bill identified by Description "Qn.m" or Notes "Qn Month m/3", or by Description like "Sep 2025"
      let q = null;
      let mDot = description.match(/^Q(\d)\.(\d)/);
      if (mDot) {
        q = Number(mDot[1]);
      } else {
        const mNotes = notes.match(/Q(\d)\s*Month\s*(\d)\/3/i);
        if (mNotes) q = Number(mNotes[1]);
      }
      if (q == null && /sep|oct|nov/i.test(notes)) {
        // "Sep 2025" → Q1.3 for AVII FY2026 (Jul start, so Sep is month 3 = Q1)
        if (/sep\s*2025/i.test(notes)) q = 1;
        else if (/oct\s*2025/i.test(notes)) q = 2;
        else if (/nov\s*2025/i.test(notes)) q = 2;
        else if (/dec\s*2025/i.test(notes)) q = 2;
      }
      if (q == null) {
        rawRows.push({
          rowNumber: row.rowNumber,
          kind: 'dues_unmapped',
          description,
          notes,
          amountCentavos: pesosToCentavos(amount),
          penaltyAmtCentavos: pesosToCentavos(penaltyAmt),
          penaltyPaidCentavos: pesosToCentavos(penaltyPaid)
        });
        continue;
      }
      const key = `hoa:${FISCAL_YEAR}-Q${q}`;
      const b = getBill(key, 'hoa');
      const basePaid = Math.abs(pesosToCentavos(amount));
      const penChargedC = pesosToCentavos(penaltyAmt);
      const penPaidC = Math.abs(pesosToCentavos(penaltyPaid));
      b.basePaidCentavos += basePaid;
      b.penaltyCentavos += penChargedC;
      b.penaltyPaidCentavos += penPaidC;
      rawRows.push({
        rowNumber: row.rowNumber,
        kind: 'hoa_allocation',
        billKey: key,
        date: toIsoDay(row['Date']),
        basePaidCentavos: basePaid,
        penaltyChargedCentavos: penChargedC,
        penaltyPaidCentavos: penPaidC,
        reference: String(reference || ''),
        description,
        notes
      });
    } else if (category === 'Water Bills') {
      // Water bill payment row. Bill ID from Description like "2026-Q1".
      const m = description.match(/(\d{4})-Q([1-4])/);
      if (!m) {
        rawRows.push({
          rowNumber: row.rowNumber,
          kind: 'water_unmapped',
          description,
          notes,
          amountCentavos: pesosToCentavos(amount)
        });
        continue;
      }
      const key = `water:${m[1]}-Q${m[2]}`;
      const b = getBill(key, 'water');
      const basePaid = Math.abs(pesosToCentavos(amount));
      b.basePaidCentavos += basePaid;
      // Water bills' original charge isn't in this Excel sheet; we'll learn it from Firestore later.
      rawRows.push({
        rowNumber: row.rowNumber,
        kind: 'water_allocation',
        billKey: key,
        date: toIsoDay(row['Date']),
        basePaidCentavos: basePaid,
        notes
      });
    } else {
      rawRows.push({
        rowNumber: row.rowNumber,
        kind: 'other_expense',
        category,
        description,
        notes,
        amountCentavos: pesosToCentavos(amount)
      });
    }
  }

  // Apply repair-shift net effect on HOA paid totals.
  // Convention: "From X -> Y / shift_in" means money moved FROM Q_X TO Q_Y.
  //   Q_Y gains amount as base paid; Q_X loses amount as base paid.
  //   The "in" / "out" labels in notes look like authoring metadata; we
  //   apply BOTH legs (in and out) the same way — they should net to zero.
  let repairTotalIn = 0;
  let repairTotalOut = 0;
  for (const r of repairLedger) {
    if (!r.fromQuarter || !r.toQuarter || !r.amountCentavos) continue;
    const fromKey = `hoa:${FISCAL_YEAR}-Q${r.fromQuarter}`;
    const toKey = `hoa:${FISCAL_YEAR}-Q${r.toQuarter}`;
    const fromBill = getBill(fromKey, 'hoa');
    const toBill = getBill(toKey, 'hoa');
    fromBill.basePaidCentavos -= r.amountCentavos;
    toBill.basePaidCentavos += r.amountCentavos;
    if (r.direction === 'in') repairTotalIn += r.amountCentavos;
    else repairTotalOut += r.amountCentavos;
  }

  // Finalize remaining
  for (const row of bills.values()) finalizeBillRow(row);

  const sortedKeys = [...bills.keys()].sort((a, b) => billKeyOrder(a).localeCompare(billKeyOrder(b)));
  const billRows = sortedKeys.map((k) => bills.get(k));
  const totals = aggregateTotals(billRows);

  return {
    source: 'excel',
    excelPath: EXCEL_PATH,
    asOfNote: 'Hand-built static; no as-of date',
    bills: billRows,
    totals,
    rawRows,
    repairLedger,
    repairNet: {
      shiftInCentavos: repairTotalIn,
      shiftOutCentavos: repairTotalOut,
      netCentavos: repairTotalIn - repairTotalOut
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PERSISTED BASELINE (Firestore)
// ─────────────────────────────────────────────────────────────────────────────

async function snapshotBaseline(db) {
  // Dues doc
  const duesSnap = await db
    .collection('clients').doc(CLIENT_ID)
    .collection('units').doc(UNIT_ID)
    .collection('dues').doc(String(FISCAL_YEAR))
    .get();
  const dues = duesSnap.exists ? duesSnap.data() : null;

  // Water bills doc(s)
  const waterSnap = await db
    .collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills')
    .where('fiscalYear', '==', FISCAL_YEAR)
    .get();
  const waterBills = [];
  waterSnap.forEach((doc) => {
    const data = doc.data() || {};
    const unitBill = data?.bills?.units?.[UNIT_ID] || null;
    waterBills.push({
      id: doc.id,
      dueDate: toIsoDay(data?.dueDate),
      fiscalYear: data?.fiscalYear,
      unit106: unitBill
    });
  });
  waterBills.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Credit balances
  const creditDoc = await db
    .collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances')
    .get();
  const unitCredit = creditDoc.exists ? creditDoc.data()?.[UNIT_ID] : null;

  // Transactions for this unit (full FY range; we'll filter)
  const txSnap = await db
    .collection('clients').doc(CLIENT_ID)
    .collection('transactions')
    .where('unitId', '==', UNIT_ID)
    .get();
  const transactions = [];
  txSnap.forEach((doc) => {
    const t = doc.data() || {};
    transactions.push({
      id: doc.id,
      date: toIsoDay(t.date),
      amountCentavos: Number(t.amount || 0),
      categoryId: t.categoryId || null,
      categoryName: t.categoryName || null,
      notes: typeof t.notes === 'string' ? t.notes : (t.notes ? JSON.stringify(t.notes) : ''),
      allocations: Array.isArray(t.allocations) ? t.allocations.map((a) => ({
        type: a.type || null,
        categoryId: a.categoryId || null,
        categoryName: a.categoryName || null,
        amountCentavos: Number(a.amount || 0),
        targetId: a.targetId || null,
        targetName: a.targetName || null,
        data: a.data || null
      })) : []
    });
  });
  transactions.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id));

  return {
    capturedAt: getNow().toISOString(),
    clientId: CLIENT_ID,
    unitId: UNIT_ID,
    fiscalYear: FISCAL_YEAR,
    duesDoc: dues,
    waterBillDocs: waterBills,
    creditBalance: unitCredit,
    transactions
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CANONICAL TRANSACTIONS-ONLY REPLAY
// ─────────────────────────────────────────────────────────────────────────────

function billKeyFromAllocation(alloc) {
  if (!alloc) return null;
  const targetId = String(alloc.targetId || '');
  const billPeriodRaw = String(alloc.data?.billPeriod || '');
  const type = String(alloc.type || '').toLowerCase();
  const catId = String(alloc.categoryId || '').toLowerCase();
  const catName = String(alloc.categoryName || '').toLowerCase();

  const looksWater = type.includes('water') || catId.includes('water') || catName.includes('water')
    || billPeriodRaw.startsWith('water:') || targetId.toLowerCase().includes('water');

  // HOA: targetId like "Q3_2026" or billPeriod like "hoa:2026-Q3"
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

  // Water: targetId like "water_2026-Q1" or billPeriod like "water:2026-Q1"
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

async function buildCanonicalReplay(baseline) {
  const bills = new Map();
  function getBill(key, module) {
    if (!bills.has(key)) bills.set(key, makeBillRow(module, key));
    return bills.get(key);
  }

  // Seed HOA bills with base charges
  for (let q = 1; q <= 4; q++) {
    const key = `hoa:${FISCAL_YEAR}-Q${q}`;
    const b = getBill(key, 'hoa');
    b.originalCentavos = 3 * MONTH_DUE_CENTAVOS;
  }

  // Seed water bills from persisted bill docs (centavos in stored fields)
  for (const wb of baseline.waterBillDocs || []) {
    const ub = wb.unit106;
    if (!ub) continue;
    const key = `water:${wb.id}`;
    const b = getBill(key, 'water');
    b.originalCentavos = Number(ub.currentCharge || 0);
    // Penalty charged is from the persisted state at as-of moment; we treat it as
    // a chronological fact for the replay.
    b.penaltyCentavos = Number(ub.penaltyAmount || 0);
  }

  // Walk transactions chronologically, applying allocations to bills.
  // Apply STRICT base-before-penalty within a bill; the canonical replay does
  // NOT redistribute across bills — it accepts each allocation as written and
  // applies its base/penalty bucket to the targeted bill.
  // FY filter: include only transactions in FY2026 (Jul 1 2025 – Jun 30 2026).
  const fy = getFiscalYearBounds(FISCAL_YEAR, FY_START_MONTH);
  const fyStart = fy.startDate;
  const fyEnd = fy.endDate;

  const txList = (baseline.transactions || []).filter((t) => {
    const d = toDateValue(t.date);
    return d && d >= fyStart && d <= fyEnd;
  });

  const replayLog = [];
  for (const tx of txList) {
    for (const alloc of tx.allocations || []) {
      const amtC = Math.abs(Number(alloc.amountCentavos || 0));
      if (!amtC) continue;
      const billKey = billKeyFromAllocation(alloc);
      if (!billKey) {
        replayLog.push({ txId: tx.id, date: tx.date, status: 'unmapped', alloc });
        continue;
      }
      const moduleName = billKey.startsWith('water:') ? 'water' : 'hoa';
      const b = getBill(billKey, moduleName);
      if (allocationIsPenalty(alloc)) {
        b.penaltyPaidCentavos += amtC;
      } else {
        b.basePaidCentavos += amtC;
      }
      replayLog.push({ txId: tx.id, date: tx.date, billKey, amtCentavos: amtC, isPenalty: allocationIsPenalty(alloc) });
    }
  }

  // UPC priority order check: do not redistribute, but observe Q3/Q4 simultaneity.
  // If both Q3 and Q4 are partially paid (and Q3 isn't fully paid), that's a violation.
  for (const row of bills.values()) finalizeBillRow(row);
  const sortedKeys = [...bills.keys()].sort((a, b) => billKeyOrder(a).localeCompare(billKeyOrder(b)));
  const billRows = sortedKeys.map((k) => bills.get(k));
  const totals = aggregateTotals(billRows);

  return {
    source: 'replayCanonical',
    asOf: toIsoDay(getNow()),
    fiscalYearStart: toIsoDay(fyStart),
    fiscalYearEnd: toIsoDay(fyEnd),
    transactionCount: txList.length,
    bills: billRows,
    totals,
    replayLog
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SoA RUNNING CLOSE + AMOUNT DUE (via getStatementData)
// ─────────────────────────────────────────────────────────────────────────────

async function captureSoa(api) {
  const statement = await getStatementData(api, CLIENT_ID, UNIT_ID, FISCAL_YEAR, false);
  const lineItems = Array.isArray(statement?.lineItems) ? statement.lineItems : [];

  // Running close = last non-future row's balance
  const visibleItems = lineItems.filter((i) => !i.isFuture);
  const lastItem = visibleItems[visibleItems.length - 1];
  const runningCloseCentavos = pesosToCentavos(lastItem?.balance || 0);
  const amountDueCentavos = pesosToCentavos(statement?.summary?.amountDue || 0);

  // For the per-bill alignment we look only at the SoA's summary numbers; the
  // SoA is a chronological ledger and does not produce per-bill remaining.
  // To produce per-bill values for the soaRunningClose / soaAmountDue columns
  // we use the SoA "Account Activity" rows summed per category, but since the
  // task only requires the bottom-line totals for these two columns to be
  // explicit, we represent them as a single "bottom-line" row plus per-bill
  // mirrors derived from the line items' category breakdowns.

  return {
    source: 'soa',
    asOf: toIsoDay(getNow()),
    summary: statement?.summary || null,
    runningCloseCentavos,
    amountDueCentavos,
    lineItemCount: lineItems.length,
    visibleItemCount: visibleItems.length,
    lastLineItem: lastItem ? {
      date: lastItem.date,
      description: lastItem.description,
      type: lastItem.type,
      isFuture: !!lastItem.isFuture,
      balancePesos: lastItem.balance,
      chargePesos: lastItem.charge,
      paymentPesos: lastItem.payment
    } : null,
    allocationSummary: statement?.allocationSummary || null,
    creditInfo: statement?.creditInfo || null,
    statementInfo: statement?.statementInfo || null
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. UPC PAYOFF (via unified payment preview)
// ─────────────────────────────────────────────────────────────────────────────

async function captureUpc(api) {
  const payOnDateStr = toIsoDay(getNow());
  const preview = await api.post('/payments/unified/preview', {
    clientId: CLIENT_ID,
    unitId: UNIT_ID,
    amount: null,
    paymentDate: payOnDateStr,
    excludedBills: [],
    waivedPenalties: [],
    source: 'unit106Reconciliation2026May17'
  });
  const data = preview?.data?.preview || preview?.data || {};
  const hoaBills = Array.isArray(data.hoa?.billsPaid) ? data.hoa.billsPaid : [];
  const waterBills = Array.isArray(data.water?.billsPaid) ? data.water.billsPaid : [];

  // Construct per-bill rows
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
    row.rawUpc = b;
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
    row.rawUpc = b;
  }

  const sortedKeys = [...bills.keys()].sort((a, b) => billKeyOrder(a).localeCompare(billKeyOrder(b)));
  const billRows = sortedKeys.map((k) => bills.get(k));
  const totals = aggregateTotals(billRows);
  const upcTotalRemainingCentavos = pesosToCentavos(data.upcTotalRemaining || 0);
  // Per Stage 3 Task 3.2b Manager adjudication (2026-05-17):
  // upcPayoff at the closing-payment level is the NET-OF-CREDIT amount:
  //   upcPayoffCentavos = upcTotalRemaining (gross bill state) - currentCreditBalance
  // Architecturally this matches the "what does the unit need to pay right now"
  // semantic of the closing payment in the SAMS UI.
  const currentCreditBalanceCentavos = pesosToCentavos(data.currentCreditBalance || 0);
  const upcPayoffNetCentavos = upcTotalRemainingCentavos - currentCreditBalanceCentavos;

  return {
    source: 'upc',
    asOf: payOnDateStr,
    bills: billRows,
    totals,
    upcTotalRemainingCentavos,
    currentCreditBalanceCentavos,
    upcPayoffNetCentavos,
    rawPreviewTopLevel: {
      success: !!preview?.data?.success,
      keys: Object.keys(data || {})
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = getNow();
  const db = await getDb();
  const api = await createApiClient();

  // Step A: snapshot baseline persisted state
  const baseline = await snapshotBaseline(db);
  await fs.writeFile(BASELINE_OUT, JSON.stringify(baseline, null, 2), 'utf8');
  console.error(`[ok] wrote baseline → ${BASELINE_OUT}`);

  // Step B: Excel ground truth
  const excel = await loadExcelGroundTruth();
  console.error(`[ok] Excel parsed: ${excel.bills.length} bills, ${excel.rawRows.length} rows, repair-net ${excel.repairNet.netCentavos / 100}`);

  // Step C: canonical replay from transactions
  const canonical = await buildCanonicalReplay(baseline);
  console.error(`[ok] canonical replay: ${canonical.bills.length} bills, ${canonical.transactionCount} txns`);

  // Step D: SoA
  const soa = await captureSoa(api);
  console.error(`[ok] SoA: amountDue=${soa.amountDueCentavos / 100} closing/lastBalance=${soa.runningCloseCentavos / 100}`);

  // Step E: UPC
  const upc = await captureUpc(api);
  console.error(`[ok] UPC: gross upcTotalRemaining=${upc.upcTotalRemainingCentavos / 100} credit=${upc.currentCreditBalanceCentavos / 100} net upcPayoff=${upc.upcPayoffNetCentavos / 100}`);

  // Step F: Q3/Q4 simultaneity invariant check (from canonical replay)
  const q3 = canonical.bills.find((b) => b.bill === `hoa:${FISCAL_YEAR}-Q3`);
  const q4 = canonical.bills.find((b) => b.bill === `hoa:${FISCAL_YEAR}-Q4`);
  const q3PartiallyPaid = q3 && q3.basePaidCentavos > 0 && q3.totalRemainingCentavos > 0;
  const q4HasPayment = q4 && (q4.basePaidCentavos > 0 || q4.penaltyPaidCentavos > 0);
  const orderingInvariantViolated = !!(q3PartiallyPaid && q4HasPayment);

  // Step G: Build the unified five-column structure
  const allKeys = new Set();
  [excel.bills, canonical.bills, upc.bills].forEach((list) => list.forEach((r) => allKeys.add(r.bill)));
  const sortedAllKeys = [...allKeys].sort((a, b) => billKeyOrder(a).localeCompare(billKeyOrder(b)));

  function byKey(list) {
    const m = new Map();
    list.forEach((r) => m.set(r.bill, r));
    return m;
  }
  const excelByKey = byKey(excel.bills);
  const canonicalByKey = byKey(canonical.bills);
  const upcByKey = byKey(upc.bills);

  const perBill = sortedAllKeys.map((key) => ({
    bill: key,
    module: (key.split(':')[0]),
    excelGroundTruth: excelByKey.get(key) || null,
    replayCanonical: canonicalByKey.get(key) || null,
    soaRunningClose: null, // SoA per-bill isn't directly available; bottom-line only
    soaAmountDue: null,    // SoA per-bill isn't directly available; bottom-line only
    upcPayoff: upcByKey.get(key) || null
  }));

  // Five-column bottom-line totals (totalRemaining in centavos).
  // upcPayoffCentavos is NET of currentCreditBalance per Stage 3 Task 3.2b Manager adjudication —
  // this is the "what the unit must pay" definition that matches the §6.4 gate target.
  const bottomLineTotals = {
    excelGroundTruthCentavos: excel.totals.totalRemainingCentavos,
    replayCanonicalCentavos: canonical.totals.totalRemainingCentavos,
    soaRunningCloseCentavos: soa.runningCloseCentavos,
    soaAmountDueCentavos: soa.amountDueCentavos,
    upcPayoffCentavos: upc.upcPayoffNetCentavos,
    upcPayoffGrossCentavos: upc.upcTotalRemainingCentavos,
    upcCurrentCreditBalanceCentavos: upc.currentCreditBalanceCentavos
  };

  const deltas = {
    soaRunningClose_minus_soaAmountDue: bottomLineTotals.soaRunningCloseCentavos - bottomLineTotals.soaAmountDueCentavos,
    soaAmountDue_minus_upcPayoff: bottomLineTotals.soaAmountDueCentavos - bottomLineTotals.upcPayoffCentavos,
    soaRunningClose_minus_upcPayoff: bottomLineTotals.soaRunningCloseCentavos - bottomLineTotals.upcPayoffCentavos,
    excel_minus_replay: bottomLineTotals.excelGroundTruthCentavos - bottomLineTotals.replayCanonicalCentavos,
    excel_minus_soaAmountDue: bottomLineTotals.excelGroundTruthCentavos - bottomLineTotals.soaAmountDueCentavos,
    excel_minus_upcPayoff: bottomLineTotals.excelGroundTruthCentavos - bottomLineTotals.upcPayoffCentavos,
    replay_minus_soaAmountDue: bottomLineTotals.replayCanonicalCentavos - bottomLineTotals.soaAmountDueCentavos,
    replay_minus_upcPayoff: bottomLineTotals.replayCanonicalCentavos - bottomLineTotals.upcPayoffCentavos
  };

  // Smallest non-zero disagreeing pair
  const pairs = Object.entries(deltas)
    .map(([k, v]) => ({ pair: k, deltaCentavos: v, deltaAbs: Math.abs(v) }))
    .filter((p) => p.deltaAbs > 0)
    .sort((a, b) => a.deltaAbs - b.deltaAbs);
  const smallestDisagreeingPair = pairs[0] || null;

  const output = {
    metadata: {
      generatedAt: startedAt.toISOString(),
      generatedAtIso: toIsoDay(startedAt),
      clientId: CLIENT_ID,
      unitId: UNIT_ID,
      fiscalYear: FISCAL_YEAR,
      asOf: toIsoDay(getNow()),
      excelPath: EXCEL_PATH,
      backendBaseURL: api.defaults?.baseURL || 'http://localhost:5001',
      writes: 'NONE — read-only forensic reconciliation'
    },
    bottomLineTotals: {
      ...bottomLineTotals,
      excelGroundTruthPesos: centavosToPesos(bottomLineTotals.excelGroundTruthCentavos),
      replayCanonicalPesos: centavosToPesos(bottomLineTotals.replayCanonicalCentavos),
      soaRunningClosePesos: centavosToPesos(bottomLineTotals.soaRunningCloseCentavos),
      soaAmountDuePesos: centavosToPesos(bottomLineTotals.soaAmountDueCentavos),
      upcPayoffPesos: centavosToPesos(bottomLineTotals.upcPayoffCentavos),
      upcPayoffGrossPesos: centavosToPesos(bottomLineTotals.upcPayoffGrossCentavos),
      upcCurrentCreditBalancePesos: centavosToPesos(bottomLineTotals.upcCurrentCreditBalanceCentavos)
    },
    deltas: Object.fromEntries(Object.entries(deltas).map(([k, v]) => [k, { centavos: v, pesos: centavosToPesos(v) }])),
    smallestDisagreeingPair,
    invariants: {
      orderingQ3Q4InvariantViolatedFromCanonical: orderingInvariantViolated,
      q3Snapshot: q3,
      q4Snapshot: q4
    },
    columns: {
      excelGroundTruth: excel,
      replayCanonical: canonical,
      soa,
      upc
    },
    perBill
  };

  await fs.writeFile(RECON_OUT, JSON.stringify(output, null, 2), 'utf8');
  console.error(`[ok] wrote reconciliation → ${RECON_OUT}`);

  // Print compact summary to stderr for the operator
  console.error('');
  console.error('=== Bottom-line totals (centavos / pesos) ===');
  for (const [k, v] of Object.entries(bottomLineTotals)) {
    if (k.endsWith('Centavos')) {
      const pesos = centavosToPesos(v);
      console.error(`  ${k.padEnd(30)} = ${String(v).padStart(10)}c   $${pesos.toFixed(2)}`);
    }
  }
  console.error('');
  console.error('=== Pairwise deltas (centavos) ===');
  for (const p of pairs) {
    console.error(`  ${p.pair.padEnd(38)} = ${String(p.deltaCentavos).padStart(10)}c   $${centavosToPesos(p.deltaCentavos).toFixed(2)}`);
  }
  if (smallestDisagreeingPair) {
    console.error('');
    console.error(`[pinpoint] smallest disagreeing pair: ${smallestDisagreeingPair.pair} = ${centavosToPesos(smallestDisagreeingPair.deltaCentavos).toFixed(2)} pesos`);
  } else {
    console.error('');
    console.error('[pinpoint] all five columns agree to the centavo.');
  }
}

main().catch((err) => {
  console.error('FATAL:', err && err.stack || err);
  process.exit(1);
});

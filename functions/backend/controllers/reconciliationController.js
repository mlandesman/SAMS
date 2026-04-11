import admin from 'firebase-admin';
import { getDb, getApp } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import { parseBankFile } from '../services/bankParsers/index.js';
import {
  normalizeRowsForSession,
  filterBankRowsByStatementPeriod,
  normalizedRowInStatementPeriod
} from '../services/reconciliationNormalizer.js';
import {
  runMatchingAlgorithm,
  attachAccountForMatching,
  typeMatchesBank,
  txnMatchCentavos
} from '../services/reconciliationMatcher.js';
import {
  buildSpeiFeeFixUpdate,
  buildRoundingFixUpdate,
  applyTransactionAutoFix
} from '../services/reconciliationAutoFixService.js';
import { generateAndUploadReconciliationReport } from '../services/reconciliationReportService.js';
import { getStorageBucketName } from '../utils/storageBucketName.js';
import { fetchTransactionsForMatching } from '../services/reconciliationMatchingPool.js';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';
const TOLERANCE = 0.01;

function reconDebugLog(stage, payload) {
  try {
    console.log(`[recon-debug] ${stage}`, JSON.stringify(payload));
  } catch {
    console.log(`[recon-debug] ${stage}`, payload);
  }
}

function summarizeBankRows(rows, limit = 8) {
  return (rows || []).slice(0, limit).map((r) => ({
    rowIndex: r?.rowIndex ?? null,
    id: r?.id ?? null,
    date: r?.date ?? null,
    type: r?.type ?? null,
    amount: r?.amount ?? null,
    description: String(r?.description || '').slice(0, 120)
  }));
}

function txnDateIso(txn) {
  const d = txn?.date;
  if (d == null) return null;
  if (typeof d?.toDate === 'function') {
    const dt = d.toDate();
    return Number.isNaN(dt?.getTime?.()) ? null : dt.toISOString().slice(0, 10);
  }
  const sec = d?.seconds ?? d?._seconds;
  if (sec != null) {
    const dt = new Date(Number(sec) * 1000);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }
  if (typeof d === 'string' || typeof d === 'number') {
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    const s = String(d).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  return null;
}

function txnInStatementPeriod(txn, startDate, endDate) {
  const d = txnDateIso(txn);
  if (!d || !startDate || !endDate) return false;
  return d >= startDate && d <= endDate;
}

function summarizeTransactions(txns, limit = 8) {
  return (txns || []).slice(0, limit).map((t) => ({
    id: t?.id ?? null,
    date: txnDateIso(t),
    type: t?.type ?? null,
    amount: t?.amount ?? null,
    accountId: t?.accountId ?? null,
    clearedDate: t?.clearedDate ?? null,
    notes: String(t?.notes || t?.description || '').slice(0, 120)
  }));
}

async function deleteQueryInBatches(query, batchSize = 400) {
  const db = await getDb();
  while (true) {
    const snap = await query.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function uploadBufferToStorage(buffer, contentType, storagePath) {
  const app = await getApp();
  const bucketName = getStorageBucketName();
  const bucket = app.storage().bucket(bucketName);
  const file = bucket.file(storagePath);
  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: { uploadedAt: getNow().toISOString(), source: 'bank-reconciliation-import' }
    }
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucketName}/${storagePath}`;
}

async function deleteReconciliationArtifacts(clientId, sessionId) {
  const app = await getApp();
  const bucketName = getStorageBucketName();
  const bucket = app.storage().bucket(bucketName);
  const importsPrefix = `clients/${clientId}/reconciliation-imports/${sessionId}/`;
  const reportPath = `clients/${clientId}/reconciliation-reports/${sessionId}.pdf`;

  try {
    await bucket.deleteFiles({ prefix: importsPrefix, force: true });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (!message.includes('not found')) {
      throw new Error(`Failed to delete reconciliation imports: ${error.message || error}`);
    }
  }

  try {
    await bucket.file(reportPath).delete({ ignoreNotFound: true });
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (!message.includes('not found')) {
      throw new Error(`Failed to delete reconciliation report: ${error.message || error}`);
    }
  }
}

function inferBankFormat(accountName, explicit) {
  if (explicit === 'scotiabank' || explicit === 'bbva') return explicit;
  const n = String(accountName || '').toLowerCase();
  if (n.includes('scotia') || n.includes('scotiabank')) return 'scotiabank';
  if (n.includes('bbva')) return 'bbva';
  return null;
}

async function loadClientAccounts(clientId) {
  const db = await getDb();
  const ref = db.collection('clients').doc(clientId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error(`Client ${clientId} not found`);
  return doc.data().accounts || [];
}

function findAccount(accounts, accountId) {
  return accounts.find((a) => a.id === accountId && a.active !== false);
}

/** Signed centavo sum for statement period: ABONO increases balance, CARGO decreases (magnitude from normalized rows). */
function sumSignedBankMovementCentavos(normalizedRows, startDate, endDate) {
  let s = 0;
  for (const row of normalizedRows || []) {
    if (!normalizedRowInStatementPeriod(row, startDate, endDate)) continue;
    const a = Math.round(Number(row.amount) || 0);
    if (row.type === 'ABONO') s += a;
    else if (row.type === 'CARGO') s -= a;
  }
  return s;
}

function roundPesos2(x) {
  return Math.round(Number(x) * 100) / 100;
}

function allMatchTransactionIds(matchMap) {
  const ids = new Set();
  for (const m of matchMap || []) {
    if (m.transactionIds?.length) {
      for (const x of m.transactionIds) {
        if (x) ids.add(x);
      }
    } else if (m.transactionId) {
      ids.add(m.transactionId);
    }
    if (m.relatedTransactionIds?.length) {
      for (const x of m.relatedTransactionIds) ids.add(x);
    }
    if (m.feeGroupTransactionIds?.length) {
      for (const x of m.feeGroupTransactionIds) ids.add(x);
    }
  }
  return [...ids];
}

/**
 * SAMS rows still requiring action for Accept:
 * in matching window, uncleared, not in matchMap/exclusions, and inside statement period.
 * We keep ±7 day rows visible in workbench for convenience, but they no longer block Accept.
 */
async function listUnresolvedSamsInPool(clientId, session) {
  const pool = await fetchTransactionsForMatching(
    clientId,
    session.accountId,
    session.startDate,
    session.endDate
  );
  const matchedTxnIds = new Set(allMatchTransactionIds(session.matchMap || []));
  const excludedSamsIds = new Set(
    (session.reconciliationExclusions || [])
      .filter((e) => e.kind === 'sams')
      .map((e) => e.id)
  );
  return pool.filter(
    (t) =>
      !t.clearedDate &&
      !matchedTxnIds.has(t.id) &&
      !excludedSamsIds.has(t.id) &&
      txnInStatementPeriod(t, session.startDate, session.endDate)
  );
}

async function loadNormalizedRowsMap(clientId, sessionId) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const snap = await ref.collection('normalizedRows').get();
  const map = {};
  snap.forEach((d) => {
    map[d.id] = { id: d.id, ...d.data() };
  });
  return map;
}

function sumCentavosFromBankRows(normById, normalizedRowIds) {
  let sum = 0;
  for (const id of normalizedRowIds) {
    const row = normById[id];
    if (!row || row.amount == null) continue;
    sum += Math.abs(Math.round(Number(row.amount) || 0));
  }
  return sum;
}

/**
 * @param {string} clientId
 * @param {object} data
 * @param {object} user
 */
export async function createSession(clientId, data, user) {
  const accounts = await loadClientAccounts(clientId);
  const account = findAccount(accounts, data.accountId);
  if (!account || account.type !== 'bank') {
    throw new Error('Invalid or inactive bank account');
  }

  const bankFormat = inferBankFormat(account.name, data.bankFormat);
  if (!bankFormat) {
    throw new Error('Could not determine bank format — pass bankFormat "scotiabank" or "bbva"');
  }

  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc();
  const sessionId = ref.id;
  const now = admin.firestore.Timestamp.now();

  const payload = {
    id: sessionId,
    accountId: data.accountId,
    accountName: account.name,
    bankFormat,
    startDate: data.startDate,
    endDate: data.endDate,
    openingBalance: Number(data.openingBalance),
    endingBalance: Number(data.endingBalance),
    status: 'draft',
    accepted: false,
    acceptedAt: null,
    acceptedBy: null,
    differenceAmount: data.differenceAmount != null ? Number(data.differenceAmount) : 0,
    adjustmentTransactionIds: [],
    matchMap: [],
    unmatchedBankRows: [],
    unmatchedTransactions: [],
    bankPdfUrl: null,
    bankFileUrl: null,
    reconciliationReportUrl: null,
    reconciliationExclusions: [],
    created: now,
    updated: now,
    createdBy: user?.uid || user?.email || 'unknown'
  };

  await ref.set(payload);
  return { ...payload, created: now.toDate().toISOString(), updated: now.toDate().toISOString() };
}

export async function getSession(clientId, sessionId, options = {}) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');

  const base = doc.data();
  const bankSnap = await ref.collection('bankRows').count().get();
  const normSnap = await ref.collection('normalizedRows').count().get();

  const out = {
    id: sessionId,
    ...base,
    stats: {
      bankRowCount: bankSnap.data().count,
      normalizedRowCount: normSnap.data().count,
      ...(base.matchStats && typeof base.matchStats === 'object' ? base.matchStats : {})
    }
  };

  if (options.includeRows) {
    const [bn, nr] = await Promise.all([
      ref.collection('bankRows').get(),
      ref.collection('normalizedRows').get()
    ]);
    out.bankRows = bn.docs.map((d) => ({ id: d.id, ...d.data() }));
    out.normalizedRows = nr.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  return out;
}

export async function listSessions(clientId, accountId) {
  const db = await getDb();
  const snap = await db
    .collection(`clients/${clientId}/reconciliations`)
    .orderBy('created', 'desc')
    .get();
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (accountId) {
    rows = rows.filter((r) => r.accountId === accountId);
  }
  return rows;
}

export async function updateSession(clientId, sessionId, data) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');
  if (doc.data().accepted) throw new Error('Cannot update an accepted reconciliation');

  const allowed = [
    'openingBalance',
    'endingBalance',
    'startDate',
    'endDate',
    'differenceAmount',
    'adjustmentTransactionIds',
    'status',
    'bankPdfUrl',
    'bankFileUrl'
  ];
  const patch = {};
  for (const k of allowed) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  patch.updated = admin.firestore.Timestamp.now();
  await ref.update(patch);
  const next = await ref.get();
  return { id: sessionId, ...next.data() };
}

export async function deleteSession(clientId, sessionId) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');
  const session = doc.data() || {};
  if (session.accepted) {
    throw new Error('Accepted sessions cannot be deleted');
  }

  await deleteReconciliationArtifacts(clientId, sessionId);
  await deleteQueryInBatches(ref.collection('bankRows'));
  await deleteQueryInBatches(ref.collection('normalizedRows'));
  await ref.delete();
  return { success: true };
}

/**
 * @param {object} files — multer: { bankFile?: Express.Multer.File[], statementPdf?: ... }
 */
export async function importBankFile(clientId, sessionId, files, _user) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');
  const session = doc.data();
  if (session.accepted) throw new Error('Session already accepted');

  const bankFile = files?.bankFile?.[0];
  if (!bankFile?.buffer) {
    throw new Error('bankFile is required');
  }

  const { bankRows: parsedRows, errors: parseErrors } = await parseBankFile(
    bankFile.buffer,
    session.bankFormat,
    bankFile.originalname
  );
  reconDebugLog('import.parse', {
    clientId,
    sessionId,
    bankFormat: session.bankFormat,
    file: bankFile.originalname,
    parsedRows: parsedRows.length,
    parseErrors: parseErrors.length,
    sampleParsedRows: summarizeBankRows(parsedRows)
  });

  const beforeFilter = parsedRows.length;
  const bankRows = filterBankRowsByStatementPeriod(parsedRows, session.startDate, session.endDate);
  const errors = [...parseErrors];
  const prevDay = new Date(`${session.startDate}T00:00:00Z`);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  const prevDayIso = prevDay.toISOString().slice(0, 10);
  reconDebugLog('import.filter', {
    clientId,
    sessionId,
    period: { start: session.startDate, end: session.endDate },
    parsedBeforeFilter: beforeFilter,
    keptAfterFilter: bankRows.length,
    droppedOutsidePeriod: beforeFilter - bankRows.length,
    rowsOnStartDateFromParser: summarizeBankRows(parsedRows.filter((r) => r?.date === session.startDate), 20),
    rowsOnPrevDateFromParser: summarizeBankRows(parsedRows.filter((r) => r?.date === prevDayIso), 20),
    sampleKeptRows: summarizeBankRows(bankRows)
  });
  if (beforeFilter > bankRows.length) {
    errors.push(
      `Excluded ${beforeFilter - bankRows.length} bank line(s) outside statement period ${session.startDate}–${session.endDate}.`
    );
  }
  if (bankRows.length === 0) {
    throw new Error(
      `No bank movements fall within ${session.startDate}–${session.endDate}. Adjust the period or use a file that covers these dates.`
    );
  }

  await deleteQueryInBatches(ref.collection('bankRows'));
  await deleteQueryInBatches(ref.collection('normalizedRows'));

  let batch = db.batch();
  let count = 0;
  for (const row of bankRows) {
    const rref = ref.collection('bankRows').doc(row.id);
    batch.set(rref, row);
    count += 1;
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();

  const normalized = normalizeRowsForSession(session.bankFormat, bankRows);
  reconDebugLog('import.normalize', {
    clientId,
    sessionId,
    bankFormat: session.bankFormat,
    normalizedRows: normalized.length,
    netBankMovementCentavos: sumSignedBankMovementCentavos(
      normalized,
      session.startDate,
      session.endDate
    ),
    sampleNormalizedRows: summarizeBankRows(normalized)
  });
  batch = db.batch();
  count = 0;
  for (const nr of normalized) {
    const docRef = ref.collection('normalizedRows').doc();
    batch.set(docRef, { id: docRef.id, ...nr });
    count += 1;
    if (count >= 400) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();

  let bankFileUrl = session.bankFileUrl;
  if (bankFile.buffer?.length) {
    const ext = session.bankFormat === 'bbva' ? 'xlsx' : 'csv';
    bankFileUrl = await uploadBufferToStorage(
      bankFile.buffer,
      bankFile.mimetype || 'application/octet-stream',
      `clients/${clientId}/reconciliation-imports/${sessionId}/bank.${ext}`
    );
  }

  let bankPdfUrl = session.bankPdfUrl;
  const pdf = files?.statementPdf?.[0];
  if (pdf?.buffer?.length) {
    bankPdfUrl = await uploadBufferToStorage(
      pdf.buffer,
      pdf.mimetype || 'application/pdf',
      `clients/${clientId}/reconciliation-imports/${sessionId}/statement.pdf`
    );
  }

  await ref.update({
    bankFileUrl,
    bankPdfUrl,
    status: 'matching',
    updated: admin.firestore.Timestamp.now()
  });

  const normSnap = await ref.collection('normalizedRows').get();
  return {
    success: true,
    parseErrors: errors,
    bankRowCount: bankRows.length,
    normalizedRowCount: normSnap.size
  };
}

export async function runMatch(clientId, sessionId) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');
  const session = doc.data();
  if (session.accepted) throw new Error('Session already accepted');

  const normSnap = await ref.collection('normalizedRows').get();
  const normalizedRows = [];
  normSnap.forEach((d) => normalizedRows.push({ id: d.id, ...d.data() }));
  const normalizedRowsInPeriod = normalizedRows.filter((nr) =>
    normalizedRowInStatementPeriod(nr, session.startDate, session.endDate)
  );
  reconDebugLog('match.normalized', {
    clientId,
    sessionId,
    period: { start: session.startDate, end: session.endDate },
    normalizedTotal: normalizedRows.length,
    normalizedInPeriod: normalizedRowsInPeriod.length,
    rowsOnStartDate: summarizeBankRows(normalizedRowsInPeriod.filter((r) => r?.date === session.startDate), 20),
    sampleNormalizedInPeriod: summarizeBankRows(normalizedRowsInPeriod)
  });

  const rawTxns = await fetchTransactionsForMatching(
    clientId,
    session.accountId,
    session.startDate,
    session.endDate
  );

  /** Zero-centavo SAMS lines (credit-balance / non-cash usage): auto-justify (document + clear on Accept). */
  const existingExcl = session.reconciliationExclusions || [];
  const zeroAutoJustifiedMatches = [];
  for (const t of rawTxns) {
    const cents = Math.round(Number(t.amount) || 0);
    if (cents !== 0) continue;
    const tid = String(t.id);
    zeroAutoJustifiedMatches.push({
      normalizedRowId: null,
      transactionId: tid,
      matchType: 'manual-justified',
      justification: 'Zero amount — non-cash / credit balance usage (auto on match)'
    });
  }
  const rawTxnsForMatch = rawTxns.filter((t) => Math.round(Number(t.amount) || 0) !== 0);
  const reconciliationExclusions = existingExcl;
  reconDebugLog('match.pool', {
    clientId,
    sessionId,
    fetchedTxnCount: rawTxns.length,
    matchableTxnCount: rawTxnsForMatch.length,
    zeroAutoJustified: zeroAutoJustifiedMatches.length,
    txnsOnStartDate: summarizeTransactions(rawTxnsForMatch.filter((t) => txnDateIso(t) === session.startDate), 20),
    sampleTxnsForMatch: summarizeTransactions(rawTxnsForMatch)
  });

  const withAccount = attachAccountForMatching(normalizedRowsInPeriod, session.accountId);
  const result = runMatchingAlgorithm(withAccount, rawTxnsForMatch, {
    bankFormat: session.bankFormat || null
  });
  reconDebugLog('match.result', {
    clientId,
    sessionId,
    stats: result.stats,
    matches: result.matches.length,
    unmatchedBankRows: result.unmatchedBankRows.length,
    unmatchedTransactions: result.unmatchedTransactions.length,
    unmatchedBankSample: result.unmatchedBankRows.slice(0, 20),
    unmatchedTxnSample: result.unmatchedTransactions.slice(0, 20)
  });

  const normById = Object.fromEntries(normalizedRowsInPeriod.map((r) => [r.id, r]));

  /**
   * Auto-fix SAMS cash + allocations for rounding / SPEI (see reconciliationAutoFixService).
   * `clearedDate` is still set only on Accept — here we only align txn.amount with the bank.
   * A transaction is "consumed" for matching by being in matchMap; clearedDate locks edits later.
   */
  for (const m of result.matches) {
    if (!m.autoFix) continue;
    const nr = normById[m.normalizedRowId];
    if (!nr) throw new Error(`Normalized row ${m.normalizedRowId} missing for auto-fix`);
    const tref = db.doc(`clients/${clientId}/transactions/${m.transactionId}`);
    const tdoc = await tref.get();
    if (!tdoc.exists) throw new Error(`Transaction ${m.transactionId} not found for auto-fix`);
    const txn = tdoc.data();
    let patch;
    if (m.autoFix === 'spei-fee') {
      patch = await buildSpeiFeeFixUpdate(clientId, txn, nr.amount);
    } else if (m.autoFix === 'rounding') {
      const delta = m.fixData?.deltaCentavos ?? m.roundingDeltaCentavos;
      patch = await buildRoundingFixUpdate(clientId, txn, nr.amount, delta);
    } else {
      continue;
    }
    const applied = await applyTransactionAutoFix(clientId, m.transactionId, patch);
    if (!applied.ok) throw new Error(applied.error || 'Auto-fix failed');
  }

  const autoMatchMap = result.matches.map((m) => ({
    transactionId: m.transactionId,
    normalizedRowId: m.normalizedRowId,
    matchType: m.matchType,
    justification: null,
    relatedTransactionIds: m.feeGroupTransactionIds?.slice(1) || m.relatedTransactionIds || [],
    ...(m.speiFeeGapCentavos != null ? { speiFeeGapCentavos: m.speiFeeGapCentavos } : {}),
    ...(m.roundingDeltaCentavos != null ? { roundingDeltaCentavos: m.roundingDeltaCentavos } : {}),
    ...(m.autoFix ? { autoFix: m.autoFix, samsAutoFixApplied: true } : {})
  }));
  const matchMap = [...autoMatchMap, ...zeroAutoJustifiedMatches];

  const matchStats = {
    exact: result.stats.exact,
    dateDrift: result.stats.dateDrift,
    roundingExact: result.stats.roundingExact,
    roundingDrift: result.stats.roundingDrift,
    speiFeeGapExact: result.stats.speiFeeGapExact,
    speiFeeGapDrift: result.stats.speiFeeGapDrift,
    feeAdjusted: result.stats.feeAdjusted,
    matchedCount: matchMap.length,
    unmatchedBankCount: result.unmatchedBankRows.length,
    unmatchedTxnCount: result.unmatchedTransactions.length
  };

  await ref.update({
    matchMap,
    matchStats,
    unmatchedBankRows: result.unmatchedBankRows,
    unmatchedTransactions: result.unmatchedTransactions,
    reconciliationExclusions,
    status: 'reviewing',
    updated: admin.firestore.Timestamp.now()
  });

  return {
    success: true,
    ...result,
    matchMap,
    matchStats,
    zeroAmountAutoJustified: zeroAutoJustifiedMatches.length
  };
}

export async function resolveException(clientId, sessionId, body) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');
  const session = doc.data();
  if (session.accepted) throw new Error('Session already accepted');

  const action = body.action;
  let matchMap = [...(session.matchMap || [])];
  let unmatchedBankRows = [...(session.unmatchedBankRows || [])];
  let unmatchedTransactions = [...(session.unmatchedTransactions || [])];

  if (action === 'manual-match') {
    const { normalizedRowId, transactionId } = body;
    if (!normalizedRowId || !transactionId) throw new Error('normalizedRowId and transactionId required');
    matchMap.push({
      normalizedRowId,
      transactionId,
      matchType: 'manual-match',
      justification: body.justification || null
    });
    unmatchedBankRows = unmatchedBankRows.filter((id) => id !== normalizedRowId);
    unmatchedTransactions = unmatchedTransactions.filter((id) => id !== transactionId);
  } else if (action === 'manual-justify') {
    const { transactionId, justification } = body;
    if (!transactionId || !justification) throw new Error('transactionId and justification required');
    matchMap.push({
      normalizedRowId: null,
      transactionId,
      matchType: 'manual-justified',
      justification
    });
    unmatchedTransactions = unmatchedTransactions.filter((id) => id !== transactionId);
  } else {
    throw new Error('Unknown resolve action');
  }

  await ref.update({
    matchMap,
    unmatchedBankRows,
    unmatchedTransactions,
    updated: admin.firestore.Timestamp.now()
  });

  return { success: true, matchMap, unmatchedBankRows, unmatchedTransactions };
}

/**
 * Manual many-to-many: N bank lines ↔ M SAMS txns when centavo sums match exactly.
 */
async function manualGroupMatchSession(clientId, sessionId, body) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');
  const session = doc.data();
  if (session.accepted) throw new Error('Session already accepted');

  const rawBank = body.normalizedRowIds;
  const rawTxn = body.transactionIds;
  const normalizedRowIds = [...new Set((rawBank || []).map(String).filter(Boolean))];
  const transactionIds = [...new Set((rawTxn || []).map(String).filter(Boolean))];
  if (normalizedRowIds.length === 0 || transactionIds.length === 0) {
    throw new Error('Select at least one bank line and one SAMS transaction');
  }

  const unmatchedBankRows = new Set(session.unmatchedBankRows || []);
  const unmatchedTransactions = new Set(session.unmatchedTransactions || []);
  const matchedTxnIds = new Set(allMatchTransactionIds(session.matchMap || []));
  const pool = await fetchTransactionsForMatching(
    clientId,
    session.accountId,
    session.startDate,
    session.endDate
  );
  const poolIds = new Set(pool.map((t) => t.id));

  for (const id of normalizedRowIds) {
    if (!unmatchedBankRows.has(id)) {
      throw new Error(`Bank line ${id} is not unmatched in this session`);
    }
  }

  const normById = await loadNormalizedRowsMap(clientId, sessionId);
  for (const id of normalizedRowIds) {
    if (!normById[id]) throw new Error(`Normalized bank row ${id} not found`);
  }

  const bankTypes = [...new Set(normalizedRowIds.map((id) => normById[id]?.type).filter(Boolean))];
  if (bankTypes.length !== 1) {
    throw new Error('All selected bank lines must be the same type (all CARGO or all ABONO).');
  }
  const bankType = bankTypes[0];
  if (bankType !== 'CARGO' && bankType !== 'ABONO') {
    throw new Error(`Unsupported bank line type for manual group: ${bankType}`);
  }

  for (const id of transactionIds) {
    const inInitialUnmatched = unmatchedTransactions.has(id);
    const inPool = poolIds.has(id);
    if (!inInitialUnmatched && !inPool) {
      throw new Error(
        `SAMS transaction ${id} is not in this session window (import pool) or initial unmatched list`
      );
    }
    if (matchedTxnIds.has(id)) {
      throw new Error(`SAMS transaction ${id} is already matched in this session`);
    }
  }

  let txnComparableSum = 0;
  for (const tid of transactionIds) {
    const tref = db.doc(`clients/${clientId}/transactions/${tid}`);
    const tdoc = await tref.get();
    if (!tdoc.exists) throw new Error(`Transaction ${tid} not found`);
    const t = tdoc.data();
    if (t.accountId !== session.accountId) {
      throw new Error(`Transaction ${tid} is not in this session bank account`);
    }
    if (!typeMatchesBank(bankType, t)) {
      throw new Error(
        `Transaction ${tid} is not compatible with ${bankType} bank lines (check type and amount sign)`
      );
    }
    const tc = txnMatchCentavos(t);
    txnComparableSum += Math.abs(tc);
  }

  const bankSum = sumCentavosFromBankRows(normById, normalizedRowIds);
  if (bankSum !== txnComparableSum) {
    throw new Error(
      `Amounts must match exactly to pair (bank total ${bankSum}¢ vs SAMS comparable total ${txnComparableSum}¢)`
    );
  }

  const matchMap = [...(session.matchMap || [])];
  matchMap.push({
    normalizedRowIds,
    transactionIds,
    normalizedRowId: normalizedRowIds[0],
    transactionId: transactionIds[0],
    matchType: 'manual-group',
    justification: body.justification || null
  });

  const nextUnmatchedBank = (session.unmatchedBankRows || []).filter((id) => !normalizedRowIds.includes(id));
  const nextUnmatchedTxn = (session.unmatchedTransactions || []).filter((id) => !transactionIds.includes(id));

  await ref.update({
    matchMap,
    unmatchedBankRows: nextUnmatchedBank,
    unmatchedTransactions: nextUnmatchedTxn,
    updated: admin.firestore.Timestamp.now()
  });

  return {
    success: true,
    matchMap,
    unmatchedBankRows: nextUnmatchedBank,
    unmatchedTransactions: nextUnmatchedTxn
  };
}

/**
 * Manual pair: legacy single id pair, or many-to-many via normalizedRowIds + transactionIds arrays.
 * Does not set clearedDate; session matchMap only until Accept.
 */
export async function manualPairSession(clientId, sessionId, body = {}) {
  const rowArr = body.normalizedRowIds;
  const txnArr = body.transactionIds;
  if (Array.isArray(rowArr) && rowArr.length > 0 && Array.isArray(txnArr) && txnArr.length > 0) {
    return manualGroupMatchSession(clientId, sessionId, body);
  }
  return resolveException(clientId, sessionId, {
    action: 'manual-match',
    normalizedRowId: body.normalizedRowId,
    transactionId: body.transactionId,
    justification: body.justification || null
  });
}

/**
 * Exclude a bank line or SAMS txn from this session with a stored reason (no window.prompt).
 */
export async function excludeFromReconciliation(clientId, sessionId, body) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');
  const session = doc.data();
  if (session.accepted) throw new Error('Session already accepted');

  const { type, normalizedRowId, transactionId, reason } = body || {};
  const r = String(reason || '').trim();
  if (!r) throw new Error('reason is required');

  const exclusions = [...(session.reconciliationExclusions || [])];
  let unmatchedBankRows = [...(session.unmatchedBankRows || [])];
  let unmatchedTransactions = [...(session.unmatchedTransactions || [])];

  if (type === 'bank') {
    if (!normalizedRowId) throw new Error('normalizedRowId required for bank exclusion');
    exclusions.push({ kind: 'bank', id: normalizedRowId, reason: r, at: getNow().toISOString() });
    unmatchedBankRows = unmatchedBankRows.filter((id) => id !== normalizedRowId);
  } else if (type === 'sams') {
    if (!transactionId) throw new Error('transactionId required for SAMS exclusion');
    exclusions.push({ kind: 'sams', id: transactionId, reason: r, at: getNow().toISOString() });
    unmatchedTransactions = unmatchedTransactions.filter((id) => id !== transactionId);
  } else {
    throw new Error('type must be "bank" or "sams"');
  }

  await ref.update({
    reconciliationExclusions: exclusions,
    unmatchedBankRows,
    unmatchedTransactions,
    updated: admin.firestore.Timestamp.now()
  });

  return {
    success: true,
    reconciliationExclusions: exclusions,
    unmatchedBankRows,
    unmatchedTransactions
  };
}

/**
 * Create a single Bank Adjustments transaction dated to the session end date (same path as Accounts → reconciliation).
 * Server recomputes the signed gap from the current session and selected ids (client cannot spoof amount).
 * Amount may be any size; positive or negative per CARGO/ABONO semantics. Requires a written justification.
 */
export async function applyMatchGapAdjustment(clientId, sessionId, body, user) {
  const justification = String(body?.justification ?? body?.reason ?? '').trim();
  if (!justification) {
    throw new Error('Justification is required.');
  }

  const normalizedRowIds = [...new Set((body?.normalizedRowIds || []).map(String))];
  const transactionIds = [...new Set((body?.transactionIds || []).map(String))];

  if (normalizedRowIds.length === 0 || transactionIds.length === 0) {
    throw new Error('Select at least one bank line and one SAMS line.');
  }

  const session = await getSession(clientId, sessionId, { includeRows: true });
  if (session.accepted) throw new Error('Session already accepted');

  const unmatchedSet = new Set(session.unmatchedBankRows || []);
  const normById = Object.fromEntries((session.normalizedRows || []).map((row) => [row.id, row]));

  for (const id of normalizedRowIds) {
    if (!unmatchedSet.has(id)) {
      throw new Error(`Bank line is not in the current unmatched set (refresh the workbench).`);
    }
    const row = normById[id];
    if (!row) throw new Error(`Bank line ${id} not found.`);
    if (!normalizedRowInStatementPeriod(row, session.startDate, session.endDate)) {
      throw new Error(`Bank line ${id} is outside the statement period.`);
    }
  }

  const bankTypes = [...new Set(normalizedRowIds.map((id) => normById[id]?.type).filter(Boolean))];
  if (bankTypes.length !== 1 || (bankTypes[0] !== 'CARGO' && bankTypes[0] !== 'ABONO')) {
    throw new Error('Selected bank lines must all be CARGO or all ABONO.');
  }
  const bankType = bankTypes[0];

  let bankSum = 0;
  for (const id of normalizedRowIds) {
    bankSum += Math.abs(Math.round(Number(normById[id].amount) || 0));
  }

  const matchedTxnIds = new Set(allMatchTransactionIds(session.matchMap || []));
  const excludedSamsIds = new Set(
    (session.reconciliationExclusions || []).filter((e) => e.kind === 'sams').map((e) => e.id)
  );

  const pool = await fetchTransactionsForMatching(
    clientId,
    session.accountId,
    session.startDate,
    session.endDate
  );
  const poolById = Object.fromEntries(pool.map((t) => [t.id, t]));

  for (const tid of transactionIds) {
    const t = poolById[tid];
    if (!t) {
      throw new Error(`SAMS transaction ${tid} is not in the matching window.`);
    }
    if (t.clearedDate) {
      throw new Error(`SAMS transaction ${tid} is already cleared.`);
    }
    if (matchedTxnIds.has(tid)) {
      throw new Error(`SAMS transaction ${tid} is already matched.`);
    }
    if (excludedSamsIds.has(tid)) {
      throw new Error(`SAMS transaction ${tid} is excluded from this session.`);
    }
    if (!typeMatchesBank(bankType, t)) {
      throw new Error(`SAMS transaction ${tid} is not valid for ${bankType}.`);
    }
  }

  let txnSum = 0;
  for (const tid of transactionIds) {
    txnSum += Math.abs(Math.round(txnMatchCentavos(poolById[tid])));
  }

  const gap = bankSum - txnSum;
  if (gap === 0) {
    throw new Error('Difference is zero — use Match selected or change your selection.');
  }

  const differencePesos = bankType === 'CARGO' ? -(gap / 100) : gap / 100;

  const asOfDate = session.endDate;
  if (!asOfDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate))) {
    throw new Error('Session end date is invalid; cannot date the adjustment.');
  }

  const { createReconciliationAdjustments } = await import('./accountsController.js');
  const results = await createReconciliationAdjustments(
    clientId,
    [
      {
        accountId: session.accountId,
        accountName: session.accountName || 'Bank',
        samsBalance: 0,
        actualBalance: 0,
        difference: differencePesos,
        asOfDate: String(asOfDate),
        description: `Bank reconciliation adjustment (${session.accountName || session.accountId})`,
        notes: `Workbench match-gap: ${gap}¢ (${bankType}). Session ${sessionId}. Bank lines: ${normalizedRowIds.length}, SAMS lines: ${transactionIds.length}. Justification: ${justification}`,
        extraMetadata: {
          reconciliationKind: 'workbench-match-gap',
          reconciliationSessionId: sessionId,
          matchGapCentavos: gap,
          bankType,
          normalizedRowIds,
          transactionIds,
          justification,
          justifiedBy: user?.email || null
        }
      }
    ],
    user
  );

  const txnId = results[0]?.transactionId;
  if (!txnId) {
    throw new Error('Adjustment was not created.');
  }

  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  await ref.update({
    adjustmentTransactionIds: admin.firestore.FieldValue.arrayUnion(txnId),
    updated: admin.firestore.Timestamp.now()
  });

  return {
    success: true,
    transactionId: txnId,
    gapCentavos: gap,
    bankType,
    differencePesos
  };
}

/**
 * Workbench payload: unmatched bank rows (read-only), uncleared SAMS pool (statement window ±7 days),
 * matched items, session stats. Single source of truth remains the session document.
 */
export async function getWorkbench(clientId, sessionId) {
  const session = await getSession(clientId, sessionId, { includeRows: true });
  if (!session) throw new Error('Reconciliation session not found');

  const normList = session.normalizedRows || [];
  const normById = Object.fromEntries(normList.map((row) => [row.id, row]));

  const unmatchedBankDetails = (session.unmatchedBankRows || [])
    .map((id) => {
      const row = normById[id];
      return row ? { ...row } : { id, missing: true };
    })
    .filter(
      (row) =>
        row.missing ||
        normalizedRowInStatementPeriod(row, session.startDate, session.endDate)
    );

  const matchedTxnIds = new Set(allMatchTransactionIds(session.matchMap || []));
  const excludedSamsIds = new Set(
    (session.reconciliationExclusions || [])
      .filter((e) => e.kind === 'sams')
      .map((e) => e.id)
  );

  const pool = await fetchTransactionsForMatching(
    clientId,
    session.accountId,
    session.startDate,
    session.endDate
  );

  const availableSamsTransactions = pool.filter((t) => {
    if (t.clearedDate) return false;
    if (matchedTxnIds.has(t.id)) return false;
    if (excludedSamsIds.has(t.id)) return false;
    return true;
  });

  const bankUnmatchedTotalCentavos = unmatchedBankDetails.reduce((sum, row) => {
    if (row.missing || row.amount == null) return sum;
    return sum + (typeof row.amount === 'number' ? row.amount : 0);
  }, 0);

  const samsAvailableTotalCentavos = availableSamsTransactions.reduce(
    (sum, t) => sum + Math.round(t.amount || 0),
    0
  );

  const accountsForBalance = await loadClientAccounts(clientId);
  const accForSession = findAccount(accountsForBalance, session.accountId);
  const samsBalanceCentavos =
    accForSession != null ? Math.round(Number(accForSession.balance) || 0) : null;
  const statementOpeningPesos = roundPesos2(session.openingBalance ?? 0);
  const statementEndingPesos = roundPesos2(session.endingBalance ?? 0);
  const samsBalancePesos =
    samsBalanceCentavos != null ? roundPesos2(centavosToPesos(samsBalanceCentavos)) : null;
  const samsVsStatementGapPesos =
    samsBalancePesos != null ? roundPesos2(samsBalancePesos - statementEndingPesos) : null;

  const netBankMovementCentavos = sumSignedBankMovementCentavos(
    normList,
    session.startDate,
    session.endDate
  );
  const impliedEndingFromImportPesos = roundPesos2(
    statementOpeningPesos + centavosToPesos(netBankMovementCentavos)
  );
  const importVsEnteredEndingGapPesos = roundPesos2(
    impliedEndingFromImportPesos - statementEndingPesos
  );
  const unresolvedInPeriodCount = availableSamsTransactions.filter((t) =>
    txnInStatementPeriod(t, session.startDate, session.endDate)
  ).length;

  return {
    success: true,
    session,
    unmatchedBankDetails,
    availableSamsTransactions,
    matchedItems: session.matchMap || [],
    reconciliationExclusions: session.reconciliationExclusions || [],
    balanceVsStatement: {
      statementOpeningPesos,
      statementEndingPesos,
      samsBalanceCentavos,
      samsBalancePesos,
      /** SAMS stored ledger balance minus statement ending you entered (pesos). */
      samsVsStatementGapPesos,
      netBankMovementCentavos,
      impliedEndingFromImportPesos,
      /** Opening + signed imported bank lines in period − entered statement ending (pesos). */
      importVsEnteredEndingGapPesos
    },
    stats: {
      ...(session.matchStats || {}),
      bankUnmatchedTotalCentavos,
      samsAvailableTotalCentavos,
      unresolvedInPeriodCount,
      unmatchedBankLineCount: unmatchedBankDetails.length,
      availableSamsCount: availableSamsTransactions.length
    }
  };
}

/**
 * Sets `clearedDate` (ISO YYYY-MM-DD = session end) on every transaction in matchMap.
 * There is no separate “cleared flag”: uncleared = clearedDate absent; cleared = present.
 * Matching consumes rows for pairing only; this call applies the bank recon lock for the period.
 */
export async function acceptSession(clientId, sessionId, user, options = {}) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');
  const session = doc.data();
  if (session.accepted) throw new Error('Session already accepted');

  const unmatchedB = session.unmatchedBankRows || [];
  // Every bank line must be matched or excluded.
  if (unmatchedB.length > 0) {
    throw new Error('Every bank statement line must be matched or excluded before accepting.');
  }
  const openPool = await listUnresolvedSamsInPool(clientId, session);
  if (openPool.length > 0) {
    throw new Error(
      `All SAMS lines inside the statement period must be matched, justified, or excluded before accepting (${openPool.length} still open).`
    );
  }

  const diff = Number(session.differenceAmount || 0);
  if (Math.abs(diff) > TOLERANCE) {
    throw new Error(`Difference must be zero to accept (currently ${diff})`);
  }

  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  const clientName = clientDoc.data()?.basicInfo?.displayName || clientId;

  const matchMap = session.matchMap || [];
  const txnIds = allMatchTransactionIds(matchMap);
  const clearedIso = session.endDate;

  // Generate report before mutating transactions so we never set clearedDate if PDF fails.
  const reportUrl = await generateAndUploadReconciliationReport({
    clientId,
    sessionId,
    session: { ...session, matchMap },
    clientDisplayName: clientName,
    acceptedByEmail: user?.email || ''
  });

  let batch = db.batch();
  let n = 0;
  for (const tid of txnIds) {
    const tref = db.doc(`clients/${clientId}/transactions/${tid}`);
    batch.update(tref, {
      clearedDate: clearedIso,
      updated: admin.firestore.Timestamp.now()
    });
    n += 1;
    if (n >= 400) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  }
  if (n > 0) await batch.commit();

  await ref.update({
    accepted: true,
    acceptedAt: admin.firestore.Timestamp.now(),
    acceptedBy: user?.uid || null,
    status: 'accepted',
    reconciliationReportUrl: reportUrl,
    updated: admin.firestore.Timestamp.now(),
    adjustmentTransactionIds: options.adjustmentTransactionIds || session.adjustmentTransactionIds || []
  });

  return { success: true, reconciliationReportUrl: reportUrl };
}

/**
 * Rebuild the reconciliation PDF from the saved session document, normalizedRows subcollection,
 * and current transaction documents. Does not re-run Accept or change clearedDate.
 * Updates `reconciliationReportUrl` on the session (useful after clearing txns in dev or report template changes).
 */
export async function regenerateReconciliationReport(clientId, sessionId, user) {
  const db = await getDb();
  const ref = db.collection(`clients/${clientId}/reconciliations`).doc(sessionId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Reconciliation session not found');
  const session = doc.data();
  const matchMap = session.matchMap || [];

  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  const clientName = clientDoc.data()?.basicInfo?.displayName || clientId;

  const reportUrl = await generateAndUploadReconciliationReport({
    clientId,
    sessionId,
    session: { ...session, matchMap },
    clientDisplayName: clientName,
    acceptedByEmail: user?.email || 'report-regeneration'
  });

  await ref.update({
    reconciliationReportUrl: reportUrl,
    updated: admin.firestore.Timestamp.now()
  });

  return { success: true, reconciliationReportUrl: reportUrl };
}

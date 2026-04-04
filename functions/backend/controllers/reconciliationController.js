import admin from 'firebase-admin';
import { DateTime } from 'luxon';
import { getDb, toFirestoreTimestamp, getApp } from '../firebase.js';
import { getNow } from '../services/DateService.js';
import { parseBankFile } from '../services/bankParsers/index.js';
import {
  normalizeRowsForSession,
  filterBankRowsByStatementPeriod,
  normalizedRowInStatementPeriod
} from '../services/reconciliationNormalizer.js';
import {
  runMatchingAlgorithm,
  attachAccountForMatching
} from '../services/reconciliationMatcher.js';
import {
  buildSpeiFeeFixUpdate,
  buildRoundingFixUpdate,
  applyTransactionAutoFix
} from '../services/reconciliationAutoFixService.js';
import { generateAndUploadReconciliationReport } from '../services/reconciliationReportService.js';
import { getStorageBucketName } from '../utils/storageBucketName.js';
const TOLERANCE = 0.01;

/**
 * SAMS transactions loaded for pairing extend this many days **before** statement start and **after**
 * statement end (America/Cancun). Bank lines stay strictly within the session period; SAMS can lag
 * (weekends, SPEI settlement) so we widen the register query only.
 */
const SAMS_MATCHING_SLACK_DAYS = 7;

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

async function fetchTransactionsForMatching(clientId, accountId, startIso, endIso) {
  const db = await getDb();
  const start = DateTime.fromISO(startIso, { zone: 'America/Cancun' })
    .minus({ days: SAMS_MATCHING_SLACK_DAYS })
    .startOf('day');
  const end = DateTime.fromISO(endIso, { zone: 'America/Cancun' })
    .plus({ days: SAMS_MATCHING_SLACK_DAYS })
    .endOf('day');

  const snap = await db
    .collection(`clients/${clientId}/transactions`)
    .where('date', '>=', toFirestoreTimestamp(start.toJSDate()))
    .where('date', '<=', toFirestoreTimestamp(end.toJSDate()))
    .get();

  const out = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (d.accountId !== accountId) return;
    out.push({ id: doc.id, ...d });
  });
  return out;
}

function allMatchTransactionIds(matchMap) {
  const ids = new Set();
  for (const m of matchMap || []) {
    if (m.transactionId) ids.add(m.transactionId);
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
  if (doc.data().status !== 'draft') {
    throw new Error('Only draft sessions can be deleted');
  }

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

  const beforeFilter = parsedRows.length;
  const bankRows = filterBankRowsByStatementPeriod(parsedRows, session.startDate, session.endDate);
  const errors = [...parseErrors];
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

  const rawTxns = await fetchTransactionsForMatching(
    clientId,
    session.accountId,
    session.startDate,
    session.endDate
  );

  const withAccount = attachAccountForMatching(normalizedRowsInPeriod, session.accountId);
  const result = runMatchingAlgorithm(withAccount, rawTxns, {
    bankFormat: session.bankFormat || null
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

  const matchMap = result.matches.map((m) => ({
    transactionId: m.transactionId,
    normalizedRowId: m.normalizedRowId,
    matchType: m.matchType,
    justification: null,
    relatedTransactionIds: m.feeGroupTransactionIds?.slice(1) || m.relatedTransactionIds || [],
    ...(m.speiFeeGapCentavos != null ? { speiFeeGapCentavos: m.speiFeeGapCentavos } : {}),
    ...(m.roundingDeltaCentavos != null ? { roundingDeltaCentavos: m.roundingDeltaCentavos } : {}),
    ...(m.autoFix ? { autoFix: m.autoFix, samsAutoFixApplied: true } : {})
  }));

  const matchStats = {
    exact: result.stats.exact,
    dateDrift: result.stats.dateDrift,
    roundingExact: result.stats.roundingExact,
    roundingDrift: result.stats.roundingDrift,
    speiFeeGapExact: result.stats.speiFeeGapExact,
    speiFeeGapDrift: result.stats.speiFeeGapDrift,
    feeAdjusted: result.stats.feeAdjusted,
    matchedCount: result.matches.length,
    unmatchedBankCount: result.unmatchedBankRows.length,
    unmatchedTxnCount: result.unmatchedTransactions.length
  };

  await ref.update({
    matchMap,
    matchStats,
    unmatchedBankRows: result.unmatchedBankRows,
    unmatchedTransactions: result.unmatchedTransactions,
    status: 'reviewing',
    updated: admin.firestore.Timestamp.now()
  });

  return { success: true, ...result, matchMap, matchStats };
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
 * Manual pair — same as resolveException manual-match (normalizedRowId + transactionId).
 * Does not set clearedDate; session matchMap only until Accept.
 */
export async function manualPairSession(clientId, sessionId, body) {
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

  return {
    success: true,
    session,
    unmatchedBankDetails,
    availableSamsTransactions,
    matchedItems: session.matchMap || [],
    reconciliationExclusions: session.reconciliationExclusions || [],
    stats: {
      ...(session.matchStats || {}),
      bankUnmatchedTotalCentavos,
      samsAvailableTotalCentavos,
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
  const unmatchedT = session.unmatchedTransactions || [];
  // Bank-first (check-register) semantics: every imported bank line must be paired or explained.
  // Unmatched SAMS rows are allowed — they are register activity not on this statement; they stay uncleared.
  if (unmatchedB.length > 0) {
    throw new Error(
      'Every bank statement line must be matched before accepting (unmatched SAMS lines can remain)'
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

  const reportUrl = await generateAndUploadReconciliationReport({
    clientId,
    sessionId,
    session: { ...session, matchMap },
    clientDisplayName: clientName,
    acceptedByEmail: user?.email || ''
  });

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

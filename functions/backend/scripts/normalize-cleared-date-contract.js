/**
 * normalize-cleared-date-contract.js
 *
 * Normalizes transaction docs so `clearedDate` always exists, using per-client fiscal years:
 * - Missing field + txn date before current open fiscal period start => clearedDate = fiscal year end date
 * - Missing field + txn date in current open fiscal period => clearedDate = null
 *
 * Default mode is DRY RUN (no writes).
 *
 * Usage:
 *   node functions/backend/scripts/normalize-cleared-date-contract.js
 *   node functions/backend/scripts/normalize-cleared-date-contract.js --clients=MTC,AVII
 *   node functions/backend/scripts/normalize-cleared-date-contract.js --clients=MTC,AVII --as-of=2026-05-05
 *   node functions/backend/scripts/normalize-cleared-date-contract.js --clients=MTC,AVII --as-of=2026-05-05 --apply
 */

import { initializeFirebase, printEnvironmentInfo } from '../../../scripts/utils/environment-config.js';

const DEFAULT_CLIENTS = ['MTC', 'AVII'];
const BATCH_LIMIT = 450;

function parseArgs(argv) {
  const out = {
    clients: [...DEFAULT_CLIENTS],
    asOfDate: new Date().toISOString().slice(0, 10),
    env: process.env.FIRESTORE_ENV || 'dev',
    useADC: process.env.USE_ADC === 'true',
    apply: false
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--apply') {
      out.apply = true;
      continue;
    }
    if (arg === '--prod') {
      out.env = 'prod';
      out.useADC = true;
      continue;
    }
    if (arg.startsWith('--env=')) {
      const raw = String(arg.split('=')[1] || '').trim().toLowerCase();
      if (raw) out.env = raw;
      continue;
    }
    if (arg === '--use-adc') {
      out.useADC = true;
      continue;
    }
    if (arg.startsWith('--clients=')) {
      const raw = arg.split('=')[1] || '';
      const clients = raw
        .split(',')
        .map((v) => String(v || '').trim())
        .filter(Boolean);
      if (clients.length > 0) out.clients = clients;
      continue;
    }
    if (arg.startsWith('--as-of=')) {
      const raw = String(arg.split('=')[1] || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) out.asOfDate = raw;
    }
  }

  return out;
}

function extractIsoDateLike(value) {
  if (!value) return null;

  // Firestore Timestamp objects
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  // Firestore JSON timestamp shapes
  const sec = value?.seconds ?? value?._seconds;
  if (sec != null && Number.isFinite(Number(sec))) {
    const d = new Date(Number(sec) * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const s = value.trim();
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
    const m2 = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  return null;
}

function parseIsoDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ''))) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function getFiscalYearStartDate(dateObj, fiscalStartMonth) {
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth() + 1;
  const startYear = month >= fiscalStartMonth ? year : year - 1;
  return new Date(Date.UTC(startYear, fiscalStartMonth - 1, 1));
}

function getFiscalYearEndDate(dateObj, fiscalStartMonth) {
  const start = getFiscalYearStartDate(dateObj, fiscalStartMonth);
  const nextStart = new Date(Date.UTC(start.getUTCFullYear() + 1, fiscalStartMonth - 1, 1));
  return new Date(nextStart.getTime() - 24 * 60 * 60 * 1000);
}

function deriveClearedDateForMissingField(txnIsoDate, openFiscalStartIso, fiscalStartMonth) {
  const txnDateObj = parseIsoDate(txnIsoDate);
  const openStartObj = parseIsoDate(openFiscalStartIso);
  if (!txnDateObj || !openStartObj) return { clearedDate: null, undated: true };

  if (txnDateObj >= openStartObj) {
    return { clearedDate: null, undated: false };
  }

  const fiscalYearEnd = getFiscalYearEndDate(txnDateObj, fiscalStartMonth);
  return { clearedDate: formatIsoDate(fiscalYearEnd), undated: false };
}

function isCashAccountTransactionDoc(data) {
  const accountType = String(data?.accountType || '').trim().toLowerCase();
  if (accountType === 'cash') return true;
  const accountId = String(data?.accountId || '').trim().toLowerCase();
  return accountId.startsWith('cash-');
}

async function resolveClientDocRef(db, requestedClientId) {
  const requested = String(requestedClientId || '').trim();
  const requestedLower = requested.toLowerCase();
  const clientsSnap = await db.collection('clients').get();
  for (const doc of clientsSnap.docs) {
    const data = doc.data() || {};
    const candidates = [
      doc.id,
      data.clientId,
      data.code,
      data.name,
      data.displayName
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .map((v) => v.toLowerCase());
    if (candidates.includes(requestedLower)) {
      return doc;
    }
  }
  throw new Error(`Client not found: ${requestedClientId}`);
}

function readFiscalStartMonth(clientData) {
  const fiscalStartMonth = Number(clientData?.configuration?.fiscalYearStartMonth || 1);
  if (!Number.isInteger(fiscalStartMonth) || fiscalStartMonth < 1 || fiscalStartMonth > 12) {
    return 1;
  }
  return fiscalStartMonth;
}

async function run() {
  const opts = parseArgs(process.argv);
  const useProd = opts.env === 'prod';
  const env = useProd ? 'prod' : opts.env;
  printEnvironmentInfo(env);
  const { db } = await initializeFirebase(env, { useADC: useProd || opts.useADC });
  const asOfObj = parseIsoDate(opts.asOfDate);
  if (!asOfObj) {
    throw new Error(`Invalid --as-of date: ${opts.asOfDate}`);
  }

  console.log('--- normalize-cleared-date-contract ---');
  console.log('Mode:', opts.apply ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)');
  console.log('Environment:', env);
  console.log('Credentials:', useProd || opts.useADC ? 'ADC' : 'service account');
  console.log('Clients:', opts.clients.join(', '));
  console.log('As-of date:', opts.asOfDate);

  let totalRead = 0;
  let totalMissing = 0;
  let totalWouldSetHistorical = 0;
  let totalWouldSetNull = 0;
  let totalUndated = 0;
  let totalUpdated = 0;

  for (const clientId of opts.clients) {
    const clientDoc = await resolveClientDocRef(db, clientId);
    const resolvedClientId = clientDoc.id;
    const fiscalStartMonth = readFiscalStartMonth(clientDoc.data() || {});
    const openFiscalStartDate = getFiscalYearStartDate(asOfObj, fiscalStartMonth);
    const openFiscalStartIso = formatIsoDate(openFiscalStartDate);
    const priorFiscalEndIso = formatIsoDate(new Date(openFiscalStartDate.getTime() - 24 * 60 * 60 * 1000));

    const ref = db.collection('clients').doc(resolvedClientId).collection('transactions');
    const snap = await ref.get();

    totalRead += snap.size;

    const summary = {
      clientId: resolvedClientId,
      requestedClientId: clientId,
      read: snap.size,
      fiscalStartMonth,
      openFiscalStartDate: openFiscalStartIso,
      alreadyHasClearedDate: 0,
      missingClearedDate: 0,
      wouldSetHistoricalYearEnd: 0,
      wouldSetNull: 0,
      undatedFallbackToNull: 0,
      updated: 0,
      samples: {
        cash: [],
        historical: [],
        openYear: [],
        undated: []
      }
    };

    let batch = db.batch();
    let pending = 0;

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const hasClearedDate = Object.prototype.hasOwnProperty.call(data, 'clearedDate');
      if (hasClearedDate) {
        summary.alreadyHasClearedDate += 1;
        continue;
      }

      summary.missingClearedDate += 1;
      totalMissing += 1;

      const iso = extractIsoDateLike(data.date) || extractIsoDateLike(data.created) || null;
      const isCashTxn = isCashAccountTransactionDoc(data);
      let decision;
      let nextClearedDate;

      if (isCashTxn) {
        nextClearedDate = iso || priorFiscalEndIso;
        decision = { clearedDate: nextClearedDate, undated: !iso, cashRule: true };
      } else {
        decision = deriveClearedDateForMissingField(
          iso,
          openFiscalStartIso,
          fiscalStartMonth
        );
        nextClearedDate = decision.clearedDate;
      }

      if (decision.cashRule) {
        summary.wouldSetHistoricalYearEnd += 1;
        totalWouldSetHistorical += 1;
        if (summary.samples.cash.length < 5) {
          summary.samples.cash.push({
            id: doc.id,
            txnDate: iso,
            clearedDate: nextClearedDate
          });
        }
      } else if (iso && nextClearedDate != null) {
        summary.wouldSetHistoricalYearEnd += 1;
        totalWouldSetHistorical += 1;
        if (summary.samples.historical.length < 5) {
          summary.samples.historical.push({
            id: doc.id,
            txnDate: iso,
            clearedDate: nextClearedDate
          });
        }
      } else if (iso && nextClearedDate == null) {
        summary.wouldSetNull += 1;
        totalWouldSetNull += 1;
        if (summary.samples.openYear.length < 5) {
          summary.samples.openYear.push({
            id: doc.id,
            txnDate: iso,
            clearedDate: null
          });
        }
      } else if (decision.undated) {
        summary.wouldSetNull += 1;
        summary.undatedFallbackToNull += 1;
        totalWouldSetNull += 1;
        totalUndated += 1;
        if (summary.samples.undated.length < 5) {
          summary.samples.undated.push({ id: doc.id, txnDate: null, clearedDate: null });
        }
      }

      if (opts.apply) {
        batch.update(doc.ref, {
          clearedDate: nextClearedDate ?? null,
          updated: new Date().toISOString()
        });
        pending += 1;

        if (pending >= BATCH_LIMIT) {
          await batch.commit();
          summary.updated += pending;
          totalUpdated += pending;
          batch = db.batch();
          pending = 0;
        }
      }
    }

    if (opts.apply && pending > 0) {
      await batch.commit();
      summary.updated += pending;
      totalUpdated += pending;
    }

    console.log('\nClient summary:', JSON.stringify(summary, null, 2));
  }

  console.log('\n--- Totals ---');
  console.log(
    JSON.stringify(
      {
        mode: opts.apply ? 'apply' : 'dry-run',
        clients: opts.clients,
        asOfDate: opts.asOfDate,
        totalRead,
        totalMissingClearedDate: totalMissing,
        totalWouldSetHistoricalYearEnd: totalWouldSetHistorical,
        totalWouldSetNull: totalWouldSetNull,
        totalUndatedFallbackToNull: totalUndated,
        totalUpdated
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error('normalize-cleared-date-contract failed:', error);
  process.exit(1);
});

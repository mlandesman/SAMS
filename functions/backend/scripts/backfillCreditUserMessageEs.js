#!/usr/bin/env node

/**
 * Backfill userMessage_es on credit history entries (Issue #337 Task 2.6).
 *
 * Scans clients/{clientId}/units/creditBalances* documents and fills missing
 * userMessage_es using deterministic template lookup, then optional DeepL.
 *
 * Production: pass --prod after `gcloud auth application-default login` (ADC).
 * Initializes Firebase Admin against sams-sandyland-prod; no service-account file required.
 */

import axios from 'axios';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { getDb } from '../firebase.js';
import {
  lookupSpanishForEnglishTemplate,
  resolveCreditUserMessage,
  resolveCreditUserMessageEs
} from '../../shared/utils/creditUserMessage.js';

const DEFAULT_CLIENTS = ['AVII', 'MTC'];
const DEEPL_BASE_URL = 'https://api-free.deepl.com/v2/translate';
const PRODUCTION_PROJECT_ID = 'sams-sandyland-prod';

function loadScriptEnv() {
  const envPaths = ['../.env', '../../.env'];
  for (const relativePath of envPaths) {
    dotenv.config({ path: new URL(relativePath, import.meta.url).pathname, override: false });
  }
}

function parseArgs(argv = []) {
  const args = argv.slice(2);
  const hasDryRun = args.includes('--dry-run') || args.includes('--dry-mode');
  const useProduction = args.includes('--prod');
  const allowMissingDeepL = args.includes('--allow-missing-deepl');
  const hasHelp = args.includes('--help') || args.includes('-h');
  const clientsArg = args.find((arg) => arg.startsWith('--clients='));

  const clients = clientsArg
    ? clientsArg.split('=').slice(1).join('=').split(',').map((v) => v.trim()).filter(Boolean)
    : DEFAULT_CLIENTS;

  return {
    writeEnabled: !hasDryRun,
    useProduction,
    allowMissingDeepL,
    deepLAuthKey: String(process.env.DEEPL_AUTH_KEY || '').trim(),
    clients,
    help: hasHelp
  };
}

function printHelp() {
  console.log('Usage: node functions/backend/scripts/backfillCreditUserMessageEs.js [options]');
  console.log('');
  console.log('Environment:');
  console.log('  --prod                 Production (sams-sandyland-prod) via ADC — run gcloud auth application-default login first');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run              Scan/report only, no writes');
  console.log('  --prod                 Use Firebase production project');
  console.log('  --allow-missing-deepl  Skip DeepL for custom messages when key missing');
  console.log('  --clients=AVII,MTC     Comma-separated client IDs');
  console.log('  --help                 Show this message');
}

async function initializeDb(useProduction) {
  if (admin.apps.length === 0) {
    if (useProduction) {
      admin.initializeApp({ projectId: PRODUCTION_PROJECT_ID });
    } else {
      admin.initializeApp();
    }
  }
  return getDb();
}

async function translateWithDeepL(text, authKey, cache) {
  const key = text.trim();
  if (cache.has(key)) {
    return cache.get(key);
  }
  const response = await axios.post(
    DEEPL_BASE_URL,
    new URLSearchParams({
      auth_key: authKey,
      text: key,
      target_lang: 'ES',
      source_lang: 'EN'
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }
  );
  const translated = String(response.data?.translations?.[0]?.text || '').trim();
  cache.set(key, translated);
  return translated;
}

function resolveMissingEs(entry) {
  const existing = String(entry.userMessage_es || '').trim();
  if (existing) {
    return { kind: 'skip', value: existing };
  }

  const resolvedEn = resolveCreditUserMessage({
    userMessage: entry.userMessage,
    notes: entry.notes || entry.note || '',
    source: entry.source,
    type: entry.type
  });

  const fromTemplate = lookupSpanishForEnglishTemplate(resolvedEn);
  if (fromTemplate) {
    return { kind: 'deterministic', value: fromTemplate, resolvedEn };
  }

  const fallbackEs = resolveCreditUserMessageEs({
    userMessage: entry.userMessage,
    userMessage_es: entry.userMessage_es,
    notes: entry.notes || entry.note || '',
    source: entry.source,
    type: entry.type
  });

  if (fallbackEs && fallbackEs !== resolvedEn) {
    return { kind: 'fallback', value: fallbackEs, resolvedEn };
  }

  return { kind: 'needs_deepl', value: '', resolvedEn };
}

async function processCreditBalancesDoc(docRef, data, options, translationCache, summary) {
  let touched = false;
  const nextData = { ...data };

  for (const [unitId, unitData] of Object.entries(data || {})) {
    if (!unitData || !Array.isArray(unitData.history)) {
      continue;
    }

    const nextHistory = unitData.history.map((entry) => ({ ...entry }));
    let unitTouched = false;

    for (let index = 0; index < nextHistory.length; index += 1) {
      const entry = nextHistory[index];
      summary.entriesScanned += 1;

      const resolution = resolveMissingEs(entry);
      if (resolution.kind === 'skip') {
        summary.skippedExisting += 1;
        continue;
      }

      summary.candidates += 1;
      let translatedEs = resolution.value;

      if (resolution.kind === 'needs_deepl') {
        if (!options.deepLAuthKey) {
          if (options.allowMissingDeepL) {
            summary.skippedNoDeepL += 1;
            continue;
          }
          summary.hardStop = true;
          summary.errors.push({
            docId: docRef.id,
            unitId,
            entryId: entry.id,
            error: 'DeepL required for custom userMessage but DEEPL_AUTH_KEY is missing'
          });
          return { touched: false, stopNow: true };
        }
        try {
          translatedEs = await translateWithDeepL(resolution.resolvedEn, options.deepLAuthKey, translationCache);
          summary.deepLHits += 1;
        } catch (error) {
          summary.failures += 1;
          summary.errors.push({
            docId: docRef.id,
            unitId,
            entryId: entry.id,
            error: error?.message || 'DeepL failure'
          });
          continue;
        }
      } else if (resolution.kind === 'deterministic') {
        summary.deterministicHits += 1;
      } else if (resolution.kind === 'fallback') {
        summary.fallbackHits += 1;
      }

      if (!translatedEs) {
        summary.skippedEmpty += 1;
        continue;
      }

      if (options.writeEnabled) {
        nextHistory[index] = { ...entry, userMessage_es: translatedEs };
        unitTouched = true;
        summary.entriesWritten += 1;
      }
    }

    if (unitTouched) {
      nextData[unitId] = { ...unitData, history: nextHistory };
      touched = true;
    }
  }

  if (options.writeEnabled && touched) {
    await docRef.set(nextData, { merge: true });
    summary.documentsWritten += 1;
  } else if (!options.writeEnabled && summary.candidates > summary.skippedExisting) {
    summary.documentsCandidate += 1;
  }

  return { touched, stopNow: false };
}

async function processClient(clientId, options) {
  const db = await initializeDb(options.useProduction);
  const translationCache = new Map();
  const summary = {
    clientId,
    documentsScanned: 0,
    documentsWritten: 0,
    documentsCandidate: 0,
    entriesScanned: 0,
    entriesWritten: 0,
    candidates: 0,
    skippedExisting: 0,
    skippedNoDeepL: 0,
    skippedEmpty: 0,
    deterministicHits: 0,
    fallbackHits: 0,
    deepLHits: 0,
    failures: 0,
    hardStop: false,
    errors: []
  };

  const unitsSnap = await db.collection(`clients/${clientId}/units`).get();
  const creditDocs = unitsSnap.docs.filter((doc) => doc.id.startsWith('creditBalances'));

  for (const doc of creditDocs) {
    summary.documentsScanned += 1;
    const result = await processCreditBalancesDoc(doc.ref, doc.data(), options, translationCache, summary);
    if (result.stopNow) {
      break;
    }
  }

  return summary;
}

async function main() {
  loadScriptEnv();
  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    return;
  }

  console.log(`[backfillCreditUserMessageEs] mode=${options.writeEnabled ? 'write' : 'dry-run'} env=${options.useProduction ? 'prod' : 'dev'}`);
  const summaries = [];

  for (const clientId of options.clients) {
    const summary = await processClient(clientId, options);
    summaries.push(summary);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.hardStop) {
      process.exitCode = 1;
      return;
    }
  }

  const totals = summaries.reduce((acc, s) => {
    acc.entriesScanned += s.entriesScanned;
    acc.candidates += s.candidates;
    acc.entriesWritten += s.entriesWritten;
    acc.deterministicHits += s.deterministicHits;
    acc.deepLHits += s.deepLHits;
    return acc;
  }, { entriesScanned: 0, candidates: 0, entriesWritten: 0, deterministicHits: 0, deepLHits: 0 });

  console.log('[backfillCreditUserMessageEs] totals', totals);
}

main().catch((error) => {
  console.error('[backfillCreditUserMessageEs] fatal', error);
  process.exitCode = 1;
});

#!/usr/bin/env node

import axios from 'axios';
import admin from 'firebase-admin';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import { getDb } from '../firebase.js';
import { deterministicTranslateNoteToSpanish } from '../utils/notesLocalization.js';

const DEFAULT_CLIENTS = ['AVII', 'MTC'];
const DEEPL_BASE_URL = 'https://api-free.deepl.com/v2/translate';
const RETRYABLE_STATUS_CODES = new Set([429, 503, 504]);
const PRODUCTION_PROJECT_ID = 'sams-sandyland-prod';

function loadScriptEnv() {
  // Match backend localhost behavior by loading backend and functions env files.
  const envPaths = ['../.env', '../../.env'];
  for (const relativePath of envPaths) {
    dotenv.config({ path: new URL(relativePath, import.meta.url).pathname, override: false });
  }
}

function parseArgs(argv = []) {
  const args = argv.slice(2);
  const hasDryRun = args.includes('--dry-run') || args.includes('--dry-mode');
  const useProduction = args.includes('--prod');
  const repairDeterministic = args.includes('--repair-deterministic');
  const allowMissingDeepL = args.includes('--allow-missing-deepl');
  const hasHelp = args.includes('--help') || args.includes('-h');
  const clientsArg = args.find((arg) => arg.startsWith('--clients='));
  const batchArg = args.find((arg) => arg.startsWith('--batch-size='));
  const clients = clientsArg
    ? clientsArg
        .split('=')
        .slice(1)
        .join('=')
        .split(',')
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    : DEFAULT_CLIENTS;

  const batchSize = batchArg
    ? Number.parseInt(batchArg.split('=').slice(1).join('='), 10)
    : 200;

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error('Invalid --batch-size value. Use an integer from 1 to 500.');
  }

  return {
    writeEnabled: !hasDryRun,
    firebaseEnvironment: useProduction ? 'prod' : 'dev',
    useProduction,
    repairDeterministic,
    allowMissingDeepL,
    deepLAuthKey: String(process.env.DEEPL_AUTH_KEY || '').trim(),
    clients,
    batchSize,
    help: hasHelp,
  };
}

function printHelp() {
  console.log('Usage: node functions/backend/scripts/backfillTransactionNotesEs.js [options]');
  console.log('');
  console.log('Environment:');
  console.log('  --prod                          Use Firebase production project (sams-sandyland-prod)');
  console.log('');
  console.log('Options:');
  console.log('  --dry-run                       Scan/report only, no writes');
  console.log('  --dry-mode                      Alias for --dry-run (backward compatibility)');
  console.log('  --repair-deterministic          Repair existing fallback notes_es via deterministic rules');
  console.log('  --allow-missing-deepl           Allow live deterministic-only run without DeepL key');
  console.log('  --clients=AVII,MTC              Comma-separated client IDs (default: AVII,MTC)');
  console.log('  --batch-size=200                Firestore page size (1-500, default: 200)');
  console.log('  --help                          Show this message');
  console.log('');
  console.log('Examples:');
  console.log('  node functions/backend/scripts/backfillTransactionNotesEs.js --dry-run');
  console.log('  node functions/backend/scripts/backfillTransactionNotesEs.js --dry-run --repair-deterministic --clients=AVII');
  console.log('  node functions/backend/scripts/backfillTransactionNotesEs.js --prod --dry-run --clients=AVII');
  console.log('  node functions/backend/scripts/backfillTransactionNotesEs.js --allow-missing-deepl --clients=AVII');
  console.log('  node functions/backend/scripts/backfillTransactionNotesEs.js --prod --repair-deterministic --clients=AVII');
  console.log('  node functions/backend/scripts/backfillTransactionNotesEs.js --prod --clients=AVII');
}

function normalizeNote(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function hasNonEmptyCompanion(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRetryAfterMs(headerValue) {
  if (!headerValue) return null;
  const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!rawValue) return null;

  const asNumber = Number.parseInt(String(rawValue), 10);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return asNumber * 1000;
  }

  const asDate = new Date(rawValue);
  if (Number.isFinite(asDate.getTime())) {
    const deltaMs = asDate.getTime() - Date.now();
    return deltaMs > 0 ? deltaMs : 0;
  }

  return null;
}

function computeBackoffDelayMs(attemptNumber, retryAfterMs = null) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return retryAfterMs;
  }

  const baseDelayMs = 800;
  const exponentialMs = baseDelayMs * (2 ** Math.max(0, attemptNumber - 1));
  const jitterMs = Math.floor(Math.random() * 250);
  return exponentialMs + jitterMs;
}

async function translateWithDeepLRetry(note, options = {}) {
  const {
    maxAttempts = 5,
    deepLAuthKey = process.env.DEEPL_AUTH_KEY || '',
  } = options;

  if (!deepLAuthKey) {
    return {
      ok: false,
      hardStop: false,
      reasonCode: 'DEEPL_UNAVAILABLE',
      error: 'DEEPL_AUTH_KEY not set.',
    };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.post(
        DEEPL_BASE_URL,
        {
          text: [note],
          target_lang: 'ES',
          source_lang: 'EN',
          split_sentences: '1',
          preserve_formatting: true,
          formality: 'default',
          tag_handling: 'html',
        },
        {
          headers: {
            Authorization: `DeepL-Auth-Key ${deepLAuthKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const translatedText = normalizeNote(response?.data?.translations?.[0]?.text);
      if (!translatedText) {
        return {
          ok: false,
          hardStop: false,
          reasonCode: 'DEEPL_EMPTY',
          error: 'DeepL returned an empty translation payload.',
        };
      }

      return {
        ok: true,
        translatedText,
      };
    } catch (error) {
      const statusCode = error?.response?.status;
      const retryAfterMs = toRetryAfterMs(error?.response?.headers?.['retry-after']);

      if (statusCode === 456) {
        return {
          ok: false,
          hardStop: true,
          reasonCode: 'DEEPL_QUOTA',
          error: 'DeepL quota exceeded (HTTP 456).',
        };
      }

      const retryable = RETRYABLE_STATUS_CODES.has(statusCode);
      if (!retryable || attempt === maxAttempts) {
        return {
          ok: false,
          hardStop: false,
          reasonCode: statusCode === 429 ? 'DEEPL_RATE_LIMIT' : 'DEEPL_FAILED',
          error: `DeepL translation failed (${statusCode || 'unknown'}): ${error?.message || 'Unknown error'}`,
        };
      }

      const waitMs = computeBackoffDelayMs(attempt, retryAfterMs);
      await delay(waitMs);
    }
  }

  return {
    ok: false,
    hardStop: false,
    reasonCode: 'DEEPL_FAILED',
    error: 'DeepL translation failed after retry loop exhaustion.',
  };
}

async function resolveMissingCompanion(note, options, translationCache, summary) {
  const { writeEnabled, deepLAuthKey } = options;
  const source = normalizeNote(note);
  if (!source) {
    return {
      kind: 'skip',
      translatedText: '',
      hardStop: false,
    };
  }

  const deterministic = deterministicTranslateNoteToSpanish(source);
  const deterministicOutput = normalizeNote(deterministic.translatedText);
  if (deterministic.resolved && deterministicOutput) {
    summary.deterministicWriteCandidates += 1;
    return {
      kind: 'deterministic',
      translatedText: deterministicOutput,
      hardStop: false,
    };
  }

  summary.deepLWriteCandidates += 1;

  // Dry-run with DeepL configured cannot know final write outcome without spending quota.
  if (!writeEnabled && deepLAuthKey) {
    return {
      kind: 'skip',
      translatedText: '',
      hardStop: false,
    };
  }

  // No DeepL configured: unresolved source is explicitly skipped (never persisted as English fallback).
  if (!deepLAuthKey) {
    summary.deepLUnavailable += 1;
    summary.skippedUntranslated += 1;
    return {
      kind: 'skip',
      translatedText: '',
      hardStop: false,
    };
  }

  const cachedDeepL = translationCache.get(source);
  if (cachedDeepL) {
    if (!cachedDeepL.ok) {
      if (cachedDeepL.reasonCode === 'DEEPL_RATE_LIMIT') summary.deepLRateLimited += 1;
      else if (cachedDeepL.reasonCode === 'DEEPL_QUOTA') summary.deepLQuotaStops += 1;
      else if (cachedDeepL.reasonCode === 'DEEPL_UNAVAILABLE') summary.deepLUnavailable += 1;
      else summary.deepLFailed += 1;
      summary.skippedUntranslated += 1;
      return {
        kind: 'skip',
        translatedText: '',
        hardStop: cachedDeepL.hardStop === true,
      };
    }
    return {
      kind: 'deepl',
      translatedText: normalizeNote(cachedDeepL.translatedText),
      hardStop: false,
    };
  }

  const deepLResult = await translateWithDeepLRetry(source, { deepLAuthKey });
  translationCache.set(source, deepLResult);
  if (!deepLResult.ok) {
    if (deepLResult.reasonCode === 'DEEPL_RATE_LIMIT') summary.deepLRateLimited += 1;
    else if (deepLResult.reasonCode === 'DEEPL_QUOTA') summary.deepLQuotaStops += 1;
    else if (deepLResult.reasonCode === 'DEEPL_UNAVAILABLE') summary.deepLUnavailable += 1;
    else summary.deepLFailed += 1;
    summary.skippedUntranslated += 1;
    return {
      kind: 'skip',
      translatedText: '',
      hardStop: deepLResult.hardStop === true,
    };
  }

  return {
    kind: 'deepl',
    translatedText: normalizeNote(deepLResult.translatedText),
    hardStop: false,
  };
}

function buildLocationDescriptor({ type, index = null }) {
  if (type === 'top-level') return 'transaction.notes';
  return `transaction.allocations[${index}].notes`;
}

function isLikelyUntranslatedFallback(sourceNote, companionNote) {
  const source = normalizeNote(sourceNote);
  const companion = normalizeNote(companionNote);
  if (!source || !companion) return false;

  // Previous fallback persisted source text verbatim when DeepL was unavailable.
  if (companion === source) return true;
  if (companion.toLowerCase() === source.toLowerCase()) return true;
  return false;
}

async function initializeDb(useProduction) {
  if (!useProduction) {
    return getDb();
  }

  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') ||
      !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))
  ) {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: PRODUCTION_PROJECT_ID,
    });
  }

  return admin.firestore();
}

function createInitialClientSummary(clientId, options) {
  const { firebaseEnvironment, writeEnabled, batchSize, repairDeterministic } = options;
  return {
    clientId,
    firebaseEnvironment,
    executionMode: writeEnabled ? 'live' : 'dry-run',
    repairDeterministic,
    batchSize,
    scannedRecords: 0,
    candidateNoteLocations: 0,
    deterministicWriteCandidates: 0,
    deepLWriteCandidates: 0,
    skippedExisting: 0,
    skippedUntranslated: 0,
    deepLRateLimited: 0,
    deepLFailed: 0,
    deepLUnavailable: 0,
    deepLQuotaStops: 0,
    translatedWritten: 0,
    repairCandidateLocations: 0,
    repairedLocations: 0,
    failures: 0,
    deterministicHits: 0,
    deepLHits: 0,
    deepLFallbackToSource: 0,
    documentsWritten: 0,
    repairCandidateDocuments: 0,
    repairedDocuments: 0,
    hardStop: false,
    lastProcessedTransactionId: null,
    errors: [],
  };
}

async function processTransactionDoc(docRef, docData, options, translationCache, summary) {
  const { writeEnabled, repairDeterministic } = options;
  const sourceNotes = normalizeNote(docData?.notes);
  const sourceAllocations = Array.isArray(docData?.allocations) ? docData.allocations : [];
  const updates = {};
  const allocationMutations = sourceAllocations.map((allocation) => ({ ...allocation }));
  let touchedAllocations = false;
  let candidateRepairDocument = false;
  let repairedInDocument = false;

  if (sourceNotes) {
    if (hasNonEmptyCompanion(docData?.notes_es)) {
      if (repairDeterministic) {
        const currentCompanion = normalizeNote(docData?.notes_es);
        const deterministic = deterministicTranslateNoteToSpanish(sourceNotes);
        const deterministicOutput = normalizeNote(deterministic.translatedText);
        const eligibleRepair =
          deterministic.resolved &&
          deterministicOutput &&
          deterministicOutput !== currentCompanion &&
          isLikelyUntranslatedFallback(sourceNotes, currentCompanion);

        if (eligibleRepair) {
          summary.repairCandidateLocations += 1;
          candidateRepairDocument = true;
          if (writeEnabled) {
            updates.notes_es = deterministicOutput;
            repairedInDocument = true;
            summary.repairedLocations += 1;
          }
        } else {
          summary.skippedExisting += 1;
        }
      } else {
        summary.skippedExisting += 1;
      }
    } else {
      summary.candidateNoteLocations += 1;
      const topLevelResolution = await resolveMissingCompanion(sourceNotes, options, translationCache, summary);
      if (topLevelResolution.hardStop) {
        summary.hardStop = true;
        return { wroteDocument: false, stopNow: true };
      }
      if (writeEnabled && topLevelResolution.kind !== 'skip') {
        updates.notes_es = topLevelResolution.translatedText;
        summary.translatedWritten += 1;
        if (topLevelResolution.kind === 'deterministic') summary.deterministicHits += 1;
        if (topLevelResolution.kind === 'deepl') {
          summary.deepLHits += 1;
          await delay(200);
        }
      }
    }
  }

  for (let index = 0; index < sourceAllocations.length; index += 1) {
    const allocation = sourceAllocations[index] || {};
    const allocationNotes = normalizeNote(allocation.notes);
    if (!allocationNotes) {
      continue;
    }

    if (hasNonEmptyCompanion(allocation.notes_es)) {
      if (repairDeterministic) {
        const currentCompanion = normalizeNote(allocation.notes_es);
        const deterministic = deterministicTranslateNoteToSpanish(allocationNotes);
        const deterministicOutput = normalizeNote(deterministic.translatedText);
        const eligibleRepair =
          deterministic.resolved &&
          deterministicOutput &&
          deterministicOutput !== currentCompanion &&
          isLikelyUntranslatedFallback(allocationNotes, currentCompanion);

        if (eligibleRepair) {
          summary.repairCandidateLocations += 1;
          candidateRepairDocument = true;
          if (writeEnabled) {
            allocationMutations[index].notes_es = deterministicOutput;
            touchedAllocations = true;
            repairedInDocument = true;
            summary.repairedLocations += 1;
          }
        } else {
          summary.skippedExisting += 1;
        }
      } else {
        summary.skippedExisting += 1;
      }
      continue;
    }

    summary.candidateNoteLocations += 1;
    const allocationResolution = await resolveMissingCompanion(allocationNotes, options, translationCache, summary);
    if (allocationResolution.hardStop) {
      summary.hardStop = true;
      return { wroteDocument: false, stopNow: true };
    }
    if (writeEnabled && allocationResolution.kind !== 'skip') {
      allocationMutations[index].notes_es = allocationResolution.translatedText;
      touchedAllocations = true;
      summary.translatedWritten += 1;
      if (allocationResolution.kind === 'deterministic') summary.deterministicHits += 1;
      if (allocationResolution.kind === 'deepl') {
        summary.deepLHits += 1;
        await delay(200);
      }
    }
  }

  if (!writeEnabled) {
    if (candidateRepairDocument) {
      summary.repairCandidateDocuments += 1;
    }
    return { wroteDocument: false, stopNow: false };
  }

  if (touchedAllocations) {
    updates.allocations = allocationMutations;
  }

  if (candidateRepairDocument) {
    summary.repairCandidateDocuments += 1;
  }

  if (Object.keys(updates).length === 0) {
    return { wroteDocument: false, stopNow: false };
  }

  try {
    await docRef.ref.update(updates);
    summary.documentsWritten += 1;
    if (repairedInDocument) {
      summary.repairedDocuments += 1;
    }
    return { wroteDocument: true, stopNow: false };
  } catch (error) {
    summary.failures += 1;
    summary.errors.push({
      transactionId: docRef.id,
      location: 'document-update',
      error: error?.message || 'Unknown Firestore update failure',
    });
    return { wroteDocument: false, stopNow: false };
  }
}

async function processClientTransactions(clientId, options) {
  const { batchSize } = options;
  const db = await initializeDb(options.useProduction);
  const translationCache = new Map();
  const summary = createInitialClientSummary(clientId, options);
  let lastVisibleDoc = null;
  let batchNumber = 0;
  const clientStartMs = Date.now();

  while (true) {
    let query = db
      .collection(`clients/${clientId}/transactions`)
      .orderBy('__name__')
      .limit(batchSize);

    if (lastVisibleDoc) {
      query = query.startAfter(lastVisibleDoc);
    }

    const pageSnapshot = await query.get();
    if (pageSnapshot.empty) {
      break;
    }
    batchNumber += 1;
    const batchStartMs = Date.now();
    console.log(
      `[backfillTransactionNotesEs] ${clientId} batch=${batchNumber} fetched=${pageSnapshot.size} startingScanned=${summary.scannedRecords}`
    );

    for (const transactionDoc of pageSnapshot.docs) {
      summary.scannedRecords += 1;
      summary.lastProcessedTransactionId = transactionDoc.id;

      const result = await processTransactionDoc(
        transactionDoc,
        transactionDoc.data() || {},
        options,
        translationCache,
        summary
      );

      if (result.stopNow) {
        const batchElapsedMs = Date.now() - batchStartMs;
        const clientElapsedMs = Date.now() - clientStartMs;
        console.log(
          `[backfillTransactionNotesEs] ${clientId} batch=${batchNumber} stopNow=true batchElapsedMs=${batchElapsedMs} totalElapsedMs=${clientElapsedMs}`
        );
        return summary;
      }
    }

    const batchElapsedMs = Date.now() - batchStartMs;
    const clientElapsedMs = Date.now() - clientStartMs;
    console.log(
      `[backfillTransactionNotesEs] ${clientId} batch=${batchNumber} complete scannedTotal=${summary.scannedRecords} skippedExisting=${summary.skippedExisting} skippedUntranslated=${summary.skippedUntranslated} translatedWritten=${summary.translatedWritten} batchElapsedMs=${batchElapsedMs} totalElapsedMs=${clientElapsedMs}`
    );

    lastVisibleDoc = pageSnapshot.docs[pageSnapshot.docs.length - 1] || null;
    if (pageSnapshot.size < batchSize) {
      break;
    }
  }

  const clientElapsedMs = Date.now() - clientStartMs;
  console.log(
    `[backfillTransactionNotesEs] ${clientId} finished batches=${batchNumber} scannedTotal=${summary.scannedRecords} totalElapsedMs=${clientElapsedMs}`
  );

  return summary;
}

function buildFinalSummary(runConfig, clientSummaries) {
  const totals = clientSummaries.reduce(
    (accumulator, clientSummary) => {
      accumulator.scannedRecords += clientSummary.scannedRecords;
      accumulator.candidateNoteLocations += clientSummary.candidateNoteLocations;
      accumulator.deterministicWriteCandidates += clientSummary.deterministicWriteCandidates;
      accumulator.deepLWriteCandidates += clientSummary.deepLWriteCandidates;
      accumulator.skippedExisting += clientSummary.skippedExisting;
      accumulator.skippedUntranslated += clientSummary.skippedUntranslated;
      accumulator.deepLRateLimited += clientSummary.deepLRateLimited;
      accumulator.deepLFailed += clientSummary.deepLFailed;
      accumulator.deepLUnavailable += clientSummary.deepLUnavailable;
      accumulator.deepLQuotaStops += clientSummary.deepLQuotaStops;
      accumulator.translatedWritten += clientSummary.translatedWritten;
      accumulator.repairCandidateLocations += clientSummary.repairCandidateLocations;
      accumulator.repairedLocations += clientSummary.repairedLocations;
      accumulator.failures += clientSummary.failures;
      accumulator.deterministicHits += clientSummary.deterministicHits;
      accumulator.deepLHits += clientSummary.deepLHits;
      accumulator.deepLFallbackToSource += clientSummary.deepLFallbackToSource;
      accumulator.documentsWritten += clientSummary.documentsWritten;
      accumulator.repairCandidateDocuments += clientSummary.repairCandidateDocuments;
      accumulator.repairedDocuments += clientSummary.repairedDocuments;
      if (clientSummary.hardStop) {
        accumulator.hardStop = true;
      }
      return accumulator;
    },
    {
      scannedRecords: 0,
      candidateNoteLocations: 0,
      deterministicWriteCandidates: 0,
      deepLWriteCandidates: 0,
      skippedExisting: 0,
      skippedUntranslated: 0,
      deepLRateLimited: 0,
      deepLFailed: 0,
      deepLUnavailable: 0,
      deepLQuotaStops: 0,
      translatedWritten: 0,
      repairCandidateLocations: 0,
      repairedLocations: 0,
      failures: 0,
      deterministicHits: 0,
      deepLHits: 0,
      deepLFallbackToSource: 0,
      documentsWritten: 0,
      repairCandidateDocuments: 0,
      repairedDocuments: 0,
      hardStop: false,
    }
  );

  return {
    run: {
      firebaseEnvironment: runConfig.firebaseEnvironment,
      executionMode: runConfig.writeEnabled ? 'live' : 'dry-run',
      repairDeterministic: runConfig.repairDeterministic,
      clients: runConfig.clients,
      batchSize: runConfig.batchSize,
      timestamp: new Date().toISOString(),
    },
    totals,
    clients: clientSummaries,
    resumeHint: totals.hardStop
      ? 'Re-run with the same mode/clients; existing notes_es locations are skipped idempotently.'
      : 'No hard stop detected.',
  };
}

async function main() {
  loadScriptEnv();
  const config = parseArgs(process.argv);
  if (config.help) {
    printHelp();
    return;
  }

  if (!Array.isArray(config.clients) || config.clients.length === 0) {
    throw new Error('No client IDs provided. Use --clients=AVII,MTC');
  }

  if (config.writeEnabled && !config.deepLAuthKey && !config.allowMissingDeepL) {
    throw new Error(
      'DEEPL_AUTH_KEY is missing. Failing fast before live run. Use --dry-run, configure DeepL key, or pass --allow-missing-deepl for explicit deterministic-only live behavior.'
    );
  }

  console.log(
    `[backfillTransactionNotesEs] Starting ${config.writeEnabled ? 'LIVE' : 'DRY-RUN'} mode in ${config.firebaseEnvironment.toUpperCase()} environment for clients: ${config.clients.join(', ')} (repairDeterministic=${config.repairDeterministic})`
  );

  const clientSummaries = [];
  for (const clientId of config.clients) {
    const summary = await processClientTransactions(clientId, config);
    clientSummaries.push(summary);

    console.log(
      `[backfillTransactionNotesEs] ${clientId}: scanned=${summary.scannedRecords}, candidates=${summary.candidateNoteLocations}, deterministicCandidates=${summary.deterministicWriteCandidates}, deepLCandidates=${summary.deepLWriteCandidates}, repairCandidates=${summary.repairCandidateLocations}, skippedExisting=${summary.skippedExisting}, skippedUntranslated=${summary.skippedUntranslated}, deepl429=${summary.deepLRateLimited}, deeplFailed=${summary.deepLFailed}, deeplUnavailable=${summary.deepLUnavailable}, deeplQuotaStops=${summary.deepLQuotaStops}, translatedWritten=${summary.translatedWritten}, repairedLocations=${summary.repairedLocations}, failures=${summary.failures}, hardStop=${summary.hardStop}`
    );

    if (summary.hardStop) {
      break;
    }
  }

  const finalSummary = buildFinalSummary(config, clientSummaries);
  console.log(JSON.stringify(finalSummary, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[backfillTransactionNotesEs] Failed:', error?.message || error);
    process.exit(1);
  });

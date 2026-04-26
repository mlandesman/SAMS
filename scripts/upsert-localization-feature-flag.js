#!/usr/bin/env node

import admin from 'firebase-admin';
import { initializeFirebase } from './utils/environment-config.js';

const DEFAULT_ALLOWLIST = [
  'transactions.list',
  'projects.list',
  'vote.polls.list',
  'reports.unit',
  'reports.statement.data',
  'reports.statement.pdf',
  'reports.budgetActual.data',
];

function parseBoolOption(args, key) {
  const raw = args.find((arg) => arg.startsWith(`${key}=`));
  if (!raw) return null;
  const value = raw.split('=').slice(1).join('=').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(value)) return true;
  if (['false', '0', 'no', 'off'].includes(value)) return false;
  throw new Error(`Invalid boolean value for ${key}: ${value}`);
}

function parseCsvOption(args, key) {
  const raw = args.find((arg) => arg.startsWith(`${key}=`));
  if (!raw) return null;
  const csv = raw.split('=').slice(1).join('=');
  return csv
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function printHelp() {
  console.log('Usage: node scripts/upsert-localization-feature-flag.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --prod                                  Use production Firestore (ADC)');
  console.log('  --enabled=true|false                    Set localizationContractV1.enabled');
  console.log('  --shadow-mode=true|false                Set localizationContractV1.shadowMode');
  console.log('  --localized-companions=true|false       Set localizationContractV1.localizedCompanions');
  console.log('  --translate-free-form=true|false        Set localizationContractV1.translateFreeForm');
  console.log('  --allowlist=a,b,c                       Replace allowlist with exact endpoint keys');
  console.log('  --append-allowlist=a,b,c                Add endpoint keys to current allowlist');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/upsert-localization-feature-flag.js');
  console.log('  node scripts/upsert-localization-feature-flag.js --translate-free-form=true');
  console.log('  node scripts/upsert-localization-feature-flag.js --prod --enabled=true --localized-companions=true --translate-free-form=true');
}

function uniqueStrings(values) {
  return [...new Set((values || []).map((v) => String(v || '').trim()).filter(Boolean))];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const useProd = args.includes('--prod') || process.env.FIRESTORE_ENV === 'prod';
  const env = useProd ? 'prod' : (process.env.FIRESTORE_ENV || 'dev');
  const useADC = useProd || process.env.USE_ADC === 'true';
  const { db } = await initializeFirebase(env, { useADC });

  if (useProd) {
    console.log('\x1b[31m🔴 Connected to PRODUCTION database via ADC\x1b[0m\n');
  }

  const ref = db.doc('system/featureFlags');
  const snapshot = await ref.get();
  const flags = snapshot.exists ? (snapshot.data() || {}) : {};
  const current = flags.localizationContractV1 || {};

  const enabledOpt = parseBoolOption(args, '--enabled');
  const shadowModeOpt = parseBoolOption(args, '--shadow-mode');
  const localizedCompanionsOpt = parseBoolOption(args, '--localized-companions');
  const translateFreeFormOpt = parseBoolOption(args, '--translate-free-form');
  const allowlistOpt = parseCsvOption(args, '--allowlist');
  const appendAllowlistOpt = parseCsvOption(args, '--append-allowlist');

  const baselineAllowlist = Array.isArray(current.allowlist) && current.allowlist.length > 0
    ? current.allowlist
    : DEFAULT_ALLOWLIST;
  const replacedAllowlist = allowlistOpt ? uniqueStrings(allowlistOpt) : baselineAllowlist;
  const finalAllowlist = uniqueStrings([...replacedAllowlist, ...(appendAllowlistOpt || [])]);

  const nextLocalizationFlag = {
    enabled: enabledOpt ?? (current.enabled ?? true),
    shadowMode: shadowModeOpt ?? (current.shadowMode ?? false),
    localizedCompanions: localizedCompanionsOpt ?? (current.localizedCompanions ?? true),
    translateFreeForm: translateFreeFormOpt ?? (current.translateFreeForm ?? true),
    allowlist: finalAllowlist,
  };

  await ref.set(
    {
      localizationContractV1: nextLocalizationFlag,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'localization-flag-upsert-script',
    },
    { merge: true }
  );

  console.log('✅ Upserted system/featureFlags.localizationContractV1');
  console.log(JSON.stringify({
    environment: env,
    path: 'system/featureFlags',
    previous: current,
    next: nextLocalizationFlag,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to upsert localization feature flag:', error.message);
    process.exit(1);
  });

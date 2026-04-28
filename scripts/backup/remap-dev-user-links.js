#!/usr/bin/env node
/**
 * Restore helper: capture user maps and remap unit contact userIds in Dev.
 *
 * Commands:
 *   export-email-to-uid --out=/tmp/dev-email-map.json
 *   export-uid-to-email --out=/tmp/prod-uid-map.json
 *   remap-unit-contacts --prod-uid-map=/tmp/prod-uid-map.json --dev-email-map=/tmp/dev-email-map.json [--dry-run|--execute]
 */

import admin from 'firebase-admin';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '../..');
const SERVICE_ACCOUNT_PATH = join(PROJECT_ROOT, 'functions/serviceAccountKey-dev.json');

const args = process.argv.slice(2);
const command = args[0];

function getArg(name, fallback = '') {
  const match = args.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.split('=').slice(1).join('=') : fallback;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function parseJsonFile(pathValue, label) {
  const fullPath = resolve(pathValue);
  if (!existsSync(fullPath)) {
    throw new Error(`${label} not found: ${fullPath}`);
  }
  return JSON.parse(readFileSync(fullPath, 'utf8'));
}

function writeJsonFile(pathValue, payload) {
  const fullPath = resolve(pathValue);
  const parent = dirname(fullPath);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
  writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return fullPath;
}

async function getDb() {
  if (!existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(`Missing service account file: ${SERVICE_ACCOUNT_PATH}`);
  }

  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  return admin.firestore();
}

async function exportEmailToUid(outPath) {
  const db = await getDb();
  const usersSnap = await db.collection('users').get();

  const emailToUid = {};
  const duplicateEmails = {};
  const skippedUsers = [];

  usersSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    const email = normalizeEmail(data.email);
    if (!email) {
      skippedUsers.push(doc.id);
      return;
    }
    if (emailToUid[email]) {
      duplicateEmails[email] = duplicateEmails[email] || [emailToUid[email]];
      duplicateEmails[email].push(doc.id);
      return;
    }
    emailToUid[email] = doc.id;
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'users',
    mode: 'emailToUid',
    uniqueEmails: Object.keys(emailToUid).length,
    duplicateEmailCount: Object.keys(duplicateEmails).length,
    skippedUsersWithoutEmail: skippedUsers.length,
    emailToUid,
    duplicateEmails,
    skippedUsers,
  };

  const fullPath = writeJsonFile(outPath, payload);
  console.log(`✅ Wrote email->uid map: ${fullPath}`);
  console.log(`   Unique emails: ${payload.uniqueEmails}`);
  console.log(`   Duplicate emails: ${payload.duplicateEmailCount}`);
  console.log(`   Users without email: ${payload.skippedUsersWithoutEmail}`);
}

async function exportUidToEmail(outPath) {
  const db = await getDb();
  const usersSnap = await db.collection('users').get();

  const uidToEmail = {};
  let usersWithoutEmail = 0;

  usersSnap.docs.forEach((doc) => {
    const data = doc.data() || {};
    uidToEmail[doc.id] = normalizeEmail(data.email);
    if (!uidToEmail[doc.id]) {
      usersWithoutEmail += 1;
    }
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'users',
    mode: 'uidToEmail',
    usersCount: usersSnap.size,
    usersWithoutEmail,
    uidToEmail,
  };

  const fullPath = writeJsonFile(outPath, payload);
  console.log(`✅ Wrote uid->email map: ${fullPath}`);
  console.log(`   Users: ${payload.usersCount}`);
  console.log(`   Users without email: ${payload.usersWithoutEmail}`);
}

function mapUnitContactsArray(contacts, mapContext, counters) {
  if (!Array.isArray(contacts)) return contacts;

  let changed = false;
  const mapped = contacts.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const currentUid = typeof entry.userId === 'string' ? entry.userId.trim() : '';
    if (!currentUid) return entry;

    counters.totalRefs += 1;
    const email = mapContext.prodUidToEmail[currentUid];
    if (!email) {
      counters.unresolvedNoEmail += 1;
      return entry;
    }

    const devUid = mapContext.devEmailToUid[email];
    if (!devUid) {
      counters.unresolvedNoDevUser += 1;
      return entry;
    }

    if (devUid === currentUid) {
      counters.alreadyMapped += 1;
      return entry;
    }

    changed = true;
    counters.remapped += 1;
    return { ...entry, userId: devUid };
  });

  return changed ? mapped : contacts;
}

async function remapUnitContacts(prodMapPath, devMapPath, execute) {
  const db = await getDb();
  const prodMap = parseJsonFile(prodMapPath, 'prod uid map');
  const devMap = parseJsonFile(devMapPath, 'dev email map');

  const prodUidToEmail = prodMap?.uidToEmail || {};
  const devEmailToUid = devMap?.emailToUid || {};

  const mapContext = { prodUidToEmail, devEmailToUid };
  const counters = {
    clientsScanned: 0,
    unitDocsScanned: 0,
    unitDocsSkippedCreditBalances: 0,
    unitDocsChanged: 0,
    unitDocsUpdated: 0,
    totalRefs: 0,
    remapped: 0,
    alreadyMapped: 0,
    unresolvedNoEmail: 0,
    unresolvedNoDevUser: 0,
    writeErrors: 0,
  };

  const sampleChanges = [];
  const sampleUnresolved = [];

  const clientsSnap = await db.collection('clients').get();
  counters.clientsScanned = clientsSnap.size;

  for (const clientDoc of clientsSnap.docs) {
    const unitsSnap = await clientDoc.ref.collection('units').get();

    for (const unitDoc of unitsSnap.docs) {
      const unitId = unitDoc.id;
      if (unitId.startsWith('creditBalances')) {
        counters.unitDocsSkippedCreditBalances += 1;
        continue;
      }

      counters.unitDocsScanned += 1;
      const data = unitDoc.data() || {};
      const beforeOwners = data.owners;
      const beforeManagers = data.managers;

      const ownersCounters = {
        totalRefs: 0,
        remapped: 0,
        alreadyMapped: 0,
        unresolvedNoEmail: 0,
        unresolvedNoDevUser: 0,
      };
      const managersCounters = {
        totalRefs: 0,
        remapped: 0,
        alreadyMapped: 0,
        unresolvedNoEmail: 0,
        unresolvedNoDevUser: 0,
      };

      const mappedOwners = mapUnitContactsArray(beforeOwners, mapContext, ownersCounters);
      const mappedManagers = mapUnitContactsArray(beforeManagers, mapContext, managersCounters);

      counters.totalRefs += ownersCounters.totalRefs + managersCounters.totalRefs;
      counters.remapped += ownersCounters.remapped + managersCounters.remapped;
      counters.alreadyMapped += ownersCounters.alreadyMapped + managersCounters.alreadyMapped;
      counters.unresolvedNoEmail += ownersCounters.unresolvedNoEmail + managersCounters.unresolvedNoEmail;
      counters.unresolvedNoDevUser += ownersCounters.unresolvedNoDevUser + managersCounters.unresolvedNoDevUser;

      const ownersChanged = mappedOwners !== beforeOwners;
      const managersChanged = mappedManagers !== beforeManagers;
      if (!ownersChanged && !managersChanged) {
        if (
          (ownersCounters.unresolvedNoDevUser > 0 || managersCounters.unresolvedNoDevUser > 0) &&
          sampleUnresolved.length < 20
        ) {
          sampleUnresolved.push(`${clientDoc.id}/${unitId} (no-dev-user)`);
        }
        continue;
      }

      counters.unitDocsChanged += 1;
      if (sampleChanges.length < 20) {
        sampleChanges.push(`${clientDoc.id}/${unitId}`);
      }

      if (!execute) continue;

      try {
        const updatePayload = {
          updated: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (ownersChanged) updatePayload.owners = mappedOwners;
        if (managersChanged) updatePayload.managers = mappedManagers;
        await unitDoc.ref.update(updatePayload);
        counters.unitDocsUpdated += 1;
      } catch (error) {
        counters.writeErrors += 1;
        if (sampleUnresolved.length < 20) {
          sampleUnresolved.push(`${clientDoc.id}/${unitId} (write-error: ${error.message})`);
        }
      }
    }
  }

  console.log('');
  console.log('🔗 Unit Contact Remap Summary');
  console.log('='.repeat(70));
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Clients scanned: ${counters.clientsScanned}`);
  console.log(`Units scanned: ${counters.unitDocsScanned}`);
  console.log(`Units skipped (creditBalances*): ${counters.unitDocsSkippedCreditBalances}`);
  console.log(`Unit docs changed: ${counters.unitDocsChanged}`);
  console.log(`${execute ? 'Unit docs updated' : 'Unit docs to update'}: ${execute ? counters.unitDocsUpdated : counters.unitDocsChanged}`);
  console.log(`Contact refs scanned: ${counters.totalRefs}`);
  console.log(`Refs remapped: ${counters.remapped}`);
  console.log(`Refs already valid: ${counters.alreadyMapped}`);
  console.log(`Refs unresolved (prod uid has no email): ${counters.unresolvedNoEmail}`);
  console.log(`Refs unresolved (email missing in dev map): ${counters.unresolvedNoDevUser}`);
  console.log(`Write errors: ${counters.writeErrors}`);

  if (sampleChanges.length) {
    console.log('');
    console.log('Sample changed units:');
    sampleChanges.forEach((row) => console.log(`  - ${row}`));
  }

  if (sampleUnresolved.length) {
    console.log('');
    console.log('Sample unresolved/write-error units:');
    sampleUnresolved.forEach((row) => console.log(`  - ${row}`));
  }

  if (execute && counters.writeErrors > 0) {
    process.exit(1);
  }
}

function analyzeFixtures(usersDevPath, usersProdPath, unitsProdPath) {
  const usersDev = parseJsonFile(usersDevPath, 'users dev fixture');
  const usersProd = parseJsonFile(usersProdPath, 'users prod fixture');
  const unitsProd = parseJsonFile(unitsProdPath, 'units prod fixture');

  const devEmailToUid = {};
  const duplicateDevEmails = {};
  Object.entries(usersDev).forEach(([uid, userData]) => {
    const email = normalizeEmail((userData || {}).email);
    if (!email) return;
    if (devEmailToUid[email]) {
      duplicateDevEmails[email] = duplicateDevEmails[email] || [devEmailToUid[email]];
      duplicateDevEmails[email].push(uid);
      return;
    }
    devEmailToUid[email] = uid;
  });

  const prodUidToEmail = {};
  Object.entries(usersProd).forEach(([uid, userData]) => {
    prodUidToEmail[uid] = normalizeEmail((userData || {}).email);
  });

  const counters = {
    unitDocsScanned: 0,
    unitDocsSkippedCreditBalances: 0,
    refsScanned: 0,
    deterministicRemaps: 0,
    unresolvedNoEmail: 0,
    unresolvedNoDevUser: 0,
  };
  const unresolvedExamples = [];

  Object.entries(unitsProd).forEach(([unitId, unitData]) => {
    if (unitId.startsWith('creditBalances')) {
      counters.unitDocsSkippedCreditBalances += 1;
      return;
    }
    if (!unitData || typeof unitData !== 'object') return;
    counters.unitDocsScanned += 1;

    ['owners', 'managers'].forEach((role) => {
      const contacts = unitData[role];
      if (!Array.isArray(contacts)) return;

      contacts.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const prodUid = typeof entry.userId === 'string' ? entry.userId.trim() : '';
        if (!prodUid) return;
        counters.refsScanned += 1;

        const email = prodUidToEmail[prodUid];
        if (!email) {
          counters.unresolvedNoEmail += 1;
          if (unresolvedExamples.length < 10) {
            unresolvedExamples.push(`${unitId}/${role}: ${prodUid} (no prod email)`);
          }
          return;
        }

        const devUid = devEmailToUid[email];
        if (!devUid) {
          counters.unresolvedNoDevUser += 1;
          if (unresolvedExamples.length < 10) {
            unresolvedExamples.push(`${unitId}/${role}: ${prodUid} -> ${email} (missing in dev)`);
          }
          return;
        }

        counters.deterministicRemaps += 1;
      });
    });
  });

  console.log('');
  console.log('🧪 Fixture Analysis');
  console.log('='.repeat(70));
  console.log(`Units scanned: ${counters.unitDocsScanned}`);
  console.log(`Units skipped (creditBalances*): ${counters.unitDocsSkippedCreditBalances}`);
  console.log(`Contact refs scanned: ${counters.refsScanned}`);
  console.log(`Deterministic remaps: ${counters.deterministicRemaps}`);
  console.log(`Unresolved (prod uid has no email): ${counters.unresolvedNoEmail}`);
  console.log(`Unresolved (email missing in dev): ${counters.unresolvedNoDevUser}`);
  console.log(`Duplicate emails in dev fixture: ${Object.keys(duplicateDevEmails).length}`);

  if (unresolvedExamples.length) {
    console.log('');
    console.log('Sample unresolved refs:');
    unresolvedExamples.forEach((row) => console.log(`  - ${row}`));
  }
}

async function main() {
  if (!command) {
    console.error('Usage: node scripts/backup/remap-dev-user-links.js <command> [options]');
    process.exit(1);
  }

  if (command === 'export-email-to-uid') {
    const out = getArg('--out');
    if (!out) {
      console.error('Missing required argument: --out=/path/to/file.json');
      process.exit(1);
    }
    await exportEmailToUid(out);
    return;
  }

  if (command === 'export-uid-to-email') {
    const out = getArg('--out');
    if (!out) {
      console.error('Missing required argument: --out=/path/to/file.json');
      process.exit(1);
    }
    await exportUidToEmail(out);
    return;
  }

  if (command === 'remap-unit-contacts') {
    const prodUidMap = getArg('--prod-uid-map');
    const devEmailMap = getArg('--dev-email-map');
    const execute = args.includes('--execute');
    const dryRun = args.includes('--dry-run');

    if (!prodUidMap || !devEmailMap) {
      console.error('Missing required arguments: --prod-uid-map=... --dev-email-map=...');
      process.exit(1);
    }
    if (execute && dryRun) {
      console.error('Use only one mode flag: --execute or --dry-run');
      process.exit(1);
    }

    await remapUnitContacts(prodUidMap, devEmailMap, execute);
    return;
  }

  if (command === 'analyze-fixtures') {
    const usersDev = getArg('--users-dev');
    const usersProd = getArg('--users-prod');
    const unitsProd = getArg('--units-prod');
    if (!usersDev || !usersProd || !unitsProd) {
      console.error('Missing required arguments: --users-dev=... --users-prod=... --units-prod=...');
      process.exit(1);
    }
    analyzeFixtures(usersDev, usersProd, unitsProd);
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

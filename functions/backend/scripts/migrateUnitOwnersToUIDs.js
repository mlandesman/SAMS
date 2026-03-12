/**
 * Migrate Unit Owners/Managers to UID references
 *
 * Purpose: Convert unit owners/managers from legacy {name, email} objects
 * to normalized {userId} references by matching emails to users collection.
 *
 * Usage:
 *   DRY RUN (dev):  node functions/backend/scripts/migrateUnitOwnersToUIDs.js
 *   DRY RUN (prod): node functions/backend/scripts/migrateUnitOwnersToUIDs.js --prod
 *   EXECUTE (dev):  node functions/backend/scripts/migrateUnitOwnersToUIDs.js --execute
 *   EXECUTE (prod): node functions/backend/scripts/migrateUnitOwnersToUIDs.js --prod --execute
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';

const hasProdFlag = process.argv.includes('--prod');
const hasDevFlag = process.argv.includes('--dev');

if (hasProdFlag && hasDevFlag) {
  console.error('Error: Use only one environment flag: --prod or --dev');
  process.exit(1);
}

const ENV = hasProdFlag ? 'prod' : 'dev';
const DRY_RUN = !process.argv.includes('--execute');
const PROD_PROJECT_ID = 'sams-sandyland-prod';
const DEV_PROJECT_ID = 'sandyland-management-system';

async function initializeFirebase() {
  if (ENV === 'prod') {
    console.log('Environment: PRODUCTION');
    console.log(`Firebase Project: ${PROD_PROJECT_ID}`);
    console.log('Auth: Application Default Credentials (ADC)');
    console.log("If needed: run 'gcloud auth application-default login'\n");

    if (
      process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') ||
        !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))
    ) {
      console.log('Warning: clearing invalid GOOGLE_APPLICATION_CREDENTIALS');
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: PROD_PROJECT_ID,
      });
    }

    return admin.firestore();
  }

  console.log('Environment: DEVELOPMENT');
  console.log(`Firebase Project: ${DEV_PROJECT_ID}\n`);

  const { getDb } = await import('../firebase.js');
  return await getDb();
}

function normalizeEmail(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function isCreditBalanceDoc(unitId) {
  return typeof unitId === 'string' && unitId.startsWith('creditBalances');
}

function normalizeContactEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }
  const normalized = {};
  if (typeof entry.name === 'string') {
    normalized.name = entry.name;
  }
  if (typeof entry.email === 'string') {
    normalized.email = entry.email;
  }
  if (typeof entry.userId === 'string') {
    normalized.userId = entry.userId;
  }
  return normalized;
}

function convertContactArray({
  role,
  contacts,
  emailToUidMap,
  duplicateEmailMap,
  unitRef,
  warnings,
  unmatchedEmailRows,
}) {
  if (!Array.isArray(contacts)) {
    // Missing contact arrays are treated as empty to avoid undefined writes.
    if (contacts === undefined || contacts === null) {
      return { converted: [], matched: 0, unmatched: 0, convertedCount: 0 };
    }
    return { converted: contacts, matched: 0, unmatched: 0, convertedCount: 0 };
  }

  let matched = 0;
  let unmatched = 0;
  let convertedCount = 0;

  const converted = contacts.map((entry, index) => {
    const normalizedEntry = normalizeContactEntry(entry);

    if (!normalizedEntry || typeof normalizedEntry !== 'object') {
      warnings.push(
        `${unitRef} ${role}[${index}] is not an object; kept as-is`
      );
      return entry;
    }

    if (normalizedEntry.userId) {
      return { userId: normalizedEntry.userId };
    }

    const email = normalizeEmail(normalizedEntry.email);
    if (!email) {
      warnings.push(
        `${unitRef} ${role}[${index}] missing email; kept legacy entry`
      );
      unmatched += 1;
      return entry;
    }

    if (duplicateEmailMap.has(email)) {
      const duplicateUids = duplicateEmailMap.get(email);
      warnings.push(
        `${unitRef} ${role}[${index}] email ${email} maps to multiple users (${duplicateUids.join(
          ', '
        )}); kept legacy entry`
      );
      unmatched += 1;
      unmatchedEmailRows.push({
        unitRef,
        role,
        email,
        reason: `multiple users: ${duplicateUids.join(', ')}`,
      });
      return entry;
    }

    const matchedUid = emailToUidMap.get(email);
    if (!matchedUid) {
      warnings.push(
        `${unitRef} ${role}[${index}] email ${email} not found in users; kept legacy entry`
      );
      unmatched += 1;
      unmatchedEmailRows.push({
        unitRef,
        role,
        email,
        reason: 'not found',
      });
      return entry;
    }

    matched += 1;
    convertedCount += 1;
    return { userId: matchedUid };
  });

  return { converted, matched, unmatched, convertedCount };
}

async function buildUsersEmailMaps(db) {
  const usersSnap = await db.collection('users').get();
  const emailToUids = new Map();

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data() || {};
    const email = normalizeEmail(userData.email);
    if (!email) {
      continue;
    }

    const existing = emailToUids.get(email) || [];
    existing.push(userDoc.id);
    emailToUids.set(email, existing);
  }

  const emailToUidMap = new Map();
  const duplicateEmailMap = new Map();

  for (const [email, uids] of emailToUids.entries()) {
    if (uids.length === 1) {
      emailToUidMap.set(email, uids[0]);
    } else if (uids.length > 1) {
      duplicateEmailMap.set(email, uids);
    }
  }

  return {
    usersCount: usersSnap.size,
    emailToUidMap,
    duplicateEmailMap,
  };
}

async function main() {
  const db = await initializeFirebase();

  console.log('='.repeat(80));
  console.log('MIGRATE UNIT OWNERS/MANAGERS TO USER IDS');
  console.log('='.repeat(80));
  console.log(`Environment: ${ENV.toUpperCase()}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'EXECUTE (writes enabled)'}`);
  console.log('');

  const summary = {
    totalClients: 0,
    totalUnitDocs: 0,
    totalUnits: 0,
    skippedCreditBalanceDocs: 0,
    unitsWithChanges: 0,
    unitsUpdated: 0,
    unitsSkippedNoChanges: 0,
    matchedEntries: 0,
    unmatchedEntries: 0,
    convertedEntries: 0,
    writeErrors: 0,
    warnings: [],
    unmatchedEmailRows: [],
  };

  try {
    const { usersCount, emailToUidMap, duplicateEmailMap } =
      await buildUsersEmailMaps(db);

    console.log(`Loaded users: ${usersCount}`);
    console.log(`Emails with unique UID matches: ${emailToUidMap.size}`);
    console.log(`Emails with duplicate UID matches: ${duplicateEmailMap.size}`);
    console.log('');

    const clientsSnap = await db.collection('clients').get();
    summary.totalClients = clientsSnap.size;

    console.log(`Found clients: ${summary.totalClients}\n`);

    for (const clientDoc of clientsSnap.docs) {
      const clientId = clientDoc.id;
      console.log(`Client: ${clientId}`);

      const unitsSnap = await db
        .collection('clients')
        .doc(clientId)
        .collection('units')
        .get();

      summary.totalUnitDocs += unitsSnap.size;

      for (const unitDoc of unitsSnap.docs) {
        const unitId = unitDoc.id;

        if (isCreditBalanceDoc(unitId)) {
          summary.skippedCreditBalanceDocs += 1;
          continue;
        }

        summary.totalUnits += 1;
        const unitData = unitDoc.data() || {};
        const unitRef = `${clientId}/${unitId}`;

        const ownersResult = convertContactArray({
          role: 'owners',
          contacts: unitData.owners,
          emailToUidMap,
          duplicateEmailMap,
          unitRef,
          warnings: summary.warnings,
          unmatchedEmailRows: summary.unmatchedEmailRows,
        });

        const managersResult = convertContactArray({
          role: 'managers',
          contacts: unitData.managers,
          emailToUidMap,
          duplicateEmailMap,
          unitRef,
          warnings: summary.warnings,
          unmatchedEmailRows: summary.unmatchedEmailRows,
        });

        const existingOwners = unitData.owners ?? [];
        const existingManagers = unitData.managers ?? [];

        const ownersChanged =
          JSON.stringify(existingOwners) !== JSON.stringify(ownersResult.converted);
        const managersChanged =
          JSON.stringify(existingManagers) !== JSON.stringify(managersResult.converted);

        summary.matchedEntries += ownersResult.matched + managersResult.matched;
        summary.unmatchedEntries += ownersResult.unmatched + managersResult.unmatched;
        summary.convertedEntries +=
          ownersResult.convertedCount + managersResult.convertedCount;

        if (!ownersChanged && !managersChanged) {
          summary.unitsSkippedNoChanges += 1;
          continue;
        }

        summary.unitsWithChanges += 1;

        if (DRY_RUN) {
          console.log(
            `  [DRY RUN] ${unitRef} ownersChanged=${ownersChanged} managersChanged=${managersChanged}`
          );
          continue;
        }

        try {
          const updatePayload = {
            updated: admin.firestore.FieldValue.serverTimestamp(),
          };

          // Update only changed fields to avoid accidental normalization/writes
          // on untouched contact arrays.
          if (ownersChanged) {
            updatePayload.owners = Array.isArray(ownersResult.converted)
              ? ownersResult.converted
              : [];
          }
          if (managersChanged) {
            updatePayload.managers = Array.isArray(managersResult.converted)
              ? managersResult.converted
              : [];
          }

          await unitDoc.ref.update(updatePayload);

          summary.unitsUpdated += 1;
          console.log(`  [UPDATED] ${unitRef}`);
        } catch (error) {
          summary.writeErrors += 1;
          summary.warnings.push(`${unitRef} write error: ${error.message}`);
          console.log(`  [ERROR] ${unitRef}: ${error.message}`);
        }
      }

      console.log('');
    }

    const uniqueUnmatchedEmails = [
      ...new Set(summary.unmatchedEmailRows.map((row) => row.email)),
    ];

    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total clients: ${summary.totalClients}`);
    console.log(`Total unit docs scanned: ${summary.totalUnitDocs}`);
    console.log(`Units processed (excluding creditBalances*): ${summary.totalUnits}`);
    console.log(`Skipped creditBalances* docs: ${summary.skippedCreditBalanceDocs}`);
    console.log(`Units with changes needed: ${summary.unitsWithChanges}`);
    console.log(`Units skipped (no changes): ${summary.unitsSkippedNoChanges}`);
    console.log(
      `${DRY_RUN ? 'Units that would be updated' : 'Units updated'}: ${
        DRY_RUN ? summary.unitsWithChanges : summary.unitsUpdated
      }`
    );
    console.log(`Matched contact entries: ${summary.matchedEntries}`);
    console.log(`Converted to {userId}: ${summary.convertedEntries}`);
    console.log(`Unmatched contact entries: ${summary.unmatchedEntries}`);
    console.log(`Unique unmatched emails: ${uniqueUnmatchedEmails.length}`);
    console.log(`Warnings: ${summary.warnings.length}`);
    console.log(`Write errors: ${summary.writeErrors}`);

    if (uniqueUnmatchedEmails.length > 0) {
      console.log('\nUnmatched Email Gap Report:');
      for (const email of uniqueUnmatchedEmails) {
        const rows = summary.unmatchedEmailRows.filter((row) => row.email === email);
        const sampleRefs = rows.slice(0, 5).map((row) => `${row.unitRef}:${row.role}`);
        console.log(
          `  - ${email} (${rows.length} entries) -> ${sampleRefs.join(', ')}${
            rows.length > 5 ? ', ...' : ''
          }`
        );
      }
    }

    if (summary.warnings.length > 0) {
      console.log('\nWarnings (first 100):');
      summary.warnings.slice(0, 100).forEach((warning) => {
        console.log(`  - ${warning}`);
      });
      if (summary.warnings.length > 100) {
        console.log(`  ... and ${summary.warnings.length - 100} more warnings`);
      }
    }

    console.log('');
    if (DRY_RUN) {
      console.log('DRY RUN COMPLETE - no changes written.');
      console.log('Run with --execute to apply migration changes.');
    } else {
      console.log('MIGRATION EXECUTION COMPLETE.');
    }
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('Fatal migration error:', error);
    process.exit(1);
  }
}

main();

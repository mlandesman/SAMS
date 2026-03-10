#!/usr/bin/env node
/**
 * Identify Dev Firestore /users docs that should be removed.
 *
 * Prod is gold. Any UID that exists in Prod Auth must not exist in Dev Firestore.
 * If UID xyz123 is in Prod, delete users/xyz123 from Dev.
 *
 * No email matching. Pure UID comparison: Prod UIDs → remove from Dev.
 *
 * Usage:
 *   node scripts/compare-dev-prod-auth.js
 *
 * Requires:
 *   - Dev: functions/backend/serviceAccountKey.json (sandyland-management-system)
 *   - Prod: ADC - run 'gcloud auth application-default login' first
 *
 * For scripts that need an active user login token (e.g. API calls as a user),
 * use the test harness: functions/backend/testing/testHarness.js
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── Credentials ─────────────────────────────────────────────────────────────

const devCredPath = join(ROOT, 'functions/backend/serviceAccountKey.json');
if (!existsSync(devCredPath)) {
  console.error('Missing functions/backend/serviceAccountKey.json (dev)');
  process.exit(1);
}
const devCred = JSON.parse(readFileSync(devCredPath, 'utf8'));

// ── Initialize both projects ────────────────────────────────────────────────
// Dev: service account file. Prod: ADC (gcloud auth application-default login)
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(devCred), projectId: devCred.project_id }, 'dev');
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'sams-sandyland-prod',
  }, 'prod');
}

const devDb = admin.app('dev').firestore();
const prodAuth = admin.app('prod').auth();

// ── List all Prod Auth UIDs ────────────────────────────────────────────────

async function listAllProdUids() {
  const uids = new Set();
  let nextPageToken;
  do {
    const result = await prodAuth.listUsers(1000, nextPageToken);
    result.users.forEach((u) => uids.add(u.uid));
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  return uids;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Prod = gold. Finding Dev Firestore /users docs with Prod UIDs to remove.');
  console.log(`  Dev:  ${devCred.project_id} (service account)`);
  console.log(`  Prod: sams-sandyland-prod (ADC)`);
  console.log('');

  const prodUids = await listAllProdUids();
  const usersSnap = await devDb.collection('users').get();

  const toRemove = [];
  for (const doc of usersSnap.docs) {
    if (prodUids.has(doc.id)) {
      const data = doc.data();
      toRemove.push({ uid: doc.id, email: data?.email || '(no email)' });
    }
  }

  console.log('── Dev Firestore /users docs to remove (UID exists in Prod) ──');
  if (toRemove.length === 0) {
    console.log('   (none)\n');
    return;
  }

  for (const { uid, email } of toRemove) {
    console.log(`   ${uid}  |  ${email}`);
  }
  console.log(`   Total: ${toRemove.length}`);
  console.log('');
  console.log('   To remove: node scripts/remove-prod-users-from-dev.js ' + toRemove.map((x) => x.uid).join(' '));
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

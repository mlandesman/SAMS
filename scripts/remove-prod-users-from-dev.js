#!/usr/bin/env node
/**
 * Remove from Dev Firestore /users any UID that exists in Prod Auth.
 *
 * Prod is gold. If UID xyz123 is in Prod, delete users/xyz123 from Dev.
 * Prod users in Dev Firestore cause getUserByEmail to return the wrong user (e.g. passkey login).
 *
 * Usage:
 *   node scripts/remove-prod-users-from-dev.js dxJd6xfM4NMYFOI350hiBV9jJes2
 *   node scripts/remove-prod-users-from-dev.js uid1 uid2 uid3
 *   node scripts/remove-prod-users-from-dev.js --dry-run dxJd6xfM4NMYFOI350hiBV9jJes2
 *
 * Requires: backend/serviceAccountKey.json (dev project credentials)
 * Run from project root.
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const uids = args.filter((a) => !a.startsWith('--'));

if (uids.length === 0) {
  console.error('Usage: node scripts/remove-prod-users-from-dev.js [--dry-run] <uid1> [uid2] ...');
  console.error('Example: node scripts/remove-prod-users-from-dev.js dxJd6xfM4NMYFOI350hiBV9jJes2');
  process.exit(1);
}

const serviceAccountPath = join(__dirname, '../functions/backend/serviceAccountKey.json');
if (!existsSync(serviceAccountPath)) {
  console.error('Missing backend/serviceAccountKey.json (dev credentials)');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function deleteUserRecursive(userRef) {
  const collections = await userRef.listCollections();
  for (const coll of collections) {
    const snapshot = await coll.get();
    const batch = db.batch();
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    if (snapshot.size > 0) await batch.commit();
  }
  await userRef.delete();
}

async function main() {
  console.log(`Target: Dev Firestore (${serviceAccount.project_id})`);
  console.log(`UIDs to remove: ${uids.join(', ')}`);
  if (dryRun) console.log('--dry-run: no changes will be made\n');

  for (const uid of uids) {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      console.log(`  ${uid}: not found (skip)`);
      continue;
    }
    const data = userDoc.data();
    const email = data?.email || '(no email)';
    const subcollections = await userRef.listCollections();
    const subNames = subcollections.map((c) => c.id).join(', ') || '(none)';

    if (dryRun) {
      console.log(`  ${uid}: would delete (email=${email}, subcollections=${subNames})`);
      continue;
    }

    try {
      await deleteUserRecursive(userRef);
      console.log(`  ${uid}: deleted (email=${email})`);
    } catch (err) {
      console.error(`  ${uid}: failed - ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Enable polls feature flag in Firestore (dev environment).
 * Run from repo root: node scripts/enable-polls-flag.js
 *
 * Production flag will be enabled by Michael.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function enablePollsFlag() {
  try {
    if (!admin.apps.length) {
      // Use dev key by default; production will be enabled by Michael
      const serviceAccountPath = process.env.SAMS_DEV_KEY || join(__dirname, '../functions/serviceAccountKey-dev.json');
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log(`🔑 Using Firebase project: ${serviceAccount.project_id}`);
    }

    const db = admin.firestore();
    const ref = db.doc('system/featureFlags');

    const update = {
      'polls.enabled': true,
      'polls.enabledAt': '2026-03-14',
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'sprint-235-automation'
    };

    await ref.set(update, { merge: true });
    console.log('✅ polls.enabled set to true in system/featureFlags');
    console.log('   polls.enabledAt: 2026-03-14');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

enablePollsFlag();

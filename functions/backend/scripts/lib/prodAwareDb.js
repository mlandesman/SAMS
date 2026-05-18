/**
 * prodAwareDb.js
 *
 * Helper for Stage 3 Task 3.5 / Task 3.2c Production-replay readiness.
 *
 * Returns a Firestore Db instance pointed at either Dev or Prod, with strict
 * safety gating for Prod access:
 *
 *   - Dev:   uses the existing backend/firebase.js init (serviceAccountKey.json)
 *            — same code path that current scripts already use.
 *   - Prod:  initializes a separate Firebase Admin app with Application Default
 *            Credentials (ADC) and projectId='sams-sandyland-prod'. Requires
 *            BOTH a --prod flag (passed in as `isProd`) AND a runtime guard env
 *            var (SAMS_PROD_OK=yes) to be explicitly set. The env-var gate is a
 *            deliberate belt-and-suspenders against accidental Prod access from
 *            any non-Prod-aware caller.
 *
 * Usage:
 *
 *   import { getProdAwareDb } from './lib/prodAwareDb.js';
 *   const { db, env, projectId } = await getProdAwareDb({ isProd: APPLY_PROD });
 *
 * Authentication for Prod relies on `gcloud auth application-default login`
 * having been run. The active gcloud account must have Firebase Admin /
 * Cloud Datastore User permissions on `sams-sandyland-prod`.
 *
 * Centavos discipline, getNow() for timestamps, ES6 modules.
 */

import admin from 'firebase-admin';
import { getDb as getDevDb } from '../../firebase.js';

const PROD_PROJECT_ID = 'sams-sandyland-prod';
const PROD_APP_NAME = 'sams-prod-app';

let prodApp = null;

function assertProdGuard() {
  const ok = process.env.SAMS_PROD_OK;
  if (ok !== 'yes') {
    const msg = [
      'Production access requested but the SAMS_PROD_OK env-var safety gate is not set.',
      'To proceed with Prod access:',
      '  export SAMS_PROD_OK=yes',
      'Then re-run the command. This belt-and-suspenders guard prevents accidental',
      'Prod access from any caller that imports this helper without explicit consent.'
    ].join('\n');
    throw new Error(msg);
  }
}

async function initProdApp() {
  if (prodApp) return prodApp;
  assertProdGuard();
  console.error('🔥 Initializing Firebase Admin SDK for PRODUCTION (ADC)...');
  // ADC: relies on `gcloud auth application-default login` being active. No service
  // account file is referenced, so this never accidentally re-uses Dev credentials.
  prodApp = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROD_PROJECT_ID,
    storageBucket: 'sams-sandyland-prod.firebasestorage.app'
  }, PROD_APP_NAME);
  console.error(`✅ Firebase Admin SDK initialized for PRODUCTION (project=${PROD_PROJECT_ID})`);
  return prodApp;
}

export async function getProdAwareDb({ isProd = false } = {}) {
  if (isProd) {
    const app = await initProdApp();
    return {
      db: app.firestore(),
      env: 'prod',
      projectId: PROD_PROJECT_ID
    };
  }
  return {
    db: await getDevDb(),
    env: 'dev',
    projectId: 'sandyland-management-system'
  };
}

/**
 * Interactive confirmation for Prod writes. Requires the user to type a specific
 * confirmation phrase. Used as a final gate before any --prod --apply path.
 *
 * Bypassable in non-interactive contexts only via SAMS_PROD_CONFIRMED=<phrase>.
 *
 * @param {string} expectedPhrase — phrase the user must type (e.g., "APPLY-TO-PROD-UNIT-106-STEP-A")
 */
export async function confirmProd(expectedPhrase) {
  const env = process.env.SAMS_PROD_CONFIRMED;
  if (env && env === expectedPhrase) {
    console.error(`[confirmProd] env-bypass: SAMS_PROD_CONFIRMED matches expected phrase.`);
    return true;
  }
  console.error('');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('  PRODUCTION WRITE CONFIRMATION REQUIRED');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  console.error(`  To proceed, type EXACTLY this phrase and press Enter:`);
  console.error('');
  console.error(`    ${expectedPhrase}`);
  console.error('');
  process.stderr.write('  > ');

  return new Promise((resolve, reject) => {
    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString();
      if (buf.includes('\n')) {
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        const typed = buf.split('\n')[0].trim();
        if (typed === expectedPhrase) {
          console.error('[confirmProd] phrase matched. Proceeding.');
          resolve(true);
        } else {
          console.error(`[confirmProd] phrase did NOT match. Aborting.`);
          console.error(`  expected: ${expectedPhrase}`);
          console.error(`  got:      ${typed}`);
          resolve(false);
        }
      }
    };
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.resume();
    setTimeout(() => {
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      console.error('[confirmProd] timeout waiting for confirmation; aborting.');
      resolve(false);
    }, 60_000);
  });
}

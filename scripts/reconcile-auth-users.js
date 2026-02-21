#!/usr/bin/env node
/**
 * Firebase Auth ↔ Firestore /users Reconciliation Script
 *
 * Audits and reconciles the Firestore /users collection against Firebase
 * Authentication records. Designed for production use after a backup/restore
 * wiped MTC users from Firebase Auth while leaving Firestore documents intact.
 *
 * Usage:
 *   node scripts/reconcile-auth-users.js --project sams-prod
 *   node scripts/reconcile-auth-users.js --project sams-prod --fix
 *   node scripts/reconcile-auth-users.js --project sams-prod --health-check
 */

import admin from 'firebase-admin';
import { createInterface } from 'readline';
import { randomBytes } from 'crypto';

// ── CLI Argument Parsing ─────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name) {
  return args.includes(`--${name}`);
}

function getOption(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const projectId = getOption('project');
const doFix = getFlag('fix');
const healthCheck = getFlag('health-check');
const verbose = getFlag('verbose');

if (!projectId) {
  console.error('ERROR: --project flag is required.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/reconcile-auth-users.js --project <project-id>');
  console.log('  node scripts/reconcile-auth-users.js --project <project-id> --fix');
  console.log('  node scripts/reconcile-auth-users.js --project <project-id> --health-check');
  console.log('  node scripts/reconcile-auth-users.js --project <project-id> --verbose');
  console.log('');
  console.log('Flags:');
  console.log('  --project <id>   Firebase project ID (required)');
  console.log('  --fix            Reconcile orphaned users (creates Auth records)');
  console.log('  --health-check   Exit with code 1 if any orphans are found');
  console.log('  --verbose        Print detailed per-user information');
  process.exit(1);
}

// ── Firebase Initialization ──────────────────────────────────────────────────

function initFirebase() {
  if (admin.apps.length > 0) return;

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credPath) {
    console.log(`Using service account from GOOGLE_APPLICATION_CREDENTIALS`);
    admin.initializeApp({ projectId });
  } else {
    admin.initializeApp({ projectId });
    console.log(`Using application default credentials for project: ${projectId}`);
  }
}

const db = (() => { initFirebase(); return admin.firestore(); })();
const auth = admin.auth();

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateTempPassword() {
  return randomBytes(24).toString('base64url');
}

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function getAuthUserByUid(uid) {
  try {
    return await auth.getUser(uid);
  } catch (err) {
    if (err.code === 'auth/user-not-found') return null;
    throw err;
  }
}

async function getAuthUserByEmail(email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') return null;
    throw err;
  }
}

/**
 * List ALL Firebase Auth users. The Admin SDK paginates at 1000 per page.
 */
async function listAllAuthUsers() {
  const users = [];
  let nextPageToken;
  do {
    const result = await auth.listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
  } while (nextPageToken);
  return users;
}

function padRight(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function padLeft(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s;
}

// ── Audit Phase ──────────────────────────────────────────────────────────────

async function runAudit() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  FIREBASE AUTH ↔ FIRESTORE /users RECONCILIATION AUDIT');
  console.log(`  Project: ${projectId}`);
  console.log(`  Time:    ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // 1. Fetch all Firestore /users documents
  console.log('Fetching Firestore /users collection...');
  const usersSnapshot = await db.collection('users').get();
  const firestoreUsers = new Map();
  usersSnapshot.forEach((doc) => {
    firestoreUsers.set(doc.id, { id: doc.id, ...doc.data() });
  });
  console.log(`  Found ${firestoreUsers.size} Firestore user documents`);

  // 2. Fetch all Firebase Auth users
  console.log('Fetching Firebase Auth user records...');
  const authUsers = await listAllAuthUsers();
  const authByUid = new Map(authUsers.map((u) => [u.uid, u]));
  const authByEmail = new Map();
  for (const u of authUsers) {
    if (u.email) authByEmail.set(u.email.toLowerCase(), u);
  }
  console.log(`  Found ${authUsers.length} Firebase Auth records`);
  console.log('');

  // 3. Classify each Firestore user
  const orphanedUsers = [];    // Firestore doc with no Auth record
  const syncedUsers = [];      // Both exist and UIDs match
  const mismatchedUsers = [];  // Email exists in Auth but under a different UID

  let errors = 0;

  for (const [docId, userData] of firestoreUsers) {
    try {
      const email = userData.email;
      const authByUidMatch = authByUid.get(docId);

      if (authByUidMatch) {
        syncedUsers.push({
          docId,
          email: email || authByUidMatch.email,
          displayName: userData.displayName || userData.name || '',
          authDisabled: authByUidMatch.disabled,
        });
        continue;
      }

      // UID not found in Auth — check if email exists under a different UID
      if (email) {
        const authByEmailMatch = authByEmail.get(email.toLowerCase());
        if (authByEmailMatch) {
          mismatchedUsers.push({
            docId,
            email,
            displayName: userData.displayName || userData.name || '',
            authUid: authByEmailMatch.uid,
          });
          continue;
        }
      }

      orphanedUsers.push({
        docId,
        email: email || null,
        displayName: userData.displayName || userData.name || '',
        globalRole: userData.globalRole || '',
        loginEnabled: userData.loginEnabled,
        propertyAccess: userData.propertyAccess || userData.clientAccess || {},
      });
    } catch (err) {
      errors++;
      console.error(`  ERROR processing user ${docId}: ${err.message}`);
    }
  }

  // 4. Find orphaned Auth records (Auth exists, no Firestore doc)
  const orphanedAuth = [];
  for (const [uid, authUser] of authByUid) {
    if (!firestoreUsers.has(uid)) {
      orphanedAuth.push({
        uid,
        email: authUser.email || '',
        displayName: authUser.displayName || '',
        disabled: authUser.disabled,
      });
    }
  }

  return { orphanedUsers, orphanedAuth, syncedUsers, mismatchedUsers, errors };
}

// ── Summary Printing ─────────────────────────────────────────────────────────

function printSummary(result) {
  const { orphanedUsers, orphanedAuth, syncedUsers, mismatchedUsers, errors } = result;

  console.log('───────────────────────────────────────────────────────────────────');
  console.log('  SUMMARY');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`  SYNCED (both records exist, UIDs match) : ${syncedUsers.length}`);
  console.log(`  ORPHANED USERS (Firestore, no Auth)     : ${orphanedUsers.length}`);
  console.log(`  ORPHANED AUTH  (Auth, no Firestore)     : ${orphanedAuth.length}`);
  if (mismatchedUsers.length > 0) {
    console.log(`  UID MISMATCH   (email exists, diff UID) : ${mismatchedUsers.length}`);
  }
  if (errors > 0) {
    console.log(`  ERRORS                                  : ${errors}`);
  }
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('');

  // ── Detail Tables ──

  if (orphanedUsers.length > 0) {
    console.log('ORPHANED USERS (Firestore doc exists, no Firebase Auth record):');
    console.log('┌──────────────────────────────┬──────────────────────────────────────┬────────────────┬──────────────┐');
    console.log('│ Email                        │ Doc ID (old UID)                     │ Role           │ Login        │');
    console.log('├──────────────────────────────┼──────────────────────────────────────┼────────────────┼──────────────┤');
    for (const u of orphanedUsers) {
      const email = padRight(u.email || '(no email)', 28);
      const docId = padRight(u.docId, 36);
      const role = padRight(u.globalRole || '-', 14);
      const login = padRight(u.loginEnabled === true ? 'enabled' : u.loginEnabled === false ? 'disabled' : 'unset', 12);
      console.log(`│ ${email} │ ${docId} │ ${role} │ ${login} │`);
    }
    console.log('└──────────────────────────────┴──────────────────────────────────────┴────────────────┴──────────────┘');
    console.log('');
  }

  if (orphanedAuth.length > 0) {
    console.log('ORPHANED AUTH (Firebase Auth record exists, no Firestore /users doc):');
    console.log('┌──────────────────────────────┬──────────────────────────────────────┬──────────┐');
    console.log('│ Email                        │ Auth UID                             │ Disabled │');
    console.log('├──────────────────────────────┼──────────────────────────────────────┼──────────┤');
    for (const u of orphanedAuth) {
      const email = padRight(u.email || '(no email)', 28);
      const uid = padRight(u.uid, 36);
      const disabled = padRight(u.disabled ? 'yes' : 'no', 8);
      console.log(`│ ${email} │ ${uid} │ ${disabled} │`);
    }
    console.log('└──────────────────────────────┴──────────────────────────────────────┴──────────┘');
    console.log('');
  }

  if (mismatchedUsers.length > 0) {
    console.log('UID MISMATCHES (email found in Auth under a different UID):');
    console.log('┌──────────────────────────────┬──────────────────────────────────────┬──────────────────────────────────────┐');
    console.log('│ Email                        │ Firestore Doc ID                     │ Auth UID                             │');
    console.log('├──────────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤');
    for (const u of mismatchedUsers) {
      const email = padRight(u.email, 28);
      const docId = padRight(u.docId, 36);
      const authUid = padRight(u.authUid, 36);
      console.log(`│ ${email} │ ${docId} │ ${authUid} │`);
    }
    console.log('└──────────────────────────────┴──────────────────────────────────────┴──────────────────────────────────────┘');
    console.log('');
    console.log('  WARNING: UID mismatches require manual investigation.');
    console.log('  The --fix flag will NOT touch these users.');
    console.log('');
  }

  if (verbose && syncedUsers.length > 0) {
    console.log('SYNCED USERS:');
    console.log('┌──────────────────────────────┬──────────────────────────────────────┬──────────┐');
    console.log('│ Email                        │ UID                                  │ Disabled │');
    console.log('├──────────────────────────────┼──────────────────────────────────────┼──────────┤');
    for (const u of syncedUsers) {
      const email = padRight(u.email || '(no email)', 28);
      const uid = padRight(u.docId, 36);
      const disabled = padRight(u.authDisabled ? 'yes' : 'no', 8);
      console.log(`│ ${email} │ ${uid} │ ${disabled} │`);
    }
    console.log('└──────────────────────────────┴──────────────────────────────────────┴──────────┘');
    console.log('');
  }
}

// ── Reconciliation Phase ─────────────────────────────────────────────────────

async function runFix(orphanedUsers) {
  if (orphanedUsers.length === 0) {
    console.log('No orphaned users to fix. Everything is in sync.');
    return { fixed: 0, skipped: 0, failed: 0, details: [] };
  }

  const usersWithEmail = orphanedUsers.filter((u) => u.email);
  const usersWithoutEmail = orphanedUsers.filter((u) => !u.email);

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  RECONCILIATION PLAN');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Users to reconcile (have email) : ${usersWithEmail.length}`);
  console.log(`  Users skipped (no email)        : ${usersWithoutEmail.length}`);
  console.log('');
  console.log('  For each orphaned user, the script will:');
  console.log('    1. Create a Firebase Auth record with the SAME UID as the Firestore doc');
  console.log('    2. Set the Auth account as DISABLED');
  console.log('    3. Set loginEnabled = false in the Firestore document');
  console.log('    4. Add reconciliation metadata to the Firestore document');
  console.log('');
  console.log(`  Target project: ${projectId}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  if (usersWithoutEmail.length > 0) {
    console.log('Users WITHOUT email (will be skipped):');
    for (const u of usersWithoutEmail) {
      console.log(`  - ${u.docId} (${u.displayName || 'unnamed'})`);
    }
    console.log('');
  }

  // Confirmation prompt
  const answer = await prompt(
    `  Type "yes" to proceed with reconciling ${usersWithEmail.length} users in ${projectId}: `
  );
  if (answer !== 'yes') {
    console.log('Aborted by user.');
    process.exit(0);
  }

  console.log('');
  console.log('Starting reconciliation...');
  console.log('');

  const details = [];
  let fixed = 0;
  let failed = 0;

  for (const user of usersWithEmail) {
    const { docId, email, displayName } = user;
    try {
      // Step 1: Create Firebase Auth record with the same UID
      const tempPassword = generateTempPassword();
      await auth.createUser({
        uid: docId,
        email,
        displayName: displayName || undefined,
        password: tempPassword,
        emailVerified: false,
        disabled: true,
      });

      // Step 2: Update Firestore document
      await db.collection('users').doc(docId).update({
        loginEnabled: false,
        _reconciled: true,
        _reconciledAt: new Date().toISOString(),
        _reconciledBy: 'reconcile-auth-users-script',
        _reconciledNote: 'Auth record recreated after backup/restore loss',
      });

      fixed++;
      details.push({ docId, email, status: 'FIXED' });
      console.log(`  FIXED  ${email} (${docId})`);
    } catch (err) {
      failed++;
      details.push({ docId, email, status: 'FAILED', error: err.message });
      console.error(`  FAIL   ${email} (${docId}): ${err.message}`);
    }
  }

  console.log('');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('  RECONCILIATION RESULTS');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`  Fixed   : ${fixed}`);
  console.log(`  Skipped : ${usersWithoutEmail.length} (no email)`);
  console.log(`  Failed  : ${failed}`);
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('');

  if (failed > 0) {
    console.log('FAILED USERS:');
    for (const d of details.filter((d) => d.status === 'FAILED')) {
      console.log(`  ${d.email} (${d.docId}): ${d.error}`);
    }
    console.log('');
  }

  return { fixed, skipped: usersWithoutEmail.length, failed, details };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const result = await runAudit();
    printSummary(result);

    if (healthCheck) {
      const hasOrphans = result.orphanedUsers.length > 0 || result.orphanedAuth.length > 0;
      if (hasOrphans) {
        console.log('HEALTH CHECK: DRIFT DETECTED — orphaned records found.');
        process.exit(1);
      } else {
        console.log('HEALTH CHECK: OK — all records are in sync.');
        process.exit(0);
      }
    }

    if (doFix) {
      await runFix(result.orphanedUsers);
    } else if (result.orphanedUsers.length > 0) {
      console.log('Run with --fix to reconcile orphaned users.');
      console.log(`  node scripts/reconcile-auth-users.js --project ${projectId} --fix`);
      console.log('');
    }
  } catch (err) {
    console.error('');
    console.error('FATAL ERROR:', err.message);
    if (verbose) console.error(err.stack);
    process.exit(2);
  }
}

main();

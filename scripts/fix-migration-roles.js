#!/usr/bin/env node
/**
 * Migration role data repair — NRM migration wrote incorrect propertyAccess roles.
 * Data-only script (no app code changes). Dry-run by default.
 *
 * Usage:
 *   node scripts/fix-migration-roles.js --project <project-id>
 *   node scripts/fix-migration-roles.js --project <project-id> --live
 *   node scripts/fix-migration-roles.js --project <project-id> --client MTC
 *   node scripts/fix-migration-roles.js --project <project-id> --live --client AVII
 *   node scripts/fix-migration-roles.js --project <project-id> --verbose
 */

import admin from 'firebase-admin';
import { createInterface } from 'readline';

const VALID_ROLES = new Set(['unitOwner', 'unitManager']);

// ── CLI ───────────────────────────────────────────────────────────────────────

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
const live = getFlag('live');
const clientScope = getOption('client');
const verbose = getFlag('verbose');

if (!projectId) {
  console.error('ERROR: --project flag is required.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/fix-migration-roles.js --project <project-id>');
  console.log('  node scripts/fix-migration-roles.js --project <project-id> --live');
  console.log('  node scripts/fix-migration-roles.js --project <project-id> --client MTC');
  console.log('  node scripts/fix-migration-roles.js --project <project-id> --live --client AVII');
  console.log('  node scripts/fix-migration-roles.js --project <project-id> --verbose');
  console.log('');
  console.log('Flags:');
  console.log('  --project <id>   Firebase project ID (required)');
  console.log('  --live           Apply fixes (default is dry-run / report only)');
  console.log('  --client <id>    Scope to a single client ID (optional)');
  console.log('  --verbose        Print detailed per-user/per-unit information');
  process.exit(1);
}

// ── Firebase ────────────────────────────────────────────────────────────────

function initFirebase() {
  if (admin.apps.length > 0) return;
  admin.initializeApp({ projectId });
  const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (cred) {
    console.log('Using GOOGLE_APPLICATION_CREDENTIALS for credentials');
  } else {
    console.log(`Using application default credentials for project: ${projectId}`);
  }
}

const db = (() => {
  initFirebase();
  return admin.firestore();
})();

function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function padRight(str, len) {
  const s = String(str ?? '');
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function deepClone(obj) {
  return obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));
}

// ── Role normalization ─────────────────────────────────────────────────────

function mapAssignmentRole(current) {
  if (current === 'owner') return { next: 'unitOwner', changed: true, warn: false };
  if (current === 'manager') return { next: 'unitManager', changed: true, warn: false };
  if (VALID_ROLES.has(current)) return { next: current, changed: false, warn: false };
  return { next: current, changed: false, warn: true };
}

function deriveTopLevelRole(unitAssignments) {
  const roles = unitAssignments.map((a) => a.role).filter(Boolean);
  return roles.includes('unitOwner') ? 'unitOwner' : 'unitManager';
}

// ── Email → userId map ───────────────────────────────────────────────────────

function buildEmailToUserIdMap(usersById) {
  const map = new Map();
  const duplicates = [];
  for (const [uid, data] of usersById) {
    const email = data.email;
    if (!email || typeof email !== 'string') continue;
    const key = email.trim().toLowerCase();
    if (map.has(key) && map.get(key) !== uid) {
      duplicates.push({ email: key, a: map.get(key), b: uid });
    }
    map.set(key, uid);
  }
  return { map, duplicates };
}

// ── Fix 4: legacy owners / managers arrays ───────────────────────────────────

/**
 * Convert legacy { name, email } entries to { userId } where possible.
 * Drop duplicates when the same userId already appears.
 * Drop unresolved legacy entries (email not found in users collection) — these
 * are reported for manual review and can be re-added if needed.
 */
function convertLegacyPersonArray(arr, emailToUid, stats) {
  const list = Array.isArray(arr) ? arr : [];
  if (list.length === 0) return { changed: false, next: list, dropped: [] };

  const explicitUids = new Set();
  for (const e of arr) {
    if (e && e.userId) explicitUids.add(e.userId);
  }

  const next = [];
  const seenUids = new Set();
  const dropped = [];

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;

    if (entry.userId) {
      if (!seenUids.has(entry.userId)) {
        seenUids.add(entry.userId);
        next.push({ userId: entry.userId });
      }
      continue;
    }

    if (entry.email && typeof entry.email === 'string') {
      const uid = emailToUid.get(entry.email.trim().toLowerCase());
      if (uid) {
        if (explicitUids.has(uid)) {
          stats.convertedDupSkipped++;
          continue;
        }
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          next.push({ userId: uid });
          stats.converted++;
        }
        continue;
      }
    }

    dropped.push(entry);
    stats.dropped = (stats.dropped || 0) + 1;
  }

  const changed = JSON.stringify(next) !== JSON.stringify(list);
  return { changed, next, dropped };
}

function processUnitArrays(owners, managers, emailToUid) {
  const stats = { converted: 0, convertedDupSkipped: 0, dropped: 0 };
  const o = convertLegacyPersonArray(owners || [], emailToUid, stats);
  const m = convertLegacyPersonArray(managers || [], emailToUid, stats);
  const rows = [];
  const droppedRows = [];

  const before_o = owners || [];
  for (const b of before_o) {
    if (b && b.email && !b.userId) {
      const uid = emailToUid.get(b.email.trim().toLowerCase());
      if (uid) {
        rows.push({ legacyName: b.name || '', legacyEmail: b.email, userId: uid, array: 'owners' });
      }
    }
  }
  for (const d of o.dropped) {
    droppedRows.push({ name: d.name || '', email: d.email || '(none)', array: 'owners' });
  }

  const before_m = managers || [];
  for (const b of before_m) {
    if (b && b.email && !b.userId) {
      const uid = emailToUid.get(b.email.trim().toLowerCase());
      if (uid) {
        rows.push({ legacyName: b.name || '', legacyEmail: b.email, userId: uid, array: 'managers' });
      }
    }
  }
  for (const d of m.dropped) {
    droppedRows.push({ name: d.name || '', email: d.email || '(none)', array: 'managers' });
  }

  return {
    changed: o.changed || m.changed,
    owners: o.next,
    managers: m.next,
    stats,
    rows,
    droppedRows,
  };
}

// ── Apply fixes to one user's propertyAccess ─────────────────────────────────

function repairClientAccess(access, clientId, clientLegacy, email, warnings, counters, fix1Rows, clientScopeId) {
  if (clientScopeId && clientId !== clientScopeId) return { modified: false, access };

  const a = deepClone(access);
  if (!a.unitAssignments || !Array.isArray(a.unitAssignments)) {
    return { modified: false, access: a };
  }

  let modified = false;

  for (let i = 0; i < a.unitAssignments.length; i++) {
    const asg = a.unitAssignments[i];
    const cur = asg.role;
    const { next, changed, warn } = mapAssignmentRole(cur);
    if (warn) {
      warnings.push(
        `User ${email} client ${clientId} unit ${asg.unitId}: unexpected role "${cur}" (manual review)`
      );
    }
    if (changed) {
      fix1Rows.push({
        email,
        clientId,
        unitId: asg.unitId || '',
        currentRole: cur,
        fixedRole: next,
      });
      a.unitAssignments[i] = { ...asg, role: next };
      modified = true;
      counters.roleValuesFixed++;
    }
  }

  const assignments = a.unitAssignments.filter((x) => x && x.unitId);
  if (assignments.length === 0) {
    return { modified, access: a };
  }

  const wantRole = deriveTopLevelRole(assignments);
  const wantUnitId = assignments[0].unitId;

  const prevRole = a.role;
  const prevUnitId = a.unitId;
  a.role = wantRole;
  a.unitId = wantUnitId;
  if (prevRole !== wantRole || prevUnitId !== wantUnitId) {
    counters.topLevelFixed++;
    modified = true;
  }

  if (clientLegacy) {
    const fields = ['addedDate', 'addedBy', 'permissions'];
    for (const f of fields) {
      if (a[f] === undefined && clientLegacy[f] !== undefined) {
        a[f] = deepClone(clientLegacy[f]);
        counters.fieldsMerged++;
        modified = true;
      }
    }
    for (let j = 0; j < a.unitAssignments.length; j++) {
      const asg = a.unitAssignments[j];
      if (!asg) continue;
      let asgMod = false;
      if (asg.addedDate === undefined && clientLegacy.addedDate) {
        asg.addedDate = clientLegacy.addedDate;
        asgMod = true;
        counters.fieldsMerged++;
      }
      if (asg.addedBy === undefined && clientLegacy.addedBy) {
        asg.addedBy = clientLegacy.addedBy;
        asgMod = true;
        counters.fieldsMerged++;
      }
      if (asgMod) {
        a.unitAssignments[j] = asg;
        modified = true;
      }
    }
  }

  return { modified, access: a };
}

// ── Main audit ───────────────────────────────────────────────────────────────

async function loadAllUsers() {
  const snap = await db.collection('users').get();
  const map = new Map();
  snap.forEach((doc) => {
    map.set(doc.id, { id: doc.id, ...doc.data() });
  });
  return map;
}

async function runRepair() {
  const modeLabel = live ? 'LIVE APPLY' : 'DRY RUN';
  const nowIso = new Date().toISOString();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  MIGRATION ROLE DATA REPAIR — ${modeLabel}`);
  console.log(`  Project: ${projectId}`);
  if (clientScope) console.log(`  Client:  ${clientScope} (scoped)`);
  console.log(`  Time:    ${nowIso}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  console.log('Loading users collection...');
  const usersById = await loadAllUsers();
  const { map: emailToUid, duplicates } = buildEmailToUserIdMap(usersById);
  if (duplicates.length > 0 && verbose) {
    console.log('  NOTE: duplicate emails map to last user doc (see verbose):');
    for (const d of duplicates.slice(0, 10)) {
      console.log(`    ${d.email}: ${d.a} vs ${d.b}`);
    }
  }
  console.log(`  Total users: ${usersById.size}`);
  console.log('');

  const usersToScan = [];
  for (const [uid, data] of usersById) {
    if (data.propertyAccess && typeof data.propertyAccess === 'object') {
      usersToScan.push({ uid, ...data });
    }
  }

  console.log('Scanning users with propertyAccess...');
  console.log(`  Found ${usersToScan.length} users with propertyAccess data`);
  console.log('');

  const warnings = [];
  const counters = {
    roleValuesFixed: 0,
    topLevelFixed: 0,
    fieldsMerged: 0,
    unitEntriesConverted: 0,
    unitEntriesDropped: 0,
  };

  const fix1Rows = [];
  const fix2Lines = [];
  const fix3Lines = [];
  const userUpdates = [];

  for (const user of usersToScan) {
    const { uid, email, propertyAccess: paIn, clientAccess: caIn } = user;
    const emailStr = email || uid;

    const pa = deepClone(paIn);
    let userModified = false;

    for (const clientId of Object.keys(pa)) {
      const legacy = caIn && caIn[clientId] ? caIn[clientId] : null;
      const before = deepClone(pa[clientId]);
      const { modified, access } = repairClientAccess(
        pa[clientId],
        clientId,
        legacy,
        emailStr,
        warnings,
        counters,
        fix1Rows,
        clientScope
      );
      if (modified) {
        pa[clientId] = access;
        userModified = true;
        if (legacy) {
          const mergedBits = [];
          if (before.addedDate === undefined && legacy.addedDate !== undefined) mergedBits.push('addedDate');
          if (before.addedBy === undefined && legacy.addedBy !== undefined) mergedBits.push('addedBy');
          if (before.permissions === undefined && legacy.permissions !== undefined) mergedBits.push('permissions');
          if (mergedBits.length) {
            fix3Lines.push(`  ${emailStr} → ${clientId}: merged ${mergedBits.join(', ')}`);
          }
        }
        const hadRole = before.role !== undefined;
        const hadUnit = before.unitId !== undefined;
        if (!hadRole || !hadUnit) {
          fix2Lines.push(
            `  ${emailStr} → ${clientId}: role=${access.role}, unitId=${access.unitId} (was: ${!hadRole ? 'missing role' : ''}${!hadRole && !hadUnit ? ', ' : ''}${!hadUnit ? 'missing unitId' : ''})`
          );
        }
      }
    }

    if (userModified) {
      userUpdates.push({ uid, email: emailStr, propertyAccess: pa });
    }
  }

  // ── FIX 4: units ──────────────────────────────────────────
  const unitKeys = new Set();
  for (const u of usersToScan) {
    const pa = u.propertyAccess;
    if (!pa) continue;
    for (const clientId of Object.keys(pa)) {
      if (clientScope && clientId !== clientScope) continue;
      const block = pa[clientId];
      if (!block || !Array.isArray(block.unitAssignments)) continue;
      for (const asg of block.unitAssignments) {
        if (asg && asg.unitId) {
          unitKeys.add(`${clientId}/${asg.unitId}`);
        }
      }
    }
  }

  const fix4Rows = [];
  const fix4DroppedRows = [];
  const unitUpdates = [];

  console.log(`FIX 4: scanning ${unitKeys.size} unit documents referenced by scanned users...`);
  for (const key of unitKeys) {
    const [clientId, unitId] = key.split('/');
    const ref = db.collection('clients').doc(clientId).collection('units').doc(unitId);
    const doc = await ref.get();
    if (!doc.exists) {
      warnings.push(`Unit missing: clients/${clientId}/units/${unitId}`);
      continue;
    }
    const data = doc.data();
    const owners = data.owners || [];
    const managers = data.managers || [];

    const proc = processUnitArrays(owners, managers, emailToUid);
    if (proc.changed) {
      counters.unitEntriesConverted += proc.stats.converted;
      counters.unitEntriesDropped = (counters.unitEntriesDropped || 0) + (proc.stats.dropped || 0);
      for (const r of proc.rows) {
        fix4Rows.push({
          clientId,
          unitId,
          legacyLabel: `${r.legacyName} / ${r.legacyEmail}`,
          userId: r.userId,
          array: r.array,
        });
      }
      for (const d of proc.droppedRows) {
        fix4DroppedRows.push({ clientId, unitId, name: d.name, email: d.email, array: d.array });
      }
      unitUpdates.push({
        ref,
        data: {
          owners: proc.owners,
          managers: proc.managers,
          _migrationRoleRepairAt: nowIso,
          _migrationRoleRepairScript: 'fix-migration-roles.js',
        },
      });
    } else if (verbose) {
      console.log(`  skip ${key} (no changes needed)`);
    }
  }

  // ── Output ──────────────────────────────────────────────────

  console.log('FIX 1: Role Value Normalization');
  if (fix1Rows.length === 0) {
    console.log('  (no role string changes needed)');
  } else {
    console.log('┌────────────────────────────┬──────────┬────────────┬──────────────┬──────────────┐');
    console.log('│ User                       │ Client   │ Unit       │ Current Role │ Fixed Role   │');
    console.log('├────────────────────────────┼──────────┼────────────┼──────────────┼──────────────┤');
    for (const row of fix1Rows) {
      const u = padRight(row.email.slice(0, 26), 26);
      const c = padRight(row.clientId, 8);
      const un = padRight(String(row.unitId), 10);
      const cr = padRight(String(row.currentRole), 12);
      const fr = padRight(String(row.fixedRole), 12);
      console.log(`│ ${u} │ ${c} │ ${un} │ ${cr} │ ${fr} │`);
    }
    console.log('└────────────────────────────┴──────────┴────────────┴──────────────┴──────────────┘');
  }
  console.log('');

  console.log('FIX 2: Missing Top-Level Role');
  if (fix2Lines.length === 0) {
    console.log('  (none)');
  } else {
    for (const line of fix2Lines) console.log(line);
  }
  console.log('');

  console.log('FIX 3: clientAccess → propertyAccess Field Merge');
  if (fix3Lines.length === 0) {
    console.log('  (none)');
  } else {
    for (const line of fix3Lines) console.log(line);
  }
  console.log('');

  console.log('FIX 4: Unit Document Legacy Entry Conversion');
  if (fix4Rows.length === 0) {
    console.log('  (no legacy owner/manager email entries converted)');
  } else {
    console.log('┌──────────┬──────────┬────────────────────────────┬──────────────────────────────────────┬────────┐');
    console.log('│ Client   │ Unit     │ Name/Email (legacy)        │ Converted to userId                  │ Array  │');
    console.log('├──────────┼──────────┼────────────────────────────┼──────────────────────────────────────┼────────┤');
    for (const row of fix4Rows) {
      const c = padRight(row.clientId, 8);
      const u = padRight(row.unitId, 8);
      const leg = padRight(row.legacyLabel.slice(0, 26), 26);
      const uid = padRight(row.userId, 36);
      const ar = padRight(row.array, 6);
      console.log(`│ ${c} │ ${u} │ ${leg} │ ${uid} │ ${ar} │`);
    }
    console.log('└──────────┴──────────┴────────────────────────────┴──────────────────────────────────────┴────────┘');
  }
  console.log('');

  if (fix4DroppedRows.length > 0) {
    console.log('⚠ FIX 4: DROPPED — Legacy entries with no matching user (will be REMOVED):');
    console.log('┌──────────┬──────────┬────────────────────────────┬──────────────────────────────┬────────┐');
    console.log('│ Client   │ Unit     │ Name                       │ Email                        │ Array  │');
    console.log('├──────────┼──────────┼────────────────────────────┼──────────────────────────────┼────────┤');
    for (const row of fix4DroppedRows) {
      const c = padRight(row.clientId, 8);
      const u = padRight(row.unitId, 8);
      const n = padRight(row.name.slice(0, 26), 26);
      const e = padRight(row.email.slice(0, 28), 28);
      const ar = padRight(row.array, 6);
      console.log(`│ ${c} │ ${u} │ ${n} │ ${e} │ ${ar} │`);
    }
    console.log('└──────────┴──────────┴────────────────────────────┴──────────────────────────────┴────────┘');
    console.log('  These entries have {name, email} but the email does not match any user in Firestore.');
    console.log('  They will be removed in --live mode. Re-add manually via SAMS admin UI if needed.');
    console.log('');
  }

  console.log('WARNINGS (manual review needed):');
  if (warnings.length === 0) {
    console.log('  (none)');
  } else {
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log('');

  console.log('───────────────────────────────────────────────────────────────────');
  console.log('  SUMMARY');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`  Users scanned         : ${usersToScan.length}`);
  console.log(`  Role values fixed     : ${counters.roleValuesFixed}`);
  console.log(`  Top-level roles added : ${counters.topLevelFixed}`);
  console.log(`  Fields merged         : ${counters.fieldsMerged}`);
  console.log(`  Unit entries converted: ${counters.unitEntriesConverted}`);
  console.log(`  Unit entries DROPPED  : ${counters.unitEntriesDropped || 0}`);
  console.log(`  Warnings              : ${warnings.length}`);
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('');

  if (!live) {
    console.log('  Run with --live to apply these fixes.');
    console.log('');
    return { userUpdates, unitUpdates, counters };
  }

  const totalWrites = userUpdates.length + unitUpdates.length;
  if (totalWrites === 0) {
    console.log('Nothing to write.');
    return { userUpdates, unitUpdates, counters };
  }

  const answer = await prompt(
    `  Type "yes" to apply ${userUpdates.length} user update(s) and ${unitUpdates.length} unit update(s) in ${projectId}: `
  );
  if (answer !== 'yes') {
    console.log('Aborted by user.');
    process.exit(0);
  }

  console.log('');
  console.log('Applying batched writes...');

  const BATCH_MAX = 500;
  let ops = 0;
  let batch = db.batch();

  async function flushBatch() {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  for (const u of userUpdates) {
    if (ops >= BATCH_MAX) await flushBatch();
    batch.update(db.collection('users').doc(u.uid), {
      propertyAccess: u.propertyAccess,
      _migrationRoleRepairAt: nowIso,
      _migrationRoleRepairScript: 'fix-migration-roles.js',
    });
    ops++;
  }

  for (const u of unitUpdates) {
    if (ops >= BATCH_MAX) await flushBatch();
    batch.update(u.ref, u.data);
    ops++;
  }

  await flushBatch();

  console.log('Done.');
  return { userUpdates, unitUpdates, counters };
}

async function main() {
  try {
    await runRepair();
  } catch (err) {
    console.error('');
    console.error('FATAL ERROR:', err.message);
    if (verbose) console.error(err.stack);
    process.exit(2);
  }
}

main();

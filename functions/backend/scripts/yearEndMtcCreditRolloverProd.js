/**
 * Temporary PROD script for MTC credit balance rollover (2025 -> 2026)
 * Uses ADC (applicationDefault) against sams-sandyland-prod.
 * Steps:
 * 1) Backup creditBalances
 * 2) Archive to creditBalances_2025 (fail if exists)
 * 3) Seed new creditBalances with starting_balance per unit (timestamp 2026-01-01T00:00:00-05:00)
 * Do not commit.
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { DateTime } from 'luxon';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientId = 'MTC';
const closingYear = 2025;
const openingYear = closingYear + 1;
const timezone = 'America/Cancun';

function initProdAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: 'sams-sandyland-prod'
    });
  }
  return admin.firestore();
}

function yearStartTimestamp() {
  const dt = DateTime.fromObject(
    { year: openingYear, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
    { zone: timezone }
  );
  return admin.firestore.Timestamp.fromMillis(dt.toMillis());
}

function summarize(history = []) {
  let addedCount = 0, addedTotal = 0, usedCount = 0, usedTotal = 0;
  for (const entry of history) {
    const amt = typeof entry.amount === 'number' ? entry.amount : 0;
    const type = entry.type || '';
    if (type === 'credit_added' || amt > 0) { addedCount++; addedTotal += amt; }
    else if (type === 'credit_used' || amt < 0) { usedCount++; usedTotal += Math.abs(amt); }
  }
  return { addedCount, addedTotal, usedCount, usedTotal };
}

function buildNote(summary) {
  const { addedCount, addedTotal, usedCount, usedTotal } = summary;
  const toPesos = (c) => (c / 100).toFixed(2);
  return `Prior-year summary: credit_added ${addedCount} entries, total $${toPesos(addedTotal)}; credit_used ${usedCount} entries, total $${toPesos(usedTotal)}.`;
}

async function main() {
  console.log('🌎 PROD credit rollover start (MTC 2025->2026)');
  const db = initProdAdmin();

  const creditRef = db.collection('clients').doc(clientId).collection('units').doc('creditBalances');
  const archiveRef = db.collection('clients').doc(clientId).collection('units').doc(`creditBalances_${closingYear}`);

  const creditDoc = await creditRef.get();
  if (!creditDoc.exists) throw new Error('creditBalances missing in PROD');
  const creditData = creditDoc.data();

  const archiveDoc = await archiveRef.get();
  if (archiveDoc.exists) throw new Error(`Archive creditBalances_${closingYear} already exists (abort).`);

  const backupPath = path.resolve(__dirname, `../data/imports/MTC_creditBalances_PROD_backup_${Date.now()}.json`);
  await fs.writeFile(backupPath, JSON.stringify(creditData, null, 2));
  console.log(`💾 Backup saved: ${backupPath}`);

  await archiveRef.set(creditData);
  console.log(`📦 Archived to creditBalances_${closingYear}`);

  const ts = yearStartTimestamp();
  const newDoc = {};
  const units = Object.entries(creditData).filter(([_, v]) => v && Array.isArray(v.history));

  for (const [unitId, unitData] of units) {
    const closingBalance = getCreditBalance(unitData);
    const summary = summarize(unitData.history);
    const note = buildNote(summary);

    newDoc[unitId] = {
      history: [{
        id: `starting_balance_${unitId}_${Date.now()}`,
        type: 'starting_balance',
        amount: closingBalance,
        transactionId: null,
        timestamp: ts,
        source: 'year_end_rollover',
        notes: note
      }],
      creditBalance: closingBalance,
      lastChange: {
        year: String(openingYear),
        timestamp: ts,
        historyIndex: 0
      }
    };
  }

  await creditRef.set(newDoc);
  console.log(`✅ Seeded new creditBalances with ${units.length} units`);
}

main()
  .then(() => {
    console.log('🎉 PROD rollover complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ PROD rollover failed:', err.message);
    process.exit(1);
  });


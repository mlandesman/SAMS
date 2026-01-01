/**
 * Temporary DEV script for MTC year-end credit balance rollover (2025 → 2026)
 * Steps:
 * 1) Backup current creditBalances
 * 2) Archive to creditBalances_2025 (fail if exists)
 * 3) Seed new creditBalances with one starting_balance per unit
 * 
 * IMPORTANT: DEV ONLY. Do not commit. No ADC/prod.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { DateTime } from 'luxon';
import { getDb, admin } from '../firebase.js';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientId = 'MTC';
const closingYear = 2025;
const openingYear = closingYear + 1;
const timezone = 'America/Cancun';

function getYearStartTimestamp() {
  const dt = DateTime.fromObject(
    {
      year: openingYear,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0
    },
    { zone: timezone }
  );
  return admin.firestore.Timestamp.fromMillis(dt.toMillis());
}

function summarizeHistory(unitHistory = []) {
  let addedCount = 0;
  let addedTotal = 0;
  let usedCount = 0;
  let usedTotal = 0;

  for (const entry of unitHistory) {
    const amount = typeof entry.amount === 'number' ? entry.amount : 0;
    const type = entry.type || '';
    if (type === 'credit_added' || amount > 0) {
      addedCount += 1;
      addedTotal += amount;
    } else if (type === 'credit_used' || amount < 0) {
      usedCount += 1;
      usedTotal += Math.abs(amount);
    }
  }

  return {
    addedCount,
    addedTotal,
    usedCount,
    usedTotal
  };
}

function buildNote(summary) {
  const { addedCount, addedTotal, usedCount, usedTotal } = summary;
  const toPesos = (cents) => (cents / 100).toFixed(2);
  return `Prior-year summary: credit_added ${addedCount} entries, total $${toPesos(addedTotal)}; credit_used ${usedCount} entries, total $${toPesos(usedTotal)}.`;
}

async function main() {
  console.log('🚀 Starting MTC credit balance rollover (DEV)');
  const db = await getDb();

  const creditRef = db.collection('clients').doc(clientId).collection('units').doc('creditBalances');
  const archiveRef = db.collection('clients').doc(clientId).collection('units').doc(`creditBalances_${closingYear}`);

  const creditDoc = await creditRef.get();
  if (!creditDoc.exists) {
    throw new Error('creditBalances document not found');
  }

  const creditData = creditDoc.data();

  // Fail if archive already exists
  const archiveDoc = await archiveRef.get();
  if (archiveDoc.exists) {
    throw new Error(`Archive creditBalances_${closingYear} already exists; aborting to avoid overwrite.`);
  }

  // Backup to file
  const backupPath = path.resolve(__dirname, `../data/imports/MTC_creditBalances_backup_${Date.now()}.json`);
  await fs.writeFile(backupPath, JSON.stringify(creditData, null, 2));
  console.log(`💾 Backup saved: ${backupPath}`);

  // Archive current doc
  await archiveRef.set(creditData);
  console.log(`📦 Archived current creditBalances to creditBalances_${closingYear}`);

  // Build new creditBalances with starting_balance entries
  const ts = getYearStartTimestamp();
  const newDoc = {};
  const unitEntries = Object.entries(creditData).filter(([key, val]) => val && typeof val === 'object' && Array.isArray(val.history));

  for (const [unitId, unitData] of unitEntries) {
    const closingBalance = getCreditBalance(unitData);
    const summary = summarizeHistory(unitData.history);
    const note = buildNote(summary);

    const historyEntry = {
      id: `starting_balance_${unitId}_${Date.now()}`,
      type: 'starting_balance',
      amount: closingBalance,
      transactionId: null,
      timestamp: ts,
      source: 'year_end_rollover',
      notes: note
    };

    newDoc[unitId] = {
      history: [historyEntry],
      creditBalance: closingBalance,
      lastChange: {
        year: String(openingYear),
        timestamp: ts,
        historyIndex: 0
      }
    };
  }

  await creditRef.set(newDoc);
  console.log(`✅ New creditBalances seeded with starting_balance entries for ${unitEntries.length} units`);
}

main()
  .then(() => {
    console.log('🎉 Rollover complete (DEV)');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Rollover failed:', err.message);
    process.exit(1);
  });


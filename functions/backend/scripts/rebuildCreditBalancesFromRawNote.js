/**
 * Rebuild creditBalances from rawNote (AVII).
 *
 * Reads creditBalances.json (storage imports/creditBalances.json or local
 * functions/backend/data/imports/creditBalances.json), parses rawNote blocks,
 * and rewrites /clients/{clientId}/units/creditBalances with a clean history
 * based on starting balance + successive "Credit Adjusted to ..." entries.
 *
 * Usage:
 *   NODE_ENV=production node functions/backend/scripts/rebuildCreditBalancesFromRawNote.js AVII
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getNow } from '../../shared/services/DateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toNumber(val) {
  const n = Number(String(val ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDateFlexible(dateText) {
  if (!dateText) return null;
  const d = new Date(dateText);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/**
 * Parse a credit balance note into structured entries (ported from GAS).
 * @param {string} note
 * @returns {{startingBalance:(number|null), entries:Array<object>}}
 */
function parseCreditNote(note) {
  if (!note) return { startingBalance: null, entries: [] };

  const text = note.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = text.split(/\n-+\n/).map(b => b.trim()).filter(Boolean);

  let startingBalance = null;
  const entries = [];

  if (blocks.length) {
    const m = blocks[0].match(/Starting Balance:\s*\$?\s*([0-9,.\-]+)/i);
    if (m) startingBalance = toNumber(m[1]);
  }

  for (let i = 1; i < blocks.length; i++) {
    const lines = blocks[i].split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const mainLine = lines[0];
    const m = mainLine.match(/Credit Adjusted to\s+MXN\s*\$?\s*([0-9,.\-]+)\s+on\s+(.+?)\s+from\s+(.+)$/i);

    if (!m) {
      entries.push({ unparsed: true, text: blocks[i] });
      continue;
    }

    const adjustedBalanceMxn = toNumber(m[1]);
    const dateText = m[2];
    const fromText = m[3];

    let sourceCurrency = null;
    let sourceAmount = null;
    const amt = fromText.match(/\b(MXN|USD)\b\s*\$?\s*([0-9,.\-]+)/i);
    if (amt) {
      sourceCurrency = amt[1].toUpperCase();
      sourceAmount = toNumber(amt[2]);
    }

    entries.push({
      adjustedBalanceMxn,
      dateText,
      fromText,
      sourceCurrency,
      sourceAmount,
      details: lines.slice(1).join('\n') || ''
    });
  }

  return { startingBalance, entries };
}

function pesosToCentavos(pesos) {
  if (!pesos || isNaN(pesos)) return 0;
  return Math.round(pesos * 100);
}

/**
 * Build history from rawNote parsing.
 */
function buildHistoryFromRawNote(unitId, rawNote, fiscalYearStartMonth = 6) {
  const parsed = parseCreditNote(rawNote);
  const history = [];

  let currentBalance = parsed.startingBalance ?? 0;
  let previousBalance = 0;

  // Use first entry date or fiscal year start for starting_balance timestamp
  const firstEntryDate = parsed.entries.find(e => !e.unparsed && parseDateFlexible(e.dateText));
  const startDate = firstEntryDate
    ? parseDateFlexible(firstEntryDate.dateText)
    : new Date(getNow().getFullYear(), fiscalYearStartMonth, 1);

  history.push({
    id: `starting_balance_${unitId}_${Date.now()}`,
    timestamp: admin.firestore.Timestamp.fromDate(startDate),
    transactionId: null,
    type: 'starting_balance',
    amount: pesosToCentavos(Math.abs(currentBalance)),
    description: 'Starting credit balance from prior period',
    balanceBefore: 0,
    balanceAfter: pesosToCentavos(currentBalance),
    notes: rawNote || ''
  });

  previousBalance = currentBalance;

  parsed.entries.forEach((entry, idx) => {
    if (entry.unparsed) {
      return;
    }
    if (entry.adjustedBalanceMxn === undefined || entry.adjustedBalanceMxn === null) {
      return;
    }

    const nextBalance = entry.adjustedBalanceMxn;
    const delta = nextBalance - previousBalance;
    const type = delta >= 0 ? 'credit_added' : 'credit_used';
    const ts = parseDateFlexible(entry.dateText) || getNow();

    history.push({
      id: `entry_${idx}_${unitId}_${Date.now()}`,
      timestamp: admin.firestore.Timestamp.fromDate(ts),
      transactionId: null,
      type,
      amount: pesosToCentavos(Math.abs(delta)),
      description: entry.fromText || entry.details || '',
      balanceBefore: pesosToCentavos(previousBalance),
      balanceAfter: pesosToCentavos(nextBalance),
      notes: entry.details || ''
    });

    previousBalance = nextBalance;
  });

  const finalBalance = previousBalance;

  return {
    creditBalance: pesosToCentavos(finalBalance),
    lastChange: {
      year: new Date().getFullYear().toString(),
      historyIndex: history.length - 1,
      timestamp: getNow().toISOString()
    },
    history
  };
}

async function loadCreditBalancesJson() {
  const bucket = admin.storage().bucket();
  try {
    const file = bucket.file('imports/creditBalances.json');
    const [exists] = await file.exists();
    if (exists) {
      const [buf] = await file.download();
      return JSON.parse(buf.toString());
    }
  } catch (e) {
    // Fall through to local
  }

  const localPath = path.join(process.cwd(), 'functions/backend/data/imports/creditBalances.json');
  if (!fs.existsSync(localPath)) {
    throw new Error(`creditBalances.json not found in storage or ${localPath}`);
  }
  return JSON.parse(fs.readFileSync(localPath, 'utf8'));
}

async function rebuild(clientId) {
  console.log(`\n🔄 Rebuilding creditBalances from rawNote for ${clientId}...`);
  const db = await getDb();
  const data = await loadCreditBalancesJson();

  const fiscalYearStartMonth = 6; // July (0-based)
  const rebuilt = {};
  for (const [unitId, unitData] of Object.entries(data)) {
    const rawNote = unitData.rawNote || '';
    const unitRebuilt = buildHistoryFromRawNote(unitId, rawNote, fiscalYearStartMonth);
    rebuilt[unitId] = unitRebuilt;
    console.log(
      `  ✅ ${unitId}: balance ${unitRebuilt.creditBalance / 100} MXN, history entries ${unitRebuilt.history.length}`
    );
  }

  await db.doc(`clients/${clientId}/units/creditBalances`).set(rebuilt, { merge: false });
  console.log(`\n✅ creditBalances document overwritten for ${clientId} (${Object.keys(rebuilt).length} units)`);
}

async function main() {
  const clientId = process.argv[2] || 'AVII';
  await rebuild(clientId);
}

main().catch(err => {
  console.error('❌ Rebuild failed:', err);
  process.exit(1);
});


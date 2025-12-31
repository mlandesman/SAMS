/**
 * Import Credit Balances from Parsed Data
 * 
 * Reads creditBalances.json, parses all rawNote entries with improved patterns,
 * builds proper history entries, and writes to Firestore.
 * 
 * Usage:
 *   NODE_ENV=production node functions/backend/scripts/importCreditBalancesFromParsed.js [--dry-run]
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getNow } from '../../shared/services/DateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_ID = 'AVII';
const OPENING_BALANCE_DATE = '2025-06-30T23:59:59.000Z';

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function toNumber(val) {
  if (val === null || val === undefined) return null;
  const n = Number(String(val).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pesosToCentavos(pesos) {
  if (pesos === null || pesos === undefined || isNaN(pesos)) return 0;
  return Math.round(pesos * 100);
}

function parseDate(dateText) {
  if (!dateText) return null;
  
  // Clean up the text
  dateText = dateText.trim();
  
  // Try standard Date parsing first
  const d = new Date(dateText);
  if (!isNaN(d.getTime())) return d;
  
  // "Aug 01 2025" or "Jul 23 2025"
  const shortMatch = dateText.match(/^(\w{3})\s+(\d{1,2})\s+(\d{4})/);
  if (shortMatch) {
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const month = months[shortMatch[1]];
    if (month !== undefined) {
      return new Date(parseInt(shortMatch[3]), month, parseInt(shortMatch[2]), 12, 0, 0);
    }
  }
  
  // "10/2/2025" or "10/02/2025"
  const slashMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return new Date(parseInt(slashMatch[3]), parseInt(slashMatch[1]) - 1, parseInt(slashMatch[2]), 12, 0, 0);
  }
  
  return null;
}

/**
 * Improved credit note parser that handles ALL formats
 */
function parseCreditNote(note) {
  if (!note) return { startingBalance: null, entries: [] };

  const text = note.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  
  // Split on dashed separators (3 or more dashes)
  const blocks = text.split(/\n-{3,}\n/).map(b => b.trim()).filter(Boolean);

  let startingBalance = null;
  const entries = [];

  // First block usually contains "Starting Balance"
  if (blocks.length) {
    const m = blocks[0].match(/Starting Balance:\s*\$?\s*([0-9,.\-]+)/i);
    if (m) startingBalance = toNumber(m[1]);
  }

  // Process remaining blocks
  for (let i = 1; i < blocks.length; i++) {
    const lines = blocks[i].split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const mainLine = lines[0];
    const details = lines.slice(1).join('\n') || '';

    // Pattern 1: "Credit Adjusted to MXN X on DATE from DESCRIPTION"
    const pattern1 = mainLine.match(
      /Credit Adjusted to\s+MXN\s*\$?\s*([0-9,.\-]+)\s+on\s+(.+?)\s+from\s+(.+)$/i
    );

    if (pattern1) {
      entries.push({
        adjustedBalanceMxn: toNumber(pattern1[1]),
        dateText: pattern1[2],
        fromText: pattern1[3],
        details,
        parsed: true,
        pattern: 'standard'
      });
      continue;
    }

    // Pattern 2: "Credit Adjusted to MXN X on FULL_DATE_WITH_TIMEZONE DESCRIPTION" (no "from")
    // This handles: "Credit Adjusted to MXN 4,598.06 on Mon Oct 04 2025 13:52:36 GMT-0500 (Eastern Standard Time) Used to cover water bills."
    const pattern2 = mainLine.match(
      /Credit Adjusted to\s+MXN\s*\$?\s*([0-9,.\-]+)\s+on\s+(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+GMT[+-]\d{4}(?:\s+\([^)]+\))?)\s*(.*)$/i
    );

    if (pattern2) {
      entries.push({
        adjustedBalanceMxn: toNumber(pattern2[1]),
        dateText: pattern2[2],
        fromText: (pattern2[3] || details).trim(),
        details,
        parsed: true,
        pattern: 'full-date-no-from'
      });
      continue;
    }

    // Pattern 3: "Credit Adjusted to MXN X on SHORT_DATE DESCRIPTION" (no "from", short date)
    // This handles: "Credit Adjusted to MXN 1641.06 on Aug 01 2025 Credit Used to July Water Bills"
    const pattern3 = mainLine.match(
      /Credit Adjusted to\s+MXN\s*\$?\s*([0-9,.\-]+)\s+on\s+(\w{3}\s+\d{1,2}\s+\d{4})\s+(.+)$/i
    );

    if (pattern3) {
      entries.push({
        adjustedBalanceMxn: toNumber(pattern3[1]),
        dateText: pattern3[2],
        fromText: pattern3[3].trim(),
        details,
        parsed: true,
        pattern: 'short-date-no-from'
      });
      continue;
    }

    // Pattern 4: "Added X MXN in DESCRIPTION on DATE"
    const pattern4 = mainLine.match(
      /Added\s+([0-9,.\-]+)\s*MXN\s+(?:in\s+)?(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
    );

    if (pattern4) {
      entries.push({
        addedAmount: toNumber(pattern4[1]),
        dateText: pattern4[3],
        fromText: pattern4[2].trim(),
        details,
        parsed: true,
        pattern: 'added-format'
      });
      continue;
    }

    // Couldn't parse - mark as unparsed
    entries.push({ 
      unparsed: true, 
      text: blocks[i],
      parsed: false,
      pattern: 'none'
    });
  }

  return { startingBalance, entries };
}

/**
 * Build clean credit history entries from parsed data
 */
function buildHistoryFromParsed(unitId, startingBalance, entries) {
  const history = [];
  let runningBalance = startingBalance || 0;
  let hasUnparsed = false;
  
  // Entry 1: Starting balance (dated June 30, 2025)
  history.push({
    id: generateId('starting_balance'),
    amount: pesosToCentavos(startingBalance || 0),
    timestamp: OPENING_BALANCE_DATE,
    type: 'starting_balance',
    notes: 'Starting credit balance from prior period (imported from Sheets)',
    source: 'import'
  });
  
  for (const entry of entries) {
    if (entry.unparsed) {
      hasUnparsed = true;
      console.log(`     ⚠️ UNPARSED: ${entry.text.substring(0, 60)}...`);
      continue;
    }
    
    let delta, date, notes;
    
    // For "Added" format entries
    if (entry.addedAmount !== undefined) {
      delta = entry.addedAmount;
      date = parseDate(entry.dateText);
      notes = entry.fromText;
    } 
    // For "Credit Adjusted to" format entries
    else if (entry.adjustedBalanceMxn !== undefined) {
      const newBalance = entry.adjustedBalanceMxn;
      delta = newBalance - runningBalance;
      date = parseDate(entry.dateText);
      notes = entry.fromText || entry.details;
      runningBalance = newBalance;
    } else {
      continue;
    }
    
    if (delta === 0) continue; // Skip zero-delta entries
    
    history.push({
      id: generateId('credit'),
      amount: pesosToCentavos(delta),
      timestamp: date ? date.toISOString() : getNow().toISOString(),
      type: delta > 0 ? 'credit_added' : 'credit_used',
      notes: notes || 'Credit adjustment',
      source: 'import'
    });
    
    if (entry.addedAmount !== undefined) {
      runningBalance += delta;
    }
  }
  
  // Calculate final balance from history
  const finalBalance = history.reduce((sum, e) => sum + e.amount, 0);
  
  return {
    history,
    finalBalanceCentavos: finalBalance,
    finalBalancePesos: finalBalance / 100,
    hasUnparsed
  };
}

async function importCreditBalances(dryRun = false) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  AVII Credit Balance Import (Full History)`);
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update Firestore)'}`);
  console.log(`${'='.repeat(70)}\n`);
  
  const jsonPath = path.join(__dirname, '../data/imports/creditBalances.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`creditBalances.json not found at ${jsonPath}`);
  }
  
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const db = await getDb();
  
  const creditBalancesRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances');
  
  const newData = {};
  const summary = [];
  let totalUnparsed = 0;
  
  for (const [unitId, unitData] of Object.entries(data)) {
    console.log(`\n📍 Unit ${unitId}:`);
    
    // Parse rawNote with improved patterns
    const parsed = parseCreditNote(unitData.rawNote);
    
    console.log(`   Starting Balance: $${parsed.startingBalance || 0}`);
    console.log(`   Entries found:    ${parsed.entries.length}`);
    
    // Build history
    const result = buildHistoryFromParsed(unitId, parsed.startingBalance, parsed.entries);
    
    console.log(`   History entries:  ${result.history.length}`);
    console.log(`   Final Balance:    $${result.finalBalancePesos.toFixed(2)}`);
    
    if (result.hasUnparsed) {
      totalUnparsed++;
      console.log(`   ⚠️ Has unparsed entries - review needed`);
    }
    
    newData[unitId] = {
      lastChange: {
        year: '2026',
        historyIndex: result.history.length - 1,
        timestamp: getNow().toISOString()
      },
      history: result.history
    };
    
    summary.push({
      unitId,
      startingBalance: parsed.startingBalance || 0,
      entriesInNote: parsed.entries.length,
      historyEntries: result.history.length,
      finalBalance: result.finalBalancePesos,
      hasUnparsed: result.hasUnparsed
    });
  }
  
  // Print summary table
  console.log(`\n${'─'.repeat(80)}`);
  console.log('SUMMARY:');
  console.log('─'.repeat(80));
  console.log('Unit  | Start      | Entries | History | Final      | Status');
  console.log('─'.repeat(80));
  for (const s of summary) {
    const status = s.hasUnparsed ? '⚠️ REVIEW' : '✅ OK';
    console.log(`${s.unitId.padEnd(5)} | $${s.startingBalance.toFixed(2).padStart(9)} | ${String(s.entriesInNote).padStart(7)} | ${String(s.historyEntries).padStart(7)} | $${s.finalBalance.toFixed(2).padStart(9)} | ${status}`);
  }
  console.log('─'.repeat(80));
  
  if (totalUnparsed > 0) {
    console.log(`\n⚠️ ${totalUnparsed} unit(s) have unparsed entries that need review`);
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes made');
    console.log('   Run without --dry-run to apply changes');
    
    // Save the proposed data for review
    const reviewPath = path.join(__dirname, '../data/imports/proposed_credit_history.json');
    fs.writeFileSync(reviewPath, JSON.stringify(newData, null, 2));
    console.log(`   Proposed data saved to: ${reviewPath}`);
  } else {
    // Write to Firestore
    await creditBalancesRef.set(newData);
    console.log(`\n✅ Credit balances updated for ${Object.keys(newData).length} units`);
  }
  
  return summary;
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

importCreditBalances(dryRun)
  .then(() => {
    console.log('\n✅ Import complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Import failed:', err);
    process.exit(1);
  });


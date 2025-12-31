/**
 * Parse and Export Credit Notes
 * 
 * 1. Outputs rawNotes as text file for manual review
 * 2. Attempts to parse all entries with improved regex
 * 3. Calculates what history entries should be created
 * 
 * Usage:
 *   node functions/backend/scripts/parseAndExportCreditNotes.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function toNumber(val) {
  if (val === null || val === undefined) return null;
  const n = Number(String(val).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDate(dateText) {
  if (!dateText) return null;
  
  // Try standard Date parsing first
  const d = new Date(dateText);
  if (!isNaN(d.getTime())) return d;
  
  // Try common formats
  // "Aug 01 2025"
  const shortMatch = dateText.match(/(\w{3})\s+(\d{1,2})\s+(\d{4})/);
  if (shortMatch) {
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const month = months[shortMatch[1]];
    if (month !== undefined) {
      return new Date(parseInt(shortMatch[3]), month, parseInt(shortMatch[2]));
    }
  }
  
  // "10/2/2025" or "10/02/2025"
  const slashMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return new Date(parseInt(slashMatch[3]), parseInt(slashMatch[1]) - 1, parseInt(slashMatch[2]));
  }
  
  return null;
}

/**
 * Improved credit note parser that handles more formats
 */
function parseCreditNote(note) {
  if (!note) return { startingBalance: null, entries: [] };

  const text = note.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  
  // Split on dashed separators (various dash counts)
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
      const adjustedBalanceMxn = toNumber(pattern1[1]);
      const dateText = pattern1[2];
      const fromText = pattern1[3];
      
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
        details,
        parsed: true,
        pattern: 'standard'
      });
      continue;
    }

    // Pattern 2: "Credit Adjusted to MXN X on DATE DESCRIPTION" (no "from")
    const pattern2 = mainLine.match(
      /Credit Adjusted to\s+MXN\s*\$?\s*([0-9,.\-]+)\s+on\s+([A-Za-z]{3}\s+\d{1,2}\s+\d{4}(?:\s+\d{1,2}:\d{2}:\d{2}\s+GMT[+-]\d{4}(?:\s+\([^)]+\))?)?)\s*(.*)$/i
    );

    if (pattern2) {
      const adjustedBalanceMxn = toNumber(pattern2[1]);
      const dateText = pattern2[2];
      const fromText = pattern2[3] || details;
      
      entries.push({
        adjustedBalanceMxn,
        dateText,
        fromText: fromText.trim(),
        sourceCurrency: null,
        sourceAmount: null,
        details,
        parsed: true,
        pattern: 'no-from'
      });
      continue;
    }

    // Pattern 3: "Added X MXN in DESCRIPTION on DATE"
    const pattern3 = mainLine.match(
      /Added\s+([0-9,.\-]+)\s*MXN\s+(?:in\s+)?(.+?)\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
    );

    if (pattern3) {
      const addedAmount = toNumber(pattern3[1]);
      const description = pattern3[2];
      const dateText = pattern3[3];
      
      entries.push({
        addedAmount,
        dateText,
        fromText: description,
        sourceCurrency: 'MXN',
        sourceAmount: addedAmount,
        details,
        parsed: true,
        pattern: 'added-format'
      });
      continue;
    }

    // Pattern 4: Simpler "Credit Adjusted to MXN X on DATE..." without full GMT timestamp
    const pattern4 = mainLine.match(
      /Credit Adjusted to\s+MXN\s*\$?\s*([0-9,.\-]+)\s+on\s+(\w{3}\s+\d{1,2}\s+\d{4})\s*(.*)$/i
    );

    if (pattern4) {
      const adjustedBalanceMxn = toNumber(pattern4[1]);
      const dateText = pattern4[2];
      const fromText = pattern4[3] || details;
      
      entries.push({
        adjustedBalanceMxn,
        dateText,
        fromText: fromText.trim(),
        sourceCurrency: null,
        sourceAmount: null,
        details,
        parsed: true,
        pattern: 'simple-date'
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
 * Build credit history entries from parsed data
 */
function buildHistoryFromParsed(unitId, startingBalance, entries) {
  const history = [];
  let runningBalance = startingBalance || 0;
  
  // Starting balance entry
  history.push({
    type: 'starting_balance',
    amount: Math.round((startingBalance || 0) * 100), // centavos
    timestamp: '2025-06-30T23:59:59.000Z',
    notes: 'Starting credit balance from prior period',
    source: 'import',
    balanceAfterPesos: startingBalance || 0
  });
  
  for (const entry of entries) {
    if (entry.unparsed) {
      history.push({
        type: 'UNPARSED',
        rawText: entry.text,
        notes: 'NEEDS MANUAL PARSING',
        source: 'manual'
      });
      continue;
    }
    
    // For "Added" format entries
    if (entry.addedAmount !== undefined) {
      const previousBalance = runningBalance;
      runningBalance += entry.addedAmount;
      
      const date = parseDate(entry.dateText);
      history.push({
        type: 'credit_added',
        amount: Math.round(entry.addedAmount * 100), // centavos
        timestamp: date ? date.toISOString() : entry.dateText,
        notes: entry.fromText,
        source: 'import',
        previousBalancePesos: previousBalance,
        balanceAfterPesos: runningBalance
      });
      continue;
    }
    
    // For "Credit Adjusted to" format entries
    if (entry.adjustedBalanceMxn !== undefined) {
      const previousBalance = runningBalance;
      const newBalance = entry.adjustedBalanceMxn;
      const delta = newBalance - previousBalance;
      
      const date = parseDate(entry.dateText);
      history.push({
        type: delta >= 0 ? 'credit_added' : 'credit_used',
        amount: Math.round(delta * 100), // centavos (can be negative)
        timestamp: date ? date.toISOString() : entry.dateText,
        notes: entry.fromText || entry.details,
        source: 'import',
        previousBalancePesos: previousBalance,
        balanceAfterPesos: newBalance
      });
      
      runningBalance = newBalance;
    }
  }
  
  return {
    history,
    finalBalance: runningBalance
  };
}

async function main() {
  const jsonPath = path.join(__dirname, '../data/imports/creditBalances.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`creditBalances.json not found at ${jsonPath}`);
  }
  
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  // Output 1: Raw notes text file
  console.log('\n' + '='.repeat(70));
  console.log('  RAW NOTES FOR MANUAL REVIEW');
  console.log('='.repeat(70));
  
  let rawNotesOutput = '';
  
  for (const [unitId, unitData] of Object.entries(data)) {
    rawNotesOutput += `\n${'='.repeat(60)}\n`;
    rawNotesOutput += `UNIT ${unitId}\n`;
    rawNotesOutput += `${'='.repeat(60)}\n`;
    rawNotesOutput += `Starting Balance: $${unitData.startingBalance || 0}\n`;
    rawNotesOutput += `\nRaw Note:\n`;
    rawNotesOutput += `${'-'.repeat(40)}\n`;
    rawNotesOutput += `${unitData.rawNote || '(no note)'}\n`;
    rawNotesOutput += `${'-'.repeat(40)}\n`;
    
    console.log(`\n📍 UNIT ${unitId}:`);
    console.log(`   Starting Balance: $${unitData.startingBalance || 0}`);
  }
  
  const rawNotesPath = path.join(__dirname, '../data/imports/rawNotes_for_review.txt');
  fs.writeFileSync(rawNotesPath, rawNotesOutput);
  console.log(`\n✅ Raw notes saved to: ${rawNotesPath}`);
  
  // Output 2: Re-parsed data
  console.log('\n' + '='.repeat(70));
  console.log('  RE-PARSING WITH IMPROVED PATTERNS');
  console.log('='.repeat(70));
  
  const reparsedData = {};
  let totalEntries = 0;
  let parsedEntries = 0;
  let unparsedEntries = 0;
  
  for (const [unitId, unitData] of Object.entries(data)) {
    const parsed = parseCreditNote(unitData.rawNote);
    const historyResult = buildHistoryFromParsed(unitId, parsed.startingBalance, parsed.entries);
    
    reparsedData[unitId] = {
      unitId,
      startingBalance: parsed.startingBalance,
      expectedFinalBalance: historyResult.finalBalance,
      entries: parsed.entries,
      history: historyResult.history
    };
    
    console.log(`\n📍 UNIT ${unitId}:`);
    console.log(`   Starting Balance: $${parsed.startingBalance || 0}`);
    console.log(`   Final Balance:    $${historyResult.finalBalance}`);
    console.log(`   Entries:`);
    
    for (const entry of parsed.entries) {
      totalEntries++;
      if (entry.parsed) {
        parsedEntries++;
        console.log(`     ✅ ${entry.pattern}: ${entry.adjustedBalanceMxn !== undefined ? 'Adj to $' + entry.adjustedBalanceMxn : 'Added $' + entry.addedAmount}`);
      } else {
        unparsedEntries++;
        console.log(`     ❌ UNPARSED: ${entry.text.substring(0, 60)}...`);
      }
    }
  }
  
  // Save reparsed data
  const reparsedPath = path.join(__dirname, '../data/imports/creditBalances_reparsed.json');
  fs.writeFileSync(reparsedPath, JSON.stringify(reparsedData, null, 2));
  console.log(`\n✅ Reparsed data saved to: ${reparsedPath}`);
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  console.log(`   Total entries:    ${totalEntries}`);
  console.log(`   Parsed:           ${parsedEntries} (${Math.round(parsedEntries/totalEntries*100)}%)`);
  console.log(`   Still unparsed:   ${unparsedEntries} (${Math.round(unparsedEntries/totalEntries*100)}%)`);
  console.log('='.repeat(70));
  
  if (unparsedEntries > 0) {
    console.log('\n⚠️  Some entries could not be parsed automatically.');
    console.log('   Review rawNotes_for_review.txt and creditBalances_reparsed.json');
    console.log('   for manual corrections.');
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});


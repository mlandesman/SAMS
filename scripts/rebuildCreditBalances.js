#!/usr/bin/env node
/**
 * Rebuild Credit Balances from Source of Truth
 * 
 * This script converts the imported credit history (with "adjusted to" balances)
 * into clean credit history entries (with delta amounts).
 * 
 * Usage: 
 *   node scripts/rebuildCreditBalances.js --dry-run
 *   node scripts/rebuildCreditBalances.js --live
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';

// Source data - the imported credit history with "adjusted to" values
const sourceData = {
  "101": {
    "startingBalance": 0,
    "entries": [
      { "adjustedBalanceMxn": 239.73, "dateText": "Mon Jun 30 2025", "fromText": "refund of June Sewage bill (Added USD 239.73)" },
      { "adjustedBalanceMxn": 0, "dateText": "Mon Sep 29 2025", "fromText": "Deposit of MXN 14,277.81 with an Underpayment of MXN 239.73" },
      { "adjustedBalanceMxn": 600, "dateText": "Sat Dec 13 2025", "fromText": "conversion of monthly water bills to quarterly." }
    ]
  },
  "102": {
    "startingBalance": 0,
    "entries": [
      { "adjustedBalanceMxn": 2099.94, "dateText": "Sun Nov 02 2025", "fromText": "Deposit of MXN 36,678.99 with an Overpayment for removal of duplicate penalties." },
      { "adjustedBalanceMxn": 1399.94, "dateText": "Sun Nov 02 2025", "fromText": "use of credit to pay water bill" }
    ]
  },
  "103": {
    "startingBalance": 6675,
    "entries": [
      { "adjustedBalanceMxn": 6180.50, "dateText": "Mon Aug 04 2025", "fromText": "Deposit of MXN 15,000.00" },
      { "adjustedBalanceMxn": 4598.06, "dateText": "Mon Oct 04 2025", "fromText": "Used to cover water bills." },
      { "adjustedBalanceMxn": 4871.12, "dateText": "Mon Oct 06 2025", "fromText": "Deposit of MXN 15,000.00 with an Overpayment of MXN 273.06" },
      { "adjustedBalanceMxn": 5371.12, "dateText": "Sat Dec 13 2025", "fromText": "conversion of monthly water bills to quarterly." }
    ]
  },
  "104": {
    "startingBalance": 0,
    "entries": [
      { "adjustedBalanceMxn": 16.87, "dateText": "Sat Jul 12 2025", "fromText": "Deposit of MXN 15,025.00 with an Overpayment of MXN 16.87" },
      { "adjustedBalanceMxn": 1401.33, "dateText": "Jul 23 2025", "fromText": "Deposit of MXN 1767.59 for June Water Bills" },
      { "adjustedBalanceMxn": 2041.06, "dateText": "Jul 25 2025", "fromText": "Deposit of MXN 639.73 for June Water Bills" },
      { "adjustedBalanceMxn": 1641.06, "dateText": "Aug 01 2025", "fromText": "Credit Used to July Water Bills" },
      { "adjustedBalanceMxn": 1191.06, "dateText": "Sep 05 2025", "fromText": "Credit Used to Aug Water Bills" },
      { "adjustedBalanceMxn": 691.06, "dateText": "Oct 01 2025", "fromText": "Credit Used to Sep Water Bills" },
      { "adjustedBalanceMxn": 2145.56, "dateText": "Oct 07 2025", "fromText": "Deposit of MXN 1,454.50 Jul, Aug, Sep Water Bills" },
      { "adjustedBalanceMxn": 137.43, "dateText": "Fri Oct 10 2025", "fromText": "Deposit of MXN 13,000.00 with an Underpayment of MXN 2,008.13" },
      { "adjustedBalanceMxn": 637.43, "dateText": "Sat Dec 13 2025", "fromText": "conversion of monthly water bills to quarterly." }
    ]
  },
  "105": {
    "startingBalance": 39.73,
    "entries": [
      { "adjustedBalanceMxn": 1279.36, "dateText": "Mon Oct 06 2025", "fromText": "Deposit of MXN 34,525.00 with an Overpayment of MXN 1,279.36" },
      { "adjustedBalanceMxn": 1379.36, "dateText": "Sat Dec 13 2025", "fromText": "conversion of monthly water bills to quarterly." }
    ]
  },
  "106": {
    "startingBalance": 0,
    "entries": [
      { "adjustedBalanceMxn": 11979.69, "dateText": "Thu Oct 16 2025", "fromText": "Deposit of MXN 24,000.00 with an Overpayment of MXN 11,979.69" },
      { "adjustedBalanceMxn": 9496.17, "dateText": "Thu Oct 16 2025", "fromText": "credit used to pay water bills and penalties of MXN 11,979.69" },
      { "adjustedBalanceMxn": 9475.86, "dateText": "Thu Nov 27 2025", "fromText": "Deposit of MXN 12,000.00 with an Underpayment of MXN 20.31" },
      { "adjustedBalanceMxn": 10125.86, "dateText": "Sat Dec 13 2025", "fromText": "conversion of monthly water bills to quarterly." }
    ]
  },
  "201": {
    "startingBalance": 239.73,
    "entries": [
      { "adjustedBalanceMxn": 0, "dateText": "Sat Sep 20 2025", "fromText": "Deposit of MXN 16,932.41 with an Underpayment of MXN 239.73" },
      { "adjustedBalanceMxn": 50, "dateText": "Sat Dec 13 2025", "fromText": "conversion of monthly water bills to quarterly." }
    ]
  },
  "202": {
    "startingBalance": 0,
    "entries": []
  },
  "203": {
    "startingBalance": 0,
    "entries": [
      { "adjustedBalanceMxn": 35.75, "dateText": "Oct 02 2025", "fromText": "overpayment from water bills" },
      { "adjustedBalanceMxn": 1160.75, "dateText": "Oct 29 2025", "fromText": "for well drilling" },
      { "adjustedBalanceMxn": 246.70, "dateText": "Wed Oct 29 2025", "fromText": "Deposit of MXN 17,670.05 with an Underpayment of MXN 914.05" },
      { "adjustedBalanceMxn": 1796.70, "dateText": "Sat Dec 13 2025", "fromText": "conversion of monthly water bills to quarterly." }
    ]
  },
  "204": {
    "startingBalance": 508.24,
    "entries": [
      { "adjustedBalanceMxn": 548, "dateText": "Tue Aug 26 2025", "fromText": "overpayment on sewage" },
      { "adjustedBalanceMxn": 0, "dateText": "Tue Aug 26 2025", "fromText": "Deposit of MXN 18,879.69" },
      { "adjustedBalanceMxn": 6475.88, "dateText": "Tue Aug 26 2025", "fromText": "Deposit of MXN 6,475.89 with an Overpayment of MXN 0.00" },
      { "adjustedBalanceMxn": 0.01, "dateText": "Wed Oct 08 2025", "fromText": "Deposit of MXN 19,427.68 with an Overpayment of MXN 0.01" }
    ]
  }
};

/**
 * Parse a date string to ISO format
 */
function parseDate(dateText) {
  // Try to parse the date
  const date = new Date(dateText);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  // Default to a reasonable date if parsing fails
  return new Date('2025-07-01').toISOString();
}

/**
 * Determine the source type based on the note text
 */
function determineSource(noteText) {
  const lower = noteText.toLowerCase();
  
  // These are from payment transactions (deposits)
  if (lower.includes('deposit of mxn')) {
    return 'transaction';
  }
  
  // These are credit being used (also from transactions)
  if (lower.includes('credit used') || lower.includes('use of credit') || lower.includes('underpayment')) {
    return 'transaction';
  }
  
  // These are manual admin adjustments
  if (lower.includes('refund') || lower.includes('overpayment on sewage') || 
      lower.includes('conversion of monthly') || lower.includes('well drilling') ||
      lower.includes('removal of duplicate')) {
    return 'admin';
  }
  
  // Default to import for legacy data
  return 'import';
}

/**
 * Convert source data to clean credit history format
 */
function convertToCreditHistory(unitId, data) {
  const history = [];
  let previousBalance = data.startingBalance;
  
  // If there's a starting balance, create an opening entry
  if (data.startingBalance > 0) {
    history.push({
      id: `import_starting_${unitId}`,
      timestamp: '2025-07-01T00:00:00.000Z', // Fiscal year start
      amount: Math.round(data.startingBalance * 100), // Convert to centavos
      note: 'Starting balance from prior period',
      source: 'import',
      transactionId: null
    });
  }
  
  // Process each entry
  for (let i = 0; i < data.entries.length; i++) {
    const entry = data.entries[i];
    
    // Calculate the change amount
    const changeAmountPesos = entry.adjustedBalanceMxn - previousBalance;
    const changeAmountCentavos = Math.round(changeAmountPesos * 100);
    
    // Skip zero-change entries
    if (changeAmountCentavos === 0) {
      previousBalance = entry.adjustedBalanceMxn;
      continue;
    }
    
    history.push({
      id: `import_${unitId}_${i}`,
      timestamp: parseDate(entry.dateText),
      amount: changeAmountCentavos,
      note: entry.fromText,
      source: determineSource(entry.fromText),
      transactionId: null
    });
    
    previousBalance = entry.adjustedBalanceMxn;
  }
  
  return {
    history,
    lastChange: {
      timestamp: new Date().toISOString(),
      year: '2026'
    }
  };
}

/**
 * Main function
 */
async function main() {
  const isLive = process.argv.includes('--live');
  const isDryRun = !isLive;
  
  console.log(`\n🔄 Rebuilding Credit Balances from Source of Truth`);
  console.log(`   Mode: ${isDryRun ? 'DRY RUN' : '🔴 LIVE'}\n`);
  
  const result = {};
  
  for (const [unitId, data] of Object.entries(sourceData)) {
    const converted = convertToCreditHistory(unitId, data);
    result[unitId] = converted;
    
    // Calculate final balance for verification
    const finalBalance = converted.history.reduce((sum, e) => sum + e.amount, 0) / 100;
    const expectedBalance = data.entries.length > 0 
      ? data.entries[data.entries.length - 1].adjustedBalanceMxn 
      : data.startingBalance;
    
    const match = Math.abs(finalBalance - expectedBalance) < 0.01 ? '✓' : '❌';
    
    console.log(`Unit ${unitId}: ${converted.history.length} entries, Balance: $${finalBalance.toFixed(2)} (expected: $${expectedBalance.toFixed(2)}) ${match}`);
    
    if (isDryRun) {
      // Show the entries
      for (const entry of converted.history) {
        const sign = entry.amount >= 0 ? '+' : '';
        console.log(`   ${entry.timestamp.substring(0,10)} ${sign}$${(entry.amount/100).toFixed(2)} [${entry.source}] ${entry.note.substring(0,50)}...`);
      }
    }
  }
  
  // Save to file for review
  const outputPath = '/Users/michael/Projects/SAMS/test-results/creditBalances-rebuilt.json';
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n📄 Output saved to: ${outputPath}`);
  
  if (isLive) {
    console.log(`\n🔴 LIVE MODE: Uploading to Firebase...`);
    
    initializeApp({ 
      credential: applicationDefault(), 
      projectId: 'sandyland-management-system' 
    });
    const db = getFirestore();
    
    const creditBalancesRef = db.collection('clients').doc('AVII')
      .collection('units').doc('creditBalances');
    
    await creditBalancesRef.set(result);
    console.log(`✅ Successfully uploaded to Firebase`);
  } else {
    console.log(`\n💡 Run with --live to upload to Firebase`);
  }
}

main().catch(console.error);

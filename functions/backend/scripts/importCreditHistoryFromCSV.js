/**
 * Import Credit Balance History from CSV
 * 
 * Reads the manually curated CSV and builds proper credit history documents
 * 
 * Usage: node importCreditHistoryFromCSV.js [environment] [--dry-run]
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.argv[2] || 'dev';
const dryRun = process.argv.includes('--dry-run');

// Initialize Firebase
if (getApps().length === 0) {
  const serviceAccountPath = environment === 'prod'
    ? path.resolve(__dirname, '../serviceAccountKey-prod.json')
    : path.resolve(__dirname, '../serviceAccountKey.json');
  
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

// CSV file path
const csvPath = '/Users/michael/Projects/SAMS/test-results/AVII Credit Balance History.csv';

// Cross-reference file path
const crossRefPath = '/Users/michael/Projects/SAMS/functions/backend/data/imports/HOA_Transaction_CrossRef_AVII.json';

function parseCSVLine(line) {
  // Handle quoted fields with commas
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(dateStr) {
  // Parse MM/DD/YYYY format
  const [month, day, year] = dateStr.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function determineEntryType(amount, description, isOpeningBalance = false) {
  const desc = description.toLowerCase();
  
  // Opening balance is always starting_balance regardless of amount
  if (isOpeningBalance || desc.includes('opening balance')) {
    return 'starting_balance';
  }
  if (amount < 0) {
    return 'credit_used';
  }
  if (amount > 0) {
    return 'credit_added';
  }
  return 'adjustment';
}

async function importFromCSV() {
  console.log(`\n📥 Importing Credit History from CSV`);
  console.log(`   Environment: ${environment.toUpperCase()}`);
  console.log(`   Dry Run: ${dryRun ? 'YES' : 'NO'}\n`);
  
  // Load cross-reference for transaction linking
  let crossRef = { bySequence: {} };
  try {
    crossRef = JSON.parse(await readFile(crossRefPath, 'utf8'));
    console.log(`🔗 Loaded cross-reference with ${crossRef.totalRecords} entries\n`);
  } catch (err) {
    console.log(`⚠️  No cross-reference found, proceeding without transaction links\n`);
  }
  
  // Read and parse CSV
  const csvContent = await readFile(csvPath, 'utf8');
  const lines = csvContent.trim().split('\n');
  
  // Skip header
  const dataLines = lines.slice(1);
  
  // Group by unit
  const unitHistories = {};
  const allUnitData = {};  // For single document write
  
  for (const line of dataLines) {
    const [unit, runningBalance, date, amount, description, seqNo] = parseCSVLine(line);
    
    if (!unitHistories[unit]) {
      unitHistories[unit] = [];
    }
    
    // For Opening Balance entries, use the runningBalance column (which IS the opening balance)
    // because Amount is 0 but we need to record the actual starting balance
    const isOpeningBalance = description.toLowerCase().includes('opening balance');
    let amountCentavos;
    
    if (isOpeningBalance) {
      // The Credit Balance column contains the actual opening balance value
      amountCentavos = parseInt(runningBalance, 10);
    } else {
      amountCentavos = parseInt(amount, 10);
    }
    
    const entryType = determineEntryType(amountCentavos, description, isOpeningBalance);
    
    // Create history entry
    const entry = {
      id: `credit_${unit}_${Date.now()}_${unitHistories[unit].length}`,
      amount: amountCentavos,  // Already in centavos from CSV
      timestamp: new Date(parseDate(date) + 'T12:00:00-05:00').toISOString(),
      type: entryType,
      notes: description,
      source: 'csv_import_2025-12-31'
    };
    
    // Look up transaction ID from cross-reference
    if (seqNo && crossRef.bySequence[seqNo]) {
      entry.transactionId = crossRef.bySequence[seqNo].transactionId;
      entry.sequenceRef = seqNo;
      console.log(`   🔗 Linked Seq ${seqNo} → ${entry.transactionId}`);
    } else if (seqNo) {
      entry.sequenceRef = seqNo;
      console.log(`   ⚠️  Seq ${seqNo} not in cross-ref`);
    }
    
    unitHistories[unit].push(entry);
    
    console.log(`   ${unit}: ${entryType.padEnd(15)} ${String(amountCentavos).padStart(10)} - ${description.substring(0, 50)}`);
  }
  
  console.log(`\n📊 Summary by Unit:`);
  
  const results = { updated: 0, errors: [] };
  
  for (const [unit, history] of Object.entries(unitHistories)) {
    // Calculate final balance from history
    const finalBalance = history.reduce((sum, entry) => sum + entry.amount, 0);
    
    console.log(`\n   Unit ${unit}: ${history.length} entries, Final Balance: ${finalBalance} centavos ($${(finalBalance / 100).toFixed(2)})`);
    
    // Create document structure
    const creditDoc = {
      history,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'csv_import_script',
      importSource: 'AVII Credit Balance History.csv',
      importedAt: new Date().toISOString()
    };
    
    // Store for batch write to single document
    allUnitData[unit] = {
      creditBalance: finalBalance,  // For backwards compatibility
      history,
      lastChange: {
        year: '2026',
        timestamp: new Date().toISOString(),
        historyIndex: history.length - 1
      }
    };
  }
  
  // Write all units to the SINGLE creditBalances document
  if (!dryRun) {
    try {
      const creditBalancesRef = db.collection('clients').doc('AVII').collection('units').doc('creditBalances');
      await creditBalancesRef.set(allUnitData, { merge: false });  // Replace entirely
      console.log(`\n✅ Updated ALL units in single creditBalances document`);
      results.updated = Object.keys(allUnitData).length;
    } catch (err) {
      console.log(`\n❌ Failed to update creditBalances: ${err.message}`);
      results.errors.push({ unit: 'ALL', error: err.message });
    }
  } else {
    console.log(`\n🔍 [DRY RUN] Would update creditBalances document with ${Object.keys(allUnitData).length} units`);
    results.updated = Object.keys(allUnitData).length;
  }
  
  console.log(`\n✅ Import complete: ${results.updated} units processed`);
  if (results.errors.length > 0) {
    console.log(`❌ Errors: ${results.errors.length}`);
    results.errors.forEach(e => console.log(`   - ${e.unit}: ${e.error}`));
  }
  
  // Save the processed data for review
  const outputPath = path.resolve(__dirname, '../data/imports/creditHistory_from_csv.json');
  await writeFile(outputPath, JSON.stringify(unitHistories, null, 2));
  console.log(`\n💾 Processed data saved to: ${outputPath}`);
}

importFromCSV()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


/**
 * Load Sheets transaction data from JSON files
 * 
 * Reads the JSON files generated from Google Sheets
 * Structure: { unit, unitLabel, generatedAt, headers, rows[] }
 * 
 * Usage:
 *   node backend/scripts/load-sheets-data.js [unit-id]
 * 
 * Example:
 *   node backend/scripts/load-sheets-data.js 101
 *   node backend/scripts/load-sheets-data.js  # loads all units
 */

import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SHEETS_DATA_DIR = '/Users/michael/Projects/SAMS-Docs/docs/AVII-Reconciliation/Sheets-Data';

/**
 * Load a single unit's Sheets data
 */
async function loadUnitSheetsData(unitId) {
  // Find the JSON file for this unit (handles date suffix)
  const files = await readdir(SHEETS_DATA_DIR);
  const unitFile = files.find(f => f.startsWith(`unit-${unitId}-`));
  
  if (!unitFile) {
    throw new Error(`No Sheets data file found for unit ${unitId}`);
  }
  
  const filePath = path.join(SHEETS_DATA_DIR, unitFile);
  const data = JSON.parse(await readFile(filePath, 'utf8'));
  
  // Transform rows to transaction format
  const transactions = (data.rows || []).map(row => ({
    date: row.date,
    category: row.category,
    description: row.notes || row.category, // Use notes as description, fallback to category
    amount: typeof row.amount === 'number' ? row.amount : parseFloat(row.amount) || 0,
    balance: typeof row.balance === 'number' ? row.balance : parseFloat(row.balance) || null
  }));
  
  return {
    unitId: data.unit,
    unitLabel: data.unitLabel || data.unit,
    generatedAt: data.generatedAt,
    filePath,
    totalTransactions: transactions.length,
    transactions,
    finalBalance: transactions.length > 0 ? transactions[transactions.length - 1].balance : null
  };
}

/**
 * Load all units' Sheets data
 */
async function loadAllSheetsData() {
  const files = await readdir(SHEETS_DATA_DIR);
  const unitFiles = files.filter(f => f.startsWith('unit-') && f.endsWith('.json'));
  
  const results = {};
  
  for (const file of unitFiles) {
    // Extract unit ID from filename (unit-101-20251210.json -> 101)
    const match = file.match(/unit-(\d{3})-/);
    if (match) {
      const unitId = match[1];
      try {
        results[unitId] = await loadUnitSheetsData(unitId);
      } catch (error) {
        console.error(`Error loading unit ${unitId}:`, error.message);
      }
    }
  }
  
  return results;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const unitId = args[0] || null;
  
  if (!existsSync(SHEETS_DATA_DIR)) {
    console.error(`❌ Sheets data directory not found: ${SHEETS_DATA_DIR}`);
    process.exit(1);
  }
  
  try {
    if (unitId) {
      // Load single unit
      const result = await loadUnitSheetsData(unitId);
      
      console.log('\n✅ Sheets Data Loaded');
      console.log('='.repeat(70));
      console.log(`Unit ID: ${result.unitId}`);
      console.log(`Unit Label: ${result.unitLabel}`);
      console.log(`Generated At: ${result.generatedAt}`);
      console.log(`Total Transactions: ${result.totalTransactions}`);
      console.log(`Final Balance: ${result.finalBalance !== null ? `$${result.finalBalance.toFixed(2)}` : 'N/A'}`);
      
      if (result.transactions.length > 0) {
        console.log('\n📋 Sample Transactions (first 5):');
        console.log('-'.repeat(70));
        result.transactions.slice(0, 5).forEach((txn, idx) => {
          console.log(`${idx + 1}. ${txn.date} | ${txn.category} | ${txn.description.substring(0, 35).padEnd(35)} | $${txn.amount.toFixed(2)} | ${txn.balance !== null ? `$${txn.balance.toFixed(2)}` : 'N/A'}`);
        });
      }
      
      return result;
    } else {
      // Load all units
      const results = await loadAllSheetsData();
      
      console.log('\n✅ All Sheets Data Loaded');
      console.log('='.repeat(70));
      console.log(`Units loaded: ${Object.keys(results).length}`);
      
      // Summary table
      console.log('\n📊 Unit Summary:');
      console.log('-'.repeat(70));
      console.log('Unit | Label | Transactions | Final Balance');
      console.log('-'.repeat(70));
      
      for (const unitId of Object.keys(results).sort()) {
        const result = results[unitId];
        const balance = result.finalBalance !== null ? `$${result.finalBalance.toFixed(2)}` : 'N/A';
        console.log(`${unitId.padStart(4)} | ${result.unitLabel.substring(0, 20).padEnd(20)} | ${result.totalTransactions.toString().padStart(13)} | ${balance.padStart(13)}`);
      }
      
      return results;
    }
  } catch (error) {
    console.error('\n❌ Error loading Sheets data:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('load-sheets-data.js')) {
  main();
}

export { loadUnitSheetsData, loadAllSheetsData };

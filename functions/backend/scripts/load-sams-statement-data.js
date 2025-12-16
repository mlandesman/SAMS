/**
 * Load SAMS Statement Data for Reconciliation
 * 
 * Uses the existing statement generation code to get SAMS transaction data
 * in the same format as Sheets data for comparison
 * 
 * Usage:
 *   node backend/scripts/load-sams-statement-data.js [unit-id] [fiscal-year]
 * 
 * Example:
 *   node backend/scripts/load-sams-statement-data.js 101 2026
 *   node backend/scripts/load-sams-statement-data.js  # loads all units
 */

import { testHarness } from '../testing/testHarness.js';
import { getStatementData } from "../services/statementDataService.js";
import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const CLIENT_ID = 'AVII';
const FISCAL_YEAR = 2026; // Default fiscal year
const OUTPUT_DIR = '/Users/michael/Projects/SAMS-Docs/docs/AVII-Reconciliation/SAMS-Data';

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Transform SAMS statement transaction to match Sheets format
 */
function transformTransaction(txn) {
  // Categorize based on description and type
  let category = txn.category;
  if (!category) {
    const desc = (txn.description || '').toLowerCase();
    const type = (txn.type || '').toLowerCase();
    
    if (desc.includes('hoa') || desc.includes('mantenimiento')) {
      category = 'HOA Dues';
    } else if (desc.includes('water') || desc.includes('agua') || desc.includes('consumption')) {
      category = 'Water Bills';
    } else if (desc.includes('penalty') || desc.includes('cargo') || desc.includes('late')) {
      category = 'Penalties';
    } else if (type === 'payment' || desc.includes('payment')) {
      category = 'Payments';
    } else {
      category = 'Other';
    }
  }
  
  return {
    date: txn.date instanceof Date ? txn.date.toISOString().split('T')[0] : txn.date,
    category: category,
    description: txn.description || '',
    amount: txn.charge > 0 ? txn.charge : -txn.payment,
    balance: txn.balance || null
  };
}

/**
 * Load SAMS statement data for a single unit
 */
async function loadUnitSAMSData(api, unitId, fiscalYear = FISCAL_YEAR) {
  console.log(`\n📊 Loading SAMS data for unit ${unitId} (FY ${fiscalYear})...`);
  
  try {
    // Generate statement using existing code
    const statement = await getStatementData(api, CLIENT_ID, unitId, fiscalYear, true);
    
    // Transform transactions to match Sheets format
    const transactions = (statement.lineItems || []).map(transformTransaction);
    
    return {
      unitId,
      fiscalYear,
      generatedAt: new Date().toISOString(),
      totalTransactions: transactions.length,
      transactions,
      finalBalance: statement.summary.closingBalance || null,
      creditBalance: statement.creditBalance || 0 || 0,
      statementData: statement // Keep full statement for reference
    };
  } catch (error) {
    console.error(`❌ Error loading SAMS data for unit ${unitId}:`, error.message);
    throw error;
  }
}

/**
 * Load all units' SAMS data
 */
async function loadAllSAMSData(api, fiscalYear = FISCAL_YEAR) {
  const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
  const results = {};
  
  for (const unitId of units) {
    try {
      results[unitId] = await loadUnitSAMSData(api, unitId, fiscalYear);
      
      // Save individual unit file
      const outputPath = path.join(OUTPUT_DIR, `unit-${unitId}-${new Date().toISOString().split('T')[0]}.json`);
      await writeFile(outputPath, JSON.stringify(results[unitId], null, 2), 'utf8');
      console.log(`  💾 Saved to: ${path.basename(outputPath)}`);
      
      // Small delay between units
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ⚠️  Skipping unit ${unitId} due to error`);
      results[unitId] = { error: error.message };
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
  const fiscalYear = args[1] ? parseInt(args[1]) : FISCAL_YEAR;
  
  if (isNaN(fiscalYear)) {
    console.error('❌ Fiscal year must be a number');
    process.exit(1);
  }
  
  await testHarness.runTest({
    name: 'Load SAMS Statement Data',
    async test({ api }) {
      try {
        if (unitId) {
          // Load single unit
          const result = await loadUnitSAMSData(api, unitId, fiscalYear);
          
          console.log('\n✅ SAMS Data Loaded');
          console.log('='.repeat(70));
          console.log(`Unit ID: ${result.unitId}`);
          console.log(`Fiscal Year: ${result.fiscalYear}`);
          console.log(`Total Transactions: ${result.totalTransactions}`);
          console.log(`Final Balance: ${result.finalBalance !== null ? `$${result.finalBalance.toFixed(2)}` : 'N/A'}`);
          console.log(`Credit Balance: $${result.creditBalance.toFixed(2)}`);
          
          if (result.transactions.length > 0) {
            console.log('\n📋 Sample Transactions (first 5):');
            console.log('-'.repeat(70));
            result.transactions.slice(0, 5).forEach((txn, idx) => {
              console.log(`${idx + 1}. ${txn.date} | ${txn.category} | ${txn.description.substring(0, 35).padEnd(35)} | $${txn.amount.toFixed(2)} | ${txn.balance !== null ? `$${txn.balance.toFixed(2)}` : 'N/A'}`);
            });
          }
          
          // Save to file
          const outputPath = path.join(OUTPUT_DIR, `unit-${unitId}-${new Date().toISOString().split('T')[0]}.json`);
          await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
          console.log(`\n💾 Results saved to: ${outputPath}`);
          
          return { passed: true, message: `Loaded data for unit ${unitId}` };
        } else {
          // Load all units
          const results = await loadAllSAMSData(api, fiscalYear);
          
          console.log('\n✅ All SAMS Data Loaded');
          console.log('='.repeat(70));
          console.log(`Units loaded: ${Object.keys(results).filter(k => !results[k].error).length}`);
          
          // Summary table
          console.log('\n📊 Unit Summary:');
          console.log('-'.repeat(70));
          console.log('Unit | Transactions | Final Balance | Credit Balance');
          console.log('-'.repeat(70));
          
          for (const unitId of Object.keys(results).sort()) {
            const result = results[unitId];
            if (result.error) {
              console.log(`${unitId.padStart(4)} | ERROR: ${result.error}`);
            } else {
              const balance = result.finalBalance !== null ? `$${result.finalBalance.toFixed(2)}` : 'N/A';
              const credit = `$${result.creditBalance.toFixed(2)}`;
              console.log(`${unitId.padStart(4)} | ${result.totalTransactions.toString().padStart(13)} | ${balance.padStart(13)} | ${credit.padStart(14)}`);
            }
          }
          
          return { 
            passed: true, 
            message: `Loaded data for ${Object.keys(results).filter(k => !results[k].error).length} units` 
          };
        }
      } catch (error) {
        console.error('\n❌ Error:', error.message);
        return { passed: false, message: error.message };
      }
    }
  });
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('load-sams-statement-data.js')) {
  main();
}

export { loadUnitSAMSData, loadAllSAMSData };

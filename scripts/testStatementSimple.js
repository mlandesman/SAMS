#!/usr/bin/env node
/**
 * Simple Statement Test - Issue #142
 * 
 * Minimal script to test statement data without verbose logging.
 * 
 * Usage:
 *   node scripts/testStatementSimple.js AVII 103
 *   node scripts/testStatementSimple.js MTC 1B
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase
const serviceAccountPath = join(__dirname, '../functions/backend/sams-production-serviceAccountKey.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (e) {
  // Try dev key
  const devPath = join(__dirname, '../functions/backend/serviceAccountKey.json');
  serviceAccount = JSON.parse(readFileSync(devPath, 'utf8'));
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Import the statement data service
const { getStatementData } = await import('../functions/backend/services/statementDataService.js');

// Formatting helpers
function formatPesos(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return amount < 0 ? `(${formatted})` : formatted;
}

function formatDate(date) {
  if (!date) return 'N/A       ';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid   ';
  return d.toISOString().split('T')[0];
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node scripts/testStatementSimple.js <clientId> <unitId>');
    console.log('Example: node scripts/testStatementSimple.js AVII 103');
    process.exit(1);
  }
  
  const clientId = args[0].toUpperCase();
  const unitId = args[1];
  
  // Determine fiscal year
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const fiscalYear = clientId === 'AVII' ? (month >= 7 ? year + 1 : year) : year;
  
  console.log(`\nGenerating statement for ${clientId} Unit ${unitId} (FY ${fiscalYear})...\n`);
  
  // Create a mock API object that the statement service expects
  const mockApi = {
    get: async (url) => {
      // Handle credit balance API call
      if (url.includes('/credit/')) {
        const parts = url.split('/');
        const cId = parts[2];
        const uId = parts[3];
        
        const creditDoc = await db.collection('clients').doc(cId)
          .collection('units').doc('creditBalances').get();
        
        if (!creditDoc.exists) {
          return { data: { creditBalance: 0, history: [] } };
        }
        
        const data = creditDoc.data();
        const unitData = data[uId] || {};
        
        // Calculate current credit balance from history
        let balance = 0;
        if (unitData.history && Array.isArray(unitData.history)) {
          for (const entry of unitData.history) {
            balance += entry.amount || 0;
          }
        }
        
        return { 
          data: { 
            creditBalance: balance / 100, // Convert from centavos to pesos
            history: unitData.history || []
          } 
        };
      }
      
      throw new Error(`Unhandled API call: ${url}`);
    }
  };
  
  try {
    // Suppress console.log during data generation
    const originalLog = console.log;
    const originalWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};
    
    const data = await getStatementData(mockApi, clientId, unitId, fiscalYear);
    
    // Restore console
    console.log = originalLog;
    console.warn = originalWarn;
    
    // Display results
    const transactions = data.chronologicalTransactions || [];
    const openingBalance = data.summary?.openingBalance || 0;
    const closingBalance = data.summary?.closingBalance || data.summary?.finalBalance || 0;
    
    console.log('═'.repeat(90));
    console.log(`STATEMENT OF ACCOUNT - ${clientId} Unit ${unitId} (FY ${fiscalYear})`);
    console.log('═'.repeat(90));
    console.log(`Date       | Type     | Description                      | Charge      | Payment     | Balance`);
    console.log('─'.repeat(90));
    
    // Opening balance
    const obStr = openingBalance < 0 
      ? `(${formatPesos(Math.abs(openingBalance))}) CR` 
      : formatPesos(openingBalance);
    console.log(`           | OPENING  | Opening Balance                  |             |             | ${obStr.padStart(11)}`);
    
    // Transactions
    let creditAppliedCount = 0;
    for (const txn of transactions) {
      const dateStr = formatDate(txn.date);
      const typeStr = (txn.isCreditApplied ? 'CR-APPLY' : (txn.type || 'OTHER').substring(0, 8)).padEnd(8);
      const desc = (txn.description || '').padEnd(32).substring(0, 32);
      const charge = txn.charge > 0 ? formatPesos(txn.charge).padStart(11) : ' '.repeat(11);
      const payment = txn.payment > 0 ? formatPesos(txn.payment).padStart(11) : ' '.repeat(11);
      
      let balStr;
      if (txn.balance < 0) {
        balStr = `(${formatPesos(Math.abs(txn.balance))}) CR`.padStart(14);
      } else {
        balStr = formatPesos(txn.balance).padStart(11);
      }
      
      console.log(`${dateStr} | ${typeStr} | ${desc} | ${charge} | ${payment} | ${balStr}`);
      
      if (txn.isCreditApplied) creditAppliedCount++;
    }
    
    console.log('─'.repeat(90));
    
    // Closing
    let closeLabel;
    if (closingBalance <= 0) {
      closeLabel = closingBalance < 0 
        ? `CREDIT BALANCE: $${formatPesos(Math.abs(closingBalance))} - NO PAYMENT NEEDED`
        : 'NO PAYMENT NEEDED';
    } else {
      closeLabel = `AMOUNT DUE: $${formatPesos(closingBalance)}`;
    }
    console.log(`           | CLOSING  | ${closeLabel.padEnd(32)} |             |             |`);
    console.log('═'.repeat(90));
    
    // Summary
    console.log(`\nSummary:`);
    console.log(`  Opening Balance:      ${formatPesos(openingBalance)}`);
    console.log(`  Closing Balance:      ${formatPesos(closingBalance)}`);
    console.log(`  Transaction Count:    ${transactions.length}`);
    console.log(`  Credit Applied Lines: ${creditAppliedCount}`);
    
  } catch (error) {
    console.error(`\nERROR: ${error.message}`);
    console.error(error.stack);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

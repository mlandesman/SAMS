#!/usr/bin/env node

/**
 * Verify test import integrity - compare source data with test database
 */

import { getDb } from '../firebase.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function verifyTestImport() {
  console.log('🔍 Verifying test import integrity...\n');
  
  try {
    // Load source data
    const transactionsPath = join(__dirname, '../../MTCdata/Transactions.json');
    const sourceData = JSON.parse(readFileSync(transactionsPath, 'utf8'));
    
    // Get database data for test client
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC-TEST/transactions').get();
    
    console.log('📊 DATA COMPARISON:');
    console.log(`Source transactions: ${sourceData.length}`);
    console.log(`Database transactions: ${snapshot.size}`);
    console.log(`Difference: ${snapshot.size - sourceData.length}\n`);
    
    // Calculate expected totals from source
    let expectedIncome = 0;
    let expectedExpenses = 0;
    
    sourceData.forEach(txn => {
      const amount = (txn.Amount || 0) * 100; // Convert to cents
      if (amount > 0) {
        expectedIncome += amount;
      } else {
        expectedExpenses += amount;
      }
    });
    
    // Calculate actual totals from database
    let actualIncome = 0;
    let actualExpenses = 0;
    const dateIssues = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const amount = data.amount || 0;
      
      if (amount > 0) {
        actualIncome += amount;
      } else {
        actualExpenses += amount;
      }
      
      // Check for date issues
      if (!data.date) {
        dateIssues.push(`Transaction ${doc.id} missing date`);
      }
    });
    
    const expectedNet = expectedIncome + expectedExpenses;
    const actualNet = actualIncome + actualExpenses;
    
    console.log('💰 EXPECTED TOTALS (from source):');
    console.log(`Income: ${expectedIncome} cents ($${(expectedIncome / 100).toFixed(2)})`);
    console.log(`Expenses: ${expectedExpenses} cents ($${(expectedExpenses / 100).toFixed(2)})`);
    console.log(`Net: ${expectedNet} cents ($${(expectedNet / 100).toFixed(2)})\n`);
    
    console.log('💰 ACTUAL TOTALS (from database):');
    console.log(`Income: ${actualIncome} cents ($${(actualIncome / 100).toFixed(2)})`);
    console.log(`Expenses: ${actualExpenses} cents ($${(actualExpenses / 100).toFixed(2)})`);
    console.log(`Net: ${actualNet} cents ($${(actualNet / 100).toFixed(2)})\n`);
    
    // Check for discrepancies
    const incomeDiff = actualIncome - expectedIncome;
    const expenseDiff = actualExpenses - expectedExpenses;
    const netDiff = actualNet - expectedNet;
    
    if (incomeDiff !== 0 || expenseDiff !== 0 || netDiff !== 0) {
      console.log('❌ DISCREPANCIES:');
      console.log(`Income difference: ${incomeDiff} cents ($${(incomeDiff / 100).toFixed(2)})`);
      console.log(`Expense difference: ${expenseDiff} cents ($${(expenseDiff / 100).toFixed(2)})`);
      console.log(`Net difference: ${netDiff} cents ($${(netDiff / 100).toFixed(2)})\n`);
    } else {
      console.log('✅ NO DISCREPANCIES FOUND!\n');
    }
    
    // Show sample comparison
    console.log('🔍 SAMPLE COMPARISON (First 3 transactions):\n');
    
    for (let i = 0; i < Math.min(3, sourceData.length); i++) {
      const source = sourceData[i];
      console.log(`Source ${i + 1}:`);
      console.log(`  Date: ${source.Date}`);
      console.log(`  Amount: $${source.Amount} (${(source.Amount * 100)} cents)`);
      console.log(`  Category: ${source.Category}`);
      console.log('');
    }
    
    // Check HOA Dues specifically
    const hoaTransactions = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.categoryName === 'HOA Dues' || data.categoryName === '-Split-';
    });
    
    console.log(`🏦 HOA Dues Transactions: ${hoaTransactions.length} found`);
    
    // Check for split transactions
    const splitTransactions = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.categoryName === '-Split-' && data.allocations && data.allocations.length > 1;
    });
    
    console.log(`🔄 Split Transactions: ${splitTransactions.length} found`);
    
    if (splitTransactions.length > 0) {
      console.log('\n📊 SAMPLE SPLIT TRANSACTION:');
      const split = splitTransactions[0].data();
      console.log(`  ID: ${splitTransactions[0].id}`);
      console.log(`  Amount: $${(split.amount / 100).toFixed(2)}`);
      console.log(`  Allocations: ${split.allocations.length}`);
      split.allocations.forEach((alloc, idx) => {
        console.log(`    ${idx + 1}. ${alloc.targetName}: $${(alloc.amount / 100).toFixed(2)}`);
      });
    }
    
    console.log('\n✅ Verification completed!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyTestImport();

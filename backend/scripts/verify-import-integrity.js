#!/usr/bin/env node

/**
 * Verify import integrity - compare source data with database
 */

import { getDb } from '../firebase.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function verifyImportIntegrity() {
  console.log('🔍 Verifying import integrity...\n');
  
  try {
    // Load source data
    const transactionsPath = join(__dirname, '../../MTCdata/Transactions.json');
    const sourceData = JSON.parse(readFileSync(transactionsPath, 'utf8'));
    
    // Get database data
    const db = await getDb();
    const snapshot = await db.collection('clients/MTC/transactions').get();
    
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
      
      // Check date
      let date = null;
      if (data.date) {
        if (data.date._seconds) {
          date = new Date(data.date._seconds * 1000);
        } else if (data.date.toDate) {
          date = data.date.toDate();
        } else {
          date = new Date(data.date);
        }
        
        if (date && date.getFullYear() === 2025 && date.getMonth() === 6) {
          dateIssues.push(doc.id);
        }
      }
    });
    
    console.log('💰 EXPECTED TOTALS (from source):');
    console.log(`Income: ${expectedIncome} cents ($${(expectedIncome / 100).toFixed(2)})`);
    console.log(`Expenses: ${expectedExpenses} cents ($${(expectedExpenses / 100).toFixed(2)})`);
    console.log(`Net: ${expectedIncome + expectedExpenses} cents ($${((expectedIncome + expectedExpenses) / 100).toFixed(2)})\n`);
    
    console.log('💰 ACTUAL TOTALS (from database):');
    console.log(`Income: ${actualIncome} cents ($${(actualIncome / 100).toFixed(2)})`);
    console.log(`Expenses: ${actualExpenses} cents ($${(actualExpenses / 100).toFixed(2)})`);
    console.log(`Net: ${actualIncome + actualExpenses} cents ($${((actualIncome + actualExpenses) / 100).toFixed(2)})\n`);
    
    console.log('❌ DISCREPANCIES:');
    console.log(`Income difference: ${actualIncome - expectedIncome} cents ($${((actualIncome - expectedIncome) / 100).toFixed(2)})`);
    console.log(`Expense difference: ${actualExpenses - expectedExpenses} cents ($${((actualExpenses - expectedExpenses) / 100).toFixed(2)})`);
    console.log(`Net difference: ${(actualIncome + actualExpenses) - (expectedIncome + expectedExpenses)} cents ($${(((actualIncome + actualExpenses) - (expectedIncome + expectedExpenses)) / 100).toFixed(2)})\n`);
    
    if (dateIssues.length > 0) {
      console.log(`⚠️  DATE ISSUES: ${dateIssues.length} transactions have July 2025 dates`);
      console.log(`This suggests the import used current date instead of source dates\n`);
    }
    
    // Check for duplicates
    if (snapshot.size > sourceData.length) {
      console.log('⚠️  POSSIBLE DUPLICATES:');
      console.log(`Database has ${snapshot.size - sourceData.length} more transactions than source`);
      console.log('This could indicate duplicate imports or old data not being cleared\n');
    }
    
    // Sample comparison
    console.log('🔍 SAMPLE COMPARISON (First 3 transactions):');
    for (let i = 0; i < 3 && i < sourceData.length; i++) {
      const src = sourceData[i];
      console.log(`\nSource ${i + 1}:`);
      console.log(`  Date: ${src.Date}`);
      console.log(`  Amount: $${src.Amount} (${src.Amount * 100} cents)`);
      console.log(`  Category: ${src.Category}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyImportIntegrity();
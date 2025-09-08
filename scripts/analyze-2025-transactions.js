/**
 * Analyze 2025 Transactions Only
 * 
 * Calculates transaction totals for 2025 to verify balances
 * 
 * Task ID: MTC-MIGRATION-001 - 2025 Transaction Analysis
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';

async function analyze2025Transactions() {
  console.log('📊 Analyzing 2025 Transactions Only...\n');
  
  await initializeFirebase();
  const db = await getDb();
  
  // Load original transaction data
  console.log('📁 Loading transaction data...');
  const transactionsData = JSON.parse(await fs.readFile('./MTCdata/Transactions.json', 'utf-8'));
  
  // Filter and sum 2025 transactions
  const balances2025 = {
    'MTC Bank': 0,
    'Cash Account': 0
  };
  
  const transactionDetails = {
    'MTC Bank': [],
    'Cash Account': []
  };
  
  let count2025 = 0;
  let totalCount = 0;
  
  transactionsData.forEach((txn, index) => {
    totalCount++;
    
    // Parse date
    const txnDate = new Date(txn.Date);
    const year = txnDate.getFullYear();
    
    // Only process 2025 transactions
    if (year === 2025) {
      count2025++;
      const amount = parseFloat(txn.Amount);
      
      if (!isNaN(amount)) {
        if (txn.Account === 'MTC Bank') {
          balances2025['MTC Bank'] += amount;
          transactionDetails['MTC Bank'].push({
            date: txnDate.toLocaleDateString(),
            vendor: txn.Vendor,
            amount: amount,
            category: txn.Category
          });
        } else if (txn.Account === 'Cash Account') {
          balances2025['Cash Account'] += amount;
          transactionDetails['Cash Account'].push({
            date: txnDate.toLocaleDateString(),
            vendor: txn.Vendor,
            amount: amount,
            category: txn.Category
          });
        }
      }
    }
  });
  
  // Display results
  console.log('\n' + '='.repeat(70));
  console.log('📊 2025 TRANSACTION ANALYSIS');
  console.log('='.repeat(70));
  
  console.log('\n📋 SUMMARY:');
  console.log(`   Total transactions in file: ${totalCount}`);
  console.log(`   2025 transactions: ${count2025}`);
  console.log(`   2024 and earlier: ${totalCount - count2025}`);
  
  console.log('\n💰 2025 BALANCES:');
  console.log(`   MTC Bank: $${balances2025['MTC Bank'].toFixed(2)}`);
  console.log(`   Cash Account: $${balances2025['Cash Account'].toFixed(2)}`);
  console.log(`   Combined Total: $${(balances2025['MTC Bank'] + balances2025['Cash Account']).toFixed(2)}`);
  
  console.log('\n🎯 EXPECTED 2025 VALUES:');
  console.log(`   MTC Bank: $-20,658.00`);
  console.log(`   Cash Account: $+8,580.00`);
  
  console.log('\n🔍 DIFFERENCES:');
  const bankDiff = balances2025['MTC Bank'] - (-20658);
  const cashDiff = balances2025['Cash Account'] - 8580;
  console.log(`   MTC Bank difference: $${bankDiff.toFixed(2)}`);
  console.log(`   Cash Account difference: $${cashDiff.toFixed(2)}`);
  
  // Show first few 2025 transactions for each account
  console.log('\n📝 SAMPLE 2025 TRANSACTIONS:');
  
  console.log('\nMTC Bank (first 5):');
  transactionDetails['MTC Bank'].slice(0, 5).forEach(txn => {
    console.log(`   ${txn.date}: $${txn.amount.toFixed(2)} - ${txn.vendor}`);
  });
  console.log(`   ... and ${transactionDetails['MTC Bank'].length - 5} more`);
  
  console.log('\nCash Account (first 5):');
  transactionDetails['Cash Account'].slice(0, 5).forEach(txn => {
    console.log(`   ${txn.date}: $${txn.amount.toFixed(2)} - ${txn.vendor}`);
  });
  console.log(`   ... and ${transactionDetails['Cash Account'].length - 5} more`);
  
  // Check for large 2025 transactions
  console.log('\n💸 LARGE 2025 TRANSACTIONS (> $10,000):');
  let largeFound = false;
  
  transactionDetails['MTC Bank'].forEach(txn => {
    if (Math.abs(txn.amount) > 10000) {
      console.log(`   MTC Bank: ${txn.date} - $${txn.amount.toFixed(2)} - ${txn.vendor}`);
      largeFound = true;
    }
  });
  
  transactionDetails['Cash Account'].forEach(txn => {
    if (Math.abs(txn.amount) > 10000) {
      console.log(`   Cash Account: ${txn.date} - $${txn.amount.toFixed(2)} - ${txn.vendor}`);
      largeFound = true;
    }
  });
  
  if (!largeFound) {
    console.log('   None found');
  }
  
  console.log('\n' + '='.repeat(70));
  
  return {
    balances2025,
    count2025,
    differences: {
      bank: bankDiff,
      cash: cashDiff
    }
  };
}

// Execute
analyze2025Transactions()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
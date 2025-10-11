/**
 * Analyze Balance Discrepancy
 * 
 * Compares imported transaction totals with expected balances
 * 
 * Task ID: MTC-MIGRATION-001 - Balance Analysis
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';

/**
 * Expected balances from spreadsheet
 */
const EXPECTED_BALANCES = {
  'bank-001': 153430,  // CiBanco
  'cash-001': 13580    // Cash
};

async function analyzeBalances() {
  console.log('📊 Analyzing Balance Discrepancy...\n');
  
  await initializeFirebase();
  const db = await getDb();
  
  // Load original transaction data
  console.log('📁 Loading original transaction data...');
  const transactionsData = JSON.parse(await fs.readFile('./MTCdata/Transactions.json', 'utf-8'));
  
  // Calculate balances from raw data
  const rawBalances = {
    'MTC Bank': 0,
    'Cash Account': 0
  };
  
  const transactionDetails = {
    byAccount: {},
    zeroAmount: [],
    missingAmount: [],
    invalidAccount: [],
    largeTransactions: []
  };
  
  transactionsData.forEach((txn, index) => {
    // Check for missing or invalid amounts
    if (txn.Amount === undefined || txn.Amount === null || txn.Amount === '') {
      transactionDetails.missingAmount.push({
        index: index + 1,
        date: txn.Date,
        vendor: txn.Vendor,
        account: txn.Account
      });
      return;
    }
    
    const amount = parseFloat(txn.Amount);
    
    if (isNaN(amount)) {
      transactionDetails.missingAmount.push({
        index: index + 1,
        date: txn.Date,
        vendor: txn.Vendor,
        account: txn.Account,
        originalAmount: txn.Amount
      });
      return;
    }
    
    if (amount === 0) {
      transactionDetails.zeroAmount.push({
        index: index + 1,
        date: txn.Date,
        vendor: txn.Vendor,
        account: txn.Account
      });
    }
    
    // Track large transactions (over $50,000)
    if (Math.abs(amount) > 50000) {
      transactionDetails.largeTransactions.push({
        index: index + 1,
        date: txn.Date,
        vendor: txn.Vendor,
        amount: amount,
        account: txn.Account
      });
    }
    
    // Add to appropriate account
    if (txn.Account === 'MTC Bank') {
      rawBalances['MTC Bank'] += amount;
    } else if (txn.Account === 'Cash Account') {
      rawBalances['Cash Account'] += amount;
    } else {
      transactionDetails.invalidAccount.push({
        index: index + 1,
        account: txn.Account,
        amount: amount
      });
    }
    
    // Track by account
    if (!transactionDetails.byAccount[txn.Account]) {
      transactionDetails.byAccount[txn.Account] = {
        count: 0,
        total: 0
      };
    }
    transactionDetails.byAccount[txn.Account].count++;
    transactionDetails.byAccount[txn.Account].total += amount;
  });
  
  // Get current balances from database
  console.log('\n💳 Getting current database balances...');
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const clientDoc = await clientRef.get();
  
  let dbBalances = {};
  if (clientDoc.exists) {
    const clientData = clientDoc.data();
    const accounts = clientData.accounts || [];
    accounts.forEach(account => {
      dbBalances[account.id] = account.balance || 0;
    });
  }
  
  // Calculate discrepancies
  console.log('\n' + '='.repeat(70));
  console.log('📊 BALANCE ANALYSIS REPORT');
  console.log('='.repeat(70));
  
  console.log('\n📋 TRANSACTION SUMMARY:');
  console.log(`   Total transactions in file: ${transactionsData.length}`);
  console.log(`   Transactions with zero amount: ${transactionDetails.zeroAmount.length}`);
  console.log(`   Transactions with missing/invalid amount: ${transactionDetails.missingAmount.length}`);
  console.log(`   Transactions with invalid account: ${transactionDetails.invalidAccount.length}`);
  
  console.log('\n💰 BALANCE CALCULATIONS:');
  console.log('\n   Raw JSON File Totals:');
  console.log(`   MTC Bank: $${rawBalances['MTC Bank'].toFixed(2)}`);
  console.log(`   Cash Account: $${rawBalances['Cash Account'].toFixed(2)}`);
  console.log(`   Combined Total: $${(rawBalances['MTC Bank'] + rawBalances['Cash Account']).toFixed(2)}`);
  
  console.log('\n   Database Balances (After Import):');
  console.log(`   bank-001: $${(dbBalances['bank-001'] || 0).toFixed(2)}`);
  console.log(`   cash-001: $${(dbBalances['cash-001'] || 0).toFixed(2)}`);
  console.log(`   Combined Total: $${((dbBalances['bank-001'] || 0) + (dbBalances['cash-001'] || 0)).toFixed(2)}`);
  
  console.log('\n   Expected Balances (From Spreadsheet):');
  console.log(`   CiBanco: $${EXPECTED_BALANCES['bank-001'].toFixed(2)}`);
  console.log(`   Cash: $${EXPECTED_BALANCES['cash-001'].toFixed(2)}`);
  console.log(`   Combined Total: $${(EXPECTED_BALANCES['bank-001'] + EXPECTED_BALANCES['cash-001']).toFixed(2)}`);
  
  console.log('\n🔍 DISCREPANCY ANALYSIS:');
  const bankDiscrepancy = EXPECTED_BALANCES['bank-001'] - rawBalances['MTC Bank'];
  const cashDiscrepancy = EXPECTED_BALANCES['cash-001'] - rawBalances['Cash Account'];
  
  console.log(`   CiBanco/MTC Bank Difference: $${bankDiscrepancy.toFixed(2)}`);
  console.log(`   Cash Account Difference: $${cashDiscrepancy.toFixed(2)}`);
  console.log(`   Total Discrepancy: $${(bankDiscrepancy + cashDiscrepancy).toFixed(2)}`);
  
  if (transactionDetails.missingAmount.length > 0) {
    console.log('\n⚠️ TRANSACTIONS WITH MISSING/INVALID AMOUNTS:');
    transactionDetails.missingAmount.forEach(txn => {
      console.log(`   Row ${txn.index}: ${txn.vendor} (${txn.account}) - Original: "${txn.originalAmount}"`);
    });
  }
  
  if (transactionDetails.zeroAmount.length > 0) {
    console.log('\n⚠️ TRANSACTIONS WITH ZERO AMOUNT:');
    transactionDetails.zeroAmount.forEach(txn => {
      console.log(`   Row ${txn.index}: ${txn.vendor} (${txn.account})`);
    });
  }
  
  if (transactionDetails.invalidAccount.length > 0) {
    console.log('\n⚠️ TRANSACTIONS WITH INVALID ACCOUNT:');
    transactionDetails.invalidAccount.forEach(txn => {
      console.log(`   Row ${txn.index}: Account "${txn.account}" - Amount: $${txn.amount}`);
    });
  }
  
  console.log('\n💸 LARGE TRANSACTIONS (> $50,000):');
  if (transactionDetails.largeTransactions.length > 0) {
    transactionDetails.largeTransactions.forEach(txn => {
      console.log(`   Row ${txn.index}: $${txn.amount.toFixed(2)} - ${txn.vendor} (${txn.account})`);
    });
  } else {
    console.log('   None found');
  }
  
  console.log('\n📊 TRANSACTIONS BY ACCOUNT:');
  Object.entries(transactionDetails.byAccount).forEach(([account, stats]) => {
    console.log(`   ${account}: ${stats.count} transactions, Total: $${stats.total.toFixed(2)}`);
  });
  
  // Suggest manual override values
  console.log('\n💡 SUGGESTED MANUAL OVERRIDE:');
  console.log('   To match spreadsheet balances, update accounts to:');
  console.log(`   bank-001: $${EXPECTED_BALANCES['bank-001'].toFixed(2)}`);
  console.log(`   cash-001: $${EXPECTED_BALANCES['cash-001'].toFixed(2)}`);
  
  console.log('\n' + '='.repeat(70));
  
  return {
    rawBalances,
    dbBalances,
    expectedBalances: EXPECTED_BALANCES,
    discrepancies: {
      bank: bankDiscrepancy,
      cash: cashDiscrepancy,
      total: bankDiscrepancy + cashDiscrepancy
    },
    issues: {
      missingAmount: transactionDetails.missingAmount.length,
      zeroAmount: transactionDetails.zeroAmount.length,
      invalidAccount: transactionDetails.invalidAccount.length
    }
  };
}

// Execute
analyzeBalances()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
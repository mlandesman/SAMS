#!/usr/bin/env node

/**
 * Export Transactions with Running Balance Calculations
 * Creates CSV export to debug balance discrepancies
 */

import { initializeFirebase, printEnvironmentInfo } from './client-onboarding/utils/environment-config.js';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';

async function exportTransactionsWithBalances() {
  try {
    console.log('📊 Exporting transactions with running balance calculations...\n');
    
    // Initialize Firebase
    const { db } = await initializeFirebase('dev');
    printEnvironmentInfo('dev');
    
    // Get year-end 2024 snapshot
    const snapshotRef = db.collection('clients').doc(CLIENT_ID).collection('yearEndBalances').doc('2024');
    const snapshot = await snapshotRef.get();
    
    if (!snapshot.exists) {
      console.error('❌ Year-end snapshot for 2024 not found');
      process.exit(1);
    }
    
    const snapshotData = snapshot.data();
    const snapshotAccounts = snapshotData.accounts || [];
    
    // Get starting balances
    const bankAccount = snapshotAccounts.find(acc => acc.id === 'bank-001');
    const cashAccount = snapshotAccounts.find(acc => acc.id === 'cash-001');
    
    let bankBalance = bankAccount?.balance || 0;
    let cashBalance = cashAccount?.balance || 0;
    
    console.log('📋 Starting balances from 2024 year-end snapshot:');
    console.log(`   Bank: $${(bankBalance / 100).toFixed(2)} (${bankBalance} cents)`);
    console.log(`   Cash: $${(cashBalance / 100).toFixed(2)} (${cashBalance} cents)`);
    
    // Get all 2025 transactions, sorted by date
    const transactionsRef = db.collection('clients').doc(CLIENT_ID).collection('transactions');
    const query = transactionsRef
      .where('date', '>', new Date('2024-12-31T23:59:59.000Z'))
      .orderBy('date', 'asc');
    
    const querySnapshot = await query.get();
    const transactions = [];
    
    querySnapshot.docs.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`\n📊 Found ${transactions.length} transactions for 2025`);
    
    // Prepare CSV data
    const csvRows = [];
    
    // CSV Header
    csvRows.push([
      'Date',
      'Transaction ID',
      'Amount ($)',
      'Amount (cents)',
      'Type',
      'Account ID',
      'Account Type',
      'Category',
      'Vendor',
      'Notes',
      'Bank Balance ($)',
      'Bank Balance (cents)',
      'Cash Balance ($)',
      'Cash Balance (cents)',
      'Total Balance ($)',
      'Total Balance (cents)',
      'Balance Change'
    ]);
    
    // Add starting balances row
    csvRows.push([
      '2024-12-31',
      'YEAR_END_SNAPSHOT',
      '0.00',
      '0',
      'snapshot',
      '',
      '',
      'Year End Snapshot',
      '',
      'Starting balances from 2024 year-end',
      (bankBalance / 100).toFixed(2),
      bankBalance,
      (cashBalance / 100).toFixed(2),
      cashBalance,
      ((bankBalance + cashBalance) / 100).toFixed(2),
      (bankBalance + cashBalance),
      ''
    ]);
    
    // Process each transaction
    for (const transaction of transactions) {
      const amount = transaction.amount || 0;
      const accountType = transaction.accountType;
      const date = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
      
      // Calculate balance change
      let balanceChange = '';
      let prevBankBalance = bankBalance;
      let prevCashBalance = cashBalance;
      
      if (accountType === 'bank') {
        bankBalance += amount;
        balanceChange = `Bank ${amount >= 0 ? '+' : ''}${(amount / 100).toFixed(2)}`;
      } else if (accountType === 'cash') {
        cashBalance += amount;
        balanceChange = `Cash ${amount >= 0 ? '+' : ''}${(amount / 100).toFixed(2)}`;
      }
      
      csvRows.push([
        date.toISOString().split('T')[0], // Date
        transaction.id,
        (amount / 100).toFixed(2),
        amount,
        transaction.type || '',
        transaction.accountId || '',
        accountType || '',
        transaction.categoryName || transaction.categoryId || '',
        transaction.vendorName || transaction.vendorId || '',
        (transaction.notes || '').replace(/,/g, ';'), // Replace commas to avoid CSV issues
        (bankBalance / 100).toFixed(2),
        bankBalance,
        (cashBalance / 100).toFixed(2),
        cashBalance,
        ((bankBalance + cashBalance) / 100).toFixed(2),
        (bankBalance + cashBalance),
        balanceChange
      ]);
    }
    
    // Convert to CSV string
    const csvContent = csvRows.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
    
    // Save to file
    const filename = `MTC_Transactions_Balance_Debug_${new Date().toISOString().split('T')[0]}.csv`;
    await fs.writeFile(filename, csvContent);
    
    console.log(`\n✅ Export complete!`);
    console.log(`📄 File: ${filename}`);
    console.log(`📊 Records: ${transactions.length + 1} (including starting balances)`);
    
    console.log(`\n💰 Final calculated balances:`);
    console.log(`   Bank: $${(bankBalance / 100).toFixed(2)} (${bankBalance} cents)`);
    console.log(`   Cash: $${(cashBalance / 100).toFixed(2)} (${cashBalance} cents)`);
    console.log(`   Total: $${((bankBalance + cashBalance) / 100).toFixed(2)}`);
    
    console.log(`\n🎯 Expected balances:`);
    console.log(`   Bank: $161,535.00 (16,153,500 cents)`);
    console.log(`   Cash: $21,180.00 (2,118,000 cents)`);
    console.log(`   Total: $182,715.00`);
    
    console.log(`\n📊 Discrepancy:`);
    console.log(`   Bank: ${bankBalance > 16153500 ? '+' : ''}$${((bankBalance - 16153500) / 100).toFixed(2)}`);
    console.log(`   Cash: ${cashBalance > 2118000 ? '+' : ''}$${((cashBalance - 2118000) / 100).toFixed(2)}`);
    
    console.log(`\n💡 Open the CSV file in Excel to track balance changes transaction by transaction`);
    
  } catch (error) {
    console.error('❌ Error exporting transactions:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the export
exportTransactionsWithBalances();
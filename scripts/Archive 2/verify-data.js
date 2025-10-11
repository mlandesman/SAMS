/**
 * verify-data.js
 * 
 * Utility script to verify imported data and provide statistics
 */

import { getDb, initializeFirebase } from '../backend/firebase.js';

// Initialize Firebase
console.log('🔥 Initializing Firebase Admin SDK...');
await initializeFirebase();
const db = await getDb();
console.log('✅ Firebase Admin SDK initialized successfully');

/**
 * Verify transactions for a client
 */
async function verifyTransactions(clientId) {
  console.log(`\n📊 Verifying transactions for client ${clientId}...`);
  
  try {
    // Get transactions
    const txnRef = db.collection(`clients/${clientId}/transactions`);
    const snapshots = await txnRef.get();
    
    if (snapshots.empty) {
      console.log('⚠️ No transactions found');
      return false;
    }
    
    const transactions = [];
    snapshots.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Found ${transactions.length} transactions`);
    
    // Analyze categories
    const categories = {};
    transactions.forEach(tx => {
      const category = tx.Category || tx.category || 'Unknown';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    // Analyze accounts
    const accounts = {};
    transactions.forEach(tx => {
      const accountId = tx.accountId || 'Unknown';
      accounts[accountId] = (accounts[accountId] || 0) + 1;
    });
    
    // Analyze date range
    let earliestDate = new Date();
    let latestDate = new Date(0);
    
    transactions.forEach(tx => {
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      if (!isNaN(txDate.getTime())) {
        if (txDate < earliestDate) earliestDate = txDate;
        if (txDate > latestDate) latestDate = txDate;
      }
    });
    
    // Print statistics
    console.log('\n📊 Transaction Statistics:');
    console.log(`  Total Transactions: ${transactions.length}`);
    console.log(`  Date Range: ${earliestDate.toLocaleDateString()} to ${latestDate.toLocaleDateString()}`);
    
    console.log('\n📊 Categories:');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count} transactions`);
      });
    
    console.log('\n📊 Accounts:');
    Object.entries(accounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([accountId, count]) => {
        console.log(`  ${accountId}: ${count} transactions`);
      });
    
    return true;
  } catch (error) {
    console.error(`❌ Error verifying transactions:`, error);
    return false;
  }
}

/**
 * Verify HOA dues for a client
 */
async function verifyHoaDues(clientId) {
  console.log(`\n📊 Verifying HOA dues for client ${clientId}...`);
  
  try {
    // Get HOA dues records
    const duesRef = db.collection(`clients/${clientId}/hoaDues`);
    const snapshots = await duesRef.get();
    
    if (snapshots.empty) {
      console.log('⚠️ No HOA dues records found');
      return false;
    }
    
    const records = [];
    snapshots.forEach(doc => {
      records.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Found ${records.length} HOA dues records`);
    
    // Count payments
    let totalPayments = 0;
    let linkedPayments = 0;
    
    records.forEach(record => {
      const payments = record.payments || [];
      totalPayments += payments.length;
      
      payments.forEach(payment => {
        if (payment.transactionId) linkedPayments++;
      });
    });
    
    // Print statistics
    console.log('\n📊 HOA Dues Statistics:');
    console.log(`  Total Records: ${records.length}`);
    console.log(`  Total Payments: ${totalPayments}`);
    console.log(`  Linked Payments: ${linkedPayments}`);
    console.log(`  Unlinked Payments: ${totalPayments - linkedPayments}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error verifying HOA dues:`, error);
    return false;
  }
}

/**
 * Verify client accounts
 */
async function verifyAccounts(clientId) {
  console.log(`\n📊 Verifying accounts for client ${clientId}...`);
  
  try {
    // Get client document
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.log(`⚠️ Client ${clientId} not found`);
      return false;
    }
    
    const clientData = clientDoc.data();
    const accounts = clientData.accounts || [];
    
    if (!accounts.length) {
      console.log('⚠️ No accounts found');
      return false;
    }
    
    console.log(`✅ Found ${accounts.length} accounts`);
    
    // Print account details
    console.log('\n📊 Account Details:');
    accounts.forEach(account => {
      console.log(`  ${account.name} (${account.id}):`);
      console.log(`    Type: ${account.type}`);
      console.log(`    Currency: ${account.currency}`);
      console.log(`    Balance: ${account.balance}`);
      console.log(`    Active: ${account.active}`);
      console.log();
    });
    
    return true;
  } catch (error) {
    console.error(`❌ Error verifying accounts:`, error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Data Verification Tool

Usage:
  node verify-data.js <clientId> [options]

Options:
  --transactions  Verify transactions
  --accounts      Verify accounts
  --hoa-dues      Verify HOA dues records
  --all           Verify all data
  --help          Show this help message

Example:
  node verify-data.js MTC --all
    `);
    process.exit(0);
  }
  
  const clientId = args[0];
  
  const doTransactions = args.includes('--transactions') || args.includes('--all');
  const doAccounts = args.includes('--accounts') || args.includes('--all');
  const doHoaDues = args.includes('--hoa-dues') || args.includes('--all');
  
  if (!doTransactions && !doAccounts && !doHoaDues) {
    // If no specific option, verify transactions by default
    await verifyTransactions(clientId);
  } else {
    if (doTransactions) await verifyTransactions(clientId);
    if (doAccounts) await verifyAccounts(clientId);
    if (doHoaDues) await verifyHoaDues(clientId);
  }
  
  console.log('\n✅ Verification completed');
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

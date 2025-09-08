/**
 * test-accounts.js
 * Test script for the new account-based balance system
 */

import { getDb, initializeFirebase } from '../backend/firebase.js';
import { getAccounts, updateAccountBalance, rebuildBalances } from '../backend/controllers/accountsController.js';
import { createTransaction, deleteTransaction } from '../backend/controllers/transactionsController.js';

// Initialize Firebase
await initializeFirebase();
const db = await getDb();

const CLIENT_ID = 'MTC';

/**
 * Create a test transaction for the specified account
 */
async function createTestTransaction(account, amount) {
  console.log(`📝 Creating test transaction for ${account}: ${amount}`);
  
  const transactionData = {
    account,
    amount,
    category: 'Test Transaction',
    date: new Date(),
    description: `Test transaction for ${account}`,
    type: amount > 0 ? 'income' : 'expense'
  };
  
  const txnId = await createTransaction(CLIENT_ID, transactionData);
  
  if (txnId) {
    console.log(`✅ Created transaction ${txnId}`);
    return txnId;
  } else {
    console.error('❌ Failed to create transaction');
    return null;
  }
}

/**
 * Show current account balances
 */
async function showAccountBalances() {
  console.log('\n📊 Current Account Balances:');
  const accounts = await getAccounts(CLIENT_ID);
  
  accounts.forEach(account => {
    console.log(`${account.name}: ${account.balance} ${account.currency}`);
  });
  
  return accounts;
}

/**
 * Run the test sequence
 */
async function runTests() {
  try {
    // Show initial balances
    console.log('\n==== Initial State ====');
    await showAccountBalances();
    
    // Create test transactions for both accounts
    console.log('\n==== Creating Transactions ====');
    const cashTxn = await createTestTransaction('Cash', 5000);
    const bankTxn = await createTestTransaction('CiBanco', 10000);
    
    // Show balances after transactions
    console.log('\n==== After Transactions ====');
    await showAccountBalances();
    
    // Delete transactions
    console.log('\n==== Deleting Transactions ====');
    if (cashTxn) {
      await deleteTransaction(CLIENT_ID, cashTxn);
      console.log(`✅ Deleted Cash transaction ${cashTxn}`);
    }
    
    if (bankTxn) {
      await deleteTransaction(CLIENT_ID, bankTxn);
      console.log(`✅ Deleted CiBanco transaction ${bankTxn}`);
    }
    
    // Show final balances
    console.log('\n==== Final State ====');
    await showAccountBalances();
    
    // Test rebuild balances
    console.log('\n==== Testing Rebuild Balances ====');
    
    // Manually mess up the balances
    console.log('Setting incorrect balances manually...');
    await updateAccountBalance(CLIENT_ID, 'Cash', 100000);
    await updateAccountBalance(CLIENT_ID, 'CiBanco', 200000);
    
    // Show incorrect balances
    console.log('\n==== Incorrect Balances ====');
    await showAccountBalances();
    
    // Rebuild balances
    console.log('\n==== Rebuilding Balances ====');
    const updatedAccounts = await rebuildBalances(CLIENT_ID);
    console.log('✅ Balances rebuilt');
    
    // Show corrected balances
    console.log('\n==== Corrected Balances ====');
    await showAccountBalances();
    
    console.log('\n✅ All tests completed');
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the tests
await runTests();
process.exit(0);

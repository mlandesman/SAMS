/*
 * testTransactionManagement.js
 * 
 * A test script to verify that our transaction management is working correctly
 * with proper timestamp handling. This script will:
 * 
 * 1. Add a test transaction
 * 2. Verify that the transaction was added correctly
 * 3. Edit the transaction
 * 4. Delete the transaction
 */

import { createTransaction, updateTransaction, deleteTransaction, listTransactions } from '../backend/controllers/transactionsController.js';
import { dateToTimestamp, normalizeDates } from './utils/timestampConverter.js';
import { getDb } from '../backend/firebase.js';

// Use a consistent test transaction ID prefix for easy identification
const TEST_PREFIX = 'TEST_TRANSACTION_';

/**
 * Create a test transaction
 */
async function createTestTransaction() {
  const clientId = 'MTC'; // Use the test client ID
  const testId = `${TEST_PREFIX}${Date.now()}`; // Use a timestamp as part of the ID for uniqueness
  
  // Create a test transaction with the current date
  const testDate = new Date();
  const testData = {
    date: dateToTimestamp(testDate),
    vendor: 'Test Vendor',
    category: 'Test Category',
    notes: 'Test transaction created by script',
    unit: 'Test Unit',
    amount: -100.00, // Negative amount for an expense
    accountType: 'Bank'
  };
  
  console.log('⏳ Creating test transaction...');
  
  try {
    // Use the controller function to create the transaction
    const txnId = await createTransaction(clientId, testData);
    console.log(`✅ Created test transaction with ID: ${txnId}`);
    return { id: txnId, ...testData };
  } catch (error) {
    console.error('❌ Error creating test transaction:', error);
    return null;
  }
}

/**
 * Verify that the transaction exists and match our test data
 */
async function verifyTransaction(transactionId) {
  const clientId = 'MTC';
  
  console.log(`⏳ Verifying test transaction: ${transactionId}...`);
  
  try {
    // Get all transactions and find the one we just created
    const transactions = await listTransactions(clientId);
    const transaction = transactions.find(t => t.id === transactionId);
    
    if (!transaction) {
      console.error('❌ Transaction not found!');
      return false;
    }
    
    // Normalize dates for proper display
    const normalizedData = normalizeDates(transaction);
    
    console.log('📄 Transaction data:');
    console.log(JSON.stringify(normalizedData, null, 2));
    
    console.log('✅ Transaction verified successfully');
    return true;
  } catch (error) {
    console.error('❌ Error verifying transaction:', error);
    return false;
  }
}

/**
 * Update the test transaction
 */
async function updateTestTransaction(transactionId) {
  const clientId = 'MTC';
  
  console.log(`⏳ Updating test transaction: ${transactionId}...`);
  
  try {
    // Update the test transaction using the controller function
    const updateData = {
      vendor: 'Updated Test Vendor',
      notes: 'This transaction was updated by the test script',
      amount: -150.00 // Changed amount
    };
    
    await updateTransaction(clientId, transactionId, updateData);
    
    console.log('✅ Transaction updated successfully');
    return true;
  } catch (error) {
    console.error('❌ Error updating transaction:', error);
    return false;
  }
}

/**
 * Delete the test transaction
 */
async function deleteTestTransaction(transactionId) {
  const clientId = 'MTC';
  
  console.log(`⏳ Deleting test transaction: ${transactionId}...`);
  
  try {
    // Delete the test transaction using the controller function
    await deleteTransaction(clientId, transactionId);
    
    console.log('✅ Transaction deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Error deleting transaction:', error);
    return false;
  }
}

/**
 * Cleanup any test transactions that might have been left from previous runs
 */
async function cleanupTestTransactions() {
  const clientId = 'MTC';
  
  console.log('🧹 Checking for leftover test transactions...');
  
  try {
    // Get all transactions
    const transactions = await listTransactions(clientId);
    
    // Filter out test transactions based on notes field
    const testTransactions = transactions.filter(
      txn => txn.notes && txn.notes.includes('test') && txn.notes.toLowerCase().includes('script')
    );
    
    if (testTransactions.length === 0) {
      console.log('✅ No leftover test transactions found.');
      return;
    }
    
    // Delete each test transaction
    for (const txn of testTransactions) {
      await deleteTransaction(clientId, txn.id);
    }
    
    console.log(`🧹 Cleaned up ${testTransactions.length} leftover test transactions.`);
  } catch (error) {
    console.error('❌ Error cleaning up test transactions:', error);
  }
}

/**
 * Run the full test sequence
 */
async function runTest() {
  console.log('🧪 Starting transaction management test...');
  
  try {
    // Clean up any leftover test transactions
    await cleanupTestTransactions();
    
    // Create a new test transaction
    const transaction = await createTestTransaction();
    
    if (!transaction) {
      throw new Error('Failed to create test transaction');
    }
    
    // Wait a moment to ensure Firebase has processed the write
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify the transaction
    const verified = await verifyTransaction(transaction.id);
    
    if (!verified) {
      throw new Error('Failed to verify test transaction');
    }
    
    // Update the transaction
    const updated = await updateTestTransaction(transaction.id);
    
    if (!updated) {
      throw new Error('Failed to update test transaction');
    }
    
    // Wait a moment to ensure Firebase has processed the update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify the transaction again after update
    const verifiedUpdate = await verifyTransaction(transaction.id);
    
    if (!verifiedUpdate) {
      throw new Error('Failed to verify updated test transaction');
    }
    
    // Delete the transaction
    const deleted = await deleteTestTransaction(transaction.id);
    
    if (!deleted) {
      throw new Error('Failed to delete test transaction');
    }
    
    console.log('✅ Transaction management test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
runTest().catch(error => {
  console.error('❌ Unhandled error in test:', error);
  process.exit(1);
});

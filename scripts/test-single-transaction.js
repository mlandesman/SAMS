#!/usr/bin/env node

/**
 * Test single transaction import to debug the Firestore path error
 */

import { initializeFirebase } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
import { 
  generateCategoryId, 
  generateVendorId, 
  generateAccountId,
  determineAccountType,
  applyAccountingSign 
} from './utils/import-validation-helpers.js';
import fs from 'fs/promises';

const clientId = 'MTC';

async function testSingleTransaction() {
  try {
    console.log('🧪 Testing single transaction import...');
    
    // Initialize Firebase
    const firebaseConfig = await initializeFirebase('dev');
    const db = firebaseConfig.db;
    
    // Load first transaction
    const transactions = JSON.parse(await fs.readFile('../MTCdata/Transactions.json', 'utf-8'));
    const transaction = transactions[0];
    
    console.log('📄 Transaction data:', JSON.stringify(transaction, null, 2));
    
    // Generate IDs
    const categoryId = generateCategoryId(transaction.Category);
    const categoryName = transaction.Category || 'Other';
    const vendorId = generateVendorId(transaction.Vendor);
    const vendorName = transaction.Vendor || 'Other';
    const accountId = generateAccountId(transaction.Account);
    const accountName = transaction.Account || 'Cash';
    const accountType = determineAccountType(transaction.Account);
    
    console.log('🔧 Generated IDs:');
    console.log(`  categoryId: '${categoryId}'`);
    console.log(`  vendorId: '${vendorId}'`);
    console.log(`  accountId: '${accountId}'`);
    
    // Generate transaction ID
    const date = new Date(transaction.Date);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const identifier = (transaction.Category || transaction.Vendor || 'txn')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 10);
    const transactionId = `${dateStr}-${identifier}-0`;
    
    console.log(`  transactionId: '${transactionId}'`);
    
    // Check for empty values
    if (!categoryId || !vendorId || !accountId || !transactionId) {
      throw new Error('Generated IDs cannot be empty');
    }
    
    // Create transaction document
    const amount = Math.round((parseFloat(transaction.Amount) || 0) * 100);
    const type = transaction.Category === 'HOA Dues' ? 'income' : 'expense';
    const signedAmount = applyAccountingSign(amount, type);
    
    const transactionDoc = {
      date: getCurrentTimestamp(date),
      amount: signedAmount,
      type: type,
      categoryId: categoryId,
      categoryName: categoryName,
      vendorId: vendorId,
      vendorName: vendorName,
      accountId: accountId,
      accountName: accountName,
      accountType: accountType,
      description: transaction.Vendor || '',
      memo: transaction.Notes || '',
      reference: transaction.Unit || '',
      checkNumber: null,
      clientId: clientId,
      status: 'completed',
      reconciled: false,
      updated: getCurrentTimestamp()
    };
    
    console.log('📝 Transaction document created');
    
    // Try to write to Firestore
    console.log('💾 Attempting Firestore write...');
    console.log(`   Collection path: 'clients/${clientId}/transactions'`);
    console.log(`   Document ID: '${transactionId}'`);
    
    const docRef = db.collection(`clients/${clientId}/transactions`).doc(transactionId);
    await docRef.set(transactionDoc);
    
    console.log('✅ Single transaction import successful!');
    
  } catch (error) {
    console.error('❌ Error in single transaction test:', error.message);
    console.error('Stack:', error.stack);
  }
}

testSingleTransaction();
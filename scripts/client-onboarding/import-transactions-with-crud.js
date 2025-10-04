/**
 * Transactions Import with CRUD Functions
 * 
 * Imports MTC transaction data using createTransaction() controller
 * Handles proper account mapping and automatic audit logging
 * 
 * Task ID: MTC-MIGRATION-001 - Transaction Import with CRUD
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../../backend/firebase.js';
import { createTransaction } from '../../backend/controllers/transactionsController.js';
import { augmentMTCTransaction, validateAugmentedTransaction } from '../data-augmentation-utils.js';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';

/**
 * Load transactions data
 */
async function loadTransactionsData() {
  console.log('📁 Loading Transactions data...');
  
  const transactionsData = JSON.parse(await fs.readFile('../../MTCdata/Transactions.json', 'utf-8'));
  console.log(`✅ Loaded ${transactionsData.length} transactions`);
  
  return transactionsData;
}

/**
 * Extract unit ID from transaction unit field
 * Format: "1A (Fletcher)" → "1A"
 */
function extractUnitId(unitField) {
  if (!unitField) return null;
  
  const match = unitField.match(/^([A-Z0-9]+)\s*\(/);
  return match ? match[1] : null;
}

/**
 * Import Transactions using CRUD functions
 */
async function importTransactionsWithCRUD(transactionsData) {
  console.log('\n💰 Importing Transactions using CRUD functions...\n');
  
  const results = {
    total: transactionsData.length,
    success: 0,
    errors: 0,
    validationErrors: 0,
    byCategory: {},
    byAccount: {},
    hoaDuesTransactions: [],
    transactionIdMap: {}  // Map googleId → firestore transactionId
  };
  
  const db = await getDb();
  
  for (const [index, txnData] of transactionsData.entries()) {
    try {
      console.log(`💰 Processing transaction ${index + 1}/${results.total}`);
      
      // Augment transaction data with account mapping
      const augmentedTxn = augmentMTCTransaction(txnData);
      
      // Add unit ID if this is an HOA Dues transaction
      if (txnData.Category === 'HOA Dues' && txnData.Unit) {
        const unitId = extractUnitId(txnData.Unit);
        if (unitId) {
          augmentedTxn.unitId = unitId;
          augmentedTxn.metadata = {
            type: 'hoa_dues',
            originalUnit: txnData.Unit
          };
        }
      }
      
      // Validate augmented data
      const validation = validateAugmentedTransaction(augmentedTxn);
      if (!validation.isValid) {
        console.error(`   ❌ Validation failed:`, validation.errors);
        results.validationErrors++;
        continue;
      }
      
      // Remove fields that CRUD function will add
      delete augmentedTxn.createdAt;
      delete augmentedTxn.clientId; // CRUD function adds this
      
      // Map field names to what createTransaction expects
      const transactionData = {
        ...augmentedTxn,
        vendorName: augmentedTxn.vendor,
        categoryName: augmentedTxn.category,
        propertyId: CLIENT_ID,
        enteredBy: 'import_script',
        accountName: augmentedTxn.account,
        type: augmentedTxn.amount >= 0 ? 'income' : 'expense'  // Determine type based on amount
      };
      
      // Remove old field names
      delete transactionData.vendor;
      delete transactionData.category;
      delete transactionData.account;
      
      // Use CRUD function (includes automatic audit logging)
      const transactionId = await createTransaction(CLIENT_ID, transactionData);
      
      if (transactionId) {
        console.log(`   ✅ Created transaction ${transactionId}`);
        console.log(`      Date: ${new Date(txnData.Date).toLocaleDateString()}`);
        console.log(`      Amount: $${txnData.Amount}`);
        console.log(`      Vendor: ${txnData.Vendor}`);
        console.log(`      Category: ${txnData.Category}`);
        console.log(`      Account: ${augmentedTxn.account} (${augmentedTxn.accountId})`);
        
        results.success++;
        
        // Track by category
        results.byCategory[txnData.Category] = (results.byCategory[txnData.Category] || 0) + 1;
        
        // Track by account
        results.byAccount[augmentedTxn.account] = (results.byAccount[augmentedTxn.account] || 0) + 1;
        
        // Track HOA dues transactions for later linking
        if (txnData.Category === 'HOA Dues') {
          results.hoaDuesTransactions.push({
            transactionId,
            unitId: augmentedTxn.unitId,
            amount: txnData.Amount,
            date: txnData.Date,
            googleId: txnData[''] || `seq_${index + 1}`
          });
        }
        
        // Map googleId to transactionId
        const googleId = txnData[''] || `seq_${index + 1}`;
        results.transactionIdMap[googleId] = transactionId;
        
      } else {
        console.log(`   ❌ Failed to create transaction`);
        results.errors++;
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing transaction:`, error.message);
      if (index < 3) {  // Only show details for first few errors
        console.error('   Transaction data:', {
          vendor: txnData.Vendor,
          category: txnData.Category,
          amount: txnData.Amount,
          account: txnData.Account,
          date: txnData.Date
        });
      }
      results.errors++;
    }
  }
  
  console.log(`\n📊 Transactions Import Summary:`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Errors: ${results.errors}`);
  console.log(`   Validation Errors: ${results.validationErrors}`);
  console.log(`   HOA Dues Transactions: ${results.hoaDuesTransactions.length}`);
  console.log(`   Audit logs: ${results.success} (automatic via CRUD)`);
  
  console.log(`\n📊 By Category:`);
  Object.entries(results.byCategory).forEach(([category, count]) => {
    console.log(`   ${category}: ${count}`);
  });
  
  console.log(`\n📊 By Account:`);
  Object.entries(results.byAccount).forEach(([account, count]) => {
    console.log(`   ${account}: ${count}`);
  });
  
  return results;
}

/**
 * Save transaction ID mapping for HOA dues processing
 */
async function saveTransactionIdMapping(transactionIdMap) {
  console.log('\n💾 Saving transaction ID mapping for HOA dues processing...');
  
  const mappingData = {
    generated: new Date().toISOString(),
    count: Object.keys(transactionIdMap).length,
    mapping: transactionIdMap
  };
  
  await fs.writeFile(
    './transaction-id-mapping.json',
    JSON.stringify(mappingData, null, 2)
  );
  
  console.log(`✅ Saved mapping for ${mappingData.count} transactions`);
}

/**
 * Verify transactions import
 */
async function verifyTransactionsImport(db) {
  console.log('\n🔍 Verifying transactions import...\n');
  
  const transactionsRef = db.collection('clients').doc(CLIENT_ID).collection('transactions');
  const transactionsSnapshot = await transactionsRef.get();
  
  console.log(`💰 Transactions in database: ${transactionsSnapshot.size}`);
  
  // Sample first few transactions
  if (transactionsSnapshot.size > 0) {
    console.log('\n💰 Sample transactions:');
    transactionsSnapshot.docs.slice(0, 3).forEach(doc => {
      const data = doc.data();
      console.log(`   ${doc.id}: $${data.amount} - ${data.vendor} (${data.category})`);
    });
  }
  
  // Check audit logs
  try {
    const auditLogsRef = db.collection('auditLogs');
    const auditSnapshot = await auditLogsRef
      .where('clientId', '==', CLIENT_ID)
      .where('module', '==', 'transactions')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    console.log(`\n📋 Recent transaction audit logs found: ${auditSnapshot.size}`);
  } catch (error) {
    console.log('⚠️ Could not query audit logs (index may be needed)');
  }
  
  return {
    totalTransactions: transactionsSnapshot.size
  };
}

/**
 * Main transactions import process
 */
async function performTransactionsImportWithCRUD() {
  console.log('🚀 Starting Transactions Import with CRUD Functions...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    clientId: CLIENT_ID,
    import: null,
    verification: null,
    success: false
  };
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Load transactions data
    const transactionsData = await loadTransactionsData();
    
    // Import transactions using CRUD
    console.log('\n=== STEP 1: TRANSACTIONS IMPORT (CRUD) ===');
    results.import = await importTransactionsWithCRUD(transactionsData);
    
    // Save transaction ID mapping
    if (results.import.transactionIdMap) {
      await saveTransactionIdMapping(results.import.transactionIdMap);
    }
    
    // Verify import
    console.log('\n=== STEP 2: VERIFICATION ===');
    results.verification = await verifyTransactionsImport(db);
    
    // Check success
    results.success = results.import.success > 0 && results.import.errors === 0;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 TRANSACTIONS IMPORT WITH CRUD SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`⏰ Completed: ${results.timestamp}`);
    console.log('');
    console.log('📁 IMPORT RESULTS:');
    console.log(`   Successfully imported: ${results.import.success}`);
    console.log(`   Import errors: ${results.import.errors}`);
    console.log(`   HOA Dues transactions: ${results.import.hoaDuesTransactions.length}`);
    console.log('');
    console.log('🔍 VERIFICATION:');
    console.log(`   Transactions in database: ${results.verification.totalTransactions}`);
    
    if (results.success) {
      console.log('\n✅ TRANSACTIONS IMPORT WITH CRUD SUCCESSFUL!');
      console.log('💾 Transaction ID mapping saved for HOA dues processing');
      console.log('🚀 Ready for next step: HOA Dues Processing');
    } else {
      console.log('\n⚠️ TRANSACTIONS IMPORT COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before proceeding');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Transactions import failed:', error);
    results.error = error.message;
    throw error;
  }
}

// Execute
performTransactionsImportWithCRUD()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
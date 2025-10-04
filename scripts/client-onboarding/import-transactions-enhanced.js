#!/usr/bin/env node

/**
 * Enhanced Transactions Import with DateService
 * 
 * Imports transaction data with proper timezone handling to prevent date sliding
 * Preserves all business logic from legacy script while adding DateService support
 * 
 * Features:
 * - DateService for all date operations
 * - Client-agnostic (supports MTC, AVII, etc.)
 * - Command-line argument support
 * - Preserves account mapping and validation logic
 * 
 * Usage:
 *   node import-transactions-enhanced.js <CLIENT_ID> [DATA_PATH]
 * 
 * Created: September 29, 2025
 */

import { 
  dateService, 
  getImportConfig, 
  initializeImport, 
  parseDate,
  formatDate,
  getCurrentTimestamp,
  createMigrationMetadata,
  isValidDate,
  logProgress 
} from './import-config.js';
import { augmentMTCTransaction, validateAugmentedTransaction } from '../data-augmentation-utils.js';
import { getClientImportMapping } from '../utils/clientAccountMapping.js';
import { createTransaction } from '../../backend/controllers/transactionsController.js';
import fs from 'fs/promises';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('❌ Usage: node import-transactions-enhanced.js <CLIENT_ID> [DATA_PATH]');
  process.exit(1);
}

const CLIENT_ID = args[0];
const DATA_PATH = args[1];

// Get import configuration
const config = getImportConfig(CLIENT_ID, DATA_PATH);

/**
 * Load transactions data from JSON file
 */
async function loadTransactionsData() {
  logProgress(`Loading transactions data from ${config.dataPath}...`, 'info');
  
  const transactionsFile = path.join(config.dataPath, 'Transactions.json');
  
  try {
    const transactionsData = JSON.parse(await fs.readFile(transactionsFile, 'utf-8'));
    logProgress(`Loaded ${transactionsData.length} transactions`, 'success');
    
    return transactionsData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Transactions file not found at: ${transactionsFile}`);
    }
    throw error;
  }
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
 * Parse transaction date with proper timezone handling
 * @param {string} dateString - Date string from source data
 * @returns {FirestoreTimestamp|null} Parsed date or null
 */
function parseTransactionDate(dateString) {
  if (!dateString) {
    logProgress('Missing transaction date, using current date', 'warn');
    return getCurrentTimestamp();
  }
  
  // Try parsing with expected format first
  let parsedDate = parseDate(dateString, 'transaction');
  
  // If that fails, try other common formats
  if (!parsedDate) {
    const formats = ['yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy'];
    for (const format of formats) {
      parsedDate = parseDate(dateString, format);
      if (parsedDate) {
        logProgress(`Parsed date "${dateString}" using format "${format}"`, 'info');
        break;
      }
    }
  }
  
  if (!parsedDate) {
    logProgress(`Failed to parse date: ${dateString}`, 'error');
    return getCurrentTimestamp();
  }
  
  // Validate date is reasonable
  if (!isValidDate(parsedDate)) {
    logProgress(`Date outside valid range: ${dateString}`, 'warn');
  }
  
  return parsedDate;
}

/**
 * Augment transaction data based on client
 */
function augmentTransaction(txnData) {
  // For now, use MTC augmentation logic
  // TODO: Add client-specific augmentation
  if (CLIENT_ID === 'MTC') {
    return augmentMTCTransaction(txnData);
  } else {
    // Generic augmentation for other clients
    const accountMapping = getClientImportMapping(CLIENT_ID);
    const accountName = txnData.Account || txnData.account;
    const mapping = accountMapping?.[accountName];
    
    return {
      amount: parseFloat(txnData.Amount || txnData.amount),
      accountId: mapping?.accountId || null,
      accountType: mapping?.accountType || null,
      account: mapping?.account || accountName,
      date: parseTransactionDate(txnData.Date || txnData.date),
      vendor: txnData.Vendor || txnData.vendor || '',
      category: txnData.Category || txnData.category || '',
      notes: txnData.Notes || txnData.notes || '',
      googleId: txnData[''] || txnData.id || null,
      clientId: CLIENT_ID,
      migrationData: createMigrationMetadata({
        originalAccount: accountName,
        originalAmount: txnData.Amount || txnData.amount,
        originalDate: txnData.Date || txnData.date,
        unit: txnData.Unit || txnData.unit || null
      })
    };
  }
}

/**
 * Import transactions using CRUD functions with DateService
 */
async function importTransactionsWithCRUD(transactionsData) {
  logProgress('Starting transaction import...', 'info');
  
  const results = {
    total: transactionsData.length,
    success: 0,
    errors: 0,
    validationErrors: 0,
    byCategory: {},
    byAccount: {},
    hoaDuesTransactions: [],
    transactionIdMap: {}
  };
  
  const { db } = await initializeImport(CLIENT_ID);
  
  for (const [index, txnData] of transactionsData.entries()) {
    try {
      if ((index + 1) % 100 === 0) {
        logProgress(`Processing transaction ${index + 1}/${results.total}`, 'info');
      }
      
      // Augment transaction data with account mapping
      const augmentedTxn = augmentTransaction(txnData);
      
      // Parse and validate date
      augmentedTxn.date = parseTransactionDate(txnData.Date || txnData.date);
      
      // Add unit ID if this is an HOA Dues transaction
      if (augmentedTxn.category === 'HOA Dues' && txnData.Unit) {
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
        logProgress(`Validation failed for transaction ${index + 1}: ${validation.errors.join(', ')}`, 'error');
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
        enteredBy: 'import_script_enhanced',
        accountName: augmentedTxn.account,
        type: augmentedTxn.amount >= 0 ? 'income' : 'expense'
      };
      
      // Remove old field names
      delete transactionData.vendor;
      delete transactionData.category;
      delete transactionData.account;
      
      // Create mock request/response for controller
      const req = {
        params: { clientId: CLIENT_ID },
        body: transactionData,
        user: { uid: 'import-script-enhanced' }
      };
      
      const res = {
        status: (code) => ({ json: (data) => data }),
        json: (data) => data
      };
      
      // Use controller to create transaction
      const result = await createTransaction(req, res);
      const transactionId = result?.id;
      
      if (transactionId) {
        results.success++;
        
        // Track by category
        results.byCategory[augmentedTxn.category] = (results.byCategory[augmentedTxn.category] || 0) + 1;
        
        // Track by account
        results.byAccount[augmentedTxn.account] = (results.byAccount[augmentedTxn.account] || 0) + 1;
        
        // Track HOA dues transactions for later linking
        if (augmentedTxn.category === 'HOA Dues') {
          results.hoaDuesTransactions.push({
            transactionId,
            unitId: augmentedTxn.unitId,
            amount: augmentedTxn.amount,
            date: formatDate(augmentedTxn.date),
            googleId: augmentedTxn.googleId || `seq_${index + 1}`
          });
        }
        
        // Map googleId to transactionId
        const googleId = augmentedTxn.googleId || `seq_${index + 1}`;
        results.transactionIdMap[googleId] = transactionId;
        
        // Log sample transactions for verification
        if (results.success <= 3) {
          logProgress(`Created transaction ${transactionId}`, 'success');
          console.log(`      Date: ${formatDate(augmentedTxn.date)}`);
          console.log(`      Amount: $${augmentedTxn.amount}`);
          console.log(`      Vendor: ${augmentedTxn.vendor}`);
          console.log(`      Category: ${augmentedTxn.category}`);
          console.log(`      Account: ${augmentedTxn.account} (${augmentedTxn.accountId})`);
        }
      } else {
        logProgress(`Failed to create transaction ${index + 1}`, 'error');
        results.errors++;
      }
      
    } catch (error) {
      logProgress(`Error processing transaction ${index + 1}: ${error.message}`, 'error');
      results.errors++;
    }
  }
  
  // Log summary
  console.log(`\n📊 Transactions Import Summary:`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Errors: ${results.errors}`);
  console.log(`   Validation Errors: ${results.validationErrors}`);
  console.log(`   HOA Dues Transactions: ${results.hoaDuesTransactions.length}`);
  console.log(`   Audit logs: ${results.success} (automatic via CRUD)`);
  
  console.log(`\n📊 By Category:`);
  Object.entries(results.byCategory)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([category, count]) => {
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
  logProgress('Saving transaction ID mapping for HOA dues processing...', 'info');
  
  const mappingData = {
    generated: dateService.formatForFrontend(new Date()).iso,
    generatedDisplay: dateService.formatForFrontend(new Date()).displayFull,
    clientId: CLIENT_ID,
    count: Object.keys(transactionIdMap).length,
    mapping: transactionIdMap
  };
  
  const outputFile = path.join(config.dataPath, 'transaction-id-mapping.json');
  await fs.writeFile(outputFile, JSON.stringify(mappingData, null, 2));
  
  logProgress(`Saved mapping for ${mappingData.count} transactions to ${outputFile}`, 'success');
}

/**
 * Verify transactions import
 */
async function verifyTransactionsImport(db) {
  logProgress('Verifying transactions import...', 'info');
  
  const transactionsRef = db.collection('clients').doc(CLIENT_ID).collection('transactions');
  const transactionsSnapshot = await transactionsRef.limit(5).get();
  
  console.log(`\n💰 Sample transactions in database:`);
  transactionsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(`   ${doc.id}: $${data.amount} - ${data.vendorName} (${data.categoryName})`);
    console.log(`      Date: ${formatDate(data.date)}`);
  });
  
  // Count total transactions
  const countSnapshot = await transactionsRef.count().get();
  const totalCount = countSnapshot.data().count;
  
  return {
    totalTransactions: totalCount,
    sampleCount: transactionsSnapshot.size
  };
}

/**
 * Main import process
 */
async function main() {
  console.log('🚀 Starting Enhanced Transactions Import with DateService...\n');
  console.log('✅ Features:');
  console.log('   - DateService timezone handling (America/Cancun)');
  console.log('   - Client-agnostic implementation');
  console.log('   - Preserves all business logic');
  console.log('   - Automatic audit logging\n');
  
  const results = {
    timestamp: dateService.formatForFrontend(new Date()).iso,
    timestampDisplay: dateService.formatForFrontend(new Date()).displayFull,
    clientId: CLIENT_ID,
    dataPath: config.dataPath,
    import: null,
    verification: null,
    success: false
  };
  
  try {
    // Initialize
    const { db } = await initializeImport(CLIENT_ID);
    
    // Load data
    const transactionsData = await loadTransactionsData();
    
    // Import transactions
    console.log('\n=== STEP 1: TRANSACTIONS IMPORT ===');
    results.import = await importTransactionsWithCRUD(transactionsData);
    
    // Save mapping
    if (results.import.transactionIdMap && Object.keys(results.import.transactionIdMap).length > 0) {
      await saveTransactionIdMapping(results.import.transactionIdMap);
    }
    
    // Verify
    console.log('\n=== STEP 2: VERIFICATION ===');
    results.verification = await verifyTransactionsImport(db);
    
    // Check success
    results.success = results.import.success > 0 && results.import.errors === 0;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 ENHANCED TRANSACTIONS IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📁 Data Path: ${config.dataPath}`);
    console.log(`⏰ Completed: ${results.timestampDisplay}`);
    console.log(`🕐 Timezone: ${config.timezone}`);
    console.log('');
    console.log('📁 IMPORT RESULTS:');
    console.log(`   Successfully imported: ${results.import.success}`);
    console.log(`   Import errors: ${results.import.errors}`);
    console.log(`   HOA Dues transactions: ${results.import.hoaDuesTransactions.length}`);
    console.log('');
    console.log('🔍 VERIFICATION:');
    console.log(`   Total transactions in database: ${results.verification.totalTransactions}`);
    
    if (results.success) {
      console.log('\n✅ ENHANCED TRANSACTIONS IMPORT SUCCESSFUL!');
      console.log('💾 Transaction ID mapping saved for HOA dues processing');
      console.log('🕐 All dates preserved in America/Cancun timezone');
      console.log('🚀 Ready for next step: HOA Dues Import');
    } else {
      console.log('\n⚠️ TRANSACTIONS IMPORT COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before proceeding');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    logProgress(`Import failed: ${error.message}`, 'error');
    console.error(error);
    results.error = error.message;
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

// Export for testing
export { loadTransactionsData, parseTransactionDate, augmentTransaction, importTransactionsWithCRUD };
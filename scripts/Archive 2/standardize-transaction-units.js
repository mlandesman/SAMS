/**
 * standardize-unit-fields.js
 * 
 * Script to standardize unit field formats in the transactions collection
 * Extracts standard unit identifier from "Unit" or "unit" fields with formats like "PH4D (Landesman)"
 * Updates the unit field to contain just the unit ID (e.g., "PH4D")
 */

import { getDb, initializeFirebase } from '../backend/firebase.js';

// Initialize Firebase
console.log('🔥 Initializing Firebase Admin SDK...');
await initializeFirebase();
const db = await getDb();
console.log('✅ Firebase Admin SDK initialized');

/**
 * Extract standardized unitId from a unit string
 * @param {string} unitString - Unit string like "PH4D (Landesman)"
 * @returns {string} - Standardized unitId like "PH4D"
 */
function standardizeUnitId(unitString) {
  if (!unitString) return null;
  
  // Extract just the unit ID part (before the space and parenthesis)
  // E.g., "PH4D (Landesman)" -> "PH4D"
  const unitMatch = unitString.match(/^([A-Za-z0-9-]+)/);
  if (unitMatch && unitMatch[1]) {
    return unitMatch[1];
  }
  
  // Return as-is if no pattern match
  return unitString;
}

/**
 * Standardize unit fields in transactions collection
 * @param {string} clientId - Client ID
 * @returns {object} - Stats about update process
 */
async function standardizeTransactionUnits(clientId) {
  console.log(`\n🔧 Standardizing transaction unit fields for client ${clientId}...`);
  
  const stats = {
    transactionsProcessed: 0,
    transactionsUpdated: 0,
    errors: []
  };
  
  try {
    // Step 1: Fetch all transactions
    console.log('📊 Fetching all transactions...');
    const txnRef = db.collection(`clients/${clientId}/transactions`);
    const txnSnapshot = await txnRef.get();
    
    if (txnSnapshot.empty) {
      console.warn('⚠️ No transactions found');
      return { success: false, reason: 'no-transactions', stats };
    }
    
    console.log(`✅ Found ${txnSnapshot.size} transactions`);
    
    // Step 2: Process each transaction
    const batch = db.batch();
    let batchCount = 0;
    let batchSize = 0;
    const MAX_BATCH_SIZE = 500;
    
    for (const doc of txnSnapshot.docs) {
      stats.transactionsProcessed++;
      const txData = doc.data();
      
      // Check if this transaction has a unit field that needs standardizing
      let needsUpdate = false;
      let standardizedUnitId = null;
      
      // Handle Unit or unit field with parenthesis format extraction
      if (txData.Unit || txData.unit) {
        const unitField = txData.Unit || txData.unit || '';
        standardizedUnitId = standardizeUnitId(unitField);
        
        // Check if the standardized ID is different from what's already there
        if (standardizedUnitId && standardizedUnitId !== unitField) {
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        const txRef = db.doc(`clients/${clientId}/transactions/${doc.id}`);
        
        // Update unit field with standardized value
        batch.update(txRef, {
          unit: standardizedUnitId,
          // Add a flag to indicate this record was standardized
          unitStandardized: true,
          updatedAt: new Date()
        });
        
        stats.transactionsUpdated++;
        batchSize++;
        
        // If batch is full, commit it and start a new one
        if (batchSize >= MAX_BATCH_SIZE) {
          console.log(`📦 Committing batch ${++batchCount} with ${batchSize} updates...`);
          await batch.commit();
          batchSize = 0;
        }
      }
      
      // Progress logging
      if (stats.transactionsProcessed % 100 === 0) {
        console.log(`📊 Processed ${stats.transactionsProcessed} transactions, updated ${stats.transactionsUpdated} so far...`);
      }
    }
    
    // Commit any remaining updates in the batch
    if (batchSize > 0) {
      console.log(`📦 Committing final batch with ${batchSize} updates...`);
      await batch.commit();
    }
    
    // Final summary
    console.log('\n📊 Standardization Summary:');
    console.log(`✅ Transactions processed: ${stats.transactionsProcessed}`);
    console.log(`✅ Transactions updated: ${stats.transactionsUpdated}`);
    
    if (stats.errors.length > 0) {
      console.log(`⚠️ Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach(err => {
        console.log(`  - Transaction ${err.id}: ${err.error}`);
      });
    }
    
    return {
      success: true,
      stats
    };
  } catch (error) {
    console.error(`❌ Error standardizing transaction units:`, error);
    return {
      success: false,
      reason: 'exception',
      error: error.message,
      stats
    };
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Default values
  let clientId = 'MTC';
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--client=')) {
      clientId = args[i].split('=')[1];
    } else if (!args[i].startsWith('--')) {
      // First non-flag argument is the client ID
      clientId = args[i];
    }
  }
  
  // Show help if requested
  if (args.includes('--help')) {
    console.log(`
Unit Field Standardization Tool

Usage:
  node standardize-unit-fields.js [clientId] [options]
  
Arguments:
  clientId      Client ID (default: MTC)
  
Options:
  --client=ID   Specify client ID
  --help        Show this help message

Example:
  node standardize-unit-fields.js MTC
  node standardize-unit-fields.js --client=MTC
`);
    process.exit(0);
  }
  
  console.log(`🚀 Starting transaction unit standardization for client ${clientId}`);
  
  const result = await standardizeTransactionUnits(clientId);
  
  if (result.success) {
    console.log('\n✅ Transaction unit standardization completed successfully');
  } else {
    console.log(`\n❌ Transaction unit standardization failed: ${result.reason}`);
    if (result.error) {
      console.error(result.error);
    }
  }
}

// Run the main function
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

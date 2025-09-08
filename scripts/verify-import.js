#!/usr/bin/env node

/**
 * verify-import.js
 * Comprehensive verification script for imported data
 * Validates data against field specifications and checks data integrity
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { isValidTimestamp } from './utils/timestamp-converter.js';
import { fieldSpecs, validateCollectionData, validateDocumentId } from './utils/field-validator.js';
import fs from 'fs';

// Verification configuration
const VERIFY_CONFIG = {
  clientId: 'MTC', // Default client to verify
  collections: {
    clients: true,
    users: true,
    categories: true,
    vendors: true,
    accounts: true,
    units: true,
    transactions: true,
    hoaDues: true
  },
  detailed: false,
  exportReport: false,
  checkReferences: true
};

// Verification results
let verificationResults = {
  timestamp: new Date(),
  summary: {
    totalDocuments: 0,
    validDocuments: 0,
    invalidDocuments: 0,
    collections: {}
  },
  errors: [],
  warnings: [],
  referenceErrors: []
};

/**
 * Verifies client collection
 * @param {Object} db - Firestore instance
 * @param {string} clientId - Client ID to verify
 */
async function verifyClient(db, clientId) {
  console.log('\n🔍 Verifying Clients Collection...');
  
  const results = {
    total: 0,
    valid: 0,
    invalid: 0,
    errors: []
  };
  
  try {
    const doc = await db.collection('clients').doc(clientId).get();
    
    if (!doc.exists) {
      results.errors.push(`Client ${clientId} not found`);
      results.invalid = 1;
    } else {
      results.total = 1;
      const data = doc.data();
      
      try {
        // Validate document ID
        if (!validateDocumentId(clientId, 'clients')) {
          throw new Error(`Invalid document ID format: ${clientId}`);
        }
        
        // Validate data
        validateCollectionData(data, 'clients');
        
        // Check timestamp
        if (!isValidTimestamp(data.updated)) {
          throw new Error('Invalid or missing updated timestamp');
        }
        
        results.valid = 1;
      } catch (error) {
        results.invalid = 1;
        results.errors.push(error.message);
      }
    }
  } catch (error) {
    results.errors.push(`Failed to verify client: ${error.message}`);
  }
  
  verificationResults.summary.collections.clients = results;
  return results;
}

/**
 * Verifies users collection
 * @param {Object} db - Firestore instance
 * @param {string} clientId - Client ID for property access check
 */
async function verifyUsers(db, clientId) {
  console.log('\n🔍 Verifying Users Collection...');
  
  const results = {
    total: 0,
    valid: 0,
    invalid: 0,
    errors: [],
    warnings: []
  };
  
  try {
    const snapshot = await db.collection('users').get();
    results.total = snapshot.size;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Validate document ID (should be Firebase UID)
        if (!validateDocumentId(doc.id, 'users')) {
          results.warnings.push(`User ${doc.id} has non-standard document ID format`);
        }
        
        // Validate data
        validateCollectionData(data, 'users');
        
        // Check property access
        if (!data.propertyAccess[clientId] && !data.isSuperAdmin) {
          results.warnings.push(`User ${data.email} has no access to client ${clientId}`);
        }
        
        // Check SuperAdmin consistency
        if (data.isSuperAdmin) {
          const hasAdminForAll = Object.values(data.propertyAccess).every(access => access.isAdmin);
          if (!hasAdminForAll) {
            results.warnings.push(`SuperAdmin ${data.email} doesn't have admin access to all clients`);
          }
        }
        
        results.valid++;
      } catch (error) {
        results.invalid++;
        results.errors.push(`User ${doc.id}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`Failed to verify users: ${error.message}`);
  }
  
  verificationResults.summary.collections.users = results;
  return results;
}

/**
 * Verifies categories collection
 * @param {Object} db - Firestore instance
 * @param {string} clientId - Client ID
 */
async function verifyCategories(db, clientId) {
  console.log('\n🔍 Verifying Categories Collection...');
  
  const results = {
    total: 0,
    valid: 0,
    invalid: 0,
    errors: [],
    categoryIds: new Set() // For reference checking
  };
  
  try {
    const snapshot = await db.collection('clients').doc(clientId)
      .collection('categories').get();
    results.total = snapshot.size;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Validate data
        validateCollectionData(data, 'categories');
        
        // Check document ID matches categoryId
        if (doc.id !== data.categoryId) {
          results.errors.push(`Category document ID mismatch: ${doc.id} vs ${data.categoryId}`);
        }
        
        // Store for reference checking
        results.categoryIds.add(data.categoryName);
        
        results.valid++;
      } catch (error) {
        results.invalid++;
        results.errors.push(`Category ${doc.id}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`Failed to verify categories: ${error.message}`);
  }
  
  verificationResults.summary.collections.categories = results;
  return results;
}

/**
 * Verifies vendors collection
 * @param {Object} db - Firestore instance
 * @param {string} clientId - Client ID
 */
async function verifyVendors(db, clientId) {
  console.log('\n🔍 Verifying Vendors Collection...');
  
  const results = {
    total: 0,
    valid: 0,
    invalid: 0,
    errors: [],
    vendorIds: new Set() // For reference checking
  };
  
  try {
    const snapshot = await db.collection('clients').doc(clientId)
      .collection('vendors').get();
    results.total = snapshot.size;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Validate data
        validateCollectionData(data, 'vendors');
        
        // Check document ID matches vendorId
        if (doc.id !== data.vendorId) {
          results.errors.push(`Vendor document ID mismatch: ${doc.id} vs ${data.vendorId}`);
        }
        
        // Check deprecated fields
        if (data.categoryName) {
          results.errors.push(`Vendor ${data.vendorName} has deprecated categoryName field`);
        }
        
        // Store for reference checking
        results.vendorIds.add(data.vendorId);
        
        results.valid++;
      } catch (error) {
        results.invalid++;
        results.errors.push(`Vendor ${doc.id}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`Failed to verify vendors: ${error.message}`);
  }
  
  verificationResults.summary.collections.vendors = results;
  return results;
}

/**
 * Verifies transactions with reference checking
 * @param {Object} db - Firestore instance
 * @param {string} clientId - Client ID
 * @param {Object} references - Object with vendorIds and categoryIds Sets
 */
async function verifyTransactions(db, clientId, references) {
  console.log('\n🔍 Verifying Transactions Collection...');
  
  const results = {
    total: 0,
    valid: 0,
    invalid: 0,
    errors: [],
    warnings: []
  };
  
  try {
    // Sample verification - check recent transactions
    const snapshot = await db.collection('clients').doc(clientId)
      .collection('transactions')
      .orderBy('date', 'desc')
      .limit(100)
      .get();
    
    results.total = snapshot.size;
    
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Validate document ID format
        if (!validateDocumentId(doc.id, 'transactions')) {
          results.errors.push(`Invalid transaction ID format: ${doc.id}`);
        }
        
        // Validate data
        validateCollectionData(data, 'transactions');
        
        // Reference checks
        if (VERIFY_CONFIG.checkReferences && references) {
          if (references.vendorIds && !references.vendorIds.has(data.vendorId)) {
            results.warnings.push(`Transaction ${doc.id} references non-existent vendor: ${data.vendorId}`);
          }
          
          if (references.categoryIds && data.categoryName && !references.categoryIds.has(data.categoryName)) {
            results.warnings.push(`Transaction ${doc.id} references non-existent category: ${data.categoryName}`);
          }
        }
        
        // Check HOA dues specific fields
        if (data.categoryName === 'HOA Dues' && !data.duesDistribution) {
          results.errors.push(`Transaction ${doc.id} is HOA Dues but missing duesDistribution`);
        }
        
        results.valid++;
      } catch (error) {
        results.invalid++;
        results.errors.push(`Transaction ${doc.id}: ${error.message}`);
      }
    }
    
    console.log(`   Note: Verified ${results.total} recent transactions (sample)`);
  } catch (error) {
    results.errors.push(`Failed to verify transactions: ${error.message}`);
  }
  
  verificationResults.summary.collections.transactions = results;
  return results;
}

/**
 * Generates summary report
 */
function generateSummaryReport() {
  console.log('\n📊 Verification Summary Report');
  console.log('=============================\n');
  
  // Create summary table header
  console.log('Collection     | Total | Valid | Invalid | Errors | Warnings');
  console.log('---------------|-------|-------|---------|--------|----------');
  
  let totalDocs = 0;
  let totalValid = 0;
  let totalInvalid = 0;
  
  Object.entries(verificationResults.summary.collections).forEach(([collection, results]) => {
    if (results.total > 0) {
      const row = [
        collection.padEnd(14),
        results.total.toString().padEnd(6),
        results.valid.toString().padEnd(6),
        results.invalid.toString().padEnd(8),
        results.errors.length.toString().padEnd(7),
        (results.warnings ? results.warnings.length : 0).toString()
      ];
      console.log(row.join(' | '));
      
      totalDocs += results.total;
      totalValid += results.valid;
      totalInvalid += results.invalid;
    }
  });
  
  console.log('---------------|-------|-------|---------|--------|----------');
  
  // Overall summary
  console.log(`\nTotal Documents: ${totalDocs}`);
  console.log(`Valid: ${totalValid} (${(totalValid/totalDocs*100).toFixed(1)}%)`);
  console.log(`Invalid: ${totalInvalid} (${(totalInvalid/totalDocs*100).toFixed(1)}%)`);
  
  // Show errors if any
  if (verificationResults.errors.length > 0) {
    console.log('\n❌ Global Errors:');
    verificationResults.errors.forEach(error => {
      console.log(`   - ${error}`);
    });
  }
  
  // Show detailed errors if requested
  if (VERIFY_CONFIG.detailed) {
    Object.entries(verificationResults.summary.collections).forEach(([collection, results]) => {
      if (results.errors && results.errors.length > 0) {
        console.log(`\n❌ ${collection} Errors:`);
        results.errors.slice(0, 10).forEach(error => {
          console.log(`   - ${error}`);
        });
        if (results.errors.length > 10) {
          console.log(`   ... and ${results.errors.length - 10} more`);
        }
      }
      
      if (results.warnings && results.warnings.length > 0) {
        console.log(`\n⚠️  ${collection} Warnings:`);
        results.warnings.slice(0, 10).forEach(warning => {
          console.log(`   - ${warning}`);
        });
        if (results.warnings.length > 10) {
          console.log(`   ... and ${results.warnings.length - 10} more`);
        }
      }
    });
  }
}

/**
 * Main verification function
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const env = args[0] || 'dev';
    
    if (args.includes('--detailed')) {
      VERIFY_CONFIG.detailed = true;
    }
    
    if (args.includes('--client')) {
      const clientIndex = args.indexOf('--client');
      if (args[clientIndex + 1]) {
        VERIFY_CONFIG.clientId = args[clientIndex + 1];
      }
    }
    
    // Print environment info
    printEnvironmentInfo(env);
    
    // Initialize Firebase
    const { db } = initializeFirebase(env);
    
    console.log(`\n🔍 Starting data verification for client: ${VERIFY_CONFIG.clientId}`);
    console.log(`   Timestamp: ${verificationResults.timestamp.toISOString()}`);
    
    // Verify collections in sequence
    const clientResults = await verifyClient(db, VERIFY_CONFIG.clientId);
    
    if (clientResults.valid === 0) {
      console.log('\n❌ Client not found. Cannot proceed with verification.');
      return;
    }
    
    // Verify other collections
    await verifyUsers(db, VERIFY_CONFIG.clientId);
    
    const categoryResults = await verifyCategories(db, VERIFY_CONFIG.clientId);
    const vendorResults = await verifyVendors(db, VERIFY_CONFIG.clientId);
    
    // Verify transactions with references
    const references = {
      vendorIds: vendorResults.vendorIds,
      categoryIds: categoryResults.categoryIds
    };
    await verifyTransactions(db, VERIFY_CONFIG.clientId, references);
    
    // TODO: Add verification for remaining collections (accounts, units, hoaDues)
    
    // Generate summary report
    generateSummaryReport();
    
    // Export report if requested
    if (VERIFY_CONFIG.exportReport) {
      const reportPath = `./verification-report-${VERIFY_CONFIG.clientId}-${Date.now()}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(verificationResults, null, 2));
      console.log(`\n📄 Detailed report exported to: ${reportPath}`);
    }
    
    console.log('\n✅ Verification completed');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, VERIFY_CONFIG };
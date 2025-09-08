/**
 * Selective MTC Data Purge Script - Phase 2
 * 
 * Safely deletes collections that need to be reimported
 * Preserves critical data (config, yearEndBalances, accounts)
 * 
 * Task ID: MTC-MIGRATION-001
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

const CLIENT_ID = 'MTC';

// Collections to DELETE (will be reimported)
const COLLECTIONS_TO_PURGE = [
  'transactions',
  'projects', 
  'units',
  'vendors',
  'categories',
  'documents',
  'paymentMethods'
];

// Collections to PRESERVE (keep existing data)
const COLLECTIONS_TO_PRESERVE = [
  'config',
  'yearEndBalances'
];

/**
 * Delete all documents in a collection
 */
async function purgeCollection(db, clientId, collectionName) {
  try {
    console.log(`🗑️ Purging ${collectionName}...`);
    
    const collectionRef = db.collection('clients').doc(clientId).collection(collectionName);
    
    // Get all documents
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log(`   Empty collection - nothing to purge`);
      return { documentCount: 0, deleted: 0 };
    }
    
    console.log(`   Found ${snapshot.size} documents to delete`);
    
    // Delete in batches (Firestore limit is 500 operations per batch)
    const batchSize = 500;
    let deletedCount = 0;
    
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);
      
      batchDocs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      deletedCount += batchDocs.length;
      
      console.log(`   Deleted ${deletedCount}/${snapshot.size} documents`);
    }
    
    console.log(`✅ ${collectionName}: Deleted ${deletedCount} documents`);
    
    return {
      documentCount: snapshot.size,
      deleted: deletedCount,
      success: true
    };
    
  } catch (error) {
    console.error(`❌ Failed to purge ${collectionName}:`, error);
    return {
      documentCount: 0,
      deleted: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Verify collection is empty after purge
 */
async function verifyPurge(db, clientId, collectionName) {
  try {
    const collectionRef = db.collection('clients').doc(clientId).collection(collectionName);
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log(`✅ ${collectionName}: Verified empty`);
      return true;
    } else {
      console.warn(`⚠️ ${collectionName}: Still contains ${snapshot.size} documents`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to verify ${collectionName}:`, error);
    return false;
  }
}

/**
 * Verify preserved collections still exist
 */
async function verifyPreserved(db, clientId) {
  console.log('\n🔒 Verifying preserved data...');
  
  // Check client document still exists with accounts
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (clientDoc.exists) {
    const data = clientDoc.data();
    const accountCount = data.accounts?.length || 0;
    console.log(`✅ Client document exists with ${accountCount} accounts`);
  } else {
    console.error('❌ Client document missing!');
    return false;
  }
  
  // Check preserved collections
  for (const collection of COLLECTIONS_TO_PRESERVE) {
    try {
      const collectionRef = db.collection('clients').doc(clientId).collection(collection);
      const snapshot = await collectionRef.get();
      console.log(`✅ ${collection}: ${snapshot.size} documents preserved`);
    } catch (error) {
      console.warn(`⚠️ ${collection}: Could not verify (may not exist)`);
    }
  }
  
  return true;
}

/**
 * Test system functionality after purge
 */
async function testSystemAfterPurge(db, clientId) {
  console.log('\n🧪 Testing system functionality...');
  
  try {
    // Test: Can we still access the client?
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error('Client document not accessible');
    }
    
    console.log('✅ Client document accessible');
    
    // Test: Can we write to a purged collection?
    const testRef = db.collection('clients').doc(clientId).collection('transactions').doc('test-doc');
    await testRef.set({ 
      test: true, 
      timestamp: new Date().toISOString(),
      purpose: 'purge-validation-test'
    });
    
    console.log('✅ Can write to purged collections');
    
    // Clean up test document
    await testRef.delete();
    console.log('✅ Test cleanup completed');
    
    return true;
    
  } catch (error) {
    console.error('❌ System functionality test failed:', error);
    return false;
  }
}

/**
 * Main purge function
 */
async function performPurge() {
  console.log('🚀 Starting selective MTC data purge...\n');
  
  const purgeResults = {
    timestamp: new Date().toISOString(),
    clientId: CLIENT_ID,
    collections: {},
    summary: {
      totalCollectionsPurged: 0,
      totalDocumentsDeleted: 0,
      allPurgesSuccessful: true,
      systemFunctional: false
    }
  };
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    console.log(`🎯 Target: ${CLIENT_ID} client`);
    console.log(`🗑️ Collections to purge: ${COLLECTIONS_TO_PURGE.join(', ')}`);
    console.log(`🔒 Collections to preserve: ${COLLECTIONS_TO_PRESERVE.join(', ')}`);
    console.log('');
    
    // Purge each collection
    for (const collection of COLLECTIONS_TO_PURGE) {
      const result = await purgeCollection(db, CLIENT_ID, collection);
      purgeResults.collections[collection] = result;
      
      if (result.success) {
        purgeResults.summary.totalCollectionsPurged++;
        purgeResults.summary.totalDocumentsDeleted += result.deleted;
      } else {
        purgeResults.summary.allPurgesSuccessful = false;
      }
    }
    
    // Verify purges completed
    console.log('\n🔍 Verifying purge completion...');
    for (const collection of COLLECTIONS_TO_PURGE) {
      await verifyPurge(db, CLIENT_ID, collection);
    }
    
    // Verify preserved data
    const preservedOk = await verifyPreserved(db, CLIENT_ID);
    
    // Test system functionality
    const systemOk = await testSystemAfterPurge(db, CLIENT_ID);
    purgeResults.summary.systemFunctional = systemOk;
    
    // Generate summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 PURGE SUMMARY');
    console.log('='.repeat(60));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`🗑️ Collections purged: ${purgeResults.summary.totalCollectionsPurged}/${COLLECTIONS_TO_PURGE.length}`);
    console.log(`📄 Documents deleted: ${purgeResults.summary.totalDocumentsDeleted}`);
    console.log(`✅ All purges successful: ${purgeResults.summary.allPurgesSuccessful}`);
    console.log(`🔒 Preserved data intact: ${preservedOk}`);
    console.log(`🧪 System functional: ${systemOk}`);
    
    // Individual collection results
    console.log('\n📊 Collection Details:');
    Object.entries(purgeResults.collections).forEach(([name, result]) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${name}: ${result.deleted}/${result.documentCount} deleted`);
    });
    
    if (purgeResults.summary.allPurgesSuccessful && preservedOk && systemOk) {
      console.log('\n✅ Purge completed successfully!');
      console.log('🚀 Ready for data import phase');
      return purgeResults;
    } else {
      throw new Error('Purge completed with issues - check results above');
    }
    
  } catch (error) {
    console.error('\n💥 Purge failed:', error);
    purgeResults.summary.error = error.message;
    throw error;
  }
}

// Execute
performPurge()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
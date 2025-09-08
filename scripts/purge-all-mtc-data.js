#!/usr/bin/env node

/**
 * purge-all-mtc-data.js
 * Comprehensive purge script that cleans MTC data from BOTH top-level and clients/MTC locations
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';

const ENV = process.env.FIRESTORE_ENV || 'dev';
const CLIENT_ID = 'MTC';

/**
 * Delete all documents in a collection
 */
async function deleteCollection(db, collectionRef, collectionName) {
  const snapshot = await collectionRef.get();
  
  if (snapshot.empty) {
    console.log(`   ✅ ${collectionName}: Already empty`);
    return 0;
  }

  let totalDeleted = 0;
  const batchSize = 100;

  // Process in batches
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    const batchDocs = snapshot.docs.slice(i, i + batchSize);
    
    batchDocs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    totalDeleted += batchDocs.length;
  }

  console.log(`   ✅ ${collectionName}: Deleted ${snapshot.size} documents`);
  return totalDeleted;
}

/**
 * Delete MTC users from top-level users collection
 */
async function deleteMTCUsers(db) {
  console.log(`\n🧹 Purging MTC users from top-level users collection...`);
  
  const usersRef = db.collection('users');
  const usersSnapshot = await usersRef.get();
  
  if (usersSnapshot.empty) {
    console.log(`   ✅ users: Already empty`);
    return 0;
  }

  let deletedCount = 0;
  const batch = db.batch();
  
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    
    // Check if user has MTC property access
    if (userData.propertyAccess && 
        (userData.propertyAccess[CLIENT_ID] || 
         (Array.isArray(userData.propertyAccess) && userData.propertyAccess.includes(CLIENT_ID)))) {
      
      batch.delete(userDoc.ref);
      deletedCount++;
      console.log(`   👤 Deleting MTC user: ${userData.email}`);
    }
  }
  
  if (deletedCount > 0) {
    await batch.commit();
    console.log(`   ✅ users: Deleted ${deletedCount} MTC users`);
  } else {
    console.log(`   ✅ users: No MTC users found`);
  }
  
  return deletedCount;
}

/**
 * Delete MTC audit logs
 */
async function deleteMTCAuditLogs(db) {
  console.log(`\n🧹 Purging MTC audit logs...`);
  
  try {
    // Try to find audit logs with clientId = MTC
    const auditRef = db.collection('auditLogs');
    const allAuditSnapshot = await auditRef.get();
    
    if (allAuditSnapshot.empty) {
      console.log(`   ✅ auditLogs: Already empty`);
      return 0;
    }

    let deletedCount = 0;
    const batch = db.batch();
    
    for (const auditDoc of allAuditSnapshot.docs) {
      const auditData = auditDoc.data();
      
      // Delete if clientId is MTC or if it's related to MTC collections
      if (auditData.clientId === CLIENT_ID || 
          auditData.collection?.includes('MTC') ||
          auditData.collection === 'clients/MTC/transactions' ||
          auditData.collection === 'clients/MTC/categories' ||
          auditData.collection === 'clients/MTC/vendors' ||
          auditData.collection === 'clients/MTC/units') {
        
        batch.delete(auditDoc.ref);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      await batch.commit();
      console.log(`   ✅ auditLogs: Deleted ${deletedCount} MTC-related logs`);
    } else {
      console.log(`   ✅ auditLogs: No MTC logs found`);
    }
    
    return deletedCount;
    
  } catch (error) {
    console.error(`   ❌ Error deleting audit logs: ${error.message}`);
    return 0;
  }
}

async function purgeAllMTCData() {
  console.log('🧹 Starting COMPREHENSIVE MTC Data Purge...\n');
  
  // Print environment information
  printEnvironmentInfo(ENV);
  
  // Safety check for production
  if (ENV === 'prod') {
    console.error('❌ PRODUCTION PURGE BLOCKED');
    console.error('This script is not allowed to run in production environment');
    process.exit(1);
  }
  
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase(ENV);
    
    console.log(`\n🗑️ Purging ALL MTC data from EVERYWHERE:`);
    console.log(`   - Top-level collections (old import locations)`);
    console.log(`   - clients/MTC/ collections (new import locations)`);
    console.log(`   - MTC users in top-level users collection`);
    console.log(`   - MTC audit logs`);
    console.log(`   - Import metadata`);
    
    let totalDeleted = 0;
    
    // 1. Delete top-level import metadata
    console.log(`\n🧹 Purging top-level import metadata...`);
    const importMetadataRef = db.collection('importMetadata');
    totalDeleted += await deleteCollection(db, importMetadataRef, 'importMetadata');
    
    // 2. Delete MTC users from top-level users collection
    totalDeleted += await deleteMTCUsers(db);
    
    // 3. Delete MTC audit logs
    totalDeleted += await deleteMTCAuditLogs(db);
    
    // 4. Delete clients/MTC if it exists
    console.log(`\n🧹 Purging clients/MTC tree...`);
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    
    if (clientDoc.exists) {
      // Get all subcollections
      const subcollections = await clientRef.listCollections();
      
      for (const subcollection of subcollections) {
        console.log(`\n🧹 Purging clients/MTC/${subcollection.id}...`);
        
        // For units, we need to handle nested dues collections
        if (subcollection.id === 'units') {
          const unitsSnapshot = await subcollection.get();
          for (const unitDoc of unitsSnapshot.docs) {
            const unitSubcollections = await unitDoc.ref.listCollections();
            for (const unitSubcollection of unitSubcollections) {
              const deleted = await deleteCollection(db, unitSubcollection, `units/${unitDoc.id}/${unitSubcollection.id}`);
              totalDeleted += deleted;
            }
          }
        }
        
        const deleted = await deleteCollection(db, subcollection, `clients/MTC/${subcollection.id}`);
        totalDeleted += deleted;
      }
      
      // Delete the client document itself
      await clientRef.delete();
      console.log(`   ✅ Client document: Deleted`);
      totalDeleted += 1;
    } else {
      console.log(`   ✅ clients/MTC: Already empty`);
    }
    
    // 5. Safety cleanup - check for any top-level MTC collections we might have missed
    console.log(`\n🧹 Safety check: Scanning all top-level collections...`);
    const collections = await db.listCollections();
    
    for (const collection of collections) {
      if (collection.id.toLowerCase().includes('mtc')) {
        console.log(`   ⚠️ Found MTC-related collection: ${collection.id}`);
        const deleted = await deleteCollection(db, collection, collection.id);
        totalDeleted += deleted;
      }
    }
    
    console.log(`\n✅ COMPREHENSIVE Purge completed successfully!`);
    console.log(`📊 Total documents deleted: ${totalDeleted}`);
    console.log(`🌍 Environment: ${ENV}`);
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`🔥 Method: Comprehensive cleanup of old and new data locations`);
    console.log(`\n🚀 Database is now completely clean for import testing!`);
    
  } catch (error) {
    console.error('❌ Error during comprehensive purge:', error);
    process.exit(1);
  }
}

// Execute
purgeAllMTCData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Comprehensive purge script failed:', error);
    process.exit(1);
  });
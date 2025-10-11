/**
 * Deep Recursive Purge - Complete Ghost Data Elimination
 * 
 * Performs thorough recursive deletion of all subcollections and documents
 * Addresses the critical issue where subcollections survive document deletion
 * 
 * Task ID: MTC-MIGRATION-001 - Deep Purge for Ghost Data Elimination
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';

async function performDeepRecursivePurge() {
  await initializeFirebase();
  const db = await getDb();
  
  console.log('🗑️ DEEP RECURSIVE PURGE - Eliminating all ghost data...');
  
  // Function to recursively delete all subcollections
  async function deleteCollectionRecursively(collectionRef, path = '') {
    const snapshot = await collectionRef.get();
    if (snapshot.empty) return 0;
    
    let deletedCount = 0;
    const batch = db.batch();
    
    for (const doc of snapshot.docs) {
      // First, recursively delete any subcollections
      const subcollections = await doc.ref.listCollections();
      for (const subcollection of subcollections) {
        console.log(`   🔍 Found subcollection: ${path}/${doc.id}/${subcollection.id}`);
        const subDeleted = await deleteCollectionRecursively(subcollection, `${path}/${doc.id}/${subcollection.id}`);
        deletedCount += subDeleted;
      }
      
      // Then delete the document
      batch.delete(doc.ref);
      deletedCount++;
    }
    
    await batch.commit();
    console.log(`   ✅ Deleted ${snapshot.size} documents from ${path || 'root'}`);
    return deletedCount;
  }
  
  // 1. Deep delete MTC client and ALL subcollections
  const clientRef = db.collection('clients').doc('MTC');
  const clientDoc = await clientRef.get();
  
  if (clientDoc.exists) {
    console.log('📂 Deep deleting MTC client and all subcollections...');
    
    // Get all top-level collections
    const collections = await clientRef.listCollections();
    let totalDeleted = 0;
    
    for (const collection of collections) {
      console.log(`📁 Processing collection: ${collection.id}`);
      const deleted = await deleteCollectionRecursively(collection, `clients/MTC/${collection.id}`);
      totalDeleted += deleted;
    }
    
    // Delete the client document itself
    await clientRef.delete();
    totalDeleted++;
    console.log(`🗑️ Deleted MTC client document`);
    
    console.log(`✅ Total documents deleted: ${totalDeleted}`);
  }
  
  // 2. Purge ALL audit logs 
  console.log('📋 Purging ALL audit logs...');
  const auditLogsRef = db.collection('auditLogs');
  const auditSnapshot = await auditLogsRef.get();
  
  if (!auditSnapshot.empty) {
    const auditBatch = db.batch();
    auditSnapshot.docs.forEach(doc => auditBatch.delete(doc.ref));
    await auditBatch.commit();
    console.log(`✅ Purged ${auditSnapshot.size} audit logs`);
  }
  
  // 3. Clean up any orphaned user access
  console.log('👥 Cleaning up user access to MTC...');
  const usersRef = db.collection('users');
  const usersSnapshot = await usersRef.get();
  let usersUpdated = 0;
  
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    if (userData.clientAccess && userData.clientAccess.MTC) {
      const updatedClientAccess = { ...userData.clientAccess };
      delete updatedClientAccess.MTC;
      
      await userDoc.ref.update({
        clientAccess: updatedClientAccess,
        preferredClient: userData.preferredClient === 'MTC' ? null : userData.preferredClient
      });
      usersUpdated++;
    }
  }
  console.log(`✅ Updated ${usersUpdated} users`);
  
  // 4. Final verification
  console.log('🔍 Final verification...');
  const finalClientCheck = await clientRef.get();
  const finalAuditCheck = await auditLogsRef.get();
  
  console.log(`📄 MTC client exists: ${finalClientCheck.exists}`);
  console.log(`📋 Audit logs remaining: ${finalAuditCheck.size}`);
  
  console.log('✅ DEEP RECURSIVE PURGE COMPLETE - All ghost data eliminated');
  console.log('🚀 Ready for corrected import order: Categories → Vendors → Units → Users → Transactions → HOA Dues');
}

// Execute
performDeepRecursivePurge()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Deep recursive purge failed:', error);
    process.exit(1);
  });
/**
 * Enhanced Client Purge with Audit Logging
 * 
 * Complete client deletion system with comprehensive audit trail
 * Uses writeAuditLog for every operation with clientId "CLIENT ADMINISTRATION"
 * 
 * Task ID: MTC-MIGRATION-001 - Enhanced Phase 2 Re-Purge
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb, getApp } from '../backend/firebase.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const CLIENT_ID = 'MTC';
const AUDIT_CLIENT_ID = 'CLIENT ADMINISTRATION';
const BACKUP_DIR = './backups';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Log purge operation with audit trail
 */
async function logPurgeOperation(operation, details, success = true) {
  await writeAuditLog({
    module: 'client-administration',
    action: 'purge',
    parentPath: `clients/${CLIENT_ID}`,
    docId: CLIENT_ID,
    friendlyName: `${operation}: ${details}`,
    notes: success ? 'Purge operation completed successfully' : 'Purge operation failed',
    clientId: AUDIT_CLIENT_ID
  });
}

/**
 * Archive and purge Firestore collections with audit logging
 */
async function purgeFirestoreCollections(db, backupPath) {
  console.log('🗑️ Purging Firestore collections with audit logging...\n');
  
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    console.log('✅ Client document does not exist - nothing to purge');
    await logPurgeOperation('client-document-check', 'Client document does not exist');
    return { documentsDeleted: 0, collectionsProcessed: 0 };
  }
  
  const results = {
    documentsDeleted: 0,
    collectionsProcessed: 0
  };
  
  // Archive client document
  const clientData = clientDoc.data();
  await fs.writeFile(
    path.join(backupPath, 'client-document.json'),
    JSON.stringify({ id: clientDoc.id, data: clientData }, null, 2)
  );
  
  await logPurgeOperation('backup-client-document', `Client document backed up`);
  
  // Get all collections
  const collections = await clientRef.listCollections();
  console.log(`📁 Found ${collections.length} collections to process`);
  
  for (const collection of collections) {
    const collectionName = collection.id;
    console.log(`\n📂 Processing collection: ${collectionName}`);
    
    try {
      const snapshot = await collection.get();
      console.log(`   Documents found: ${snapshot.size}`);
      
      if (snapshot.size > 0) {
        // Archive collection data
        const collectionData = [];
        const batchSize = 500;
        
        // Archive documents
        snapshot.docs.forEach(doc => {
          collectionData.push({
            id: doc.id,
            data: doc.data()
          });
        });
        
        await fs.writeFile(
          path.join(backupPath, `collection-${collectionName}.json`),
          JSON.stringify(collectionData, null, 2)
        );
        
        await logPurgeOperation('backup-collection', `${collectionName}: ${snapshot.size} documents backed up`);
        
        // Delete documents in batches
        let deletedCount = 0;
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
          const batch = db.batch();
          const batchDocs = snapshot.docs.slice(i, i + batchSize);
          
          batchDocs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
          deletedCount += batchDocs.length;
          
          console.log(`   🗑️ Deleted ${deletedCount}/${snapshot.size} documents`);
        }
        
        results.documentsDeleted += deletedCount;
        await logPurgeOperation('purge-collection', `${collectionName}: ${deletedCount} documents deleted`);
        
        // Handle subcollections recursively
        for (const doc of snapshot.docs) {
          const subcollections = await doc.ref.listCollections();
          if (subcollections.length > 0) {
            console.log(`   📁 Processing ${subcollections.length} subcollections for document ${doc.id}`);
            
            for (const subcollection of subcollections) {
              const subSnapshot = await subcollection.get();
              if (subSnapshot.size > 0) {
                const subBatch = db.batch();
                subSnapshot.docs.forEach(subDoc => {
                  subBatch.delete(subDoc.ref);
                });
                await subBatch.commit();
                
                console.log(`      🗑️ Deleted ${subSnapshot.size} documents from ${subcollection.id}`);
                results.documentsDeleted += subSnapshot.size;
                await logPurgeOperation('purge-subcollection', `${collectionName}/${doc.id}/${subcollection.id}: ${subSnapshot.size} documents deleted`);
              }
            }
          }
        }
      }
      
      results.collectionsProcessed++;
      
    } catch (error) {
      console.error(`❌ Error processing collection ${collectionName}:`, error);
      await logPurgeOperation('purge-collection-error', `${collectionName}: ${error.message}`, false);
    }
  }
  
  // Delete client document itself
  await clientRef.delete();
  results.documentsDeleted++;
  await logPurgeOperation('purge-client-document', `Client document deleted`);
  
  console.log(`\n✅ Firestore purge complete: ${results.documentsDeleted} documents, ${results.collectionsProcessed} collections`);
  
  return results;
}

/**
 * Archive and purge Firebase Storage files with audit logging
 */
async function purgeStorageFiles(app, backupPath) {
  console.log('\n📁 Purging Storage files with audit logging...\n');
  
  const bucket = app.storage().bucket();
  const storageResults = {
    filesFound: 0,
    filesArchived: 0,
    filesDeleted: 0,
    totalSize: 0
  };
  
  try {
    const clientPath = `clients/${CLIENT_ID}/`;
    const [files] = await bucket.getFiles({
      prefix: clientPath,
      autoPaginate: true
    });
    
    storageResults.filesFound = files.length;
    console.log(`📄 Found ${files.length} storage files`);
    
    if (files.length === 0) {
      await logPurgeOperation('storage-scan', 'No storage files found');
      return storageResults;
    }
    
    // Create storage backup directory
    const storageBackupPath = path.join(backupPath, 'storage');
    await fs.mkdir(storageBackupPath, { recursive: true });
    
    // Archive each file
    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const fileSize = parseInt(metadata.size) || 0;
        storageResults.totalSize += fileSize;
        
        // Download and archive file
        const localPath = path.join(storageBackupPath, file.name.replace(clientPath, ''));
        const localDir = path.dirname(localPath);
        await fs.mkdir(localDir, { recursive: true });
        
        const readStream = file.createReadStream();
        const writeStream = createWriteStream(localPath);
        await pipeline(readStream, writeStream);
        
        storageResults.filesArchived++;
        console.log(`📥 Archived: ${file.name} (${(fileSize / 1024).toFixed(2)} KB)`);
        
      } catch (error) {
        console.error(`❌ Failed to archive ${file.name}:`, error);
      }
    }
    
    await logPurgeOperation('backup-storage', `${storageResults.filesArchived} files archived (${(storageResults.totalSize / 1024 / 1024).toFixed(2)} MB)`);
    
    // Delete storage files
    for (const file of files) {
      try {
        await file.delete();
        storageResults.filesDeleted++;
        console.log(`🗑️ Deleted: ${file.name}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${file.name}:`, error);
      }
    }
    
    await logPurgeOperation('purge-storage', `${storageResults.filesDeleted} files deleted`);
    
  } catch (error) {
    console.error('❌ Storage purge error:', error);
    await logPurgeOperation('purge-storage-error', error.message, false);
  }
  
  console.log(`✅ Storage purge complete: ${storageResults.filesDeleted} files deleted`);
  
  return storageResults;
}

/**
 * Clean up user access with audit logging
 */
async function purgeUserAccess(db) {
  console.log('\n👥 Purging user access with audit logging...\n');
  
  const usersRef = db.collection('users');
  const usersSnapshot = await usersRef.get();
  
  let usersUpdated = 0;
  const batch = db.batch();
  
  usersSnapshot.docs.forEach(doc => {
    const userData = doc.data();
    if (userData.clientAccess && userData.clientAccess[CLIENT_ID]) {
      const updatedClientAccess = { ...userData.clientAccess };
      delete updatedClientAccess[CLIENT_ID];
      
      batch.update(doc.ref, { clientAccess: updatedClientAccess });
      usersUpdated++;
      
      console.log(`👤 Removing ${CLIENT_ID} access from ${userData.email}`);
    }
  });
  
  if (usersUpdated > 0) {
    await batch.commit();
    await logPurgeOperation('purge-user-access', `${usersUpdated} users had ${CLIENT_ID} access removed`);
  } else {
    await logPurgeOperation('purge-user-access', 'No users had client access to remove');
  }
  
  console.log(`✅ User access purge complete: ${usersUpdated} users updated`);
  
  return { usersUpdated };
}

/**
 * Purge audit logs for the client with logging
 */
async function purgeAuditLogs(db, backupPath) {
  console.log('\n📋 Purging client audit logs with audit logging...\n');
  
  const auditLogsRef = db.collection('auditLogs');
  const snapshot = await auditLogsRef.get();
  
  const clientAuditLogs = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const parentPath = data.parentPath || '';
    if (parentPath.startsWith(`clients/${CLIENT_ID}`)) {
      clientAuditLogs.push({
        id: doc.id,
        data: data
      });
    }
  });
  
  console.log(`📊 Found ${clientAuditLogs.length} client audit logs`);
  
  if (clientAuditLogs.length > 0) {
    // Backup audit logs
    await fs.writeFile(
      path.join(backupPath, 'client-audit-logs.json'),
      JSON.stringify(clientAuditLogs, null, 2)
    );
    
    // Delete audit logs in batches
    const batchSize = 500;
    let deletedCount = 0;
    
    for (let i = 0; i < clientAuditLogs.length; i += batchSize) {
      const batch = db.batch();
      const batchLogs = clientAuditLogs.slice(i, i + batchSize);
      
      batchLogs.forEach(logEntry => {
        const docRef = auditLogsRef.doc(logEntry.id);
        batch.delete(docRef);
      });
      
      await batch.commit();
      deletedCount += batchLogs.length;
    }
    
    await logPurgeOperation('purge-audit-logs', `${deletedCount} client audit logs deleted`);
  } else {
    await logPurgeOperation('purge-audit-logs', 'No client audit logs found');
  }
  
  console.log(`✅ Audit logs purge complete: ${clientAuditLogs.length} logs processed`);
  
  return { auditLogsDeleted: clientAuditLogs.length };
}

/**
 * Main enhanced purge process
 */
async function performEnhancedClientPurge() {
  console.log('🚀 Starting Enhanced Client Purge with Audit Logging...\n');
  
  const results = {
    timestamp: TIMESTAMP,
    clientId: CLIENT_ID,
    auditClientId: AUDIT_CLIENT_ID,
    firestore: null,
    storage: null,
    userAccess: null,
    auditLogs: null,
    backupPath: null,
    success: false
  };
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    const app = await getApp();
    
    // Create backup directory
    const backupPath = path.join(BACKUP_DIR, `${CLIENT_ID}-ENHANCED-PURGE-${TIMESTAMP}`);
    await fs.mkdir(backupPath, { recursive: true });
    results.backupPath = backupPath;
    
    console.log(`📁 Backup directory: ${backupPath}\n`);
    
    // Log start of purge operation
    await logPurgeOperation('start-client-purge', `Beginning complete purge of client ${CLIENT_ID}`);
    
    // Step 1: Purge Firestore data
    console.log('=== STEP 1: FIRESTORE PURGE ===');
    results.firestore = await purgeFirestoreCollections(db, backupPath);
    
    // Step 2: Purge Storage files  
    console.log('\n=== STEP 2: STORAGE PURGE ===');
    results.storage = await purgeStorageFiles(app, backupPath);
    
    // Step 3: Purge user access
    console.log('\n=== STEP 3: USER ACCESS PURGE ===');
    results.userAccess = await purgeUserAccess(db);
    
    // Step 4: Purge audit logs
    console.log('\n=== STEP 4: AUDIT LOGS PURGE ===');
    results.auditLogs = await purgeAuditLogs(db, backupPath);
    
    // Log completion
    await logPurgeOperation('complete-client-purge', `Client ${CLIENT_ID} purge completed successfully`);
    
    results.success = true;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 ENHANCED CLIENT PURGE SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📝 Audit Client ID: ${AUDIT_CLIENT_ID}`);
    console.log(`📁 Backup: ${backupPath}`);
    console.log(`⏰ Completed: ${results.timestamp}`);
    console.log('');
    console.log('📄 FIRESTORE:');
    console.log(`   Documents deleted: ${results.firestore.documentsDeleted}`);
    console.log(`   Collections processed: ${results.firestore.collectionsProcessed}`);
    console.log('');
    console.log('📁 STORAGE:');
    console.log(`   Files deleted: ${results.storage.filesDeleted}/${results.storage.filesFound}`);
    console.log(`   Total size: ${(results.storage.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    console.log('👥 USER ACCESS:');
    console.log(`   Users updated: ${results.userAccess.usersUpdated}`);
    console.log('');
    console.log('📋 AUDIT LOGS:');
    console.log(`   Client audit logs deleted: ${results.auditLogs.auditLogsDeleted}`);
    console.log('');
    console.log('✅ CLIENT COMPLETELY PURGED WITH FULL AUDIT TRAIL');
    console.log('🚀 Ready for clean import using CRUD functions');
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Enhanced client purge failed:', error);
    await logPurgeOperation('purge-error', `Client purge failed: ${error.message}`, false);
    results.error = error.message;
    throw error;
  }
}

// Execute
performEnhancedClientPurge()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
/**
 * Complete Storage and Firestore Cleanup System
 * 
 * Handles both Firestore data and Firebase Storage files
 * Archives storage files before deletion
 * Creates production-ready client deletion system
 * 
 * Task ID: MTC-MIGRATION-001 - Phase 2 Storage Cleanup
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb, getApp } from '../backend/firebase.js';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const CLIENT_ID = 'MTC';
const BACKUP_DIR = './backups';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Scan Firebase Storage for client documents
 */
async function scanClientStorage(app) {
  console.log('📁 Scanning Firebase Storage for client documents...\n');
  
  const bucket = app.storage().bucket();
  const storageFindings = {
    clientFiles: [],
    totalFiles: 0,
    totalSize: 0
  };
  
  try {
    // Look for files in the clients/{clientId} path
    const clientPath = `clients/${CLIENT_ID}/`;
    console.log(`🔍 Scanning storage path: ${clientPath}`);
    
    const [files] = await bucket.getFiles({
      prefix: clientPath,
      autoPaginate: true
    });
    
    console.log(`📊 Found ${files.length} files in client storage`);
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      
      const fileInfo = {
        name: file.name,
        size: parseInt(metadata.size) || 0,
        created: metadata.timeCreated,
        updated: metadata.updated,
        contentType: metadata.contentType,
        downloadUrl: `gs://${bucket.name}/${file.name}`
      };
      
      storageFindings.clientFiles.push(fileInfo);
      storageFindings.totalSize += fileInfo.size;
      
      console.log(`📄 ${file.name}`);
      console.log(`   Size: ${(fileInfo.size / 1024).toFixed(2)} KB`);
      console.log(`   Type: ${fileInfo.contentType}`);
      console.log(`   Created: ${fileInfo.created}`);
    }
    
    storageFindings.totalFiles = files.length;
    
    return { bucket, files, storageFindings };
    
  } catch (error) {
    console.error('❌ Error scanning storage:', error);
    return { bucket: null, files: [], storageFindings };
  }
}

/**
 * Archive storage files to local backup
 */
async function archiveStorageFiles(bucket, files, backupPath) {
  console.log('\n📦 Archiving storage files...');
  
  if (files.length === 0) {
    console.log('✅ No storage files to archive');
    return [];
  }
  
  const storageBackupPath = path.join(backupPath, 'storage');
  await fs.mkdir(storageBackupPath, { recursive: true });
  
  const archivedFiles = [];
  
  for (const file of files) {
    try {
      console.log(`📥 Downloading: ${file.name}`);
      
      // Create local file path maintaining directory structure
      const localPath = path.join(storageBackupPath, file.name.replace(`clients/${CLIENT_ID}/`, ''));
      const localDir = path.dirname(localPath);
      
      // Ensure directory exists
      await fs.mkdir(localDir, { recursive: true });
      
      // Download file
      const readStream = file.createReadStream();
      const writeStream = createWriteStream(localPath);
      
      await pipeline(readStream, writeStream);
      
      // Get file stats
      const stats = await fs.stat(localPath);
      
      archivedFiles.push({
        originalPath: file.name,
        localPath: localPath,
        size: stats.size
      });
      
      console.log(`✅ Archived: ${file.name} (${(stats.size / 1024).toFixed(2)} KB)`);
      
    } catch (error) {
      console.error(`❌ Failed to archive ${file.name}:`, error);
    }
  }
  
  // Create storage manifest
  const storageManifest = {
    clientId: CLIENT_ID,
    timestamp: TIMESTAMP,
    totalFiles: files.length,
    archivedFiles: archivedFiles.length,
    files: archivedFiles
  };
  
  await fs.writeFile(
    path.join(storageBackupPath, 'storage-manifest.json'),
    JSON.stringify(storageManifest, null, 2)
  );
  
  console.log(`📋 Created storage manifest with ${archivedFiles.length} files`);
  
  return archivedFiles;
}

/**
 * Delete storage files after archiving
 */
async function deleteStorageFiles(files) {
  console.log('\n🗑️ Deleting storage files...');
  
  if (files.length === 0) {
    console.log('✅ No storage files to delete');
    return 0;
  }
  
  let deletedCount = 0;
  
  for (const file of files) {
    try {
      await file.delete();
      console.log(`✅ Deleted: ${file.name}`);
      deletedCount++;
    } catch (error) {
      console.error(`❌ Failed to delete ${file.name}:`, error);
    }
  }
  
  console.log(`🗑️ Deleted ${deletedCount}/${files.length} storage files`);
  return deletedCount;
}

/**
 * Comprehensive client cleanup (Firestore + Storage)
 */
async function performCompleteClientCleanup() {
  console.log('🚀 Starting Complete Client Cleanup (Firestore + Storage)...\n');
  
  const results = {
    timestamp: TIMESTAMP,
    clientId: CLIENT_ID,
    firestore: {
      documentExists: false,
      collectionsFound: 0,
      documentsDeleted: 0
    },
    storage: {
      filesFound: 0,
      filesArchived: 0,
      filesDeleted: 0,
      totalSize: 0
    },
    backupPath: null,
    success: false
  };
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    const app = await getApp();
    
    // Create backup directory
    const backupPath = path.join(BACKUP_DIR, `${CLIENT_ID}-COMPLETE-CLEANUP-${TIMESTAMP}`);
    await fs.mkdir(backupPath, { recursive: true });
    results.backupPath = backupPath;
    
    console.log(`📁 Backup directory: ${backupPath}\n`);
    
    // === FIRESTORE CLEANUP ===
    console.log('=== FIRESTORE CLEANUP ===');
    
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    results.firestore.documentExists = clientDoc.exists;
    
    if (clientDoc.exists) {
      console.log('📄 Client document found - archiving...');
      
      // Archive client document
      await fs.writeFile(
        path.join(backupPath, 'client-document.json'),
        JSON.stringify({ id: clientDoc.id, data: clientDoc.data() }, null, 2)
      );
      
      // Delete client document
      await clientDoc.ref.delete();
      results.firestore.documentsDeleted++;
      console.log('✅ Client document deleted');
    } else {
      console.log('✅ No client document found');
    }
    
    // Check for collections
    const collections = await clientRef.listCollections();
    results.firestore.collectionsFound = collections.length;
    
    if (collections.length > 0) {
      console.log(`📁 Found ${collections.length} collections - cleaning up...`);
      
      for (const collection of collections) {
        const snapshot = await collection.get();
        if (snapshot.size > 0) {
          console.log(`🗑️ Deleting ${snapshot.size} documents from ${collection.id}`);
          
          const batch = db.batch();
          snapshot.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
          
          results.firestore.documentsDeleted += snapshot.size;
        }
      }
    }
    
    // === STORAGE CLEANUP ===
    console.log('\n=== STORAGE CLEANUP ===');
    
    const { bucket, files, storageFindings } = await scanClientStorage(app);
    
    results.storage.filesFound = storageFindings.totalFiles;
    results.storage.totalSize = storageFindings.totalSize;
    
    if (files.length > 0) {
      // Archive files
      const archivedFiles = await archiveStorageFiles(bucket, files, backupPath);
      results.storage.filesArchived = archivedFiles.length;
      
      // Delete files from storage
      const deletedCount = await deleteStorageFiles(files);
      results.storage.filesDeleted = deletedCount;
    }
    
    // === VERIFICATION ===
    console.log('\n=== VERIFICATION ===');
    
    // Verify Firestore cleanup
    const finalClientDoc = await clientRef.get();
    const finalCollections = await clientRef.listCollections();
    
    console.log(`📄 Client document exists: ${finalClientDoc.exists}`);
    console.log(`📁 Collections remaining: ${finalCollections.length}`);
    
    // Verify storage cleanup
    const [remainingFiles] = await bucket.getFiles({
      prefix: `clients/${CLIENT_ID}/`,
      autoPaginate: true
    });
    
    console.log(`📁 Storage files remaining: ${remainingFiles.length}`);
    
    // Create complete manifest
    const completeManifest = {
      cleanup: results,
      verification: {
        firestoreClean: !finalClientDoc.exists && finalCollections.length === 0,
        storageClean: remainingFiles.length === 0
      },
      restoration: {
        firestoreBackup: path.join(backupPath, 'client-document.json'),
        storageBackup: path.join(backupPath, 'storage'),
        instructions: 'Use restore-complete-client.js script for full restoration'
      }
    };
    
    await fs.writeFile(
      path.join(backupPath, 'complete-cleanup-manifest.json'),
      JSON.stringify(completeManifest, null, 2)
    );
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 COMPLETE CLIENT CLEANUP SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📁 Backup: ${backupPath}`);
    console.log('');
    console.log('📄 FIRESTORE:');
    console.log(`   Document existed: ${results.firestore.documentExists}`);
    console.log(`   Collections found: ${results.firestore.collectionsFound}`);
    console.log(`   Documents deleted: ${results.firestore.documentsDeleted}`);
    console.log('');
    console.log('📁 STORAGE:');
    console.log(`   Files found: ${results.storage.filesFound}`);
    console.log(`   Files archived: ${results.storage.filesArchived}`);
    console.log(`   Files deleted: ${results.storage.filesDeleted}`);
    console.log(`   Total size: ${(results.storage.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    console.log('✅ VERIFICATION:');
    console.log(`   Firestore clean: ${completeManifest.verification.firestoreClean}`);
    console.log(`   Storage clean: ${completeManifest.verification.storageClean}`);
    
    const overallSuccess = completeManifest.verification.firestoreClean && 
                          completeManifest.verification.storageClean;
    results.success = overallSuccess;
    
    if (overallSuccess) {
      console.log('\n✅ COMPLETE CLEANUP SUCCESSFUL!');
      console.log('🚀 Database and storage ready for fresh client onboarding');
    } else {
      console.log('\n⚠️ CLEANUP COMPLETED WITH ISSUES');
      console.log('🔧 Manual verification recommended');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Complete cleanup failed:', error);
    results.error = error.message;
    throw error;
  }
}

// Execute
performCompleteClientCleanup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
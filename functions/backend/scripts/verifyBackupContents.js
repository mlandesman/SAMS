/**
 * Verify Backup Contents
 * Uses Firestore Admin API to read export and verify collections
 */

import admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BUCKET_NAME = 'sams-shared-backups';

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

/**
 * List collections from Firestore directly (to compare with backup)
 */
async function listCurrentCollections() {
  const db = admin.firestore();
  const collections = [];
  
  // Get top-level collections
  const snapshot = await db.listCollections();
  for (const collection of snapshot) {
    collections.push(collection.id);
  }
  
  // Also check subcollections (e.g., clients/AVII/transactions)
  const clientsSnapshot = await db.collection('clients').limit(1).get();
  if (!clientsSnapshot.empty) {
    const clientId = clientsSnapshot.docs[0].id;
    const clientRef = db.collection('clients').doc(clientId);
    const subcollections = await clientRef.listCollections();
    for (const subcol of subcollections) {
      collections.push(`clients/{clientId}/${subcol.id}`);
    }
  }
  
  return collections;
}

/**
 * Verify backup files exist and get sizes
 */
async function verifyBackupFiles(backupPath) {
  const results = {
    firestore: { files: 0, totalSize: 0, paths: [] },
    storage: { files: 0, totalSize: 0, sampleFiles: [] }
  };
  
  // Check Firestore export
  const [firestoreFiles] = await bucket.getFiles({ prefix: `${backupPath}/firestore/` });
  results.firestore.files = firestoreFiles.length;
  results.firestore.totalSize = firestoreFiles.reduce((sum, f) => sum + parseInt(f.metadata.size || 0), 0);
  
  // Get unique paths
  const firestorePaths = new Set();
  firestoreFiles.forEach(f => {
    const relativePath = f.name.replace(`${backupPath}/firestore/`, '');
    const pathParts = relativePath.split('/');
    if (pathParts.length > 0) {
      firestorePaths.add(pathParts[0]);
    }
  });
  results.firestore.paths = Array.from(firestorePaths).sort();
  
  // Check Storage backup
  const [storageFiles] = await bucket.getFiles({ prefix: `${backupPath}/storage/` });
  results.storage.files = storageFiles.length;
  results.storage.totalSize = storageFiles.reduce((sum, f) => sum + parseInt(f.metadata.size || 0), 0);
  
  // Sample storage files
  results.storage.sampleFiles = storageFiles.slice(0, 10).map(f => ({
    path: f.name.replace(`${backupPath}/storage/`, ''),
    size: parseInt(f.metadata.size || 0)
  }));
  
  return results;
}

/**
 * Check specific collection data in Firestore (to verify backup has it)
 */
async function checkCollectionData(collectionPath) {
  const db = admin.firestore();
  
  try {
    const pathParts = collectionPath.split('/');
    let ref = db.collection(pathParts[0]);
    
    if (pathParts.length > 1) {
      ref = ref.doc(pathParts[1]);
      if (pathParts.length > 2) {
        ref = ref.collection(pathParts[2]);
      }
    }
    
    const snapshot = await ref.limit(5).get();
    return {
      exists: true,
      count: snapshot.size,
      sampleIds: snapshot.docs.map(doc => doc.id)
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

/**
 * Main function
 */
async function main() {
  const backupId = process.argv[2] || '2025-12-24_153623';
  const env = process.argv[3] || 'dev';
  const collectionToCheck = process.argv[4] || null;
  
  console.log(`\n🔍 Verifying Backup: ${backupId} (${env})`);
  console.log('='.repeat(70));
  
  const backupPath = `${env}/${backupId}`;
  
  // Verify backup files
  console.log('\n📦 Checking backup files in GCS...');
  const backupFiles = await verifyBackupFiles(backupPath);
  
  console.log(`\n✅ Firestore Export:`);
  console.log(`   Files: ${backupFiles.firestore.files}`);
  console.log(`   Size: ${(backupFiles.firestore.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Paths found: ${backupFiles.firestore.paths.join(', ')}`);
  
  console.log(`\n✅ Storage Backup:`);
  console.log(`   Files: ${backupFiles.storage.files}`);
  console.log(`   Size: ${(backupFiles.storage.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Sample files:`);
  backupFiles.storage.sampleFiles.forEach(file => {
    console.log(`      - ${file.path} (${(file.size / 1024).toFixed(1)} KB)`);
  });
  
  // List current collections for comparison
  console.log(`\n📋 Current Firestore Collections (for comparison):`);
  const currentCollections = await listCurrentCollections();
  currentCollections.forEach(col => {
    console.log(`   - ${col}`);
  });
  
  // Check specific collection if requested
  if (collectionToCheck) {
    console.log(`\n🔎 Checking collection: ${collectionToCheck}`);
    const collectionData = await checkCollectionData(collectionToCheck);
    if (collectionData.exists) {
      console.log(`   ✅ Collection exists with ${collectionData.count} documents`);
      console.log(`   Sample document IDs: ${collectionData.sampleIds.join(', ')}`);
    } else {
      console.log(`   ❌ Collection check failed: ${collectionData.error}`);
    }
  }
  
  console.log('\n✅ Verification complete!\n');
  console.log('💡 To check specific collection data, provide collection path:');
  console.log('   Example: node verifyBackupContents.js 2025-12-24_153623 dev clients/AVII/transactions\n');
}

main().catch(console.error);


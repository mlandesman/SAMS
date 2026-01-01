#!/usr/bin/env node

/**
 * Create Manifest Files for Existing Backups
 * 
 * This script creates manifest JSON files for backups that were created
 * before the manifest creation functionality was added.
 * 
 * Usage: node functions/backend/scripts/create-backup-manifests.js [--prod] [--days=7]
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';

// Check for --prod flag to use production with ADC
const useProduction = process.argv.includes('--prod');
const productionProjectId = 'sams-sandyland-prod';

// Parse --days argument (default: 7)
const daysArg = process.argv.find(arg => arg.startsWith('--days='));
const daysBack = daysArg ? parseInt(daysArg.split('=')[1]) : 7;

const BUCKET_NAME = 'sams-shared-backups';

async function initializeFirebase() {
  if (useProduction) {
    // Use Application Default Credentials for production
    console.log(`🌍 Environment: PRODUCTION`);
    console.log(`🔥 Firebase Project: ${productionProjectId}`);
    console.log(`🔑 Using Application Default Credentials (ADC)`);
    console.log(`   Run 'gcloud auth application-default login' if not authenticated\n`);
    
    // Clear GOOGLE_APPLICATION_CREDENTIALS if it's set to placeholder/invalid path
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
         !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
      console.log(`⚠️  Clearing invalid GOOGLE_APPLICATION_CREDENTIALS env var`);
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: productionProjectId
      });
    }
    
    return admin.firestore();
  } else {
    // Use service account key for development
    const { getDb } = await import('../firebase.js');
    return await getDb();
  }
}

async function createManifestForBackup(db, backupDoc) {
  const data = backupDoc.data();
  const backupId = data.id || backupDoc.id;
  const storage = admin.storage();
  const bucket = storage.bucket(BUCKET_NAME);
  
  // Check if backup data exists in GCS (even if status is failed, data might exist)
  const envPrefix = data.environment || 'prod';
  const firestorePrefix = `${envPrefix}/${backupId}/firestore/all_collections/`;
  const [firestoreFiles] = await bucket.getFiles({ prefix: firestorePrefix, maxResults: 1 });
  
  const hasBackupData = firestoreFiles.length > 0;
  
  // Warn if status is not complete but data exists
  if (data.status !== 'complete' && !hasBackupData) {
    console.log(`   ⏭️  Skipping ${backupId} - status: ${data.status}, no backup data found`);
    return null;
  }
  
  if (data.status !== 'complete' && hasBackupData) {
    console.log(`   ⚠️  Warning: ${backupId} status is '${data.status}' but backup data exists in GCS`);
    console.log(`   📝 Creating manifest anyway (backup data is available)`);
  }
  
  // Extract date from backupId (YYYY-MM-DD_HHMMSS -> YYYY-MM-DD)
  const backupDate = backupId.split('_')[0];
  
  // Map triggeredBy to tag format
  const triggeredBy = data.triggeredBy || 'manual';
  const tag = triggeredBy === 'scheduled' ? 'nightly' : 'manual';
  
  // Get timestamp
  const timestamp = data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString();
  
  // Get paths from backup record (envPrefix already declared above)
  const firestoreBasePath = data.firestoreExportPath || `gs://${BUCKET_NAME}/${envPrefix}/${backupId}/firestore`;
  const storagePath = data.storageSyncPath || `gs://${BUCKET_NAME}/${envPrefix}/${backupId}/storage`;
  
  // Build full paths
  const allCollectionsPath = `${firestoreBasePath}/all_collections`;
  const usersOnlyPath = `${firestoreBasePath}/users_only`;
  
  // Get storage metadata (try to get file count from GCS)
  let storageFileCount = 0;
  let storageSizeMB = 0;
  
  try {
    const storagePrefix = `${envPrefix}/${backupId}/storage/`;
    const [files] = await bucket.getFiles({ prefix: storagePrefix });
    storageFileCount = files.length;
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      storageSizeMB += parseInt(metadata.size || 0) / 1024 / 1024;
    }
    storageSizeMB = Math.round(storageSizeMB);
  } catch (error) {
    console.warn(`   ⚠️  Could not calculate storage size for ${backupId}: ${error.message}`);
  }
  
  // Create manifest JSON
  const manifest = {
    timestamp: timestamp,
    tag: tag,
    firestore: {
      all_collections: allCollectionsPath,
      users_only: usersOnlyPath
    },
    storage: {
      path: storagePath,
      files_count: storageFileCount,
      total_size_mb: storageSizeMB
    },
    source_project: data.projectId || productionProjectId,
    collections_backed_up: 'all'
  };
  
  // Upload manifest
  const manifestFileName = `${backupDate}_${tag}.json`;
  const manifestFile = bucket.file(`manifests/${manifestFileName}`);
  
  try {
    // Check if manifest already exists
    const [exists] = await manifestFile.exists();
    if (exists) {
      console.log(`   ⏭️  Manifest already exists: ${manifestFileName}`);
      return { backupId, skipped: true, reason: 'manifest exists' };
    }
    
    await manifestFile.save(JSON.stringify(manifest, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });
    
    console.log(`   ✅ Created manifest: ${manifestFileName}`);
    return { backupId, created: true, manifestFileName };
    
  } catch (error) {
    console.error(`   ❌ Failed to create manifest for ${backupId}: ${error.message}`);
    return { backupId, error: error.message };
  }
}

async function main() {
  console.log('📝 Creating Manifest Files for Existing Backups');
  console.log('=' .repeat(50));
  console.log(`Looking back ${daysBack} days\n`);
  
  const db = await initializeFirebase();
  
  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
  
  console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}\n`);
  
  // Query backups from the past week
  const backupsRef = db.collection('system').doc('backup').collection('history');
  const snapshot = await backupsRef
    .where('timestamp', '>=', cutoffTimestamp)
    .orderBy('timestamp', 'desc')
    .get();
  
  if (snapshot.empty) {
    console.log('❌ No backups found in the specified time period');
    process.exit(1);
  }
  
  console.log(`📊 Found ${snapshot.size} backup(s) in the past ${daysBack} days\n`);
  
  const results = {
    total: snapshot.size,
    created: 0,
    skipped: 0,
    errors: 0
  };
  
  // Process each backup
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const backupId = data.id || doc.id;
    const timestamp = data.timestamp ? data.timestamp.toDate().toISOString() : 'unknown';
    
    console.log(`\n📦 Processing backup: ${backupId}`);
    console.log(`   Date: ${timestamp}`);
    console.log(`   Status: ${data.status}`);
    console.log(`   Triggered by: ${data.triggeredBy || 'unknown'}`);
    
    const result = await createManifestForBackup(db, doc);
    
    if (result?.created) {
      results.created++;
    } else if (result?.skipped) {
      results.skipped++;
    } else if (result?.error) {
      results.errors++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`Total backups processed: ${results.total}`);
  console.log(`✅ Manifests created: ${results.created}`);
  console.log(`⏭️  Manifests skipped (already exist): ${results.skipped}`);
  console.log(`❌ Errors: ${results.errors}`);
  console.log('');
  
  if (results.created > 0) {
    console.log('✅ Successfully created manifest files for existing backups');
    console.log('   Restore scripts can now find these backups\n');
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


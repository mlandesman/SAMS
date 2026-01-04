/**
 * Backup Service for SAMS
 * TASK-73: Node.js Backup System
 * 
 * Ports bash backup scripts to Node.js service
 * Handles Firestore export, Storage sync, and retention policy
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { getNow } from '../services/DateService.js';

const BUCKET_NAME = 'sams-shared-backups';

/**
 * Detect current environment
 * @returns {Object} { env: 'dev'|'staging'|'prod', projectId: string }
 */
function detectEnvironment() {
  // Check NODE_ENV first (most reliable)
  if (process.env.NODE_ENV === 'production') {
    return {
      env: 'prod',
      projectId: process.env.GCLOUD_PROJECT || 'sams-sandyland-prod',
      displayName: 'Production'
    };
  } else if (process.env.NODE_ENV === 'staging') {
    return {
      env: 'staging',
      projectId: process.env.GCLOUD_PROJECT || 'sams-staging-6cdcd',
      displayName: 'Staging'
    };
  }
  
  // Development environment
  return {
    env: 'dev',
    projectId: process.env.GCLOUD_PROJECT || 'sandyland-management-system',
    displayName: 'Development'
  };
}

const ENV_INFO = detectEnvironment();
const PROJECT_ID = ENV_INFO.projectId;

// Retention policy configuration
const RETENTION = {
  daily: 10,      // Keep last 10 days
  weekly: 5,      // Keep last 5 Sundays
  monthly: 13,    // Keep last 13 months (1+ year)
  annual: Infinity // Keep forever
};

/**
 * Categorize backup based on date for retention policy
 * @param {Date} date - Backup date
 * @returns {string} Category: 'annual' | 'monthly' | 'weekly' | 'daily'
 */
function categorizeBackup(date) {
  // Jan 1 = annual (never delete)
  if (date.getMonth() === 0 && date.getDate() === 1) {
    return 'annual';
  }
  
  // 1st of month = monthly
  if (date.getDate() === 1) {
    return 'monthly';
  }
  
  // Sunday = weekly (0 = Sunday)
  if (date.getDay() === 0) {
    return 'weekly';
  }
  
  // Everything else = daily
  return 'daily';
}

/**
 * Format backup ID from date
 * @param {Date} date - Backup date
 * @returns {string} Backup ID in format YYYY-MM-DD_HHMMSS
 */
function formatBackupId(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

/**
 * Run a full backup of Firestore and Storage
 * @param {string} triggeredBy - 'scheduled' | 'manual'
 * @param {string} userId - User who triggered (for manual)
 * @returns {Object} Backup result with id, timestamp, status
 */
export async function runBackup(triggeredBy = 'scheduled', userId = null) {
  const startTime = getNow(); // Cancun timezone (system operations use getNow())
  const backupId = formatBackupId(startTime);
  const db = await getDb();
  
  // Create backup manifest document
  const backupRef = db.collection('system').doc('backup').collection('history').doc(backupId);
  
  // Use environment-specific paths
  const envPrefix = ENV_INFO.env;
  
  const backupData = {
    id: backupId,
    timestamp: admin.firestore.Timestamp.fromDate(startTime),
    triggeredBy,
    triggeredByUser: userId || null,
    status: 'running',
    environment: ENV_INFO.env, // 'dev', 'staging', or 'prod'
    environmentDisplay: ENV_INFO.displayName,
    projectId: PROJECT_ID,
    firestoreExportPath: `gs://${BUCKET_NAME}/${envPrefix}/${backupId}/firestore`,
    storageSyncPath: `gs://${BUCKET_NAME}/${envPrefix}/${backupId}/storage`,
    sizeBytes: 0,
    durationMs: 0,
    error: null,
    retentionTag: categorizeBackup(startTime)
  };
  
  try {
    // Save initial backup record
    await backupRef.set(backupData);
    
    console.log(`🔄 Starting backup ${backupId} (${ENV_INFO.displayName}) (triggered by: ${triggeredBy})`);
    
    // Step 1: Export Firestore
    console.log('📦 Exporting Firestore...');
    const firestoreExportResult = await exportFirestore(backupId);
    
    // Step 2: Sync Storage
    console.log('📁 Syncing Firebase Storage...');
    const storageSyncResult = await syncStorage(backupId);
    
    // Calculate total size
    const totalSizeBytes = (firestoreExportResult.sizeBytes || 0) + (storageSyncResult.sizeBytes || 0);
    const durationMs = Date.now() - startTime.getTime();
    
    // Update backup record with success
    await backupRef.update({
      status: 'complete',
      sizeBytes: totalSizeBytes,
      durationMs,
      firestoreExportPath: firestoreExportResult.path,
      storageSyncPath: storageSyncResult.path,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Backup ${backupId} completed in ${(durationMs / 1000).toFixed(1)}s`);
    
    // Create manifest JSON file for restore scripts
    await createBackupManifest(backupId, startTime, triggeredBy, firestoreExportResult, storageSyncResult);
    
    // Apply retention policy
    await applyRetentionPolicy();
    
    return {
      id: backupId,
      timestamp: backupData.timestamp,
      status: 'complete',
      environment: ENV_INFO.env,
      environmentDisplay: ENV_INFO.displayName,
      projectId: PROJECT_ID,
      sizeBytes: totalSizeBytes,
      durationMs,
      triggeredBy,
      triggeredByUser: userId
    };
    
  } catch (error) {
    console.error(`❌ Backup ${backupId} failed:`, error);
    const durationMs = Date.now() - startTime.getTime();
    
    // Update backup record with error
    await backupRef.update({
      status: 'failed',
      durationMs,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Export Firestore to GCS
 * Uses Firestore Admin API v1 for programmatic export
 * @param {string} backupId - Backup identifier
 * @returns {Object} Export result with path and size
 */
async function exportFirestore(backupId) {
  try {
    // Use googleapis package for Firestore Admin API
    const { google } = await import('googleapis');
    const firestoreAdmin = google.firestore('v1');
    
    const envPrefix = ENV_INFO.env;
    const outputPath = `gs://${BUCKET_NAME}/${envPrefix}/${backupId}/firestore`;
    const allCollectionsPath = `${outputPath}/all_collections`;
    const usersPath = `${outputPath}/users_only`;
    
    console.log(`   Firestore export path: ${outputPath}`);
    
    // Get auth client (uses default credentials in Cloud Functions)
    const authClient = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    const databaseName = `projects/${PROJECT_ID}/databases/(default)`;
    
    // Export all collections (including subcollections)
    console.log('   Starting Firestore export (all collections)...');
    const allOperation = await firestoreAdmin.projects.databases.exportDocuments({
      auth: authClient,
      name: databaseName,
      requestBody: {
        outputUriPrefix: allCollectionsPath
        // No collectionIds = export ALL (including subcollections)
      }
    });
    
    // Export users collection separately
    console.log('   Starting Firestore export (users only)...');
    const usersOperation = await firestoreAdmin.projects.databases.exportDocuments({
      auth: authClient,
      name: databaseName,
      requestBody: {
        outputUriPrefix: usersPath,
        collectionIds: ['users']
      }
    });
    
    // Wait for operations to complete (with timeout)
    console.log('   Waiting for Firestore exports to complete...');
    const maxWait = 600000; // 10 minutes
    const startTime = Date.now();
    
    // Poll for completion using Firestore Admin operations API
    const allOpName = allOperation.data.name;
    const usersOpName = usersOperation.data.name;
    
    while (Date.now() - startTime < maxWait) {
      const allResponse = await firestoreAdmin.projects.databases.operations.get({
        auth: authClient,
        name: allOpName
      }).catch(() => null);
      
      const usersResponse = await firestoreAdmin.projects.databases.operations.get({
        auth: authClient,
        name: usersOpName
      }).catch(() => null);
      
      if (allResponse?.data?.done && usersResponse?.data?.done) {
        console.log('   ✅ Firestore exports complete');
        // Calculate size from GCS
        const storage = admin.storage();
        const bucket = storage.bucket(BUCKET_NAME);
        let totalSize = 0;
        
        try {
          const [allFiles] = await bucket.getFiles({ prefix: `${envPrefix}/${backupId}/firestore/all_collections/` });
          const [userFiles] = await bucket.getFiles({ prefix: `${envPrefix}/${backupId}/firestore/users_only/` });
          
          for (const file of [...allFiles, ...userFiles]) {
            const [metadata] = await file.getMetadata();
            totalSize += parseInt(metadata.size || 0);
          }
        } catch (sizeError) {
          console.warn('   Could not calculate export size:', sizeError.message);
        }
        
        return {
          path: outputPath,
          sizeBytes: totalSize
        };
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Firestore export timeout - exports may still be in progress');
    
  } catch (error) {
    console.error('Firestore export error:', error);
    throw new Error(`Firestore export failed: ${error.message}`);
  }
}

/**
 * Get the correct Firebase Storage bucket name based on environment
 * @returns {string} Storage bucket name
 */
function getStorageBucketName() {
  // Check GCLOUD_PROJECT first (always set in Cloud Functions), then fall back to NODE_ENV
  if (process.env.GCLOUD_PROJECT === 'sams-sandyland-prod' || process.env.NODE_ENV === 'production') {
    return 'sams-sandyland-prod.firebasestorage.app';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'sams-staging-6cdcd.firebasestorage.app';
  }
  return 'sandyland-management-system.firebasestorage.app';
}

/**
 * Sync Firebase Storage to GCS backup bucket
 * @param {string} backupId - Backup identifier
 * @returns {Object} Sync result with path and size
 */
async function syncStorage(backupId) {
  try {
    const storage = admin.storage();
    const sourceBucketName = getStorageBucketName();
    const sourceBucket = storage.bucket(sourceBucketName);
    const destBucket = storage.bucket(BUCKET_NAME);
    
    const envPrefix = ENV_INFO.env;
    const destPath = `${envPrefix}/${backupId}/storage`;
    let totalSize = 0;
    let fileCount = 0;
    
    console.log(`   Syncing from ${sourceBucketName} to ${destBucket.name}/${destPath}`);
    
    // List all files in source bucket
    const [files] = await sourceBucket.getFiles();
    
    // Copy files to destination
    for (const file of files) {
      const destFile = destBucket.file(`${destPath}/${file.name}`);
      await file.copy(destFile);
      
      const [metadata] = await file.getMetadata();
      totalSize += parseInt(metadata.size || 0);
      fileCount++;
      
      if (fileCount % 100 === 0) {
        console.log(`   Copied ${fileCount} files...`);
      }
    }
    
    console.log(`   ✅ Storage sync complete: ${fileCount} files, ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
    
    return {
      path: `gs://${BUCKET_NAME}/${destPath}`,
      sizeBytes: totalSize,
      fileCount
    };
    
  } catch (error) {
    console.error('Storage sync error:', error);
    
    // Provide helpful error message for permission issues
    if (error.code === 403 || error.message?.includes('Permission') || error.message?.includes('access')) {
      const serviceAccountEmail = error.message?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com/)?.[0] || 'service account';
      throw new Error(
        `Storage sync failed: Permission denied. The service account (${serviceAccountEmail}) needs ` +
        `'storage.objects.create' permission on the '${BUCKET_NAME}' bucket. ` +
        `Run the setup script: scripts/backup/setup-gcs-bucket.sh to configure permissions.`
      );
    }
    
    throw new Error(`Storage sync failed: ${error.message}`);
  }
}

/**
 * List available backups with metadata
 * @param {number} limit - Max backups to return (default 20)
 * @returns {Array} List of backup objects
 */
export async function listBackups(limit = 20) {
  const db = await getDb();
  
  try {
    const backupsRef = db.collection('system').doc('backup').collection('history');
    const snapshot = await backupsRef
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const backups = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      backups.push({
        id: data.id,
        timestamp: data.timestamp,
        triggeredBy: data.triggeredBy,
        triggeredByUser: data.triggeredByUser,
        status: data.status,
        environment: data.environment || 'unknown',
        environmentDisplay: data.environmentDisplay || 'Unknown',
        projectId: data.projectId || 'unknown',
        sizeBytes: data.sizeBytes || 0,
        durationMs: data.durationMs || 0,
        retentionTag: data.retentionTag,
        error: data.error || null
      });
    });
    
    return backups;
    
  } catch (error) {
    console.error('Error listing backups:', error);
    throw new Error(`Failed to list backups: ${error.message}`);
  }
}

/**
 * Get current backup status
 * @returns {Object} { lastRun, lastStatus, nextScheduled }
 */
export async function getBackupStatus() {
  const db = await getDb();
  
  try {
    const backupsRef = db.collection('system').doc('backup').collection('history');
    
    // Get last backup
    const lastSnapshot = await backupsRef
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    let lastRun = null;
    let lastStatus = null;
    
    if (!lastSnapshot.empty) {
      const lastBackup = lastSnapshot.docs[0].data();
      lastRun = lastBackup.timestamp;
      lastStatus = lastBackup.status;
    }
    
    // Calculate next scheduled backup (3 AM Cancun time)
    const now = getNow(); // Cancun timezone
    const nextScheduled = new Date(now);
    // Set to 3 AM Cancun time
    nextScheduled.setHours(3, 0, 0, 0);
    
    // If already past today's scheduled time, schedule for tomorrow
    if (nextScheduled <= now) {
      nextScheduled.setDate(nextScheduled.getDate() + 1);
    }
    
    return {
      lastRun,
      lastStatus,
      nextScheduled: admin.firestore.Timestamp.fromDate(nextScheduled)
    };
    
  } catch (error) {
    console.error('Error getting backup status:', error);
    throw new Error(`Failed to get backup status: ${error.message}`);
  }
}

/**
 * Create manifest JSON file for restore scripts
 * This file is required by restore-prod.sh and restore-dev-from-prod.sh
 * @param {string} backupId - Backup identifier (YYYY-MM-DD_HHMMSS)
 * @param {Date} startTime - Backup start time
 * @param {string} triggeredBy - 'scheduled' | 'manual'
 * @param {Object} firestoreExportResult - Export result with path
 * @param {Object} storageSyncResult - Storage sync result with path, sizeBytes, fileCount
 */
async function createBackupManifest(backupId, startTime, triggeredBy, firestoreExportResult, storageSyncResult) {
  try {
    console.log('📝 Creating backup manifest for restore scripts...');
    
    const storage = admin.storage();
    const bucket = storage.bucket(BUCKET_NAME);
    
    // Extract date from backupId (YYYY-MM-DD_HHMMSS -> YYYY-MM-DD)
    const backupDate = backupId.split('_')[0];
    
    // Map triggeredBy to tag format expected by restore scripts
    const tag = triggeredBy === 'scheduled' ? 'nightly' : 'manual';
    
    // Format timestamp for manifest (ISO string)
    const timestamp = startTime.toISOString();
    
    // Build paths - backupService stores at prod/{backupId}/firestore/{all_collections|users_only}
    const envPrefix = ENV_INFO.env;
    const allCollectionsPath = `${firestoreExportResult.path}/all_collections`;
    const usersOnlyPath = `${firestoreExportResult.path}/users_only`;
    
    // Storage path and metadata
    const storagePath = storageSyncResult.path;
    const storageSizeMB = Math.round((storageSyncResult.sizeBytes || 0) / 1024 / 1024);
    const storageFileCount = storageSyncResult.fileCount || 0;
    
    // Create manifest JSON matching restore script expectations
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
      source_project: PROJECT_ID,
      collections_backed_up: 'all'
    };
    
    // Upload manifest to manifests/ prefix (required by restore scripts)
    const manifestFileName = `${backupDate}_${tag}.json`;
    const manifestFile = bucket.file(`manifests/${manifestFileName}`);
    
    await manifestFile.save(JSON.stringify(manifest, null, 2), {
      contentType: 'application/json',
      metadata: {
        cacheControl: 'no-cache'
      }
    });
    
    console.log(`   ✅ Manifest created: gs://${BUCKET_NAME}/manifests/${manifestFileName}`);
    
  } catch (error) {
    // Don't fail the backup if manifest creation fails - log and continue
    console.error('⚠️ Failed to create backup manifest (backup still succeeded):', error.message);
    console.error('   Restore scripts may not be able to find this backup');
  }
}

/**
 * Apply retention policy - called after each backup
 * Keeps: 10 daily, 5 weekly (Sundays), 13 monthly (1st), all annual (Jan 1)
 */
export async function applyRetentionPolicy() {
  const db = await getDb();
  const storage = admin.storage();
  const backupBucket = storage.bucket(BUCKET_NAME);
  
  try {
    console.log('🧹 Applying retention policy...');
    
    const backupsRef = db.collection('system').doc('backup').collection('history');
    const snapshot = await backupsRef
      .orderBy('timestamp', 'desc')
      .get();
    
    // Group backups by category
    const backupsByCategory = {
      annual: [],
      monthly: [],
      weekly: [],
      daily: []
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const backupDate = data.timestamp.toDate();
      const category = data.retentionTag || categorizeBackup(backupDate);
      
      backupsByCategory[category].push({
        id: data.id,
        docId: doc.id,
        timestamp: data.timestamp,
        category
      });
    });
    
    // Determine which backups to delete
    const toDelete = [];
    
    // Annual: Keep all (never delete)
    // Monthly: Keep last 13
    if (backupsByCategory.monthly.length > RETENTION.monthly) {
      const excess = backupsByCategory.monthly.slice(RETENTION.monthly);
      toDelete.push(...excess);
    }
    
    // Weekly: Keep last 5
    if (backupsByCategory.weekly.length > RETENTION.weekly) {
      const excess = backupsByCategory.weekly.slice(RETENTION.weekly);
      toDelete.push(...excess);
    }
    
    // Daily: Keep last 10
    if (backupsByCategory.daily.length > RETENTION.daily) {
      const excess = backupsByCategory.daily.slice(RETENTION.daily);
      toDelete.push(...excess);
    }
    
    // Delete backups from Firestore and GCS
    for (const backup of toDelete) {
      console.log(`   Deleting backup ${backup.id} (${backup.category})`);
      
      // Delete from Firestore
      await backupsRef.doc(backup.docId).delete();
      
      // Delete from GCS
      try {
        // Use environment from backup metadata, fallback to current env
        const backupEnv = backup.environment || ENV_INFO.env;
        const prefix = `${backupEnv}/${backup.id}/`;
        const [files] = await backupBucket.getFiles({ prefix });
        
        for (const file of files) {
          await file.delete();
        }
        
        console.log(`   ✅ Deleted ${files.length} files for backup ${backup.id}`);
      } catch (error) {
        console.error(`   ⚠️ Error deleting GCS files for ${backup.id}:`, error.message);
        // Continue with other deletions
      }
    }
    
    console.log(`✅ Retention policy applied: ${toDelete.length} backups deleted`);
    
  } catch (error) {
    console.error('Error applying retention policy:', error);
    // Don't throw - retention policy failure shouldn't fail the backup
    console.warn('⚠️ Retention policy application failed, but backup completed');
  }
}


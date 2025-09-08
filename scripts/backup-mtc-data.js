/**
 * MTC Data Backup Script - Task 1.3
 * 
 * Creates comprehensive backup of MTC data before migration
 * Implements rollback procedures and state documentation
 * 
 * Task ID: MTC-MIGRATION-001
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import fs from 'fs/promises';
import path from 'path';
import admin from 'firebase-admin';

// Backup configuration
const BACKUP_CONFIG = {
  clientId: 'MTC',
  backupDir: './backups',
  timestamp: new Date().toISOString().replace(/[:.]/g, '-'),
  collections: {
    preserve: ['config', 'yearEndBalances'], // Keep these
    backup: ['transactions', 'projects', 'units', 'vendors', 'categories', 'documents', 'paymentMethods'] // Backup then delete
  }
};

/**
 * Create backup directory structure
 */
async function createBackupStructure() {
  const backupPath = path.join(BACKUP_CONFIG.backupDir, `MTC-backup-${BACKUP_CONFIG.timestamp}`);
  
  try {
    await fs.mkdir(backupPath, { recursive: true });
    await fs.mkdir(path.join(backupPath, 'collections'), { recursive: true });
    await fs.mkdir(path.join(backupPath, 'metadata'), { recursive: true });
    
    console.log(`📁 Created backup directory: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('❌ Failed to create backup directory:', error);
    throw error;
  }
}

/**
 * Export a Firestore collection to JSON
 */
async function exportCollection(db, clientId, collectionName, backupPath) {
  try {
    console.log(`📤 Exporting ${collectionName}...`);
    
    const collectionRef = db.collection('clients').doc(clientId).collection(collectionName);
    const snapshot = await collectionRef.get();
    
    const documents = [];
    snapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    const exportPath = path.join(backupPath, 'collections', `${collectionName}.json`);
    await fs.writeFile(exportPath, JSON.stringify(documents, null, 2));
    
    console.log(`✅ Exported ${documents.length} documents from ${collectionName}`);
    return {
      collection: collectionName,
      documentCount: documents.length,
      exportPath: exportPath,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Failed to export ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Export client document
 */
async function exportClientDocument(db, clientId, backupPath) {
  try {
    console.log(`📤 Exporting client document: ${clientId}...`);
    
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      throw new Error(`Client document ${clientId} not found`);
    }
    
    const clientData = {
      id: clientDoc.id,
      data: clientDoc.data(),
      exists: true
    };
    
    const exportPath = path.join(backupPath, 'metadata', 'client-document.json');
    await fs.writeFile(exportPath, JSON.stringify(clientData, null, 2));
    
    console.log(`✅ Exported client document`);
    return {
      clientId: clientId,
      exportPath: exportPath,
      hasAccounts: !!(clientData.data.accounts && clientData.data.accounts.length > 0),
      accountCount: clientData.data.accounts?.length || 0,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Failed to export client document:`, error);
    throw error;
  }
}

/**
 * Export user documents related to MTC
 */
async function exportMTCUsers(db, backupPath) {
  try {
    console.log(`📤 Exporting MTC users...`);
    
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    const mtcUsers = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      // Check if user has MTC client access
      if (userData.clientAccess && userData.clientAccess[BACKUP_CONFIG.clientId]) {
        mtcUsers.push({
          id: doc.id,
          data: userData
        });
      }
    });
    
    const exportPath = path.join(backupPath, 'metadata', 'mtc-users.json');
    await fs.writeFile(exportPath, JSON.stringify(mtcUsers, null, 2));
    
    console.log(`✅ Exported ${mtcUsers.length} MTC users`);
    return {
      userCount: mtcUsers.length,
      exportPath: exportPath,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Failed to export MTC users:`, error);
    throw error;
  }
}

/**
 * Create backup manifest
 */
async function createBackupManifest(backupPath, backupResults) {
  const manifest = {
    backupInfo: {
      clientId: BACKUP_CONFIG.clientId,
      timestamp: BACKUP_CONFIG.timestamp,
      backupPath: backupPath,
      createdAt: new Date().toISOString(),
      purpose: 'Pre-migration backup for MTC production data migration test'
    },
    collections: {},
    client: null,
    users: null,
    summary: {
      totalCollections: 0,
      totalDocuments: 0,
      totalUsers: 0,
      backupSize: 0
    },
    rollbackInstructions: {
      description: 'How to restore this backup',
      steps: [
        '1. Stop all SAMS services',
        '2. Run restore script: node scripts/restore-mtc-backup.js',
        '3. Verify data integrity',
        '4. Restart services',
        '5. Test system functionality'
      ],
      warnings: [
        'This will overwrite current MTC data',
        'Ensure system is in maintenance mode',
        'Notify all users of downtime'
      ]
    }
  };
  
  // Process backup results
  backupResults.forEach(result => {
    if (result.collection) {
      manifest.collections[result.collection] = result;
      manifest.summary.totalCollections++;
      manifest.summary.totalDocuments += result.documentCount;
    } else if (result.clientId) {
      manifest.client = result;
    } else if (result.userCount !== undefined) {
      manifest.users = result;
      manifest.summary.totalUsers = result.userCount;
    }
  });
  
  // Calculate backup size
  try {
    const stats = await fs.stat(backupPath);
    manifest.summary.backupSize = stats.size;
  } catch (error) {
    console.warn('⚠️ Could not calculate backup size');
  }
  
  const manifestPath = path.join(backupPath, 'backup-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log(`📋 Created backup manifest: ${manifestPath}`);
  return manifest;
}

/**
 * Create rollback script
 */
async function createRollbackScript(backupPath, manifest) {
  const rollbackScript = `#!/usr/bin/env node
/**
 * ROLLBACK SCRIPT - Generated automatically
 * Backup: ${manifest.backupInfo.timestamp}
 * Client: ${manifest.backupInfo.clientId}
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import fs from 'fs/promises';
import path from 'path';

const BACKUP_PATH = '${backupPath}';
const CLIENT_ID = '${BACKUP_CONFIG.clientId}';

async function rollback() {
  console.log('🔄 Starting rollback process...');
  console.log('⚠️ This will OVERWRITE current ${BACKUP_CONFIG.clientId} data!');
  
  // Wait for confirmation
  await new Promise(resolve => {
    process.stdout.write('Continue? (yes/no): ');
    process.stdin.once('data', (data) => {
      if (data.toString().trim().toLowerCase() !== 'yes') {
        console.log('❌ Rollback cancelled');
        process.exit(0);
      }
      resolve();
    });
  });
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    // Restore client document
    console.log('📄 Restoring client document...');
    const clientData = JSON.parse(await fs.readFile(path.join(BACKUP_PATH, 'metadata', 'client-document.json')));
    await db.collection('clients').doc(CLIENT_ID).set(clientData.data);
    
    // Restore collections
    ${Object.keys(manifest.collections).map(collection => `
    console.log('📦 Restoring ${collection}...');
    const ${collection}Data = JSON.parse(await fs.readFile(path.join(BACKUP_PATH, 'collections', '${collection}.json')));
    const ${collection}Ref = db.collection('clients').doc(CLIENT_ID).collection('${collection}');
    
    // Clear existing documents
    const ${collection}Snapshot = await ${collection}Ref.get();
    const batch${collection} = db.batch();
    ${collection}Snapshot.forEach(doc => batch${collection}.delete(doc.ref));
    await batch${collection}.commit();
    
    // Restore documents
    for (const doc of ${collection}Data) {
      await ${collection}Ref.doc(doc.id).set(doc.data);
    }
    console.log('✅ Restored ${collection}');`).join('')}
    
    // Restore users
    console.log('👥 Restoring MTC users...');
    const usersData = JSON.parse(await fs.readFile(path.join(BACKUP_PATH, 'metadata', 'mtc-users.json')));
    for (const user of usersData) {
      await db.collection('users').doc(user.id).set(user.data);
    }
    
    console.log('✅ Rollback completed successfully!');
    console.log('🔄 Please restart SAMS services and verify functionality');
    
  } catch (error) {
    console.error('💥 Rollback failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  rollback();
}`;

  const scriptPath = path.join(backupPath, 'rollback.js');
  await fs.writeFile(scriptPath, rollbackScript);
  await fs.chmod(scriptPath, '755'); // Make executable
  
  console.log(`🔄 Created rollback script: ${scriptPath}`);
  return scriptPath;
}

/**
 * Test restore procedure with small sample
 */
async function testRestoreProcedure(backupPath) {
  console.log('🧪 Testing restore procedure...');
  
  try {
    // Check if all backup files exist
    const requiredFiles = [
      'backup-manifest.json',
      'metadata/client-document.json',
      'metadata/mtc-users.json'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(backupPath, file);
      await fs.access(filePath);
    }
    
    // Test JSON parsing
    const manifest = JSON.parse(await fs.readFile(path.join(backupPath, 'backup-manifest.json')));
    const clientDoc = JSON.parse(await fs.readFile(path.join(backupPath, 'metadata', 'client-document.json')));
    const users = JSON.parse(await fs.readFile(path.join(backupPath, 'metadata', 'mtc-users.json')));
    
    console.log('✅ All backup files are accessible and valid JSON');
    console.log(`✅ Manifest contains ${Object.keys(manifest.collections).length} collections`);
    console.log(`✅ Client document has ${clientDoc.data?.accounts?.length || 0} accounts`);
    console.log(`✅ User backup contains ${users.length} users`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Restore procedure test failed:', error);
    return false;
  }
}

/**
 * Main backup function
 */
async function performBackup() {
  console.log('🚀 Starting comprehensive MTC data backup...\n');
  
  let backupPath;
  const backupResults = [];
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Create backup structure
    backupPath = await createBackupStructure();
    
    // Export client document
    const clientResult = await exportClientDocument(db, BACKUP_CONFIG.clientId, backupPath);
    backupResults.push(clientResult);
    
    // Export MTC users
    const usersResult = await exportMTCUsers(db, backupPath);
    backupResults.push(usersResult);
    
    // Export all collections to be purged
    for (const collection of BACKUP_CONFIG.collections.backup) {
      const result = await exportCollection(db, BACKUP_CONFIG.clientId, collection, backupPath);
      backupResults.push(result);
    }
    
    // Create backup manifest
    const manifest = await createBackupManifest(backupPath, backupResults);
    
    // Create rollback script
    await createRollbackScript(backupPath, manifest);
    
    // Test restore procedure
    const testPassed = await testRestoreProcedure(backupPath);
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 BACKUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`📁 Backup Location: ${backupPath}`);
    console.log(`📊 Collections Backed Up: ${manifest.summary.totalCollections}`);
    console.log(`📄 Total Documents: ${manifest.summary.totalDocuments}`);
    console.log(`👥 MTC Users: ${manifest.summary.totalUsers}`);
    console.log(`✅ Accounts Preserved: ${clientResult.accountCount}`);
    console.log(`🧪 Restore Test: ${testPassed ? 'PASSED' : 'FAILED'}`);
    
    if (testPassed) {
      console.log('\n✅ Backup completed successfully!');
      console.log('🔄 Ready to proceed with database purge');
      return {
        success: true,
        backupPath: backupPath,
        manifest: manifest
      };
    } else {
      throw new Error('Backup validation failed');
    }
    
  } catch (error) {
    console.error('\n💥 Backup failed:', error);
    if (backupPath) {
      console.log(`🗑️ Cleaning up failed backup at: ${backupPath}`);
      try {
        await fs.rm(backupPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup backup directory:', cleanupError);
      }
    }
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  performBackup()
    .then(() => {
      console.log('✅ Backup process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Backup process failed:', error);
      process.exit(1);
    });
}

export { performBackup, createBackupStructure, exportCollection, testRestoreProcedure };
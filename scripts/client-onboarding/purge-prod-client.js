#!/usr/bin/env node

/**
 * Purge Production Client Data
 * 
 * Safely removes client data from Production before migration.
 * Requires backup to exist first for safety.
 * Does NOT remove users (they're at root level).
 * 
 * Usage:
 *   node purge-prod-client.js --client AVII [--force]
 */

import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = { flags: [] };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        params[key] = args[i + 1];
        i++;
      } else {
        params.flags.push(key);
      }
    }
  }
  
  return params;
}

// Get latest migration directory for client
async function getLatestMigrationDir(clientId) {
  const latestLink = path.join(__dirname, 'migrations', `${clientId}-latest`);
  
  try {
    // Try to follow symlink
    const stats = await fs.lstat(latestLink);
    if (stats.isSymbolicLink()) {
      const target = await fs.readlink(latestLink);
      return target;
    }
  } catch (err) {
    // Symlink doesn't exist, find latest directory
  }
  
  // Find latest migration directory for this client
  const migrationsDir = path.join(__dirname, 'migrations');
  const entries = await fs.readdir(migrationsDir);
  
  const clientDirs = entries
    .filter(entry => entry.startsWith(`${clientId}-`) && !entry.endsWith('-latest'))
    .sort()
    .reverse();
  
  if (clientDirs.length === 0) {
    throw new Error(`No migration found for client ${clientId}. Run init-migration.js first.`);
  }
  
  return path.join(migrationsDir, clientDirs[0]);
}

// Update metadata
async function updateMetadata(migrationDir, updates) {
  const metadataPath = path.join(migrationDir, 'metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  
  // Deep merge updates
  if (updates.phases) {
    metadata.phases = { ...metadata.phases, ...updates.phases };
  }
  Object.assign(metadata, updates);
  
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return metadata;
}

// Write log entry
async function writeLog(migrationDir, message, level = 'INFO') {
  const logPath = path.join(migrationDir, 'migration.log');
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level}] ${message}\n`;
  
  try {
    await fs.appendFile(logPath, logEntry);
  } catch (error) {
    await fs.writeFile(logPath, logEntry);
  }
}

// Ask for confirmation
async function confirmPurge(clientId, documentCount) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\n' + '⚠️ '.repeat(10));
    console.log('WARNING: PRODUCTION DATA DELETION');
    console.log('⚠️ '.repeat(10));
    console.log(`\nYou are about to DELETE ${documentCount} documents for client ${clientId} from PRODUCTION.`);
    console.log('This action cannot be undone (except by restoring from backup).\n');
    
    rl.question(`Type "${clientId}" to confirm deletion: `, (answer) => {
      rl.close();
      resolve(answer === clientId);
    });
  });
}

// Delete collection with batching
async function deleteCollection(collectionRef, batchSize = 100) {
  const snapshot = await collectionRef.limit(batchSize).get();
  
  if (snapshot.empty) {
    return 0;
  }
  
  let deletedCount = 0;
  const batch = collectionRef.firestore.batch();
  
  for (const doc of snapshot.docs) {
    // For units, also delete dues subcollection first
    if (collectionRef.path.endsWith('/units')) {
      const duesRef = doc.ref.collection('dues');
      const duesCount = await deleteCollection(duesRef, batchSize);
      deletedCount += duesCount;
    }
    
    batch.delete(doc.ref);
    deletedCount++;
  }
  
  await batch.commit();
  
  // Recurse if there are more documents
  if (snapshot.size === batchSize) {
    deletedCount += await deleteCollection(collectionRef, batchSize);
  }
  
  return deletedCount;
}

// Purge audit logs for client
async function purgeAuditLogs(db, clientId) {
  console.log(`   🗑️  Purging audit logs for ${clientId}...`);
  
  const auditRef = db.collection('auditLogs');
  const snapshot = await auditRef
    .where('clientId', '==', clientId)
    .get();
  
  if (snapshot.empty) {
    console.log(`      ℹ️  No audit logs found`);
    return 0;
  }
  
  let deletedCount = 0;
  const batchSize = 100;
  
  // Delete in batches
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    const batchDocs = snapshot.docs.slice(i, i + batchSize);
    
    batchDocs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    deletedCount += batchDocs.length;
  }
  
  console.log(`      ✓ Deleted ${deletedCount} audit logs`);
  return deletedCount;
}

// Purge client data
async function purgeClientData(db, clientId) {
  console.log(`\n🗑️  Purging client ${clientId} from Production...`);
  
  let totalDeleted = 0;
  
  // First purge audit logs from root collection
  const auditLogCount = await purgeAuditLogs(db, clientId);
  totalDeleted += auditLogCount;
  
  // Check if client exists
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    console.log('   ℹ️  Client does not exist in Production (nothing to purge)');
    return 0;
  }
  
  // Delete subcollections
  const subcollections = [
    'units', 'vendors', 'categories', 
    'paymentMethods', 'users', 'yearEndBalances',
    'auditLogs', 'importMetadata', 'transactions', 'config'
  ];
  
  for (const collection of subcollections) {
    const collectionRef = clientRef.collection(collection);
    const count = await deleteCollection(collectionRef);
    
    if (count > 0) {
      console.log(`   ✓ Deleted ${count} documents from ${collection}`);
      totalDeleted += count;
    }
  }
  
  // Delete client document itself
  await clientRef.delete();
  console.log('   ✓ Deleted client document');
  totalDeleted++;
  
  // Note: We do NOT delete users from root collection
  // They may have access to other clients
  
  return totalDeleted;
}

// Main purge function
async function main() {
  console.log('🗑️  Production Purge Tool');
  console.log('========================');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node purge-prod-client.js --client <CLIENT_ID> [--force]');
    console.error('Example: node purge-prod-client.js --client AVII');
    process.exit(1);
  }
  
  const { client: clientId } = params;
  const force = params.flags.includes('force');
  
  try {
    // Get migration directory
    const migrationDir = await getLatestMigrationDir(clientId);
    console.log(`\n📁 Using migration: ${path.basename(migrationDir)}`);
    
    // Check that backup exists
    const backupPath = path.join(migrationDir, 'prod-backup.json');
    try {
      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf-8'));
      const docCount = backupData.metadata?.statistics?.documentCount || 0;
      
      if (docCount === 0 && !backupData.client) {
        console.log('\n✅ No data to purge (client does not exist in Production)');
        
        await writeLog(migrationDir, 'No data to purge in prod', 'INFO');
        
        console.log('\n📋 Next step:');
        console.log(`   Run: node import-client.js --client ${clientId}`);
        return;
      }
      
      console.log(`\n📊 Backup contains ${docCount} documents`);
    } catch (err) {
      console.error('\n❌ Backup not found! You must backup before purging.');
      console.error(`   Run: node backup-prod-client.js --client ${clientId}`);
      process.exit(1);
    }
    
    // Log start
    await writeLog(migrationDir, 'Purge phase started', 'INFO');
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        purge: {
          status: 'in-progress',
          timestamp: new Date().toISOString()
        }
      }
    });
    
    // Initialize Firebase for Production
    process.env.FIRESTORE_ENV = 'prod';
    const { db } = await initializeFirebase();
    
    // Get document count for confirmation
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.log('\n✅ Client does not exist in Production (nothing to purge)');
      
      await writeLog(migrationDir, 'Client does not exist in prod', 'INFO');
      await updateMetadata(migrationDir, {
        phases: {
          purge: {
            status: 'skipped',
            timestamp: new Date().toISOString(),
            reason: 'Client does not exist'
          }
        }
      });
      
      console.log('\n📋 Next step:');
      console.log(`   Run: node import-client.js --client ${clientId}`);
      return;
    }
    
    // Count documents to be deleted
    let documentCount = 1; // Client document
    const subcollections = [
      'units', 'vendors', 'categories', 
      'paymentMethods', 'users', 'yearEndBalances',
      'auditLogs', 'importMetadata', 'transactions', 'config'
    ];
    
    for (const collection of subcollections) {
      const snapshot = await clientRef.collection(collection).get();
      documentCount += snapshot.size;
      
      // Count dues subcollections
      if (collection === 'units') {
        for (const unitDoc of snapshot.docs) {
          const duesSnapshot = await unitDoc.ref.collection('dues').get();
          documentCount += duesSnapshot.size;
        }
      }
    }
    
    // Confirm purge
    if (!force) {
      const confirmed = await confirmPurge(clientId, documentCount);
      if (!confirmed) {
        console.log('\n❌ Purge cancelled');
        
        await writeLog(migrationDir, 'Purge cancelled by user', 'WARN');
        await updateMetadata(migrationDir, {
          phases: {
            purge: {
              status: 'cancelled',
              timestamp: new Date().toISOString()
            }
          }
        });
        
        process.exit(0);
      }
    }
    
    // Perform purge
    const deletedCount = await purgeClientData(db, clientId);
    
    console.log(`\n✅ Purged ${deletedCount} documents from Production`);
    
    // Log results
    await writeLog(migrationDir, `Purge complete: ${deletedCount} documents deleted`, 'INFO');
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        purge: {
          status: 'completed',
          timestamp: new Date().toISOString(),
          documentsDeleted: deletedCount
        }
      }
    });
    
    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Purge Summary');
    console.log('='.repeat(50));
    console.log(`✅ Client: ${clientId}`);
    console.log(`✅ Documents deleted: ${deletedCount}`);
    console.log('✅ Backup available for restore if needed');
    
    console.log('\n📋 Next step:');
    console.log(`   Run: node import-client.js --client ${clientId}`);
    
  } catch (error) {
    console.error('\n❌ Purge failed:', error.message);
    console.error(error);
    
    // Try to log error
    try {
      const migrationDir = await getLatestMigrationDir(clientId);
      await writeLog(migrationDir, `Purge failed: ${error.message}`, 'ERROR');
      
      await updateMetadata(migrationDir, {
        phases: {
          purge: {
            status: 'failed',
            timestamp: new Date().toISOString(),
            error: error.message
          }
        }
      });
    } catch (logError) {
      // Ignore logging errors
    }
    
    process.exit(1);
  }
}

// Run purge
main();
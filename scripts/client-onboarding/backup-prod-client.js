#!/usr/bin/env node

/**
 * Backup Production Client Data
 * 
 * Creates a backup of existing client data in Production before migration.
 * This backup can be used to restore if migration fails.
 * 
 * Usage:
 *   node backup-prod-client.js --client AVII
 */

import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    params[key] = value;
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

// Export collection with batching (same as export-client.js)
async function exportCollection(collectionRef, path = []) {
  const batchSize = 500;
  const documents = {};
  let lastDoc = null;
  let hasMore = true;
  let totalDocs = 0;
  
  const collectionPath = path.join('/');
  
  while (hasMore) {
    let query = collectionRef.orderBy('__name__').limit(batchSize);
    
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      hasMore = false;
      break;
    }
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      documents[doc.id] = data;
      totalDocs++;
      
      // For units, also export the dues subcollection
      if (path[path.length - 1] === 'units') {
        const duesRef = doc.ref.collection('dues');
        const duesSnapshot = await duesRef.get();
        
        if (!duesSnapshot.empty) {
          const duesDocs = {};
          duesSnapshot.forEach(duesDoc => {
            duesDocs[duesDoc.id] = duesDoc.data();
          });
          
          // Store dues as a nested property
          documents[doc.id].__subcollections = {
            dues: duesDocs
          };
        }
      }
    }
    
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.size === batchSize;
  }
  
  return { documents, count: totalDocs };
}

// Backup client data from Production
async function backupClientData(db, clientId) {
  const backupData = {
    metadata: {
      clientId,
      backedUpAt: new Date().toISOString(),
      environment: 'prod'
    },
    client: null,
    subcollections: {},
    users: []
  };
  
  console.log(`\n💾 Backing up client ${clientId} from Production...`);
  
  // Check if client exists
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    console.log('   ℹ️  Client does not exist in Production (will be created)');
    return backupData;
  }
  
  // Backup main client document
  backupData.client = clientDoc.data();
  console.log('   ✓ Backed up client document');
  
  // Backup subcollections
  const subcollections = [
    'units', 'vendors', 'categories', 
    'paymentMethods', 'users', 'yearEndBalances',
    'auditLogs', 'importMetadata', 'transactions', 'config'
  ];
  
  let totalDocCount = 1; // Start with client document
  
  for (const collection of subcollections) {
    const collectionRef = clientRef.collection(collection);
    const { documents, count } = await exportCollection(collectionRef, ['clients', clientId, collection]);
    
    if (count > 0) {
      backupData.subcollections[collection] = documents;
      totalDocCount += count;
      console.log(`   ✓ Backed up ${count} documents from ${collection}`);
      
      // Count nested dues if units
      if (collection === 'units') {
        let duesCount = 0;
        for (const unitData of Object.values(documents)) {
          if (unitData.__subcollections?.dues) {
            duesCount += Object.keys(unitData.__subcollections.dues).length;
          }
        }
        if (duesCount > 0) {
          totalDocCount += duesCount;
          console.log(`     ✓ Including ${duesCount} dues documents`);
        }
      }
    }
  }
  
  // Backup users from root-level that have access to this client
  console.log('\n   Backing up user access...');
  const usersSnapshot = await db.collection('users').get();
  let userCount = 0;
  
  usersSnapshot.forEach(userDoc => {
    const userData = userDoc.data();
    // Check if user has access to this client
    if (userData.clients && userData.clients.includes(clientId)) {
      backupData.users.push({
        uid: userDoc.id,
        ...userData
      });
      userCount++;
    }
  });
  
  console.log(`   ✓ Found ${userCount} users with access to ${clientId}`);
  
  // Add statistics
  backupData.metadata.statistics = {
    documentCount: totalDocCount,
    userCount
  };
  
  return backupData;
}

// Main backup function
async function main() {
  console.log('💾 Production Backup Tool');
  console.log('========================');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node backup-prod-client.js --client <CLIENT_ID>');
    console.error('Example: node backup-prod-client.js --client AVII');
    process.exit(1);
  }
  
  const { client: clientId } = params;
  
  try {
    // Get migration directory
    const migrationDir = await getLatestMigrationDir(clientId);
    console.log(`\n📁 Using migration: ${path.basename(migrationDir)}`);
    
    // Check if backup already exists
    const backupPath = path.join(migrationDir, 'prod-backup.json');
    try {
      await fs.access(backupPath);
      console.log('\n⚠️  Backup already exists. Overwriting...');
    } catch (err) {
      // File doesn't exist, that's fine
    }
    
    // Log start
    await writeLog(migrationDir, 'Backup phase started', 'INFO');
    await writeLog(migrationDir, `Backing up ${clientId} from prod`, 'INFO');
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        backup: {
          status: 'in-progress',
          timestamp: new Date().toISOString()
        }
      }
    });
    
    // Initialize Firebase for Production
    process.env.FIRESTORE_ENV = 'prod';
    const { db } = await initializeFirebase();
    
    // Backup client data
    const backupData = await backupClientData(db, clientId);
    
    // Save backup
    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`\n✅ Saved backup to ${path.basename(backupPath)}`);
    
    // Log results
    const stats = backupData.metadata.statistics || { documentCount: 0, userCount: 0 };
    await writeLog(migrationDir, `Backup complete: ${stats.documentCount} documents, ${stats.userCount} users`, 'INFO');
    
    // Update checksums with backup info
    const checksumsPath = path.join(migrationDir, 'checksums.json');
    const checksums = JSON.parse(await fs.readFile(checksumsPath, 'utf-8'));
    checksums.prodBackup = {
      timestamp: backupData.metadata.backedUpAt,
      exists: backupData.client !== null,
      documentCount: stats.documentCount,
      userCount: stats.userCount
    };
    await fs.writeFile(checksumsPath, JSON.stringify(checksums, null, 2));
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        backup: {
          status: 'completed',
          timestamp: new Date().toISOString(),
          documentCount: stats.documentCount
        }
      }
    });
    
    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Backup Summary');
    console.log('='.repeat(50));
    console.log(`✅ Client: ${clientId}`);
    
    if (backupData.client === null) {
      console.log('ℹ️  Client does not exist in Production');
      console.log('   (will be created during import)');
    } else {
      console.log(`✅ Documents backed up: ${stats.documentCount}`);
      console.log(`✅ Users with access: ${stats.userCount}`);
    }
    
    console.log('\n📋 Next step:');
    console.log(`   Run: node prepare-user-mapping.js --client ${clientId}`);
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    console.error(error);
    
    // Try to log error
    try {
      const migrationDir = await getLatestMigrationDir(clientId);
      await writeLog(migrationDir, `Backup failed: ${error.message}`, 'ERROR');
      
      await updateMetadata(migrationDir, {
        phases: {
          backup: {
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

// Run backup
main();
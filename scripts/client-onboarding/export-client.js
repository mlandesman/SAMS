#!/usr/bin/env node

/**
 * Export Client Data from Dev
 * 
 * Exports all client data from Dev environment to migration directory
 * including:
 * - Client document with accounts array
 * - All subcollections (units, vendors, categories, etc.)
 * - Nested subcollections (dues under units)
 * - User mappings for the client
 * 
 * Usage:
 *   node export-client.js --client AVII
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

// Export collection with batching
async function exportCollection(collectionRef, path = []) {
  const batchSize = 500;
  const documents = {};
  let lastDoc = null;
  let hasMore = true;
  let totalDocs = 0;
  
  const collectionPath = path.join('/');
  console.log(`   Exporting ${collectionPath || 'root'}...`);
  
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
  
  if (totalDocs > 0) {
    console.log(`     ✓ Exported ${totalDocs} documents from ${collectionPath || 'root'}`);
  }
  
  return documents;
}

// Export client data
async function exportClientData(db, clientId) {
  const exportData = {
    metadata: {
      clientId,
      exportedAt: new Date().toISOString(),
      environment: 'dev'
    },
    client: null,
    subcollections: {},
    users: []
  };
  
  console.log(`\n📦 Exporting client ${clientId} from Dev...`);
  
  // Export main client document
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    throw new Error(`Client ${clientId} does not exist in Dev environment`);
  }
  
  exportData.client = clientDoc.data();
  console.log('   ✓ Exported client document');
  
  // Export subcollections
  const subcollections = [
    'units', 'vendors', 'categories', 
    'paymentMethods', 'users', 'yearEndBalances',
    'auditLogs', 'importMetadata', 'transactions', 'config'
  ];
  
  for (const collection of subcollections) {
    const collectionRef = clientRef.collection(collection);
    const documents = await exportCollection(collectionRef, ['clients', clientId, collection]);
    
    if (Object.keys(documents).length > 0) {
      exportData.subcollections[collection] = documents;
    }
  }
  
  // Export users from root-level users collection that have access to this client
  console.log('\n   Exporting user mappings...');
  const usersSnapshot = await db.collection('users').get();
  let userCount = 0;
  
  usersSnapshot.forEach(userDoc => {
    const userData = userDoc.data();
    // Check if user has access to this client
    if (userData.clients && userData.clients.includes(clientId)) {
      exportData.users.push({
        uid: userDoc.id,
        ...userData
      });
      userCount++;
    }
  });
  
  console.log(`     ✓ Found ${userCount} users with access to ${clientId}`);
  
  // Calculate statistics
  const stats = {
    documentCount: 1, // Client document
    subcollectionCounts: {}
  };
  
  for (const [collection, documents] of Object.entries(exportData.subcollections)) {
    let count = Object.keys(documents).length;
    stats.subcollectionCounts[collection] = count;
    stats.documentCount += count;
    
    // Count nested dues documents
    if (collection === 'units') {
      let duesCount = 0;
      for (const unitData of Object.values(documents)) {
        if (unitData.__subcollections?.dues) {
          duesCount += Object.keys(unitData.__subcollections.dues).length;
        }
      }
      if (duesCount > 0) {
        stats.subcollectionCounts['units/dues'] = duesCount;
        stats.documentCount += duesCount;
      }
    }
  }
  
  exportData.metadata.statistics = stats;
  
  return exportData;
}

// Main export function
async function main() {
  console.log('📤 Client Export Tool');
  console.log('====================');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node export-client.js --client <CLIENT_ID>');
    console.error('Example: node export-client.js --client AVII');
    process.exit(1);
  }
  
  const { client: clientId } = params;
  
  try {
    // Get migration directory
    const migrationDir = await getLatestMigrationDir(clientId);
    console.log(`\n📁 Using migration: ${path.basename(migrationDir)}`);
    
    // Check if export already exists
    const exportPath = path.join(migrationDir, 'dev-export.json');
    try {
      await fs.access(exportPath);
      console.log('\n⚠️  Export already exists. Overwriting...');
    } catch (err) {
      // File doesn't exist, that's fine
    }
    
    // Log start
    await writeLog(migrationDir, 'Export phase started', 'INFO');
    await writeLog(migrationDir, `Exporting ${clientId} from dev`, 'INFO');
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        export: {
          status: 'in-progress',
          timestamp: new Date().toISOString()
        }
      }
    });
    
    // Initialize Firebase for Dev
    process.env.FIRESTORE_ENV = 'dev';
    const { db } = await initializeFirebase();
    
    // Export client data
    const exportData = await exportClientData(db, clientId);
    
    // Save export
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
    console.log(`\n✅ Saved export to ${path.basename(exportPath)}`);
    
    // Log results
    const stats = exportData.metadata.statistics;
    await writeLog(migrationDir, `Export complete: ${stats.documentCount} total documents`, 'INFO');
    await writeLog(migrationDir, `Users exported: ${exportData.users.length}`, 'INFO');
    
    // Update checksums with export info
    const checksumsPath = path.join(migrationDir, 'checksums.json');
    const checksums = JSON.parse(await fs.readFile(checksumsPath, 'utf-8'));
    checksums.export = {
      timestamp: exportData.metadata.exportedAt,
      documentCount: stats.documentCount,
      subcollectionCounts: stats.subcollectionCounts,
      userCount: exportData.users.length
    };
    await fs.writeFile(checksumsPath, JSON.stringify(checksums, null, 2));
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        export: {
          status: 'completed',
          timestamp: new Date().toISOString(),
          documentCount: stats.documentCount
        }
      }
    });
    
    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Export Summary');
    console.log('='.repeat(50));
    console.log(`✅ Client: ${clientId}`);
    console.log(`✅ Total documents: ${stats.documentCount}`);
    console.log('\n📁 Document counts:');
    Object.entries(stats.subcollectionCounts).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    console.log(`\n👥 Users with access: ${exportData.users.length}`);
    
    console.log('\n📋 Next steps:');
    console.log(`   1. Run: node backup-prod-client.js --client ${clientId}`);
    console.log(`   2. Run: node prepare-user-mapping.js --client ${clientId}`);
    console.log(`   3. Run: node purge-prod-client.js --client ${clientId}`);
    console.log(`   4. Run: node migrate-users.js --client ${clientId}`);
    console.log(`   5. Run: node import-client.js --client ${clientId}`);
    console.log(`   6. Run: node verify-migration.js --client ${clientId}`);
    
  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.error(error);
    
    // Try to log error
    try {
      const migrationDir = await getLatestMigrationDir(clientId);
      await writeLog(migrationDir, `Export failed: ${error.message}`, 'ERROR');
      
      await updateMetadata(migrationDir, {
        phases: {
          export: {
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

// Run export
main();
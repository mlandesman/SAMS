#!/usr/bin/env node

/**
 * Selective Purge Production Client Data
 * 
 * Safely removes specific client data collections from Production.
 * Allows selective purging of collections to preserve static data.
 * 
 * Usage:
 *   node purge-prod-client-selective.js --client AVII [options]
 * 
 * Options:
 *   --skip-users         Don't purge users collection
 *   --skip-clients       Don't purge client config/settings
 *   --skip-units         Don't purge units
 *   --skip-vendors       Don't purge vendors
 *   --skip-categories    Don't purge categories
 *   --skip-accounts      Don't purge accounts
 *   --only <collections> Only purge specific collections (comma-separated)
 *                        Example: --only transactions,hoadues
 *   --force              Skip confirmation prompt
 *   --dry-run            Show what would be deleted without actually deleting
 * 
 * Examples:
 *   # Purge only transactions and HOA dues:
 *   node purge-prod-client-selective.js --client AVII --only transactions,hoadues
 *   
 *   # Purge everything except users and client config:
 *   node purge-prod-client-selective.js --client AVII --skip-users --skip-clients
 *   
 *   # Dry run to see what would be deleted:
 *   node purge-prod-client-selective.js --client AVII --only transactions --dry-run
 */

import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Available collections for selective purging
const PURGEABLE_COLLECTIONS = {
  clients: { 
    name: 'Client Config/Settings', 
    isRoot: false,
    description: 'Client configuration and settings'
  },
  users: { 
    name: 'Users', 
    isRoot: false,
    description: 'User accounts within the client'
  },
  units: { 
    name: 'Units', 
    isRoot: false,
    hasSubcollections: ['dues'],
    description: 'Unit information and HOA dues subcollections'
  },
  transactions: { 
    name: 'Transactions', 
    isRoot: false,
    description: 'Financial transactions'
  },
  hoadues: { 
    name: 'HOA Dues', 
    isRoot: false,
    description: 'HOA dues records'
  },
  categories: { 
    name: 'Categories', 
    isRoot: false,
    description: 'Transaction categories'
  },
  vendors: { 
    name: 'Vendors', 
    isRoot: false,
    description: 'Vendor records'
  },
  yearEndBalances: { 
    name: 'Year-End Balances', 
    isRoot: false,
    description: 'Year-end balance records'
  },
  accounts: { 
    name: 'Accounts', 
    isRoot: false,
    description: 'Chart of accounts'
  },
  paymentMethods: {
    name: 'Payment Methods',
    isRoot: false,
    description: 'Payment method records'
  },
  auditLogs: {
    name: 'Audit Logs',
    isRoot: false,
    description: 'Audit log records for the client'
  },
  importMetadata: {
    name: 'Import Metadata',
    isRoot: false,
    description: 'Import tracking metadata'
  },
  config: {
    name: 'Config',
    isRoot: false,
    description: 'Additional configuration data'
  }
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = { flags: [], skip: [], only: null };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      
      // Handle skip flags
      if (key.startsWith('skip-')) {
        const collection = key.replace('skip-', '');
        params.skip.push(collection);
      }
      // Handle only parameter
      else if (key === 'only' && i + 1 < args.length) {
        params.only = args[i + 1].split(',');
        i++;
      }
      // Handle other parameters with values
      else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        params[key] = args[i + 1];
        i++;
      }
      // Handle boolean flags
      else {
        params.flags.push(key);
      }
    }
  }
  
  return params;
}

// Get collections to purge based on parameters
function getCollectionsToPurge(params) {
  let collections = Object.keys(PURGEABLE_COLLECTIONS);
  
  // If --only is specified, use only those collections
  if (params.only && params.only.length > 0) {
    const validCollections = params.only.filter(c => collections.includes(c));
    const invalidCollections = params.only.filter(c => !collections.includes(c));
    
    if (invalidCollections.length > 0) {
      console.warn(`⚠️  Warning: Invalid collections specified: ${invalidCollections.join(', ')}`);
    }
    
    return validCollections;
  }
  
  // Otherwise, use all collections except those in skip list
  return collections.filter(c => !params.skip.includes(c));
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
  try {
    await fs.access(migrationsDir);
  } catch {
    // Create migrations directory if it doesn't exist
    await fs.mkdir(migrationsDir, { recursive: true });
    return null;
  }
  
  const entries = await fs.readdir(migrationsDir);
  
  const clientDirs = entries
    .filter(entry => entry.startsWith(`${clientId}-`) && !entry.endsWith('-latest'))
    .sort()
    .reverse();
  
  if (clientDirs.length === 0) {
    return null;
  }
  
  return path.join(migrationsDir, clientDirs[0]);
}

// Update metadata
async function updateMetadata(migrationDir, updates) {
  if (!migrationDir) return null;
  
  const metadataPath = path.join(migrationDir, 'metadata.json');
  try {
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    
    // Deep merge updates
    if (updates.phases) {
      metadata.phases = { ...metadata.phases, ...updates.phases };
    }
    Object.assign(metadata, updates);
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    return metadata;
  } catch (err) {
    // Metadata doesn't exist
    return null;
  }
}

// Write log entry
async function writeLog(migrationDir, message, level = 'INFO') {
  if (!migrationDir) return;
  
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
async function confirmPurge(clientId, collectionsToPurge, documentCounts, isDryRun) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\n' + '⚠️ '.repeat(10));
    console.log(isDryRun ? 'DRY RUN MODE - NO DATA WILL BE DELETED' : 'WARNING: PRODUCTION DATA DELETION');
    console.log('⚠️ '.repeat(10));
    
    console.log(`\nClient: ${clientId}`);
    console.log('\nCollections to purge:');
    
    let totalDocs = 0;
    for (const collection of collectionsToPurge) {
      const count = documentCounts[collection] || 0;
      totalDocs += count;
      console.log(`  - ${PURGEABLE_COLLECTIONS[collection].name}: ${count} documents`);
    }
    
    console.log(`\nTotal documents to ${isDryRun ? 'analyze' : 'delete'}: ${totalDocs}`);
    
    if (!isDryRun) {
      console.log('\nThis action cannot be undone (except by restoring from backup).\n');
    }
    
    const confirmText = isDryRun ? 'analyze' : clientId;
    rl.question(`Type "${confirmText}" to confirm: `, (answer) => {
      rl.close();
      resolve(answer === confirmText);
    });
  });
}

// Delete collection with batching
async function deleteCollection(collectionRef, batchSize = 100, dryRun = false) {
  const snapshot = await collectionRef.limit(batchSize).get();
  
  if (snapshot.empty) {
    return 0;
  }
  
  let deletedCount = 0;
  
  if (!dryRun) {
    const batch = collectionRef.firestore.batch();
    
    for (const doc of snapshot.docs) {
      // For units, also delete dues subcollection first
      if (collectionRef.path.endsWith('/units')) {
        const duesRef = doc.ref.collection('dues');
        const duesCount = await deleteCollection(duesRef, batchSize, dryRun);
        deletedCount += duesCount;
      }
      
      batch.delete(doc.ref);
      deletedCount++;
    }
    
    await batch.commit();
  } else {
    // In dry run mode, just count
    deletedCount = snapshot.size;
    
    // For units, also count dues subcollection
    if (collectionRef.path.endsWith('/units')) {
      for (const doc of snapshot.docs) {
        const duesRef = doc.ref.collection('dues');
        const duesSnapshot = await duesRef.get();
        deletedCount += duesSnapshot.size;
      }
    }
  }
  
  // Recurse if there are more documents
  if (snapshot.size === batchSize) {
    deletedCount += await deleteCollection(collectionRef, batchSize, dryRun);
  }
  
  return deletedCount;
}

// Count documents in collections
async function countDocuments(db, clientId, collectionsToPurge) {
  const counts = {};
  const clientRef = db.collection('clients').doc(clientId);
  
  // Count client document itself if 'clients' is in the purge list
  if (collectionsToPurge.includes('clients')) {
    const clientDoc = await clientRef.get();
    counts.clients = clientDoc.exists ? 1 : 0;
  }
  
  // Count documents in each collection
  for (const collection of collectionsToPurge) {
    if (collection === 'clients') continue; // Already counted above
    
    const collectionRef = clientRef.collection(collection);
    const snapshot = await collectionRef.get();
    counts[collection] = snapshot.size;
    
    // For units, also count dues subcollections
    if (collection === 'units') {
      let duesCount = 0;
      for (const unitDoc of snapshot.docs) {
        const duesSnapshot = await unitDoc.ref.collection('dues').get();
        duesCount += duesSnapshot.size;
      }
      counts[collection] += duesCount;
    }
  }
  
  return counts;
}

// Purge audit logs for client
async function purgeAuditLogs(db, clientId, dryRun = false) {
  console.log(`   ${dryRun ? '🔍' : '🗑️'}  ${dryRun ? 'Counting' : 'Purging'} root-level audit logs for ${clientId}...`);
  
  const auditRef = db.collection('auditLogs');
  const snapshot = await auditRef
    .where('clientId', '==', clientId)
    .get();
  
  if (snapshot.empty) {
    console.log(`      ℹ️  No root-level audit logs found`);
    return 0;
  }
  
  if (dryRun) {
    console.log(`      🔍 Would delete ${snapshot.size} root-level audit logs`);
    return snapshot.size;
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
  
  console.log(`      ✓ Deleted ${deletedCount} root-level audit logs`);
  return deletedCount;
}

// Selectively purge client data
async function selectivePurgeClientData(db, clientId, collectionsToPurge, dryRun = false) {
  console.log(`\n${dryRun ? '🔍 Analyzing' : '🗑️  Purging'} client ${clientId} from Production...`);
  
  let totalDeleted = 0;
  
  // First check if we should purge root-level audit logs
  if (collectionsToPurge.includes('auditLogs')) {
    const auditLogCount = await purgeAuditLogs(db, clientId, dryRun);
    totalDeleted += auditLogCount;
  }
  
  // Check if client exists
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists && collectionsToPurge.includes('clients')) {
    console.log('   ℹ️  Client document does not exist in Production');
  }
  
  // Process each selected collection
  for (const collection of collectionsToPurge) {
    if (collection === 'clients') {
      // Handle client document itself
      if (clientDoc.exists) {
        if (!dryRun) {
          await clientRef.delete();
          console.log('   ✓ Deleted client document');
        } else {
          console.log('   🔍 Would delete client document');
        }
        totalDeleted++;
      }
    } else if (collection !== 'auditLogs') { // auditLogs already handled above
      // Handle subcollections
      const collectionRef = clientRef.collection(collection);
      const count = await deleteCollection(collectionRef, 100, dryRun);
      
      if (count > 0) {
        const action = dryRun ? 'Would delete' : 'Deleted';
        console.log(`   ${dryRun ? '🔍' : '✓'} ${action} ${count} documents from ${collection}`);
        totalDeleted += count;
      }
    }
  }
  
  return totalDeleted;
}

// Display purge plan
function displayPurgePlan(collectionsToPurge, skippedCollections) {
  console.log('\n📋 Purge Plan:');
  console.log('='.repeat(50));
  
  if (collectionsToPurge.length > 0) {
    console.log('\n✅ Collections to purge:');
    for (const collection of collectionsToPurge) {
      const info = PURGEABLE_COLLECTIONS[collection];
      console.log(`   - ${info.name}: ${info.description}`);
    }
  }
  
  if (skippedCollections.length > 0) {
    console.log('\n⏭️  Collections to skip:');
    for (const collection of skippedCollections) {
      const info = PURGEABLE_COLLECTIONS[collection];
      console.log(`   - ${info.name}: ${info.description}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
}

// Main purge function
async function main() {
  console.log('🗑️  Selective Production Purge Tool');
  console.log('====================================');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node purge-prod-client-selective.js --client <CLIENT_ID> [options]');
    console.error('\nOptions:');
    console.error('  --skip-users         Don\'t purge users collection');
    console.error('  --skip-clients       Don\'t purge client config/settings');
    console.error('  --skip-<collection>  Skip any specific collection');
    console.error('  --only <collections> Only purge specific collections (comma-separated)');
    console.error('  --force              Skip confirmation prompt');
    console.error('  --dry-run            Show what would be deleted without deleting');
    console.error('\nExamples:');
    console.error('  node purge-prod-client-selective.js --client AVII --only transactions,hoadues');
    console.error('  node purge-prod-client-selective.js --client AVII --skip-users --skip-clients');
    process.exit(1);
  }
  
  const { client: clientId } = params;
  const force = params.flags.includes('force');
  const dryRun = params.flags.includes('dry-run');
  
  try {
    // Get collections to purge
    const collectionsToPurge = getCollectionsToPurge(params);
    const allCollections = Object.keys(PURGEABLE_COLLECTIONS);
    const skippedCollections = allCollections.filter(c => !collectionsToPurge.includes(c));
    
    if (collectionsToPurge.length === 0) {
      console.log('\n⚠️  No collections selected for purging.');
      console.log('Use --only to specify collections or remove --skip flags.');
      process.exit(0);
    }
    
    // Display purge plan
    displayPurgePlan(collectionsToPurge, skippedCollections);
    
    // Get migration directory (optional - may not exist)
    const migrationDir = await getLatestMigrationDir(clientId);
    if (migrationDir) {
      console.log(`\n📁 Using migration: ${path.basename(migrationDir)}`);
    } else {
      console.log('\n📁 No migration directory found (will proceed without migration tracking)');
    }
    
    // Log start
    await writeLog(migrationDir, `Selective purge ${dryRun ? 'dry run' : 'phase'} started`, 'INFO');
    await writeLog(migrationDir, `Collections to purge: ${collectionsToPurge.join(', ')}`, 'INFO');
    
    // Update metadata phase
    if (migrationDir && !dryRun) {
      await updateMetadata(migrationDir, {
        phases: {
          selectivePurge: {
            status: 'in-progress',
            timestamp: new Date().toISOString(),
            collections: collectionsToPurge
          }
        }
      });
    }
    
    // Initialize Firebase for Production
    process.env.FIRESTORE_ENV = 'prod';
    const { db } = await initializeFirebase();
    
    // Count documents to be affected
    console.log('\n📊 Counting documents...');
    const documentCounts = await countDocuments(db, clientId, collectionsToPurge);
    
    // Calculate total
    let totalCount = 0;
    for (const collection of collectionsToPurge) {
      totalCount += documentCounts[collection] || 0;
    }
    
    if (totalCount === 0) {
      console.log('\n✅ No documents found to purge');
      
      await writeLog(migrationDir, 'No documents found to purge', 'INFO');
      if (migrationDir && !dryRun) {
        await updateMetadata(migrationDir, {
          phases: {
            selectivePurge: {
              status: 'completed',
              timestamp: new Date().toISOString(),
              collections: collectionsToPurge,
              documentsDeleted: 0
            }
          }
        });
      }
      
      process.exit(0);
    }
    
    // Confirm purge
    if (!force) {
      const confirmed = await confirmPurge(clientId, collectionsToPurge, documentCounts, dryRun);
      if (!confirmed) {
        console.log(`\n❌ ${dryRun ? 'Analysis' : 'Purge'} cancelled`);
        
        await writeLog(migrationDir, `${dryRun ? 'Analysis' : 'Purge'} cancelled by user`, 'WARN');
        if (migrationDir && !dryRun) {
          await updateMetadata(migrationDir, {
            phases: {
              selectivePurge: {
                status: 'cancelled',
                timestamp: new Date().toISOString()
              }
            }
          });
        }
        
        process.exit(0);
      }
    }
    
    // Perform purge or dry run
    const deletedCount = await selectivePurgeClientData(db, clientId, collectionsToPurge, dryRun);
    
    if (dryRun) {
      console.log(`\n🔍 Dry run complete: ${deletedCount} documents would be deleted`);
    } else {
      console.log(`\n✅ Purged ${deletedCount} documents from Production`);
    }
    
    // Log results
    await writeLog(migrationDir, `${dryRun ? 'Dry run' : 'Purge'} complete: ${deletedCount} documents ${dryRun ? 'would be' : ''} deleted`, 'INFO');
    
    // Update metadata phase
    if (migrationDir && !dryRun) {
      await updateMetadata(migrationDir, {
        phases: {
          selectivePurge: {
            status: 'completed',
            timestamp: new Date().toISOString(),
            collections: collectionsToPurge,
            documentsDeleted: deletedCount
          }
        }
      });
    }
    
    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log(`📊 ${dryRun ? 'Dry Run' : 'Purge'} Summary`);
    console.log('='.repeat(50));
    console.log(`✅ Client: ${clientId}`);
    console.log(`✅ Collections ${dryRun ? 'analyzed' : 'purged'}: ${collectionsToPurge.join(', ')}`);
    console.log(`✅ Documents ${dryRun ? 'that would be' : ''} deleted: ${deletedCount}`);
    
    if (!dryRun) {
      console.log('\n📋 Next steps:');
      console.log(`   1. Run selective import: ./run-complete-import-selective.sh ${clientId}`);
      console.log(`   2. Or import specific collections: ./run-complete-import-selective.sh ${clientId} --only ${collectionsToPurge.join(',')}`);
    }
    
  } catch (error) {
    console.error('\n❌ Purge failed:', error.message);
    console.error(error);
    
    // Try to log error
    try {
      const migrationDir = await getLatestMigrationDir(clientId);
      await writeLog(migrationDir, `Purge failed: ${error.message}`, 'ERROR');
      
      if (!dryRun) {
        await updateMetadata(migrationDir, {
          phases: {
            selectivePurge: {
              status: 'failed',
              timestamp: new Date().toISOString(),
              error: error.message
            }
          }
        });
      }
    } catch (logError) {
      // Ignore logging errors
    }
    
    process.exit(1);
  }
}

// Run purge
main();
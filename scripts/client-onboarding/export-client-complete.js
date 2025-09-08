#!/usr/bin/env node

/**
 * Export Client Data - Complete Version
 * 
 * Exports:
 * 1. Client document and ALL subcollections (recursively to any depth)
 * 2. Root-level auditLogs for this client
 * 3. Root-level users that have access to this client
 * 
 * Usage:
 *   node export-client-complete.js --client AVII
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
    const stats = await fs.lstat(latestLink);
    if (stats.isSymbolicLink()) {
      const target = await fs.readlink(latestLink);
      return target;
    }
  } catch (err) {
    // Symlink doesn't exist, find latest directory
  }
  
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

// Recursively export a document and ALL its subcollections to any depth
async function exportDocumentWithAllSubcollections(docRef, path = []) {
  const doc = await docRef.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const docData = {
    ...doc.data(),
    __subcollections: {}
  };
  
  // Dynamically discover all subcollections
  const subcollections = await docRef.listCollections();
  
  for (const subcollection of subcollections) {
    const subcollName = subcollection.id;
    const indent = '  '.repeat(path.length + 1);
    console.log(`${indent}📁 Discovering ${subcollName}...`);
    
    const subcollData = {};
    const snapshot = await subcollection.get();
    
    for (const subdoc of snapshot.docs) {
      // Recursively export nested documents and their subcollections
      subcollData[subdoc.id] = await exportDocumentWithAllSubcollections(subdoc.ref, [...path, subcollName]);
    }
    
    if (Object.keys(subcollData).length > 0) {
      docData.__subcollections[subcollName] = subcollData;
      console.log(`${indent}✓ Exported ${Object.keys(subcollData).length} ${subcollName} documents`);
    }
  }
  
  // Remove __subcollections if empty
  if (Object.keys(docData.__subcollections).length === 0) {
    delete docData.__subcollections;
  }
  
  return docData;
}

// Export audit logs for a specific client
async function exportAuditLogs(db, clientId) {
  console.log('\n📊 Exporting audit logs...');
  
  const auditLogs = [];
  const auditRef = db.collection('auditLogs');
  
  // Query for audit logs belonging to this client
  const snapshot = await auditRef
    .where('clientId', '==', clientId)
    .get();
  
  snapshot.forEach(doc => {
    auditLogs.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  console.log(`   ✓ Found ${auditLogs.length} audit logs for ${clientId}`);
  
  return auditLogs;
}

// Export client data with complete recursive discovery
async function exportClientData(db, clientId) {
  const exportData = {
    metadata: {
      clientId,
      exportedAt: new Date().toISOString(),
      environment: 'dev',
      discoveredCollections: [],
      rootCollections: []
    },
    client: null,
    subcollections: {},
    users: [],
    auditLogs: []
  };
  
  console.log(`\n📦 Exporting client ${clientId} from Dev (complete recursive discovery)...`);
  
  // Export main client document
  const clientRef = db.collection('clients').doc(clientId);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    throw new Error(`Client ${clientId} does not exist in Dev environment`);
  }
  
  exportData.client = clientDoc.data();
  console.log('   ✓ Exported client document');
  
  // Dynamically discover and export ALL subcollections recursively
  console.log('\n📂 Discovering all subcollections (recursive)...');
  const subcollections = await clientRef.listCollections();
  
  const stats = {
    documentCount: 1, // Client document
    subcollectionCounts: {},
    nestedCollections: []
  };
  
  for (const subcollection of subcollections) {
    const collectionName = subcollection.id;
    console.log(`\n   📁 Processing ${collectionName}...`);
    
    exportData.metadata.discoveredCollections.push(collectionName);
    
    const documents = {};
    const snapshot = await subcollection.get();
    
    for (const doc of snapshot.docs) {
      // Export EVERY document with ALL its nested subcollections recursively
      documents[doc.id] = await exportDocumentWithAllSubcollections(doc.ref, [collectionName]);
    }
    
    if (Object.keys(documents).length > 0) {
      exportData.subcollections[collectionName] = documents;
      stats.subcollectionCounts[collectionName] = Object.keys(documents).length;
      stats.documentCount += Object.keys(documents).length;
      
      // Count all nested documents
      for (const [docId, docData] of Object.entries(documents)) {
        if (docData?.__subcollections) {
          const nestedStats = countNestedDocuments(docData.__subcollections, `${collectionName}/${docId}`);
          for (const [path, count] of Object.entries(nestedStats)) {
            stats.subcollectionCounts[path] = (stats.subcollectionCounts[path] || 0) + count;
            stats.documentCount += count;
            if (!stats.nestedCollections.includes(path)) {
              stats.nestedCollections.push(path);
            }
          }
        }
      }
      
      console.log(`   ✓ Exported ${Object.keys(documents).length} documents from ${collectionName}`);
    } else {
      console.log(`   ℹ️  No documents in ${collectionName}`);
    }
  }
  
  // Export audit logs from root level
  exportData.auditLogs = await exportAuditLogs(db, clientId);
  if (exportData.auditLogs.length > 0) {
    exportData.metadata.rootCollections.push('auditLogs');
    stats.documentCount += exportData.auditLogs.length;
    stats.subcollectionCounts['auditLogs'] = exportData.auditLogs.length;
  }
  
  // Export users from root-level users collection that have access to this client
  console.log('\n👥 Exporting user mappings...');
  const usersSnapshot = await db.collection('users').get();
  let userCount = 0;
  
  usersSnapshot.forEach(userDoc => {
    const userData = userDoc.data();
    // Check if user has access to this client
    // Check multiple possible field structures:
    // 1. clients: ["MTC", "AVII"] - array format
    // 2. clientAccess: { MTC: {...} } - object with client as key
    // 3. clientId: "MTC" - simple string format
    const hasAccess = (userData.clients && userData.clients.includes(clientId)) ||
                      (userData.clientAccess && userData.clientAccess[clientId]) ||
                      (userData.clientId === clientId);
    
    if (hasAccess) {
      exportData.users.push({
        uid: userDoc.id,
        ...userData
      });
      userCount++;
    }
  });
  
  console.log(`   ✓ Found ${userCount} users with access to ${clientId}`);
  if (userCount > 0) {
    exportData.metadata.rootCollections.push('users');
  }
  
  exportData.metadata.statistics = stats;
  
  return exportData;
}

// Helper function to count nested documents
function countNestedDocuments(subcollections, basePath = '') {
  const counts = {};
  
  for (const [collName, collData] of Object.entries(subcollections)) {
    const collPath = basePath ? `${basePath}/${collName}` : collName;
    counts[collPath] = Object.keys(collData).length;
    
    // Recursively count deeper nested collections
    for (const docData of Object.values(collData)) {
      if (docData.__subcollections) {
        const nestedCounts = countNestedDocuments(docData.__subcollections, collPath);
        for (const [path, count] of Object.entries(nestedCounts)) {
          counts[path] = (counts[path] || 0) + count;
        }
      }
    }
  }
  
  return counts;
}

// Main export function
async function main() {
  console.log('📤 Complete Client Export Tool');
  console.log('==============================');
  console.log('Exports client data, audit logs, and discovers ALL nested collections');
  
  const params = parseArgs();
  
  if (!params.client) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node export-client-complete.js --client <CLIENT_ID>');
    console.error('Example: node export-client-complete.js --client AVII');
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
    await writeLog(migrationDir, 'Export phase started (complete)', 'INFO');
    await writeLog(migrationDir, `Exporting ${clientId} from dev with complete recursive discovery`, 'INFO');
    
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
    await writeLog(migrationDir, `Discovered collections: ${exportData.metadata.discoveredCollections.join(', ')}`, 'INFO');
    await writeLog(migrationDir, `Root collections: ${exportData.metadata.rootCollections.join(', ')}`, 'INFO');
    await writeLog(migrationDir, `Audit logs exported: ${exportData.auditLogs.length}`, 'INFO');
    await writeLog(migrationDir, `Users exported: ${exportData.users.length}`, 'INFO');
    
    // Update checksums with export info
    const checksumsPath = path.join(migrationDir, 'checksums.json');
    let checksums = {};
    try {
      checksums = JSON.parse(await fs.readFile(checksumsPath, 'utf-8'));
    } catch (err) {
      // File might not exist
    }
    
    checksums.export = {
      timestamp: exportData.metadata.exportedAt,
      documentCount: stats.documentCount,
      subcollectionCounts: stats.subcollectionCounts,
      userCount: exportData.users.length,
      auditLogCount: exportData.auditLogs.length,
      discoveredCollections: exportData.metadata.discoveredCollections,
      nestedCollections: stats.nestedCollections || []
    };
    await fs.writeFile(checksumsPath, JSON.stringify(checksums, null, 2));
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        export: {
          status: 'completed',
          timestamp: new Date().toISOString(),
          documentCount: stats.documentCount,
          collections: exportData.metadata.discoveredCollections
        }
      }
    });
    
    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Export Summary');
    console.log('='.repeat(50));
    console.log(`✅ Client: ${clientId}`);
    console.log(`✅ Total documents: ${stats.documentCount}`);
    
    console.log('\n🔍 Discovered collections:');
    exportData.metadata.discoveredCollections.forEach(coll => {
      console.log(`   - ${coll}`);
    });
    
    if (stats.nestedCollections && stats.nestedCollections.length > 0) {
      console.log('\n🔍 Nested collections found:');
      stats.nestedCollections.forEach(coll => {
        console.log(`   - ${coll}`);
      });
    }
    
    console.log('\n📁 Document counts:');
    Object.entries(stats.subcollectionCounts).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
    
    console.log(`\n📊 Audit logs: ${exportData.auditLogs.length}`);
    console.log(`👥 Users with access: ${exportData.users.length}`);
    
    console.log('\n📋 Next steps:');
    console.log(`   1. Run: node backup-prod-client.js --client ${clientId}`);
    console.log(`   2. Run: node prepare-user-mapping.js --client ${clientId}`);
    console.log(`   3. Run: node purge-prod-client.js --client ${clientId}`);
    console.log(`   4. Run: node import-client.js --client ${clientId}`);
    console.log(`   5. Run: node verify-migration.js --client ${clientId}`);
    
  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.error(error);
    
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
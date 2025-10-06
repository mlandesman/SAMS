/*
 * File: /backend/controllers/importController.js
 * Purpose: Controller for web-based import/purge operations (superadmin only)
 */

import { getDb } from '../firebase.js';
import { DateService, getNow } from '../services/DateService.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { ImportService } from '../services/importService.js';
import { deleteImportFiles } from '../api/importStorage.js';
import fs from 'fs';
import { join } from 'path';

/**
 * Get document counts for purge progress tracking
 */
async function getDocumentCounts(db, clientId, purgeSequence) {
  const counts = {};
  let totalCounted = 0;
  
  for (const step of purgeSequence) {
    try {
      let count = 0;
      console.log(`🔢 Counting ${step.name}...`);
      
      switch (step.id) {
        case 'hoadues':
          // Count HOA dues documents (nested structure)
          const unitsSnapshot = await db.collection(`clients/${clientId}/units`).get();
          for (const unitDoc of unitsSnapshot.docs) {
            const duesSnapshot = await unitDoc.ref.collection('dues').get();
            count += duesSnapshot.size;
          }
          break;
        case 'transactions':
          const transactionsSnapshot = await db.collection(`clients/${clientId}/transactions`).get();
          count = transactionsSnapshot.size;
          break;
        case 'units':
          const unitsSnapshot2 = await db.collection(`clients/${clientId}/units`).get();
          count = unitsSnapshot2.size;
          break;
        case 'client':
          // Client document - count recursively but EXCLUDE importMetadata
          // since it's purged separately
          const clientRef = db.doc(`clients/${clientId}`);
          const clientDoc = await clientRef.get();
          if (clientDoc.exists) {
            count = await countAllDocuments(clientRef, ['importMetadata']);
          } else {
            count = 0;
          }
          break;
        default:
          // Generic collection count
          const collectionSnapshot = await db.collection(`clients/${clientId}/${step.id}`).get();
          count = collectionSnapshot.size;
      }
      
      counts[step.id] = count;
      totalCounted += count;
      console.log(`📊 ${step.name}: ${count} documents (Total: ${totalCounted})`);
      
      // Update progress with running count
      if (global.importProgress && global.importProgress[clientId]) {
        global.importProgress[clientId].components.counting = {
          status: 'counting',
          step: 'Counting Documents',
          total: 0, // We don't know total yet
          processed: totalCounted,
          percent: 0, // Can't calculate percent without total
          message: `Found ${totalCounted} documents so far...`
        };
      }
    } catch (error) {
      console.warn(`⚠️ Could not count documents for ${step.id}: ${error.message}`);
      counts[step.id] = 0;
    }
  }
  
  console.log(`✅ Document counting complete: ${totalCounted} total documents`);
  return counts;
}

/**
 * Get JSON file sizes for import progress tracking
 */
function getJsonFileSizes(dataPath) {
  const jsonFiles = [
    'Client.json',
    'Config.json',
    'paymentMethods.json',
    'Categories.json',
    'Vendors.json', 
    'Units.json',
    'Transactions.json',
    'HOADues.json',
    'YearEndBalances.json'
  ];
  
  const sizes = {};
  let totalSize = 0;
  
  for (const fileName of jsonFiles) {
    try {
      const filePath = join(dataPath, fileName);
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);
      sizes[fileName] = sizeKB;
      totalSize += sizeKB;
      console.log(`📁 ${fileName}: ${sizeKB} KB`);
    } catch (error) {
      console.warn(`⚠️ Could not get size for ${fileName}: ${error.message}`);
      sizes[fileName] = 0;
    }
  }
  
  return { sizes, totalSize };
}

/**
 * Get import data counts for progress tracking
 */
function getImportDataCounts(dataPath) {
  const counts = {};
  let totalRecords = 0;
  
  try {
    const files = {
      'client': 'Client.json',
      'config': 'Config.json',
      'paymentTypes': 'paymentMethods.json',
      'categories': 'Categories.json',
      'vendors': 'Vendors.json',
      'units': 'Units.json', 
      'transactions': 'Transactions.json',
      'hoadues': 'HOADues.json',
      'yearEndBalances': 'YearEndBalances.json'
    };
    
    for (const [key, fileName] of Object.entries(files)) {
      try {
        const filePath = join(dataPath, fileName);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const count = Array.isArray(data) ? data.length : Object.keys(data).length;
        counts[key] = count;
        totalRecords += count;
        console.log(`📋 ${fileName}: ${count} records`);
      } catch (error) {
        console.warn(`⚠️ Could not count records in ${fileName}: ${error.message}`);
        counts[key] = 0;
      }
    }
  } catch (error) {
    console.warn(`⚠️ Could not read data files: ${error.message}`);
  }
  
  return { counts, totalRecords };
}

/**
 * Get import configuration options for a client
 * @param {string} user - The user object from authentication
 * @param {string} clientId - The client ID
 * @returns {Object} Configuration with available components
 */
async function getImportConfig(user, clientId) {
  console.log(`📋 Getting import config for client: ${clientId}`);
  
  try {
    // Verify superadmin access
    if (!user.isSuperAdmin()) {
      console.error(`❌ User ${user.email} lacks superadmin access`);
      return null;
    }

    const config = {
      clientId,
      components: [
        { id: 'users', label: 'Users', canPurge: true, canImport: true },
        { id: 'units', label: 'Units', canPurge: true, canImport: true },
        { id: 'categories', label: 'Categories', canPurge: true, canImport: true },
        { id: 'vendors', label: 'Vendors', canPurge: true, canImport: true },
        { id: 'transactions', label: 'Transactions', canPurge: true, canImport: true },
        { id: 'hoadues', label: 'HOA Dues', canPurge: true, canImport: true },
        { id: 'yearEndBalances', label: 'Year End Balances', canPurge: true, canImport: true },
        { id: 'client', label: 'Client Document', canPurge: true, canImport: true },
        { id: 'paymentTypes', label: 'Payment Types', canPurge: true, canImport: true },
        { id: 'config', label: 'Config Collection', canPurge: true, canImport: true }
      ],
      dataPath: 'firebase_storage' // Always use Firebase Storage in production
    };
    
    await writeAuditLog({
      module: 'import',
      action: 'getImportConfig',
      parentPath: `clients/${clientId}`,
      docId: 'import-config',
      friendlyName: `Import config for ${clientId}`,
      notes: `User ${user.email} viewed import configuration`,
      clientId
    });
    console.log(`✅ Retrieved import config for client: ${clientId}`);
    return config;
  } catch (error) {
    console.error(`❌ Error getting import config:`, error);
    return null;
  }
}

/**
 * Execute purge operation for selected components with comprehensive deletion
 * @param {string} user - The user object from authentication
 * @param {string} clientId - The client ID
 * @param {Object} options - Purge options
 * @returns {Object} Progress report
 */
async function executePurge(user, clientId, options = {}) {
  console.log(`🗑️ Starting complete purge sequence for client: ${clientId}`);
  
  try {
    // Verify superadmin access
    if (!user.isSuperAdmin()) {
      console.error(`❌ User ${user.email} lacks superadmin access`);
      return null;
    }

    const { dryRun = false } = options;
    const db = await getDb();
    
    // CRITICAL: Simplified purge sequence - recursive client deletion handles all subcollections
    const purgeSequence = [
      { id: 'client', name: 'Client Document (Recursive)', hasDependencies: false, recursive: true },
      { id: 'importMetadata', name: 'Import Metadata', hasDependencies: false }
    ];
    
    console.log(`🔍 Dry run mode:`, dryRun);
    
    // Generate operation ID for tracking
    const operationId = `purge-${clientId}-${Date.now()}`;
    
    // Initialize progress tracking
    if (!global.importProgress) {
      global.importProgress = {};
    }
    
    // Initialize progress with "counting" status immediately
    const initialProgress = {
      operationId,
      status: 'counting',
      sequence: purgeSequence,
      currentStep: 'counting',
      startTime: getNow(),
      clientId,
      dryRun,
      documentCounts: {},
      totalDocuments: 0,
      components: {
        counting: {
          status: 'counting',
          step: 'Counting Documents',
          total: 0,
          processed: 0,
          percent: 0,
          message: 'Counting documents before purge...'
        }
      }
    };
    
    // Store initial progress immediately
    global.importProgress[clientId] = initialProgress;
    
    // Get document counts for progress tracking (this takes time)
    console.log(`🔢 Counting documents for progress tracking...`);
    const documentCounts = await getDocumentCounts(db, clientId, purgeSequence);
    
    // Update progress with actual counts
    const progress = {
      operationId,
      status: 'running',
      sequence: purgeSequence,
      currentStep: null,
      startTime: getNow(),
      clientId,
      dryRun,
      documentCounts,
      totalDocuments: Object.values(documentCounts).reduce((sum, count) => sum + count, 0)
    };
    
    // Update global progress with actual counts
    global.importProgress[clientId] = progress;

    // Execute purges in strict sequence (reverse of import)
    for (const step of purgeSequence) {
      progress.currentStep = step.id;
      progress.components = progress.components || {};
      progress.components[step.id] = { 
        status: 'purging', 
        step: step.name,
        total: documentCounts[step.id] || 0,
        processed: 0,
        deleted: 0,
        percent: 0
      };
      
      // Update global progress
      if (global.importProgress[clientId]) {
        global.importProgress[clientId] = progress;
      }
      
      console.log(`🗑️ Purging ${step.name}...`);
      
      try {
        let result = { deletedCount: 0, errors: [] };
        
        // Use component-specific purge methods
        switch (step.id) {
          case 'client':
            result = await purgeClient(db, clientId, dryRun, operationId);
            break;
          case 'importMetadata':
            result = await purgeImportMetadata(db, clientId, dryRun);
            break;
          default:
            throw new Error(`Unknown purge component: ${step.id}`);
        }
        
        progress.components[step.id] = {
          ...progress.components[step.id], // Preserve progress values (processed, total, percent)
          status: 'completed',
          step: step.name,
          count: result.deletedCount,
          message: `${dryRun ? 'Would purge' : 'Purged'} ${result.deletedCount} ${step.name}`,
          errors: result.errors,
          percent: 100 // Ensure it shows 100%
        };
        
        console.log(`✅ ${step.name} purge completed: ${result.deletedCount} documents processed`);
        
        if (result.errors.length > 0) {
          console.warn(`⚠️ ${step.name} purge completed with ${result.errors.length} errors:`, result.errors);
        }
        
      } catch (error) {
        progress.components[step.id] = {
          status: 'error',
          step: step.name,
          error: error.message
        };
        
        console.error(`❌ ${step.name} purge failed:`, error);
        throw new Error(`Purge failed at ${step.name}: ${error.message}`);
      }
    }
    
    progress.status = 'completed';
    progress.endTime = getNow();
    
    await writeAuditLog({
      module: 'import',
      action: 'executePurge',
      parentPath: `clients/${clientId}`,
      docId: `purge-${Date.now()}`,
      friendlyName: `Complete purge sequence for ${clientId}`,
      notes: `User ${user.email} purged complete dataset. Dry run: ${dryRun}`,
      clientId
    });
    
    console.log(`✅ Complete purge sequence finished for client: ${clientId}`);
    return progress;
    
  } catch (error) {
    console.error(`❌ Error executing complete purge:`, error);
    return null;
  }
}

/**
 * Comprehensive purge for HOA Dues with nested structure handling
 */
async function purgeHOADues(db, clientId, dryRun = false) {
  console.log(`🏦 Purging HOA Dues for client: ${clientId}`);
  let deletedCount = 0;
  const errors = [];
  let totalDocs = 0;
  
  try {
    // HOA Dues structure: /clients/MTC/units/{unitId}/dues/{year}
    const unitsRef = db.collection('clients').doc(clientId).collection('units');
    console.log(`🔍 Checking units collection for HOA Dues at path: clients/${clientId}/units`);
    
    const unitsSnapshot = await unitsRef.get();
    console.log(`📊 Found ${unitsSnapshot.size} unit documents to check for HOA Dues`);
    
    // First count total documents for accurate progress
    for (const unitDoc of unitsSnapshot.docs) {
      const duesRef = unitDoc.ref.collection('dues');
      const duesSnapshot = await duesRef.get();
      totalDocs += duesSnapshot.size;
    }
    
    // Also count legacy documents
    const legacyHoaDuesRef = db.collection('clients').doc(clientId).collection('hoaDues');
    const legacySnapshot = await legacyHoaDuesRef.get();
    totalDocs += legacySnapshot.size;
    
    console.log(`📊 Total HOA Dues documents to process: ${totalDocs}`);
    
    let processedCount = 0;
    
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      const duesRef = unitDoc.ref.collection('dues');
      const duesSnapshot = await duesRef.get();
      
      console.log(`🔍 Unit ${unitId}: Found ${duesSnapshot.size} dues documents`);
      
      for (const duesDoc of duesSnapshot.docs) {
        try {
          if (!dryRun) {
            // Delete all sub-collections first
            await deleteSubCollections(duesDoc.ref);
            // Delete the dues document
            await duesDoc.ref.delete();
          }
          deletedCount++;
          processedCount++;
          console.log(`✅ ${dryRun ? 'Would delete' : 'Deleted'} HOA Dues: ${unitId}/${duesDoc.id}`);
          
          // Update progress in global state
          if (global.importProgress && global.importProgress[clientId] && global.importProgress[clientId].components) {
            global.importProgress[clientId].components.hoadues = {
              ...global.importProgress[clientId].components.hoadues,
              processed: processedCount,
              deleted: deletedCount,
              percent: Math.round((processedCount / totalDocs) * 100)
            };
          }
        } catch (error) {
          errors.push(`Failed to delete HOA Dues ${unitId}/${duesDoc.id}: ${error.message}`);
          console.error(`❌ Error deleting HOA Dues ${unitId}/${duesDoc.id}:`, error);
        }
      }
    }
    
    // Also check for legacy HOA Dues structure: /clients/MTC/hoaDues
    console.log(`🔍 Checking legacy HOA Dues structure at path: clients/${clientId}/hoaDues`);
    
    for (const doc of legacySnapshot.docs) {
      try {
        if (!dryRun) {
          await deleteSubCollections(doc.ref);
          await doc.ref.delete();
        }
        deletedCount++;
        processedCount++;
        console.log(`✅ ${dryRun ? 'Would delete' : 'Deleted'} legacy HOA Dues: ${doc.id}`);
        
        // Update progress in global state
        if (global.importProgress && global.importProgress[clientId] && global.importProgress[clientId].components) {
          global.importProgress[clientId].components.hoadues = {
            ...global.importProgress[clientId].components.hoadues,
            processed: processedCount,
            deleted: deletedCount,
            percent: Math.round((processedCount / totalDocs) * 100)
          };
        }
      } catch (error) {
        errors.push(`Failed to delete legacy HOA Dues ${doc.id}: ${error.message}`);
        console.error(`❌ Error deleting legacy HOA Dues ${doc.id}:`, error);
      }
    }
    
    console.log(`📊 HOA Dues purge completed: ${deletedCount} documents processed`);
    
  } catch (error) {
    errors.push(`HOA Dues purge failed: ${error.message}`);
    console.error(`❌ HOA Dues purge error:`, error);
  }
  
  return { deletedCount, errors };
}

/**
 * Comprehensive purge for Units with nested structure handling
 */
async function purgeUnits(db, clientId, dryRun = false) {
  console.log(`🏠 Purging Units for client: ${clientId}`);
  let deletedCount = 0;
  const errors = [];
  
  try {
    const unitsRef = db.collection('clients').doc(clientId).collection('units');
    console.log(`🔍 Checking units collection at path: clients/${clientId}/units`);
    
    const snapshot = await unitsRef.get();
    console.log(`📊 Found ${snapshot.size} unit documents`);
    
    for (const doc of snapshot.docs) {
      try {
        console.log(`🔍 Processing unit document: ${doc.id}`);
        if (!dryRun) {
          // Delete all sub-collections first (dues, payments, etc.)
          await deleteSubCollections(doc.ref);
          // Delete the main unit document
          await doc.ref.delete();
        }
        deletedCount++;
        console.log(`✅ ${dryRun ? 'Would delete' : 'Deleted'} Unit: ${doc.id}`);
      } catch (error) {
        errors.push(`Failed to delete unit ${doc.id}: ${error.message}`);
        console.error(`❌ Error deleting unit ${doc.id}:`, error);
      }
    }
    
    // Handle ghost documents (documents that exist but have no fields)
    console.log(`👻 Checking for ghost documents...`);
    await deleteGhostDocuments(unitsRef, dryRun);
    
    console.log(`📊 Units purge completed: ${deletedCount} documents processed`);
    
  } catch (error) {
    errors.push(`Units purge failed: ${error.message}`);
    console.error(`❌ Units purge error:`, error);
  }
  
  return { deletedCount, errors };
}

/**
 * Comprehensive purge for Transactions with nested structure handling
 */
async function purgeTransactions(db, clientId, dryRun = false) {
  console.log(`💰 Purging Transactions for client: ${clientId}`);
  let deletedCount = 0;
  const errors = [];
  
  try {
    const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
    const snapshot = await transactionsRef.get();
    const total = snapshot.size;
    
    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      try {
        if (!dryRun) {
          // Delete all sub-collections first
          await deleteSubCollections(doc.ref);
          // Delete the main transaction document
          await doc.ref.delete();
        }
        deletedCount++;
        console.log(`✅ ${dryRun ? 'Would delete' : 'Deleted'} Transaction: ${doc.id}`);
        
        // Update progress in global state
        if (global.importProgress && global.importProgress[clientId] && global.importProgress[clientId].components) {
          global.importProgress[clientId].components.transactions = {
            ...global.importProgress[clientId].components.transactions,
            processed: i + 1,
            deleted: deletedCount,
            percent: Math.round(((i + 1) / total) * 100)
          };
        }
      } catch (error) {
        errors.push(`Failed to delete transaction ${doc.id}: ${error.message}`);
      }
    }
    
    // Handle ghost documents
    await deleteGhostDocuments(transactionsRef, dryRun);
    
  } catch (error) {
    errors.push(`Transactions purge failed: ${error.message}`);
  }
  
  return { deletedCount, errors };
}

/**
 * Comprehensive purge for Client document
 * This recursively deletes ALL subcollections and then the client document itself.
 * This is more thorough than individual purges and handles any edge cases.
 */
async function purgeClient(db, clientId, dryRun = false, operationId = null) {
  console.log(`🏢 Purging Client document and ALL subcollections for client: ${clientId}`);
  let deletedCount = 0;
  const errors = [];
  
  try {
    const clientRef = db.doc(`clients/${clientId}`);
    console.log(`🔍 Checking client document at path: clients/${clientId}`);
    
    const clientDoc = await clientRef.get();
    
    if (clientDoc.exists) {
      try {
        // First count all documents that will be deleted for progress tracking
        // Exclude importMetadata since it's a separate purge step
        const totalCount = await countAllDocuments(clientRef, ['importMetadata']);
        console.log(`📊 Found ${totalCount} total documents to purge (excluding importMetadata)`);
        
        if (!dryRun) {
          // Create a shared progress tracker
          const progressTracker = { processed: 0, total: totalCount };
          
          // Recursively delete ALL subcollections EXCEPT importMetadata
          // importMetadata is purged separately as its own step
          const subCollectionResult = await deleteSubCollectionsWithProgress(
            clientRef, 
            operationId, 
            progressTracker,
            ['importMetadata']  // Exclude importMetadata - it's a separate purge step
          );
          deletedCount += subCollectionResult.deletedCount;
          errors.push(...subCollectionResult.errors);
          
          // Then delete the client document itself
          await clientRef.delete();
          deletedCount++;
          
          // Final progress update
          progressTracker.processed++;
          emitProgress(operationId, 'client', 'purging', {
            total: progressTracker.total,
            processed: progressTracker.processed,
            percent: 100
          });
        } else {
          deletedCount = totalCount;
        }
        
        console.log(`✅ ${dryRun ? 'Would delete' : 'Deleted'} ${deletedCount} documents: Client document and ALL subcollections`);
        console.log(`ℹ️ Note: Recursive deletion ensures no ghost documents remain`);
      } catch (error) {
        errors.push(`Failed to delete client document ${clientId}: ${error.message}`);
        console.error(`❌ Error deleting client document ${clientId}:`, error);
      }
    } else {
      console.log(`ℹ️ Client document ${clientId} does not exist`);
    }
    
    console.log(`📊 Client document purge completed: ${deletedCount} documents processed`);
    
  } catch (error) {
    errors.push(`Client document purge failed: ${error.message}`);
    console.error(`❌ Client document purge error:`, error);
  }
  
  return { deletedCount, errors };
}

/**
 * Comprehensive purge for Import Metadata
 */
async function purgeImportMetadata(db, clientId, dryRun = false) {
  console.log(`📋 Purging Import Metadata for client: ${clientId}`);
  let deletedCount = 0;
  const errors = [];
  
  try {
    const importMetadataRef = db.collection('clients').doc(clientId).collection('importMetadata');
    console.log(`🔍 Checking importMetadata collection at path: clients/${clientId}/importMetadata`);
    
    const snapshot = await importMetadataRef.get();
    const total = snapshot.size;
    console.log(`📊 Found ${total} importMetadata documents`);
    
    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      try {
        console.log(`🔍 Processing importMetadata document: ${doc.id}`);
        if (!dryRun) {
          // Delete all sub-collections first (if any)
          await deleteSubCollections(doc.ref);
          // Delete the main importMetadata document
          await doc.ref.delete();
        }
        deletedCount++;
        console.log(`✅ ${dryRun ? 'Would delete' : 'Deleted'} Import Metadata: ${doc.id}`);
        
        // Update progress in global state
        if (global.importProgress && global.importProgress[clientId] && global.importProgress[clientId].components) {
          global.importProgress[clientId].components.importMetadata = {
            ...global.importProgress[clientId].components.importMetadata,
            processed: i + 1,
            deleted: deletedCount,
            percent: Math.round(((i + 1) / total) * 100)
          };
        }
      } catch (error) {
        errors.push(`Failed to delete importMetadata ${doc.id}: ${error.message}`);
        console.error(`❌ Error deleting importMetadata ${doc.id}:`, error);
      }
    }
    
    // Handle ghost documents (documents that exist but have no fields)
    console.log(`👻 Checking for ghost documents...`);
    await deleteGhostDocuments(importMetadataRef, dryRun);
    
    console.log(`📊 Import Metadata purge completed: ${deletedCount} documents processed`);
    
  } catch (error) {
    errors.push(`Import Metadata purge failed: ${error.message}`);
    console.error(`❌ Import Metadata purge error:`, error);
  }
  
  return { deletedCount, errors };
}

/**
 * Generic purge for components with sub-collections
 */
async function purgeComponentWithSubCollections(db, clientId, component, dryRun = false) {
  console.log(`🗂️ Purging ${component} for client: ${clientId}`);
  let deletedCount = 0;
  const errors = [];
  
  try {
    const collectionRef = db.collection('clients').doc(clientId).collection(component);
    const snapshot = await collectionRef.get();
    const total = snapshot.size;
    
    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      try {
        if (!dryRun) {
          // Delete all sub-collections first
          await deleteSubCollections(doc.ref);
          // Delete the main document
          await doc.ref.delete();
        }
        deletedCount++;
        console.log(`✅ ${dryRun ? 'Would delete' : 'Deleted'} ${component}: ${doc.id}`);
        
        // Update progress in global state
        if (global.importProgress && global.importProgress[clientId] && global.importProgress[clientId].components) {
          const componentKey = component === 'hoadues' ? 'hoadues' : component;
          global.importProgress[clientId].components[componentKey] = {
            ...global.importProgress[clientId].components[componentKey],
            processed: i + 1,
            deleted: deletedCount,
            percent: Math.round(((i + 1) / total) * 100)
          };
        }
      } catch (error) {
        errors.push(`Failed to delete ${component} ${doc.id}: ${error.message}`);
      }
    }
    
    // Handle ghost documents
    await deleteGhostDocuments(collectionRef, dryRun);
    
  } catch (error) {
    errors.push(`${component} purge failed: ${error.message}`);
  }
  
  return { deletedCount, errors };
}

/**
 * Emit progress update to global progress tracker
 */
function emitProgress(operationId, componentId, status, data) {
  // Find the client ID from the operation ID
  const clientId = operationId.split('-')[1]; // format: purge-MTC-timestamp
  
  if (global.importProgress && global.importProgress[clientId]) {
    const progress = global.importProgress[clientId];
    if (!progress.components) progress.components = {};
    if (!progress.components[componentId]) progress.components[componentId] = {};
    
    progress.components[componentId] = {
      ...progress.components[componentId],
      status,
      ...data
    };
    
    // Update global progress
    global.importProgress[clientId] = progress;
  }
}

/**
 * Count all documents in all subcollections recursively
 * @param {Array} excludeCollections - Collection names to skip when counting
 */
async function countAllDocuments(docRef, excludeCollections = []) {
  let count = 1; // Count the document itself
  
  try {
    const collections = await docRef.listCollections();
    
    for (const subCollection of collections) {
      // Skip excluded collections
      if (excludeCollections.includes(subCollection.id)) {
        continue;
      }
      
      const subSnapshot = await subCollection.get();
      
      for (const subDoc of subSnapshot.docs) {
        // Recursively count sub-sub-collections
        count += await countAllDocuments(subDoc.ref, excludeCollections);
      }
    }
  } catch (error) {
    console.warn(`Warning: Failed to count documents for ${docRef.path}:`, error.message);
  }
  
  return count;
}

/**
 * Recursively delete all sub-collections with progress tracking
 * @param {Object} progressTracker - Shared object with {processed, total} for tracking across recursive calls
 * @param {Array} excludeCollections - Collection names to skip (e.g., ['importMetadata'])
 */
async function deleteSubCollectionsWithProgress(docRef, operationId, progressTracker, excludeCollections = []) {
  let deletedCount = 0;
  const errors = [];
  
  try {
    const collections = await docRef.listCollections();
    
    for (const subCollection of collections) {
      const collectionName = subCollection.id;
      
      // Skip excluded collections (they'll be purged separately)
      if (excludeCollections.includes(collectionName)) {
        console.log(`⏭️ Skipping ${collectionName} (purged separately)`);
        continue;
      }
      
      console.log(`🗑️ Purging subcollection: ${collectionName}`);
      
      const subSnapshot = await subCollection.get();
      const docsInCollection = subSnapshot.docs.length;
      
      // Delete all documents in sub-collection
      for (const subDoc of subSnapshot.docs) {
        try {
          // Recursively delete sub-sub-collections
          const subResult = await deleteSubCollectionsWithProgress(subDoc.ref, operationId, progressTracker);
          deletedCount += subResult.deletedCount;
          errors.push(...subResult.errors);
          
          // Delete the document itself
          await subDoc.ref.delete();
          deletedCount++;
          progressTracker.processed++;
          
          // Report progress periodically (every 10 documents)
          if (progressTracker.processed % 10 === 0) {
            const percent = Math.min(Math.round((progressTracker.processed / progressTracker.total) * 100), 100);
            console.log(`📊 Progress: ${progressTracker.processed}/${progressTracker.total} documents (${percent}%)`);
            
            // Emit progress via socket if operationId is provided
            if (operationId) {
              emitProgress(operationId, 'client', 'purging', {
                total: progressTracker.total,
                processed: progressTracker.processed,
                percent: percent
              });
            }
          }
        } catch (error) {
          const errorMsg = `Failed to delete document ${subDoc.id} in ${collectionName}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }
      
      console.log(`✅ Purged ${docsInCollection} documents from ${collectionName}`);
    }
  } catch (error) {
    const errorMsg = `Failed to delete sub-collections for ${docRef.path}: ${error.message}`;
    errors.push(errorMsg);
    console.warn(`⚠️ ${errorMsg}`);
  }
  
  return { deletedCount, errors };
}

/**
 * Recursively delete all sub-collections of a document (simple version without progress)
 */
async function deleteSubCollections(docRef) {
  try {
    const collections = await docRef.listCollections();
    
    for (const subCollection of collections) {
      const subSnapshot = await subCollection.get();
      
      // Delete all documents in sub-collection
      for (const subDoc of subSnapshot.docs) {
        // Recursively delete sub-sub-collections
        await deleteSubCollections(subDoc.ref);
        await subDoc.ref.delete();
      }
    }
  } catch (error) {
    console.warn(`Warning: Failed to delete sub-collections for ${docRef.path}:`, error.message);
  }
}

/**
 * Delete ghost documents (documents with sub-collections but no top-level fields)
 */
async function deleteGhostDocuments(collectionRef, dryRun = false) {
  try {
    // Get all document references, even if they have no fields
    const allDocs = await collectionRef.listDocuments();
    
    for (const docRef of allDocs) {
      try {
        const doc = await docRef.get();
        
        // If document has no fields but exists, it's a ghost document
        if (!doc.exists || Object.keys(doc.data() || {}).length === 0) {
          if (!dryRun) {
            // Delete sub-collections first
            await deleteSubCollections(docRef);
            // Delete the ghost document
            await docRef.delete();
          }
          console.log(`👻 ${dryRun ? 'Would delete' : 'Deleted'} ghost document: ${docRef.id}`);
        }
      } catch (error) {
        console.warn(`Warning: Failed to handle ghost document ${docRef.id}:`, error.message);
      }
    }
  } catch (error) {
    console.warn(`Warning: Failed to delete ghost documents:`, error.message);
  }
}

/**
 * Execute complete import sequence with strict dependency order
 * @param {string} user - The user object from authentication
 * @param {string} clientId - The client ID
 * @param {Object} options - Import options
 * @returns {Object} Progress report
 */
async function executeImport(user, clientId, options = {}) {
  console.log(`📥 Starting complete import sequence for client: ${clientId}`);
  
  try {
    // Verify superadmin access
    if (!user.isSuperAdmin()) {
      console.error(`❌ User ${user.email} lacks superadmin access`);
      return null;
    }

    const { dataPath, dryRun = false, maxErrors = 3 } = options;
    
    // Validate data path
    if (!dataPath) {
      throw new Error('Data path is required for import operation');
    }
    
    // CRITICAL SAFETY CHECK: Read Client.json and verify clientId matches
    console.log(`🔒 Validating Client.json clientId matches target: ${clientId}`);
    
    // Create ImportService instance to properly handle both filesystem and Firebase Storage
    const importService = new ImportService(clientId, dataPath, user);
    let clientData;
    
    try {
      clientData = await importService.loadJsonFile('Client.json');
    } catch (error) {
      throw new Error(`❌ Client.json not found at ${dataPath}. Cannot proceed with import. Error: ${error.message}`);
    }
    const fileClientId = clientData.clientId || clientData._id || clientData.basicInfo?.clientId;
    
    if (!fileClientId) {
      throw new Error(`❌ Could not determine clientId from Client.json. File may be malformed.`);
    }
    
    if (fileClientId !== clientId) {
      throw new Error(
        `❌ SAFETY CHECK FAILED: Client ID mismatch!\n` +
        `   Selected client: ${clientId}\n` +
        `   Client.json file: ${fileClientId}\n` +
        `   Cannot import ${fileClientId} data to ${clientId} client.\n` +
        `   Please select the correct client (${fileClientId}) before importing.`
      );
    }
    
    console.log(`✅ Client ID validated: ${clientId} matches Client.json`);
    
    // CRITICAL: Single import sequence - no component selection
    const importSequence = [
      { id: 'client', name: 'Client Document', independent: true },
      { id: 'config', name: 'Config Collection', independent: true },
      { id: 'paymentTypes', name: 'Payment Methods', independent: true },
      { id: 'categories', name: 'Categories', independent: true },
      { id: 'vendors', name: 'Vendors', independent: true },
      { id: 'units', name: 'Units', independent: true },
      { id: 'yearEndBalances', name: 'Year End Balances', independent: true },
      { id: 'transactions', name: 'Transactions', independent: false, buildsCrossRef: true },
      { id: 'hoadues', name: 'HOA Dues', independent: false, requiresCrossRef: true }
    ];
    
    // Generate operation ID for tracking
    const operationId = `import-${clientId}-${Date.now()}`;
    
    // Initialize progress tracking
    if (!global.importProgress) {
      global.importProgress = {};
    }
    
    // Get import data counts and file sizes for progress tracking
    const { counts: dataCounts, totalRecords } = getImportDataCounts(dataPath);
    const { sizes: fileSizes, totalSize } = getJsonFileSizes(dataPath);
    
    const progress = {
      operationId,
      status: 'running',
      sequence: importSequence,
      currentStep: null,
      startTime: getNow(),
      clientId,
      dataCounts,
      totalRecords,
      fileSizes,
      totalSizeKB: totalSize,
      dryRun
    };
    
    // Store in global for progress tracking
    global.importProgress[clientId] = progress;
    
    // Delete existing import files if using Firebase Storage
    if (dataPath === 'firebase_storage') {
      try {
        console.log(`🗑️ Deleting existing import files for client: ${clientId}`);
        await deleteImportFiles(clientId, user);
      } catch (error) {
        console.error(`❌ Failed to delete existing import files:`, error);
        throw new Error(`Failed to delete existing import files: ${error.message}`);
      }
    }
    
    // Set up progress callback to update global progress
    importService.onProgress = (component, status, data) => {
      if (global.importProgress[clientId] && global.importProgress[clientId].components) {
        global.importProgress[clientId].components[component] = {
          ...global.importProgress[clientId].components[component],
          status: status,
          ...data
        };
        console.log(`📊 Progress update: ${component} - ${data.processed}/${data.total} (${data.percent}%)`);
      }
    };
    
    // Execute imports in strict sequence
    for (const step of importSequence) {
      progress.currentStep = step.id;
      progress.components = progress.components || {};
      progress.components[step.id] = { 
        status: 'importing', 
        step: step.name,
        total: dataCounts[step.id] || 0,
        processed: 0,
        success: 0,
        failed: 0,
        percent: 0,
        fileSizeKB: fileSizes[`${step.name.replace(' ', '')}.json`] || 0
      };
      
      // Update global progress
      if (global.importProgress[clientId]) {
        global.importProgress[clientId] = progress;
      }
      
      console.log(`🔄 Importing ${step.name}...`);
      
      try {
        let result;
        
                // Call the appropriate import method based on step.id
                switch (step.id) {
                  case 'client':
                    result = await importService.importClient(user, { dryRun, maxErrors });
                    break;
                  case 'config':
                    result = await importService.importConfig(user, { dryRun, maxErrors });
                    break;
                  case 'paymentTypes':
                    result = await importService.importPaymentTypes(user, { dryRun, maxErrors });
                    break;
                  case 'categories':
                    result = await importService.importCategories(user, { dryRun, maxErrors });
                    break;
                  case 'vendors':
                    result = await importService.importVendors(user, { dryRun, maxErrors });
                    break;
                  case 'units':
                    result = await importService.importUnits(user, { dryRun, maxErrors });
                    break;
                  case 'yearEndBalances':
                    result = await importService.importYearEndBalances(user, { dryRun, maxErrors });
                    break;
                  case 'transactions':
                    result = await importService.importTransactions(user, { dryRun, maxErrors });
                    break;
                  case 'hoadues':
                    result = await importService.importHOADues(user, { dryRun, maxErrors });
                    break;
                  default:
                    throw new Error(`Unknown import component: ${step.id}`);
                }
        
        progress.components[step.id] = {
          ...progress.components[step.id], // Preserve progress values (processed, total, percent)
          status: 'completed',
          step: step.name,
          ...result,
          percent: 100 // Ensure it shows 100%
        };
        
        console.log(`✅ ${step.name} import completed: ${result.success} success, ${result.failed} failed`);
        
        // If Transactions import fails, stop entire sequence
        if (step.id === 'transactions' && result.failed > 0) {
          throw new Error(`Transaction import failed: ${result.errors.join(', ')}`);
        }
        
      } catch (error) {
        progress.components[step.id] = {
          status: 'error',
          step: step.name,
          error: error.message
        };
        
        console.error(`❌ ${step.name} import failed:`, error);
        throw new Error(`Import failed at ${step.name}: ${error.message}`);
      }
    }
    
    progress.status = 'completed';
    progress.endTime = getNow();
    
    await writeAuditLog({
      module: 'import',
      action: 'executeImport',
      parentPath: `clients/${clientId}`,
      docId: `import-${Date.now()}`,
      friendlyName: `Complete import sequence for ${clientId}`,
      notes: `User ${user.email} imported complete dataset from ${dataPath}`,
      clientId
    });
    
    console.log(`✅ Complete import sequence finished for client: ${clientId}`);
    return progress;
    
  } catch (error) {
    console.error(`❌ Error executing complete import:`, error);
    // Update progress with error
    if (global.importProgress[clientId]) {
      global.importProgress[clientId].status = 'error';
      global.importProgress[clientId].error = error.message;
    }
    return null;
  }
}

/**
 * Get progress status for import/purge operations
 * @param {string} user - The user object from authentication
 * @param {string} clientId - The client ID
 * @returns {Object} Current progress status
 */
async function getImportProgress(user, clientId) {
  console.log(`📊 Getting import progress for client: ${clientId}`);
  
  try {
    // Verify superadmin access
    if (!user.isSuperAdmin()) {
      console.error(`❌ User ${user.email} lacks superadmin access`);
      return null;
    }

    // Retrieve progress from global state
    const progress = global.importProgress?.[clientId] || { 
      status: 'idle', 
      clientId 
    };
    
    console.log(`✅ Retrieved import progress for client: ${clientId} - Status: ${progress.status}`);
    return progress;
    
  } catch (error) {
    console.error(`❌ Error getting import progress:`, error);
    return null;
  }
}

/**
 * Preview client data from Client.json file
 * Reads the file and returns key information without importing
 * @param {Object} user - The authenticated user
 * @param {string} dataPath - Path to directory containing Client.json
 * @returns {Object} Client preview data
 */
async function previewClientData(user, dataPath, clientId = null) {
  try {
    // Check user permissions
    if (!user.isSuperAdmin()) {
      console.error(`❌ User ${user.email} lacks superadmin access`);
      return null;
    }
    
    console.log(`👁️ Reading Client.json from: ${dataPath}${clientId ? ` for client: ${clientId}` : ''}`);
    
    // Use ImportService to read Client.json (handles both file system and Firebase Storage)
    const importService = new ImportService(clientId || 'temp', dataPath, user);
    const clientData = await importService.loadJsonFile('Client.json');
    
    // Extract key information
    const extractedClientId = clientData.clientId || clientData._id || clientData.basicInfo?.clientId;
    const displayName = clientData.basicInfo?.displayName || clientData.displayName || extractedClientId;
    const fullName = clientData.basicInfo?.fullName || clientData.fullName;
    const clientType = clientData.basicInfo?.clientType || clientData.type;
    const totalUnits = clientData.propertyInfo?.totalUnits || 0;
    
    // Count other data files
    const dataCounts = {};
    const dataFiles = [
      { key: 'config', file: 'Config.json' },
      { key: 'paymentMethods', file: 'paymentMethods.json' },
      { key: 'categories', file: 'Categories.json' },
      { key: 'vendors', file: 'Vendors.json' },
      { key: 'units', file: 'Units.json' },
      { key: 'transactions', file: 'Transactions.json' },
      { key: 'hoadues', file: 'HOADues.json' },
      { key: 'yearEndBalances', file: 'YearEndBalances.json' }
    ];
    
    for (const { key, file } of dataFiles) {
      const filePath = `${dataPath}/${file}`;
      if (fs.existsSync(filePath)) {
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          dataCounts[key] = Array.isArray(data) ? data.length : Object.keys(data).length;
        } catch (e) {
          dataCounts[key] = 'Error reading file';
        }
      } else {
        dataCounts[key] = 0;
      }
    }
    
    return {
      clientId: extractedClientId,
      displayName,
      fullName,
      clientType,
      totalUnits,
      dataCounts,
      dataPath,
      preview: {
        accounts: clientData.accounts?.length || 0,
        status: clientData.status,
        currency: clientData.configuration?.currency
      }
    };
    
  } catch (error) {
    console.error(`❌ Error previewing client data:`, error);
    throw error;
  }
}

export {
  getImportConfig,
  executePurge,
  executeImport,
  getImportProgress,
  previewClientData
};
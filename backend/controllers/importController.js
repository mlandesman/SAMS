/*
 * File: /backend/controllers/importController.js
 * Purpose: Controller for web-based import/purge operations (superadmin only)
 */

import { getDb } from '../firebase.js';
import { DateService, getNow } from '../services/DateService.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { ImportService } from '../services/importService.js';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Get document counts for purge progress tracking
 */
async function getDocumentCounts(db, clientId, purgeSequence) {
  const counts = {};
  
  for (const step of purgeSequence) {
    try {
      let count = 0;
      
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
        default:
          // Generic collection count
          const collectionSnapshot = await db.collection(`clients/${clientId}/${step.id}`).get();
          count = collectionSnapshot.size;
      }
      
      counts[step.id] = count;
      console.log(`📊 ${step.name}: ${count} documents`);
    } catch (error) {
      console.warn(`⚠️ Could not count documents for ${step.id}: ${error.message}`);
      counts[step.id] = 0;
    }
  }
  
  return counts;
}

/**
 * Get JSON file sizes for import progress tracking
 */
function getJsonFileSizes(dataPath) {
  const jsonFiles = [
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
      const stats = statSync(filePath);
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
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
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
        { id: 'yearEndBalances', label: 'Year End Balances', canPurge: true, canImport: true }
      ],
      dataPath: `/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/SAMS/${clientId}data`
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
    
    // CRITICAL: Single purge sequence - reverse of import order
    const purgeSequence = [
      { id: 'hoadues', name: 'HOA Dues', hasDependencies: true },
      { id: 'transactions', name: 'Transactions', hasDependencies: true },
      { id: 'yearEndBalances', name: 'Year End Balances', hasDependencies: false },
      { id: 'units', name: 'Units', hasDependencies: false },
      { id: 'vendors', name: 'Vendors', hasDependencies: false },
      { id: 'categories', name: 'Categories', hasDependencies: false },
      { id: 'importMetadata', name: 'Import Metadata', hasDependencies: false }
    ];
    
    console.log(`🔍 Dry run mode:`, dryRun);
    
    // Generate operation ID for tracking
    const operationId = `purge-${clientId}-${Date.now()}`;
    
    // Initialize progress tracking
    if (!global.importProgress) {
      global.importProgress = {};
    }
    
    // Get document counts for progress tracking
    const documentCounts = await getDocumentCounts(db, clientId, purgeSequence);
    
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
    
    // Store in global for progress tracking
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
          case 'hoadues':
            result = await purgeHOADues(db, clientId, dryRun);
            break;
          case 'transactions':
            result = await purgeTransactions(db, clientId, dryRun);
            break;
          case 'units':
            result = await purgeUnits(db, clientId, dryRun);
            break;
          case 'importMetadata':
            result = await purgeImportMetadata(db, clientId, dryRun);
            break;
          default:
            result = await purgeComponentWithSubCollections(db, clientId, step.id, dryRun);
        }
        
        progress.components[step.id] = {
          status: 'completed',
          step: step.name,
          count: result.deletedCount,
          message: `${dryRun ? 'Would purge' : 'Purged'} ${result.deletedCount} ${step.name}`,
          errors: result.errors
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
    console.log(`📊 Found ${snapshot.size} importMetadata documents`);
    
    for (const doc of snapshot.docs) {
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
 * Recursively delete all sub-collections of a document
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
    
    // CRITICAL: Single import sequence - no component selection
    const importSequence = [
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
    
    // Create import service instance
    const importService = new ImportService(clientId, dataPath);
    
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
          status: 'completed',
          step: step.name,
          ...result
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

export {
  getImportConfig,
  executePurge,
  executeImport,
  getImportProgress
};
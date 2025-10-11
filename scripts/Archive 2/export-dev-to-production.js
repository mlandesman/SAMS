#!/usr/bin/env node

/**
 * Development to Production Export Script
 * 
 * Purpose: Exports ALL data from development Firestore EXCEPT exchangeRates
 * This prepares data for migration to production environment
 * 
 * Usage: node scripts/export-dev-to-production.js
 */

const admin = require('firebase-admin');
const fs = require('fs').promises;
const path = require('path');

// Development Firebase configuration
const DEV_SERVICE_ACCOUNT = path.join(__dirname, '../firebase-adminsdk.json');
const DEV_PROJECT_ID = 'sandyland-management-system';

// Initialize Firebase Admin for development
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(DEV_SERVICE_ACCOUNT),
    projectId: DEV_PROJECT_ID
  });
}

const db = admin.firestore();

// Collections to exclude from export
const EXCLUDED_COLLECTIONS = ['exchangeRates'];

// Recursive function to get all subcollections
async function getAllCollections(parentPath = null) {
  const collections = [];
  
  try {
    let collectionRefs;
    
    if (parentPath) {
      // Get subcollections of a document
      const docRef = db.doc(parentPath);
      collectionRefs = await docRef.listCollections();
    } else {
      // Get root collections
      collectionRefs = await db.listCollections();
    }
    
    for (const collRef of collectionRefs) {
      const collectionPath = parentPath ? `${parentPath}/${collRef.id}` : collRef.id;
      
      // Skip excluded collections
      if (!parentPath && EXCLUDED_COLLECTIONS.includes(collRef.id)) {
        console.log(`⏭️  Skipping excluded collection: ${collRef.id}`);
        continue;
      }
      
      collections.push(collectionPath);
      
      // Get all documents in this collection to check for subcollections
      const snapshot = await collRef.get();
      
      for (const doc of snapshot.docs) {
        const docPath = `${collectionPath}/${doc.id}`;
        const subCollections = await getAllCollections(docPath);
        collections.push(...subCollections);
      }
    }
  } catch (error) {
    console.error(`Error listing collections at ${parentPath}:`, error);
  }
  
  return collections;
}

// Export a single collection
async function exportCollection(collectionPath) {
  const parts = collectionPath.split('/');
  let collectionRef;
  
  if (parts.length === 1) {
    // Root collection
    collectionRef = db.collection(collectionPath);
  } else {
    // Subcollection
    collectionRef = db.doc(parts.slice(0, -1).join('/')).collection(parts[parts.length - 1]);
  }
  
  const snapshot = await collectionRef.get();
  const documents = [];
  
  snapshot.forEach(doc => {
    documents.push({
      id: doc.id,
      data: doc.data()
    });
  });
  
  return documents;
}

// Main export function
async function exportAllData() {
  console.log('🔵 Starting development data export...');
  console.log(`📊 Source Project: ${DEV_PROJECT_ID}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`🚫 Excluding: ${EXCLUDED_COLLECTIONS.join(', ')}\n`);
  
  try {
    // Create export directory
    const exportDir = path.join(__dirname, '../exports');
    await fs.mkdir(exportDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportFile = path.join(exportDir, `dev-export-${timestamp}.json`);
    
    // Get all collections
    console.log('🔍 Discovering all collections and subcollections...');
    const allCollections = await getAllCollections();
    console.log(`✅ Found ${allCollections.length} collections to export\n`);
    
    // Export data
    const exportData = {
      metadata: {
        timestamp: new Date().toISOString(),
        sourceProject: DEV_PROJECT_ID,
        excludedCollections: EXCLUDED_COLLECTIONS,
        totalCollections: allCollections.length,
        exportType: 'complete-except-exchangerates'
      },
      collections: {}
    };
    
    let totalDocuments = 0;
    
    // Export each collection
    for (const collectionPath of allCollections) {
      process.stdout.write(`📥 Exporting ${collectionPath}...`);
      
      try {
        const documents = await exportCollection(collectionPath);
        
        if (documents.length > 0) {
          exportData.collections[collectionPath] = documents;
          totalDocuments += documents.length;
          console.log(` ✅ ${documents.length} documents`);
        } else {
          console.log(' ⚠️  Empty');
        }
      } catch (error) {
        console.log(` ❌ Error: ${error.message}`);
      }
    }
    
    // Add Firebase Auth export marker
    exportData.metadata.totalDocuments = totalDocuments;
    exportData.metadata.requiresAuthMigration = true;
    exportData.metadata.authMigrationNote = 'Run migrate-firebase-auth-users.js separately';
    
    // Write export file
    console.log(`\n💾 Writing export file...`);
    await fs.writeFile(exportFile, JSON.stringify(exportData, null, 2));
    
    // Create summary
    const summaryFile = path.join(exportDir, `export-summary-${timestamp}.txt`);
    const summary = `Development Data Export Summary
==============================
Timestamp: ${new Date().toISOString()}
Source Project: ${DEV_PROJECT_ID}
Total Collections: ${allCollections.length}
Total Documents: ${totalDocuments}
Export File: ${exportFile}

Collections Exported:
${allCollections.map(c => `  - ${c}`).join('\n')}

Excluded Collections:
${EXCLUDED_COLLECTIONS.map(c => `  - ${c}`).join('\n')}

Next Steps:
1. Run migrate-firebase-auth-users.js to export authentication
2. Run import-to-production.js to import this data
`;
    
    await fs.writeFile(summaryFile, summary);
    
    console.log(`\n✅ Export completed successfully!`);
    console.log(`📁 Export file: ${exportFile}`);
    console.log(`📋 Summary: ${summaryFile}`);
    console.log(`📊 Total documents exported: ${totalDocuments}`);
    
    // Display critical reminders
    console.log('\n⚠️  IMPORTANT REMINDERS:');
    console.log('1. exchangeRates were NOT exported (production has correct data)');
    console.log('2. Firebase Auth users need separate migration');
    console.log('3. Verify export completeness before importing to production');
    
  } catch (error) {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  }
}

// Main execution
(async () => {
  try {
    console.log('🚀 Development to Production Export Tool');
    console.log('======================================\n');
    
    // Verify we're exporting from dev
    if (DEV_PROJECT_ID.includes('production') || DEV_PROJECT_ID.includes('prod')) {
      console.error('❌ ERROR: This looks like a production project!');
      console.error('   This script should export from DEVELOPMENT only.');
      process.exit(1);
    }
    
    await exportAllData();
    
    console.log('\n📋 Next steps:');
    console.log('1. Review the export summary');
    console.log('2. Run migrate-firebase-auth-users.js');
    console.log('3. Run import-to-production.js with the export file');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();
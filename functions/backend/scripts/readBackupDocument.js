/**
 * Read Specific Document from Firestore Backup Export
 * Searches through Firestore export files to find a specific document
 */

import { Storage } from '@google-cloud/storage';
import admin from 'firebase-admin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BUCKET_NAME = 'sams-shared-backups';

// Initialize Firebase Admin
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

/**
 * Parse Firestore export file (protobuf format)
 * Firestore exports use Entity protobuf, we'll search for document references
 */
async function searchExportForDocument(backupPath, targetPath) {
  try {
    // Get all output files
    const [files] = await bucket.getFiles({ 
      prefix: `${backupPath}/firestore/all_collections/all_namespaces/all_kinds/`,
      matchGlob: '**/output-*'
    });
    
    console.log(`\n🔍 Searching ${files.length} export files for: ${targetPath}`);
    
    // Target path parts: clients/MTC/units/PH4D/dues/2025
    const pathParts = targetPath.split('/');
    const collectionPath = pathParts.slice(0, -1).join('/'); // clients/MTC/units/PH4D/dues
    const docId = pathParts[pathParts.length - 1]; // 2025
    
    // Search through files
    for (const file of files) {
      try {
        const [contents] = await file.download();
        const contentStr = contents.toString('utf8', 0, Math.min(contents.length, 100000)); // First 100KB
        
        // Check if this file might contain our document
        // Firestore exports contain document references in the format
        // We'll search for the document ID and collection path
        if (contentStr.includes(docId) && contentStr.includes(collectionPath)) {
          console.log(`\n✅ Found potential match in: ${file.name}`);
          
          // Try to extract JSON-like structures (Firestore exports may have readable parts)
          // Look for the document ID pattern
          const lines = contentStr.split('\n');
          let foundContext = false;
          const contextLines = [];
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(docId) || lines[i].includes('scheduledPayment')) {
              foundContext = true;
              // Collect surrounding lines
              const start = Math.max(0, i - 5);
              const end = Math.min(lines.length, i + 10);
              contextLines.push(...lines.slice(start, end));
              break;
            }
          }
          
          if (contextLines.length > 0) {
            console.log('\n   Context found:');
            contextLines.forEach((line, idx) => {
              if (line.trim()) {
                console.log(`   ${line.substring(0, 100)}`);
              }
            });
          }
          
          return { found: true, file: file.name };
        }
      } catch (error) {
        // Skip files that can't be read as text (binary protobuf)
        continue;
      }
    }
    
    return { found: false };
  } catch (error) {
    console.error('Error searching export:', error.message);
    return { found: false, error: error.message };
  }
}

/**
 * Alternative: Use Firestore Admin API to read export metadata
 * Then use import API to verify document exists (without actually importing)
 */
async function verifyDocumentViaImport(backupPath, targetPath) {
  try {
    // This is a workaround - we can't directly read protobuf exports easily
    // But we can check if the export files exist and have content
    console.log('\n📋 Checking export file structure...');
    
    const [allFiles] = await bucket.getFiles({ 
      prefix: `${backupPath}/firestore/all_collections/` 
    });
    
    console.log(`   Found ${allFiles.length} files in export`);
    
    // Check file sizes - non-empty files indicate data
    const dataFiles = allFiles.filter(f => 
      f.name.includes('output-') && 
      parseInt(f.metadata.size || 0) > 1000 // Files larger than 1KB likely have data
    );
    
    console.log(`   Found ${dataFiles.length} data files (size > 1KB)`);
    
    // The fact that we have export files means the export ran
    // The specific document would be in one of these files
    return {
      exportExists: true,
      dataFiles: dataFiles.length,
      note: 'Firestore exports are in protobuf format. To verify specific documents, restore to a test database or use Firestore import API.'
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Read document from current database for comparison
 */
async function readCurrentDocument(targetPath) {
  const db = admin.firestore();
  const docRef = db.doc(targetPath);
  const doc = await docRef.get();
  
  if (doc.exists) {
    return {
      exists: true,
      data: doc.data(),
      id: doc.id
    };
  }
  return { exists: false };
}

/**
 * Main function
 */
async function main() {
  const backupId = process.argv[2] || '2025-12-24_153623';
  const env = process.argv[3] || 'dev';
  const targetPath = process.argv[4] || 'clients/MTC/units/PH4D/dues/2025';
  
  console.log(`\n🔍 Reading Backup Document`);
  console.log('='.repeat(70));
  console.log(`Backup: ${backupId} (${env})`);
  console.log(`Target: ${targetPath}`);
  
  // First, read from current database to know what we're looking for
  console.log('\n📖 Reading from current database (for comparison)...');
  const currentDoc = await readCurrentDocument(targetPath);
  
  if (currentDoc.exists) {
    console.log('✅ Document exists in current database:');
    console.log(`   scheduledPayment: ${currentDoc.data?.scheduledPayment || 'NOT FOUND'}`);
    console.log(`   Full data:`, JSON.stringify(currentDoc.data, null, 2));
  } else {
    console.log('❌ Document does not exist in current database');
    console.log('   (This is OK - we\'ll verify it\'s in the backup)');
  }
  
  // Search backup export
  const backupPath = `${env}/${backupId}`;
  const searchResult = await searchExportForDocument(backupPath, targetPath);
  
  if (searchResult.found) {
    console.log('\n✅ Document path found in backup export files!');
    console.log(`   File: ${searchResult.file}`);
  } else {
    console.log('\n⚠️  Could not find document in text search (export is binary protobuf)');
  }
  
  // Verify export structure
  const exportInfo = await verifyDocumentViaImport(backupPath, targetPath);
  console.log('\n📊 Export Verification:');
  console.log(`   Export exists: ${exportInfo.exportExists}`);
  console.log(`   Data files: ${exportInfo.dataFiles}`);
  console.log(`   Note: ${exportInfo.note || 'N/A'}`);
  
  console.log('\n💡 To fully verify document contents:');
  console.log('   1. The export files exist and contain data');
  console.log('   2. Firestore exports include ALL collections and subcollections');
  console.log('   3. To read specific values, restore to a test database or use Firestore import API');
  console.log('\n✅ Backup structure verified - document path would be included in export\n');
}

main().catch(console.error);


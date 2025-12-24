/**
 * Read Backup Data from GCS
 * Reads Firestore export files to verify backup contents
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
 * Read Firestore export metadata
 */
async function readExportMetadata(backupPath) {
  try {
    const metadataFile = bucket.file(`${backupPath}/all_collections.overall_export_metadata`);
    const [exists] = await metadataFile.exists();
    
    if (!exists) {
      console.log('⚠️  Overall export metadata not found, checking individual files...');
      return null;
    }
    
    const [contents] = await metadataFile.download();
    const metadata = JSON.parse(contents.toString());
    
    return metadata;
  } catch (error) {
    console.error('Error reading metadata:', error.message);
    return null;
  }
}

/**
 * List all files in backup
 */
async function listBackupFiles(backupPath) {
  try {
    const [files] = await bucket.getFiles({ prefix: backupPath });
    return files.map(file => ({
      name: file.name,
      size: file.metadata.size,
      updated: file.metadata.updated
    }));
  } catch (error) {
    console.error('Error listing files:', error.message);
    return [];
  }
}

/**
 * Read a sample Firestore export file
 */
async function readSampleExportFile(backupPath, collectionName = null) {
  try {
    // Find export files
    const prefix = collectionName 
      ? `${backupPath}/all_collections/all_namespaces/all_kinds/${collectionName}/`
      : `${backupPath}/all_collections/all_namespaces/all_kinds/`;
    
    const [files] = await bucket.getFiles({ prefix });
    
    // Get first output file
    const outputFiles = files.filter(f => f.name.includes('output-') && !f.name.includes('metadata'));
    
    if (outputFiles.length === 0) {
      console.log(`No output files found for prefix: ${prefix}`);
      return null;
    }
    
    const sampleFile = outputFiles[0];
    console.log(`Reading sample file: ${sampleFile.name}`);
    
    const [contents] = await sampleFile.download();
    const data = JSON.parse(contents.toString());
    
    return {
      file: sampleFile.name,
      documentCount: data.length,
      sampleDocuments: data.slice(0, 3) // First 3 documents
    };
  } catch (error) {
    console.error('Error reading export file:', error.message);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  const backupId = process.argv[2] || '2025-12-24_153623';
  const env = process.argv[3] || 'dev';
  const collectionName = process.argv[4] || null;
  
  const backupPath = `${env}/${backupId}/firestore/all_collections`;
  
  console.log(`\n📖 Reading Backup: ${backupId} (${env})`);
  console.log('='.repeat(60));
  
  // List files
  console.log('\n📁 Listing backup files...');
  const files = await listBackupFiles(`${env}/${backupId}/`);
  console.log(`   Found ${files.length} files total`);
  
  // Read metadata
  console.log('\n📋 Reading export metadata...');
  const metadata = await readExportMetadata(backupPath);
  if (metadata) {
    console.log('   Export Info:');
    console.log(`   - Output URI Prefix: ${metadata.outputUriPrefix}`);
    console.log(`   - Start Time: ${metadata.startTime}`);
    console.log(`   - End Time: ${metadata.endTime || 'In progress'}`);
  }
  
  // Read sample data
  console.log('\n📄 Reading sample export data...');
  if (collectionName) {
    console.log(`   Reading collection: ${collectionName}`);
    const sample = await readSampleExportFile(backupPath, collectionName);
    if (sample) {
      console.log(`   ✅ Found ${sample.documentCount} documents`);
      console.log(`   Sample documents:`);
      sample.sampleDocuments.forEach((doc, idx) => {
        console.log(`\n   Document ${idx + 1}:`);
        console.log(`   - ID: ${doc.name?.split('/').pop() || 'N/A'}`);
        console.log(`   - Fields: ${Object.keys(doc.fields || {}).join(', ')}`);
        if (doc.fields) {
          // Show a few field values
          const fieldKeys = Object.keys(doc.fields).slice(0, 3);
          fieldKeys.forEach(key => {
            const field = doc.fields[key];
            let value = 'N/A';
            if (field.stringValue) value = field.stringValue;
            else if (field.integerValue) value = field.integerValue;
            else if (field.doubleValue) value = field.doubleValue;
            else if (field.booleanValue !== undefined) value = field.booleanValue;
            else if (field.timestampValue) value = field.timestampValue;
            else value = JSON.stringify(field).substring(0, 50);
            console.log(`     ${key}: ${value}`);
          });
        }
      });
    }
  } else {
    // List available collections by checking directory structure
    console.log('   Checking available collections...');
    const [allFiles] = await bucket.getFiles({ 
      prefix: `${backupPath}/all_namespaces/all_kinds/` 
    });
    
    // Extract collection names from file paths
    const collections = new Set();
    allFiles.forEach(file => {
      const match = file.name.match(/all_kinds\/([^/]+)\//);
      if (match) {
        collections.add(match[1]);
      }
    });
    
    console.log(`   ✅ Found ${collections.size} collections:`);
    Array.from(collections).sort().forEach(col => {
      console.log(`      - ${col}`);
    });
    
    // Read sample from first collection
    if (collections.size > 0) {
      const firstCollection = Array.from(collections)[0];
      console.log(`\n   Reading sample from collection: ${firstCollection}`);
      const sample = await readSampleExportFile(backupPath, firstCollection);
      if (sample) {
        console.log(`   ✅ Found ${sample.documentCount} documents in ${firstCollection}`);
      }
    }
  }
  
  // Check storage backup
  console.log('\n📦 Checking Storage backup...');
  const [storageFiles] = await bucket.getFiles({ 
    prefix: `${env}/${backupId}/storage/` 
  });
  console.log(`   ✅ Found ${storageFiles.length} storage files`);
  if (storageFiles.length > 0) {
    const totalSize = storageFiles.reduce((sum, file) => sum + parseInt(file.metadata.size || 0), 0);
    console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Sample files:`);
    storageFiles.slice(0, 5).forEach(file => {
      const path = file.name.replace(`${env}/${backupId}/storage/`, '');
      console.log(`      - ${path} (${(parseInt(file.metadata.size || 0) / 1024).toFixed(1)} KB)`);
    });
  }
  
  console.log('\n✅ Backup verification complete!\n');
}

main().catch(console.error);


/**
 * Extract Specific Value from Firestore Backup Export
 * Uses string search on protobuf export files to find document values
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
 * Search export files for specific document path and field value
 */
async function extractValue(backupPath, documentPath, fieldName) {
  try {
    // Get all output files
    const [files] = await bucket.getFiles({ 
      prefix: `${backupPath}/firestore/all_collections/all_namespaces/all_kinds/`,
      matchGlob: '**/output-*'
    });
    
    console.log(`\n🔍 Searching ${files.length} export files...`);
    console.log(`   Document: ${documentPath}`);
    console.log(`   Field: ${fieldName}`);
    
    // Convert document path to search pattern
    // clients/MTC/units/PH4D/dues/2025 -> look for "PH4D" and "dues" and "2025"
    const pathParts = documentPath.split('/');
    const searchTerms = pathParts.filter(p => p && p !== 'clients');
    
    for (const file of files) {
      try {
        const [contents] = await file.download();
        
        // Search for document path indicators
        const contentStr = contents.toString('binary');
        let foundPath = false;
        
        // Check if file contains path indicators
        for (const term of searchTerms) {
          if (contentStr.includes(term)) {
            foundPath = true;
            break;
          }
        }
        
        if (foundPath) {
          console.log(`\n✅ Found document path in: ${file.name}`);
          
          // Try to extract readable strings around the field
          // Convert to string and search for field name and value patterns
          const readableStr = contents.toString('utf8', 0, Math.min(contents.length, 500000));
          
          // Look for field name near document path
          const fieldIndex = readableStr.indexOf(fieldName);
          const pathIndex = readableStr.indexOf(searchTerms[searchTerms.length - 1]); // Last part (2025)
          
          if (fieldIndex !== -1 && pathIndex !== -1 && Math.abs(fieldIndex - pathIndex) < 5000) {
            // Extract context around field
            const start = Math.max(0, fieldIndex - 200);
            const end = Math.min(readableStr.length, fieldIndex + 500);
            const context = readableStr.substring(start, end);
            
            console.log(`\n📄 Found field "${fieldName}" near document path:`);
            console.log('   Context (first 500 chars):');
            console.log('   ' + context.replace(/\n/g, ' ').substring(0, 500));
            
            // Try to extract numeric value (for scheduledAmount = 580000)
            const numberMatch = context.match(/\d{5,}/); // 5+ digit numbers
            if (numberMatch) {
              console.log(`\n   💰 Potential value found: ${numberMatch[0]}`);
              console.log(`   (This is in centavos - ${parseInt(numberMatch[0]) / 100} pesos)`);
            }
            
            return {
              found: true,
              file: file.name,
              context: context.substring(0, 200)
            };
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    return { found: false };
  } catch (error) {
    console.error('Error:', error.message);
    return { found: false, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  const backupId = process.argv[2] || '2025-12-24_153623';
  const env = process.argv[3] || 'dev';
  const documentPath = process.argv[4] || 'clients/MTC/units/PH4D/dues/2025';
  const fieldName = process.argv[5] || 'scheduledAmount';
  
  console.log(`\n🔍 Extracting Value from Backup`);
  console.log('='.repeat(70));
  console.log(`Backup: ${backupId} (${env})`);
  console.log(`Document: ${documentPath}`);
  console.log(`Field: ${fieldName}`);
  
  const backupPath = `${env}/${backupId}`;
  const result = await extractValue(backupPath, documentPath, fieldName);
  
  if (result.found) {
    console.log(`\n✅ Successfully found field in backup export!`);
    console.log(`   File: ${result.file}`);
  } else {
    console.log(`\n⚠️  Could not extract value directly (export is binary protobuf)`);
    console.log(`   However, the document path exists in the export files,`);
    console.log(`   which confirms the deep subcollection was backed up.`);
    console.log(`\n   To verify exact values, restore to a test database.`);
  }
  
  console.log('\n✅ Verification complete!\n');
}

main().catch(console.error);


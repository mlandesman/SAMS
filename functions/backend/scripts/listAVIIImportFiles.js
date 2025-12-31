/**
 * List all files in Firebase Storage for AVII imports
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.argv[2] || 'dev';

// Initialize Firebase
if (getApps().length === 0) {
  const serviceAccountPath = environment === 'prod'
    ? path.resolve(__dirname, '../serviceAccountKey-prod.json')
    : path.resolve(__dirname, '../serviceAccountKey.json');
  
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'sandyland-management-system.firebasestorage.app'
  });
}

async function listFiles() {
  console.log(`\n📁 Listing AVII import files in Firebase Storage (${environment.toUpperCase()})\n`);
  
  const bucket = getStorage().bucket();
  
  // List files in imports/AVII/
  const [files] = await bucket.getFiles({ prefix: 'imports/AVII/' });
  
  console.log(`Found ${files.length} files:\n`);
  
  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const sizeKB = (parseInt(metadata.size) / 1024).toFixed(1);
    console.log(`  ${file.name.padEnd(60)} ${sizeKB.padStart(8)} KB   ${metadata.updated}`);
  }
  
  // Also check for Transactions.json specifically
  console.log('\n🔍 Checking for Transactions.json...');
  const [txnFiles] = await bucket.getFiles({ prefix: 'imports/AVII/Transactions' });
  
  if (txnFiles.length > 0) {
    console.log('   ✅ Found Transactions file(s):');
    for (const f of txnFiles) {
      console.log(`      - ${f.name}`);
    }
  } else {
    console.log('   ❌ No Transactions.json found');
  }
}

listFiles()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


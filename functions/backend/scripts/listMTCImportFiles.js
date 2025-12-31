/**
 * List MTC import files in Firebase Storage
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    await readFile(path.resolve(__dirname, '../serviceAccountKey.json'), 'utf8')
  );
  initializeApp({ 
    credential: cert(serviceAccount),
    storageBucket: 'sandyland-management-system.firebasestorage.app'
  });
}

const bucket = getStorage().bucket();

async function listMTCFiles() {
  console.log('\n📁 MTC Import Files in Storage:\n');
  
  const [files] = await bucket.getFiles({ prefix: 'imports/MTC/' });
  
  for (const file of files) {
    console.log(`  ${file.name}`);
  }
  
  // Check for cross-ref files specifically
  console.log('\n🔗 Looking for CrossRef files...');
  const crossRefFiles = files.filter(f => f.name.includes('CrossRef'));
  
  if (crossRefFiles.length === 0) {
    console.log('  ❌ No CrossRef files found for MTC');
  } else {
    for (const f of crossRefFiles) {
      console.log(`  ✅ ${f.name}`);
    }
  }
}

listMTCFiles()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


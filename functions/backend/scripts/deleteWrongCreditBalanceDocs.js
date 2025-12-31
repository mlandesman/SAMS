/**
 * Delete the incorrectly created individual unit creditBalances documents
 * 
 * WRONG: /clients/AVII/units/{unitId}/creditBalances/current
 * RIGHT: /clients/AVII/units/creditBalances (single doc with all units)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.argv[2] || 'dev';
const dryRun = process.argv.includes('--dry-run');

// Initialize Firebase
if (getApps().length === 0) {
  const serviceAccountPath = environment === 'prod'
    ? path.resolve(__dirname, '../serviceAccountKey-prod.json')
    : path.resolve(__dirname, '../serviceAccountKey.json');
  
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];

async function deleteWrongDocs() {
  console.log(`\n🗑️  Deleting WRONG creditBalances documents (${environment.toUpperCase()})`);
  console.log(`   Dry Run: ${dryRun ? 'YES' : 'NO'}\n`);
  
  for (const unitId of units) {
    const wrongRef = db.collection('clients').doc('AVII')
      .collection('units').doc(unitId)
      .collection('creditBalances').doc('current');
    
    const doc = await wrongRef.get();
    
    if (doc.exists) {
      if (!dryRun) {
        await wrongRef.delete();
        console.log(`   ✅ Deleted: /units/${unitId}/creditBalances/current`);
      } else {
        console.log(`   🔍 [DRY RUN] Would delete: /units/${unitId}/creditBalances/current`);
      }
    } else {
      console.log(`   ⏭️  Not found: /units/${unitId}/creditBalances/current`);
    }
  }
  
  console.log('\n✅ Cleanup complete');
}

deleteWrongDocs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


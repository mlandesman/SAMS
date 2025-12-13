/**
 * Test for Firebase Ghost Records
 * 
 * Run this AFTER purge but BEFORE import to check if any data persists.
 * If data exists after purge, it confirms ghost records.
 * 
 * Usage: node backend/scripts/test-ghost-records.js
 */

import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const serviceAccountPath = new URL('../serviceAccountKey.json', import.meta.url);
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const CLIENT_ID = 'AVII';

console.log('='.repeat(70));
console.log('GHOST RECORD TEST - Run AFTER purge, BEFORE import');
console.log('='.repeat(70));
console.log();

let ghostsFound = false;

// Test 1: Check if client document exists
console.log('1. Checking if client document exists...');
const clientDoc = await db.collection('clients').doc(CLIENT_ID).get();
console.log(`   clients/${CLIENT_ID}: ${clientDoc.exists ? '❌ EXISTS' : '✅ Gone'}`);
if (clientDoc.exists) {
  ghostsFound = true;
  console.log('   Keys:', Object.keys(clientDoc.data()));
}

// Test 2: Check transactions collection
console.log();
console.log('2. Checking transactions collection...');
const txSnap = await db.collection('clients').doc(CLIENT_ID).collection('transactions').limit(5).get();
console.log(`   transactions: ${txSnap.size > 0 ? `❌ ${txSnap.size}+ docs exist` : '✅ Empty'}`);
if (txSnap.size > 0) {
  ghostsFound = true;
  txSnap.docs.forEach(doc => {
    console.log(`   - ${doc.id}`);
  });
}

// Test 3: Check units collection
console.log();
console.log('3. Checking units collection...');
const unitsSnap = await db.collection('clients').doc(CLIENT_ID).collection('units').get();
console.log(`   units: ${unitsSnap.size > 0 ? `❌ ${unitsSnap.size} docs exist` : '✅ Empty'}`);

// Test 4: Check specific dues documents where we found ghost data
console.log();
console.log('4. Checking specific dues documents (ghost record hotspots)...');

const hotspots = [
  { unitId: '202', year: '2026' },
  { unitId: '204', year: '2026' },
  { unitId: '101', year: '2026' },
];

for (const { unitId, year } of hotspots) {
  const duesRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc(unitId)
    .collection('dues').doc(year);
  
  const duesDoc = await duesRef.get();
  const status = duesDoc.exists ? '❌ EXISTS' : '✅ Gone';
  console.log(`   units/${unitId}/dues/${year}: ${status}`);
  
  if (duesDoc.exists) {
    ghostsFound = true;
    const data = duesDoc.data();
    console.log(`      payments: ${data.payments?.length || 0}`);
    if (data.payments?.length > 0) {
      console.log(`      Transaction IDs: ${data.payments.map(p => p.transactionId).join(', ')}`);
    }
  }
}

// Test 5: Check water bills
console.log();
console.log('5. Checking water bills collection...');
const waterBillsSnap = await db.collection('clients').doc(CLIENT_ID)
  .collection('projects').doc('waterBills').collection('bills').get();
console.log(`   waterBills/bills: ${waterBillsSnap.size > 0 ? `❌ ${waterBillsSnap.size} docs exist` : '✅ Empty'}`);

// Test 6: Check import metadata
console.log();
console.log('6. Checking import metadata...');
const importMetaSnap = await db.collection('clients').doc(CLIENT_ID).collection('importMetadata').limit(5).get();
console.log(`   importMetadata: ${importMetaSnap.size > 0 ? `❌ ${importMetaSnap.size}+ docs exist` : '✅ Empty'}`);

// Summary
console.log();
console.log('='.repeat(70));
if (ghostsFound) {
  console.log('⚠️  GHOST RECORDS DETECTED!');
  console.log('   Data exists after purge - this confirms Firebase ghost record issue.');
  console.log('   Consider using batch delete on specific documents before re-importing.');
} else {
  console.log('✅ NO GHOST RECORDS FOUND');
  console.log('   All tested paths are empty after purge.');
  console.log('   If duplicates appear after import, the issue is in the import process.');
}
console.log('='.repeat(70));

process.exit(0);

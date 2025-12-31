/**
 * Inspect Unit 201 credit balance data
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase
if (getApps().length === 0) {
  const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function inspect() {
  console.log('\n🔍 Inspecting Unit 201 Credit Balance Data\n');
  
  // Check the CORRECT single document location
  const creditRef = db.collection('clients').doc('AVII')
    .collection('units').doc('creditBalances');
  
  const creditDoc = await creditRef.get();
  
  if (!creditDoc.exists) {
    console.log('❌ No creditBalances document found');
    return;
  }
  
  const allData = creditDoc.data();
  const data = allData['201'];
  
  if (!data) {
    console.log('❌ No Unit 201 data in creditBalances document');
    return;
  }
  
  console.log('📄 Unit 201 data from CORRECT location:');
  console.log(JSON.stringify(data, null, 2));
  
  console.log('\n📊 Credit Balance Calculation:');
  const balance = getCreditBalance(data);
  console.log(`   getCreditBalance() returns: ${balance} centavos`);
  console.log(`   In pesos: $${(balance / 100).toFixed(2)}`);
  
  console.log('\n📋 History entries:');
  if (data.history) {
    let running = 0;
    for (const entry of data.history) {
      running += entry.amount;
      console.log(`   ${entry.timestamp?.split('T')[0] || 'N/A'}: ${entry.type.padEnd(15)} ${String(entry.amount).padStart(8)} → Running: ${running} (${(running/100).toFixed(2)})`);
    }
  }
  
  // Verify no WRONG location exists
  console.log('\n🔍 Checking WRONG location (should not exist)...');
  const wrongRef = db.collection('clients').doc('AVII')
    .collection('units').doc('201')
    .collection('creditBalances').doc('current');
  const wrongDoc = await wrongRef.get();
  
  if (wrongDoc.exists) {
    console.log('⚠️  WRONG LOCATION still exists! Should be deleted.');
  } else {
    console.log('✅ WRONG location does not exist (good!)');
  }
}

inspect()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


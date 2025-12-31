/**
 * Inspect AVII transactions to understand the data structure
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
  console.log(`\n🔍 Inspecting AVII transactions in DEV\n`);
  
  const transactionsRef = db.collection('clients').doc('AVII').collection('transactions');
  
  // Get all transactions
  const snapshot = await transactionsRef.limit(30).get();
  
  console.log(`📋 Found ${snapshot.size} payment transactions (showing first 20)\n`);
  console.log('='.repeat(80));
  
  for (const doc of snapshot.docs) {
    const txn = doc.data();
    console.log(`\nID: ${doc.id}`);
    console.log(`Unit: ${txn.unitId}`);
    console.log(`Date: ${txn.date}`);
    console.log(`Amount: ${txn.amount}`);
    console.log(`Notes: ${txn.notes || '(none)'}`);
    if (txn.allocations) {
      console.log(`Allocations: ${JSON.stringify(txn.allocations, null, 2)}`);
    }
    console.log('-'.repeat(40));
  }
}

inspect()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


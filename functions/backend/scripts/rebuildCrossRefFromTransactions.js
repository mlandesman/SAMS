/**
 * Rebuild HOA Transaction CrossRef from existing transactions
 * 
 * Queries transactions for sequence numbers in their notes
 * and builds the mapping needed for credit balance linking
 * 
 * Usage: node rebuildCrossRefFromTransactions.js [clientId] [environment]
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const clientId = process.argv[2] || 'AVII';
const environment = process.argv[3] || 'dev';

// Initialize Firebase
if (getApps().length === 0) {
  const serviceAccountPath = environment === 'prod'
    ? path.resolve(__dirname, '../serviceAccountKey-prod.json')
    : path.resolve(__dirname, '../serviceAccountKey.json');
  
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

async function rebuildCrossRef() {
  console.log(`\n🔄 Rebuilding HOA CrossRef for ${clientId} in ${environment.toUpperCase()}\n`);
  
  const crossRef = {
    clientId,
    generatedAt: new Date().toISOString(),
    source: 'rebuilt from transactions',
    bySequence: {},
    byUnit: {},
    totalRecords: 0
  };
  
  // Query all transactions for this client
  const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
  const snapshot = await transactionsRef.get();
  
  console.log(`📋 Found ${snapshot.size} transactions to scan\n`);
  
  // Pattern to match sequence numbers like "Seq: 25056" or just "25056" at end
  const seqPatterns = [
    /Seq:\s*(\d+)/i,
    /sequence[:\s]+(\d+)/i,
    /\b(25\d{3})\b/  // AVII sequence numbers appear to start with 25
  ];
  
  for (const doc of snapshot.docs) {
    const txn = doc.data();
    const txnId = doc.id;
    
    // Check notes field for sequence number
    const notes = txn.notes || '';
    let seqNumber = null;
    
    for (const pattern of seqPatterns) {
      const match = notes.match(pattern);
      if (match) {
        seqNumber = match[1];
        break;
      }
    }
    
    // Also check if there's a sequenceNumber field directly
    if (!seqNumber && txn.sequenceNumber) {
      seqNumber = String(txn.sequenceNumber);
    }
    
    if (seqNumber) {
      const unitId = txn.unitId || txn.unit;
      
      crossRef.bySequence[seqNumber] = {
        transactionId: txnId,
        unitId,
        amount: txn.amount,
        date: txn.date,
        type: txn.type,
        notes: notes.substring(0, 100)
      };
      
      if (!crossRef.byUnit[unitId]) {
        crossRef.byUnit[unitId] = [];
      }
      crossRef.byUnit[unitId].push({
        transactionId: txnId,
        sequenceNumber: seqNumber,
        amount: txn.amount,
        date: txn.date
      });
      
      crossRef.totalRecords++;
      console.log(`✅ Seq ${seqNumber} → ${txnId} (${unitId})`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total transactions scanned: ${snapshot.size}`);
  console.log(`   Transactions with sequence numbers: ${crossRef.totalRecords}`);
  console.log(`   Units with cross-references: ${Object.keys(crossRef.byUnit).length}`);
  
  // Save to file
  const outputPath = path.resolve(__dirname, `../data/imports/HOA_Transaction_CrossRef_${clientId}.json`);
  await writeFile(outputPath, JSON.stringify(crossRef, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);
  
  // Also show sequence numbers we need but might not have found
  console.log(`\n🔍 Checking against your CSV sequence numbers...`);
  
  // These are the sequence numbers from the CSV that need linking
  const neededSequences = [
    '25035', '25057', '25046', '25008', '25049', '25045', 
    '25053', '25063', '25066', '25033', '25056', '25022'
  ];
  
  const found = [];
  const missing = [];
  
  for (const seq of neededSequences) {
    if (crossRef.bySequence[seq]) {
      found.push(seq);
    } else {
      missing.push(seq);
    }
  }
  
  console.log(`\n   ✅ Found: ${found.join(', ') || 'none'}`);
  console.log(`   ❌ Missing: ${missing.join(', ') || 'none'}`);
  
  return crossRef;
}

rebuildCrossRef()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


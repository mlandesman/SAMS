/**
 * Build HOA Transaction CrossRef by matching source Transactions.json
 * to existing Firestore transactions
 * 
 * Usage: node buildCrossRefFromSource.js [environment] [--upload]
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.argv[2] || 'dev';
const shouldUpload = process.argv.includes('--upload');

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

const db = getFirestore();

function normalizeUnit(unitStr) {
  // Extract unit number from "104 (Manuel González)" format
  const match = unitStr?.match(/^(\d+)/);
  return match ? match[1] : unitStr;
}

async function buildCrossRef() {
  console.log(`\n🔗 Building HOA Transaction CrossRef (${environment.toUpperCase()})\n`);
  
  // Load source Transactions.json
  const sourcePath = path.resolve(__dirname, '../data/imports/Transactions_AVII.json');
  const sourceTransactions = JSON.parse(await readFile(sourcePath, 'utf8'));
  
  // Filter to HOA Dues with sequence numbers
  const hoaTransactions = sourceTransactions.filter(t => 
    t.Category === "HOA Dues" && t[""] && t[""].toString().match(/^\d+$/)
  );
  
  console.log(`📋 Found ${hoaTransactions.length} HOA Dues transactions with sequence numbers\n`);
  
  // Load all existing transactions from Firestore
  const txnRef = db.collection('clients').doc('AVII').collection('transactions');
  const snapshot = await txnRef.get();
  
  console.log(`📊 Found ${snapshot.size} transactions in Firestore\n`);
  
  // Build list of Firestore transactions for flexible matching
  const firestoreTxnList = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Normalize the date to just the date portion
    let dateStr = '';
    if (data.date) {
      if (typeof data.date === 'string') {
        dateStr = data.date.split('T')[0];
      } else if (data.date.toDate) {
        dateStr = data.date.toDate().toISOString().split('T')[0];
      }
    }
    const unit = data.unitId || data.unit || '';
    const amount = Math.round(data.amount / 100); // Convert centavos to pesos
    
    firestoreTxnList.push({
      id: doc.id,
      unit,
      date: dateStr,
      dateObj: new Date(dateStr),
      amount,
      notes: data.notes
    });
  }
  
  // Helper function to find match with fuzzy date (within 5 days)
  function findMatch(unit, targetDate, amount) {
    const targetDateObj = new Date(targetDate);
    
    // First try exact match
    const exactMatch = firestoreTxnList.find(t => 
      t.unit === unit && t.date === targetDate && t.amount === amount
    );
    if (exactMatch) return exactMatch;
    
    // Then try fuzzy date match (within 5 days, same amount)
    const fuzzyMatch = firestoreTxnList.find(t => {
      if (t.unit !== unit || t.amount !== amount) return false;
      const daysDiff = Math.abs((targetDateObj - t.dateObj) / (1000 * 60 * 60 * 24));
      return daysDiff <= 5;
    });
    return fuzzyMatch;
  }
  
  // Build cross-reference
  const crossRef = {
    generated: new Date().toISOString(),
    clientId: 'AVII',
    totalRecords: 0,
    bySequence: {},
    byUnit: {}
  };
  
  let matched = 0;
  let unmatched = 0;
  
  for (const srcTxn of hoaTransactions) {
    const seq = String(srcTxn[""]);
    const unit = normalizeUnit(srcTxn.Unit);
    const date = srcTxn.Date.split('T')[0];
    const amount = Math.round(srcTxn.Amount);
    
    const firestoreMatch = findMatch(unit, date, amount);
    
    if (firestoreMatch) {
      matched++;
      crossRef.bySequence[seq] = {
        transactionId: firestoreMatch.id,
        unitId: unit,
        amount: srcTxn.Amount,
        date: srcTxn.Date
      };
      
      if (!crossRef.byUnit[unit]) {
        crossRef.byUnit[unit] = [];
      }
      crossRef.byUnit[unit].push({
        transactionId: firestoreMatch.id,
        sequenceNumber: seq,
        amount: srcTxn.Amount,
        date: srcTxn.Date
      });
      
      crossRef.totalRecords++;
      console.log(`  ✅ Seq ${seq} → ${firestoreMatch.id} (Unit ${unit})`);
    } else {
      unmatched++;
      console.log(`  ❌ Seq ${seq} - No match found (Unit ${unit}, ${date}, ${amount} pesos)`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Matched: ${matched}`);
  console.log(`   Unmatched: ${unmatched}`);
  console.log(`   Total records in cross-ref: ${crossRef.totalRecords}`);
  
  // Check the specific sequences from our CSV
  console.log('\n🔍 Checking CSV sequence numbers:');
  const csvSequences = ['25035', '25057', '25046', '25008', '25049', '25045', '25053', '25063', '25066', '25033', '25056', '25022'];
  for (const seq of csvSequences) {
    if (crossRef.bySequence[seq]) {
      console.log(`   ✅ ${seq} → ${crossRef.bySequence[seq].transactionId}`);
    } else {
      console.log(`   ❌ ${seq} - NOT IN CROSS-REF`);
    }
  }
  
  // Save locally
  const localPath = path.resolve(__dirname, '../data/imports/HOA_Transaction_CrossRef_AVII.json');
  await writeFile(localPath, JSON.stringify(crossRef, null, 2));
  console.log(`\n💾 Saved locally: ${localPath}`);
  
  // Upload to Firebase Storage if requested
  if (shouldUpload) {
    const bucket = getStorage().bucket();
    const storagePath = 'imports/AVII/HOA_Transaction_CrossRef.json';
    await bucket.file(storagePath).save(JSON.stringify(crossRef, null, 2), {
      contentType: 'application/json'
    });
    console.log(`☁️  Uploaded to Firebase Storage: ${storagePath}`);
  }
  
  return crossRef;
}

buildCrossRef()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


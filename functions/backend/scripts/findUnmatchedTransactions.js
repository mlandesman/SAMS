/**
 * Find potential matches for unmatched transactions
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

async function findMatches() {
  console.log('\n🔍 Looking for unmatched transactions\n');
  
  // The unmatched sequences from our CSV
  const unmatched = [
    { seq: '25049', unit: '104', date: '2025-10-11', amount: 13000 },
    { seq: '25053', unit: '106', date: '2025-10-17', amount: 24000 },
    { seq: '25063', unit: '106', date: '2025-11-28', amount: 12000 },
    { seq: '25066', unit: '106', date: '2025-12-20', amount: 22000 }
  ];
  
  const txnRef = db.collection('clients').doc('AVII').collection('transactions');
  
  for (const u of unmatched) {
    console.log(`\n--- Seq ${u.seq}: Unit ${u.unit}, ${u.date}, ${u.amount} pesos ---`);
    
    // Search by unit
    const snapshot = await txnRef.where('unitId', '==', u.unit).get();
    
    // Filter to similar dates (within 5 days) or similar amounts
    const similar = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      let dateStr = '';
      if (data.date) {
        if (typeof data.date === 'string') {
          dateStr = data.date.split('T')[0];
        } else if (data.date.toDate) {
          dateStr = data.date.toDate().toISOString().split('T')[0];
        }
      }
      const amountPesos = Math.round(data.amount / 100);
      
      // Check if date is close or amount is close
      const targetDate = new Date(u.date);
      const txnDate = new Date(dateStr);
      const daysDiff = Math.abs((targetDate - txnDate) / (1000 * 60 * 60 * 24));
      const amountDiff = Math.abs(amountPesos - u.amount);
      
      if (daysDiff <= 5 || amountDiff <= 100) {
        similar.push({
          id: doc.id,
          date: dateStr,
          amount: amountPesos,
          notes: data.notes?.substring(0, 50)
        });
      }
    }
    
    if (similar.length > 0) {
      console.log('  Potential matches:');
      for (const s of similar) {
        console.log(`    ${s.id}: ${s.date}, ${s.amount} pesos - "${s.notes}"`);
      }
    } else {
      console.log('  No similar transactions found for this unit');
      
      // Show all transactions for this unit in the date range
      console.log('  All transactions for unit in Oct-Dec 2025:');
      for (const doc of snapshot.docs) {
        const data = doc.data();
        let dateStr = '';
        if (data.date) {
          if (typeof data.date === 'string') {
            dateStr = data.date.split('T')[0];
          } else if (data.date.toDate) {
            dateStr = data.date.toDate().toISOString().split('T')[0];
          }
        }
        if (dateStr >= '2025-10-01') {
          console.log(`    ${doc.id}: ${dateStr}, ${Math.round(data.amount/100)} pesos`);
        }
      }
    }
  }
}

findMatches()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


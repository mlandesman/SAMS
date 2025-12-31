/**
 * Check MTC credit balance history quality
 * Look for missing timestamps, notes, or incorrect data
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DEV
if (getApps().length === 0) {
  const devServiceAccount = JSON.parse(
    await readFile(path.resolve(__dirname, '../serviceAccountKey.json'), 'utf8')
  );
  initializeApp({ credential: cert(devServiceAccount) });
}

const db = getFirestore();

const formatTimestamp = (ts) => {
  if (!ts) return null;
  if (typeof ts === 'string') return ts.split('T')[0];
  if (ts.toDate) return ts.toDate().toISOString().split('T')[0];
  return null;
};

async function inspectQuality() {
  console.log('\n🔍 MTC Credit Balance History Quality Check\n');
  
  const ref = db.collection('clients').doc('MTC').collection('units').doc('creditBalances');
  const doc = await ref.get();
  
  if (!doc.exists) {
    console.log('❌ No credit balance document found');
    return;
  }
  
  const data = doc.data();
  const units = Object.keys(data).filter(k => /^[A-Z0-9]+$/i.test(k)).sort();
  
  for (const unitId of units) {
    const unitData = data[unitId];
    const balance = getCreditBalance(unitData);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Unit ${unitId} - Credit Balance: $${(balance / 100).toFixed(2)}`);
    console.log('='.repeat(70));
    
    if (!unitData.history || unitData.history.length === 0) {
      console.log('   No history entries');
      continue;
    }
    
    let runningBalance = 0;
    let issues = [];
    
    console.log('\nDate       | Type            | Amount     | Running   | Notes');
    console.log('-'.repeat(70));
    
    for (const entry of unitData.history) {
      const date = formatTimestamp(entry.timestamp);
      runningBalance += entry.amount || 0;
      
      // Check for issues
      if (!date) issues.push(`Missing timestamp for entry: ${entry.type}`);
      if (!entry.notes || entry.notes.length < 3) issues.push(`Missing/short notes for entry on ${date}`);
      if (entry.type === 'credit_used' && entry.amount > 0) issues.push(`credit_used has positive amount on ${date}`);
      if (entry.type === 'credit_added' && entry.amount < 0) issues.push(`credit_added has negative amount on ${date}`);
      
      console.log(
        `${(date || 'N/A').padEnd(10)} | ` +
        `${(entry.type || 'unknown').padEnd(15)} | ` +
        `${String(entry.amount || 0).padStart(10)} | ` +
        `${String(runningBalance).padStart(9)} | ` +
        `${(entry.notes || '').substring(0, 25)}`
      );
    }
    
    // Verify final balance matches calculated
    if (runningBalance !== balance) {
      issues.push(`Calculated balance (${runningBalance}) doesn't match getCreditBalance (${balance})`);
    }
    
    if (issues.length > 0) {
      console.log('\n⚠️  ISSUES:');
      issues.forEach(i => console.log(`   - ${i}`));
    } else {
      console.log('\n✅ No quality issues');
    }
  }
}

inspectQuality()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


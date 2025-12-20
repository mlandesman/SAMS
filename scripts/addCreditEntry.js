#!/usr/bin/env node
/**
 * Add a credit history entry to a unit
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp({ 
  credential: applicationDefault(), 
  projectId: 'sandyland-management-system' 
});

const db = getFirestore();

async function main() {
  const unitId = '106';
  
  // The new entry - credit USED so negative amount
  const newEntry = {
    id: `txn_2025-12-19_223505_272`,
    timestamp: '2025-12-19T05:00:00.000Z', // 12:00 AM EST = 05:00 UTC
    amount: -450478, // -$4,504.78 in centavos (credit used)
    note: 'Posted: MXN 22,000.00 on Fri, Dec 19, 2025, 12:00:00 AM EST HOA: Q2, Q3 2026. Credit: $-4504.78 Payment: eTransfer TxnID: 2025-12-19_223505_272 (Q2 Month 3/3)',
    source: 'transaction',
    transactionId: '2025-12-19_223505_272'
  };
  
  console.log(`\n📝 Adding credit entry to Unit ${unitId}:`);
  console.log(`   Amount: $${(newEntry.amount / 100).toFixed(2)}`);
  console.log(`   Note: ${newEntry.note.substring(0, 80)}...`);
  
  // Get current credit balances doc
  const creditBalancesRef = db.collection('clients').doc('AVII')
    .collection('units').doc('creditBalances');
  
  const doc = await creditBalancesRef.get();
  const data = doc.data();
  
  if (!data || !data[unitId]) {
    console.error(`❌ Unit ${unitId} not found in creditBalances`);
    process.exit(1);
  }
  
  // Add the new entry to the history array
  const currentHistory = data[unitId].history || [];
  const updatedHistory = [...currentHistory, newEntry];
  
  // Calculate new balance
  const newBalance = updatedHistory.reduce((sum, e) => sum + e.amount, 0) / 100;
  
  console.log(`\n   Current entries: ${currentHistory.length}`);
  console.log(`   New entries: ${updatedHistory.length}`);
  console.log(`   New balance: $${newBalance.toFixed(2)}`);
  
  // Update in Firebase
  await creditBalancesRef.update({
    [`${unitId}.history`]: updatedHistory,
    [`${unitId}.lastChange`]: {
      timestamp: new Date().toISOString(),
      year: '2026'
    }
  });
  
  console.log(`\n✅ Entry added successfully`);
}

main().catch(console.error);

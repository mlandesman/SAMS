/**
 * Purge Transactions
 * 
 * Removes all transactions for MTC client to allow clean re-import
 * 
 * Task ID: MTC-MIGRATION-001 - Purge Transactions
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

const CLIENT_ID = 'MTC';

async function purgeTransactions() {
  console.log('🗑️ Purging MTC transactions...\n');
  
  await initializeFirebase();
  const db = await getDb();
  
  const transactionsRef = db.collection('clients').doc(CLIENT_ID).collection('transactions');
  const snapshot = await transactionsRef.get();
  
  console.log(`📊 Found ${snapshot.size} transactions to delete`);
  
  if (snapshot.size === 0) {
    console.log('✅ No transactions to purge');
    return;
  }
  
  // Delete in batches
  const batch = db.batch();
  let count = 0;
  
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
    count++;
    
    if (count % 100 === 0) {
      console.log(`   Queued ${count} for deletion...`);
    }
  });
  
  console.log(`\n🔄 Deleting ${count} transactions...`);
  await batch.commit();
  
  // Reset account balances to 0
  console.log('\n💳 Resetting account balances...');
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const clientDoc = await clientRef.get();
  
  if (clientDoc.exists) {
    const clientData = clientDoc.data();
    const accounts = clientData.accounts || [];
    
    const resetAccounts = accounts.map(account => ({
      ...account,
      balance: 0,
      lastUpdated: new Date(),
      transactionCount: 0
    }));
    
    await clientRef.update({
      accounts: resetAccounts,
      accountsLastUpdated: new Date()
    });
    
    console.log(`✅ Reset balances for ${accounts.length} accounts`);
  }
  
  console.log('\n✅ Transaction purge complete!');
}

// Execute
purgeTransactions()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Purge failed:', error);
    process.exit(1);
  });
/**
 * Create Initial Balance Snapshot
 * 
 * Creates an initial balance snapshot from current account balances
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

async function createBalanceSnapshot() {
  console.log('📊 Creating initial balance snapshot...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const CLIENT_ID = 'MTC';
    
    // Get current client data with accounts
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.log('❌ Client not found');
      return;
    }
    
    const clientData = clientDoc.data();
    const accounts = clientData.accounts || [];
    
    console.log(`📋 Found ${accounts.length} accounts`);
    
    // Create balance snapshot
    const snapshotDate = new Date();
    const snapshotId = snapshotDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const balances = {};
    let totalUSD = 0;
    
    accounts.forEach(account => {
      balances[account.id] = {
        accountName: account.name,
        accountType: account.type,
        balance: account.balance,
        currency: account.currency,
        lastUpdated: account.lastUpdated || account.updated || new Date()
      };
      
      // Convert to USD for total (assuming all are already USD for now)
      if (account.currency === 'USD') {
        totalUSD += account.balance;
      }
      
      console.log(`   💰 ${account.name}: ${account.balance} ${account.currency}`);
    });
    
    const snapshot = {
      snapshotDate: snapshotDate,
      clientId: CLIENT_ID,
      balances: balances,
      totalBalanceUSD: totalUSD,
      accountCount: accounts.length,
      createdBy: 'system-migration-snapshot',
      createdAt: snapshotDate,
      metadata: {
        source: 'post-migration-initial-snapshot',
        migrationDate: snapshotDate.toISOString()
      }
    };
    
    // Save the snapshot
    const snapshotRef = db.collection('clients').doc(CLIENT_ID)
      .collection('balanceSnapshots').doc(snapshotId);
    
    await snapshotRef.set(snapshot);
    
    console.log(`\\n✅ Created balance snapshot: ${snapshotId}`);
    console.log(`📊 Total balance: $${totalUSD.toLocaleString()} USD`);
    console.log(`📅 Snapshot date: ${snapshotDate.toISOString()}`);
    
    // Update client with latest snapshot reference
    await clientRef.update({
      'metadata.lastBalanceSnapshot': snapshotDate,
      'metadata.lastBalanceSnapshotId': snapshotId,
      'metadata.lastModified': snapshotDate,
      'metadata.lastModifiedBy': 'system-snapshot-creation'
    });
    
    console.log('✅ Updated client metadata with snapshot reference');
    console.log('\\n🎯 Balance snapshot created successfully!');
    console.log('💡 The transaction warning should be resolved now.');
    
  } catch (error) {
    console.error('❌ Error creating balance snapshot:', error);
    throw error;
  }
}

// Execute
createBalanceSnapshot()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
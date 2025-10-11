/**
 * Set Manual Account Balances
 * 
 * Overrides calculated balances with spreadsheet values
 * 
 * Task ID: MTC-MIGRATION-001 - Manual Balance Override
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';

const CLIENT_ID = 'MTC';

/**
 * Manual balances from spreadsheet
 */
const MANUAL_BALANCES = {
  'bank-001': 153430,  // CiBanco
  'cash-001': 13580    // Cash
};

async function setManualBalances() {
  console.log('💰 Setting Manual Account Balances...\n');
  
  await initializeFirebase();
  const db = await getDb();
  
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    console.error('❌ Client not found');
    return;
  }
  
  const clientData = clientDoc.data();
  const accounts = clientData.accounts || [];
  
  console.log('📊 Current vs Manual Balances:');
  
  // Update balances
  const updatedAccounts = accounts.map(account => {
    const oldBalance = account.balance || 0;
    const newBalance = MANUAL_BALANCES[account.id];
    
    if (newBalance !== undefined) {
      console.log(`\n   ${account.name} (${account.id}):`);
      console.log(`   Current: $${oldBalance.toFixed(2)}`);
      console.log(`   Manual: $${newBalance.toFixed(2)}`);
      console.log(`   Adjustment: $${(newBalance - oldBalance).toFixed(2)}`);
      
      return {
        ...account,
        balance: newBalance,
        lastUpdated: new Date(),
        balanceNote: 'Manually set from spreadsheet totals',
        calculatedBalance: oldBalance,
        manualAdjustment: newBalance - oldBalance
      };
    }
    return account;
  });
  
  // Update client document
  await clientRef.update({
    accounts: updatedAccounts,
    accountsLastUpdated: new Date()
  });
  
  // Write audit log
  await writeAuditLog({
    clientId: CLIENT_ID,
    module: 'accounts',
    action: 'manual_balance_override',
    entityType: 'accounts',
    entityId: 'all',
    friendlyName: 'Manually set account balances to match spreadsheet',
    metadata: {
      adjustments: {
        'bank-001': {
          from: accounts.find(a => a.id === 'bank-001')?.balance || 0,
          to: MANUAL_BALANCES['bank-001']
        },
        'cash-001': {
          from: accounts.find(a => a.id === 'cash-001')?.balance || 0,
          to: MANUAL_BALANCES['cash-001']
        }
      },
      reason: 'Align with source spreadsheet totals',
      totalBefore: accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0),
      totalAfter: Object.values(MANUAL_BALANCES).reduce((sum, val) => sum + val, 0)
    }
  });
  
  // Verify the update
  console.log('\n🔍 Verifying update...');
  const verifyDoc = await clientRef.get();
  const verifyData = verifyDoc.data();
  const verifyAccounts = verifyData.accounts || [];
  
  console.log('\n✅ Updated Account Balances:');
  let totalBalance = 0;
  verifyAccounts.forEach(account => {
    console.log(`   ${account.name} (${account.id}): $${account.balance.toFixed(2)}`);
    totalBalance += account.balance;
  });
  console.log(`   Total: $${totalBalance.toFixed(2)}`);
  
  console.log('\n✅ Manual balance override complete!');
  console.log('📝 Audit log created for the adjustment');
}

// Execute
setManualBalances()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Manual balance update failed:', error);
    process.exit(1);
  });
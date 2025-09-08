/**
 * Fix Account IDs
 * 
 * Updates bank account ID from bank-cibanco-001 to bank-001
 * 
 * Task ID: MTC-MIGRATION-001 - Fix Account IDs
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';

const CLIENT_ID = 'MTC';

async function fixAccountIds() {
  console.log('🔧 Fixing account IDs...\n');
  
  await initializeFirebase();
  const db = await getDb();
  
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  
  // Step 1: Update accounts array in client document
  console.log('📝 Updating client accounts array...');
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    console.error('❌ Client not found');
    return;
  }
  
  const clientData = clientDoc.data();
  const accounts = clientData.accounts || [];
  
  // Update account IDs
  const updatedAccounts = accounts.map(account => {
    if (account.id === 'bank-cibanco-001') {
      console.log(`   🔄 Updating ${account.id} → bank-001`);
      return { ...account, id: 'bank-001' };
    }
    return account;
  });
  
  await clientRef.update({
    accounts: updatedAccounts,
    accountsLastUpdated: new Date()
  });
  
  console.log('✅ Client accounts array updated');
  
  // Step 2: Update accounts collection if it exists
  console.log('\n📂 Checking accounts collection...');
  const accountsRef = clientRef.collection('accounts');
  const oldAccountDoc = await accountsRef.doc('bank-cibanco-001').get();
  
  if (oldAccountDoc.exists) {
    console.log('   🔍 Found old account document, migrating to new ID...');
    const accountData = oldAccountDoc.data();
    
    // Create new document with correct ID
    await accountsRef.doc('bank-001').set({
      ...accountData,
      accountId: 'bank-001',
      updatedAt: new Date()
    });
    
    // Delete old document
    await accountsRef.doc('bank-cibanco-001').delete();
    console.log('   ✅ Account document migrated');
    
    // Write audit log
    await writeAuditLog({
      clientId: CLIENT_ID,
      module: 'accounts',
      action: 'update',
      entityType: 'account',
      entityId: 'bank-001',
      friendlyName: 'Fixed account ID from bank-cibanco-001 to bank-001',
      metadata: {
        oldId: 'bank-cibanco-001',
        newId: 'bank-001'
      }
    });
  }
  
  // Step 3: Update year-end balances
  console.log('\n📅 Updating year-end balances...');
  const yearEndBalancesRef = clientRef.collection('yearEndBalances');
  const currentYear = new Date().getFullYear().toString();
  const yearDoc = await yearEndBalancesRef.doc(currentYear).get();
  
  if (yearDoc.exists) {
    const yearData = yearDoc.data();
    const balances = yearData.balances || {};
    
    if (balances['bank-cibanco-001']) {
      console.log('   🔄 Updating year-end balance key...');
      const bankBalance = balances['bank-cibanco-001'];
      
      // Add new key
      balances['bank-001'] = {
        ...bankBalance,
        accountId: 'bank-001'
      };
      
      // Remove old key
      delete balances['bank-cibanco-001'];
      
      await yearEndBalancesRef.doc(currentYear).update({
        balances: balances,
        lastUpdated: new Date()
      });
      
      console.log('   ✅ Year-end balances updated');
    }
  }
  
  // Step 4: Verify the fix
  console.log('\n🔍 Verifying fix...');
  const verifyDoc = await clientRef.get();
  const verifyData = verifyDoc.data();
  const verifyAccounts = verifyData.accounts || [];
  
  console.log('📊 Current accounts:');
  verifyAccounts.forEach(account => {
    console.log(`   ${account.id}: ${account.name} (${account.type})`);
  });
  
  const hasOldId = verifyAccounts.some(acc => acc.id === 'bank-cibanco-001');
  const hasNewId = verifyAccounts.some(acc => acc.id === 'bank-001');
  
  if (!hasOldId && hasNewId) {
    console.log('\n✅ Account IDs successfully fixed!');
  } else {
    console.log('\n⚠️ Account ID fix may have issues, please verify manually');
  }
}

// Execute
fixAccountIds()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });
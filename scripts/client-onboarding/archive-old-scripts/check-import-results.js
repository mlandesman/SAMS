/**
 * Quick script to check import results and balance
 */

import { initializeFirebase, getDb } from '../../backend/firebase.js';

const CLIENT_ID = 'MTC';

async function checkImportResults() {
  console.log('🔍 Checking MTC Import Results...\n');
  
  await initializeFirebase('dev');
  const db = await getDb();
  
  // Check transactions
  const transactionsSnap = await db.collection('transactions')
    .where('clientId', '==', CLIENT_ID)
    .get();
  
  console.log(`📊 Transactions: ${transactionsSnap.size}`);
  
  // Calculate balance
  let totalBalance = 0;
  transactionsSnap.forEach(doc => {
    const data = doc.data();
    totalBalance += data.amount || 0;
  });
  
  console.log(`💰 Total Balance (cents): ${totalBalance}`);
  console.log(`💵 Total Balance (MXN): $${(totalBalance / 100).toLocaleString()}`);
  
  // Check categories
  const categoriesSnap = await db.collection('categories')
    .where('clientId', '==', CLIENT_ID)
    .get();
  console.log(`\n📁 Categories: ${categoriesSnap.size}`);
  
  // Check vendors
  const vendorsSnap = await db.collection('vendors')
    .where('clientId', '==', CLIENT_ID)
    .get();
  console.log(`🏪 Vendors: ${vendorsSnap.size}`);
  
  // Check units
  const unitsSnap = await db.collection('clients').doc(CLIENT_ID)
    .collection('units')
    .get();
  console.log(`🏠 Units: ${unitsSnap.size}`);
  
  // Check users
  const usersSnap = await db.collection('users')
    .where('propertyAccess.MTC', '!=', null)
    .get();
  console.log(`👥 Users: ${usersSnap.size}`);
  
  // Check HOA dues
  const hoaDuesSnap = await db.collection('clients').doc(CLIENT_ID)
    .collection('hoaDues')
    .get();
  console.log(`📅 HOA Dues Records: ${hoaDuesSnap.size}`);
  
  // Check audit logs
  const auditLogsSnap = await db.collection('auditLogs')
    .where('clientId', '==', CLIENT_ID)
    .limit(5)
    .get();
  console.log(`📝 Recent Audit Logs: ${auditLogsSnap.size}`);
  
  console.log('\n✅ Import Check Complete');
}

checkImportResults()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
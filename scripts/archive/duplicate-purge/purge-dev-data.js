// Selective Data Purge Script for Dev Environment
// Preserves: superAdmin user (michael@landesman.com), exchangeRates
// Purges: transactions, vendors, categories, units, hoaDues

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin (adjust path as needed)
const serviceAccount = require('../backend/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const CLIENT_ID = 'MTC';
const PRESERVE_EMAIL = 'michael@landesman.com';

async function confirmPurge() {
  return new Promise((resolve) => {
    console.log('⚠️  WARNING: This will purge most data from the dev environment!');
    console.log('\nWill PRESERVE:');
    console.log('- User: michael@landesman.com');
    console.log('- All exchange rates');
    console.log('- Client configuration');
    console.log('\nWill PURGE:');
    console.log('- All transactions');
    console.log('- All vendors');
    console.log('- All categories');
    console.log('- All units');
    console.log('- All HOA dues data');
    console.log('- Other users (except superAdmin)');
    console.log('\nAre you sure you want to continue? (yes/no): ');
    
    rl.question('', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function deleteCollection(collectionRef, batchSize = 100) {
  const query = collectionRef.limit(batchSize);
  
  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(query, resolve, reject) {
  const snapshot = await query.get();
  
  if (snapshot.size === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }
  
  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  
  // Recurse on the next process tick, to avoid exploding the stack
  process.nextTick(() => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function purgeDevData() {
  console.log('\nStarting selective data purge...\n');
  
  try {
    // 1. Purge Transactions
    console.log('Purging transactions...');
    const transRef = db.collection('clients').doc(CLIENT_ID).collection('transactions');
    await deleteCollection(transRef);
    console.log('  ✓ Transactions purged');
    
    // 2. Purge Vendors
    console.log('Purging vendors...');
    const vendorRef = db.collection('clients').doc(CLIENT_ID).collection('vendors');
    await deleteCollection(vendorRef);
    console.log('  ✓ Vendors purged');
    
    // 3. Purge Categories
    console.log('Purging categories...');
    const catRef = db.collection('clients').doc(CLIENT_ID).collection('categories');
    await deleteCollection(catRef);
    console.log('  ✓ Categories purged');
    
    // 4. Purge Units (and their HOA dues subcollections)
    console.log('Purging units and HOA dues...');
    const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
    const unitsSnapshot = await unitsRef.get();
    
    for (const unitDoc of unitsSnapshot.docs) {
      // Delete HOA dues subcollections
      const duesRef = unitDoc.ref.collection('dues');
      const duesSnapshot = await duesRef.get();
      
      for (const duesDoc of duesSnapshot.docs) {
        await duesDoc.ref.delete();
      }
      
      // Delete the unit itself
      await unitDoc.ref.delete();
    }
    console.log('  ✓ Units and HOA dues purged');
    
    // 5. Purge Users (except superAdmin)
    console.log('Purging non-superAdmin users...');
    const usersRef = db.collection('users');
    const usersSnapshot = await usersRef.get();
    let preservedCount = 0;
    let deletedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.email === PRESERVE_EMAIL) {
        console.log(`  ⚡ Preserved superAdmin: ${userData.email}`);
        preservedCount++;
      } else {
        await userDoc.ref.delete();
        deletedCount++;
      }
    }
    console.log(`  ✓ Users purged (deleted: ${deletedCount}, preserved: ${preservedCount})`);
    
    // 6. Report on preserved data
    console.log('\n📊 Preserved data check:');
    
    // Check exchange rates
    const ratesSnapshot = await db.collection('exchangeRates').get();
    console.log(`  - Exchange rates: ${ratesSnapshot.size} documents`);
    
    // Check client config
    const clientDoc = await db.collection('clients').doc(CLIENT_ID).get();
    if (clientDoc.exists) {
      console.log(`  - Client configuration: ${CLIENT_ID} exists`);
    }
    
    console.log('\n✅ Selective purge complete!');
    console.log('\nNext steps:');
    console.log('1. Update the codebase to use new field standards');
    console.log('2. Run create-test-data.js to create test records');
    console.log('3. Test all CRUD operations');
    console.log('4. Only then update import scripts');
    
  } catch (error) {
    console.error('❌ Error during purge:', error);
  }
}

// Main execution
async function main() {
  const shouldProceed = await confirmPurge();
  
  if (shouldProceed) {
    await purgeDevData();
  } else {
    console.log('\n❌ Purge cancelled by user');
  }
  
  process.exit();
}

main();
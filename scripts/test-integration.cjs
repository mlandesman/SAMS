// Integration Test Script
const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function runIntegrationTests() {
  console.log('🔍 SAMS Integration Test - Property Access Refactoring');
  console.log('=====================================================\n');

  try {
    // Test 1: Check SuperAdmin User
    console.log('1️⃣ Testing User Authentication System:');
    const userDoc = await db.collection('users').doc('fjXv8gX1CYWBvOZ1CS27j96oRCT2').get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ SuperAdmin user found');
      console.log(`   - propertyAccess: ${JSON.stringify(userData.propertyAccess || {})}`);
      console.log(`   - role: ${userData.role}`);
      console.log(`   - accountState: ${userData.accountState}`);
      
      // Check for old field
      if (userData.clientAccess) {
        console.log('❌ WARNING: Old clientAccess field still exists!');
      }
    } else {
      console.log('❌ SuperAdmin user not found!');
    }

    // Test 2: Check MTC Client
    console.log('\n2️⃣ Testing Client Data:');
    const clientDoc = await db.collection('clients').doc('MTC').get();
    if (clientDoc.exists) {
      const clientData = clientDoc.data();
      console.log('✅ MTC client found');
      console.log(`   - name: ${clientData.name}`);
      console.log(`   - status: ${clientData.status}`);
    } else {
      console.log('❌ MTC client not found!');
    }

    // Test 3: Check Recent Transactions
    console.log('\n3️⃣ Testing Transaction System:');
    const transactionsSnapshot = await db.collection('clients/MTC/transactions')
      .orderBy('date', 'desc')
      .limit(3)
      .get();
    
    console.log(`✅ Found ${transactionsSnapshot.size} recent transactions`);
    transactionsSnapshot.forEach(doc => {
      const txn = doc.data();
      console.log(`   - ${doc.id}: $${txn.amount/100} on ${txn.date?.toDate?.()?.toISOString?.() || txn.date}`);
    });

    // Test 4: Check Units
    console.log('\n4️⃣ Testing Units System:');
    const unitsSnapshot = await db.collection('clients/MTC/units')
      .limit(3)
      .get();
    
    console.log(`✅ Found ${unitsSnapshot.size} units`);
    unitsSnapshot.forEach(doc => {
      const unit = doc.data();
      console.log(`   - ${doc.id}: ${unit.owner || 'No owner'}`);
    });

    // Test 5: Check HOA Dues Structure
    console.log('\n5️⃣ Testing HOA Dues System:');
    const firstUnit = unitsSnapshot.docs[0];
    if (firstUnit) {
      const duesDoc = await db.doc(`clients/MTC/units/${firstUnit.id}/dues/2025`).get();
      if (duesDoc.exists) {
        const duesData = duesDoc.data();
        console.log(`✅ HOA dues for unit ${firstUnit.id}:`);
        console.log(`   - creditBalance: $${duesData.creditBalance/100}`);
        console.log(`   - payments array length: ${duesData.payments?.length || 0}`);
        if (duesData.payments && duesData.payments.length === 12) {
          console.log('   ✅ Correct 12-element payment array structure');
        } else {
          console.log('   ❌ Incorrect payment array structure');
        }
      }
    }

    // Test 6: Check Configuration
    console.log('\n6️⃣ Testing Client Configuration:');
    
    // Check menu configuration
    const menuDoc = await db.doc('clients/MTC/config/activities').get();
    if (menuDoc.exists) {
      const menuData = menuDoc.data();
      console.log('✅ Menu configuration found');
      console.log(`   - Menu items: ${menuData.menu?.length || 0}`);
    } else {
      console.log('❌ Menu configuration not found!');
    }
    
    // Check lists configuration
    const listsDoc = await db.doc('clients/MTC/config/lists').get();
    if (listsDoc.exists) {
      const listsData = listsDoc.data();
      console.log('✅ Lists configuration found');
      const enabledLists = Object.entries(listsData)
        .filter(([key, value]) => value === true && !['updatedAt', 'updatedBy'].includes(key))
        .map(([key]) => key);
      console.log(`   - Enabled lists: ${enabledLists.join(', ')}`);
    } else {
      console.log('❌ Lists configuration not found!');
    }

    console.log('\n✅ Integration tests completed');
    console.log('=====================================================');

  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
  
  process.exit(0);
}

runIntegrationTests();
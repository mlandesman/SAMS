// Check actual data structure in Firestore
const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDataStructure() {
  const clientId = 'MTC';
  
  try {
    console.log(`\n🔍 Checking data structure for client: ${clientId}`);
    console.log('='.repeat(60));
    
    // 1. Check Client Document
    console.log('\n1️⃣ CLIENT DOCUMENT:');
    const clientDoc = await db.doc(`clients/${clientId}`).get();
    if (clientDoc.exists) {
      const data = clientDoc.data();
      console.log('✅ Client exists');
      console.log('   - Has accounts array:', Array.isArray(data.accounts));
      if (data.accounts) {
        console.log(`   - Number of accounts: ${data.accounts.length}`);
        data.accounts.forEach((acc, i) => {
          console.log(`     Account ${i + 1}: ${acc.name} (${acc.type}) - Balance: ${acc.balance}`);
        });
      }
    }
    
    // 2. Check Sample Transaction
    console.log('\n2️⃣ SAMPLE TRANSACTION:');
    const txnSnapshot = await db.collection(`clients/${clientId}/transactions`).limit(1).get();
    if (!txnSnapshot.empty) {
      const txn = txnSnapshot.docs[0].data();
      console.log('✅ Transaction found:', txnSnapshot.docs[0].id);
      console.log('   Fields present:');
      console.log('   - amount:', txn.amount, '(type:', typeof txn.amount, ')');
      console.log('   - vendor:', txn.vendor);
      console.log('   - vendorId:', txn.vendorId);
      console.log('   - category:', txn.category);
      console.log('   - categoryId:', txn.categoryId);
      console.log('   - account:', txn.account);
      console.log('   - accountId:', txn.accountId);
      console.log('   - accountType:', txn.accountType);
      console.log('   - unitId:', txn.unitId);
      console.log('   - unit:', txn.unit);
      console.log('   - notes:', txn.notes);
      console.log('   - date:', txn.date);
    }
    
    // 3. Check Sample Vendor
    console.log('\n3️⃣ SAMPLE VENDOR:');
    const vendorSnapshot = await db.collection(`clients/${clientId}/vendors`).limit(1).get();
    if (!vendorSnapshot.empty) {
      const vendor = vendorSnapshot.docs[0].data();
      console.log('✅ Vendor found:', vendorSnapshot.docs[0].id);
      console.log('   Structure:');
      console.log('   - name:', vendor.name);
      console.log('   - category:', vendor.category);
      console.log('   - email:', vendor.email);
      console.log('   - phone:', vendor.phone);
      console.log('   - Has contact object:', !!vendor.contact);
      if (vendor.contact) {
        console.log('     - contact.email:', vendor.contact.email);
        console.log('     - contact.phone:', vendor.contact.phone);
      }
    }
    
    // 4. Check Sample Category
    console.log('\n4️⃣ SAMPLE CATEGORY:');
    const catSnapshot = await db.collection(`clients/${clientId}/categories`).limit(1).get();
    if (!catSnapshot.empty) {
      const category = catSnapshot.docs[0].data();
      console.log('✅ Category found:', catSnapshot.docs[0].id);
      console.log('   Fields:');
      console.log('   - name:', category.name);
      console.log('   - type:', category.type);
      console.log('   - description:', category.description);
    }
    
    // 5. Check Sample Unit
    console.log('\n5️⃣ SAMPLE UNIT:');
    const unitSnapshot = await db.collection(`clients/${clientId}/units`).limit(1).get();
    if (!unitSnapshot.empty) {
      const unit = unitSnapshot.docs[0].data();
      console.log('✅ Unit found:', unitSnapshot.docs[0].id);
      console.log('   Fields:');
      console.log('   - owner:', unit.owner);
      console.log('   - owners:', unit.owners);
      console.log('   - managers:', unit.managers);
      console.log('   - notes:', unit.notes);
      console.log('   - status:', unit.status);
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error checking data structure:', error);
  }
  
  process.exit(0);
}

checkDataStructure();
#!/usr/bin/env node
/**
 * Verify Restore Results (Testing Helper)
 * 
 * Verifies that restore was successful by checking:
 * - MTC client document exists
 * - MTC subcollections restored
 * - Deep subcollection documents exist
 * - Specific test document (clients/MTC/units/PH4D/dues/2025)
 * 
 * Usage:
 *   node scripts/backup/test-helpers/verify-restore.js
 *   node scripts/backup/test-helpers/verify-restore.js --client=MTC
 */

import { initializeFirebase, getDb } from '../../../functions/backend/firebase.js';

const CLIENT_ID = process.argv.find(arg => arg.startsWith('--client='))?.split('=')[1] || 'MTC';

async function main() {
  console.log('🔍 Verify Restore Results');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Checking client: ${CLIENT_ID}`);
  console.log('');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    
    // 1. Check client document
    console.log('1️⃣  Client Document:');
    if (clientDoc.exists) {
      console.log('   ✅ Client document exists');
      const data = clientDoc.data();
      console.log(`   - Name: ${data.basicInfo?.name || 'N/A'}`);
      console.log(`   - ID: ${CLIENT_ID}`);
    } else {
      console.log('   ❌ Client document NOT found');
      process.exit(1);
    }
    console.log('');
    
    // 2. Check subcollections
    console.log('2️⃣  Subcollections:');
    const collections = await clientRef.listCollections();
    
    if (collections.length === 0) {
      console.log('   ❌ No subcollections found');
      process.exit(1);
    }
    
    const collectionStats = [];
    let totalDocs = 0;
    
    for (const col of collections) {
      const snapshot = await col.get();
      let subDocCount = 0;
      
      // Count subcollection documents
      for (const doc of snapshot.docs) {
        const subcollections = await doc.ref.listCollections();
        for (const subcol of subcollections) {
          const subSnapshot = await subcol.get();
          subDocCount += subSnapshot.size;
        }
      }
      
      collectionStats.push({
        name: col.id,
        documents: snapshot.size,
        subdocuments: subDocCount
      });
      totalDocs += snapshot.size + subDocCount;
    }
    
    collectionStats.forEach(stat => {
      const status = stat.documents > 0 ? '✅' : '⚠️';
      console.log(`   ${status} ${stat.name}: ${stat.documents} docs, ${stat.subdocuments} subdocs`);
    });
    console.log(`   Total: ${totalDocs} documents`);
    console.log('');
    
    // 3. Check deep subcollection (test document)
    console.log('3️⃣  Deep Subcollection Test:');
    const testDocPath = `clients/${CLIENT_ID}/units/PH4D/dues/2025`;
    const testDocRef = db.doc(testDocPath);
    const testDoc = await testDocRef.get();
    
    if (testDoc.exists) {
      console.log(`   ✅ Test document exists: ${testDocPath}`);
      const data = testDoc.data();
      
      if (data.scheduledAmount !== undefined) {
        console.log(`   - scheduledAmount: ${data.scheduledAmount} centavos`);
        console.log(`   - scheduledAmount: ${data.scheduledAmount / 100} pesos`);
      } else {
        console.log('   ⚠️  scheduledAmount field not found');
      }
      
      // Show other fields
      const otherFields = Object.keys(data).filter(k => k !== 'scheduledAmount').slice(0, 5);
      if (otherFields.length > 0) {
        console.log(`   - Other fields: ${otherFields.join(', ')}`);
      }
    } else {
      console.log(`   ❌ Test document NOT found: ${testDocPath}`);
      console.log('   ⚠️  Deep subcollection restore may have failed');
    }
    console.log('');
    
    // 4. Summary
    console.log('='.repeat(60));
    console.log('📊 Verification Summary:');
    console.log('');
    
    const allChecksPassed = 
      clientDoc.exists &&
      collections.length > 0 &&
      totalDocs > 0 &&
      testDoc.exists;
    
    if (allChecksPassed) {
      console.log('✅ ALL CHECKS PASSED');
      console.log('   - Client document: ✅');
      console.log('   - Subcollections: ✅');
      console.log('   - Deep subcollection: ✅');
      console.log('');
      console.log('🎉 Restore verification successful!');
    } else {
      console.log('❌ SOME CHECKS FAILED');
      if (!clientDoc.exists) console.log('   - Client document: ❌');
      if (collections.length === 0) console.log('   - Subcollections: ❌');
      if (totalDocs === 0) console.log('   - Documents: ❌');
      if (!testDoc.exists) console.log('   - Deep subcollection: ❌');
      console.log('');
      console.log('⚠️  Restore may be incomplete. Check restore logs.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();


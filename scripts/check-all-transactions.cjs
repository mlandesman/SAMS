const admin = require('firebase-admin');
const serviceAccount = require('../backend/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkAllTransactions() {
  console.log('Checking all transaction structures in database...\n');
  
  // Check for transactions at root level
  console.log('1. Checking root-level transactions collection:');
  const rootTxns = await db.collection('transactions').limit(5).get();
  console.log(`   Found ${rootTxns.size} documents`);
  
  // Check for client-specific transactions
  console.log('\n2. Checking client-specific transaction collections:');
  const clients = await db.collection('clients').get();
  
  for (const clientDoc of clients.docs) {
    const clientId = clientDoc.id;
    console.log(`\n   Checking client: ${clientId}`);
    
    // Check nested transactions
    const nestedTxns = await db.collection('clients').doc(clientId).collection('transactions').limit(5).get();
    console.log(`   - Nested transactions: ${nestedTxns.size} documents`);
    
    if (nestedTxns.size > 0) {
      const sample = nestedTxns.docs[0].data();
      console.log('   - Sample fields:', Object.keys(sample).join(', '));
      console.log('   - Has unit?', sample.unit !== undefined);
      console.log('   - Has unitId?', sample.unitId !== undefined);
      
      // Count field usage
      let withUnit = 0;
      let withUnitId = 0;
      let withBoth = 0;
      
      const allTxns = await db.collection('clients').doc(clientId).collection('transactions').limit(100).get();
      
      allTxns.forEach(doc => {
        const data = doc.data();
        if (data.unit !== undefined) withUnit++;
        if (data.unitId !== undefined) withUnitId++;
        if (data.unit !== undefined && data.unitId !== undefined) withBoth++;
      });
      
      console.log(`   - Total checked: ${allTxns.size}`);
      console.log(`   - With 'unit': ${withUnit}`);
      console.log(`   - With 'unitId': ${withUnitId}`);
      console.log(`   - With BOTH: ${withBoth}`);
      
      // Show samples of each type
      if (withUnit > 0) {
        const unitSample = allTxns.docs.find(d => d.data().unit !== undefined);
        if (unitSample) {
          const data = unitSample.data();
          console.log(`   - Sample with 'unit': { unit: "${data.unit}", category: "${data.category}", date: "${data.date}" }`);
        }
      }
      
      if (withUnitId > 0) {
        const unitIdSample = allTxns.docs.find(d => d.data().unitId !== undefined);
        if (unitIdSample) {
          const data = unitIdSample.data();
          console.log(`   - Sample with 'unitId': { unitId: "${data.unitId}", category: "${data.category}", date: "${data.date}" }`);
        }
      }
    }
  }
  
  // Check other possible locations
  console.log('\n3. Checking other possible transaction locations:');
  
  // List all root collections
  const collections = await db.listCollections();
  console.log('\nAll root collections:');
  for (const coll of collections) {
    const count = await coll.limit(1).get();
    if (coll.id.toLowerCase().includes('transaction')) {
      console.log(`   - ${coll.id}: ${count.size > 0 ? 'has data' : 'empty'}`);
    }
  }
}

checkAllTransactions().catch(console.error);
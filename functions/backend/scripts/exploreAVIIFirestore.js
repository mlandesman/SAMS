import { getDb } from '../firebase.js';

async function exploreAVIICollections() {
  const db = await getDb();
  const clientPath = 'clients/AVII';
  
  console.log('=== Exploring AVII Firestore Structure ===\n');

  // 1. List all subcollections
  console.log('📁 Checking for subcollections under AVII client...');
  
  const collections = ['units', 'transactions', 'categories', 'vendors', 'yearEndBalances', 'config', 'waterMeters', 'waterReadings'];
  
  for (const collection of collections) {
    const snapshot = await db.collection(`${clientPath}/${collection}`).limit(5).get();
    console.log(`\n📂 ${collection}: ${snapshot.size} documents found`);
    
    if (snapshot.size > 0) {
      console.log('   Sample IDs:', snapshot.docs.map(doc => doc.id).join(', '));
      
      // Show first document structure
      const firstDoc = snapshot.docs[0];
      console.log(`\n   📄 Sample document (${firstDoc.id}):`);
      const data = firstDoc.data();
      Object.keys(data).forEach(key => {
        const value = data[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`      ${key}: ${type}`);
      });
      
      // Check for subcollections in units
      if (collection === 'units') {
        console.log(`\n   🔍 Checking subcollections for unit ${firstDoc.id}...`);
        const subCollections = ['dues', 'payments', 'waterReadings'];
        for (const subColl of subCollections) {
          const subSnapshot = await db.collection(`${clientPath}/units/${firstDoc.id}/${subColl}`).limit(3).get();
          if (subSnapshot.size > 0) {
            console.log(`      📁 ${subColl}: ${subSnapshot.size} documents`);
            console.log(`         Sample IDs: ${subSnapshot.docs.map(doc => doc.id).join(', ')}`);
          }
        }
      }
    }
  }
  
  // 2. Look for transactions with specific patterns
  console.log('\n\n📊 Searching for transactions...');
  const txnPatterns = [
    { field: 'type', value: 'HOA_DUES_PAYMENT' },
    { field: 'category', value: 'HOA_DUES' },
    { field: 'unitId', value: '101' }
  ];
  
  for (const pattern of txnPatterns) {
    try {
      const txnSnapshot = await db.collection(`${clientPath}/transactions`)
        .where(pattern.field, '==', pattern.value)
        .limit(2)
        .get();
      
      if (txnSnapshot.size > 0) {
        console.log(`\n   Found ${txnSnapshot.size} transactions where ${pattern.field} = ${pattern.value}`);
        txnSnapshot.forEach(doc => {
          console.log(`   Transaction ${doc.id}:`, JSON.stringify(doc.data(), null, 2).substring(0, 200) + '...');
        });
      }
    } catch (err) {
      console.log(`   Could not query by ${pattern.field}: ${err.message}`);
    }
  }

  process.exit(0);
}

exploreAVIICollections().catch(console.error);
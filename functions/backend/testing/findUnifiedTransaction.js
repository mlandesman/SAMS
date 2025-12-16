/**
 * Find an existing unified transaction in Firestore to test deletion
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  await import('fs').then(fs => 
    fs.promises.readFile(join(__dirname, '../../sandyland-management-system-firebase-adminsdk-fbsvc-a06371f054.json'), 'utf8')
  )
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findUnifiedTransactions() {
  console.log('\n🔍 Searching for unified transactions...\n');
  
  try {
    const transactionsSnapshot = await db
      .collectionGroup('transactions')
      .limit(100)
      .get();
    
    console.log(`Found ${transactionsSnapshot.size} recent transactions\n`);
    
    const unified = [];
    const withAllocations = [];
    
    for (const doc of transactionsSnapshot.docs) {
      const data = doc.data();
      
      if (data.allocations && data.allocations.length > 0) {
        withAllocations.push({
          id: doc.id,
          allocations: data.allocations.map(a => ({
            type: a.type,
            categoryName: a.categoryName,
            hasData: !!a.data,
            dataKeys: a.data ? Object.keys(a.data) : []
          }))
        });
      }
      
      // Check for HOA and Water allocations
      const hasHOA = data.allocations?.some(a => 
        a.categoryName === 'HOA Dues' || a.categoryName === 'HOA Penalties'
      );
      
      const hasWater = data.allocations?.some(a =>
        a.categoryName === 'Water Consumption' || a.categoryName === 'Water Penalties'
      );
      
      if (hasHOA && hasWater) {
        unified.push({
          id: doc.id,
          clientId: doc.ref.parent.parent.parent.parent.id,
          unitId: data.unitId,
          amount: data.amount,
          date: data.date,
          allocations: data.allocations?.length || 0,
          hoa: data.allocations?.filter(a => a.categoryName === 'HOA Dues' || a.categoryName === 'HOA Penalties').length,
          water: data.allocations?.filter(a => a.categoryName === 'Water Consumption' || a.categoryName === 'Water Penalties').length
        });
      }
    }
    
    console.log(`\n✅ Found ${unified.length} UNIFIED transactions:\n`);
    
    unified.forEach((t, i) => {
      console.log(`${i + 1}. Transaction: ${t.id}`);
      console.log(`   Client: ${t.clientId}, Unit: ${t.unitId}`);
      console.log(`   Amount: $${(t.amount / 100).toFixed(2)}`);
      console.log(`   Date: ${t.date}`);
      console.log(`   Allocations: ${t.allocations} total (HOA: ${t.hoa}, Water: ${t.water})`);
      console.log('');
    });
    
    console.log(`\n📊 Transactions with allocations (any type): ${withAllocations.length}\n`);
    
    if (withAllocations.length > 0) {
      console.log('Sample allocation structure:');
      console.log(JSON.stringify(withAllocations[0], null, 2));
    }
    
    if (unified.length > 0) {
      console.log(`\n💡 Use this transaction for testing:`);
      console.log(`   Transaction ID: ${unified[0].id}`);
      console.log(`   Client: ${unified[0].clientId}`);
      console.log(`   Unit: ${unified[0].unitId}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

findUnifiedTransactions();


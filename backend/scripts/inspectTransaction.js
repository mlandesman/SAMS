/**
 * Inspect what was in the deleted transaction to understand why cleanup didn't run
 */

import { getDb } from '../firebase.js';

async function inspectTransaction() {
  console.log('🔍 Checking transaction history...');
  
  const clientId = 'AVII';
  
  try {
    const db = await getDb();
    
    // Get recent transactions to find one with water bills allocations
    console.log('\n📊 Finding recent water bills transactions...');
    const txnsRef = db.collection('clients').doc(clientId).collection('transactions');
    const snapshot = await txnsRef.orderBy('date', 'desc').limit(10).get();
    
    console.log(`Found ${snapshot.size} recent transactions\n`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const isWater = data.category === 'water_bills' || 
                      data.categoryId === 'water-consumption' ||
                      data.allocations?.some(a => a.categoryId === 'water_bills');
      
      if (isWater) {
        console.log(`Transaction: ${doc.id}`);
        console.log(`  Category: ${data.category || data.categoryId}`);
        console.log(`  Unit: ${data.unitId}`);
        console.log(`  Amount: $${data.amount / 100}`);
        console.log(`  Allocations: ${data.allocations?.length || 0}`);
        if (data.allocations) {
          data.allocations.forEach(a => {
            console.log(`    - ${a.type}: ${a.monthId || a.targetId}, $${a.amount / 100}`);
          });
        }
        console.log('');
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

inspectTransaction().catch(console.error);


/**
 * Inspect a specific transaction to see its full structure
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

const TRANSACTION_ID = '2025-11-05_223538_534'; // Latest test transaction
const CLIENT_ID = 'AVII';

async function inspectTransaction() {
  console.log(`\n🔍 Inspecting transaction ${TRANSACTION_ID}...\n`);
  
  try {
    const doc = await db
      .collection('clients').doc(CLIENT_ID)
      .collection('transactions').doc(TRANSACTION_ID)
      .get();
    
    if (!doc.exists) {
      console.log('❌ Transaction not found');
      process.exit(1);
    }
    
    const data = doc.data();
    
    console.log('Full transaction data:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n\n📊 Summary:');
    console.log(`Unit ID: ${data.unitId}`);
    console.log(`Amount: $${(data.amount / 100).toFixed(2)}`);
    console.log(`Category: ${data.category || data.categoryName || data.categoryId}`);
    console.log(`Type: ${data.type}`);
    console.log(`Allocations: ${data.allocations?.length || 0}`);
    
    if (data.allocations) {
      console.log('\nAllocation breakdown:');
      data.allocations.forEach((a, i) => {
        console.log(`  ${i + 1}. ${a.categoryName} (${a.type})`);
        console.log(`     Amount: $${(a.amount / 100).toFixed(2)}`);
        console.log(`     Data:`, a.data);
      });
    }
    
    console.log('\nMetadata:', data.metadata);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

inspectTransaction();


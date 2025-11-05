/**
 * Manually unpay some HOA bills to create test scenario
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

const TEST_CLIENT = 'AVII';
const TEST_UNIT = '102';
const TEST_YEAR = 2026;

async function unpayHOABills() {
  console.log(`\n🔧 Unpaying HOA bills for Unit ${TEST_UNIT}...\n`);
  
  try {
    const duesRef = db
      .collection('clients').doc(TEST_CLIENT)
      .collection('units').doc(TEST_UNIT)
      .collection('dues').doc(TEST_YEAR.toString());
    
    const duesDoc = await duesRef.get();
    
    if (!duesDoc.exists) {
      console.log('❌ Dues document not found');
      process.exit(1);
    }
    
    const duesData = duesDoc.data();
    const payments = duesData.payments || [];
    
    console.log(`Current payments structure type: ${Array.isArray(payments) ? 'array' : typeof payments}`);
    console.log(`Payments count: ${Array.isArray(payments) ? payments.length : Object.keys(payments).length}\n`);
    
    // Clear payments for months 0-3 (first 4 fiscal months)
    const updatedPayments = Array.isArray(payments) ? [...payments] : Array(12).fill(null);
    
    for (let i = 0; i < 4; i++) {
      if (updatedPayments[i]) {
        console.log(`Clearing month ${i}: Was $${((updatedPayments[i].amount || 0) / 100).toFixed(2)}`);
        updatedPayments[i] = null;
      }
    }
    
    await duesRef.update({
      payments: updatedPayments
    });
    
    console.log(`\n✅ Cleared payments for fiscal months 0-3`);
    console.log(`💡 Unit ${TEST_UNIT} now has unpaid HOA bills for testing\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

unpayHOABills();


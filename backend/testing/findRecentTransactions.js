/**
 * Find recent transactions for Unit 105 to see if any were created without returning ID
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  await import('fs').then(fs => 
    fs.promises.readFile(join(__dirname, '../../sandyland-management-system-firebase-adminsdk-fbsvc-a06371f054.json'), 'utf8')
  )
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function findRecentTransactions() {
  console.log('\n🔍 Searching for recent transactions for Unit 105...\n');
  
  const TEST_CLIENT = 'AVII';
  const TEST_UNIT = '105';
  
  try {
    // Check water bills to see if they reference a transaction
    console.log('📊 Checking water bill payment references...\n');
    
    const waterBillsSnapshot = await db
      .collection('clients').doc(TEST_CLIENT)
      .collection('projects').doc('waterBills')
      .collection('bills')
      .get();
    
    for (const billDoc of waterBillsSnapshot.docs) {
      const billData = billDoc.data();
      const unitBill = billData.bills?.units?.[TEST_UNIT];
      
      if (unitBill && unitBill.payments && unitBill.payments.length > 0) {
        console.log(`Bill ${billDoc.id}:`);
        unitBill.payments.forEach((payment, i) => {
          console.log(`  Payment ${i + 1}:`);
          console.log(`    Amount: $${(payment.amount / 100).toFixed(2)}`);
          console.log(`    Transaction ID: ${payment.transactionId || 'NULL'}`);
          console.log(`    Date: ${payment.date}`);
        });
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error finding transactions:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

findRecentTransactions();


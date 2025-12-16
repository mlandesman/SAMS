/**
 * Setup Unit 105 for unified transaction delete testing
 * Manually removes recent payments to restore unpaid bills
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

async function setupTestUnit() {
  console.log('\n🔧 Setting up Unit 105 for testing...\n');
  
  const TEST_CLIENT = 'AVII';
  const TEST_UNIT = '105';
  
  try {
    // Step 1: Check current water bills
    console.log('📊 Step 1: Checking water bills for Unit 105...');
    const waterBillsSnapshot = await db
      .collection('clients').doc(TEST_CLIENT)
      .collection('projects').doc('waterBills')
      .collection('bills')
      .get();
    
    let billsFound = 0;
    let billsWithPayments = 0;
    const billsToUpdate = [];
    
    for (const billDoc of waterBillsSnapshot.docs) {
      const billData = billDoc.data();
      const unitBill = billData.bills?.units?.[TEST_UNIT];
      
      if (unitBill) {
        billsFound++;
        console.log(`   Found bill ${billDoc.id}: status=${unitBill.status}, paidAmount=${unitBill.paidAmount || 0}`);
        
        if (unitBill.payments && unitBill.payments.length > 0) {
          billsWithPayments++;
          billsToUpdate.push({
            ref: billDoc.ref,
            id: billDoc.id,
            currentPayments: unitBill.payments.length
          });
        }
      }
    }
    
    console.log(`   Total bills found: ${billsFound}`);
    console.log(`   Bills with payments: ${billsWithPayments}`);
    
    // Step 2: Remove payments from water bills
    if (billsToUpdate.length > 0) {
      console.log(`\n🗑️ Step 2: Removing payments from ${billsToUpdate.length} water bills...`);
      
      for (const bill of billsToUpdate) {
        await bill.ref.update({
          [`bills.units.${TEST_UNIT}.payments`]: [],
          [`bills.units.${TEST_UNIT}.paidAmount`]: 0,
          [`bills.units.${TEST_UNIT}.basePaid`]: 0,
          [`bills.units.${TEST_UNIT}.penaltyPaid`]: 0,
          [`bills.units.${TEST_UNIT}.status`]: 'unpaid',
          [`bills.units.${TEST_UNIT}.transactionId`]: admin.firestore.FieldValue.delete()
        });
        console.log(`   ✅ Cleared ${bill.currentPayments} payments from bill ${bill.id}`);
      }
    } else {
      console.log(`\n✅ Step 2: No water bill payments to remove`);
    }
    
    // Step 3: Check credit balance
    console.log(`\n💰 Step 3: Checking credit balance...`);
    const creditDoc = await db
      .collection('clients').doc(TEST_CLIENT)
      .collection('units').doc('creditBalances')
      .get();
    
    if (creditDoc.exists) {
      const creditData = creditDoc.data();
      const unitCredit = creditData[TEST_UNIT];
      
      if (unitCredit) {
        console.log(`   Current credit balance: ${unitCredit.creditBalance} centavos ($${(unitCredit.creditBalance / 100).toFixed(2)})`);
        console.log(`   Credit history entries: ${unitCredit.history?.length || 0}`);
      } else {
        console.log(`   No credit data for unit ${TEST_UNIT}`);
      }
    }
    
    // Step 4: Summary
    console.log(`\n═══════════════════════════════════════════════════════`);
    console.log(`✅ Unit 105 Setup Complete`);
    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`Water bills with payments cleared: ${billsToUpdate.length}`);
    console.log(`Unit is now ready for unified payment testing`);
    console.log(`\n💡 Next: Run testUnifiedTransactionDelete.js`);
    console.log(`═══════════════════════════════════════════════════════\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error setting up test unit:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

setupTestUnit();


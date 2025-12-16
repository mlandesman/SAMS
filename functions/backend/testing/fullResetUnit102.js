/**
 * Full reset of Unit 102 - clear all payments (HOA + Water) and recent transactions
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

async function fullReset() {
  console.log(`\n🔧 Full reset of Unit ${TEST_UNIT}...\n`);
  
  try {
    // 1. Clear all HOA payments for 2026
    console.log('1️⃣ Clearing HOA payments...');
    const duesRef = db
      .collection('clients').doc(TEST_CLIENT)
      .collection('units').doc(TEST_UNIT)
      .collection('dues').doc('2026');
    
    await duesRef.update({
      payments: Array(12).fill(null)
    });
    console.log('   ✅ HOA payments cleared\n');
    
    // 2. Clear all Water bill payments
    console.log('2️⃣ Clearing Water bill payments...');
    const waterBillsSnapshot = await db
      .collection('clients').doc(TEST_CLIENT)
      .collection('projects').doc('waterBills')
      .collection('bills')
      .get();
    
    let waterBillsCleared = 0;
    for (const billDoc of waterBillsSnapshot.docs) {
      const billData = billDoc.data();
      const unitBill = billData.bills?.units?.[TEST_UNIT];
      
      if (unitBill && unitBill.payments && unitBill.payments.length > 0) {
        await billDoc.ref.update({
          [`bills.units.${TEST_UNIT}.payments`]: [],
          [`bills.units.${TEST_UNIT}.paidAmount`]: 0,
          [`bills.units.${TEST_UNIT}.basePaid`]: 0,
          [`bills.units.${TEST_UNIT}.penaltyPaid`]: 0,
          [`bills.units.${TEST_UNIT}.status`]: 'unpaid',
          [`bills.units.${TEST_UNIT}.transactionId`]: admin.firestore.FieldValue.delete()
        });
        waterBillsCleared++;
      }
    }
    console.log(`   ✅ Cleared ${waterBillsCleared} water bills\n`);
    
    // 3. Delete recent test transactions
    console.log('3️⃣ Deleting recent test transactions...');
    const transactionsSnapshot = await db
      .collection('clients').doc(TEST_CLIENT)
      .collection('transactions')
      .where('unitId', '==', TEST_UNIT)
      .get();
    
    let deletedCount = 0;
    for (const doc of transactionsSnapshot.docs) {
      const data = doc.data();
      if (data.reference && (data.reference.includes('TEST') || data.reference.includes('INSPECT'))) {
        await doc.ref.delete();
        deletedCount++;
        console.log(`   Deleted: ${doc.id}`);
      }
    }
    console.log(`   ✅ Deleted ${deletedCount} test transactions\n`);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Unit 102 Fully Reset');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✓ All HOA payments cleared (months 0-11)');
    console.log(`✓ All Water bill payments cleared (${waterBillsCleared} bills)`);
    console.log(`✓ All test transactions deleted (${deletedCount})`);
    console.log('\n💡 Ready for clean unified payment test\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

fullReset();


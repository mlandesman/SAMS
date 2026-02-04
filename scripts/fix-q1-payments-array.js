#!/usr/bin/env node
/**
 * Fix Q1 2026 Water Bills - Add missing payments to payments array
 * 
 * Problem: The Water Consumption Report uses payments.reduce() to calculate
 * total paid, not the paidAmount field. We need to add the missing payments
 * to the array so the report shows correct totals.
 * 
 * Unit 101: Missing $110.27 (difference between actual payments and linked)
 * Unit 104: Missing $100.00 (difference between actual payments and linked)
 * 
 * Usage:
 *   node scripts/fix-q1-payments-array.js --dry-run --prod
 *   node scripts/fix-q1-payments-array.js --execute --prod
 */

import admin from 'firebase-admin';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const isProd = args.includes('--prod');

if (!isDryRun && !isExecute) {
  console.log('Usage:');
  console.log('  node scripts/fix-q1-payments-array.js --dry-run --prod');
  console.log('  node scripts/fix-q1-payments-array.js --execute --prod');
  process.exit(1);
}

const projectId = isProd ? 'sams-sandyland-prod' : 'sams-sandyland-dev';
console.log(`\n🔧 Q1 2026 Payments Array Fix Script`);
console.log(`📍 Target: ${projectId}`);
console.log(`🔍 Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

admin.initializeApp({ projectId });
const db = admin.firestore();

// Missing payments to add (amounts in centavos)
const missingPayments = {
  '101': {
    amount: 11027, // $110.27 - the $60.27 from Sept 9 plus reconciliation
    baseChargePaid: 11027,
    penaltyPaid: 0,
    date: '2025-09-09',
    transactionId: 'reconciliation-101-q1',
    reference: 'Q1 payment reconciliation - actual payments exceed linked',
    method: 'reconciliation',
    recordedAt: new Date().toISOString()
  },
  '104': {
    amount: 10000, // $100.00 - difference to match waterCharge
    baseChargePaid: 10000,
    penaltyPaid: 0,
    date: '2025-10-07',
    transactionId: 'reconciliation-104-q1',
    reference: 'Q1 payment reconciliation - actual payments exceed linked',
    method: 'reconciliation',
    recordedAt: new Date().toISOString()
  }
};

async function fixPaymentsArray() {
  const docRef = db.doc('clients/AVII/projects/waterBills/bills/2026-Q1');
  const doc = await docRef.get();
  
  if (!doc.exists) {
    console.error('❌ Q1 2026 document not found!');
    process.exit(1);
  }
  
  const data = doc.data();
  const units = data.bills?.units || {};
  
  for (const [unitId, newPayment] of Object.entries(missingPayments)) {
    const bill = units[unitId];
    if (!bill) {
      console.log(`❌ Unit ${unitId}: Not found`);
      continue;
    }
    
    const currentPayments = bill.payments || [];
    const currentSum = currentPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const newSum = currentSum + newPayment.amount;
    const waterCharge = bill.waterCharge || 0;
    
    console.log(`Unit ${unitId}:`);
    console.log(`  Water charge: $${(waterCharge / 100).toFixed(2)}`);
    console.log(`  Current payments sum: $${(currentSum / 100).toFixed(2)}`);
    console.log(`  Adding payment: $${(newPayment.amount / 100).toFixed(2)}`);
    console.log(`  New payments sum: $${(newSum / 100).toFixed(2)}`);
    console.log(`  Will match waterCharge: ${newSum >= waterCharge ? '✅ YES' : '❌ NO'}`);
    console.log('');
    
    if (!isDryRun) {
      // Add the new payment to the array
      await docRef.update({
        [`bills.units.${unitId}.payments`]: admin.firestore.FieldValue.arrayUnion(newPayment)
      });
      console.log(`  ✅ Payment added to Unit ${unitId}`);
    }
  }
  
  if (isDryRun) {
    console.log('📋 DRY RUN - No changes made.');
  } else {
    console.log('\n✅ All payments added. Verifying...');
    
    // Verify
    const verifyDoc = await docRef.get();
    const verifyUnits = verifyDoc.data().bills?.units || {};
    
    for (const unitId of Object.keys(missingPayments)) {
      const bill = verifyUnits[unitId];
      const sum = bill.payments?.reduce((s, p) => s + (p.amount || 0), 0) || 0;
      const waterCharge = bill.waterCharge || 0;
      
      console.log(`Unit ${unitId}: payments sum = $${(sum / 100).toFixed(2)}, waterCharge = $${(waterCharge / 100).toFixed(2)} ${sum >= waterCharge ? '✅' : '❌'}`);
    }
  }
}

fixPaymentsArray()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

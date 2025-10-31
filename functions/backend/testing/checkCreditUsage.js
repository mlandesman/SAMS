#!/usr/bin/env node
/**
 * Check if credit was used in the payment
 */

import { initializeFirebase, getDb } from '../firebase.js';

const TEST_CLIENT = 'AVII';
const TEST_UNIT = '103';
const TEST_YEAR = 2026;
const TEST_MONTH = 3; // October

async function checkCredit() {
  console.log('='.repeat(80));
  console.log('💳 CHECKING CREDIT USAGE IN PAYMENT');
  console.log('='.repeat(80));
  
  await initializeFirebase();
  const db = await getDb();
  
  const monthStr = String(TEST_MONTH).padStart(2, '0');
  
  // Get bill document
  const billDocRef = db
    .collection('clients').doc(TEST_CLIENT)
    .collection('projects').doc('waterBills')
    .collection('bills').doc(`${TEST_YEAR}-${monthStr}`);
  
  const billDoc = await billDocRef.get();
  const billData = billDoc.data();
  const unitBill = billData?.bills?.units?.[TEST_UNIT];
  
  console.log('\n📊 PAYMENT BREAKDOWN:');
  console.log('-'.repeat(80));
  console.log(`Bill Total: $${unitBill.totalAmount}`);
  console.log(`Current Charge (base): $${unitBill.currentCharge}`);
  console.log('');
  console.log(`Payment Entry:`);
  console.log(`  amount: $${unitBill.payments[0].amount} (cash paid)`);
  console.log(`  baseChargePaid: $${unitBill.payments[0].baseChargePaid} (base + credit)`);
  console.log(`  penaltyPaid: $${unitBill.payments[0].penaltyPaid}`);
  console.log('');
  console.log(`Accumulated Totals:`);
  console.log(`  paidAmount: $${unitBill.paidAmount} (cash only)`);
  console.log(`  basePaid: $${unitBill.basePaid} (base with credit)`);
  console.log(`  penaltyPaid: $${unitBill.penaltyPaid || 0}`);
  console.log('');
  
  // Calculate credit used
  const cashPaid = unitBill.paidAmount;
  const basePaidTotal = unitBill.basePaid;
  const creditUsed = basePaidTotal - cashPaid;
  
  console.log(`💡 CREDIT CALCULATION:`);
  console.log(`  basePaid ($${basePaidTotal}) - paidAmount ($${cashPaid}) = $${creditUsed} credit used`);
  console.log('');
  
  console.log(`✅ CORRECT STATUS LOGIC:`);
  console.log(`  basePaid ($${basePaidTotal}) >= currentCharge ($${unitBill.currentCharge})? ${basePaidTotal >= unitBill.currentCharge}`);
  console.log(`  Status should be: "${basePaidTotal >= unitBill.currentCharge ? 'paid' : 'unpaid'}"`);
  console.log(`  Actual bill status: "${unitBill.status}"`);
  console.log('');
  
  console.log(`❌ WRONG STATUS LOGIC (current calculateStatus):`);
  console.log(`  paidAmount ($${cashPaid}) >= totalAmount ($${unitBill.totalAmount})? ${cashPaid >= unitBill.totalAmount}`);
  console.log(`  This logic would return: "${cashPaid >= unitBill.totalAmount ? 'paid' : 'unpaid'}"`);
  console.log('');
  
  console.log('='.repeat(80));
  console.log('📋 DIAGNOSIS:');
  console.log('-'.repeat(80));
  console.log('❌ calculateStatus() is using paidAmount (cash only)');
  console.log('✅ Should use basePaid (cash + credit) to determine if bill is paid');
  console.log('');
  console.log('🔧 FIX NEEDED: Update calculateStatus() to check basePaid vs currentCharge');
  console.log('   OR: Simply trust the status field set by payment cascade');
  console.log('='.repeat(80));
}

checkCredit().catch(error => {
  console.error('❌ Error:', error);
  console.error(error.stack);
  process.exit(1);
});


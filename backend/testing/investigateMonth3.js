#!/usr/bin/env node
/**
 * Deep dive into Month 3 Unit 103 issue
 */

import { initializeFirebase, getDb } from '../firebase.js';

const TEST_CLIENT = 'AVII';
const TEST_UNIT = '103';
const TEST_YEAR = 2026;
const TEST_MONTH = 3; // October

async function investigate() {
  console.log('='.repeat(80));
  console.log(`🔍 DEEP DIVE: Month 3 (October) Unit ${TEST_UNIT}`);
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
  
  console.log('\n📄 BILL DOCUMENT COMPLETE DATA:');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(unitBill, null, 2));
  
  // Get aggregatedData
  const aggDataRef = db
    .collection('clients').doc(TEST_CLIENT)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('aggregatedData');
  
  const aggDoc = await aggDataRef.get();
  const aggData = aggDoc.data();
  const aggUnitData = aggData?.months?.[TEST_MONTH]?.units?.[TEST_UNIT];
  
  console.log('\n📊 AGGREGATEDDATA COMPLETE DATA:');
  console.log('-'.repeat(80));
  console.log(JSON.stringify(aggUnitData, null, 2));
  
  console.log('\n🔍 ANALYSIS:');
  console.log('-'.repeat(80));
  
  // Check if bill has payments array
  if (unitBill.payments && unitBill.payments.length > 0) {
    console.log(`✅ Bill has ${unitBill.payments.length} payment(s):`);
    unitBill.payments.forEach((payment, index) => {
      console.log(`   Payment ${index + 1}:`);
      console.log(`      Amount: $${payment.amount}`);
      console.log(`      Date: ${payment.date}`);
      console.log(`      Transaction ID: ${payment.transactionId || 'N/A'}`);
    });
    
    const totalPayments = unitBill.payments.reduce((sum, p) => sum + p.amount, 0);
    console.log(`   Total from payments array: $${totalPayments}`);
    console.log(`   paidAmount field: $${unitBill.paidAmount}`);
    
    if (totalPayments !== unitBill.paidAmount) {
      console.log(`   ⚠️  MISMATCH: Payments array total doesn't match paidAmount field!`);
    }
  } else {
    console.log(`⚠️  Bill has no payments array`);
  }
  
  // Calculate what status SHOULD be
  const shouldBePaid = unitBill.paidAmount >= unitBill.totalAmount;
  const calculatedStatus = shouldBePaid ? 'paid' : 'unpaid';
  
  console.log(`\n💡 EXPECTED STATUS CALCULATION:`);
  console.log(`   paidAmount ($${unitBill.paidAmount}) >= totalAmount ($${unitBill.totalAmount})?`);
  console.log(`   ${unitBill.paidAmount} >= ${unitBill.totalAmount} = ${shouldBePaid}`);
  console.log(`   Expected status: "${calculatedStatus}"`);
  console.log(`   Actual bill status: "${unitBill.status}"`);
  console.log(`   Actual agg status: "${aggUnitData.status}"`);
  
  console.log(`\n📋 CONCLUSION:`);
  console.log('-'.repeat(80));
  
  if (unitBill.status === calculatedStatus && aggUnitData.status === calculatedStatus) {
    console.log(`✅ Everything is correct`);
  } else if (unitBill.status !== calculatedStatus) {
    console.log(`❌ Bill document has WRONG status stored`);
    console.log(`   Should be "${calculatedStatus}" but is "${unitBill.status}"`);
    if (aggUnitData.status === calculatedStatus) {
      console.log(`   ✅ AggregatedData has the CORRECT status: "${aggUnitData.status}"`);
      console.log(`   📝 Issue: Bill document needs to be fixed`);
    } else {
      console.log(`   ❌ AggregatedData ALSO has wrong status: "${aggUnitData.status}"`);
    }
  } else if (aggUnitData.status !== calculatedStatus) {
    console.log(`❌ AggregatedData has WRONG status`);
    console.log(`   Should be "${calculatedStatus}" but is "${aggUnitData.status}"`);
    console.log(`   📝 Issue: Surgical update isn't updating aggregatedData correctly`);
  }
  
  console.log('='.repeat(80));
}

investigate().catch(error => {
  console.error('❌ Error:', error);
  console.error(error.stack);
  process.exit(1);
});


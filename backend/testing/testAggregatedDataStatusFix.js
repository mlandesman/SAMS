#!/usr/bin/env node
/**
 * Test script to investigate aggregatedData status update issue
 * 
 * Problem: After payment, bill documents show "paid" but aggregatedData shows "unpaid"
 * Test Case: Unit 103 in AVII client (already has paid bills but shows unpaid in UI)
 */

import { initializeFirebase, getDb } from '../firebase.js';
import { waterDataService } from '../services/waterDataService.js';

const TEST_CLIENT = 'AVII';
const TEST_UNIT = '103';
const TEST_YEAR = 2026;
const TEST_MONTH = 2; // March (2026-02)

async function investigateStatusIssue() {
  console.log('='.repeat(80));
  console.log('🔍 INVESTIGATING AGGREGATEDDATA STATUS UPDATE ISSUE');
  console.log('='.repeat(80));
  console.log(`Test Case: Unit ${TEST_UNIT}, Month ${TEST_MONTH} (March 2026)`);
  console.log('');
  
  await initializeFirebase();
  const db = await getDb();
  
  // STEP 1: Check bill document (source of truth)
  console.log('📄 STEP 1: Reading bill document from Firestore...');
  console.log('-'.repeat(80));
  
  const monthStr = String(TEST_MONTH).padStart(2, '0');
  const billDocRef = db
    .collection('clients').doc(TEST_CLIENT)
    .collection('projects').doc('waterBills')
    .collection('bills').doc(`${TEST_YEAR}-${monthStr}`);
  
  const billDoc = await billDocRef.get();
  if (!billDoc.exists) {
    console.error(`❌ Bill document ${TEST_YEAR}-${monthStr} does not exist!`);
    process.exit(1);
  }
  
  const billData = billDoc.data();
  const unitBill = billData?.bills?.units?.[TEST_UNIT];
  
  if (!unitBill) {
    console.error(`❌ No bill found for unit ${TEST_UNIT} in ${TEST_YEAR}-${monthStr}`);
    process.exit(1);
  }
  
  console.log(`✅ Bill document found for Unit ${TEST_UNIT}:`);
  console.log(`   Total Amount: $${unitBill.totalAmount}`);
  console.log(`   Paid Amount: $${unitBill.paidAmount || 0}`);
  console.log(`   Status: "${unitBill.status || 'NOT SET'}"`);
  console.log(`   Bill Data:`, JSON.stringify({
    totalAmount: unitBill.totalAmount,
    paidAmount: unitBill.paidAmount,
    currentCharge: unitBill.currentCharge,
    penaltyAmount: unitBill.penaltyAmount,
    previousBalance: unitBill.previousBalance,
    status: unitBill.status
  }, null, 2));
  console.log('');
  
  // STEP 2: Check aggregatedData document (what UI reads)
  console.log('📊 STEP 2: Reading aggregatedData from Firestore...');
  console.log('-'.repeat(80));
  
  const aggDataRef = db
    .collection('clients').doc(TEST_CLIENT)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('aggregatedData');
  
  const aggDoc = await aggDataRef.get();
  if (!aggDoc.exists) {
    console.error(`❌ aggregatedData document does not exist!`);
    process.exit(1);
  }
  
  const aggData = aggDoc.data();
  const aggUnitData = aggData?.months?.[TEST_MONTH]?.units?.[TEST_UNIT];
  
  if (!aggUnitData) {
    console.error(`❌ No aggregated data found for unit ${TEST_UNIT} in month ${TEST_MONTH}`);
    process.exit(1);
  }
  
  console.log(`📊 AggregatedData found for Unit ${TEST_UNIT}:`);
  console.log(`   Total Amount: $${aggUnitData.totalAmount}`);
  console.log(`   Paid Amount: $${aggUnitData.paidAmount || 0}`);
  console.log(`   Unpaid Amount: $${aggUnitData.unpaidAmount || 0}`);
  console.log(`   Status: "${aggUnitData.status || 'NOT SET'}"`);
  console.log(`   Aggregated Data:`, JSON.stringify({
    totalAmount: aggUnitData.totalAmount,
    paidAmount: aggUnitData.paidAmount,
    unpaidAmount: aggUnitData.unpaidAmount,
    billAmount: aggUnitData.billAmount,
    penaltyAmount: aggUnitData.penaltyAmount,
    previousBalance: aggUnitData.previousBalance,
    status: aggUnitData.status
  }, null, 2));
  console.log('');
  
  // STEP 3: Test calculateStatus function
  console.log('🧮 STEP 3: Testing calculateStatus function...');
  console.log('-'.repeat(80));
  
  const calculatedStatus = waterDataService.calculateStatus(unitBill);
  console.log(`   calculateStatus(bill) returned: "${calculatedStatus}"`);
  console.log(`   Expected: "${unitBill.paidAmount >= unitBill.totalAmount ? 'paid' : 'unpaid'}"`);
  console.log(`   Comparison: paidAmount (${unitBill.paidAmount}) >= totalAmount (${unitBill.totalAmount}) = ${unitBill.paidAmount >= unitBill.totalAmount}`);
  console.log('');
  
  // STEP 4: Compare bill vs aggregatedData
  console.log('🔍 STEP 4: Comparing bill document vs aggregatedData...');
  console.log('-'.repeat(80));
  
  const statusMatch = unitBill.status === aggUnitData.status;
  const paidAmountMatch = unitBill.paidAmount === aggUnitData.paidAmount;
  const totalAmountMatch = unitBill.totalAmount === aggUnitData.totalAmount;
  
  console.log(`   Status Match: ${statusMatch ? '✅' : '❌'} (Bill: "${unitBill.status}" vs Agg: "${aggUnitData.status}")`);
  console.log(`   Paid Amount Match: ${paidAmountMatch ? '✅' : '❌'} (Bill: $${unitBill.paidAmount} vs Agg: $${aggUnitData.paidAmount})`);
  console.log(`   Total Amount Match: ${totalAmountMatch ? '✅' : '❌'} (Bill: $${unitBill.totalAmount} vs Agg: $${aggUnitData.totalAmount})`);
  console.log('');
  
  // STEP 5: Test buildSingleUnitData function
  console.log('🔧 STEP 5: Testing buildSingleUnitData function...');
  console.log('-'.repeat(80));
  console.log('   Calling buildSingleUnitData with existing data (optimized path)...');
  
  const updatedUnitData = await waterDataService.buildSingleUnitData(
    TEST_CLIENT,
    TEST_YEAR,
    TEST_MONTH,
    TEST_UNIT,
    aggUnitData  // Pass existing data to trigger optimized path
  );
  
  console.log(`   buildSingleUnitData returned:`);
  console.log(`      Status: "${updatedUnitData.status}"`);
  console.log(`      Paid Amount: $${updatedUnitData.paidAmount}`);
  console.log(`      Total Amount: $${updatedUnitData.totalAmount}`);
  console.log(`      Unpaid Amount: $${updatedUnitData.unpaidAmount}`);
  console.log('');
  
  // STEP 6: Summary and diagnosis
  console.log('='.repeat(80));
  console.log('📋 DIAGNOSIS SUMMARY');
  console.log('='.repeat(80));
  
  if (statusMatch && paidAmountMatch) {
    console.log('✅ No issues detected - status and amounts match between bill and aggregatedData');
  } else {
    console.log('❌ ISSUE DETECTED:');
    if (!statusMatch) {
      console.log(`   - Status mismatch: Bill shows "${unitBill.status}" but aggregatedData shows "${aggUnitData.status}"`);
    }
    if (!paidAmountMatch) {
      console.log(`   - Paid amount mismatch: Bill shows $${unitBill.paidAmount} but aggregatedData shows $${aggUnitData.paidAmount}`);
    }
    
    console.log('');
    console.log('🔧 TESTING FIX:');
    if (updatedUnitData.status === unitBill.status) {
      console.log('   ✅ buildSingleUnitData correctly calculates status as:', updatedUnitData.status);
      console.log('   📝 Issue is likely in the WRITE operation to Firestore');
      console.log('      Check updateAggregatedDataAfterPayment() write logic');
    } else {
      console.log('   ❌ buildSingleUnitData returns wrong status:', updatedUnitData.status);
      console.log('   📝 Issue is in the STATUS CALCULATION logic');
      console.log('      Check calculateStatus() or buildSingleUnitData() logic');
    }
  }
  
  console.log('='.repeat(80));
  console.log('');
  
  process.exit(statusMatch ? 0 : 1);
}

// Run investigation
investigateStatusIssue().catch(error => {
  console.error('❌ Investigation failed:', error);
  console.error(error.stack);
  process.exit(1);
});


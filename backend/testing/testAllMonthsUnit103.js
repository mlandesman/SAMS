#!/usr/bin/env node
/**
 * Check all months for Unit 103 to find the status mismatch issue
 */

import { initializeFirebase, getDb } from '../firebase.js';

const TEST_CLIENT = 'AVII';
const TEST_UNIT = '103';
const TEST_YEAR = 2026;

async function checkAllMonths() {
  console.log('='.repeat(80));
  console.log(`🔍 CHECKING ALL MONTHS FOR UNIT ${TEST_UNIT}`);
  console.log('='.repeat(80));
  
  await initializeFirebase();
  const db = await getDb();
  
  // Get aggregatedData
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
  
  // Check each month (0-11)
  for (let month = 0; month < 12; month++) {
    const monthStr = String(month).padStart(2, '0');
    const monthName = ['July', 'August', 'September', 'October', 'November', 'December', 
                       'January', 'February', 'March', 'April', 'May', 'June'][month];
    
    console.log(`\n📅 Month ${month} (${monthName} - ${TEST_YEAR}-${monthStr}):`);
    console.log('-'.repeat(80));
    
    // Check bill document
    const billDocRef = db
      .collection('clients').doc(TEST_CLIENT)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(`${TEST_YEAR}-${monthStr}`);
    
    const billDoc = await billDocRef.get();
    
    if (!billDoc.exists) {
      console.log('   ⚪ No bill document found');
      continue;
    }
    
    const billData = billDoc.data();
    const unitBill = billData?.bills?.units?.[TEST_UNIT];
    
    if (!unitBill) {
      console.log('   ⚪ No bill for this unit in this month');
      continue;
    }
    
    // Check aggregatedData
    const aggUnitData = aggData?.months?.[month]?.units?.[TEST_UNIT];
    
    if (!aggUnitData) {
      console.log('   ⚠️  Bill exists but no aggregatedData!');
      continue;
    }
    
    // Compare
    const billStatus = unitBill.status || 'NOT SET';
    const aggStatus = aggUnitData.status || 'NOT SET';
    const statusMatch = billStatus === aggStatus;
    const paidMatch = unitBill.paidAmount === aggUnitData.paidAmount;
    
    console.log(`   Bill Document:`);
    console.log(`      Status: "${billStatus}"`);
    console.log(`      Total: $${unitBill.totalAmount}`);
    console.log(`      Paid: $${unitBill.paidAmount || 0}`);
    
    console.log(`   AggregatedData:`);
    console.log(`      Status: "${aggStatus}"`);
    console.log(`      Total: $${aggUnitData.totalAmount}`);
    console.log(`      Paid: $${aggUnitData.paidAmount || 0}`);
    console.log(`      Unpaid: $${aggUnitData.unpaidAmount || 0}`);
    
    if (!statusMatch) {
      console.log(`   ❌ STATUS MISMATCH FOUND!`);
      console.log(`      Bill says "${billStatus}" but aggregatedData says "${aggStatus}"`);
    } else if (!paidMatch) {
      console.log(`   ⚠️  Paid amount mismatch (but status matches)`);
    } else {
      console.log(`   ✅ Status and amounts match`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Scan complete');
  console.log('='.repeat(80));
}

checkAllMonths().catch(error => {
  console.error('❌ Error:', error);
  console.error(error.stack);
  process.exit(1);
});


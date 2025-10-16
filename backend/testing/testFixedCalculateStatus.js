#!/usr/bin/env node
/**
 * Test the fixed calculateStatus function
 */

import { initializeFirebase, getDb } from '../firebase.js';
import { waterDataService } from '../services/waterDataService.js';

const TEST_CLIENT = 'AVII';
const TEST_UNIT = '103';
const TEST_YEAR = 2026;
const TEST_MONTH = 3; // October

async function testFix() {
  console.log('='.repeat(80));
  console.log('🧪 TESTING FIXED calculateStatus() FUNCTION');
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
  
  console.log('\n📊 BILL DATA:');
  console.log('-'.repeat(80));
  console.log(`  totalAmount: $${unitBill.totalAmount}`);
  console.log(`  currentCharge: $${unitBill.currentCharge}`);
  console.log(`  penaltyAmount: $${unitBill.penaltyAmount}`);
  console.log(`  paidAmount: $${unitBill.paidAmount} (cash only)`);
  console.log(`  basePaid: $${unitBill.basePaid} (cash + credit)`);
  console.log(`  penaltyPaid: $${unitBill.penaltyPaid || 0}`);
  console.log(`  Stored status: "${unitBill.status}"`);
  console.log('');
  
  // Test calculateStatus
  const calculatedStatus = waterDataService.calculateStatus(unitBill);
  
  console.log('🧮 CALCULATESTATUS() TEST:');
  console.log('-'.repeat(80));
  console.log(`  Calculated status: "${calculatedStatus}"`);
  console.log(`  Expected status: "paid"`);
  console.log(`  Match: ${calculatedStatus === 'paid' ? '✅' : '❌'}`);
  console.log('');
  
  // Test buildSingleUnitData
  console.log('🔧 TESTING buildSingleUnitData():');
  console.log('-'.repeat(80));
  
  const updatedUnitData = await waterDataService.buildSingleUnitData(
    TEST_CLIENT,
    TEST_YEAR,
    TEST_MONTH,
    TEST_UNIT,
    null  // Force full calculation (not optimized path)
  );
  
  console.log(`  Returned status: "${updatedUnitData.status}"`);
  console.log(`  Returned paidAmount: $${updatedUnitData.paidAmount}`);
  console.log(`  Returned totalAmount: $${updatedUnitData.totalAmount}`);
  console.log(`  Returned unpaidAmount: $${updatedUnitData.unpaidAmount}`);
  console.log(`  Match: ${updatedUnitData.status === 'paid' ? '✅' : '❌'}`);
  console.log('');
  
  console.log('='.repeat(80));
  console.log('📋 RESULT:');
  console.log('-'.repeat(80));
  
  if (calculatedStatus === 'paid' && updatedUnitData.status === 'paid') {
    console.log('✅ FIX SUCCESSFUL!');
    console.log('   - calculateStatus() now correctly returns "paid"');
    console.log('   - buildSingleUnitData() will update aggregatedData with "paid" status');
    console.log('   - UI will show "PAID" button');
  } else {
    console.log('❌ FIX INCOMPLETE');
    if (calculatedStatus !== 'paid') {
      console.log('   - calculateStatus() still returns wrong status');
    }
    if (updatedUnitData.status !== 'paid') {
      console.log('   - buildSingleUnitData() still returns wrong status');
    }
  }
  console.log('='.repeat(80));
  
  process.exit(calculatedStatus === 'paid' && updatedUnitData.status === 'paid' ? 0 : 1);
}

testFix().catch(error => {
  console.error('❌ Error:', error);
  console.error(error.stack);
  process.exit(1);
});


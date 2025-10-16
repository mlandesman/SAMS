#!/usr/bin/env node
/**
 * Trigger surgical update to fix aggregatedData status for Unit 103 Month 3
 */

import { initializeFirebase, getDb } from '../firebase.js';
import { waterDataService } from '../services/waterDataService.js';

const TEST_CLIENT = 'AVII';
const TEST_UNIT = '103';
const TEST_YEAR = 2026;
const TEST_MONTH = 3; // October

async function triggerUpdate() {
  console.log('='.repeat(80));
  console.log('🔧 TRIGGERING SURGICAL UPDATE FOR UNIT 103 MONTH 3');
  console.log('='.repeat(80));
  
  await initializeFirebase();
  const db = await getDb();
  
  const monthStr = String(TEST_MONTH).padStart(2, '0');
  
  // BEFORE: Check current aggregatedData status
  console.log('\n📊 BEFORE SURGICAL UPDATE:');
  console.log('-'.repeat(80));
  
  const aggDataRef = db
    .collection('clients').doc(TEST_CLIENT)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('aggregatedData');
  
  const beforeDoc = await aggDataRef.get();
  const beforeData = beforeDoc.data();
  const beforeUnitData = beforeData?.months?.[TEST_MONTH]?.units?.[TEST_UNIT];
  
  console.log(`  AggregatedData status: "${beforeUnitData?.status || 'NOT SET'}"`);
  console.log(`  AggregatedData paidAmount: $${beforeUnitData?.paidAmount || 0}`);
  console.log(`  AggregatedData unpaidAmount: $${beforeUnitData?.unpaidAmount || 0}`);
  console.log('');
  
  // TRIGGER: Run surgical update
  console.log('🔄 RUNNING SURGICAL UPDATE...');
  console.log('-'.repeat(80));
  
  const affectedUnitsAndMonths = [{
    unitId: TEST_UNIT,
    monthId: `${TEST_YEAR}-${monthStr}`
  }];
  
  await waterDataService.updateAggregatedDataAfterPayment(
    TEST_CLIENT,
    TEST_YEAR,
    affectedUnitsAndMonths
  );
  
  console.log('✅ Surgical update completed');
  console.log('');
  
  // AFTER: Check updated aggregatedData status
  console.log('📊 AFTER SURGICAL UPDATE:');
  console.log('-'.repeat(80));
  
  const afterDoc = await aggDataRef.get();
  const afterData = afterDoc.data();
  const afterUnitData = afterData?.months?.[TEST_MONTH]?.units?.[TEST_UNIT];
  
  console.log(`  AggregatedData status: "${afterUnitData?.status || 'NOT SET'}"`);
  console.log(`  AggregatedData paidAmount: $${afterUnitData?.paidAmount || 0}`);
  console.log(`  AggregatedData unpaidAmount: $${afterUnitData?.unpaidAmount || 0}`);
  console.log('');
  
  // VERIFY: Compare before and after
  console.log('='.repeat(80));
  console.log('📋 VERIFICATION:');
  console.log('-'.repeat(80));
  
  const statusChanged = beforeUnitData?.status !== afterUnitData?.status;
  const statusCorrect = afterUnitData?.status === 'paid';
  
  if (statusChanged && statusCorrect) {
    console.log('✅ SUCCESS!');
    console.log(`   Status changed from "${beforeUnitData?.status}" to "${afterUnitData?.status}"`);
    console.log('   UI will now show "PAID" button');
  } else if (statusCorrect && !statusChanged) {
    console.log('✅ ALREADY CORRECT!');
    console.log('   Status was already "paid" before update');
  } else {
    console.log('❌ ISSUE REMAINS');
    console.log(`   Status is "${afterUnitData?.status}" but should be "paid"`);
  }
  
  console.log('='.repeat(80));
  
  process.exit(statusCorrect ? 0 : 1);
}

triggerUpdate().catch(error => {
  console.error('❌ Error:', error);
  console.error(error.stack);
  process.exit(1);
});


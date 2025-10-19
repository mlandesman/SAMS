/**
 * Regenerate Water Bills in Centavos Format
 * 
 * This script clears existing bills and regenerates them using the new
 * centavos (integer) storage format to verify the conversion works correctly.
 */

import { getDb } from '../firebase.js';
import waterBillsService from '../services/waterBillsService.js';
import { waterDataService } from '../services/waterDataService.js';
import { centavosToPesos } from '../utils/currencyUtils.js';

const TEST_CLIENT = 'AVII';
const TEST_YEAR = 2026;
const TEST_MONTH = 1; // August 2025 (fiscal month 1)

async function regenerateBills() {
  try {
    console.log('🔄 ========================================');
    console.log('🔄 Regenerating Bills in Centavos Format');
    console.log('🔄 ========================================\n');
    
    const db = await getDb();
    
    // STEP 1: Delete existing bill for test month
    console.log(`🗑️ Step 1: Deleting existing bill for ${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}...`);
    const billRef = db
      .collection('clients').doc(TEST_CLIENT)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(`${TEST_YEAR}-${String(TEST_MONTH).padStart(2, '0')}`);
    
    await billRef.delete();
    console.log('✅ Existing bill deleted\n');
    
    // STEP 2: Clear aggregatedData to force regeneration
    console.log(`🗑️ Step 2: Clearing aggregatedData...`);
    const aggRef = db
      .collection('clients').doc(TEST_CLIENT)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    await aggRef.delete();
    console.log('✅ AggregatedData cleared\n');
    
    // STEP 3: Generate new bills using updated service (should use centavos)
    console.log(`🔨 Step 3: Generating new bills for month ${TEST_MONTH}...`);
    const result = await waterBillsService.generateBills(TEST_CLIENT, TEST_YEAR, TEST_MONTH);
    console.log('✅ Bills generated\n');
    
    // STEP 4: Verify bill format
    console.log('🔍 Step 4: Verifying bill format...');
    const billDoc = await billRef.get();
    const billData = billDoc.data();
    const unit106 = billData.bills?.units?.['106'];
    
    if (!unit106) {
      throw new Error('Unit 106 not found in regenerated bills');
    }
    
    console.log('\nUnit 106 Bill Data:');
    console.log(`  currentCharge: ${unit106.currentCharge} (type: ${typeof unit106.currentCharge})`);
    console.log(`  penaltyAmount: ${unit106.penaltyAmount} (type: ${typeof unit106.penaltyAmount})`);
    console.log(`  totalAmount: ${unit106.totalAmount} (type: ${typeof unit106.totalAmount})`);
    
    // Check if integers
    const fields = ['currentCharge', 'penaltyAmount', 'totalAmount', 'paidAmount'];
    for (const field of fields) {
      const value = unit106[field];
      if (value !== undefined && value !== 0) {
        if (!Number.isInteger(value)) {
          throw new Error(`❌ FAIL: ${field} is not an integer! Value: ${value}`);
        }
        console.log(`  ✅ ${field}: ${value} centavos = $${centavosToPesos(value)}`);
      } else {
        console.log(`  ✓ ${field}: ${value} (zero or undefined)`);
      }
    }
    
    console.log('\n✅ Step 4: Bill format verification PASSED\n');
    
    // STEP 5: Regenerate aggregatedData
    console.log('🔨 Step 5: Regenerating aggregatedData...');
    await waterDataService.getYearData(TEST_CLIENT, TEST_YEAR);
    console.log('✅ AggregatedData regenerated\n');
    
    // STEP 6: Verify aggregatedData format
    console.log('🔍 Step 6: Verifying aggregatedData format...');
    const aggDoc = await aggRef.get();
    const aggData = aggDoc.data();
    
    const aggUnit106 = aggData.months[TEST_MONTH]?.units?.['106'];
    if (!aggUnit106) {
      throw new Error('Unit 106 not found in aggregatedData');
    }
    
    console.log('\nUnit 106 AggregatedData:');
    console.log(`  billAmount: ${aggUnit106.billAmount} (type: ${typeof aggUnit106.billAmount})`);
    console.log(`  penaltyAmount: ${aggUnit106.penaltyAmount} (type: ${typeof aggUnit106.penaltyAmount})`);
    console.log(`  totalAmount: ${aggUnit106.totalAmount} (type: ${typeof aggUnit106.totalAmount})`);
    console.log(`  unpaidAmount: ${aggUnit106.unpaidAmount} (type: ${typeof aggUnit106.unpaidAmount})`);
    
    // Check if integers
    for (const field of ['billAmount', 'penaltyAmount', 'totalAmount', 'unpaidAmount']) {
      const value = aggUnit106[field];
      if (value !== undefined && value !== 0) {
        if (!Number.isInteger(value)) {
          throw new Error(`❌ FAIL: ${field} is not an integer! Value: ${value}`);
        }
        console.log(`  ✅ ${field}: ${value} centavos = $${centavosToPesos(value)}`);
      } else {
        console.log(`  ✓ ${field}: ${value} (zero or undefined)`);
      }
    }
    
    console.log('\n✅ Step 6: AggregatedData format verification PASSED\n');
    
    console.log('🎉 ========================================');
    console.log('🎉 SUCCESS! Bills regenerated in centavos');
    console.log('🎉 ========================================\n');
    console.log('Next Steps:');
    console.log('1. Run testCentavosConversion.js to verify all tests pass');
    console.log('2. Test payment processing with real payments');
    console.log('3. Verify frontend displays correct amounts\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ REGENERATION FAILED:', error.message);
    console.error('❌ ========================================\n');
    console.error(error);
    process.exit(1);
  }
}

regenerateBills();


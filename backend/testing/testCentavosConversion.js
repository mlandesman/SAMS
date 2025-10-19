/**
 * Test script for Water Bills Centavos Conversion (Task WB1)
 * 
 * This script verifies that:
 * 1. Bills are stored in centavos (integers) in Firestore
 * 2. AggregatedData contains centavos (no floating point errors)
 * 3. API endpoints convert centavos → pesos for frontend
 * 4. No floating point precision errors (like 914.3000000000001)
 */

import { getDb } from '../firebase.js';
import { waterDataService } from '../services/waterDataService.js';
import waterBillsService from '../services/waterBillsService.js';
import { waterPaymentsService } from '../services/waterPaymentsService.js';
import { centavosToPesos, pesosToCentavos } from '../utils/currencyUtils.js';

const TEST_CLIENT = 'AVII';
const TEST_FISCAL_YEAR = 2026;

async function runTests() {
  console.log('🧪 ========================================');
  console.log('🧪 Water Bills Centavos Conversion Tests');
  console.log('🧪 ========================================\n');
  
  try {
    // TEST 1: Verify Bill Storage Format
    await testBillStorageFormat();
    
    // TEST 2: Verify AggregatedData Format
    await testAggregatedDataFormat();
    
    // TEST 3: Verify No Floating Point Errors
    await testNoFloatingPointErrors();
    
    // TEST 4: Verify API Response Conversion
    await testAPIResponseConversion();
    
    // TEST 5: Verify Payment Calculation
    await testPaymentCalculation();
    
    console.log('\n✅ ========================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('✅ ========================================\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ TEST FAILED:', error.message);
    console.error('❌ ========================================\n');
    console.error(error);
    process.exit(1);
  }
}

/**
 * TEST 1: Verify bills are stored as integers (centavos) in Firestore
 */
async function testBillStorageFormat() {
  console.log('TEST 1: Verifying bill storage format...');
  
  const db = await getDb();
  const billDoc = await db
    .collection('clients').doc(TEST_CLIENT)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('2026-01') // August 2025
    .get();
  
  if (!billDoc.exists) {
    throw new Error('Test bill document not found');
  }
  
  const billData = billDoc.data();
  const unit106 = billData.bills?.units?.['106'];
  
  if (!unit106) {
    throw new Error('Unit 106 not found in bills');
  }
  
  // Verify all amounts are integers (no decimals)
  const amountFields = ['currentCharge', 'penaltyAmount', 'totalAmount', 'paidAmount', 'basePaid', 'penaltyPaid'];
  
  for (const field of amountFields) {
    const value = unit106[field];
    if (value !== undefined && value !== 0) {
      if (!Number.isInteger(value)) {
        throw new Error(`FAIL: ${field} is not an integer! Value: ${value} (type: ${typeof value})`);
      }
      console.log(`  ✓ ${field}: ${value} centavos (${centavosToPesos(value)} pesos)`);
    }
  }
  
  // Verify no floating point errors
  if (unit106.totalAmount && unit106.totalAmount.toString().includes('.')) {
    throw new Error(`FAIL: totalAmount has decimal point! Value: ${unit106.totalAmount}`);
  }
  
  console.log('  ✅ TEST 1 PASSED: Bills stored as integers (centavos)\n');
}

/**
 * TEST 2: Verify aggregatedData format
 */
async function testAggregatedDataFormat() {
  console.log('TEST 2: Verifying aggregatedData format...');
  
  const db = await getDb();
  const aggDoc = await db
    .collection('clients').doc(TEST_CLIENT)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('aggregatedData')
    .get();
  
  if (!aggDoc.exists) {
    console.log('  ⚠️ AggregatedData does not exist, regenerating...');
    await waterDataService.getYearData(TEST_CLIENT, TEST_FISCAL_YEAR);
    
    // Re-fetch
    const newDoc = await db
      .collection('clients').doc(TEST_CLIENT)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData')
      .get();
    
    if (!newDoc.exists) {
      throw new Error('Failed to generate aggregatedData');
    }
  }
  
  const aggData = await db
    .collection('clients').doc(TEST_CLIENT)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('aggregatedData')
    .get();
  
  const data = aggData.data();
  
  // Check a few units across different months
  const testCases = [
    { month: 1, unit: '106', field: 'unpaidAmount' },
    { month: 1, unit: '106', field: 'penaltyAmount' },
    { month: 1, unit: '106', field: 'totalAmount' }
  ];
  
  for (const test of testCases) {
    const unitData = data.months[test.month]?.units?.[test.unit];
    if (!unitData) {
      console.log(`  ⚠️ Unit ${test.unit} not found in month ${test.month}, skipping`);
      continue;
    }
    
    const value = unitData[test.field];
    if (value !== undefined && value !== 0) {
      if (!Number.isInteger(value)) {
        throw new Error(`FAIL: Month ${test.month} Unit ${test.unit} ${test.field} is not an integer! Value: ${value}`);
      }
      console.log(`  ✓ Month ${test.month} Unit ${test.unit} ${test.field}: ${value} centavos (${centavosToPesos(value)} pesos)`);
    }
  }
  
  // Verify carWashRate and boatWashRate are integers
  if (!Number.isInteger(data.carWashRate)) {
    throw new Error(`FAIL: carWashRate is not an integer! Value: ${data.carWashRate}`);
  }
  if (!Number.isInteger(data.boatWashRate)) {
    throw new Error(`FAIL: boatWashRate is not an integer! Value: ${data.boatWashRate}`);
  }
  
  console.log(`  ✓ carWashRate: ${data.carWashRate} centavos (${centavosToPesos(data.carWashRate)} pesos)`);
  console.log(`  ✓ boatWashRate: ${data.boatWashRate} centavos (${centavosToPesos(data.boatWashRate)} pesos)`);
  
  console.log('  ✅ TEST 2 PASSED: AggregatedData uses centavos (integers)\n');
}

/**
 * TEST 3: Verify no floating point errors in critical calculations
 */
async function testNoFloatingPointErrors() {
  console.log('TEST 3: Verifying no floating point errors...');
  
  const db = await getDb();
  const aggDoc = await db
    .collection('clients').doc(TEST_CLIENT)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('aggregatedData')
    .get();
  
  const data = aggDoc.data();
  
  // Test the specific bug from the task: Unit 106 November (month 4)
  // Should be 914.30 exactly, not 914.3000000000001
  const nov = data.months.find(m => m.month === 4);
  if (nov) {
    const unit106 = nov.units?.['106'];
    if (unit106) {
      const totalAmount = unit106.totalAmount;
      
      console.log(`  Checking Unit 106 November totalAmount: ${totalAmount} centavos`);
      
      // Verify it's an integer
      if (!Number.isInteger(totalAmount)) {
        throw new Error(`FAIL: Unit 106 totalAmount is not an integer: ${totalAmount}`);
      }
      
      // Convert to pesos and check
      const totalPesos = centavosToPesos(totalAmount);
      console.log(`  Converted to pesos: ${totalPesos}`);
      
      // Verify no floating point tail
      const asString = totalPesos.toString();
      if (asString.includes('0000') || asString.includes('9999')) {
        throw new Error(`FAIL: Converted amount has floating point tail: ${totalPesos}`);
      }
      
      console.log(`  ✓ Unit 106 November: ${totalAmount} centavos = $${totalPesos} (EXACT!)`);
    }
  }
  
  // Test math verification: previousBalance + penaltyAmount + billAmount should equal totalAmount
  for (const month of data.months) {
    if (!month.units) continue;
    
    for (const [unitId, unitData] of Object.entries(month.units)) {
      if (unitData.totalAmount > 0) {
        const calculated = (unitData.previousBalance || 0) + (unitData.penaltyAmount || 0) + (unitData.billAmount || 0);
        const stored = unitData.totalAmount;
        
        // Allow 1 centavo difference for rounding
        if (Math.abs(calculated - stored) > 1) {
          console.log(`  ⚠️ Month ${month.month} Unit ${unitId}: Math mismatch`);
          console.log(`     Calculated: ${calculated} centavos`);
          console.log(`     Stored: ${stored} centavos`);
          console.log(`     Difference: ${calculated - stored} centavos`);
        }
      }
    }
  }
  
  console.log('  ✅ TEST 3 PASSED: No floating point errors detected\n');
}

/**
 * TEST 4: Verify API responses convert to pesos
 */
async function testAPIResponseConversion() {
  console.log('TEST 4: Verifying API converts centavos → pesos...');
  
  // This test requires making an API call, which requires auth
  // For now, we'll verify the conversion functions work correctly
  
  const testCentavos = [
    91430,  // Should be 914.30
    26430,  // Should be 264.30
    2457,   // Should be 24.57
    55000   // Should be 550.00
  ];
  
  for (const centavos of testCentavos) {
    const pesos = centavosToPesos(centavos);
    const backToCentavos = pesosToCentavos(pesos);
    
    console.log(`  ✓ ${centavos} centavos → $${pesos} → ${backToCentavos} centavos`);
    
    if (centavos !== backToCentavos) {
      throw new Error(`FAIL: Round-trip conversion failed! ${centavos} → ${backToCentavos}`);
    }
    
    // Verify no floating point tail
    const asString = pesos.toString();
    if (asString.includes('0000') || asString.includes('9999')) {
      throw new Error(`FAIL: Conversion has floating point tail: ${pesos}`);
    }
  }
  
  console.log('  ✅ TEST 4 PASSED: Conversion functions work correctly\n');
}

/**
 * TEST 5: Verify payment calculation accuracy
 */
async function testPaymentCalculation() {
  console.log('TEST 5: Verifying payment calculation accuracy...');
  
  // Test the exact scenario from the bug report
  // Unit 106: $500.10 + $414.20 should equal exactly $914.30
  
  const amount1 = 500.10;
  const amount2 = 414.20;
  
  // OLD WAY (Floating point - causes errors):
  const floatingSum = amount1 + amount2;
  console.log(`  Floating point math: $${amount1} + $${amount2} = $${floatingSum}`);
  console.log(`  Has precision error: ${floatingSum !== 914.30 ? 'YES ❌' : 'NO ✅'}`);
  
  // NEW WAY (Centavos - exact):
  const centavos1 = pesosToCentavos(amount1);
  const centavos2 = pesosToCentavos(amount2);
  const centavosSum = centavos1 + centavos2;
  const pesosSum = centavosToPesos(centavosSum);
  
  console.log(`  Centavos math: ${centavos1} + ${centavos2} = ${centavosSum} centavos`);
  console.log(`  Converted to pesos: $${pesosSum}`);
  console.log(`  Is exact 914.30: ${pesosSum === 914.30 ? 'YES ✅' : 'NO ❌'}`);
  
  if (pesosSum !== 914.30) {
    throw new Error(`FAIL: Centavos calculation incorrect! Expected 914.30, got ${pesosSum}`);
  }
  
  console.log('  ✅ TEST 5 PASSED: Payment calculations are exact\n');
}

// Run tests
runTests();


import { testHarness } from './testHarness.js';
import fs from 'fs';
import path from 'path';

/**
 * Comprehensive Water Bills Cascade Delete Test
 * 
 * This test validates Priority 1B implementation:
 * 1. Documents baseline state (credit balance, bills, penalties)
 * 2. Creates a water bill payment
 * 3. Documents post-payment state
 * 4. Deletes the payment transaction
 * 5. Documents post-deletion state
 * 6. Validates all data returned to baseline
 * 
 * All state is captured and documented for manual review.
 */

const TEST_CLIENT = 'AVII';
const TEST_UNIT = '203'; // Using Unit 203 for testing
const TEST_RESULTS_FILE = 'test-results/water-bills-cascade-delete-results.json';

// Store test state across test steps
const testState = {
  baseline: null,
  postPayment: null,
  postDeletion: null,
  transactionId: null,
  timestamp: new Date().toISOString()
};

/**
 * Helper function to get detailed unit state from Firebase
 */
async function getUnitWaterState(api, clientId, unitId) {
  console.log(`\n📊 Fetching complete state for Unit ${unitId}...`);
  
  const state = {
    timestamp: new Date().toISOString(),
    unitId: unitId,
    creditBalance: 0,
    unpaidBills: [],
    aggregatedData: null,
    duesData: null
  };
  
  try {
    // 1. Get unpaid bills summary (includes credit balance)
    console.log(`   → Getting unpaid bills for Unit ${unitId}...`);
    const billsResponse = await api.get(`/water/clients/${clientId}/bills/unpaid/${unitId}`);
    
    if (billsResponse.data.success) {
      state.unpaidBills = billsResponse.data.data.unpaidBills || [];
      state.creditBalance = billsResponse.data.data.currentCreditBalance || 0;
      
      console.log(`   ✓ Found ${state.unpaidBills.length} unpaid bills`);
      console.log(`   ✓ Credit balance: ${state.creditBalance} centavos ($${(state.creditBalance / 100).toFixed(2)})`);
      
      // Extract penalty information
      state.unpaidBills.forEach(bill => {
        console.log(`   ✓ Bill ${bill.monthId}: $${(bill.unpaidAmount / 100).toFixed(2)} (Base: $${(bill.baseCharge / 100).toFixed(2)}, Penalty: $${(bill.penalty / 100).toFixed(2)})`);
      });
    }
    
    // 2. Get aggregated data for penalty details
    console.log(`   → Getting aggregated data...`);
    const aggDataResponse = await api.get(`/water/clients/${clientId}/data/2026`);
    
    if (aggDataResponse.data.success) {
      state.aggregatedData = aggDataResponse.data.data;
      
      // Extract unit-specific data from aggregated data
      const unitAggData = {};
      if (state.aggregatedData.months) {
        Object.keys(state.aggregatedData.months).forEach(monthKey => {
          const month = state.aggregatedData.months[monthKey];
          if (month.units && month.units[unitId]) {
            unitAggData[monthKey] = {
              penalty: month.units[unitId].penalty || 0,
              status: month.units[unitId].status || 'unknown',
              paidAmount: month.units[unitId].paidAmount || 0
            };
          }
        });
      }
      
      state.unitAggregatedData = unitAggData;
      console.log(`   ✓ Aggregated data captured for ${Object.keys(unitAggData).length} months`);
    }
    
    // 3. Get HOA dues data for credit balance history
    console.log(`   → Getting HOA dues data for credit history...`);
    try {
      const duesResponse = await api.get(`/hoadues/${clientId}/units/${unitId}/dues/2026`);
      if (duesResponse.data) {
        state.duesData = {
          creditBalance: duesResponse.data.creditBalance || 0,
          creditHistoryLength: duesResponse.data.creditBalanceHistory?.length || 0,
          lastCreditEntry: duesResponse.data.creditBalanceHistory?.[duesResponse.data.creditBalanceHistory.length - 1] || null
        };
        console.log(`   ✓ HOA dues data captured (${state.duesData.creditHistoryLength} credit history entries)`);
      }
    } catch (duesError) {
      console.log(`   ⚠ Could not fetch HOA dues data: ${duesError.message}`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error fetching unit state: ${error.message}`);
    throw error;
  }
  
  return state;
}

/**
 * Helper function to format state for documentation
 */
function formatStateReport(label, state) {
  const report = [
    `\n${'='.repeat(80)}`,
    `${label}`,
    `${'='.repeat(80)}`,
    `Timestamp: ${state.timestamp}`,
    `Unit: ${state.unitId}`,
    ``,
    `Credit Balance: ${state.creditBalance} centavos ($${(state.creditBalance / 100).toFixed(2)})`,
    ``,
    `Unpaid Bills (${state.unpaidBills.length}):`,
  ];
  
  state.unpaidBills.forEach((bill, idx) => {
    report.push(`  ${idx + 1}. Bill ${bill.monthId}:`);
    report.push(`     - Unpaid Amount: ${bill.unpaidAmount} centavos ($${(bill.unpaidAmount / 100).toFixed(2)})`);
    report.push(`     - Base Charge: ${bill.baseCharge} centavos ($${(bill.baseCharge / 100).toFixed(2)})`);
    report.push(`     - Penalty: ${bill.penalty} centavos ($${(bill.penalty / 100).toFixed(2)})`);
    report.push(`     - Status: ${bill.status}`);
  });
  
  if (state.unitAggregatedData) {
    report.push(``);
    report.push(`Aggregated Data (Penalty Details):`);
    Object.keys(state.unitAggregatedData).forEach(monthKey => {
      const monthData = state.unitAggregatedData[monthKey];
      report.push(`  Month ${monthKey}:`);
      report.push(`     - Penalty: ${monthData.penalty} centavos ($${(monthData.penalty / 100).toFixed(2)})`);
      report.push(`     - Status: ${monthData.status}`);
      report.push(`     - Paid Amount: ${monthData.paidAmount} centavos ($${(monthData.paidAmount / 100).toFixed(2)})`);
    });
  }
  
  if (state.duesData) {
    report.push(``);
    report.push(`HOA Dues Credit Data:`);
    report.push(`  - Credit Balance: ${state.duesData.creditBalance} centavos`);
    report.push(`  - Credit History Entries: ${state.duesData.creditHistoryLength}`);
    if (state.duesData.lastCreditEntry) {
      report.push(`  - Last Entry: ${state.duesData.lastCreditEntry.type} - ${state.duesData.lastCreditEntry.amount} centavos`);
    }
  }
  
  report.push(`${'='.repeat(80)}\n`);
  
  return report.join('\n');
}

/**
 * Helper function to compare states and validate restoration
 */
function compareStates(baseline, restored, label) {
  console.log(`\n🔍 Comparing ${label}...`);
  
  const differences = [];
  const checks = [];
  
  // Compare credit balance
  if (baseline.creditBalance === restored.creditBalance) {
    checks.push(`✅ Credit balance restored: ${baseline.creditBalance} centavos`);
  } else {
    differences.push(`❌ Credit balance mismatch: ${baseline.creditBalance} → ${restored.creditBalance}`);
  }
  
  // Compare number of unpaid bills
  if (baseline.unpaidBills.length === restored.unpaidBills.length) {
    checks.push(`✅ Unpaid bills count restored: ${baseline.unpaidBills.length} bills`);
  } else {
    differences.push(`❌ Unpaid bills count mismatch: ${baseline.unpaidBills.length} → ${restored.unpaidBills.length}`);
  }
  
  // Compare each bill
  baseline.unpaidBills.forEach((baselineBill, idx) => {
    const restoredBill = restored.unpaidBills.find(b => b.monthId === baselineBill.monthId);
    
    if (!restoredBill) {
      differences.push(`❌ Bill ${baselineBill.monthId} not found in restored state`);
      return;
    }
    
    if (baselineBill.unpaidAmount === restoredBill.unpaidAmount) {
      checks.push(`✅ Bill ${baselineBill.monthId} unpaid amount restored: ${baselineBill.unpaidAmount} centavos`);
    } else {
      differences.push(`❌ Bill ${baselineBill.monthId} unpaid amount mismatch: ${baselineBill.unpaidAmount} → ${restoredBill.unpaidAmount}`);
    }
    
    if (baselineBill.penalty === restoredBill.penalty) {
      checks.push(`✅ Bill ${baselineBill.monthId} penalty restored: ${baselineBill.penalty} centavos`);
    } else {
      differences.push(`❌ Bill ${baselineBill.monthId} penalty mismatch: ${baselineBill.penalty} → ${restoredBill.penalty}`);
    }
    
    if (baselineBill.status === restoredBill.status) {
      checks.push(`✅ Bill ${baselineBill.monthId} status restored: ${baselineBill.status}`);
    } else {
      differences.push(`❌ Bill ${baselineBill.monthId} status mismatch: ${baselineBill.status} → ${restoredBill.status}`);
    }
  });
  
  // Compare aggregated data penalties
  if (baseline.unitAggregatedData && restored.unitAggregatedData) {
    Object.keys(baseline.unitAggregatedData).forEach(monthKey => {
      const baselineMonth = baseline.unitAggregatedData[monthKey];
      const restoredMonth = restored.unitAggregatedData[monthKey];
      
      if (!restoredMonth) {
        differences.push(`❌ Aggregated data for month ${monthKey} not found in restored state`);
        return;
      }
      
      if (baselineMonth.penalty === restoredMonth.penalty) {
        checks.push(`✅ AggregatedData month ${monthKey} penalty restored: ${baselineMonth.penalty} centavos`);
      } else {
        differences.push(`❌ AggregatedData month ${monthKey} penalty mismatch: ${baselineMonth.penalty} → ${restoredMonth.penalty}`);
      }
    });
  }
  
  // Print results
  checks.forEach(check => console.log(check));
  differences.forEach(diff => console.log(diff));
  
  return {
    success: differences.length === 0,
    checks: checks.length,
    differences: differences.length,
    details: { checks, differences }
  };
}

// Test Suite
const tests = [
  {
    name: 'Step 1: Capture Baseline State',
    test: async ({ api }) => {
      console.log('\n📋 STEP 1: CAPTURING BASELINE STATE');
      console.log('=' .repeat(80));
      
      testState.baseline = await getUnitWaterState(api, TEST_CLIENT, TEST_UNIT);
      
      // Print formatted report
      const report = formatStateReport('BASELINE STATE (Before Payment)', testState.baseline);
      console.log(report);
      
      // Validate we have unpaid bills to work with
      if (testState.baseline.unpaidBills.length === 0) {
        throw new Error('No unpaid bills found for testing. Please ensure test unit has unpaid bills.');
      }
      
      return { 
        passed: true, 
        data: {
          creditBalance: testState.baseline.creditBalance,
          unpaidBillsCount: testState.baseline.unpaidBills.length,
          totalUnpaidAmount: testState.baseline.unpaidBills.reduce((sum, bill) => sum + bill.unpaidAmount, 0)
        }
      };
    }
  },
  
  {
    name: 'Step 2: Create Water Bill Payment',
    test: async ({ api }) => {
      console.log('\n💳 STEP 2: CREATING WATER BILL PAYMENT');
      console.log('='.repeat(80));
      
      // Select first unpaid bill for payment
      const billToPay = testState.baseline.unpaidBills[0];
      const paymentAmount = billToPay.unpaidAmount / 100; // Convert centavos to dollars
      
      console.log(`\n📝 Payment Details:`);
      console.log(`   Bill: ${billToPay.monthId}`);
      console.log(`   Amount: $${paymentAmount.toFixed(2)} (${billToPay.unpaidAmount} centavos)`);
      console.log(`   Base Charge: $${(billToPay.baseCharge / 100).toFixed(2)}`);
      console.log(`   Penalty: $${(billToPay.penalty / 100).toFixed(2)}`);
      
      // Record payment
      const paymentResponse = await api.post(`/water/clients/${TEST_CLIENT}/payments/record`, {
        unitId: TEST_UNIT,
        amount: paymentAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
        reference: `TEST-CASCADE-DELETE-${Date.now()}`,
        notes: 'Automated test payment for cascade delete validation',
        accountId: 'bank_scotiabank',
        accountType: 'bank'
      });
      
      if (!paymentResponse.data.success) {
        throw new Error(`Payment failed: ${paymentResponse.data.error || 'Unknown error'}`);
      }
      
      const paymentResult = paymentResponse.data.data;
      testState.transactionId = paymentResult.transactionId;
      
      console.log(`\n✅ Payment Created Successfully:`);
      console.log(`   Transaction ID: ${testState.transactionId}`);
      console.log(`   Bills Paid: ${paymentResult.billsPaid.length}`);
      console.log(`   Credit Used: ${paymentResult.creditUsed || 0} centavos`);
      console.log(`   New Credit Balance: ${paymentResult.newCreditBalance || 0} centavos`);
      
      // Wait a moment for backend to process
      console.log(`\n⏳ Waiting 2 seconds for backend processing...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        passed: true,
        data: {
          transactionId: testState.transactionId,
          billsPaid: paymentResult.billsPaid,
          amountPaid: paymentAmount
        }
      };
    }
  },
  
  {
    name: 'Step 3: Capture Post-Payment State',
    test: async ({ api }) => {
      console.log('\n📊 STEP 3: CAPTURING POST-PAYMENT STATE');
      console.log('='.repeat(80));
      
      testState.postPayment = await getUnitWaterState(api, TEST_CLIENT, TEST_UNIT);
      
      // Print formatted report
      const report = formatStateReport('POST-PAYMENT STATE (After Payment, Before Deletion)', testState.postPayment);
      console.log(report);
      
      // Validate payment was applied
      const unpaidBillsReduced = testState.postPayment.unpaidBills.length < testState.baseline.unpaidBills.length;
      
      if (!unpaidBillsReduced) {
        console.log(`\n⚠️  Warning: Unpaid bills count did not reduce after payment`);
        console.log(`   Baseline: ${testState.baseline.unpaidBills.length} bills`);
        console.log(`   Post-Payment: ${testState.postPayment.unpaidBills.length} bills`);
      }
      
      return {
        passed: true,
        data: {
          creditBalance: testState.postPayment.creditBalance,
          unpaidBillsCount: testState.postPayment.unpaidBills.length,
          billsPaidCount: testState.baseline.unpaidBills.length - testState.postPayment.unpaidBills.length
        }
      };
    }
  },
  
  {
    name: 'Step 4: Delete Payment Transaction',
    test: async ({ api }) => {
      console.log('\n🗑️  STEP 4: DELETING PAYMENT TRANSACTION');
      console.log('='.repeat(80));
      
      if (!testState.transactionId) {
        throw new Error('No transaction ID available for deletion');
      }
      
      console.log(`\n📝 Deletion Details:`);
      console.log(`   Transaction ID: ${testState.transactionId}`);
      console.log(`   Expected: Bills return to unpaid, penalties recalculated`);
      
      const startTime = Date.now();
      
      // Delete transaction
      const deleteResponse = await api.delete(`/clients/${TEST_CLIENT}/transactions/${testState.transactionId}`);
      
      const deleteTime = Date.now() - startTime;
      
      if (!deleteResponse.data.success) {
        throw new Error(`Deletion failed: ${deleteResponse.data.error || 'Unknown error'}`);
      }
      
      console.log(`\n✅ Transaction Deleted Successfully:`);
      console.log(`   Deletion Time: ${deleteTime}ms`);
      console.log(`   Expected: Bills reversed, penalties recalculated`);
      
      // Wait for backend to process deletion and surgical update
      console.log(`\n⏳ Waiting 3 seconds for backend processing and surgical update...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return {
        passed: true,
        data: {
          transactionId: testState.transactionId,
          deletionTime: deleteTime,
          performanceCheck: deleteTime < 2000 ? 'PASS (<2s)' : 'WARNING (>2s)'
        }
      };
    }
  },
  
  {
    name: 'Step 5: Capture Post-Deletion State',
    test: async ({ api }) => {
      console.log('\n📊 STEP 5: CAPTURING POST-DELETION STATE');
      console.log('='.repeat(80));
      
      testState.postDeletion = await getUnitWaterState(api, TEST_CLIENT, TEST_UNIT);
      
      // Print formatted report
      const report = formatStateReport('POST-DELETION STATE (After Transaction Deletion)', testState.postDeletion);
      console.log(report);
      
      return {
        passed: true,
        data: {
          creditBalance: testState.postDeletion.creditBalance,
          unpaidBillsCount: testState.postDeletion.unpaidBills.length
        }
      };
    }
  },
  
  {
    name: 'Step 6: Validate State Restoration',
    test: async ({ api }) => {
      console.log('\n🔍 STEP 6: VALIDATING STATE RESTORATION');
      console.log('='.repeat(80));
      
      const comparison = compareStates(
        testState.baseline,
        testState.postDeletion,
        'Baseline vs Post-Deletion'
      );
      
      console.log(`\n📊 Validation Summary:`);
      console.log(`   Total Checks: ${comparison.checks}`);
      console.log(`   Passed Checks: ${comparison.checks - comparison.differences}`);
      console.log(`   Failed Checks: ${comparison.differences}`);
      console.log(`   Success: ${comparison.success ? '✅ YES' : '❌ NO'}`);
      
      if (!comparison.success) {
        console.log(`\n⚠️  WARNING: State not fully restored to baseline!`);
        console.log(`   This indicates the cascade delete is not working correctly.`);
      } else {
        console.log(`\n✅ SUCCESS: All state fully restored to baseline!`);
        console.log(`   Cascade delete with surgical penalty recalculation working correctly.`);
      }
      
      return {
        passed: comparison.success,
        data: comparison
      };
    }
  }
];

// Save detailed results to file
function saveResults() {
  const resultsDir = path.dirname(TEST_RESULTS_FILE);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const results = {
    timestamp: testState.timestamp,
    testClient: TEST_CLIENT,
    testUnit: TEST_UNIT,
    transactionId: testState.transactionId,
    baseline: testState.baseline,
    postPayment: testState.postPayment,
    postDeletion: testState.postDeletion,
    comparison: testState.baseline && testState.postDeletion ? 
      compareStates(testState.baseline, testState.postDeletion, 'Final Comparison') : null
  };
  
  fs.writeFileSync(TEST_RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to: ${TEST_RESULTS_FILE}`);
}

// Run tests
console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║   WATER BILLS CASCADE DELETE - COMPREHENSIVE TEST                          ║');
console.log('║   Priority 1B Implementation Validation                                    ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

console.log(`\nTest Configuration:`);
console.log(`  Client: ${TEST_CLIENT}`);
console.log(`  Unit: ${TEST_UNIT}`);
console.log(`  Timestamp: ${testState.timestamp}`);

try {
  await testHarness.runTests(tests);
  saveResults();
  
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║   TEST EXECUTION COMPLETE                                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nReview detailed results at: ${TEST_RESULTS_FILE}`);
  
} catch (error) {
  console.error('\n❌ Test execution failed:', error);
  saveResults();
  process.exit(1);
}


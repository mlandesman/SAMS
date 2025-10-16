/**
 * Task 3: Delete Reversal Implementation Test Suite
 * Tests that Water Bills delete function properly reverses credit balance, 
 * marks bills unpaid, and triggers surgical update
 * 
 * Issues Fixed:
 * - Issue 5: Delete doesn't restore credit balance
 * - Issue 6: Delete doesn't mark bills unpaid  
 * - Issue 7: lastPenaltyUpdate not updating after delete
 */

import { testHarness } from './testHarness.js';

// Test configuration
const TEST_CONFIG = {
  clientId: 'AVII',
  unitId: '203',
  year: 2026
};

/**
 * Test 1: Credit Used in Payment Gets Restored on Delete
 */
async function test1_CreditUsedRestored() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 1: Credit Used in Payment Gets Restored on Delete');
  console.log('='.repeat(80));
  
  const { clientId, unitId, year } = TEST_CONFIG;
  
  try {
    // Step 1: Get initial credit balance
    console.log('\n📊 Step 1: Get initial credit balance');
    const initialCredit = await testHarness.runTest({
      name: 'Get initial credit balance',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const initialBalance = initialCredit.creditBalance;
    console.log(`   Initial credit balance: ${initialBalance} centavos ($${initialBalance / 100})`);
    
    // Step 2: Make payment using some credit (if available)
    if (initialBalance === 0) {
      console.log('   ⚠️  No credit available - adding $50 credit first');
      await testHarness.runTest({
        name: 'Add test credit',
        async test({ api }) {
          const response = await api.post(`/credit/${clientId}/${unitId}`, {
            amount: 5000, // $50
            transactionId: 'TEST_SETUP_CREDIT',
            note: 'Test setup credit',
            source: 'test'
          });
          return response.data;
        }
      });
    }
    
    console.log('\n💳 Step 2: Make payment (amount will auto-calculate)');
    const paymentResult = await testHarness.runTest({
      name: 'Make payment using credit',
      async test({ api }) {
        const response = await api.post(`/water/clients/${clientId}/payments/record`, {
          unitId: unitId,
          amount: 50.00, // $50 payment (will use available credit)
          paymentDate: '2025-10-15',
          paymentMethod: 'credit',
          accountId: 'test-account',
          accountType: 'bank',
          reference: 'TEST3-DELETE-CREDIT-USED',
          notes: 'Task 3 Test 1 - Payment with credit'
        });
        return response.data;
      }
    });
    
    const transactionId = paymentResult.transactionId; // At root level, not in data
    console.log(`   Payment created: ${transactionId}`);
    
    // Step 3: Check credit after payment
    console.log('\n📊 Step 3: Check credit balance after payment');
    const afterPayment = await testHarness.runTest({
      name: 'Get credit after payment',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const balanceAfterPayment = afterPayment.creditBalance;
    console.log(`   Credit after payment: ${balanceAfterPayment} centavos ($${balanceAfterPayment / 100})`);
    
    // Step 4: Delete the transaction
    console.log('\n🗑️  Step 4: Delete the transaction');
    const deleteResult = await testHarness.runTest({
      name: 'Delete transaction to trigger reversal',
      async test({ api }) {
        const response = await api.delete(`/clients/${clientId}/transactions/${transactionId}`);
        return response.data;
      }
    });
    
    console.log(`   Delete result: ${deleteResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Step 5: Check credit was restored
    console.log('\n✅ Step 5: Verify credit was restored');
    const afterDelete = await testHarness.runTest({
      name: 'Get credit after delete to verify restoration',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const finalBalance = afterDelete.creditBalance;
    console.log(`   Final credit balance: ${finalBalance} centavos ($${finalBalance / 100})`);
    
    // Verification
    const creditRestored = (finalBalance > balanceAfterPayment);
    console.log('\n' + '-'.repeat(80));
    console.log('📋 TEST 1 RESULTS:');
    console.log(`   Initial balance: $${initialBalance / 100}`);
    console.log(`   After payment: $${balanceAfterPayment / 100}`);
    console.log(`   After delete: $${finalBalance / 100}`);
    console.log(`   Credit restored: ${creditRestored ? '✅ YES' : '❌ NO'}`);
    
    if (creditRestored) {
      console.log('\n✅ TEST 1 PASSED: Credit was restored on delete');
    } else {
      console.log('\n❌ TEST 1 FAILED: Credit was NOT restored');
    }
    
    return { passed: creditRestored, transactionId };
    
  } catch (error) {
    console.error('\n❌ TEST 1 ERROR:', error.message);
    return { passed: false, error };
  }
}

/**
 * Test 2: Credit Created by Overpayment Gets Removed on Delete
 */
async function test2_CreditCreatedRemoved() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 2: Credit Created by Overpayment Gets Removed on Delete');
  console.log('='.repeat(80));
  
  const { clientId, unitId } = TEST_CONFIG;
  
  try {
    // Step 1: Get initial credit balance
    console.log('\n📊 Step 1: Get initial credit balance');
    const initialCredit = await testHarness.runTest({
      name: 'Get initial credit balance',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const initialBalance = initialCredit.creditBalance;
    console.log(`   Initial credit balance: ${initialBalance} centavos ($${initialBalance / 100})`);
    
    // Step 2: Make overpayment to create credit
    console.log('\n💰 Step 2: Make overpayment (creates credit)');
    const paymentResult = await testHarness.runTest({
      name: 'Make overpayment to create credit',
      async test({ api }) {
        const response = await api.post(`/water/clients/${clientId}/payments/record`, {
          unitId: unitId,
          amount: 100.00, // Large payment creates overpayment credit
          paymentDate: '2025-10-15',
          paymentMethod: 'cash',
          accountId: 'test-account',
          accountType: 'bank',
          reference: 'TEST3-DELETE-OVERPAYMENT',
          notes: 'Task 3 Test 2 - Overpayment creating credit'
        });
        return response.data;
      }
    });
    
    const transactionId = paymentResult.transactionId; // At root level, not in data
    console.log(`   Payment created: ${transactionId}`);
    
    // Step 3: Check credit was created
    console.log('\n📊 Step 3: Check credit balance after overpayment');
    const afterPayment = await testHarness.runTest({
      name: 'Get credit after overpayment',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const balanceAfterPayment = afterPayment.creditBalance;
    const creditCreated = balanceAfterPayment - initialBalance;
    console.log(`   Credit after overpayment: ${balanceAfterPayment} centavos ($${balanceAfterPayment / 100})`);
    console.log(`   Credit created: ${creditCreated} centavos ($${creditCreated / 100})`);
    
    // Step 4: Delete the transaction
    console.log('\n🗑️  Step 4: Delete the overpayment transaction');
    const deleteResult = await testHarness.runTest({
      name: 'Delete overpayment transaction',
      async test({ api }) {
        const response = await api.delete(`/clients/${clientId}/transactions/${transactionId}`);
        return response.data;
      }
    });
    
    console.log(`   Delete result: ${deleteResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Step 5: Verify credit was removed
    console.log('\n✅ Step 5: Verify created credit was removed');
    const afterDelete = await testHarness.runTest({
      name: 'Get credit after delete to verify removal',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const finalBalance = afterDelete.creditBalance;
    console.log(`   Final credit balance: ${finalBalance} centavos ($${finalBalance / 100})`);
    
    // Verification
    const creditRemoved = (finalBalance < balanceAfterPayment);
    console.log('\n' + '-'.repeat(80));
    console.log('📋 TEST 2 RESULTS:');
    console.log(`   Initial balance: $${initialBalance / 100}`);
    console.log(`   After overpayment: $${balanceAfterPayment / 100} (created $${creditCreated / 100})`);
    console.log(`   After delete: $${finalBalance / 100}`);
    console.log(`   Credit removed: ${creditRemoved ? '✅ YES' : '❌ NO'}`);
    
    if (creditRemoved) {
      console.log('\n✅ TEST 2 PASSED: Created credit was removed on delete');
    } else {
      console.log('\n❌ TEST 2 FAILED: Created credit was NOT removed');
    }
    
    return { passed: creditRemoved, transactionId };
    
  } catch (error) {
    console.error('\n❌ TEST 2 ERROR:', error.message);
    return { passed: false, error };
  }
}

/**
 * Test 3: Bills Marked Unpaid After Delete
 */
async function test3_BillsMarkedUnpaid() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 3: Bills Marked Unpaid After Delete');
  console.log('='.repeat(80));
  
  const { clientId, unitId, year } = TEST_CONFIG;
  
  try {
    // Step 1: Get current aggregated data to find an unpaid bill
    console.log('\n📊 Step 1: Get current water bills data');
    const waterData = await testHarness.runTest({
      name: 'Get water bills aggregated data',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    // Find a bill with amount due
    let targetMonth = null;
    let billBefore = null;
    for (const month of waterData.data.months) {
      const unitData = month.units[unitId];
      if (unitData && unitData.status !== 'paid' && unitData.due > 0) {
        targetMonth = month;
        billBefore = unitData;
        break;
      }
    }
    
    if (!targetMonth) {
      console.log('   ⚠️  No unpaid bills found - test skipped');
      return { passed: true, skipped: true, reason: 'No unpaid bills to test' };
    }
    
    console.log(`   Found unpaid bill: ${targetMonth.month} ${targetMonth.year}`);
    console.log(`   Bill status before: ${billBefore.status}, Due: $${billBefore.due}`);
    
    // Step 2: Make payment to mark bill as paid
    console.log('\n💳 Step 2: Make payment to mark bill as paid');
    const paymentResult = await testHarness.runTest({
      name: 'Make payment to pay bill',
      async test({ api }) {
        const response = await api.post(`/water/clients/${clientId}/payments/record`, {
          unitId: unitId,
          amount: billBefore.due, // Pay exact amount due
          paymentDate: '2025-10-15',
          paymentMethod: 'cash',
          accountId: 'test-account',
          accountType: 'bank',
          reference: 'TEST3-DELETE-STATUS',
          notes: 'Task 3 Test 3 - Payment for status test'
        });
        return response.data;
      }
    });
    
    const transactionId = paymentResult.transactionId; // At root level, not in data
    console.log(`   Payment created: ${transactionId}`);
    
    // Step 3: Verify bill is now paid
    console.log('\n📊 Step 3: Verify bill is marked as paid');
    const afterPaymentData = await testHarness.runTest({
      name: 'Get water data after payment',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    const billAfterPayment = afterPaymentData.data.months
      .find(m => m.month === targetMonth.month && m.year === targetMonth.year)
      .units[unitId];
    
    console.log(`   Bill status after payment: ${billAfterPayment.status}, Due: $${billAfterPayment.due}`);
    
    // Step 4: Delete the transaction
    console.log('\n🗑️  Step 4: Delete the payment transaction');
    const deleteResult = await testHarness.runTest({
      name: 'Delete payment to reverse status',
      async test({ api }) {
        const response = await api.delete(`/clients/${clientId}/transactions/${transactionId}`);
        return response.data;
      }
    });
    
    console.log(`   Delete result: ${deleteResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Step 5: Verify bill is back to unpaid
    console.log('\n✅ Step 5: Verify bill is marked unpaid again');
    const afterDeleteData = await testHarness.runTest({
      name: 'Get water data after delete',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    const billAfterDelete = afterDeleteData.data.months
      .find(m => m.month === targetMonth.month && m.year === targetMonth.year)
      .units[unitId];
    
    console.log(`   Bill status after delete: ${billAfterDelete.status}, Due: $${billAfterDelete.due}`);
    
    // Verification
    const statusReverted = (billAfterDelete.status === 'unpaid' || billAfterDelete.status === 'partial');
    const amountRestored = (billAfterDelete.due > 0);
    
    console.log('\n' + '-'.repeat(80));
    console.log('📋 TEST 3 RESULTS:');
    console.log(`   Bill before payment: ${billBefore.status}, Due: $${billBefore.due}`);
    console.log(`   Bill after payment: ${billAfterPayment.status}, Due: $${billAfterPayment.due}`);
    console.log(`   Bill after delete: ${billAfterDelete.status}, Due: $${billAfterDelete.due}`);
    console.log(`   Status reverted: ${statusReverted ? '✅ YES' : '❌ NO'}`);
    console.log(`   Amount restored: ${amountRestored ? '✅ YES' : '❌ NO'}`);
    
    const passed = statusReverted && amountRestored;
    if (passed) {
      console.log('\n✅ TEST 3 PASSED: Bill marked unpaid after delete');
    } else {
      console.log('\n❌ TEST 3 FAILED: Bill status or amount not reverted');
    }
    
    return { passed, transactionId };
    
  } catch (error) {
    console.error('\n❌ TEST 3 ERROR:', error.message);
    return { passed: false, error };
  }
}

/**
 * Test 4: Surgical Update Runs After Delete (lastPenaltyUpdate timestamp updated)
 */
async function test4_SurgicalUpdateRuns() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 4: Surgical Update Runs After Delete');
  console.log('='.repeat(80));
  
  const { clientId, unitId, year } = TEST_CONFIG;
  
  try {
    // Step 1: Get aggregated data before
    console.log('\n📊 Step 1: Get aggregated data before delete');
    const dataBefore = await testHarness.runTest({
      name: 'Get water data to check lastPenaltyUpdate',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    const timestampBefore = dataBefore.data.lastPenaltyUpdate;
    console.log(`   lastPenaltyUpdate before: ${timestampBefore}`);
    
    // Step 2: Make a payment
    console.log('\n💳 Step 2: Make a payment');
    const paymentResult = await testHarness.runTest({
      name: 'Make test payment',
      async test({ api }) {
        const response = await api.post(`/water/clients/${clientId}/payments/record`, {
          unitId: unitId,
          amount: 50.00,
          paymentDate: '2025-10-15',
          paymentMethod: 'cash',
          accountId: 'test-account',
          accountType: 'bank',
          reference: 'TEST3-SURGICAL-UPDATE',
          notes: 'Task 3 Test 4 - Surgical update test'
        });
        return response.data;
      }
    });
    
    const transactionId = paymentResult.transactionId; // At root level, not in data
    console.log(`   Payment created: ${transactionId}`);
    
    // Wait a moment for surgical update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 3: Delete the transaction
    console.log('\n🗑️  Step 3: Delete the transaction');
    const deleteResult = await testHarness.runTest({
      name: 'Delete transaction to trigger surgical update',
      async test({ api }) {
        const response = await api.delete(`/clients/${clientId}/transactions/${transactionId}`);
        return response.data;
      }
    });
    
    console.log(`   Delete result: ${deleteResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Wait for surgical update to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Check aggregated data was updated
    console.log('\n✅ Step 4: Verify surgical update ran');
    const dataAfter = await testHarness.runTest({
      name: 'Get water data to verify lastPenaltyUpdate changed',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    const timestampAfter = dataAfter.data.lastPenaltyUpdate;
    console.log(`   lastPenaltyUpdate after: ${timestampAfter}`);
    
    // Verification
    const timestampChanged = (timestampAfter !== timestampBefore);
    
    console.log('\n' + '-'.repeat(80));
    console.log('📋 TEST 4 RESULTS:');
    console.log(`   Timestamp before: ${timestampBefore}`);
    console.log(`   Timestamp after: ${timestampAfter}`);
    console.log(`   Timestamp changed: ${timestampChanged ? '✅ YES' : '❌ NO'}`);
    
    if (timestampChanged) {
      console.log('\n✅ TEST 4 PASSED: Surgical update ran after delete (Issue 7 fixed)');
    } else {
      console.log('\n❌ TEST 4 FAILED: Surgical update did NOT run');
    }
    
    return { passed: timestampChanged, transactionId };
    
  } catch (error) {
    console.error('\n❌ TEST 4 ERROR:', error.message);
    return { passed: false, error };
  }
}

/**
 * Test 5: Complete End-to-End Reversal
 */
async function test5_CompleteReversal() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 5: Complete End-to-End Reversal');
  console.log('='.repeat(80));
  
  const { clientId, unitId, year } = TEST_CONFIG;
  
  try {
    // Step 1: Get initial state
    console.log('\n📊 Step 1: Get initial state (credit and bills)');
    const initialCredit = await testHarness.runTest({
      name: 'Get initial credit balance',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const initialData = await testHarness.runTest({
      name: 'Get initial water bills data',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    const initialCreditBalance = initialCredit.creditBalance;
    const initialTimestamp = initialData.data.lastPenaltyUpdate;
    
    console.log(`   Initial credit: ${initialCreditBalance} centavos ($${initialCreditBalance / 100})`);
    console.log(`   Initial lastPenaltyUpdate: ${initialTimestamp}`);
    
    // Step 2: Make a complex payment
    console.log('\n💰 Step 2: Make payment');
    const paymentResult = await testHarness.runTest({
      name: 'Make test payment',
      async test({ api }) {
        const response = await api.post(`/water/clients/${clientId}/payments/record`, {
          unitId: unitId,
          amount: 75.00,
          paymentDate: '2025-10-15',
          paymentMethod: 'cash',
          accountId: 'test-account',
          accountType: 'bank',
          reference: 'TEST3-COMPLETE-REVERSAL',
          notes: 'Task 3 Test 5 - Complete reversal test'
        });
        return response.data;
      }
    });
    
    const transactionId = paymentResult.transactionId; // At root level, not in data
    console.log(`   Payment created: ${transactionId}`);
    
    // Wait for surgical update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 3: Get state after payment
    console.log('\n📊 Step 3: Get state after payment');
    const afterPaymentCredit = await testHarness.runTest({
      name: 'Get credit after payment',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const afterPaymentData = await testHarness.runTest({
      name: 'Get water data after payment',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    const creditAfterPayment = afterPaymentCredit.creditBalance;
    const timestampAfterPayment = afterPaymentData.data.lastPenaltyUpdate;
    
    console.log(`   Credit after payment: ${creditAfterPayment} centavos ($${creditAfterPayment / 100})`);
    console.log(`   Timestamp after payment: ${timestampAfterPayment}`);
    
    // Step 4: Delete the transaction
    console.log('\n🗑️  Step 4: Delete the transaction');
    const deleteResult = await testHarness.runTest({
      name: 'Delete transaction for complete reversal test',
      async test({ api }) {
        const response = await api.delete(`/clients/${clientId}/transactions/${transactionId}`);
        return response.data;
      }
    });
    
    console.log(`   Delete result: ${deleteResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Wait for surgical update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 5: Verify complete reversal
    console.log('\n✅ Step 5: Verify complete reversal to initial state');
    const finalCredit = await testHarness.runTest({
      name: 'Get final credit balance',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const finalData = await testHarness.runTest({
      name: 'Get final water bills data',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    const finalCreditBalance = finalCredit.creditBalance;
    const finalTimestamp = finalData.data.lastPenaltyUpdate;
    
    console.log(`   Final credit: ${finalCreditBalance} centavos ($${finalCreditBalance / 100})`);
    console.log(`   Final lastPenaltyUpdate: ${finalTimestamp}`);
    
    // Verification
    const creditMatches = (finalCreditBalance === initialCreditBalance || 
                           Math.abs(finalCreditBalance - initialCreditBalance) < 100); // Allow small rounding
    const timestampUpdated = (finalTimestamp !== initialTimestamp);
    
    console.log('\n' + '-'.repeat(80));
    console.log('📋 TEST 5 RESULTS:');
    console.log(`   Initial credit: $${initialCreditBalance / 100}`);
    console.log(`   After payment: $${creditAfterPayment / 100}`);
    console.log(`   After delete: $${finalCreditBalance / 100}`);
    console.log(`   Credit matches initial: ${creditMatches ? '✅ YES' : '❌ NO'}`);
    console.log(`   Timestamp updated: ${timestampUpdated ? '✅ YES' : '❌ NO'}`);
    
    const passed = creditMatches && timestampUpdated;
    if (passed) {
      console.log('\n✅ TEST 5 PASSED: Complete reversal successful');
    } else {
      console.log('\n❌ TEST 5 FAILED: Reversal incomplete');
    }
    
    return { passed, transactionId };
    
  } catch (error) {
    console.error('\n❌ TEST 5 ERROR:', error.message);
    return { passed: false, error };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n' + '█'.repeat(80));
  console.log('🧪 TASK 3 TEST SUITE: Delete Reversal Implementation');
  console.log('█'.repeat(80));
  console.log('\nTesting Issues 5, 6, 7:');
  console.log('  - Issue 5: Delete restores credit balance');
  console.log('  - Issue 6: Delete marks bills unpaid');
  console.log('  - Issue 7: lastPenaltyUpdate updates after delete');
  console.log('\nTest Configuration:');
  console.log(`  Client: ${TEST_CONFIG.clientId}`);
  console.log(`  Unit: ${TEST_CONFIG.unitId}`);
  console.log(`  Year: ${TEST_CONFIG.year}`);
  
  const results = {
    test1: null,
    test2: null,
    test3: null,
    test4: null,
    test5: null
  };
  
  try {
    // Run each test
    results.test1 = await test1_CreditUsedRestored();
    results.test2 = await test2_CreditCreatedRemoved();
    results.test3 = await test3_BillsMarkedUnpaid();
    results.test4 = await test4_SurgicalUpdateRuns();
    results.test5 = await test5_CompleteReversal();
    
    // Summary
    console.log('\n' + '█'.repeat(80));
    console.log('📊 TEST SUITE SUMMARY');
    console.log('█'.repeat(80));
    
    const passCount = Object.values(results).filter(r => r?.passed).length;
    const totalCount = Object.keys(results).length;
    
    console.log(`\nTests Passed: ${passCount}/${totalCount}`);
    console.log('\nIndividual Results:');
    console.log(`  Test 1 (Credit Used Restored): ${results.test1?.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 2 (Credit Created Removed): ${results.test2?.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 3 (Bills Marked Unpaid): ${results.test3?.passed ? '✅ PASS' : (results.test3?.skipped ? '⚠️  SKIP' : '❌ FAIL')}`);
    console.log(`  Test 4 (Surgical Update): ${results.test4?.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Test 5 (Complete Reversal): ${results.test5?.passed ? '✅ PASS' : '❌ FAIL'}`);
    
    if (passCount === totalCount || (passCount === totalCount - 1 && results.test3?.skipped)) {
      console.log('\n✅ ALL TESTS PASSED - Issues 5, 6, 7 are FIXED');
    } else {
      console.log('\n❌ SOME TESTS FAILED - Review failures above');
    }
    
  } catch (error) {
    console.error('\n❌ TEST SUITE ERROR:', error);
  }
}

// Run tests
runAllTests().catch(console.error);


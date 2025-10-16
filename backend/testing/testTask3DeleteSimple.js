/**
 * Task 3: Simple Delete Reversal Test
 * Tests delete reversal on EXISTING transactions (no payment creation needed)
 */

import { testHarness } from './testHarness.js';

async function testDeleteExistingTransaction() {
  console.log('\n████████████████████████████████████████████████████████████████████████████████');
  console.log('🧪 TASK 3 SIMPLE TEST: Delete Reversal on Existing Transaction');
  console.log('████████████████████████████████████████████████████████████████████████████████\n');
  
  const clientId = 'AVII';
  const year = 2026;
  
  try {
    // Step 1: Get list of existing transactions to find one to delete
    console.log('📊 Step 1: Get list of existing transactions');
    const transactions = await testHarness.runTest({
      name: 'Get transactions list',
      async test({ api }) {
        const response = await api.get(`/clients/${clientId}/transactions?limit=20`);
        return response.data;
      }
    });
    
    console.log(`   Found ${transactions.data?.transactions?.length || 0} transactions`);
    
    // Find a water bills transaction
    const waterTransactions = transactions.data?.transactions?.filter(t => 
      t.category === 'water_bills' && t.allocations && t.allocations.length > 0
    ) || [];
    
    if (waterTransactions.length === 0) {
      console.log('\n⚠️  No existing water bills transactions found - cannot test delete');
      return { passed: false, skipped: true };
    }
    
    const testTransaction = waterTransactions[0];
    const transactionId = testTransaction.id;
    const unitId = testTransaction.unitId;
    
    console.log(`\n   Selected transaction: ${transactionId}`);
    console.log(`   Unit: ${unitId}`);
    console.log(`   Amount: $${testTransaction.amount}`);
    console.log(`   Date: ${testTransaction.date}`);
    
    // Step 2: Get current state (credit balance and bills)
    console.log('\n📊 Step 2: Get current state before delete');
    
    const creditBefore = await testHarness.runTest({
      name: 'Get credit balance before delete',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const waterDataBefore = await testHarness.runTest({
      name: 'Get water data before delete',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    console.log(`   Credit balance: ${creditBefore.creditBalance} centavos ($${creditBefore.creditBalance / 100})`);
    console.log(`   lastPenaltyUpdate: ${waterDataBefore.data.lastPenaltyUpdate}`);
    
    // Get bill status for the paid bills
    const billStatuses = [];
    for (const allocation of testTransaction.allocations || []) {
      const [allocYear, allocMonth] = allocation.monthId.split('-');
      const month = waterDataBefore.data.months.find(m => 
        m.year === parseInt(allocYear) && m.month === parseInt(allocMonth)
      );
      if (month) {
        const unitData = month.units[unitId];
        if (unitData) {
          billStatuses.push({
            monthId: allocation.monthId,
            status: unitData.status,
            due: unitData.displayDue,
            paid: unitData.paidAmount
          });
        }
      }
    }
    
    console.log('   Bill statuses:');
    billStatuses.forEach(b => console.log(`     ${b.monthId}: ${b.status}, Due: $${b.due}, Paid: $${b.paid}`));
    
    // Step 3: Delete the transaction
    console.log('\n🗑️  Step 3: Delete the transaction');
    
    const deleteResult = await testHarness.runTest({
      name: 'Delete transaction to test reversal',
      async test({ api }) {
        const response = await api.delete(`/clients/${clientId}/transactions/${transactionId}`);
        return response.data;
      }
    });
    
    console.log(`   Delete result: ${deleteResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    // Wait a bit for surgical update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Verify reversal
    console.log('\n✅ Step 4: Verify reversal occurred');
    
    const creditAfter = await testHarness.runTest({
      name: 'Get credit balance after delete',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}`);
        return response.data;
      }
    });
    
    const waterDataAfter = await testHarness.runTest({
      name: 'Get water data after delete',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/data/${year}`);
        return response.data;
      }
    });
    
    console.log(`   Credit balance: ${creditAfter.creditBalance} centavos ($${creditAfter.creditBalance / 100})`);
    console.log(`   lastPenaltyUpdate: ${waterDataAfter.data.lastPenaltyUpdate}`);
    
    // Get bill status after delete
    const billStatusesAfter = [];
    for (const allocation of testTransaction.allocations || []) {
      const [allocYear, allocMonth] = allocation.monthId.split('-');
      const month = waterDataAfter.data.months.find(m => 
        m.year === parseInt(allocYear) && m.month === parseInt(allocMonth)
      );
      if (month) {
        const unitData = month.units[unitId];
        if (unitData) {
          billStatusesAfter.push({
            monthId: allocation.monthId,
            status: unitData.status,
            due: unitData.displayDue,
            paid: unitData.paidAmount
          });
        }
      }
    }
    
    console.log('   Bill statuses after delete:');
    billStatusesAfter.forEach(b => console.log(`     ${b.monthId}: ${b.status}, Due: $${b.due}, Paid: $${b.paid}`));
    
    // Step 5: Check credit history
    console.log('\n📜 Step 5: Check credit history for reversal entry');
    
    const creditHistory = await testHarness.runTest({
      name: 'Get credit history',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}/history?limit=10`);
        return response.data;
      }
    });
    
    const reversalEntry = creditHistory.history?.find(entry => 
      entry.transactionId === transactionId + '_reversal'
    );
    
    if (reversalEntry) {
      console.log(`   ✅ Found reversal entry:`);
      console.log(`      Type: ${reversalEntry.type}`);
      console.log(`      Amount: ${reversalEntry.amount} centavos`);
      console.log(`      Description: ${reversalEntry.description}`);
    } else {
      console.log(`   ❌ No reversal entry found`);
    }
    
    // Verification
    console.log('\n' + '='.repeat(80));
    console.log('📋 VERIFICATION RESULTS:');
    console.log('='.repeat(80));
    
    const creditChanged = (creditAfter.creditBalance !== creditBefore.creditBalance);
    const timestampChanged = (waterDataAfter.data.lastPenaltyUpdate !== waterDataBefore.data.lastPenaltyUpdate);
    const billsReverted = billStatusesAfter.some((b, i) => {
      const before = billStatuses[i];
      return b.status !== before.status || b.due !== before.due;
    });
    const hasReversalEntry = !!reversalEntry;
    
    console.log(`\n1. Credit Balance:`);
    console.log(`   Before: $${creditBefore.creditBalance / 100}`);
    console.log(`   After: $${creditAfter.creditBalance / 100}`);
    console.log(`   Changed: ${creditChanged ? '✅ YES' : '⚠️  NO'}`);
    
    console.log(`\n2. lastPenaltyUpdate (Issue 7):`);
    console.log(`   Before: ${waterDataBefore.data.lastPenaltyUpdate}`);
    console.log(`   After: ${waterDataAfter.data.lastPenaltyUpdate}`);
    console.log(`   Changed: ${timestampChanged ? '✅ YES (FIXED)' : '❌ NO (BROKEN)'}`);
    
    console.log(`\n3. Bill Status (Issue 6):`);
    console.log(`   Bills reverted: ${billsReverted ? '✅ YES (FIXED)' : '❌ NO (BROKEN)'}`);
    
    console.log(`\n4. Credit History:`);
    console.log(`   Reversal entry found: ${hasReversalEntry ? '✅ YES' : '❌ NO'}`);
    
    const allPassed = timestampChanged && (billsReverted || billStatusesAfter.length === 0) && hasReversalEntry;
    
    console.log('\n' + '='.repeat(80));
    if (allPassed) {
      console.log('✅ DELETE REVERSAL WORKING - Issues 5, 6, 7 FIXED');
    } else {
      console.log('❌ DELETE REVERSAL INCOMPLETE - Some issues remain');
    }
    console.log('='.repeat(80));
    
    return { passed: allPassed, transactionId };
    
  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
    return { passed: false, error };
  }
}

// Run test
testDeleteExistingTransaction().then(result => {
  process.exit(result.passed ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


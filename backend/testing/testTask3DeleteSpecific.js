/**
 * Task 3: Test Delete Reversal on Specific Transaction
 * Usage: node testTask3DeleteSpecific.js <transactionId>
 */

import { testHarness } from './testHarness.js';

const transactionId = process.argv[2];

if (!transactionId) {
  console.error('❌ Error: Please provide transactionId as argument');
  console.error('Usage: node testTask3DeleteSpecific.js <transactionId>');
  process.exit(1);
}

async function testDeleteSpecificTransaction() {
  console.log('\n████████████████████████████████████████████████████████████████████████████████');
  console.log('🧪 TASK 3: Delete Reversal Test on Specific Transaction');
  console.log('████████████████████████████████████████████████████████████████████████████████\n');
  console.log(`Transaction ID: ${transactionId}\n`);
  
  const clientId = 'AVII';
  const year = 2026;
  
  try {
    // Step 1: Get transaction details
    console.log('📊 Step 1: Get transaction details');
    const transaction = await testHarness.runTest({
      name: 'Get transaction details',
      async test({ api }) {
        const response = await api.get(`/clients/${clientId}/transactions/${transactionId}`);
        return response.data;
      }
    });
    
    const unitId = transaction.unitId;
    
    console.log(`   Transaction found:`);
    console.log(`   - Unit: ${unitId}`);
    console.log(`   - Amount: $${transaction.amount / 100}`);
    console.log(`   - Date: ${transaction.date?.iso || transaction.date}`);
    console.log(`   - Allocations: ${transaction.allocations?.length || 0}`);
    
    // Step 2: Get state BEFORE delete
    console.log('\n📊 Step 2: Capture state BEFORE delete');
    
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
    
    // Get bill statuses before delete
    const billStatusesBefore = [];
    if (transaction.allocations) {
      for (const allocation of transaction.allocations) {
        const monthId = allocation.monthId || allocation.data?.monthId;
        if (monthId) {
          const [allocYear, allocMonth] = monthId.split('-');
          const month = waterDataBefore.data.months.find(m => 
            m.year === parseInt(allocYear) && m.month === parseInt(allocMonth)
          );
          if (month) {
            const unitData = month.units[unitId];
            if (unitData) {
              billStatusesBefore.push({
                monthId: monthId,
                status: unitData.status,
                due: unitData.displayDue,
                paid: unitData.paidAmount,
                unpaid: unitData.unpaidAmount
              });
            }
          }
        }
      }
    }
    
    console.log(`   Bill statuses (${billStatusesBefore.length} bills):`);
    billStatusesBefore.forEach(b => {
      console.log(`     ${b.monthId}: status=${b.status}, due=$${b.due}, paid=$${b.paid}`);
    });
    
    // Step 3: Get credit history before delete
    console.log('\n📜 Step 3: Get credit history BEFORE delete');
    
    const creditHistoryBefore = await testHarness.runTest({
      name: 'Get credit history before delete',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}/history?limit=20`);
        return response.data;
      }
    });
    
    const entriesForTransaction = creditHistoryBefore.history?.filter(e => 
      e.transactionId === transactionId
    ) || [];
    
    console.log(`   Credit history entries for this transaction: ${entriesForTransaction.length}`);
    entriesForTransaction.forEach(e => {
      console.log(`     - Type: ${e.type}, Amount: ${e.amount} centavos`);
    });
    
    // Step 4: DELETE the transaction
    console.log('\n🗑️  Step 4: DELETE THE TRANSACTION');
    console.log(`   Deleting transaction: ${transactionId}`);
    
    const deleteResult = await testHarness.runTest({
      name: 'Delete transaction to test reversal',
      async test({ api }) {
        const response = await api.delete(`/clients/${clientId}/transactions/${transactionId}`);
        return response.data;
      }
    });
    
    console.log(`   ✅ Delete result: ${deleteResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (deleteResult.message) {
      console.log(`   Message: ${deleteResult.message}`);
    }
    
    // Wait for surgical update
    console.log('\n⏳ Waiting 3 seconds for surgical update to complete...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Get state AFTER delete
    console.log('\n✅ Step 5: Verify state AFTER delete');
    
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
    
    // Get bill statuses after delete
    const billStatusesAfter = [];
    if (transaction.allocations) {
      for (const allocation of transaction.allocations) {
        const monthId = allocation.monthId || allocation.data?.monthId;
        if (monthId) {
          const [allocYear, allocMonth] = monthId.split('-');
          const month = waterDataAfter.data.months.find(m => 
            m.year === parseInt(allocYear) && m.month === parseInt(allocMonth)
          );
          if (month) {
            const unitData = month.units[unitId];
            if (unitData) {
              billStatusesAfter.push({
                monthId: monthId,
                status: unitData.status,
                due: unitData.displayDue,
                paid: unitData.paidAmount,
                unpaid: unitData.unpaidAmount
              });
            }
          }
        }
      }
    }
    
    console.log(`   Bill statuses (${billStatusesAfter.length} bills):`);
    billStatusesAfter.forEach(b => {
      console.log(`     ${b.monthId}: status=${b.status}, due=$${b.due}, paid=$${b.paid}`);
    });
    
    // Step 6: Check credit history after delete
    console.log('\n📜 Step 6: Verify credit history AFTER delete');
    
    const creditHistoryAfter = await testHarness.runTest({
      name: 'Get credit history after delete',
      async test({ api }) {
        const response = await api.get(`/credit/${clientId}/${unitId}/history?limit=20`);
        return response.data;
      }
    });
    
    const reversalEntry = creditHistoryAfter.history?.find(e => 
      e.transactionId === transactionId + '_reversal'
    );
    
    const removedEntries = creditHistoryBefore.history?.filter(e => 
      e.transactionId === transactionId
    ).length - (creditHistoryAfter.history?.filter(e => 
      e.transactionId === transactionId
    ).length || 0);
    
    if (reversalEntry) {
      console.log(`   ✅ Found reversal entry:`);
      console.log(`      Type: ${reversalEntry.type}`);
      console.log(`      Amount: ${reversalEntry.amount} centavos ($${reversalEntry.amount / 100})`);
      console.log(`      Description: ${reversalEntry.description || 'N/A'}`);
      console.log(`      Balance Before: ${reversalEntry.balanceBefore} → After: ${reversalEntry.balanceAfter}`);
    } else {
      console.log(`   ❌ No reversal entry found`);
    }
    
    console.log(`   Original entries removed: ${removedEntries}`);
    
    // VERIFICATION
    console.log('\n' + '='.repeat(80));
    console.log('📋 VERIFICATION RESULTS');
    console.log('='.repeat(80));
    
    const creditChange = creditAfter.creditBalance - creditBefore.creditBalance;
    const timestampChanged = waterDataAfter.data.lastPenaltyUpdate !== waterDataBefore.data.lastPenaltyUpdate;
    
    let billsChanged = 0;
    let billsUnpaid = 0;
    for (let i = 0; i < billStatusesAfter.length; i++) {
      const before = billStatusesBefore[i];
      const after = billStatusesAfter[i];
      if (before && after) {
        if (before.status !== after.status || before.due !== after.due || before.paid !== after.paid) {
          billsChanged++;
        }
        if (after.status === 'unpaid' && before.status === 'paid') {
          billsUnpaid++;
        }
      }
    }
    
    console.log('\n🎯 ISSUE 5: Credit Balance Reversal');
    console.log(`   Credit Before: $${creditBefore.creditBalance / 100}`);
    console.log(`   Credit After:  $${creditAfter.creditBalance / 100}`);
    console.log(`   Change: ${creditChange > 0 ? '+' : ''}${creditChange} centavos ($${creditChange / 100})`);
    console.log(`   Status: ${creditChange !== 0 ? '✅ CREDIT REVERSED' : '⚠️  No credit change'}`);
    console.log(`   Reversal Entry: ${reversalEntry ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`   Original Entries: ${removedEntries > 0 ? '✅ REMOVED' : '❌ NOT REMOVED'}`);
    
    console.log('\n🎯 ISSUE 6: Bills Marked Unpaid');
    console.log(`   Bills changed: ${billsChanged}/${billStatusesBefore.length}`);
    console.log(`   Bills marked unpaid: ${billsUnpaid}`);
    console.log(`   Status: ${billsChanged > 0 ? '✅ BILLS REVERTED' : '❌ BILLS NOT REVERTED'}`);
    
    console.log('\n🎯 ISSUE 7: Surgical Update (lastPenaltyUpdate)');
    console.log(`   Timestamp Before: ${waterDataBefore.data.lastPenaltyUpdate}`);
    console.log(`   Timestamp After:  ${waterDataAfter.data.lastPenaltyUpdate}`);
    console.log(`   Status: ${timestampChanged ? '✅ TIMESTAMP UPDATED' : '❌ TIMESTAMP NOT UPDATED'}`);
    
    // Overall assessment
    const issue5Fixed = reversalEntry && removedEntries > 0;
    const issue6Fixed = billsChanged > 0;
    const issue7Fixed = timestampChanged;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL ASSESSMENT');
    console.log('='.repeat(80));
    console.log(`   Issue 5 (Credit Reversal):  ${issue5Fixed ? '✅ FIXED' : '❌ BROKEN'}`);
    console.log(`   Issue 6 (Bills Unpaid):      ${issue6Fixed ? '✅ FIXED' : '❌ BROKEN'}`);
    console.log(`   Issue 7 (Surgical Update):   ${issue7Fixed ? '✅ FIXED' : '❌ BROKEN'}`);
    
    const allFixed = issue5Fixed && issue6Fixed && issue7Fixed;
    
    console.log('\n' + '█'.repeat(80));
    if (allFixed) {
      console.log('✅✅✅ ALL ISSUES FIXED - DELETE REVERSAL WORKING CORRECTLY ✅✅✅');
    } else {
      console.log('❌ SOME ISSUES REMAIN - DELETE REVERSAL INCOMPLETE');
    }
    console.log('█'.repeat(80));
    
    return { passed: allFixed, transactionId };
    
  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\nStack:', error.stack);
    return { passed: false, error };
  }
}

// Run test
testDeleteSpecificTransaction().then(result => {
  process.exit(result.passed ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


/**
 * Task 2 Issue 3 Test: Full Refresh Showing Correct Amounts
 * Tests that paid bills show $0 even after full refresh/rebuild
 */

import { testHarness } from './testHarness.js';

async function testFullRefreshCorrectAmounts() {
  console.log('🧪 Testing Issue 3: Full Refresh Showing Correct Amounts');
  
  const clientId = 'AVII';
  const year = 2026;
  
  try {
    // Test 1: Force full refresh by clearing and rebuilding
    console.log('\n🗑️ Test 1: Clear cache and force full rebuild');
    await testHarness.runTest({
      name: 'Force full rebuild of aggregated data',
      async test({ api }) {
        const response = await api.post(`/water/clients/${clientId}/aggregatedData/clear?rebuild=true&year=${year}`);
        return response.data;
      }
    });
    
    console.log('✅ Cache cleared and data rebuilt');
    
    // Wait a moment for rebuild to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Get fresh data after rebuild
    console.log('\n📊 Test 2: Get fresh data and verify paid bills show $0');
    const waterData = await testHarness.runTest({
      name: 'Get water data after full rebuild',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/aggregatedData?year=${year}`);
        return response.data;
      }
    });
    
    // Test 3: Find paid bills and verify display fields
    console.log('\n🔍 Test 3: Analyze paid bills after full refresh');
    let paidBillsAnalyzed = 0;
    let paidBillsCorrect = 0;
    let issues = [];
    
    if (waterData.months) {
      waterData.months.forEach((month, monthIndex) => {
        if (month.units) {
          Object.entries(month.units).forEach(([unitId, unitData]) => {
            if (unitData.status === 'paid') {
              paidBillsAnalyzed++;
              
              console.log(`\n  📋 Unit ${unitId}, Month ${monthIndex} (${month.monthName}):`);
              console.log(`    Status: ${unitData.status}`);
              console.log(`    Total Amount: $${(unitData.totalAmount || 0) / 100}`);
              console.log(`    Paid Amount: $${(unitData.paidAmount || 0) / 100}`);
              console.log(`    Display Due: $${(unitData.displayDue || 0) / 100}`);
              console.log(`    Display Penalties: $${(unitData.displayPenalties || 0) / 100}`);
              console.log(`    Display Overdue: $${(unitData.displayOverdue || 0) / 100}`);
              
              // Check if display fields are correct (should all be 0 for paid bills)
              const isCorrect = (
                unitData.displayDue === 0 &&
                unitData.displayPenalties === 0 &&
                unitData.displayOverdue === 0
              );
              
              if (isCorrect) {
                paidBillsCorrect++;
                console.log(`    ✅ CORRECT - All display fields show $0`);
              } else {
                console.log(`    ❌ INCORRECT - Display fields should be $0 for paid bills`);
                issues.push({
                  unit: unitId,
                  month: monthIndex,
                  displayDue: unitData.displayDue,
                  displayPenalties: unitData.displayPenalties,
                  displayOverdue: unitData.displayOverdue
                });
              }
            }
          });
        }
      });
    }
    
    // Test 4: Verify unpaid bills show actual amounts (not $0)
    console.log('\n🔍 Test 4: Verify unpaid bills show actual amounts');
    let unpaidBillsAnalyzed = 0;
    let unpaidBillsCorrect = 0;
    
    if (waterData.months) {
      waterData.months.forEach((month, monthIndex) => {
        if (month.units) {
          Object.entries(month.units).forEach(([unitId, unitData]) => {
            if (unitData.status === 'unpaid' || unitData.status === 'overdue') {
              unpaidBillsAnalyzed++;
              
              console.log(`\n  📋 Unit ${unitId}, Month ${monthIndex} (${month.monthName}):`);
              console.log(`    Status: ${unitData.status}`);
              console.log(`    Unpaid Amount: $${(unitData.unpaidAmount || 0) / 100}`);
              console.log(`    Display Due: $${(unitData.displayDue || 0) / 100}`);
              console.log(`    Display Penalties: $${(unitData.displayPenalties || 0) / 100}`);
              
              // Check if display fields match unpaid amounts
              const isCorrect = (
                unitData.displayDue === unitData.unpaidAmount &&
                unitData.displayPenalties === unitData.penaltyAmount
              );
              
              if (isCorrect) {
                unpaidBillsCorrect++;
                console.log(`    ✅ CORRECT - Display fields match unpaid amounts`);
              } else {
                console.log(`    ❌ INCORRECT - Display fields don't match unpaid amounts`);
                issues.push({
                  unit: unitId,
                  month: monthIndex,
                  expectedDue: unitData.unpaidAmount,
                  actualDisplayDue: unitData.displayDue,
                  expectedPenalties: unitData.penaltyAmount,
                  actualDisplayPenalties: unitData.displayPenalties
                });
              }
            }
          });
        }
      });
    }
    
    // Results
    console.log('\n🎯 Issue 3 Test Results:');
    console.log(`\n📊 Paid Bills:`);
    console.log(`  Total analyzed: ${paidBillsAnalyzed}`);
    console.log(`  Correct (show $0): ${paidBillsCorrect}`);
    console.log(`  Incorrect: ${paidBillsAnalyzed - paidBillsCorrect}`);
    
    console.log(`\n📊 Unpaid Bills:`);
    console.log(`  Total analyzed: ${unpaidBillsAnalyzed}`);
    console.log(`  Correct (show amounts): ${unpaidBillsCorrect}`);
    console.log(`  Incorrect: ${unpaidBillsAnalyzed - unpaidBillsCorrect}`);
    
    if (issues.length > 0) {
      console.log(`\n⚠️  Issues found:`, issues);
    }
    
    const allCorrect = (
      (paidBillsAnalyzed === 0 || paidBillsCorrect === paidBillsAnalyzed) &&
      (unpaidBillsAnalyzed === 0 || unpaidBillsCorrect === unpaidBillsAnalyzed)
    );
    
    return {
      passed: allCorrect,
      details: {
        paidBills: {
          analyzed: paidBillsAnalyzed,
          correct: paidBillsCorrect,
          passRate: paidBillsAnalyzed > 0 ? (paidBillsCorrect / paidBillsAnalyzed * 100).toFixed(1) + '%' : 'N/A'
        },
        unpaidBills: {
          analyzed: unpaidBillsAnalyzed,
          correct: unpaidBillsCorrect,
          passRate: unpaidBillsAnalyzed > 0 ? (unpaidBillsCorrect / unpaidBillsAnalyzed * 100).toFixed(1) + '%' : 'N/A'
        },
        issues: issues
      }
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      passed: false,
      error: error.message
    };
  }
}

// Run the test
testFullRefreshCorrectAmounts().then(result => {
  console.log('\n🏁 Issue 3 Test Complete:', result.passed ? '✅ PASSED' : '❌ FAILED');
  if (result.details) {
    console.log('\n📊 Summary:');
    console.log('Paid Bills:', result.details.paidBills);
    console.log('Unpaid Bills:', result.details.unpaidBills);
    if (result.details.issues && result.details.issues.length > 0) {
      console.log('\n⚠️  Issues:', result.details.issues.length);
    }
  }
  process.exit(result.passed ? 0 : 1);
}).catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});


/**
 * Task 2 Issue 2 Test: Paid Bill Display Logic
 * Tests that paid bills show $0 for displayDue, displayPenalties, and displayOverdue
 */

import { testHarness } from './testHarness.js';

async function testPaidBillDisplay() {
  console.log('🧪 Testing Issue 2: Paid Bill Display Logic');
  
  const clientId = 'AVII';
  const year = 2026;
  
  try {
    // Test 0: Clear cache and force rebuild to get fresh data with display fields
    console.log('\n🗑️ Test 0: Clear cache and force rebuild');
    await testHarness.runTest({
      name: 'Clear aggregatedData cache and force rebuild',
      async test({ api }) {
        const response = await api.post(`/water/clients/${clientId}/aggregatedData/clear?rebuild=true&year=${year}`);
        return response.data;
      }
    });
    
    // Wait a moment for the rebuild to complete
    console.log('⏳ Waiting for rebuild to complete...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 1: Get water data and check for paid bills
    console.log('\n📊 Test 1: Get water data and analyze paid bills');
    const waterData = await testHarness.runTest({
      name: 'Get water data to analyze paid bills',
      async test({ api }) {
        const response = await api.get(`/water/clients/${clientId}/aggregatedData?year=${year}`);
        return response.data;
      }
    });
    
    console.log('Water data retrieved:', {
      months: waterData.months?.length || 0,
      hasUnits: !!waterData.months?.[0]?.units,
      source: waterData.source || 'unknown'
    });
    
    // Debug: Check if display fields exist in the first unit
    if (waterData.months?.[0]?.units) {
      const firstUnit = Object.values(waterData.months[0].units)[0];
      console.log('🔍 Debug - First unit fields:', {
        hasDisplayDue: 'displayDue' in firstUnit,
        hasDisplayPenalties: 'displayPenalties' in firstUnit,
        hasDisplayOverdue: 'displayOverdue' in firstUnit,
        displayDue: firstUnit?.displayDue,
        displayPenalties: firstUnit?.displayPenalties,
        displayOverdue: firstUnit?.displayOverdue
      });
    }
    
    // Test 2: Find paid bills and check display fields
    console.log('\n🔍 Test 2: Analyze paid bills display fields');
    let paidBillsFound = 0;
    let displayLogicCorrect = 0;
    
    if (waterData.months) {
      waterData.months.forEach((month, monthIndex) => {
        if (month.units) {
          Object.entries(month.units).forEach(([unitId, unitData]) => {
            if (unitData.status === 'paid') {
              paidBillsFound++;
              
              console.log(`\n  📋 Unit ${unitId}, Month ${monthIndex}:`);
              console.log(`    Status: ${unitData.status}`);
              console.log(`    Total Amount: $${(unitData.totalAmount || 0) / 100}`);
              console.log(`    Paid Amount: $${(unitData.paidAmount || 0) / 100}`);
              console.log(`    Unpaid Amount: $${(unitData.unpaidAmount || 0) / 100}`);
              console.log(`    Display Due: $${(unitData.displayDue || 0) / 100}`);
              console.log(`    Display Penalties: $${(unitData.displayPenalties || 0) / 100}`);
              console.log(`    Display Overdue: $${(unitData.displayOverdue || 0) / 100}`);
              
              // Check if display logic is correct
              const displayCorrect = (
                unitData.displayDue === 0 &&
                unitData.displayPenalties === 0 &&
                unitData.displayOverdue === 0
              );
              
              if (displayCorrect) {
                displayLogicCorrect++;
                console.log(`    ✅ Display logic correct - all display fields show $0`);
              } else {
                console.log(`    ❌ Display logic incorrect - should all be $0 for paid bills`);
              }
            }
          });
        }
      });
    }
    
    // Test 3: Find unpaid bills and check display fields
    console.log('\n🔍 Test 3: Analyze unpaid bills display fields');
    let unpaidBillsFound = 0;
    let unpaidDisplayCorrect = 0;
    
    if (waterData.months) {
      waterData.months.forEach((month, monthIndex) => {
        if (month.units) {
          Object.entries(month.units).forEach(([unitId, unitData]) => {
            if (unitData.status === 'unpaid' || unitData.status === 'overdue') {
              unpaidBillsFound++;
              
              console.log(`\n  📋 Unit ${unitId}, Month ${monthIndex}:`);
              console.log(`    Status: ${unitData.status}`);
              console.log(`    Unpaid Amount: $${(unitData.unpaidAmount || 0) / 100}`);
              console.log(`    Display Due: $${(unitData.displayDue || 0) / 100}`);
              console.log(`    Display Penalties: $${(unitData.displayPenalties || 0) / 100}`);
              
              // Check if display fields match unpaid amounts for unpaid bills
              const displayMatches = (
                unitData.displayDue === unitData.unpaidAmount &&
                unitData.displayPenalties === unitData.penaltyAmount
              );
              
              if (displayMatches) {
                unpaidDisplayCorrect++;
                console.log(`    ✅ Display fields match unpaid amounts`);
              } else {
                console.log(`    ❌ Display fields don't match unpaid amounts`);
              }
            }
          });
        }
      });
    }
    
    // Results
    console.log('\n🎯 Issue 2 Test Results:');
    console.log(`✅ Paid bills found: ${paidBillsFound}`);
    console.log(`✅ Paid bills with correct display logic: ${displayLogicCorrect}/${paidBillsFound}`);
    console.log(`✅ Unpaid bills found: ${unpaidBillsFound}`);
    console.log(`✅ Unpaid bills with correct display logic: ${unpaidDisplayCorrect}/${unpaidBillsFound}`);
    
    const allCorrect = (
      (paidBillsFound === 0 || displayLogicCorrect === paidBillsFound) &&
      (unpaidBillsFound === 0 || unpaidDisplayCorrect === unpaidBillsFound)
    );
    
    return {
      passed: allCorrect,
      details: {
        paidBillsFound,
        displayLogicCorrect,
        unpaidBillsFound,
        unpaidDisplayCorrect,
        hasDisplayFields: waterData.months?.[0]?.units && 
          Object.values(waterData.months[0].units)[0]?.displayDue !== undefined
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
testPaidBillDisplay().then(result => {
  console.log('\n🏁 Issue 2 Test Complete:', result.passed ? 'PASSED' : 'FAILED');
  if (result.details) {
    console.log('Details:', result.details);
  }
  process.exit(result.passed ? 0 : 1);
}).catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});

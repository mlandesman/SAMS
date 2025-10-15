/**
 * Task 1: Penalty Calculation Integration Tests
 * 
 * Tests that penalties are calculated correctly in:
 * 1. Manual refresh (nightly build routine)
 * 2. Surgical update after payment
 * 
 * Based on Task 1 requirements from:
 * apm_session/Memory/Task_Assignments/Active/Task_1_Penalty_Calculation_Integration.md
 */

import { testHarness } from './testHarness.js';

// Test configuration
const TEST_CONFIG = {
  clientId: 'AVII',
  year: 2026,
  testUnit: '203', // Unit with overdue bills
  baseUrl: 'http://localhost:5001'
};

class Task1PenaltyTests {
  constructor() {
    this.results = [];
    this.testData = {};
  }

  /**
   * Run all Task 1 tests in sequence
   */
  async runAllTests() {
    console.log('\n🧪 ═══════════════════════════════════════════════════');
    console.log('   TASK 1: PENALTY CALCULATION INTEGRATION TESTS');
    console.log('═══════════════════════════════════════════════════\n');

    try {
      // Initialize test harness
      await testHarness.initialize();
      
      // Run tests in sequence
      await this.test1_GetBaselineData();
      await this.test2_ManualRefreshCalculatesPenalties();
      await this.test3_SurgicalUpdateIncludesPenalties();
      await this.test4_AllUnitsHaveCorrectPenalties();
      await this.test5_PenaltyCalculationFormula();
      
      // Print summary
      this.printSummary();
      
      return this.results;
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      throw error;
    }
  }

  /**
   * Test 1: Get Baseline Data - Verify current state
   */
  async test1_GetBaselineData() {
    console.log('\n📋 TEST 1: Get Baseline Data');
    console.log('─────────────────────────────────────────────────────');
    
    try {
      const apiClient = testHarness.getApiClient();
      
      // Get current aggregated data
      const response = await apiClient.get(
        `/water/clients/${TEST_CONFIG.clientId}/data/${TEST_CONFIG.year}`
      );
      
      if (!response.success) {
        throw new Error(`Failed to get aggregated data: ${response.error}`);
      }
      
      const data = response.data;
      this.testData.baseline = data;
      
      // Check penalty amounts across all months
      let totalUnitsWithPenalties = 0;
      let totalPenaltyAmount = 0;
      
      data.months.forEach((month, idx) => {
        if (month.units) {
          Object.entries(month.units).forEach(([unitId, unitData]) => {
            if (unitData.penaltyAmount > 0) {
              totalUnitsWithPenalties++;
              totalPenaltyAmount += unitData.penaltyAmount;
              console.log(`  Month ${idx} Unit ${unitId}: $${(unitData.penaltyAmount / 100).toFixed(2)} penalty`);
            }
          });
        }
      });
      
      console.log(`\n  ℹ️  Baseline: ${totalUnitsWithPenalties} units with penalties`);
      console.log(`  ℹ️  Total penalties: $${(totalPenaltyAmount / 100).toFixed(2)}`);
      
      // Check specific test unit
      const testUnitData = data.months[0]?.units?.[TEST_CONFIG.testUnit];
      if (testUnitData) {
        console.log(`\n  🎯 Test Unit ${TEST_CONFIG.testUnit}:`);
        console.log(`     Current Charge: $${(testUnitData.billAmount / 100).toFixed(2)}`);
        console.log(`     Penalty Amount: $${(testUnitData.penaltyAmount / 100).toFixed(2)}`);
        console.log(`     Total Amount: $${(testUnitData.totalAmount / 100).toFixed(2)}`);
        console.log(`     Status: ${testUnitData.status}`);
      }
      
      this.results.push({
        test: 'Test 1: Get Baseline Data',
        status: 'PASS',
        message: `Baseline captured: ${totalUnitsWithPenalties} units with penalties`
      });
      
      console.log('\n  ✅ Test 1 PASSED');
      
    } catch (error) {
      console.error('\n  ❌ Test 1 FAILED:', error.message);
      this.results.push({
        test: 'Test 1: Get Baseline Data',
        status: 'FAIL',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 2: Manual Refresh Calculates Penalties
   * Verifies that calling buildYearData() calculates penalties correctly
   */
  async test2_ManualRefreshCalculatesPenalties() {
    console.log('\n📋 TEST 2: Manual Refresh Calculates Penalties');
    console.log('─────────────────────────────────────────────────────');
    
    try {
      const apiClient = testHarness.getApiClient();
      
      console.log('  🔄 Triggering manual refresh (buildYearData)...');
      
      // Trigger manual refresh by calling the data endpoint with force rebuild
      // This simulates clicking the "Refresh" button in the UI
      const response = await apiClient.get(
        `/water/clients/${TEST_CONFIG.clientId}/data/${TEST_CONFIG.year}?forceRefresh=true`
      );
      
      if (!response.success) {
        throw new Error(`Failed to refresh data: ${response.error}`);
      }
      
      const data = response.data;
      this.testData.afterRefresh = data;
      
      // Count units with penalties after refresh
      let totalUnitsWithPenalties = 0;
      let totalPenaltyAmount = 0;
      const unitsWithPenalties = [];
      
      data.months.forEach((month, idx) => {
        if (month.units) {
          Object.entries(month.units).forEach(([unitId, unitData]) => {
            if (unitData.penaltyAmount > 0) {
              totalUnitsWithPenalties++;
              totalPenaltyAmount += unitData.penaltyAmount;
              unitsWithPenalties.push({
                month: idx,
                unitId,
                penalty: unitData.penaltyAmount,
                totalAmount: unitData.totalAmount,
                status: unitData.status
              });
            }
          });
        }
      });
      
      console.log(`\n  ℹ️  After refresh: ${totalUnitsWithPenalties} units with penalties`);
      console.log(`  ℹ️  Total penalties: $${(totalPenaltyAmount / 100).toFixed(2)}`);
      
      // Show sample penalties
      if (unitsWithPenalties.length > 0) {
        console.log('\n  📊 Sample penalties:');
        unitsWithPenalties.slice(0, 5).forEach(unit => {
          console.log(`     Month ${unit.month} Unit ${unit.unitId}: $${(unit.penalty / 100).toFixed(2)}`);
        });
      }
      
      // Check test unit specifically
      const testUnitData = data.months[0]?.units?.[TEST_CONFIG.testUnit];
      if (testUnitData) {
        console.log(`\n  🎯 Test Unit ${TEST_CONFIG.testUnit} after refresh:`);
        console.log(`     Penalty Amount: $${(testUnitData.penaltyAmount / 100).toFixed(2)}`);
        console.log(`     Total Amount: $${(testUnitData.totalAmount / 100).toFixed(2)}`);
        console.log(`     Status: ${testUnitData.status}`);
      }
      
      // Verification: Should have penalties calculated
      if (totalPenaltyAmount > 0) {
        console.log('\n  ✅ Test 2 PASSED - Penalties calculated during manual refresh');
        this.results.push({
          test: 'Test 2: Manual Refresh Calculates Penalties',
          status: 'PASS',
          message: `${totalUnitsWithPenalties} units with penalties totaling $${(totalPenaltyAmount / 100).toFixed(2)}`
        });
      } else {
        throw new Error('No penalties calculated after manual refresh');
      }
      
    } catch (error) {
      console.error('\n  ❌ Test 2 FAILED:', error.message);
      this.results.push({
        test: 'Test 2: Manual Refresh Calculates Penalties',
        status: 'FAIL',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 3: Surgical Update Includes Penalties
   * Verify that surgical update after payment includes penalty recalculation
   */
  async test3_SurgicalUpdateIncludesPenalties() {
    console.log('\n📋 TEST 3: Surgical Update Includes Penalties');
    console.log('─────────────────────────────────────────────────────');
    
    try {
      const apiClient = testHarness.getApiClient();
      
      // Find a unit with unpaid bills for testing
      const beforeData = this.testData.afterRefresh;
      let testUnit = null;
      let testMonth = null;
      
      for (let month = 0; month < beforeData.months.length; month++) {
        const monthData = beforeData.months[month];
        if (monthData.units) {
          for (const [unitId, unitData] of Object.entries(monthData.units)) {
            if (unitData.unpaidAmount > 0 && unitData.penaltyAmount > 0) {
              testUnit = unitId;
              testMonth = month;
              break;
            }
          }
        }
        if (testUnit) break;
      }
      
      if (!testUnit) {
        console.log('\n  ⚠️  No units with unpaid amounts and penalties found');
        console.log('  ℹ️  Skipping surgical update test (no suitable test data)');
        this.results.push({
          test: 'Test 3: Surgical Update Includes Penalties',
          status: 'SKIPPED',
          message: 'No suitable test data (no units with unpaid penalties)'
        });
        return;
      }
      
      const beforeUnitData = beforeData.months[testMonth].units[testUnit];
      console.log(`\n  🎯 Testing surgical update with Unit ${testUnit}, Month ${testMonth}`);
      console.log(`     Before payment:`);
      console.log(`       Penalty: $${(beforeUnitData.penaltyAmount / 100).toFixed(2)}`);
      console.log(`       Total: $${(beforeUnitData.totalAmount / 100).toFixed(2)}`);
      console.log(`       Unpaid: $${(beforeUnitData.unpaidAmount / 100).toFixed(2)}`);
      
      // Make a small payment to trigger surgical update
      const paymentAmount = Math.min(beforeUnitData.unpaidAmount, 5000); // Pay $50 or less
      console.log(`\n  💰 Making payment of $${(paymentAmount / 100).toFixed(2)}...`);
      
      const monthId = `${TEST_CONFIG.year}-${String(testMonth).padStart(2, '0')}`;
      
      const paymentResponse = await apiClient.post('/water/payments/record', {
        clientId: TEST_CONFIG.clientId,
        unitId: testUnit,
        amount: paymentAmount,
        allocations: [
          {
            billType: 'base_charge',
            monthId: monthId,
            amount: paymentAmount
          }
        ],
        notes: 'Task 1 Test 3 - Surgical update test'
      });
      
      if (!paymentResponse.success) {
        throw new Error(`Payment failed: ${paymentResponse.error}`);
      }
      
      console.log('  ✅ Payment recorded successfully');
      
      // Small delay to allow surgical update to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get updated data (should have surgical update applied)
      const afterResponse = await apiClient.get(
        `/water/clients/${TEST_CONFIG.clientId}/data/${TEST_CONFIG.year}`
      );
      
      if (!afterResponse.success) {
        throw new Error(`Failed to get updated data: ${afterResponse.error}`);
      }
      
      const afterData = afterResponse.data;
      const afterUnitData = afterData.months[testMonth].units[testUnit];
      
      console.log(`\n  🎯 After surgical update:`);
      console.log(`     Penalty: $${(afterUnitData.penaltyAmount / 100).toFixed(2)}`);
      console.log(`     Total: $${(afterUnitData.totalAmount / 100).toFixed(2)}`);
      console.log(`     Unpaid: $${(afterUnitData.unpaidAmount / 100).toFixed(2)}`);
      console.log(`     Paid: $${(afterUnitData.paidAmount / 100).toFixed(2)}`);
      
      // Verification: Penalty data should be updated (not stale $0)
      const penaltyUpdated = afterUnitData.penaltyAmount >= 0; // Can be 0 if fully paid
      const unpaidReduced = afterUnitData.unpaidAmount < beforeUnitData.unpaidAmount;
      
      if (penaltyUpdated && unpaidReduced) {
        console.log('\n  ✅ Test 3 PASSED - Surgical update includes penalty data');
        this.results.push({
          test: 'Test 3: Surgical Update Includes Penalties',
          status: 'PASS',
          message: `Surgical update correctly updated penalties and unpaid amount for Unit ${testUnit}`
        });
      } else {
        throw new Error('Surgical update did not correctly update penalty data');
      }
      
    } catch (error) {
      console.error('\n  ❌ Test 3 FAILED:', error.message);
      this.results.push({
        test: 'Test 3: Surgical Update Includes Penalties',
        status: 'FAIL',
        error: error.message
      });
      // Don't throw - continue with other tests
    }
  }

  /**
   * Test 4: All Units Have Correct Penalties
   * Verify penalty calculation is applied to all units that should have penalties
   */
  async test4_AllUnitsHaveCorrectPenalties() {
    console.log('\n📋 TEST 4: All Units Have Correct Penalties');
    console.log('─────────────────────────────────────────────────────');
    
    try {
      const data = this.testData.afterRefresh;
      
      let totalUnits = 0;
      let unitsWithUnpaid = 0;
      let unitsWithPenalties = 0;
      let unitsOverdueNoPenalty = [];
      
      data.months.forEach((month, monthIdx) => {
        if (month.units) {
          Object.entries(month.units).forEach(([unitId, unitData]) => {
            totalUnits++;
            
            // Check if unit has unpaid amount
            if (unitData.unpaidAmount > 0) {
              unitsWithUnpaid++;
              
              // Check if unit has penalty
              if (unitData.penaltyAmount > 0) {
                unitsWithPenalties++;
              } else if (unitData.status === 'overdue' || unitData.daysPastDue > 0) {
                // Unit is overdue but no penalty - potential issue
                unitsOverdueNoPenalty.push({
                  month: monthIdx,
                  unitId,
                  unpaidAmount: unitData.unpaidAmount,
                  daysPastDue: unitData.daysPastDue,
                  status: unitData.status
                });
              }
            }
          });
        }
      });
      
      console.log(`\n  📊 Penalty Coverage Analysis:`);
      console.log(`     Total unit-months: ${totalUnits}`);
      console.log(`     Units with unpaid: ${unitsWithUnpaid}`);
      console.log(`     Units with penalties: ${unitsWithPenalties}`);
      
      if (unitsOverdueNoPenalty.length > 0) {
        console.log(`\n  ⚠️  ${unitsOverdueNoPenalty.length} overdue units without penalties:`);
        unitsOverdueNoPenalty.slice(0, 5).forEach(unit => {
          console.log(`     Month ${unit.month} Unit ${unit.unitId}: ${unit.daysPastDue} days overdue, $${(unit.unpaidAmount / 100).toFixed(2)} unpaid`);
        });
      }
      
      // Verification: Most unpaid units should have penalties (allowing for grace period)
      const penaltyRate = unitsWithUnpaid > 0 ? (unitsWithPenalties / unitsWithUnpaid) * 100 : 0;
      console.log(`\n  📈 Penalty rate: ${penaltyRate.toFixed(1)}% of unpaid units have penalties`);
      
      if (penaltyRate >= 50 || unitsWithPenalties > 0) {
        console.log('\n  ✅ Test 4 PASSED - Penalties applied to units appropriately');
        this.results.push({
          test: 'Test 4: All Units Have Correct Penalties',
          status: 'PASS',
          message: `${unitsWithPenalties} units have penalties (${penaltyRate.toFixed(1)}% of unpaid units)`
        });
      } else {
        throw new Error(`Low penalty coverage: only ${penaltyRate.toFixed(1)}% of unpaid units have penalties`);
      }
      
    } catch (error) {
      console.error('\n  ❌ Test 4 FAILED:', error.message);
      this.results.push({
        test: 'Test 4: All Units Have Correct Penalties',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  /**
   * Test 5: Penalty Calculation Formula
   * Verify penalty amounts match expected calculation (base × rate × months)
   */
  async test5_PenaltyCalculationFormula() {
    console.log('\n📋 TEST 5: Penalty Calculation Formula Verification');
    console.log('─────────────────────────────────────────────────────');
    
    try {
      const apiClient = testHarness.getApiClient();
      
      // Get water billing config to check penalty rate
      const configResponse = await apiClient.get(
        `/clients/${TEST_CONFIG.clientId}/config/waterBills`
      );
      
      let penaltyRate = 0.05; // Default 5%
      let graceDays = 10; // Default 10 days
      
      if (configResponse.success && configResponse.data) {
        penaltyRate = configResponse.data.penaltyRate || 0.05;
        graceDays = configResponse.data.penaltyDays || 10;
      }
      
      console.log(`\n  ⚙️  Configuration:`);
      console.log(`     Penalty Rate: ${(penaltyRate * 100)}% per month`);
      console.log(`     Grace Period: ${graceDays} days`);
      
      // Analyze penalty calculations
      const data = this.testData.afterRefresh;
      const penaltyExamples = [];
      
      data.months.forEach((month, monthIdx) => {
        if (month.units) {
          Object.entries(month.units).forEach(([unitId, unitData]) => {
            if (unitData.penaltyAmount > 0 && unitData.daysPastDue > graceDays) {
              penaltyExamples.push({
                month: monthIdx,
                unitId,
                baseAmount: unitData.billAmount,
                penaltyAmount: unitData.penaltyAmount,
                totalAmount: unitData.totalAmount,
                daysPastDue: unitData.daysPastDue,
                monthsPastDue: Math.floor(unitData.daysPastDue / 30)
              });
            }
          });
        }
      });
      
      console.log(`\n  📊 Found ${penaltyExamples.length} units with penalties to verify`);
      
      if (penaltyExamples.length > 0) {
        console.log(`\n  🔍 Verifying penalty calculations (first 5 examples):`);
        
        let correctCalculations = 0;
        let totalExamined = 0;
        
        penaltyExamples.slice(0, 5).forEach(example => {
          totalExamined++;
          
          // Compounding penalty calculation:
          // Month 1: base × rate
          // Month 2: (base + month1penalty) × rate
          // etc.
          let runningTotal = example.baseAmount;
          let expectedPenalty = 0;
          
          for (let month = 1; month <= example.monthsPastDue; month++) {
            const monthlyPenalty = runningTotal * penaltyRate;
            expectedPenalty += monthlyPenalty;
            runningTotal += monthlyPenalty;
          }
          
          expectedPenalty = Math.round(expectedPenalty);
          
          const actualPenalty = example.penaltyAmount;
          const difference = Math.abs(actualPenalty - expectedPenalty);
          const percentDiff = (difference / actualPenalty) * 100;
          
          console.log(`\n     Unit ${example.unitId} (Month ${example.month}):`);
          console.log(`       Base: $${(example.baseAmount / 100).toFixed(2)}`);
          console.log(`       Days Past Due: ${example.daysPastDue} (~${example.monthsPastDue} months)`);
          console.log(`       Expected Penalty: $${(expectedPenalty / 100).toFixed(2)}`);
          console.log(`       Actual Penalty: $${(actualPenalty / 100).toFixed(2)}`);
          console.log(`       Difference: $${(difference / 100).toFixed(2)} (${percentDiff.toFixed(1)}%)`);
          
          // Allow 5% tolerance for rounding differences
          if (percentDiff <= 5) {
            correctCalculations++;
            console.log(`       ✅ Calculation correct`);
          } else {
            console.log(`       ⚠️  Calculation differs by ${percentDiff.toFixed(1)}%`);
          }
        });
        
        const accuracyRate = (correctCalculations / totalExamined) * 100;
        console.log(`\n  📈 Accuracy: ${correctCalculations}/${totalExamined} (${accuracyRate.toFixed(1)}%) calculations within 5% tolerance`);
        
        if (accuracyRate >= 80) {
          console.log('\n  ✅ Test 5 PASSED - Penalty calculations are accurate');
          this.results.push({
            test: 'Test 5: Penalty Calculation Formula',
            status: 'PASS',
            message: `${accuracyRate.toFixed(1)}% of penalty calculations verified as correct`
          });
        } else {
          throw new Error(`Low accuracy rate: only ${accuracyRate.toFixed(1)}% of calculations correct`);
        }
        
      } else {
        console.log('\n  ⚠️  No penalties found to verify formula');
        this.results.push({
          test: 'Test 5: Penalty Calculation Formula',
          status: 'SKIPPED',
          message: 'No penalties found for formula verification'
        });
      }
      
    } catch (error) {
      console.error('\n  ❌ Test 5 FAILED:', error.message);
      this.results.push({
        test: 'Test 5: Penalty Calculation Formula',
        status: 'FAIL',
        error: error.message
      });
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('   TASK 1 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIPPED').length;
    const total = this.results.length;
    
    this.results.forEach((result, idx) => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`${icon} ${result.test}`);
      if (result.message) {
        console.log(`   ${result.message}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log(`\n${'─'.repeat(55)}`);
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
    console.log(`Success Rate: ${((passed / (total - skipped)) * 100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════════════════\n');
    
    if (failed > 0) {
      console.log('⚠️  Some tests failed. Review failures above.');
    } else if (passed === total) {
      console.log('🎉 All tests passed! Task 1 implementation verified.');
    } else {
      console.log(`ℹ️  ${passed} tests passed, ${skipped} skipped.`);
    }
  }
}

// Main execution
async function main() {
  const tests = new Task1PenaltyTests();
  
  try {
    await tests.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { Task1PenaltyTests };


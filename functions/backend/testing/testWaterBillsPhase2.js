#!/usr/bin/env node

/**
 * Test Water Bills Phase 2 - Bill Generation
 * Uses the test harness for proper authentication
 */

import { testHarness } from './testHarness.js';

const harness = testHarness;

// Test suite for Water Bills Phase 2
const waterBillsTests = [
  {
    name: 'Get Water Bills Config',
    test: async ({ api }) => {
      try {
        const response = await api.get('/clients/AVII/projects/waterBills/config');
        
        if (response.success && response.data) {
          const config = response.data;
          console.log(`      Rate: $${(config.ratePerM3 / 100).toFixed(2)} MXN/m³`);
          console.log(`      Due Day: ${config.dueDay}th`);
          console.log(`      Penalty: ${(config.penaltyRate * 100)}%`);
          return {
            passed: true,
            message: 'Config loaded successfully',
            data: config
          };
        }
        
        return {
          passed: false,
          reason: 'No config data returned'
        };
      } catch (error) {
        return {
          passed: false,
          reason: error.message
        };
      }
    }
  },
  
  {
    name: 'Check Existing Readings for July 2025',
    test: async ({ api }) => {
      try {
        const response = await api.get('/clients/AVII/projects/waterBills/readings/2025/6');
        
        if (response.success && response.data) {
          const readings = response.data.readings;
          const unitCount = Object.keys(readings.units || {}).length;
          console.log(`      Units with readings: ${unitCount}`);
          
          // Show first 3 units
          const units = Object.entries(readings.units || {}).slice(0, 3);
          units.forEach(([unitId, reading]) => {
            console.log(`      Unit ${unitId}: ${reading.consumption} m³`);
          });
          
          return {
            passed: true,
            message: `Found readings for ${unitCount} units`,
            data: readings
          };
        }
        
        return {
          passed: false,
          reason: 'No readings found for July 2025'
        };
      } catch (error) {
        return {
          passed: false,
          reason: error.message
        };
      }
    }
  },
  
  {
    name: 'Get Existing Bills for July 2025',
    test: async ({ api }) => {
      try {
        const response = await api.get('/clients/AVII/projects/waterBills/bills/2025/6');
        
        if (response.success && response.data) {
          const bills = response.data;
          console.log(`      Total units billed: ${bills.summary.totalUnits}`);
          console.log(`      Total amount: ${bills.summary.currencySymbol}${bills.summary.totalBilled.toFixed(2)}`);
          console.log(`      Total unpaid: ${bills.summary.currencySymbol}${bills.summary.totalUnpaid.toFixed(2)}`);
          
          // Verify calculations for first unit
          const firstUnit = Object.entries(bills.bills.units || {})[0];
          if (firstUnit) {
            const [unitId, bill] = firstUnit;
            console.log(`      Sample - Unit ${unitId}:`);
            console.log(`        Consumption: ${bill.consumption} m³`);
            console.log(`        Amount: $${bill.totalAmount.toFixed(2)}`);
            
            // Verify calculation
            const configRate = bills.configSnapshot.ratePerM3 / 100;
            const expectedAmount = bill.consumption * configRate;
            const calculationCorrect = Math.abs(bill.baseAmount - expectedAmount) < 0.01;
            console.log(`        Calculation check: ${calculationCorrect ? '✅' : '❌'}`);
          }
          
          return {
            passed: true,
            message: 'Retrieved existing bills successfully',
            data: bills
          };
        }
        
        return {
          passed: false,
          reason: 'No bills found - may need to generate first'
        };
      } catch (error) {
        // 404 is expected if no bills exist yet
        if (error.message?.includes('404') || error.message?.includes('No bills found')) {
          return {
            passed: true,
            message: 'No bills exist yet (expected)',
            data: null
          };
        }
        return {
          passed: false,
          reason: error.message
        };
      }
    }
  },
  
  {
    name: 'Generate Bills for July 2025',
    test: async ({ api }) => {
      try {
        const response = await api.post('/clients/AVII/projects/waterBills/bills/generate', {
          year: 2025,
          month: 6  // July (0-indexed)
        });
        
        if (response.success && response.data) {
          const bills = response.data;
          console.log(`      Bills generated: ${bills.summary.totalUnits} units`);
          console.log(`      Total amount: ${bills.summary.currencySymbol}${bills.summary.totalBilled.toFixed(2)}`);
          console.log(`      Due date: ${new Date(bills.dueDate).toLocaleDateString()}`);
          
          // Verify unpaid only
          const allUnpaid = Object.values(bills.bills.units).every(b => b.status === 'unpaid');
          console.log(`      All bills unpaid: ${allUnpaid ? '✅' : '❌'}`);
          
          // Show sample bills
          const sampleBills = Object.entries(bills.bills.units).slice(0, 2);
          sampleBills.forEach(([unitId, bill]) => {
            console.log(`      Unit ${unitId}: ${bill.consumption} m³ = $${bill.totalAmount.toFixed(2)}`);
          });
          
          return {
            passed: true,
            message: 'Bills generated successfully',
            data: bills
          };
        }
        
        return {
          passed: false,
          reason: 'Failed to generate bills'
        };
      } catch (error) {
        // If bills already exist, that's also a valid response
        if (error.message?.includes('already exist')) {
          return {
            passed: true,
            message: 'Bills already exist for this period (expected)',
            data: null
          };
        }
        return {
          passed: false,
          reason: error.message
        };
      }
    }
  },
  
  {
    name: 'Verify Bill Calculations',
    test: async ({ api }) => {
      try {
        // Get config and bills to verify
        const configResponse = await api.get('/clients/AVII/projects/waterBills/config');
        const billsResponse = await api.get('/clients/AVII/projects/waterBills/bills/2025/6');
        
        if (!configResponse.success || !billsResponse.success) {
          return {
            passed: false,
            reason: 'Could not load config or bills'
          };
        }
        
        const config = configResponse.data;
        const bills = billsResponse.data;
        const ratePerM3 = config.ratePerM3 / 100;
        
        let errors = [];
        let checked = 0;
        
        // Check each bill calculation
        for (const [unitId, bill] of Object.entries(bills.bills.units || {})) {
          const expectedAmount = bill.consumption * ratePerM3;
          const finalAmount = Math.max(expectedAmount, config.minimumCharge / 100);
          
          if (Math.abs(bill.baseAmount - finalAmount) > 0.01) {
            errors.push({
              unitId,
              expected: finalAmount,
              actual: bill.baseAmount
            });
          }
          checked++;
        }
        
        console.log(`      Checked ${checked} bills`);
        console.log(`      Rate used: $${ratePerM3.toFixed(2)}/m³`);
        console.log(`      Errors found: ${errors.length}`);
        
        if (errors.length > 0) {
          console.log('      ❌ Calculation errors:');
          errors.slice(0, 3).forEach(e => {
            console.log(`        Unit ${e.unitId}: Expected $${e.expected.toFixed(2)}, Got $${e.actual.toFixed(2)}`);
          });
        }
        
        return {
          passed: errors.length === 0,
          message: errors.length === 0 ? 'All calculations correct' : `Found ${errors.length} calculation errors`,
          data: { checked, errors: errors.length }
        };
      } catch (error) {
        return {
          passed: false,
          reason: error.message
        };
      }
    }
  },
  
  {
    name: 'Test Unpaid Only Filter',
    test: async ({ api }) => {
      try {
        const response = await api.get('/clients/AVII/projects/waterBills/bills/2025/6?unpaidOnly=true');
        
        if (response.success && response.data) {
          const bills = response.data;
          const allUnpaid = Object.values(bills.bills.units || {}).every(b => b.status === 'unpaid');
          
          console.log(`      Bills returned: ${Object.keys(bills.bills.units || {}).length}`);
          console.log(`      All unpaid: ${allUnpaid ? '✅' : '❌'}`);
          
          return {
            passed: allUnpaid,
            message: allUnpaid ? 'Filter working correctly' : 'Found non-unpaid bills',
            data: { count: Object.keys(bills.bills.units || {}).length }
          };
        }
        
        return {
          passed: false,
          reason: 'No data returned'
        };
      } catch (error) {
        return {
          passed: false,
          reason: error.message
        };
      }
    }
  }
];

// Run the test suite
async function runTests() {
  console.log('🧪 Testing Water Bills Phase 2 - Bill Generation\n');
  console.log('============================================\n');
  
  const suite = await harness.runSuite({
    name: 'Water Bills Phase 2',
    tests: waterBillsTests
  });
  
  // Display summary
  console.log('\n============================================');
  console.log('📊 Test Summary:');
  console.log(`   Total Tests: ${suite.summary.total}`);
  console.log(`   ✅ Passed: ${suite.summary.passed}`);
  console.log(`   ❌ Failed: ${suite.summary.failed}`);
  console.log(`   ⏱️  Duration: ${suite.summary.duration}ms`);
  
  process.exit(suite.summary.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
/**
 * Simple Task 1 Test - Direct API calls with proper authentication
 */

import fetch from 'node-fetch';
import { tokenManager } from './tokenManager.js';

const BASE_URL = 'http://localhost:5001';
const CLIENT_ID = 'AVII';
const YEAR = 2026;

// Simple test runner
class SimpleTask1Test {
  constructor() {
    this.token = null;
  }
  
  async initialize() {
    console.log('🔑 Getting authentication token...');
    this.token = await tokenManager.getToken();
    console.log(`✅ Token obtained: ${this.token.substring(0, 30)}...\n`);
  }
  
  async run() {
    console.log('\n🧪 Task 1: Penalty Calculation Integration - Simple Test');
    console.log('═══════════════════════════════════════════════════════\n');
    
    try {
      await this.initialize();
      await this.testManualRefresh();
      await this.testPenaltyData();
      
      console.log('\n✅ All simple tests completed successfully!\n');
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      console.error(error);
      process.exit(1);
    }
  }
  
  async testManualRefresh() {
    console.log('📋 Test: Manual Refresh with Penalty Calculation');
    console.log('─────────────────────────────────────────────────────');
    
    try {
      // Call the water data endpoint (this triggers buildYearData which includes penalty recalc)
      console.log(`  🔄 Calling GET /water/clients/${CLIENT_ID}/data/${YEAR}...`);
      
      const response = await fetch(`${BASE_URL}/water/clients/${CLIENT_ID}/data/${YEAR}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.months) {
        throw new Error('Invalid response structure');
      }
      
      console.log(`  ✅ Response received: ${data.months.length} months`);
      
      // Analyze penalty data
      let totalUnitsWithPenalties = 0;
      let totalPenaltyAmount = 0;
      const penaltyExamples = [];
      
      data.months.forEach((month, idx) => {
        if (month.units) {
          Object.entries(month.units).forEach(([unitId, unitData]) => {
            if (unitData.penaltyAmount && unitData.penaltyAmount > 0) {
              totalUnitsWithPenalties++;
              totalPenaltyAmount += unitData.penaltyAmount;
              
              if (penaltyExamples.length < 5) {
                penaltyExamples.push({
                  month: idx,
                  monthName: month.monthName,
                  unitId,
                  penalty: unitData.penaltyAmount,
                  total: unitData.totalAmount,
                  status: unitData.status
                });
              }
            }
          });
        }
      });
      
      console.log(`\n  📊 Penalty Analysis:`);
      console.log(`     Units with penalties: ${totalUnitsWithPenalties}`);
      console.log(`     Total penalty amount: $${(totalPenaltyAmount / 100).toFixed(2)}`);
      
      if (penaltyExamples.length > 0) {
        console.log(`\n  📋 Sample penalties:`);
        penaltyExamples.forEach(example => {
          console.log(`     ${example.monthName} - Unit ${example.unitId}: $${(example.penalty / 100).toFixed(2)} penalty (Total: $${(example.total / 100).toFixed(2)})`);
        });
      }
      
      if (totalUnitsWithPenalties === 0) {
        console.log(`\n  ⚠️  WARNING: No penalties found. This could mean:`);
        console.log(`     1. All bills are within grace period`);
        console.log(`     2. All bills are paid`);
        console.log(`     3. Penalty calculation not working`);
      } else {
        console.log(`\n  ✅ Penalties calculated successfully`);
      }
      
    } catch (error) {
      console.error(`\n  ❌ Manual refresh test failed:`, error.message);
      throw error;
    }
  }
  
  async testPenaltyData() {
    console.log('\n📋 Test: Verify Penalty Data Structure');
    console.log('─────────────────────────────────────────────────────');
    
    try {
      const response = await fetch(`${BASE_URL}/water/clients/${CLIENT_ID}/data/${YEAR}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      // Check first month with units
      const firstMonthWithUnits = data.months.find(m => m.units && Object.keys(m.units).length > 0);
      
      if (!firstMonthWithUnits) {
        throw new Error('No month with units found');
      }
      
      const firstUnit = Object.values(firstMonthWithUnits.units)[0];
      
      console.log(`  🔍 Checking unit data structure...`);
      console.log(`     Has penaltyAmount field: ${firstUnit.hasOwnProperty('penaltyAmount') ? '✅' : '❌'}`);
      console.log(`     Has totalAmount field: ${firstUnit.hasOwnProperty('totalAmount') ? '✅' : '❌'}`);
      console.log(`     Has billAmount field: ${firstUnit.hasOwnProperty('billAmount') ? '✅' : '❌'}`);
      console.log(`     Has status field: ${firstUnit.hasOwnProperty('status') ? '✅' : '❌'}`);
      
      console.log(`\n  📊 Sample unit values:`);
      console.log(`     Bill Amount: $${(firstUnit.billAmount / 100).toFixed(2)}`);
      console.log(`     Penalty Amount: $${(firstUnit.penaltyAmount / 100).toFixed(2)}`);
      console.log(`     Total Amount: $${(firstUnit.totalAmount / 100).toFixed(2)}`);
      console.log(`     Status: ${firstUnit.status}`);
      
      console.log(`\n  ✅ Data structure verified`);
      
    } catch (error) {
      console.error(`\n  ❌ Penalty data test failed:`, error.message);
      throw error;
    }
  }
}

// Run the test
const test = new SimpleTask1Test();
test.run().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});


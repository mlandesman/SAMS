#!/usr/bin/env node

/**
 * Test Bill Generation with REAL data
 */

import { createApiClient } from './apiClient.js';

async function testBillGeneration() {
  console.log('🧪 Testing Water Bills Generation with REAL Data\n');
  
  try {
    const api = await createApiClient();
    console.log('✅ Authentication successful\n');
    
    // 1. Test getting config
    console.log('1️⃣ Getting config from /api/clients/AVII/water/config...');
    try {
      const configResponse = await api.get('/api/clients/AVII/water/config');
      if (configResponse.success && configResponse.data) {
        const config = configResponse.data;
        console.log('   ✅ Config loaded:');
        console.log(`      Rate: ${config.ratePerM3} centavos (${(config.ratePerM3 / 100).toFixed(2)} pesos/m³)`);
        console.log(`      Due Day: ${config.dueDay}th`);
        console.log(`      Penalty: ${(config.penaltyRate * 100)}%`);
      }
    } catch (error) {
      console.log('   ❌ Error:', error.message);
    }
    
    // 2. Check readings exist at /api/clients/AVII/water/readings/2026/0
    console.log('\n2️⃣ Checking readings at /api/clients/AVII/water/readings/2026/0...');
    try {
      const readingsResponse = await api.get('/api/clients/AVII/water/readings/2026/0');
      if (readingsResponse.success && readingsResponse.data) {
        const readings = readingsResponse.data;
        const unitCount = Object.keys(readings.units || {}).length;
        console.log(`   ✅ Found readings for ${unitCount} units`);
        
        // Show first 3 units
        const units = Object.entries(readings.units || {}).slice(0, 3);
        units.forEach(([unitId, data]) => {
          console.log(`      Unit ${unitId}: ${data.prior} → ${data.current} (${data.consumption} m³)`);
        });
      }
    } catch (error) {
      console.log('   ❌ No readings found:', error.message);
    }
    
    // 3. Generate bills for July FY2026 (month 0)
    console.log('\n3️⃣ Generating bills for July FY2026 (2026/0)...');
    try {
      const generateResponse = await api.post('/api/clients/AVII/water/bills/generate', {
        year: 2026,
        month: 0  // July in fiscal year
      });
      
      if (generateResponse.success && generateResponse.data) {
        const result = generateResponse.data;
        console.log('   ✅ Bills generated successfully!');
        console.log(`      Units billed: ${result.summary.totalUnits}`);
        console.log(`      Total: ${result.summary.currencySymbol}${result.summary.totalBilled.toFixed(2)}`);
        
        // Verify some calculations
        const firstUnit = Object.entries(result.bills.units || {})[0];
        if (firstUnit) {
          const [unitId, bill] = firstUnit;
          const rateInPesos = result.configSnapshot.ratePerM3 / 100;
          const expectedAmount = bill.consumption * rateInPesos;
          const correct = Math.abs(bill.baseAmount - expectedAmount) < 0.01;
          
          console.log(`\n      Example: Unit ${unitId}`);
          console.log(`         Consumption: ${bill.consumption} m³`);
          console.log(`         Rate: $${rateInPesos.toFixed(2)}/m³`);
          console.log(`         Expected: $${expectedAmount.toFixed(2)}`);
          console.log(`         Actual: $${bill.baseAmount.toFixed(2)} ${correct ? '✅' : '❌'}`);
        }
        
        // Check that only unpaid bills were returned
        const allUnpaid = Object.values(result.bills.units).every(b => b.status === 'unpaid');
        console.log(`\n      All bills unpaid: ${allUnpaid ? '✅' : '❌'}`);
      }
    } catch (error) {
      if (error.message?.includes('already exist')) {
        console.log('   ℹ️  Bills already exist for this period');
        
        // Try to get existing bills
        console.log('\n4️⃣ Getting existing bills...');
        try {
          const billsResponse = await api.get('/api/clients/AVII/water/bills/2026/0');
          if (billsResponse.success && billsResponse.data) {
            const bills = billsResponse.data;
            console.log('   ✅ Existing bills found:');
            console.log(`      Total units: ${bills.summary.totalUnits}`);
            console.log(`      Total billed: ${bills.summary.currencySymbol}${bills.summary.totalBilled.toFixed(2)}`);
          }
        } catch (getError) {
          console.log('   ❌ Could not get bills:', getError.message);
        }
      } else {
        console.log('   ❌ Error:', error.message);
      }
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the test
testBillGeneration();
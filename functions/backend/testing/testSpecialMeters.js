#!/usr/bin/env node

/**
 * Test Special Meters in Water Data Aggregation
 */

import { createApiClient } from './apiClient.js';

async function testSpecialMeters() {
  console.log('🔍 Testing Special Meters (Common Area & Building Meter)\n');
  
  try {
    // Create authenticated API client
    const api = await createApiClient();
    console.log('✅ Authentication successful\n');
    
    // Get water data for FY 2026
    const response = await api.get('/api/clients/AVII/water/data/2026');
    
    if (!response.data.success) {
      throw new Error('Failed to get water data');
    }
    
    const data = response.data.data;
    
    // Check monthly data for special meters
    console.log('📊 Checking Monthly Data:\n');
    let hasCommonArea = false;
    let hasBuildingMeter = false;
    
    for (let i = 0; i < Math.min(3, data.months.length); i++) {
      const month = data.months[i];
      console.log(`Month ${i} (${month.monthName}):`);
      
      if (month.commonArea) {
        hasCommonArea = true;
        console.log(`  ✅ Common Area: ${month.commonArea.currentReading} (consumption: ${month.commonArea.consumption})`);
      } else {
        console.log('  ❌ Common Area: Missing');
      }
      
      if (month.buildingMeter) {
        hasBuildingMeter = true;
        console.log(`  ✅ Building Meter: ${month.buildingMeter.currentReading} (consumption: ${month.buildingMeter.consumption})`);
      } else {
        console.log('  ❌ Building Meter: Missing');
      }
      
      console.log('');
    }
    
    // Check summary for special meter totals
    console.log('📊 Checking Summary Data:\n');
    const summary = data.summary;
    
    console.log('Summary fields:');
    console.log(`  Total Unit Consumption: ${summary.totalConsumption} m³`);
    
    if (summary.commonAreaConsumption !== undefined) {
      console.log(`  ✅ Common Area Consumption: ${summary.commonAreaConsumption} m³`);
    } else {
      console.log('  ❌ Common Area Consumption: Missing from summary');
    }
    
    if (summary.buildingMeterConsumption !== undefined) {
      console.log(`  ✅ Building Meter Consumption: ${summary.buildingMeterConsumption} m³`);
    } else {
      console.log('  ❌ Building Meter Consumption: Missing from summary');
    }
    
    console.log(`  Total Billed: $${summary.totalBilled}`);
    console.log(`  Collection Rate: ${summary.collectionRate}%`);
    
    // Final result
    console.log('\n' + '='.repeat(50));
    if (hasCommonArea && hasBuildingMeter && 
        summary.commonAreaConsumption !== undefined && 
        summary.buildingMeterConsumption !== undefined) {
      console.log('✅ SUCCESS: Special meters are properly included in the aggregated data!');
      console.log('   - Monthly data includes commonArea and buildingMeter');
      console.log('   - Summary includes special meter consumption totals');
    } else {
      console.log('⚠️  PARTIAL SUCCESS: Some special meter data is missing');
      if (!hasCommonArea) console.log('   - Missing commonArea in monthly data');
      if (!hasBuildingMeter) console.log('   - Missing buildingMeter in monthly data');
      if (summary.commonAreaConsumption === undefined) console.log('   - Missing commonAreaConsumption in summary');
      if (summary.buildingMeterConsumption === undefined) console.log('   - Missing buildingMeterConsumption in summary');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testSpecialMeters();
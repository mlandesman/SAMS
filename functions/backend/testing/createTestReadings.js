#!/usr/bin/env node

/**
 * Create test water meter readings for July 2025
 * To enable testing of bill generation
 */

import { createApiClient } from './apiClient.js';

async function createTestReadings() {
  console.log('📝 Creating test water meter readings for July 2025\n');
  
  try {
    // Create authenticated API client
    const api = await createApiClient();
    console.log('✅ Authentication successful\n');
    
    // Test readings data for AVII units (only units that exist)
    const testReadings = {
      "101": 1785,  // Consumption will be calculated from prior reading
      "102": 2234,
      "103": 1567,
      "104": 1890,
      "105": 2456,
      "106": 1234,
      "201": 1678,  // Using 201 instead of 107
      "202": 1456,  // Using 202 instead of 108
      "203": 1890,  // Using 203 instead of 109
      "commonArea": 3456,
      "buildingMeter": 18500  // Total building reading
    };
    
    console.log('📤 Submitting readings for July 2025...');
    console.log('   Units: 101-106, 201-203 + common area + building meter');
    
    try {
      const response = await api.post('/api/clients/AVII/projects/waterBills/readings', {
        year: 2025,
        month: 6,  // July (0-indexed)
        readings: testReadings
      });
      
      if (response.success) {
        console.log('✅ Readings submitted successfully!');
        console.log(`   Billing period: ${response.data.billingPeriod}`);
        
        // Show some sample readings
        const units = Object.entries(response.data.readings.units || {}).slice(0, 3);
        units.forEach(([unitId, reading]) => {
          console.log(`   Unit ${unitId}: ${reading.prior} → ${reading.current} (${reading.consumption} m³)`);
        });
      } else {
        console.log('❌ Failed to submit readings');
      }
    } catch (error) {
      if (error.message?.includes('already exist')) {
        console.log('ℹ️  Readings already exist for July 2025');
        
        // Try to get existing readings
        try {
          const getResponse = await api.get('/api/clients/AVII/projects/waterBills/readings/2025/6');
          if (getResponse.success) {
            console.log('   Existing readings found:');
            const units = Object.entries(getResponse.data.readings.units || {}).slice(0, 3);
            units.forEach(([unitId, reading]) => {
              console.log(`   Unit ${unitId}: ${reading.consumption} m³`);
            });
          }
        } catch (getError) {
          console.log('   Could not retrieve existing readings');
        }
      } else {
        console.log('❌ Error:', error.message);
      }
    }
    
    console.log('\n✅ Test data ready for bill generation!');
    console.log('   You can now test bill generation for July 2025');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
createTestReadings();
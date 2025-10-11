#!/usr/bin/env node

/**
 * Test the bridge endpoint to verify it returns data correctly
 */

import { createApiClient } from './testHarness.js';

async function testBridgeEndpoint() {
  console.log('Testing watermeters/all endpoint bridge...\n');
  
  try {
    const api = await createApiClient('fjXv8gX1CYWBvOZ1CS27j96oRCT2');
    
    // Call the OLD endpoint that frontend uses
    console.log('Calling: GET /api/clients/AVII/watermeters/all/2026');
    const response = await api.get('/api/clients/AVII/watermeters/all/2026');
    
    console.log('\n✅ Response received:');
    console.log('Status:', response.status);
    console.log('\nData structure:');
    console.log('- clientId:', response.data.clientId);
    console.log('- year:', response.data.year);
    console.log('- unitCount:', response.data.unitCount);
    console.log('- waterData keys:', Object.keys(response.data.waterData || {}));
    
    if (response.data.waterData) {
      console.log('\nSample unit 101 data:');
      const unit101 = response.data.waterData['101'];
      if (unit101) {
        console.log('  - unitId:', unit101.unitId);
        console.log('  - reading:', unit101.reading);
        console.log('  - priorReading:', unit101.priorReading);
        console.log('  - consumption:', unit101.consumption);
        console.log('  - amount:', unit101.amount);
        console.log('  - paid:', unit101.paid);
      }
      
      console.log('\nAll units with readings:');
      Object.entries(response.data.waterData).forEach(([unitId, data]) => {
        console.log(`  Unit ${unitId}: reading=${data.reading}, consumption=${data.consumption}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testBridgeEndpoint();
#!/usr/bin/env node

import { createApiClient } from './testHarness.js';

async function testBackendArrays() {
  try {
    const api = await createApiClient('fjXv8gX1CYWBvOZ1CS27j96oRCT2');
    
    const response = await api.get('/api/clients/AVII/watermeters/all/2026');
    console.log('✅ Status:', response.status);
    console.log('✅ Unit count:', response.data.unitCount);
    
    if (response.data.waterData && response.data.waterData['101']) {
      const unit101 = response.data.waterData['101'];
      console.log('\nUnit 101 structure:');
      console.log('  - Has readings array:', Array.isArray(unit101.readings));
      console.log('  - Readings count:', unit101.readings?.length || 0);
      console.log('  - Has bills array:', Array.isArray(unit101.bills));
      console.log('  - Bills count:', unit101.bills?.length || 0);
      
      if (unit101.readings && unit101.readings.length > 0) {
        console.log('\n  Sample readings:');
        unit101.readings.slice(0, 3).forEach((r, i) => {
          console.log(`    Month ${i + 1}: reading=${r.reading}, hasDate=${!!r.date}`);
        });
      }
      
      if (unit101.bills && unit101.bills.length > 0) {
        console.log('\n  Sample bills:');
        unit101.bills.slice(0, 3).forEach((b, i) => {
          console.log(`    Bill ${i + 1}: amount=${b.amount}, paid=${b.paid}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBackendArrays();
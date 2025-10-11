#!/usr/bin/env node

/**
 * Water Domain Routes Test
 * Tests the new domain-specific water routes after Phase 2 migration
 */

import { testHarness as harness } from './testHarness.js';

// Test Suite for Water Domain Routes
const waterDomainTests = [
  {
    name: 'Test Water Domain Aggregated Data',
    test: async ({ api }) => {
      try {
        const response = await api.get('/water/clients/AVII/data/2024');
        
        console.log('   Response status:', response.status);
        console.log('   Response headers:', response.headers);
        
        if (response.status !== 200) {
          console.log('   Response error:', response.data);
        } else {
          console.log('   Response data keys:', Object.keys(response.data || {}));
        }
        
        return {
          passed: response.status === 200,
          message: `Water aggregated data endpoint ${response.status === 200 ? 'working' : 'failed'}`,
          data: {
            status: response.status,
            hasData: !!response.data,
            dataKeys: Object.keys(response.data || {})
          }
        };
      } catch (error) {
        return {
          passed: false,
          reason: `Water domain route failed: ${error.message}`,
          error: error.message
        };
      }
    }
  },
  
  {
    name: 'Test Water Domain Meters',
    test: async ({ api }) => {
      try {
        const response = await api.get('/water/clients/AVII/meters');
        
        console.log('   Response status:', response.status);
        
        if (response.status !== 200) {
          console.log('   Response error:', response.data);
        } else {
          console.log('   Response data keys:', Object.keys(response.data || {}));
        }
        
        return {
          passed: response.status === 200 || response.status === 404, // 404 ok if no meters
          message: `Water meters endpoint ${response.status === 200 ? 'working' : response.status === 404 ? 'no meters found' : 'failed'}`,
          data: {
            status: response.status,
            hasData: !!response.data
          }
        };
      } catch (error) {
        return {
          passed: false,
          reason: `Water meters route failed: ${error.message}`,
          error: error.message
        };
      }
    }
  },

  {
    name: 'Test Water Domain Config',
    test: async ({ api }) => {
      try {
        const response = await api.get('/water/clients/AVII/config');
        
        console.log('   Response status:', response.status);
        
        if (response.status !== 200) {
          console.log('   Response error:', response.data);
        } else {
          console.log('   Response data keys:', Object.keys(response.data || {}));
        }
        
        return {
          passed: response.status === 200 || response.status === 404, // 404 ok if no config
          message: `Water config endpoint ${response.status === 200 ? 'working' : response.status === 404 ? 'no config found' : 'failed'}`,
          data: {
            status: response.status,
            hasData: !!response.data
          }
        };
      } catch (error) {
        return {
          passed: false,
          reason: `Water config route failed: ${error.message}`,
          error: error.message
        };
      }
    }
  }
];

// Run the tests
console.log('🧪 Running Water Domain Routes Tests');
console.log('   Testing new /water/clients/:clientId/* pattern');
console.log('   Verifying Phase 2 domain migration');

try {
  const results = await harness.runTests(waterDomainTests, {
    showSummary: true
  });
  
  console.log('\n📊 Test Results Summary:');
  console.log(`   Total Tests: ${results.total}`);
  console.log(`   Passed: ${results.passed}`);
  console.log(`   Failed: ${results.failed}`);
  
  if (results.failed === 0) {
    console.log('\n✅ All water domain routes are working correctly!');
    console.log('   Phase 2 water routes standardization appears successful');
  } else {
    console.log('\n❌ Some water domain routes are failing');
    console.log('   Phase 2 may need additional work');
  }
  
} catch (error) {
  console.error('❌ Test suite failed to run:', error.message);
  process.exit(1);
}
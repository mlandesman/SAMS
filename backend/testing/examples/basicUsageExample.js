#!/usr/bin/env node

import { testHarness, quickApiTest } from '../testHarness.js';

/**
 * Basic Usage Example - Simple tests to demonstrate the test harness
 */

async function runBasicTests() {
  console.log('🎯 Basic Test Harness Usage Examples\n');

  // Example 1: Simple API endpoint test
  await testHarness.runTest({
    name: 'Test Health Endpoint',
    async test({ api }) {
      const response = await api.get('/api/clients/test');
      
      return {
        passed: response.status === 200,
        data: response.data,
        message: 'Health check endpoint working'
      };
    }
  });

  // Example 2: Test user profile
  await testHarness.runTest({
    name: 'Get User Profile',
    async test({ api, userId }) {
      const response = await api.get('/api/user/profile');
      
      const success = response.data?.success === true;
      
      return {
        passed: success,
        data: response.data,
        message: success ? `Profile loaded for ${userId}` : 'Profile load failed'
      };
    }
  });

  // Example 3: Test with different user (if you have another test UID)
  await testHarness.runTest({
    name: 'Test with Default User',
    testUser: 'fjXv8gX1CYWBvOZ1CS27j96oRCT2', // explicit user
    async test({ api, userId }) {
      const response = await api.get('/api/user/clients');
      
      return {
        passed: response.status === 200,
        data: response.data,
        message: `Clients loaded for user ${userId}`
      };
    }
  });

  // Example 4: Using the quick API test helper
  await quickApiTest('Quick Health Check', '/api/clients/test');

  // Show summary
  testHarness.showSummary();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBasicTests()
    .then(() => {
      console.log('\n✅ Basic examples completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Basic examples failed:', error);
      process.exit(1);
    });
}

export { runBasicTests };
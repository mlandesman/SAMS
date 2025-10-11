#!/usr/bin/env node

/**
 * Authentication User Routes Test
 * Tests the new /auth/user routes after Phase 3 migration
 */

import { testHarness as harness } from './testHarness.js';

// Test Suite for Auth User Routes
const authUserTests = [
  {
    name: 'Test Auth User Profile',
    test: async ({ api }) => {
      try {
        const response = await api.get('/auth/user/profile');
        
        console.log('   Response status:', response.status);
        
        if (response.status !== 200) {
          console.log('   Response error:', response.data);
        } else {
          console.log('   Response data keys:', Object.keys(response.data || {}));
          console.log('   Has user info:', !!response.data?.data?.profile);
        }
        
        return {
          passed: response.status === 200,
          message: `Auth user profile endpoint ${response.status === 200 ? 'working' : 'failed'}`,
          data: {
            status: response.status,
            hasData: !!response.data,
            hasProfile: !!response.data?.data?.profile
          }
        };
      } catch (error) {
        return {
          passed: false,
          reason: `Auth user profile route failed: ${error.message}`,
          error: error.message
        };
      }
    }
  },
  
  {
    name: 'Test Auth User Clients',
    test: async ({ api }) => {
      try {
        const response = await api.get('/auth/user/clients');
        
        console.log('   Response status:', response.status);
        
        if (response.status !== 200) {
          console.log('   Response error:', response.data);
        } else {
          console.log('   Response data keys:', Object.keys(response.data || {}));
          console.log('   Has clients:', !!response.data?.data?.clients);
          console.log('   Clients count:', response.data?.data?.clients?.length || 0);
        }
        
        return {
          passed: response.status === 200,
          message: `Auth user clients endpoint ${response.status === 200 ? 'working' : 'failed'}`,
          data: {
            status: response.status,
            hasData: !!response.data,
            clientsCount: response.data?.data?.clients?.length || 0
          }
        };
      } catch (error) {
        return {
          passed: false,
          reason: `Auth user clients route failed: ${error.message}`,
          error: error.message
        };
      }
    }
  },

  {
    name: 'Test Legacy API User Route (Should Fail)',
    test: async ({ api }) => {
      try {
        const response = await api.get('/api/user/profile');
        
        console.log('   Response status:', response.status);
        
        // This should fail since we moved the route
        return {
          passed: response.status === 404,
          message: `Legacy /api/user route ${response.status === 404 ? 'properly removed' : 'still exists'}`,
          data: {
            status: response.status,
            shouldBe404: true
          }
        };
      } catch (error) {
        // 404 error is expected and good
        if (error.message.includes('404')) {
          return {
            passed: true,
            message: 'Legacy /api/user route properly removed (404)',
            data: { status: 404, shouldBe404: true }
          };
        }
        
        return {
          passed: false,
          reason: `Unexpected error testing legacy route: ${error.message}`,
          error: error.message
        };
      }
    }
  }
];

// Run the tests
console.log('🧪 Running Auth User Routes Tests');
console.log('   Testing new /auth/user/* pattern');
console.log('   Verifying Phase 3 user management migration');

try {
  const results = await harness.runTests(authUserTests, {
    showSummary: true
  });
  
  console.log('\n📊 Test Results Summary:');
  console.log(`   Total Tests: ${results.total}`);
  console.log(`   Passed: ${results.passed}`);
  console.log(`   Failed: ${results.failed}`);
  
  if (results.failed === 0) {
    console.log('\n✅ All auth user routes are working correctly!');
    console.log('   Phase 3 user management migration appears successful');
  } else {
    console.log('\n❌ Some auth user routes are failing');
    console.log('   Phase 3 may need additional work');
  }
  
} catch (error) {
  console.error('❌ Test suite failed to run:', error.message);
  process.exit(1);
}
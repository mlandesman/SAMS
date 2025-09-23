#!/usr/bin/env node

import { testHarness } from './testHarness.js';

/**
 * Test the HOA Dashboard endpoint that was migrated from legacy route
 */

async function testHOADashboardEndpoint() {
  console.log('🎯 Testing HOA Dashboard Endpoint Migration\n');

  // Test the migrated HOA endpoint
  await testHarness.runTest({
    name: 'Test HOA Dues Endpoint - Dashboard Data',
    async test({ api }) {
      const currentYear = new Date().getFullYear();
      const clientId = 'MTC'; // Default test client
      
      console.log(`Testing: /hoadues/${clientId}/year/${currentYear}`);
      
      const response = await api.get(`/hoadues/${clientId}/year/${currentYear}`);
      
      const success = response.status === 200;
      const hasData = response.data && typeof response.data === 'object';
      
      return {
        passed: success && hasData,
        data: response.data,
        message: success 
          ? `HOA data loaded successfully for ${clientId} year ${currentYear}` 
          : `Failed to load HOA data: ${response.status}`
      };
    }
  });

  // Test that legacy endpoint no longer exists
  await testHarness.runTest({
    name: 'Verify Legacy Endpoint Removed',
    async test({ api }) {
      const currentYear = new Date().getFullYear();
      const clientId = 'MTC';
      
      console.log(`Testing legacy route should fail: /clients/${clientId}/hoadues/year/${currentYear}`);
      
      try {
        const response = await api.get(`/clients/${clientId}/hoadues/year/${currentYear}`);
        
        return {
          passed: response.status === 404,
          data: { status: response.status },
          message: response.status === 404 
            ? 'Legacy endpoint correctly removed (404)' 
            : `Legacy endpoint still exists: ${response.status}`
        };
      } catch (error) {
        return {
          passed: error.response?.status === 404,
          data: { error: error.message, status: error.response?.status },
          message: error.response?.status === 404 
            ? 'Legacy endpoint correctly removed (404)' 
            : `Unexpected error: ${error.message}`
        };
      }
    }
  });

  // Show summary
  testHarness.showSummary();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testHOADashboardEndpoint()
    .then(() => {
      console.log('\n✅ HOA Dashboard endpoint tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ HOA Dashboard endpoint tests failed:', error);
      process.exit(1);
    });
}

export { testHOADashboardEndpoint };
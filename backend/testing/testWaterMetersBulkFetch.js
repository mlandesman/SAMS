import { testHarness } from './testHarness.js';
import { tokenManager } from './tokenManager.js';

async function main() {
  console.log('🌊 Testing Water Meters Bulk Fetch Endpoint\n');
  
  const adminUid = 'michael@landesman.com';
  
  // Test the bulk fetch endpoint
  await testHarness.runTest({
    name: 'Test Water Meters Bulk Fetch - /all/:year',
    testUser: adminUid,
    async test({ api, token }) {
      console.log(`   Using token: ${token.substring(0, 30)}...`);
      
      // Test the bulk fetch endpoint
      const response = await api.request({
        method: 'GET',
        url: '/api/clients/AVII/watermeters/all/2025',
        validateStatus: () => true
      });
      
      console.log(`   Response Status: ${response.status}`);
      console.log(`   Response Data:`, JSON.stringify(response.data, null, 2).substring(0, 500));
      
      const passed = response.status === 200;
      
      return {
        passed: passed,
        actualStatus: response.status,
        data: response.data,
        message: passed ? 
          `Successfully fetched water data for year 2025` : 
          `Failed to fetch water data: ${response.status} - ${JSON.stringify(response.data)}`
      };
    }
  });
  
  // Print summary
  const results = testHarness.getResults();
  console.log('\n📊 Test Summary:');
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed}`);
  console.log(`Failed: ${results.summary.failed}`);
}

main().catch(console.error);
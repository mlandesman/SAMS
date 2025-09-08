import { testHarness } from './testHarness.js';
import { tokenManager } from './tokenManager.js';

async function main() {
  console.log('🌊 Testing Water Meters with SuperAdmin Access\n');
  
  // Use the SuperAdmin UID directly
  const superAdminUid = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
  
  // Test with SuperAdmin token
  await testHarness.runTest({
    name: 'Test Water Meters Bulk Fetch as SuperAdmin',
    testUser: superAdminUid,
    async test({ api, token }) {
      console.log(`   Using SuperAdmin token: ${token.substring(0, 30)}...`);
      
      // First, verify we're SuperAdmin by checking clients list
      const clientsResponse = await api.request({
        method: 'GET',
        url: '/api/clients',
        validateStatus: () => true
      });
      
      console.log(`   Clients List Status: ${clientsResponse.status}`);
      console.log(`   Available Clients:`, JSON.stringify(clientsResponse.data, null, 2).substring(0, 300));
      
      // Now test the water meters bulk fetch for AVII
      const response = await api.request({
        method: 'GET',
        url: '/api/clients/AVII/watermeters/all/2025',
        validateStatus: () => true
      });
      
      console.log(`\n   Water Meters Response Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log(`   ✅ Success! Data structure:`);
        console.log(`   - clientId: ${response.data?.clientId}`);
        console.log(`   - year: ${response.data?.year}`);
        console.log(`   - unitCount: ${response.data?.unitCount}`);
        console.log(`   - dataFetched: ${response.data?.dataFetched}`);
        console.log(`   - waterData keys: ${response.data?.waterData ? Object.keys(response.data.waterData).slice(0, 5).join(', ') : 'none'}...`);
      } else {
        console.log(`   ❌ Error: ${JSON.stringify(response.data)}`);
      }
      
      return {
        passed: response.status === 200,
        actualStatus: response.status,
        data: response.data,
        message: response.status === 200 ? 
          `Successfully fetched water data for AVII year 2025` : 
          `Failed: ${response.status} - ${JSON.stringify(response.data)}`
      };
    }
  });
}

main().catch(console.error);
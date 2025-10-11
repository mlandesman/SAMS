import { testHarness } from './testHarness.js';
import { tokenManager } from './tokenManager.js';

async function main() {
  console.log('🌊 Testing Water Meters with Proper Access\n');
  
  const adminUid = 'michael@landesman.com';
  
  // First get available clients
  await testHarness.runTest({
    name: 'Get Available Clients',
    testUser: adminUid,
    async test({ api, token }) {
      console.log(`   Using token: ${token.substring(0, 30)}...`);
      
      // Get list of clients
      const response = await api.request({
        method: 'GET',
        url: '/api/clients',
        validateStatus: () => true
      });
      
      console.log(`   Response Status: ${response.status}`);
      console.log(`   Available Clients:`, JSON.stringify(response.data, null, 2));
      
      // If we have clients, test the first one
      if (response.status === 200 && response.data?.clients?.length > 0) {
        const clientId = response.data.clients[0].id || response.data.clients[0].clientId;
        console.log(`\n   Testing with client: ${clientId}`);
        
        // Test water meters endpoint for this client
        const waterResponse = await api.request({
          method: 'GET',
          url: `/api/clients/${clientId}/watermeters/all/2025`,
          validateStatus: () => true
        });
        
        console.log(`   Water Meters Response Status: ${waterResponse.status}`);
        console.log(`   Water Data:`, JSON.stringify(waterResponse.data, null, 2).substring(0, 500));
        
        return {
          passed: waterResponse.status === 200,
          actualStatus: waterResponse.status,
          clientId: clientId,
          data: waterResponse.data,
          message: waterResponse.status === 200 ? 
            `Successfully fetched water data for ${clientId}` : 
            `Failed to fetch water data: ${waterResponse.status} - ${JSON.stringify(waterResponse.data)}`
        };
      }
      
      return {
        passed: false,
        message: 'No clients available for testing'
      };
    }
  });
}

main().catch(console.error);
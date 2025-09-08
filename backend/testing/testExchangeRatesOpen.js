/**
 * Test exchange rates endpoints to verify they work without authentication
 * This tests the hypothesis that exchange rates should be open/public endpoints
 */

const API_BASE_URL = 'http://localhost:5001';

async function testOpenEndpoints() {
  console.log('🧪 Testing Exchange Rates Endpoints (No Auth Required)');
  console.log('================================================\n');

  const endpoints = [
    { url: `/api/exchange-rates/check`, method: 'GET', name: 'Check Today\'s Rates' },
    { url: `/api/exchange-rates/`, method: 'GET', name: 'Get All Rates' },
    { url: `/api/exchange-rates/date/2025-08-12`, method: 'GET', name: 'Get Rates for Specific Date' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing: ${endpoint.name}`);
      console.log(`   ${endpoint.method} ${API_BASE_URL}${endpoint.url}`);
      
      const response = await fetch(`${API_BASE_URL}${endpoint.url}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json'
        }
        // Deliberately NO Authorization header to test open access
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 200) {
        const data = await response.json();
        console.log(`   ✅ SUCCESS - Response:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unable to parse error response' }));
        console.log(`   ❌ FAILED - Error:`, errorData);
      }
      
    } catch (error) {
      console.log(`   💥 NETWORK ERROR:`, error.message);
    }
    console.log('');
  }
  
  console.log('🏁 Test Complete');
}

// Run the test
testOpenEndpoints().catch(console.error);
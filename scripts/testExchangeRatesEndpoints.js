/**
 * Test script for Exchange Rates endpoints
 * This script tests the backend endpoints that the frontend will use
 */

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5001';

async function testEndpoint(endpoint, method = 'GET', body = null) {
  try {
    console.log(`\n🧪 Testing ${method} ${endpoint}`);
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const result = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    console.error(`❌ Error testing ${endpoint}:`, error.message);
    return { error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Testing Exchange Rates Backend Endpoints\n');
  
  // Test 1: Check endpoint
  await testEndpoint('/api/exchange-rates/check');
  
  // Test 2: Daily update endpoint
  await testEndpoint('/api/exchange-rates/daily-update', 'POST');
  
  // Test 3: Manual update with dry-run
  await testEndpoint('/api/exchange-rates/manual-update', 'POST', {
    mode: 'fill-gaps',
    dryRun: true,
    startDate: '2025-06-01',
    endDate: '2025-06-11'
  });
  
  // Test 4: Quick update
  await testEndpoint('/api/exchange-rates/manual-update', 'POST', {
    mode: 'quick'
  });
  
  console.log('\n✅ All endpoint tests completed!');
}

// Run the tests
runTests().catch(console.error);

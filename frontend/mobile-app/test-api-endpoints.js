/**
 * Test script for new Water API endpoints
 * Tests: getBillsForYear(), getBillsForMonth(), getBillingConfig()
 * 
 * Run with: node test-api-endpoints.js
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5001';
const CLIENT_ID = 'AVII';
const TEST_YEAR = 2026;
const TEST_MONTH = 0; // July (fiscal month 0)

// You'll need to replace this with a valid Firebase auth token
// Get it from your browser DevTools > Application > IndexedDB > firebaseLocalStorage
const AUTH_TOKEN = process.env.FIREBASE_TOKEN || 'YOUR_TOKEN_HERE';

/**
 * Test GET /water/clients/:clientId/bills/:year
 */
async function testGetBillsForYear() {
  console.log('\n📊 Testing GET /water/clients/:clientId/bills/:year');
  console.log(`URL: ${BASE_URL}/water/clients/${CLIENT_ID}/bills/${TEST_YEAR}`);
  
  try {
    const response = await fetch(
      `${BASE_URL}/water/clients/${CLIENT_ID}/bills/${TEST_YEAR}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS');
      console.log(`   Months received: ${result.data?.months?.length || 0}`);
      console.log(`   Summary exists: ${result.data?.summary ? 'Yes' : 'No'}`);
      console.log(`   Car wash rate: ${result.data?.carWashRate}`);
      console.log(`   Boat wash rate: ${result.data?.boatWashRate}`);
      
      if (result.data?.months?.length > 0) {
        const firstMonth = result.data.months[0];
        console.log(`   First month structure: year=${firstMonth.year}, month=${firstMonth.month}`);
        console.log(`   First month units count: ${Object.keys(firstMonth.units || {}).length}`);
      }
      
      return { success: true, data: result };
    } else {
      console.log('❌ FAILED');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${result.error || result.message}`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ ERROR');
    console.log(`   ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test GET /water/clients/:clientId/bills/:year/:month
 */
async function testGetBillsForMonth() {
  console.log('\n📅 Testing GET /water/clients/:clientId/bills/:year/:month');
  console.log(`URL: ${BASE_URL}/water/clients/${CLIENT_ID}/bills/${TEST_YEAR}/${TEST_MONTH}`);
  
  try {
    const response = await fetch(
      `${BASE_URL}/water/clients/${CLIENT_ID}/bills/${TEST_YEAR}/${TEST_MONTH}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS');
      console.log(`   Bills received: ${Object.keys(result.data || {}).length}`);
      
      if (result.data && Object.keys(result.data).length > 0) {
        const firstUnit = Object.keys(result.data)[0];
        const firstBill = result.data[firstUnit];
        console.log(`   Sample unit: ${firstUnit}`);
        console.log(`   Sample bill: totalAmount=${firstBill.totalAmount}, status=${firstBill.status}`);
      }
      
      return { success: true, data: result };
    } else {
      console.log('❌ FAILED');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${result.error || result.message}`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ ERROR');
    console.log(`   ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test GET /water/clients/:clientId/config
 */
async function testGetBillingConfig() {
  console.log('\n⚙️  Testing GET /water/clients/:clientId/config');
  console.log(`URL: ${BASE_URL}/water/clients/${CLIENT_ID}/config`);
  
  try {
    const response = await fetch(
      `${BASE_URL}/water/clients/${CLIENT_ID}/config`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS');
      console.log(`   Water rate per m³: ${result.data?.ratePerCubicMeter}`);
      console.log(`   Car wash rate: ${result.data?.carWashRate}`);
      console.log(`   Boat wash rate: ${result.data?.boatWashRate}`);
      console.log(`   Penalty percentage: ${result.data?.penaltyPercentage}`);
      console.log(`   Penalty starts (days): ${result.data?.penaltyStartsDays}`);
      
      return { success: true, data: result };
    } else {
      console.log('❌ FAILED');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${result.error || result.message}`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.log('❌ ERROR');
    console.log(`   ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Water API Endpoint Tests');
  console.log('=============================');
  console.log(`Backend: ${BASE_URL}`);
  console.log(`Client: ${CLIENT_ID}`);
  console.log(`Test Year: ${TEST_YEAR}`);
  console.log(`Test Month: ${TEST_MONTH}`);
  
  if (AUTH_TOKEN === 'YOUR_TOKEN_HERE') {
    console.log('\n⚠️  WARNING: No Firebase token provided!');
    console.log('Set FIREBASE_TOKEN environment variable or update AUTH_TOKEN in script');
    console.log('Example: FIREBASE_TOKEN=your_token node test-api-endpoints.js');
    return;
  }
  
  const results = [];
  
  // Test 1: Get Bills for Year
  results.push(await testGetBillsForYear());
  
  // Test 2: Get Bills for Month
  results.push(await testGetBillsForMonth());
  
  // Test 3: Get Billing Config
  results.push(await testGetBillingConfig());
  
  // Summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('================');
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Mobile PWA API layer is ready.');
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above.');
  }
}

// Run tests
runTests().catch(console.error);




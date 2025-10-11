#!/usr/bin/env node

/**
 * CORRECTED Water Meter API Test
 * Using actual backend route definitions
 */

import { createApiClient } from './apiClient.js';

async function testWaterMeterAPIs() {
  console.log('===========================================');
  console.log('CORRECTED WATER METER API TEST');
  console.log('===========================================\n');
  
  const results = [];
  
  try {
    // Create authenticated API client
    const api = await createApiClient();
    console.log('✅ Authentication successful\n');
    
    // Test 1: Fetch Unit Water Meter (CORRECTED ENDPOINT)
    console.log('TEST 1: Fetch Unit Water Meter');
    try {
      const response = await api.get('/api/clients/AVII/watermeters/unit/101');
      results.push({
        test: 'Fetch Unit Water Meter',
        status: 'PASS',
        code: response.status,
        data: `Got meter for unit 101`
      });
      console.log(`  ✅ PASS - Status ${response.status}`);
      console.log(`  📊 Data:`, JSON.stringify(response.data).substring(0, 100));
    } catch (error) {
      results.push({
        test: 'Fetch Unit Water Meter',
        status: 'FAIL',
        code: error.response?.status || 0,
        error: error.response?.data?.error || error.message
      });
      console.log(`  ❌ FAIL - ${error.response?.status || 'Error'}`);
    }
    
    // Test 2: Fetch Latest Readings (THIS ONE WORKS)
    console.log('\nTEST 2: Fetch Latest Readings');
    try {
      const response = await api.get('/api/clients/AVII/watermeters/readings/latest');
      const readingCount = response.data?.readings ? 
        (Array.isArray(response.data.readings) ? response.data.readings.length : Object.keys(response.data.readings).length) : 0;
      results.push({
        test: 'Fetch Latest Readings',
        status: 'PASS',
        code: response.status,
        data: `Found ${readingCount} readings`
      });
      console.log(`  ✅ PASS - Status ${response.status}`);
      console.log(`  📊 Data: ${readingCount} readings found`);
    } catch (error) {
      results.push({
        test: 'Fetch Latest Readings',
        status: 'FAIL',
        code: error.response?.status || 0,
        error: error.message
      });
      console.log(`  ❌ FAIL - ${error.response?.status || 'Error'}`);
    }
    
    // Test 3: Submit Batch Readings
    console.log('\nTEST 3: Submit Batch Readings');
    try {
      const testData = {
        clientId: 'AVII',
        readings: [
          { unitId: '101', reading: 12345, notes: 'Test' },
          { unitId: '102', reading: 23456, notes: 'Test' }
        ],
        readingDate: new Date().toISOString().split('T')[0]
      };
      
      const response = await api.post('/api/clients/AVII/watermeters/readings', testData);
      results.push({
        test: 'Submit Batch Readings',
        status: 'PASS',
        code: response.status,
        data: `Saved ${response.data?.saved?.length || 0} readings`
      });
      console.log(`  ✅ PASS - Status ${response.status}`);
      console.log(`  📊 Data: ${response.data?.saved?.length || 0} readings saved`);
    } catch (error) {
      results.push({
        test: 'Submit Batch Readings',
        status: 'FAIL',
        code: error.response?.status || 0,
        error: error.response?.data?.error || error.message
      });
      console.log(`  ❌ FAIL - ${error.response?.status || 'Error'}`);
      if (error.response?.status === 500) {
        console.log(`  🐛 Backend Bug: ${error.message}`);
      }
    }
    
    // Test 4: Generate Bills (CORRECTED FIELD NAMES)
    console.log('\nTEST 4: Generate Water Bills (Corrected)');
    try {
      const testData = {
        clientId: 'AVII',
        year: 2025,  // CORRECTED: Using year as number
        month: 8,    // CORRECTED: Using month as number
        dueDate: '2025-09-08'
      };
      
      console.log('  📝 Sending:', JSON.stringify(testData));
      
      const response = await api.post('/api/clients/AVII/watermeters/bills/generate', testData);
      results.push({
        test: 'Generate Water Bills',
        status: 'PASS',
        code: response.status,
        data: `Generated ${response.data?.bills?.length || 0} bills`
      });
      console.log(`  ✅ PASS - Status ${response.status}`);
      console.log(`  📊 Data: ${response.data?.bills?.length || 0} bills generated`);
    } catch (error) {
      results.push({
        test: 'Generate Water Bills',
        status: 'FAIL',
        code: error.response?.status || 0,
        error: error.response?.data?.error || error.message
      });
      console.log(`  ❌ FAIL - ${error.response?.status || 'Error'}`);
      if (error.response?.data) {
        console.log(`  📝 Error Details:`, JSON.stringify(error.response.data));
      }
    }
    
    // Test 5: Fetch Bills for Year (CORRECTED ENDPOINT)
    console.log('\nTEST 5: Fetch Water Bills for 2025');
    try {
      const response = await api.get('/api/clients/AVII/watermeters/bills/2025');
      results.push({
        test: 'Fetch Water Bills by Year',
        status: 'PASS',
        code: response.status,
        data: `Found ${response.data?.bills?.length || 0} bills for 2025`
      });
      console.log(`  ✅ PASS - Status ${response.status}`);
      console.log(`  📊 Data: ${response.data?.bills?.length || 0} bills found`);
    } catch (error) {
      results.push({
        test: 'Fetch Water Bills by Year',
        status: 'FAIL',
        code: error.response?.status || 0,
        error: error.message
      });
      console.log(`  ❌ FAIL - ${error.response?.status || 'Error'}`);
    }
    
    // Test 6: Fetch Monthly Readings (NEW TEST)
    console.log('\nTEST 6: Fetch Monthly Readings');
    try {
      const response = await api.get('/api/clients/AVII/watermeters/readings/2025/8');
      results.push({
        test: 'Fetch Monthly Readings',
        status: 'PASS',
        code: response.status,
        data: `Found readings for Aug 2025`
      });
      console.log(`  ✅ PASS - Status ${response.status}`);
      console.log(`  📊 Data:`, JSON.stringify(response.data).substring(0, 100));
    } catch (error) {
      results.push({
        test: 'Fetch Monthly Readings',
        status: 'FAIL',
        code: error.response?.status || 0,
        error: error.message
      });
      console.log(`  ❌ FAIL - ${error.response?.status || 'Error'}`);
    }
    
    // Test 7: Get Outstanding Balances (NEW TEST)
    console.log('\nTEST 7: Get Outstanding Balances');
    try {
      const response = await api.get('/api/clients/AVII/watermeters/outstanding');
      results.push({
        test: 'Get Outstanding Balances',
        status: 'PASS',
        code: response.status,
        data: `Got outstanding balances`
      });
      console.log(`  ✅ PASS - Status ${response.status}`);
      console.log(`  📊 Data:`, JSON.stringify(response.data).substring(0, 100));
    } catch (error) {
      results.push({
        test: 'Get Outstanding Balances',
        status: 'FAIL',
        code: error.response?.status || 0,
        error: error.message
      });
      console.log(`  ❌ FAIL - ${error.response?.status || 'Error'}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test setup failed:', error.message);
    return;
  }
  
  // Summary
  console.log('\n===========================================');
  console.log('TEST SUMMARY');
  console.log('===========================================\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed/total)*100).toFixed(0)}%`);
  
  // Detailed Results Table
  console.log('\n📊 DETAILED RESULTS:');
  console.log('─'.repeat(70));
  results.forEach(r => {
    const status = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${status} ${r.test.padEnd(30)} | Status: ${r.code || 'N/A'}`);
    if (r.data) console.log(`   └─ ${r.data}`);
    if (r.error) console.log(`   └─ Error: ${r.error}`);
  });
  
  // Manager Summary
  console.log('\n===========================================');
  console.log('CORRECTED TEST RESULTS FOR MANAGER');
  console.log('===========================================\n');
  
  console.log('CORRECTIONS MADE:');
  console.log('  1. ✅ Using /unit/:unitId instead of /watermeters');
  console.log('  2. ✅ Using /bills/:year instead of /bills');
  console.log('  3. ✅ Sending year/month as numbers instead of billingMonth');
  console.log('  4. ✅ Added tests for monthly readings and outstanding balances');
  
  console.log('\nKNOWN ISSUES:');
  console.log('  1. 🐛 Backend validation bug in requestValidator.js line 60');
  console.log('     - Error: Cannot read properties of undefined (reading toString)');
  console.log('     - This prevents submitting new readings');
  
  if (passed === total) {
    console.log('\n✅ ALL TESTS PASSED - APIs working correctly');
  } else {
    console.log(`\n⚠️ ${failed} of ${total} tests failed - See details above`);
  }
  
  console.log('\n===========================================\n');
}

// Run the test
testWaterMeterAPIs().catch(console.error);
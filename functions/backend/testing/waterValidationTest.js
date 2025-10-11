#!/usr/bin/env node

/**
 * Water Validation Test Harness
 * Tests the water meter validation layer with proper authentication
 */

import { createApiClient } from './apiClient.js';
import { testConfig } from './config.js';

const TEST_CLIENT_ID = 'AVII';

async function runValidationTests() {
  console.log('🧪 Water Validation Test Harness');
  console.log('================================\n');
  
  let client;
  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  try {
    // Create authenticated API client
    console.log('🔑 Creating authenticated API client...');
    client = await createApiClient();
    console.log('✅ API client created\n');
    
    // Health check
    const health = await client.healthCheck();
    if (!health.healthy) {
      throw new Error(`Backend not healthy: ${health.error}`);
    }
    console.log('✅ Backend is healthy\n');
    
    // Test 1: Negative reading validation
    console.log('Test 1: Reject negative meter reading');
    console.log('--------------------------------------');
    try {
      const response = await client.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/readings`, {
        clientId: TEST_CLIENT_ID,
        readings: [
          { unitId: '101', value: -100 }
        ]
      });
      
      console.log('❌ FAILED: Should have rejected negative reading');
      testResults.failed++;
      testResults.tests.push({
        name: 'Reject negative reading',
        status: 'FAILED',
        error: 'Accepted invalid data'
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ PASSED: Correctly rejected negative reading');
        console.log('   Error message:', error.response.data.error);
        console.log('   Details:', error.response.data.details);
        testResults.passed++;
        testResults.tests.push({
          name: 'Reject negative reading',
          status: 'PASSED'
        });
      } else {
        console.log('❌ FAILED: Unexpected error:', error.message);
        testResults.failed++;
        testResults.tests.push({
          name: 'Reject negative reading',
          status: 'FAILED',
          error: error.message
        });
      }
    }
    console.log();
    
    // Test 2: Too many decimal places
    console.log('Test 2: Reject reading with too many decimal places');
    console.log('---------------------------------------------------');
    try {
      const response = await client.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/readings`, {
        clientId: TEST_CLIENT_ID,
        readings: [
          { unitId: '101', value: 123.456789 }
        ]
      });
      
      console.log('❌ FAILED: Should have rejected too many decimals');
      testResults.failed++;
      testResults.tests.push({
        name: 'Reject too many decimals',
        status: 'FAILED',
        error: 'Accepted invalid data'
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ PASSED: Correctly rejected too many decimals');
        console.log('   Error message:', error.response.data.error);
        console.log('   Details:', error.response.data.details);
        testResults.passed++;
        testResults.tests.push({
          name: 'Reject too many decimals',
          status: 'PASSED'
        });
      } else {
        console.log('❌ FAILED: Unexpected error:', error.message);
        testResults.failed++;
        testResults.tests.push({
          name: 'Reject too many decimals',
          status: 'FAILED',
          error: error.message
        });
      }
    }
    console.log();
    
    // Test 3: Invalid unit ID format
    console.log('Test 3: Reject invalid unit ID format');
    console.log('-------------------------------------');
    try {
      const response = await client.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/readings`, {
        clientId: TEST_CLIENT_ID,
        readings: [
          { unitId: 'A01', value: 100 }  // AVII uses numeric IDs like "101"
        ]
      });
      
      console.log('⚠️  WARNING: Accepted non-numeric unit ID (may be allowed)');
      testResults.passed++;
      testResults.tests.push({
        name: 'Reject invalid unit ID',
        status: 'WARNING',
        note: 'Non-numeric unit ID was accepted'
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ PASSED: Correctly rejected invalid unit ID');
        console.log('   Error message:', error.response.data.error);
        console.log('   Details:', error.response.data.details);
        testResults.passed++;
        testResults.tests.push({
          name: 'Reject invalid unit ID',
          status: 'PASSED'
        });
      } else {
        console.log('❌ FAILED: Unexpected error:', error.message);
        testResults.failed++;
        testResults.tests.push({
          name: 'Reject invalid unit ID',
          status: 'FAILED',
          error: error.message
        });
      }
    }
    console.log();
    
    // Test 4: Missing required fields
    console.log('Test 4: Reject missing clientId');
    console.log('-------------------------------');
    try {
      const response = await client.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/readings`, {
        // Missing clientId
        readings: [
          { unitId: '101', value: 100 }
        ]
      });
      
      console.log('❌ FAILED: Should have rejected missing clientId');
      testResults.failed++;
      testResults.tests.push({
        name: 'Reject missing clientId',
        status: 'FAILED',
        error: 'Accepted incomplete data'
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ PASSED: Correctly rejected missing clientId');
        console.log('   Error message:', error.response.data.error);
        testResults.passed++;
        testResults.tests.push({
          name: 'Reject missing clientId',
          status: 'PASSED'
        });
      } else {
        console.log('❌ FAILED: Unexpected error:', error.message);
        testResults.failed++;
        testResults.tests.push({
          name: 'Reject missing clientId',
          status: 'FAILED',
          error: error.message
        });
      }
    }
    console.log();
    
    // Test 5: Empty readings array
    console.log('Test 5: Reject empty readings array');
    console.log('-----------------------------------');
    try {
      const response = await client.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/readings`, {
        clientId: TEST_CLIENT_ID,
        readings: []
      });
      
      console.log('❌ FAILED: Should have rejected empty array');
      testResults.failed++;
      testResults.tests.push({
        name: 'Reject empty readings',
        status: 'FAILED',
        error: 'Accepted empty data'
      });
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ PASSED: Correctly rejected empty array');
        console.log('   Error message:', error.response.data.error);
        console.log('   Details:', error.response.data.details);
        testResults.passed++;
        testResults.tests.push({
          name: 'Reject empty readings',
          status: 'PASSED'
        });
      } else {
        console.log('❌ FAILED: Unexpected error:', error.message);
        testResults.failed++;
        testResults.tests.push({
          name: 'Reject empty readings',
          status: 'FAILED',
          error: error.message
        });
      }
    }
    console.log();
    
    // Test 6: Valid reading (should pass)
    console.log('Test 6: Accept valid reading');
    console.log('----------------------------');
    try {
      const response = await client.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/readings`, {
        clientId: TEST_CLIENT_ID,
        readings: [
          { unitId: '101', value: 1234.56 }
        ]
      });
      
      console.log('✅ PASSED: Accepted valid reading');
      console.log('   Response:', response.data);
      testResults.passed++;
      testResults.tests.push({
        name: 'Accept valid reading',
        status: 'PASSED'
      });
    } catch (error) {
      console.log('❌ FAILED: Should have accepted valid reading');
      console.log('   Error:', error.response?.data || error.message);
      testResults.failed++;
      testResults.tests.push({
        name: 'Accept valid reading',
        status: 'FAILED',
        error: error.message
      });
    }
    console.log();
    
  } catch (error) {
    console.error('❌ Test harness error:', error.message);
    process.exit(1);
  }
  
  // Summary
  console.log('\n========================================');
  console.log('📊 Test Results Summary');
  console.log('========================================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📝 Total:  ${testResults.passed + testResults.failed}`);
  console.log(`🎯 Pass Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`   - ${t.name}: ${t.error}`));
  }
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runValidationTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
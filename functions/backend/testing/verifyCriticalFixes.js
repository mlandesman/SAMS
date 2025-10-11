/**
 * Verify Critical Security Fixes
 * Tests AUTH-011, AUTH-006, and ERROR-006 after fixes
 */

import axios from 'axios';
import { testHarness } from './testHarness.js';

const BASE_URL = 'http://localhost:5001';

async function verifyCriticalFixes() {
  console.log('🔒 Verifying Critical Security Fixes');
  console.log('=====================================\n');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: AUTH-011 - Admin endpoint without authentication
  console.log('📋 Testing AUTH-011: Admin endpoint authentication requirement');
  try {
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/api/admin/enable-unit-management`,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });
    
    const passed = response.status === 401;
    results.total++;
    if (passed) results.passed++; else results.failed++;
    
    results.tests.push({
      id: 'AUTH-011',
      name: 'Admin endpoint without authentication',
      passed,
      expected: 401,
      actual: response.status,
      response: response.data
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data)}`);
    console.log(`   Result: ${passed ? '✅ PASSED - Now properly secured!' : '❌ FAILED - Still vulnerable!'}\n`);
    
  } catch (error) {
    console.error('   Error testing AUTH-011:', error.message);
    results.tests.push({
      id: 'AUTH-011',
      name: 'Admin endpoint without authentication',
      passed: false,
      error: error.message
    });
  }

  // Test 2: AUTH-006 - Token in wrong header field
  console.log('📋 Testing AUTH-006: Token in X-Auth-Token header');
  
  await testHarness.runTest({
    name: 'AUTH-006-RETEST',
    async test({ token }) {
      try {
        // Use raw axios with token in wrong header
        const response = await axios({
          method: 'GET',
          url: `${BASE_URL}/api/user/profile`,
          headers: {
            'X-Auth-Token': token,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true
        });
        
        const passed = response.status === 401;
        results.total++;
        if (passed) results.passed++; else results.failed++;
        
        results.tests.push({
          id: 'AUTH-006',
          name: 'Token in wrong header field',
          passed,
          expected: 401,
          actual: response.status,
          response: response.data
        });
        
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data)}`);
        console.log(`   Result: ${passed ? '✅ PASSED - Tokens in wrong header rejected!' : '❌ FAILED - Still accepting wrong header!'}\n`);
        
        return { passed };
      } catch (error) {
        console.error('   Error testing AUTH-006:', error.message);
        return { passed: false, error: error.message };
      }
    }
  });

  // Test 3: ERROR-006 - Malformed JSON handling
  console.log('📋 Testing ERROR-006: Malformed JSON error response');
  try {
    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}/api/admin/users`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token'
      },
      data: '{invalid json',
      validateStatus: () => true
    });
    
    const passed = response.status === 400 && 
                  response.data.error === 'Invalid JSON format' &&
                  response.data.code === 'INVALID_JSON';
    
    results.total++;
    if (passed) results.passed++; else results.failed++;
    
    results.tests.push({
      id: 'ERROR-006',
      name: 'Malformed JSON error response',
      passed,
      expected: { status: 400, error: 'Invalid JSON format', code: 'INVALID_JSON' },
      actual: { status: response.status, data: response.data }
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data)}`);
    console.log(`   Result: ${passed ? '✅ PASSED - Proper JSON error response!' : '❌ FAILED - Incorrect error format!'}\n`);
    
  } catch (error) {
    console.error('   Error testing ERROR-006:', error.message);
    results.tests.push({
      id: 'ERROR-006',
      name: 'Malformed JSON error response',
      passed: false,
      error: error.message
    });
  }

  // Summary
  console.log('\n🎯 CRITICAL FIX VERIFICATION SUMMARY');
  console.log('=====================================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%\n`);
  
  // Detailed results
  console.log('📊 Detailed Results:');
  results.tests.forEach(test => {
    console.log(`\n${test.id}: ${test.name}`);
    console.log(`   Status: ${test.passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (!test.passed && test.error) {
      console.log(`   Error: ${test.error}`);
    } else if (!test.passed) {
      console.log(`   Expected: ${test.expected}`);
      console.log(`   Actual: ${test.actual}`);
    }
  });
  
  // Security assessment
  console.log('\n🔐 SECURITY ASSESSMENT:');
  if (results.passed === results.total) {
    console.log('   ✅ All critical security issues have been fixed!');
    console.log('   The system is now properly secured.');
  } else {
    console.log('   ⚠️  Some security issues remain:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`   - ${t.id}: ${t.name}`);
    });
  }
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run verification
verifyCriticalFixes().catch(console.error);
import { testHarness } from './testHarness.js';

// Run the three critical security tests
async function runCriticalTests() {
  console.log('\n🚨 RUNNING CRITICAL SECURITY TESTS 🚨\n');

  // Test 1: AUTH-006
  const test1 = await testHarness.runTest({
    name: 'AUTH-006: Token in wrong header field',
    async test({ api }) {
      try {
        const response = await api.request({
          method: 'GET',
          url: '/api/user/profile',
          headers: {
            'X-Auth-Token': api.token,  // Wrong header
            'Authorization': undefined   // Remove standard header
          },
          validateStatus: () => true  // Accept any status
        });
        return {
          passed: response.status === 401,
          actualStatus: response.status,
          expectedStatus: 401,
          message: response.status === 401 ? 'Correctly rejected token in custom header' : 'FAILED - Token accepted from wrong header!'
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message
        };
      }
    }
  });

  // Test 2: AUTH-011
  const test2 = await testHarness.runTest({
    name: 'AUTH-011: Admin endpoint without auth',
    async test({ api }) {
      try {
        const response = await api.request({
          method: 'GET',
          url: '/api/admin/enable-unit-management',
          headers: {
            'Authorization': undefined  // No auth
          },
          validateStatus: () => true  // Accept any status
        });
        return {
          passed: response.status === 401,
          actualStatus: response.status,
          expectedStatus: 401,
          message: response.status === 401 ? 'Correctly requires authentication' : 'FAILED - Endpoint accessible without auth!'
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message
        };
      }
    }
  });

  // Test 3: ERROR-006
  const test3 = await testHarness.runTest({
    name: 'ERROR-006: Malformed JSON handling',
    async test({ api }) {
      try {
        const response = await api.request({
          method: 'POST',
          url: '/api/admin/users',
          headers: {
            'Authorization': `Bearer ${api.token}`,
            'Content-Type': 'application/json'
          },
          data: '{invalid json',  // Malformed
          transformRequest: [(data) => data],  // Prevent axios from fixing it
          validateStatus: () => true  // Accept any status
        });
        return {
          passed: response.status === 400 && 
                  response.data.error === "Invalid JSON format" &&
                  response.data.code === "INVALID_JSON",
          actualStatus: response.status,
          data: response.data,
          message: (response.status === 400 && response.data.error === "Invalid JSON format") 
            ? 'Correctly returns JSON error for malformed input' 
            : 'FAILED - Did not return proper JSON error!'
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message
        };
      }
    }
  });

  // Summary
  console.log('\n🔍 CRITICAL SECURITY TEST RESULTS:\n');
  console.log(`AUTH-006 (Token in custom header): ${test1.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`AUTH-011 (Admin endpoint auth): ${test2.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`ERROR-006 (Malformed JSON): ${test3.passed ? '✅ PASSED' : '❌ FAILED'}`);

  const allPassed = test1.passed && test2.passed && test3.passed;
  
  if (allPassed) {
    console.log('\n✅ ALL CRITICAL SECURITY TESTS PASSED!');
    console.log('🚀 Backend is secure enough to proceed with frontend work.\n');
  } else {
    console.log('\n❌ CRITICAL SECURITY TESTS FAILED!');
    console.log('🛑 Backend is NOT secure. Fix these issues before proceeding.\n');
  }

  return { test1, test2, test3, allPassed };
}

// Run the tests
runCriticalTests().then(results => {
  process.exit(results.allPassed ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
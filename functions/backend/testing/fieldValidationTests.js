import { testHarness } from './testHarness.js';

// Run field validation tests
async function runFieldValidationTests() {
  console.log('\n📋 RUNNING FIELD VALIDATION TESTS\n');

  // Test forbidden field names in user creation
  const fieldTests = [
    {
      name: 'FIELD-001: Reject forbidden vendor field',
      field: 'vendor',
      testData: {
        email: 'test1@example.com',
        name: 'Test User',
        vendor: 'Test Vendor'  // Forbidden field
      }
    },
    {
      name: 'FIELD-002: Reject forbidden category field',
      field: 'category',
      testData: {
        email: 'test2@example.com',
        name: 'Test User',
        category: 'Test Category'  // Forbidden field
      }
    },
    {
      name: 'FIELD-003: Reject forbidden account field',
      field: 'account',
      testData: {
        email: 'test3@example.com',
        name: 'Test User',
        account: 'Test Account'  // Forbidden field
      }
    }
  ];

  const results = [];

  for (const test of fieldTests) {
    const result = await testHarness.runTest({
      name: test.name,
      async test({ api }) {
        try {
          const response = await api.request({
            method: 'POST',
            url: '/api/admin/users',
            data: test.testData,
            validateStatus: () => true  // Accept any status
          });
          
          // Should be rejected with 400
          const passed = response.status === 400 && 
                        response.data.code === 'FORBIDDEN_USER_FIELDS' &&
                        response.data.details &&
                        response.data.details.some(d => d.field === test.field);
          
          return {
            passed,
            actualStatus: response.status,
            expectedStatus: 400,
            data: response.data,
            message: passed 
              ? `Correctly rejected forbidden field: ${test.field}`
              : `FAILED - Forbidden field ${test.field} was not rejected!`
          };
        } catch (error) {
          return {
            passed: false,
            error: error.message
          };
        }
      }
    });
    
    results.push(result);
  }

  // Summary
  console.log('\n📊 FIELD VALIDATION TEST RESULTS:\n');
  results.forEach((result, index) => {
    console.log(`${fieldTests[index].name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  });

  const allPassed = results.every(r => r.passed);
  console.log(`\n${allPassed ? '✅ All field validation tests passed' : '❌ Some field validation tests failed'}`);

  return { results, allPassed };
}

// Run the tests
runFieldValidationTests().then(({ allPassed }) => {
  process.exit(allPassed ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
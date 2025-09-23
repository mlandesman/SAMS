#!/usr/bin/env node

import { testHarness } from '../testHarness.js';

/**
 * Multiple Tests Example - Shows how to run many tests efficiently
 */

async function runMultipleTests() {
  console.log('🔄 Multiple Tests Example\n');

  // Define a test suite as an array
  const testSuite = [
    {
      name: 'Backend Health Check',
      async test({ api }) {
        const response = await api.get('/system/health');
        return {
          passed: response.status === 200,
          data: response.data
        };
      }
    },
    
    {
      name: 'User Profile Access',
      async test({ api }) {
        const response = await api.get('/api/user/profile');
        return {
          passed: response.data?.success === true,
          data: response.data
        };
      }
    },
    
    {
      name: 'User Clients List',
      async test({ api }) {
        const response = await api.get('/api/user/clients');
        return {
          passed: response.status === 200,
          data: response.data,
          clientCount: response.data?.clients?.length || 0
        };
      }
    },
    
    {
      name: 'Categories Endpoint',
      async test({ api }) {
        const response = await api.get('/api/categories');
        return {
          passed: response.status === 200,
          data: response.data,
          message: 'Categories endpoint accessible'
        };
      }
    },
    
    {
      name: 'Vendors Endpoint',
      async test({ api }) {
        const response = await api.get('/api/vendors');
        return {
          passed: response.status === 200,
          data: response.data,
          message: 'Vendors endpoint accessible'
        };
      }
    },
    
    {
      name: 'Units Endpoint',
      async test({ api }) {
        const response = await api.get('/api/units');
        return {
          passed: response.status === 200,
          data: response.data,
          message: 'Units endpoint accessible'
        };
      }
    }
  ];

  // Run all tests with options
  const summary = await testHarness.runTests(testSuite, {
    stopOnFailure: false, // Continue even if one test fails
    showSummary: true    // Show summary at the end
  });

  console.log(`\n📈 Final Results:`);
  console.log(`   Success Rate: ${Math.round((summary.passed / summary.totalTests) * 100)}%`);
  console.log(`   Total Duration: ${summary.duration}ms`);
  console.log(`   Average per Test: ${Math.round(summary.duration / summary.totalTests)}ms`);

  return summary;
}

// Example of running tests with failure handling
async function runTestsWithFailureHandling() {
  console.log('\n🛡️ Tests with Failure Handling\n');

  const criticalTests = [
    {
      name: 'Critical: Backend Must Be Running',
      async test({ api }) {
        const health = await api.healthCheck();
        if (!health.healthy) {
          throw new Error('Backend is not running - this is critical!');
        }
        return { passed: true, message: 'Backend is running' };
      }
    },
    
    {
      name: 'Critical: Authentication Must Work',
      async test({ api, userId, token }) {
        const response = await api.get('/api/user/profile');
        if (!response.data?.success) {
          throw new Error('Authentication failed - cannot proceed!');
        }
        return { 
          passed: true, 
          message: `Authentication working for ${userId}`,
          tokenPrefix: token.substring(0, 20) + '...'
        };
      }
    },
    
    {
      name: 'Non-Critical: Optional Feature Test',
      async test({ api }) {
        try {
          const response = await api.get('/api/optional-feature');
          return {
            passed: true,
            data: response.data,
            message: 'Optional feature is working'
          };
        } catch (error) {
          // This is okay to fail
          return {
            passed: false,
            reason: 'Optional feature not available (this is okay)',
            severity: 'low'
          };
        }
      }
    }
  ];

  // Run critical tests with stop on failure for critical items
  return await testHarness.runTests(criticalTests, {
    stopOnFailure: false, // Let's see all results
    showSummary: true
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  Promise.resolve()
    .then(async () => {
      await runMultipleTests();
      
      // Reset and run the second example
      testHarness.reset();
      await runTestsWithFailureHandling();
    })
    .then(() => {
      console.log('\n✅ Multiple tests examples completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Multiple tests examples failed:', error);
      process.exit(1);
    });
}

export { runMultipleTests, runTestsWithFailureHandling };
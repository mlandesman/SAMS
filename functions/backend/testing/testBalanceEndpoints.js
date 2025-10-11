import { testHarness } from './testHarness.js';

/**
 * Test Suite for Balance API Endpoints
 * Tests the new endpoints created in BACKEND-TRANSACTION-APIS-001-SIMPLE
 */

const testSuite = {
  name: 'Balance API Endpoints Test Suite',
  tests: [
    {
      name: 'GET /api/clients/:clientId/accounts - Should return account balances with totals',
      async test({ api, config }) {
        try {
          // Use the test client ID - MTC (Master Test Client)
          const clientId = 'MTC';
          
          // Call the accounts endpoint
          const response = await api.get(`/api/clients/${clientId}/accounts`);
          
          // Verify response structure
          if (!response.data || !response.data.success) {
            return {
              passed: false,
              reason: `API returned success: false`,
              data: response.data
            };
          }
          
          const { data } = response.data;
          
          // Check required fields
          const requiredFields = ['cashBalance', 'bankBalance', 'accounts', 'lastUpdated'];
          const missingFields = requiredFields.filter(field => !(field in data));
          
          if (missingFields.length > 0) {
            return {
              passed: false,
              reason: `Missing required fields: ${missingFields.join(', ')}`,
              data
            };
          }
          
          // Verify data types
          if (typeof data.cashBalance !== 'number' || typeof data.bankBalance !== 'number') {
            return {
              passed: false,
              reason: 'cashBalance and bankBalance must be numbers',
              data
            };
          }
          
          if (!Array.isArray(data.accounts)) {
            return {
              passed: false,
              reason: 'accounts must be an array',
              data
            };
          }
          
          // Calculate expected totals from accounts array
          let expectedCash = 0;
          let expectedBank = 0;
          
          data.accounts.forEach(account => {
            if (account.active !== false) {
              if (account.type === 'cash') {
                expectedCash += account.balance || 0;
              } else if (account.type === 'bank') {
                expectedBank += account.balance || 0;
              }
            }
          });
          
          // Verify calculations match
          if (Math.abs(data.cashBalance - expectedCash) > 0.01) {
            return {
              passed: false,
              reason: `Cash balance mismatch. Expected: ${expectedCash}, Got: ${data.cashBalance}`,
              data
            };
          }
          
          if (Math.abs(data.bankBalance - expectedBank) > 0.01) {
            return {
              passed: false,
              reason: `Bank balance mismatch. Expected: ${expectedBank}, Got: ${data.bankBalance}`,
              data
            };
          }
          
          return {
            passed: true,
            message: `Successfully retrieved ${data.accounts.length} accounts. Cash: ${data.cashBalance}, Bank: ${data.bankBalance}`,
            data: {
              accountCount: data.accounts.length,
              cashBalance: data.cashBalance,
              bankBalance: data.bankBalance,
              totalBalance: data.cashBalance + data.bankBalance
            }
          };
          
        } catch (error) {
          return {
            passed: false,
            reason: `Test failed with error: ${error.message}`,
            error: error.stack
          };
        }
      }
    },
    
    {
      name: 'GET /api/clients/:clientId/balances/recalculate - Dry run should calculate without saving',
      async test({ api, config }) {
        try {
          const clientId = 'MTC';
          
          // Get current balances first
          const beforeResponse = await api.get(`/api/clients/${clientId}/accounts`);
          const balancesBefore = beforeResponse.data.data;
          
          // Call recalculate endpoint with dryRun=true
          const response = await api.get(`/api/clients/${clientId}/balances/recalculate?dryRun=true&startYear=2024`);
          
          if (!response.data || !response.data.success) {
            return {
              passed: false,
              reason: `API returned success: false`,
              data: response.data
            };
          }
          
          const { data } = response.data;
          
          // Verify response structure
          const requiredFields = [
            'accounts', 'cashBalance', 'bankBalance', 'totalBalance',
            'processedTransactions', 'rebuildDate', 'sourceSnapshot', 'dryRun'
          ];
          
          const missingFields = requiredFields.filter(field => !(field in data));
          
          if (missingFields.length > 0) {
            return {
              passed: false,
              reason: `Missing required fields: ${missingFields.join(', ')}`,
              data
            };
          }
          
          // Verify it was a dry run
          if (data.dryRun !== true) {
            return {
              passed: false,
              reason: 'Expected dryRun to be true',
              data
            };
          }
          
          // Verify snapshot source
          if (data.sourceSnapshot !== '2024-12-31') {
            return {
              passed: false,
              reason: `Expected sourceSnapshot to be '2024-12-31', got '${data.sourceSnapshot}'`,
              data
            };
          }
          
          // Get balances after dry run - should be unchanged
          const afterResponse = await api.get(`/api/clients/${clientId}/accounts`);
          const balancesAfter = afterResponse.data.data;
          
          // Compare before and after balances
          let balancesChanged = false;
          
          if (balancesBefore.accounts.length === balancesAfter.accounts.length) {
            for (let i = 0; i < balancesBefore.accounts.length; i++) {
              const before = balancesBefore.accounts[i];
              const after = balancesAfter.accounts.find(a => a.id === before.id || a.name === before.name);
              
              if (!after || Math.abs(before.balance - after.balance) > 0.01) {
                balancesChanged = true;
                break;
              }
            }
          } else {
            balancesChanged = true;
          }
          
          if (balancesChanged) {
            return {
              passed: false,
              reason: 'Dry run should not modify actual balances',
              data: {
                balancesBefore,
                balancesAfter,
                recalcResult: data
              }
            };
          }
          
          return {
            passed: true,
            message: `Dry run completed successfully. Processed ${data.processedTransactions} transactions. Calculated total: ${data.totalBalance}`,
            data: {
              processedTransactions: data.processedTransactions,
              calculatedCash: data.cashBalance,
              calculatedBank: data.bankBalance,
              calculatedTotal: data.totalBalance,
              accountCount: data.accounts.length
            }
          };
          
        } catch (error) {
          return {
            passed: false,
            reason: `Test failed with error: ${error.message}`,
            error: error.stack
          };
        }
      }
    },
    
    {
      name: 'GET /api/clients/:clientId/balances/recalculate - Should handle missing year-end snapshot gracefully',
      async test({ api, config }) {
        try {
          const clientId = 'MTC';
          
          // Try to recalculate from a year that likely doesn't have a snapshot
          const response = await api.get(`/api/clients/${clientId}/balances/recalculate?dryRun=true&startYear=2020`);
          
          // Should fail gracefully with appropriate error
          if (response.data && response.data.success === true) {
            return {
              passed: false,
              reason: 'Expected endpoint to fail when year-end snapshot is missing',
              data: response.data
            };
          }
          
          if (!response.data || !response.data.error || !response.data.error.includes('snapshot')) {
            return {
              passed: false,
              reason: 'Expected error message to mention missing snapshot',
              data: response.data
            };
          }
          
          return {
            passed: true,
            message: 'Endpoint correctly handles missing year-end snapshot',
            data: {
              errorMessage: response.error
            }
          };
          
        } catch (error) {
          // Check if it's an axios error with the expected error message
          if (error.response && error.response.status === 500) {
            const errorData = error.response.data;
            if (errorData && errorData.error && errorData.error.includes('snapshot')) {
              return {
                passed: true,
                message: 'Endpoint correctly returns 500 error for missing snapshot',
                data: {
                  errorMessage: errorData.error,
                  status: error.response.status
                }
              };
            }
          }
          
          return {
            passed: false,
            reason: `Unexpected error: ${error.message}`,
            error: error.stack
          };
        }
      }
    }
  ]
};

// Run the tests
async function runAllTests() {
  console.log('🎯 Balance API Endpoints Test Suite\n');
  
  for (const test of testSuite.tests) {
    await testHarness.runTest(test);
  }
  
  testHarness.showSummary();
}

runAllTests().catch(console.error);
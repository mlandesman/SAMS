import { testHarness } from './testHarness.js';

/**
 * Test Suite for Credit Balance API Endpoints
 * Tests the new /credit endpoint created in Task 0A
 * 
 * Endpoints Tested:
 * - GET /credit/:clientId/:unitId - Get current credit balance
 * - POST /credit/:clientId/:unitId - Update credit balance
 * - GET /credit/:clientId/:unitId/history - Get credit history
 * - POST /credit/:clientId/:unitId/history - Add history entry
 */

const testSuite = {
  name: 'Credit Balance API Endpoint Test Suite',
  tests: [
    // TEST 1: Get Credit Balance (Existing HOA Dues Data)
    {
      name: 'TEST 1: GET /credit/:clientId/:unitId - Should return credit balance from HOA Dues',
      async test({ api, config }) {
        try {
          const clientId = 'AVII';
          const unitId = '203';
          
          console.log(`      📞 GET /credit/${clientId}/${unitId}`);
          
          // Call the credit endpoint
          const response = await api.get(`/credit/${clientId}/${unitId}`);
          
          console.log(`      📦 Response:`, JSON.stringify(response.data, null, 2));
          
          // Verify response structure
          const data = response.data;
          
          // Check required fields
          const requiredFields = ['clientId', 'unitId', 'creditBalance', 'creditBalanceDisplay'];
          const missingFields = requiredFields.filter(field => !(field in data));
          
          if (missingFields.length > 0) {
            return {
              passed: false,
              reason: `Missing required fields: ${missingFields.join(', ')}`,
              data
            };
          }
          
          // Verify data types
          if (typeof data.creditBalance !== 'number') {
            return {
              passed: false,
              reason: 'creditBalance must be a number',
              data
            };
          }
          
          if (typeof data.creditBalanceDisplay !== 'string') {
            return {
              passed: false,
              reason: 'creditBalanceDisplay must be a string',
              data
            };
          }
          
          // Verify formatting
          if (!data.creditBalanceDisplay.startsWith('$')) {
            return {
              passed: false,
              reason: 'creditBalanceDisplay must start with $',
              data
            };
          }
          
          return {
            passed: true,
            message: `Successfully retrieved credit balance: ${data.creditBalanceDisplay}`,
            data: {
              clientId: data.clientId,
              unitId: data.unitId,
              creditBalance: data.creditBalance,
              creditBalanceDisplay: data.creditBalanceDisplay
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

    // TEST 2: Get Credit Balance (Non-Existing Unit)
    {
      name: 'TEST 2: GET /credit/:clientId/:unitId - Should return zero for non-existing unit',
      async test({ api, config }) {
        try {
          const clientId = 'AVII';
          const unitId = '999'; // Non-existing unit
          
          console.log(`      📞 GET /credit/${clientId}/${unitId}`);
          
          // Call the credit endpoint
          const response = await api.get(`/credit/${clientId}/${unitId}`);
          
          console.log(`      📦 Response:`, JSON.stringify(response.data, null, 2));
          
          const data = response.data;
          
          // Should return zero balance for non-existing unit
          if (data.creditBalance !== 0) {
            return {
              passed: false,
              reason: `Expected creditBalance to be 0, got ${data.creditBalance}`,
              data
            };
          }
          
          if (data.creditBalanceDisplay !== '$0.00') {
            return {
              passed: false,
              reason: `Expected creditBalanceDisplay to be '$0.00', got ${data.creditBalanceDisplay}`,
              data
            };
          }
          
          return {
            passed: true,
            message: `Successfully returned zero balance for non-existing unit`,
            data
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

    // TEST 3: Update Credit Balance (Add Credit)
    {
      name: 'TEST 3: POST /credit/:clientId/:unitId - Should add credit to balance',
      async test({ api, config }) {
        try {
          const clientId = 'AVII';
          const unitId = '203';
          
          // Get current balance first
          console.log(`      📞 GET /credit/${clientId}/${unitId} (before)`);
          const beforeResponse = await api.get(`/credit/${clientId}/${unitId}`);
          const balanceBefore = beforeResponse.data.creditBalance;
          
          console.log(`      💰 Balance before: ${balanceBefore} cents`);
          
          // Add 10000 cents ($100) to credit
          const amountToAdd = 10000;
          const updateData = {
            amount: amountToAdd,
            transactionId: `TEST_ADD_${Date.now()}`,
            note: 'Test credit addition',
            source: 'test'
          };
          
          console.log(`      📞 POST /credit/${clientId}/${unitId}`, updateData);
          
          const response = await api.post(`/credit/${clientId}/${unitId}`, updateData);
          
          console.log(`      📦 Response:`, JSON.stringify(response.data, null, 2));
          
          const data = response.data;
          
          // Verify response
          if (!data.success) {
            return {
              passed: false,
              reason: 'Response success should be true',
              data
            };
          }
          
          if (data.previousBalance !== balanceBefore) {
            return {
              passed: false,
              reason: `Previous balance mismatch. Expected: ${balanceBefore}, Got: ${data.previousBalance}`,
              data
            };
          }
          
          const expectedNewBalance = balanceBefore + amountToAdd;
          if (data.newBalance !== expectedNewBalance) {
            return {
              passed: false,
              reason: `New balance mismatch. Expected: ${expectedNewBalance}, Got: ${data.newBalance}`,
              data
            };
          }
          
          if (data.amountChange !== amountToAdd) {
            return {
              passed: false,
              reason: `Amount change mismatch. Expected: ${amountToAdd}, Got: ${data.amountChange}`,
              data
            };
          }
          
          // Verify the balance actually updated
          console.log(`      📞 GET /credit/${clientId}/${unitId} (after)`);
          const afterResponse = await api.get(`/credit/${clientId}/${unitId}`);
          const balanceAfter = afterResponse.data.creditBalance;
          
          console.log(`      💰 Balance after: ${balanceAfter} cents`);
          
          if (balanceAfter !== expectedNewBalance) {
            return {
              passed: false,
              reason: `Balance not persisted correctly. Expected: ${expectedNewBalance}, Got: ${balanceAfter}`,
              data: { beforeResponse: beforeResponse.data, updateResponse: data, afterResponse: afterResponse.data }
            };
          }
          
          return {
            passed: true,
            message: `Successfully added ${amountToAdd} cents. Balance: ${balanceBefore} → ${balanceAfter}`,
            data: {
              balanceBefore,
              amountAdded: amountToAdd,
              balanceAfter,
              transactionId: updateData.transactionId
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

    // TEST 4: Update Credit Balance (Subtract Credit)
    {
      name: 'TEST 4: POST /credit/:clientId/:unitId - Should subtract credit from balance',
      async test({ api, config }) {
        try {
          const clientId = 'AVII';
          const unitId = '203';
          
          // Get current balance first
          console.log(`      📞 GET /credit/${clientId}/${unitId} (before)`);
          const beforeResponse = await api.get(`/credit/${clientId}/${unitId}`);
          const balanceBefore = beforeResponse.data.creditBalance;
          
          console.log(`      💰 Balance before: ${balanceBefore} cents`);
          
          // Subtract 5000 cents ($50) from credit
          const amountToSubtract = -5000;
          
          // Check if we have enough balance
          if (balanceBefore + amountToSubtract < 0) {
            return {
              passed: false,
              reason: `Insufficient balance for test. Need at least ${Math.abs(amountToSubtract)} cents, have ${balanceBefore} cents`,
              data: { balanceBefore, amountToSubtract }
            };
          }
          
          const updateData = {
            amount: amountToSubtract,
            transactionId: `TEST_SUB_${Date.now()}`,
            note: 'Test credit deduction',
            source: 'test'
          };
          
          console.log(`      📞 POST /credit/${clientId}/${unitId}`, updateData);
          
          const response = await api.post(`/credit/${clientId}/${unitId}`, updateData);
          
          console.log(`      📦 Response:`, JSON.stringify(response.data, null, 2));
          
          const data = response.data;
          
          // Verify response
          if (!data.success) {
            return {
              passed: false,
              reason: 'Response success should be true',
              data
            };
          }
          
          const expectedNewBalance = balanceBefore + amountToSubtract;
          if (data.newBalance !== expectedNewBalance) {
            return {
              passed: false,
              reason: `New balance mismatch. Expected: ${expectedNewBalance}, Got: ${data.newBalance}`,
              data
            };
          }
          
          // Verify the balance actually updated
          console.log(`      📞 GET /credit/${clientId}/${unitId} (after)`);
          const afterResponse = await api.get(`/credit/${clientId}/${unitId}`);
          const balanceAfter = afterResponse.data.creditBalance;
          
          console.log(`      💰 Balance after: ${balanceAfter} cents`);
          
          if (balanceAfter !== expectedNewBalance) {
            return {
              passed: false,
              reason: `Balance not persisted correctly. Expected: ${expectedNewBalance}, Got: ${balanceAfter}`,
              data: { beforeResponse: beforeResponse.data, updateResponse: data, afterResponse: afterResponse.data }
            };
          }
          
          return {
            passed: true,
            message: `Successfully subtracted ${Math.abs(amountToSubtract)} cents. Balance: ${balanceBefore} → ${balanceAfter}`,
            data: {
              balanceBefore,
              amountSubtracted: amountToSubtract,
              balanceAfter,
              transactionId: updateData.transactionId
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

    // TEST 5: Get Credit History
    {
      name: 'TEST 5: GET /credit/:clientId/:unitId/history - Should return credit history',
      async test({ api, config }) {
        try {
          const clientId = 'AVII';
          const unitId = '203';
          const limit = 5;
          
          console.log(`      📞 GET /credit/${clientId}/${unitId}/history?limit=${limit}`);
          
          // Call the credit history endpoint
          const response = await api.get(`/credit/${clientId}/${unitId}/history?limit=${limit}`);
          
          console.log(`      📦 Response:`, JSON.stringify(response.data, null, 2));
          
          const data = response.data;
          
          // Check required fields
          const requiredFields = ['clientId', 'unitId', 'currentBalance', 'history'];
          const missingFields = requiredFields.filter(field => !(field in data));
          
          if (missingFields.length > 0) {
            return {
              passed: false,
              reason: `Missing required fields: ${missingFields.join(', ')}`,
              data
            };
          }
          
          // Verify history is an array
          if (!Array.isArray(data.history)) {
            return {
              passed: false,
              reason: 'history must be an array',
              data
            };
          }
          
          // Verify history limit respected
          if (data.history.length > limit) {
            return {
              passed: false,
              reason: `History returned ${data.history.length} entries, expected max ${limit}`,
              data
            };
          }
          
          // Verify history entry structure (if any entries exist)
          if (data.history.length > 0) {
            const entry = data.history[0];
            const entryFields = ['id', 'date', 'amount', 'balance', 'transactionId', 'note', 'source'];
            const missingEntryFields = entryFields.filter(field => !(field in entry));
            
            if (missingEntryFields.length > 0) {
              return {
                passed: false,
                reason: `History entry missing fields: ${missingEntryFields.join(', ')}`,
                data: entry
              };
            }
            
            // Verify entries are sorted by date (most recent first)
            if (data.history.length > 1) {
              const firstDate = new Date(data.history[0].date);
              const secondDate = new Date(data.history[1].date);
              
              if (firstDate < secondDate) {
                return {
                  passed: false,
                  reason: 'History should be sorted newest first',
                  data: {
                    firstEntry: data.history[0],
                    secondEntry: data.history[1]
                  }
                };
              }
            }
          }
          
          return {
            passed: true,
            message: `Successfully retrieved ${data.history.length} history entries`,
            data: {
              clientId: data.clientId,
              unitId: data.unitId,
              currentBalance: data.currentBalance,
              historyCount: data.history.length,
              latestEntry: data.history[0] || null
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

    // TEST 6: Verify HOA Dues Still Works
    {
      name: 'TEST 6: Verify HOA Dues endpoint still accessible',
      async test({ api, config }) {
        try {
          const clientId = 'AVII';
          const unitId = '203';
          const year = new Date().getFullYear();
          
          console.log(`      📞 GET /hoadues/${clientId}/unit/${unitId}/${year}`);
          
          // Call the HOA Dues endpoint to verify it still works
          const response = await api.get(`/hoadues/${clientId}/unit/${unitId}/${year}`);
          
          console.log(`      📦 Response status: ${response.status}`);
          console.log(`      📦 Has creditBalance: ${response.data?.creditBalance !== undefined}`);
          
          // Verify HOA Dues endpoint still returns credit balance
          if (!response.data || response.data.creditBalance === undefined) {
            return {
              passed: false,
              reason: 'HOA Dues endpoint no longer returns creditBalance',
              data: response.data
            };
          }
          
          // Get the same credit from new endpoint
          console.log(`      📞 GET /credit/${clientId}/${unitId}`);
          const creditResponse = await api.get(`/credit/${clientId}/${unitId}`);
          
          // Verify both return the same value
          if (response.data.creditBalance !== creditResponse.data.creditBalance) {
            return {
              passed: false,
              reason: `Credit balance mismatch. HOA: ${response.data.creditBalance}, Credit: ${creditResponse.data.creditBalance}`,
              data: {
                hoaDues: response.data.creditBalance,
                credit: creditResponse.data.creditBalance
              }
            };
          }
          
          return {
            passed: true,
            message: `HOA Dues endpoint still works. Both endpoints return same balance: ${response.data.creditBalance}`,
            data: {
              hoaDuesBalance: response.data.creditBalance,
              creditBalance: creditResponse.data.creditBalance,
              match: true
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

    // TEST 7: Error Handling - Missing Required Fields
    {
      name: 'TEST 7: POST /credit/:clientId/:unitId - Should reject missing required fields',
      async test({ api, config }) {
        try {
          const clientId = 'AVII';
          const unitId = '203';
          
          // Try to update without required fields
          const invalidData = {
            amount: 100
            // Missing: transactionId, note, source
          };
          
          console.log(`      📞 POST /credit/${clientId}/${unitId}`, invalidData);
          
          try {
            const response = await api.post(`/credit/${clientId}/${unitId}`, invalidData);
            
            // Should have failed
            return {
              passed: false,
              reason: 'Expected 400 error for missing required fields, but request succeeded',
              data: response.data
            };
            
          } catch (error) {
            // Should get 400 error
            if (error.response && error.response.status === 400) {
              console.log(`      ✅ Got expected 400 error: ${error.response.data.error}`);
              
              return {
                passed: true,
                message: 'Successfully rejected request with missing required fields',
                data: {
                  expectedError: true,
                  status: 400,
                  errorMessage: error.response.data.error
                }
              };
            } else {
              return {
                passed: false,
                reason: `Expected 400 error, got ${error.response?.status || 'unknown'}`,
                data: error.response?.data
              };
            }
          }
          
        } catch (error) {
          return {
            passed: false,
            reason: `Test failed with error: ${error.message}`,
            error: error.stack
          };
        }
      }
    }
  ]
};

// Run the test suite
(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 CREDIT BALANCE ENDPOINT TEST SUITE');
  console.log('='.repeat(80) + '\n');
  
  await testHarness.runTests(testSuite.tests, {
    stopOnFailure: false,
    showSummary: true
  });
})();


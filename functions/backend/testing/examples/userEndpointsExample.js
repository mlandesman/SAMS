#!/usr/bin/env node

import { testHarness, testUserProfile, testUserClients } from '../testHarness.js';

/**
 * User Endpoints Example - Tests all major user-related endpoints
 */

async function runUserEndpointTests() {
  console.log('👤 User Endpoints Test Suite\n');

  // Test 1: Get user profile
  await testUserProfile();

  // Test 2: Get available clients
  await testUserClients();

  // Test 3: Complex user flow - get clients, select one, verify selection
  await testHarness.runTest({
    name: 'Complete User Flow - Client Selection',
    async test({ api }) {
      const steps = [];
      
      try {
        // Step 1: Get user's available clients
        const clientsResponse = await api.get('/api/user/clients');
        steps.push('getClients');
        
        if (!clientsResponse.data?.clients || clientsResponse.data.clients.length === 0) {
          return {
            passed: false,
            reason: 'No clients available for user',
            steps,
            data: clientsResponse.data
          };
        }

        const firstClient = clientsResponse.data.clients[0];
        
        // Step 2: Select the first client
        const selectResponse = await api.post('/api/user/select-client', {
          clientId: firstClient.id
        });
        steps.push('selectClient');
        
        if (!selectResponse.data?.success) {
          return {
            passed: false,
            reason: 'Failed to select client',
            steps,
            data: selectResponse.data
          };
        }

        // Step 3: Verify the selection by getting current client
        const currentResponse = await api.get('/api/user/current-client');
        steps.push('verifySelection');
        
        const success = currentResponse.data?.client?.id === firstClient.id;
        
        return {
          passed: success,
          data: {
            availableClients: clientsResponse.data.clients.length,
            selectedClient: firstClient.id,
            currentClient: currentResponse.data?.client?.id,
            allStepsCompleted: steps.length === 3
          },
          steps,
          message: success 
            ? `Successfully selected client ${firstClient.id}`
            : 'Client selection not reflected in current client'
        };
        
      } catch (error) {
        return {
          passed: false,
          reason: `Error during step ${steps.length + 1}: ${error.message}`,
          steps,
          error: error.message
        };
      }
    }
  });

  // Test 4: Profile endpoint error handling
  await testHarness.runTest({
    name: 'Profile Endpoint Error Handling',
    async test({ api }) {
      try {
        // Test with invalid endpoint to see error handling
        const response = await api.get('/api/user/nonexistent');
        
        // If we get here, check if it's a proper error response
        return {
          passed: response.status >= 400,
          data: response.data,
          actualStatus: response.status,
          message: response.status >= 400 
            ? 'Properly returned error status' 
            : 'Should have returned error status for invalid endpoint'
        };
        
      } catch (error) {
        // Axios throws for 4xx/5xx status codes, which is expected
        const status = error.response?.status;
        return {
          passed: status >= 400,
          data: error.response?.data,
          actualStatus: status,
          message: status >= 400
            ? 'Properly handled invalid endpoint with error'
            : 'Unexpected error handling'
        };
      }
    }
  });

  // Test 5: Authentication validation
  await testHarness.runTest({
    name: 'Authentication Required Validation',
    async test({ api, token }) {
      // Try to make a request without the Authorization header
      try {
        const response = await api.get('/api/user/profile', {
          headers: {
            'Authorization': 'Bearer invalid-token'
          }
        });
        
        // If this succeeds, something might be wrong with auth
        return {
          passed: false,
          reason: 'Expected authentication failure with invalid token',
          data: response.data
        };
        
      } catch (error) {
        const status = error.response?.status;
        return {
          passed: status === 401 || status === 403,
          data: error.response?.data,
          actualStatus: status,
          message: status === 401 || status === 403
            ? 'Properly rejected invalid token'
            : `Expected 401/403, got ${status}`
        };
      }
    }
  });

  testHarness.showSummary();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runUserEndpointTests()
    .then(() => {
      console.log('\n✅ User endpoints tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ User endpoints tests failed:', error);
      process.exit(1);
    });
}

export { runUserEndpointTests };
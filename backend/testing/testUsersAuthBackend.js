import { testHarness, quickApiTest, testUserProfile, testUserClients } from './testHarness.js';

/**
 * Comprehensive Test Suite for Users/Auth Backend
 * Verifies Implementation Agent's legacy code cleanup didn't break functionality
 * 
 * Tests the 4 main areas where legacy code was removed:
 * 1. User authentication flow
 * 2. Unit role assignments (legacy functions removed)
 * 3. Password reset functionality
 * 4. Middleware authentication (email fallback removed)
 */

console.log('🚀 SAMS Users/Auth Backend Test Suite');
console.log('📋 Verifying Implementation Agent\'s legacy cleanup work...');

async function runUsersAuthTests() {
  
  // Test 1: User Authentication Flow
  console.log('\n=== TESTING USER AUTHENTICATION FLOW ===');
  
  const profileTest = await testHarness.runTest({
    name: 'GET /api/user/profile - User Profile Retrieval',
    async test({ api, config }) {
      const response = await api.get(config.ENDPOINTS.USER_PROFILE);
      
      const hasUser = response.data && response.data.user;
      const hasEmail = hasUser && response.data.user.email;
      const hasUID = hasUser && (response.data.user.uid || response.data.user.id);
      
      return {
        passed: hasUser && hasEmail && hasUID,
        data: response.data,
        message: hasUser ? `Profile loaded for ${response.data.user.email}` : 'No user data returned',
        reason: !hasUser ? 'No user object in response' : 
                !hasEmail ? 'No email in user object' :
                !hasUID ? 'No UID/ID in user object' : null
      };
    }
  });

  const clientsTest = await testHarness.runTest({
    name: 'GET /api/user/clients - User Clients Retrieval', 
    async test({ api, config }) {
      const response = await api.get(config.ENDPOINTS.USER_CLIENTS);
      
      const hasClients = response.data && response.data.clients;
      const isArray = Array.isArray(hasClients ? response.data.clients : null);
      
      return {
        passed: hasClients && isArray,
        data: response.data,
        message: isArray ? `Found ${response.data.clients.length} client(s)` : 'No clients array returned',
        reason: !hasClients ? 'No clients property in response' :
                !isArray ? 'Clients is not an array' : null
      };
    }
  });

  const selectClientTest = await testHarness.runTest({
    name: 'POST /api/user/select-client - Client Selection',
    async test({ api, config }) {
      // First get available clients to select one
      const clientsResponse = await api.get(config.ENDPOINTS.USER_CLIENTS);
      
      if (!clientsResponse.data.clients || clientsResponse.data.clients.length === 0) {
        return {
          passed: false,
          reason: 'No clients available to test selection'
        };
      }
      
      const firstClient = clientsResponse.data.clients[0];
      const response = await api.post(config.ENDPOINTS.SELECT_CLIENT, {
        clientId: firstClient.id
      });
      
      const success = response.data && response.data.success;
      
      return {
        passed: success === true,
        data: response.data,
        message: success ? `Selected client: ${firstClient.id}` : 'Client selection failed',
        reason: !success ? 'Response does not indicate success' : null
      };
    }
  });

  // Test 2: Unit Role Assignment Endpoints (Where Legacy Code Was Removed)
  console.log('\n=== TESTING UNIT ROLE ASSIGNMENTS (LEGACY CODE AREA) ===');

  const adminUsersTest = await testHarness.runTest({
    name: 'GET /api/admin/users - User Management List',
    async test({ api, config }) {
      const response = await api.get(config.ENDPOINTS.ADMIN_USERS);
      
      const hasUsers = response.data && (response.data.users || Array.isArray(response.data));
      const users = response.data.users || response.data;
      const isArray = Array.isArray(users);
      
      return {
        passed: hasUsers && isArray,
        data: response.data,
        message: isArray ? `Found ${users.length} user(s) in system` : 'No users array returned',
        reason: !hasUsers ? 'No users data in response' :
                !isArray ? 'Users data is not an array' : null
      };
    }
  });

  // Test that new unit role assignment endpoints exist (replaced legacy functions)
  const unitRoleAssignmentTest = await testHarness.runTest({
    name: 'POST /api/admin/users/:userId/unit-roles - Unit Role Assignment Endpoint',
    async test({ api, userId }) {
      try {
        // Test with invalid data to verify endpoint exists and validates
        const response = await api.post(`/api/admin/users/${userId}/unit-roles`, {
          clientId: 'test-client',
          unitId: 'test-unit',
          role: 'unitManager'
        });
        
        // We expect this to fail with validation, but endpoint should exist
        return {
          passed: true,
          data: response.data,
          message: 'Unit role assignment endpoint exists and responds'
        };
      } catch (error) {
        // Check if it's a 404 (endpoint missing) vs other error (endpoint exists)
        const is404 = error.response && error.response.status === 404;
        const isValidationError = error.response && [400, 403].includes(error.response.status);
        
        return {
          passed: !is404, // Pass if endpoint exists (even if validation fails)
          data: error.response?.data,
          message: is404 ? 'Endpoint missing (404)' : 
                   isValidationError ? 'Endpoint exists, validation error expected' :
                   `Endpoint exists, returned ${error.response?.status}`,
          reason: is404 ? 'Unit role assignment endpoint not found - legacy functions not properly replaced' : null
        };
      }
    }
  });

  // Test 3: Password Reset Functionality
  console.log('\n=== TESTING PASSWORD RESET FUNCTIONALITY ===');
  
  const passwordResetTest = await testHarness.runTest({
    name: 'POST /api/auth/reset-password - Password Reset Endpoint',
    async test({ api }) {
      try {
        // Test with invalid email to verify endpoint exists and validates
        const response = await api.post('/api/auth/reset-password', {
          email: 'nonexistent@test.com'
        });
        
        // Should return 404 for non-existent user
        return {
          passed: true,
          data: response.data,
          message: 'Password reset endpoint responds correctly'
        };
      } catch (error) {
        const is404 = error.response && error.response.status === 404;
        const isValidationError = error.response && [400, 404].includes(error.response.status);
        
        return {
          passed: !error.response || isValidationError,
          data: error.response?.data,
          message: isValidationError ? 'Endpoint exists, validation working' : 'Endpoint error',
          reason: !isValidationError && error.response ? `Unexpected status: ${error.response.status}` : null
        };
      }
    }
  });

  // Test 4: Authentication Middleware (Email Fallback Removed)
  console.log('\n=== TESTING AUTHENTICATION MIDDLEWARE ===');
  
  const authMiddlewareTest = await testHarness.runTest({
    name: 'Authentication Middleware - UID-Based Only',
    async test({ api, userId, config }) {
      // Test multiple endpoints to ensure authentication works consistently
      const endpoints = [config.ENDPOINTS.USER_PROFILE, config.ENDPOINTS.USER_CLIENTS];
      let allPassed = true;
      const results = [];
      
      for (const endpoint of endpoints) {
        try {
          const response = await api.get(endpoint);
          const hasAuth = response.status === 200 && response.data;
          results.push({ endpoint, success: hasAuth });
          if (!hasAuth) allPassed = false;
        } catch (error) {
          results.push({ endpoint, success: false, error: error.message });
          allPassed = false;
        }
      }
      
      return {
        passed: allPassed,
        data: { results, userId },
        message: allPassed ? 'All endpoints authenticated successfully' : 'Some endpoints failed authentication',
        reason: !allPassed ? 'Authentication middleware may have issues' : null
      };
    }
  });

  // Test 5: Verify Legacy Functions Were Removed
  console.log('\n=== TESTING LEGACY FUNCTION REMOVAL ===');
  
  const legacyEndpointTest = await testHarness.runTest({
    name: 'Legacy Manager Assignment Endpoints - Should Be Removed',
    async test({ api, userId }) {
      try {
        // Try to access old manager assignment endpoint - should return 404
        const response = await api.post(`/api/admin/users/${userId}/manager-assignments`, {
          clientId: 'test',
          unitId: 'test'
        });
        
        return {
          passed: false,
          data: response.data,
          reason: 'Legacy manager assignment endpoint still exists - should be removed'
        };
      } catch (error) {
        const is404 = error.response && error.response.status === 404;
        
        return {
          passed: is404,
          data: error.response?.data,
          message: is404 ? 'Legacy endpoint properly removed (404)' : 'Legacy endpoint returned unexpected error',
          reason: !is404 ? `Expected 404, got ${error.response?.status}` : null
        };
      }
    }
  });

  // Summary
  console.log('\n=== TEST EXECUTION COMPLETE ===');
  testHarness.showSummary();
  
  return testHarness.testResults;
}

// Run the tests
runUsersAuthTests().catch(console.error);
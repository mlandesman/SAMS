#!/usr/bin/env node

/**
 * Client Isolation Security Test Suite
 * Tests all aspects of the client isolation implementation
 * 
 * Run with: node scripts/test-client-isolation.js
 */

import fetch from 'node-fetch';
import admin from 'firebase-admin';

// Test configuration
const API_BASE_URL = 'http://localhost:5001/api';
const TEST_CLIENTS = {
  AUTHORIZED: 'MTC',   // Client the test user has access to
  UNAUTHORIZED: 'TST'  // Client the test user should NOT have access to
};

// Test user credentials (should be configured for MTC only)
const TEST_USER_EMAIL = 'test@example.com';

class SecurityTestSuite {
  constructor() {
    this.results = [];
    this.authToken = null;
  }

  /**
   * Initialize Firebase Admin for testing
   */
  async initializeFirebase() {
    try {
      if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
      }
      console.log('✅ Firebase Admin initialized');
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Create a test token for the specified user
   */
  async createTestToken(email = TEST_USER_EMAIL) {
    try {
      // Create custom token for test user
      const customToken = await admin.auth().createCustomToken(email);
      
      // This would normally be done by the client, but we simulate it for testing
      // In real tests, you'd use the Firebase client SDK to sign in with the custom token
      console.log('✅ Test token created (use Firebase client SDK to exchange for ID token)');
      
      // For this test, we'll create a test ID token directly
      // Note: In real implementation, use proper Firebase authentication flow
      const testIdToken = await this.simulateIdTokenCreation(email);
      this.authToken = testIdToken;
      
      return testIdToken;
    } catch (error) {
      console.error('❌ Token creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Simulate ID token creation (for testing purposes only)
   */
  async simulateIdTokenCreation(email) {
    // In real implementation, this would be done by Firebase client SDK
    // For testing, we create a mock token
    return `Bearer mock-token-for-${email}`;
  }

  /**
   * Make authenticated API request
   */
  async apiRequest(method, endpoint, body = null) {
    const options = {
      method,
      headers: {
        'Authorization': this.authToken,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    return {
      status: response.status,
      data: response.ok ? await response.json() : await response.text()
    };
  }

  /**
   * Record test result
   */
  recordResult(testName, passed, details) {
    this.results.push({
      test: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    });

    const emoji = passed ? '✅' : '❌';
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`${emoji} ${testName}: ${status} - ${details}`);
  }

  /**
   * Test 1: Client list only shows authorized clients
   */
  async testClientListFiltering() {
    try {
      const response = await this.apiRequest('GET', '/clients');
      
      if (response.status === 200) {
        const clients = Array.isArray(response.data) ? response.data : [];
        const hasAuthorized = clients.some(c => c.id === TEST_CLIENTS.AUTHORIZED);
        const hasUnauthorized = clients.some(c => c.id === TEST_CLIENTS.UNAUTHORIZED);
        
        if (hasAuthorized && !hasUnauthorized) {
          this.recordResult(
            'Client List Filtering',
            true,
            `Only authorized clients returned (${clients.length} clients)`
          );
        } else {
          this.recordResult(
            'Client List Filtering',
            false,
            `Unauthorized access detected: authorized=${hasAuthorized}, unauthorized=${hasUnauthorized}`
          );
        }
      } else {
        this.recordResult(
          'Client List Filtering',
          false,
          `API error: ${response.status} - ${response.data}`
        );
      }
    } catch (error) {
      this.recordResult('Client List Filtering', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 2: Direct client access validation
   */
  async testDirectClientAccess() {
    try {
      // Test authorized client access
      const authorizedResponse = await this.apiRequest('GET', `/clients/${TEST_CLIENTS.AUTHORIZED}`);
      const authorizedPass = authorizedResponse.status === 200;

      // Test unauthorized client access
      const unauthorizedResponse = await this.apiRequest('GET', `/clients/${TEST_CLIENTS.UNAUTHORIZED}`);
      const unauthorizedPass = unauthorizedResponse.status === 403 || unauthorizedResponse.status === 404;

      const passed = authorizedPass && unauthorizedPass;
      this.recordResult(
        'Direct Client Access',
        passed,
        `Authorized: ${authorizedResponse.status}, Unauthorized: ${unauthorizedResponse.status}`
      );
    } catch (error) {
      this.recordResult('Direct Client Access', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 3: Transaction API client isolation
   */
  async testTransactionApiIsolation() {
    try {
      // Test authorized client transactions
      const authorizedResponse = await this.apiRequest('GET', `/clients/${TEST_CLIENTS.AUTHORIZED}/transactions`);
      const authorizedPass = authorizedResponse.status === 200;

      // Test unauthorized client transactions  
      const unauthorizedResponse = await this.apiRequest('GET', `/clients/${TEST_CLIENTS.UNAUTHORIZED}/transactions`);
      const unauthorizedPass = unauthorizedResponse.status === 403;

      const passed = authorizedPass && unauthorizedPass;
      this.recordResult(
        'Transaction API Isolation',
        passed,
        `Authorized: ${authorizedResponse.status}, Unauthorized: ${unauthorizedResponse.status}`
      );
    } catch (error) {
      this.recordResult('Transaction API Isolation', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 4: Document API client isolation
   */
  async testDocumentApiIsolation() {
    try {
      // Test authorized client documents
      const authorizedResponse = await this.apiRequest('GET', `/clients/${TEST_CLIENTS.AUTHORIZED}/documents`);
      const authorizedPass = authorizedResponse.status === 200;

      // Test unauthorized client documents
      const unauthorizedResponse = await this.apiRequest('GET', `/clients/${TEST_CLIENTS.UNAUTHORIZED}/documents`);
      const unauthorizedPass = unauthorizedResponse.status === 403;

      const passed = authorizedPass && unauthorizedPass;
      this.recordResult(
        'Document API Isolation',
        passed,
        `Authorized: ${authorizedResponse.status}, Unauthorized: ${unauthorizedResponse.status}`
      );
    } catch (error) {
      this.recordResult('Document API Isolation', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 5: Error message security (no information leakage)
   */
  async testErrorMessageSecurity() {
    try {
      const response = await this.apiRequest('GET', `/clients/NON_EXISTENT_CLIENT`);
      
      const isGenericError = response.status === 404 && 
                           (response.data.includes('Not found') || 
                            response.data.includes('not found'));
      
      const noLeakage = !response.data.includes('NON_EXISTENT_CLIENT') &&
                       !response.data.includes('does not exist') &&
                       !response.data.includes('Client not found');

      const passed = isGenericError && noLeakage;
      this.recordResult(
        'Error Message Security',
        passed,
        `Status: ${response.status}, Message: "${response.data}"`
      );
    } catch (error) {
      this.recordResult('Error Message Security', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 6: Cross-client data leakage via URL manipulation
   */
  async testUrlManipulation() {
    try {
      // Attempt to access unauthorized client data via different endpoint patterns
      const endpoints = [
        `/clients/${TEST_CLIENTS.UNAUTHORIZED}/transactions`,
        `/clients/${TEST_CLIENTS.UNAUTHORIZED}/categories`,
        `/clients/${TEST_CLIENTS.UNAUTHORIZED}/vendors`,
        `/clients/${TEST_CLIENTS.UNAUTHORIZED}/accounts`
      ];

      let allBlocked = true;
      const results = [];

      for (const endpoint of endpoints) {
        const response = await this.apiRequest('GET', endpoint);
        const blocked = response.status === 403 || response.status === 404;
        allBlocked = allBlocked && blocked;
        results.push(`${endpoint}: ${response.status}`);
      }

      this.recordResult(
        'URL Manipulation Protection',
        allBlocked,
        `Endpoints tested: ${results.join(', ')}`
      );
    } catch (error) {
      this.recordResult('URL Manipulation Protection', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 7: Data modification attempts on unauthorized clients
   */
  async testUnauthorizedModification() {
    try {
      // Attempt to create transaction in unauthorized client
      const createResponse = await this.apiRequest('POST', `/clients/${TEST_CLIENTS.UNAUTHORIZED}/transactions`, {
        amount: 100,
        category: 'test',
        description: 'Security test transaction'
      });

      // Attempt to modify data in unauthorized client (if transaction exists)
      const updateResponse = await this.apiRequest('PUT', `/clients/${TEST_CLIENTS.UNAUTHORIZED}/transactions/test123`, {
        amount: 200
      });

      const createBlocked = createResponse.status === 403;
      const updateBlocked = updateResponse.status === 403 || updateResponse.status === 404;

      const passed = createBlocked && updateBlocked;
      this.recordResult(
        'Unauthorized Modification Protection',
        passed,
        `Create: ${createResponse.status}, Update: ${updateResponse.status}`
      );
    } catch (error) {
      this.recordResult('Unauthorized Modification Protection', false, `Error: ${error.message}`);
    }
  }

  /**
   * Run all security tests
   */
  async runAllTests() {
    console.log('🔒 Starting Client Isolation Security Test Suite');
    console.log('=' .repeat(60));

    try {
      // Initialize test environment
      await this.initializeFirebase();
      await this.createTestToken();

      console.log(`\nTesting user: ${TEST_USER_EMAIL}`);
      console.log(`Authorized client: ${TEST_CLIENTS.AUTHORIZED}`);
      console.log(`Unauthorized client: ${TEST_CLIENTS.UNAUTHORIZED}`);
      console.log('-'.repeat(60));

      // Run all tests
      await this.testClientListFiltering();
      await this.testDirectClientAccess();
      await this.testTransactionApiIsolation();
      await this.testDocumentApiIsolation();
      await this.testErrorMessageSecurity();
      await this.testUrlManipulation();
      await this.testUnauthorizedModification();

      // Generate summary
      this.generateSummary();

    } catch (error) {
      console.error('❌ Test suite failed to initialize:', error.message);
      process.exit(1);
    }
  }

  /**
   * Generate test summary
   */
  generateSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CLIENT ISOLATION SECURITY TEST RESULTS');
    console.log('='.repeat(60));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n🚨 FAILED TESTS:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`   • ${result.test}: ${result.details}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    if (failedTests === 0) {
      console.log('🎉 ALL SECURITY TESTS PASSED!');
      console.log('✅ Client isolation is properly implemented.');
    } else {
      console.log('🚨 SECURITY VULNERABILITIES DETECTED!');
      console.log('❌ Client isolation implementation has critical issues.');
      process.exit(1);
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new SecurityTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

export default SecurityTestSuite;
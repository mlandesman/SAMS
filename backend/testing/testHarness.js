import { createApiClient, getDefaultApiClient } from './apiClient.js';
import { tokenManager } from './tokenManager.js';
import { testConfig, validateConfig, isDebugMode } from './config.js';

/**
 * Universal Test Harness for SAMS Backend
 * Eliminates authentication friction and provides a simple, consistent testing interface
 */

class TestHarness {
  constructor() {
    this.testResults = [];
    this.startTime = null;
    this.backendHealthy = null;
  }

  /**
   * Run a single test with automatic authentication and error handling
   * @param {Object} testDefinition - Test configuration object
   * @param {string} testDefinition.name - Test name
   * @param {Function} testDefinition.test - Async test function
   * @param {string} testDefinition.testUser - User ID for test (optional, uses default)
   * @param {Object} testDefinition.options - Additional test options
   * @returns {Promise<Object>} - Test result
   */
  async runTest(testDefinition) {
    const {
      name,
      test,
      testUser = null,
      options = {}
    } = testDefinition;

    if (!name || !test) {
      throw new Error('Test must have "name" and "test" properties');
    }

    const testStart = Date.now();
    const testId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`\n🧪 Running Test: ${name}`);
    console.log(`   ID: ${testId}`);
    if (testUser) {
      console.log(`   User: ${testUser}`);
    }

    try {
      // Ensure backend is healthy before running test
      await this.ensureBackendHealth();

      // Create API client for the test
      const api = await createApiClient(testUser);
      const userId = testUser || tokenManager.getDefaultTestUid();
      const token = api.token;

      console.log(`   🔑 Auth: Ready (UID: ${userId})`);

      // Execute the test with all necessary context
      const testContext = {
        api,
        token,
        userId,
        config: testConfig,
        options
      };

      const result = await test(testContext);
      const duration = Date.now() - testStart;

      // Validate result format
      if (typeof result !== 'object') {
        throw new Error('Test must return an object with at least { passed: boolean }');
      }

      const testResult = {
        id: testId,
        name,
        passed: result.passed === true,
        duration,
        data: result.data || null,
        error: null,
        userId,
        timestamp: new Date().toISOString(),
        ...result // Allow test to override any fields
      };

      this.testResults.push(testResult);

      if (testResult.passed) {
        console.log(`   ✅ PASSED (${duration}ms)`);
        if (result.message) {
          console.log(`   📝 ${result.message}`);
        }
      } else {
        console.log(`   ❌ FAILED (${duration}ms)`);
        if (result.reason) {
          console.log(`   📝 ${result.reason}`);
        }
      }

      return testResult;

    } catch (error) {
      const duration = Date.now() - testStart;
      console.log(`   💥 ERROR (${duration}ms): ${error.message}`);
      
      if (isDebugMode()) {
        console.log(`   🔍 Stack: ${error.stack}`);
      }

      const testResult = {
        id: testId,
        name,
        passed: false,
        duration,
        error: error.message,
        stack: error.stack,
        userId: testUser || tokenManager.getDefaultTestUid(),
        timestamp: new Date().toISOString()
      };

      this.testResults.push(testResult);
      return testResult;
    }
  }

  /**
   * Run multiple tests in sequence
   * @param {Array<Object>} tests - Array of test definitions
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Summary of all test results
   */
  async runTests(tests, options = {}) {
    const { 
      stopOnFailure = false,
      showSummary = true 
    } = options;

    console.log(`\n🚀 Starting Test Suite: ${tests.length} tests`);
    this.startTime = Date.now();

    const results = [];
    
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const result = await this.runTest(test);
      results.push(result);

      if (stopOnFailure && !result.passed) {
        console.log(`\n⏹️  Stopping test suite due to failure in: ${test.name}`);
        break;
      }
    }

    if (showSummary) {
      this.showSummary();
    }

    return {
      totalTests: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      duration: Date.now() - this.startTime,
      results
    };
  }

  /**
   * Check if backend is running and healthy
   * @returns {Promise<boolean>} - True if backend is healthy
   */
  async ensureBackendHealth() {
    if (this.backendHealthy === true) {
      return true;
    }

    try {
      const api = await getDefaultApiClient();
      const health = await api.healthCheck();
      
      if (health.healthy) {
        console.log('✅ Backend is healthy');
        this.backendHealthy = true;
        return true;
      } else {
        console.error('❌ Backend health check failed:', health.error);
        console.error('💡 Suggestion:', health.suggestion);
        throw new Error(`Backend not healthy: ${health.error}`);
      }
    } catch (error) {
      console.error('💥 Cannot connect to backend:', error.message);
      console.error(`🔗 Expected backend at: ${testConfig.API_BASE_URL}`);
      console.error('💡 Make sure the backend is running with: npm run dev');
      throw error;
    }
  }

  /**
   * Display a summary of test results
   */
  showSummary() {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = total - passed;
    const duration = this.startTime ? Date.now() - this.startTime : 0;

    console.log(`\n📊 Test Summary`);
    console.log(`   Total: ${total}`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏱️  Duration: ${duration}ms`);

    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   • ${r.name}: ${r.error || r.reason || 'Unknown failure'}`);
        });
    }

    console.log(`\n${failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed'}`);
  }

  /**
   * Clear test results and reset harness
   */
  reset() {
    this.testResults = [];
    this.startTime = null;
    this.backendHealthy = null;
    tokenManager.clearCache();
  }

  /**
   * Get configuration validation results
   * @returns {Object} - Configuration validation
   */
  validateConfiguration() {
    return validateConfig();
  }
}

// Create singleton instance
const testHarness = new TestHarness();

/**
 * Quick helper functions for common test patterns
 */

/**
 * Simple API test helper
 * @param {string} name - Test name
 * @param {string} endpoint - API endpoint to test
 * @param {Object} options - Test options
 * @returns {Promise<Object>} - Test result
 */
async function quickApiTest(name, endpoint, options = {}) {
  const { method = 'GET', data = null, expectedStatus = 200 } = options;
  
  return await testHarness.runTest({
    name,
    async test({ api }) {
      const response = await api.request({
        method,
        url: endpoint,
        data
      });

      const passed = response.status === expectedStatus;
      return {
        passed,
        data: response.data,
        actualStatus: response.status,
        expectedStatus,
        reason: passed ? null : `Expected status ${expectedStatus}, got ${response.status}`
      };
    }
  });
}

/**
 * Test user profile endpoint (common test)
 * @returns {Promise<Object>} - Test result
 */
async function testUserProfile() {
  return await quickApiTest(
    'Get User Profile',
    testConfig.ENDPOINTS.USER_PROFILE
  );
}

/**
 * Test user clients endpoint (common test)
 * @returns {Promise<Object>} - Test result
 */
async function testUserClients() {
  return await quickApiTest(
    'Get User Clients',
    testConfig.ENDPOINTS.USER_CLIENTS
  );
}

// Export everything needed for testing
export {
  testHarness,
  quickApiTest,
  testUserProfile,
  testUserClients,
  createApiClient,
  tokenManager,
  testConfig
};
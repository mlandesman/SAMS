import { createApiClient, getDefaultApiClient } from './apiClient.js';
import { tokenManager } from './tokenManager.js';
import { testConfig, validateConfig, isDebugMode } from './config.js';
import fs from 'fs';
import path from 'path';

/**
 * Universal Test Harness for SAMS Backend
 * Eliminates authentication friction and provides a simple, consistent testing interface
 */

class TestHarness {
  constructor() {
    this.testResults = [];
    this.startTime = null;
    this.backendHealthy = null;
    this.logFilePath = null;
    this.consoleOutput = [];
    
    // Set up file logging if enabled
    if (testConfig.FILE_LOGGING.ENABLED) {
      this.initializeFileLogging();
    }
  }

  /**
   * Initialize file logging system
   */
  initializeFileLogging() {
    try {
      const logDir = testConfig.FILE_LOGGING.LOG_DIRECTORY;
      
      // Create log directory if it doesn't exist
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                       new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('Z')[0];
      const filename = testConfig.FILE_LOGGING.LOG_FILENAME_PATTERN.replace('{timestamp}', timestamp);
      this.logFilePath = path.join(logDir, filename);
      
      // Clean up old log files if configured
      this.cleanupOldLogs();
      
      console.log(`📝 Test logging enabled: ${this.logFilePath}`);
    } catch (error) {
      console.warn(`⚠️ Could not initialize file logging: ${error.message}`);
      this.logFilePath = null;
    }
  }

  /**
   * Clean up old log files based on AUTO_CLEANUP_DAYS configuration
   */
  cleanupOldLogs() {
    try {
      const logDir = testConfig.FILE_LOGGING.LOG_DIRECTORY;
      const cleanupDays = testConfig.FILE_LOGGING.AUTO_CLEANUP_DAYS;
      
      if (!cleanupDays || cleanupDays <= 0) return;
      
      const cutoffTime = Date.now() - (cleanupDays * 24 * 60 * 60 * 1000);
      const files = fs.readdirSync(logDir);
      
      files.forEach(file => {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime && file.startsWith('test-results-')) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Cleaned up old log file: ${file}`);
        }
      });
    } catch (error) {
      console.warn(`⚠️ Could not cleanup old logs: ${error.message}`);
    }
  }

  /**
   * Log console output for inclusion in file log
   */
  logConsoleOutput(message) {
    if (testConfig.FILE_LOGGING.INCLUDE_CONSOLE_OUTPUT) {
      this.consoleOutput.push({
        timestamp: new Date().toISOString(),
        message: message
      });
    }
  }

  /**
   * Log to both console and file (if enabled)
   */
  log(message) {
    console.log(message);
    this.logConsoleOutput(message);
  }

  /**
   * Write test results to file
   */
  async writeLogFile() {
    if (!this.logFilePath || !testConfig.FILE_LOGGING.ENABLED) {
      return;
    }

    try {
      const logData = {
        metadata: {
          timestamp: new Date().toISOString(),
          testHarnessVersion: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          apiBaseUrl: testConfig.API_BASE_URL,
          totalTests: this.testResults.length,
          passedTests: this.testResults.filter(r => r.passed).length,
          failedTests: this.testResults.filter(r => !r.passed).length,
          totalDuration: this.startTime ? Date.now() - this.startTime : 0
        },
        configuration: {
          debugMode: isDebugMode(),
          defaultTestUid: testConfig.DEFAULT_TEST_UID,
          timeout: testConfig.DEFAULT_TIMEOUT
        },
        testResults: this.testResults,
        consoleOutput: this.consoleOutput,
        summary: this.generateSummaryData()
      };

      const jsonData = JSON.stringify(logData, null, 2);
      
      if (testConfig.FILE_LOGGING.APPEND_MODE && fs.existsSync(this.logFilePath)) {
        // Append mode - read existing, add new data, write back
        const existingData = JSON.parse(fs.readFileSync(this.logFilePath, 'utf8'));
        existingData.testResults = existingData.testResults.concat(logData.testResults);
        existingData.consoleOutput = existingData.consoleOutput.concat(logData.consoleOutput);
        existingData.metadata.totalTests = existingData.testResults.length;
        existingData.metadata.passedTests = existingData.testResults.filter(r => r.passed).length;
        existingData.metadata.failedTests = existingData.testResults.filter(r => !r.passed).length;
        
        fs.writeFileSync(this.logFilePath, JSON.stringify(existingData, null, 2));
      } else {
        // New file mode
        fs.writeFileSync(this.logFilePath, jsonData);
      }
      
      console.log(`📁 Test results saved to: ${this.logFilePath}`);
      
    } catch (error) {
      console.error(`❌ Failed to write log file: ${error.message}`);
    }
  }

  /**
   * Generate summary data for the log file
   */
  generateSummaryData() {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = total - passed;
    
    return {
      total,
      passed,
      failed,
      successRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      averageDuration: total > 0 ? Math.round(this.testResults.reduce((sum, r) => sum + r.duration, 0) / total) : 0,
      startTime: this.startTime,
      endTime: Date.now()
    };
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
    
    // Automatically write log file when showing summary
    if (testConfig.FILE_LOGGING.ENABLED) {
      this.writeLogFile().catch(error => {
        console.error(`❌ Failed to save log file: ${error.message}`);
      });
    }
  }

  /**
   * Clear test results and reset harness
   */
  reset() {
    this.testResults = [];
    this.startTime = null;
    this.backendHealthy = null;
    this.consoleOutput = [];
    this.logFilePath = null;
    tokenManager.clearCache();
    
    // Reinitialize file logging if enabled
    if (testConfig.FILE_LOGGING.ENABLED) {
      this.initializeFileLogging();
    }
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
/**
 * Test Execution Script for SAMS Users/Auth Security Verification
 * 
 * This script executes the comprehensive test plan defined in TEST_PLAN_USERS_AUTH_COMPLETE.yaml
 * Expected execution time: 2-3 hours for all 85 tests
 * 
 * Usage: node execute_test_plan.js [options]
 * Options:
 *   --category <name>  Run only tests from specific category
 *   --test <id>        Run specific test by ID
 *   --dry-run          Show what would be tested without executing
 *   --verbose          Show detailed output for each test
 *   --report <file>    Save results to specified file
 */

import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { testHarness, createApiClient, tokenManager } from './testHarness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const CONFIG = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5001',
  testPlanPath: path.join(__dirname, 'TEST_PLAN_USERS_AUTH_COMPLETE.yaml'),
  reportPath: path.join(__dirname, 'test-results.json'),
  tokens: {
    VALID_TOKEN: null,
    EXPIRED_TOKEN: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImV4cGlyZWQifQ.expired.token',
    DIFFERENT_PROJECT_TOKEN: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImRpZmZlcmVudCJ9.different.token',
    ADMIN_TOKEN: null,
    REGULAR_USER_TOKEN: null,
    LIMITED_USER_TOKEN: null,
    REGULAR_ADMIN_TOKEN: null
  }
};

// Test result tracking
const results = {
  totalTests: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  startTime: new Date(),
  endTime: null,
  categories: {},
  details: []
};

/**
 * Load test plan from YAML file
 */
async function loadTestPlan() {
  try {
    const fileContents = fs.readFileSync(CONFIG.testPlanPath, 'utf8');
    const testPlan = yaml.load(fileContents);
    console.log(chalk.green(`✓ Loaded test plan with ${Object.keys(testPlan).filter(k => k.includes('-')).length} tests`));
    return testPlan;
  } catch (error) {
    console.error(chalk.red('✗ Failed to load test plan:'), error.message);
    process.exit(1);
  }
}

/**
 * Initialize Firebase Admin SDK and get test tokens
 */
async function initializeTokens() {
  try {
    console.log(chalk.yellow('→ Initializing test tokens...'));
    
    // Initialize Firebase Admin if not already done
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    
    // Create test users and get tokens
    // This is a template - implement based on your auth setup
    
    // For now, use placeholder tokens
    CONFIG.tokens.VALID_TOKEN = process.env.TEST_USER_TOKEN || 'placeholder-valid-token';
    CONFIG.tokens.ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN || 'placeholder-admin-token';
    CONFIG.tokens.REGULAR_USER_TOKEN = process.env.TEST_REGULAR_USER_TOKEN || 'placeholder-regular-token';
    CONFIG.tokens.LIMITED_USER_TOKEN = process.env.TEST_LIMITED_USER_TOKEN || 'placeholder-limited-token';
    CONFIG.tokens.REGULAR_ADMIN_TOKEN = process.env.TEST_REGULAR_ADMIN_TOKEN || 'placeholder-regular-admin-token';
    
    console.log(chalk.green('✓ Test tokens initialized'));
  } catch (error) {
    console.error(chalk.red('✗ Failed to initialize tokens:'), error.message);
    process.exit(1);
  }
}

/**
 * Execute a single test
 */
async function executeTest(testId, testSpec) {
  const startTime = Date.now();
  const result = {
    testId,
    category: testSpec.Category,
    description: testSpec.Description,
    status: 'pending',
    duration: 0,
    error: null,
    actualResult: null
  };
  
  try {
    console.log(chalk.blue(`\n→ Running ${testId}: ${testSpec.Description}`));
    
    // Replace token placeholders
    let url = testSpec.Request.URL;
    let headers = { ...testSpec.Request.Headers };
    let body = testSpec.Request.Body;
    
    // Replace tokens in headers
    if (headers.Authorization) {
      headers.Authorization = headers.Authorization.replace(/\${(\w+)}/g, (match, token) => {
        return CONFIG.tokens[token] || match;
      });
    }
    
    // Replace tokens in body if it's a string
    if (typeof body === 'string') {
      body = body.replace(/\${(\w+)}/g, (match, token) => {
        return CONFIG.tokens[token] || match;
      });
    }
    
    // Make the request
    const requestConfig = {
      method: testSpec.Method,
      url: url.replace('http://localhost:5001', CONFIG.backendUrl),
      headers,
      data: body,
      validateStatus: () => true, // Don't throw on any status
      timeout: 30000
    };
    
    const response = await axios(requestConfig);
    
    // Check if response matches expected
    const expectedStatus = testSpec['Expected Result'].Status;
    const expectedBody = testSpec['Expected Result'].Body;
    
    result.actualResult = {
      status: response.status,
      body: response.data
    };
    
    // Validate status code
    if (response.status !== expectedStatus) {
      result.status = 'failed';
      result.error = `Expected status ${expectedStatus}, got ${response.status}`;
    } else {
      // Validate response body
      let bodyMatches = true;
      let mismatchDetails = [];
      
      if (expectedBody) {
        for (const [key, value] of Object.entries(expectedBody)) {
          if (!response.data.hasOwnProperty(key)) {
            bodyMatches = false;
            mismatchDetails.push(`Missing field: ${key}`);
          } else if (typeof value === 'object' && value !== null) {
            // Deep comparison for objects/arrays
            if (JSON.stringify(response.data[key]) !== JSON.stringify(value)) {
              bodyMatches = false;
              mismatchDetails.push(`Field ${key} mismatch`);
            }
          } else if (response.data[key] !== value) {
            bodyMatches = false;
            mismatchDetails.push(`Field ${key}: expected "${value}", got "${response.data[key]}"`);
          }
        }
      }
      
      if (bodyMatches) {
        result.status = 'passed';
        console.log(chalk.green(`  ✓ Test passed (${response.status})`));
      } else {
        result.status = 'failed';
        result.error = `Body validation failed: ${mismatchDetails.join(', ')}`;
      }
    }
    
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    console.log(chalk.red(`  ✗ Test failed: ${error.message}`));
  }
  
  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Execute all tests in a category
 */
async function executeCategory(category, tests) {
  console.log(chalk.cyan(`\n━━━ Testing Category: ${category} ━━━`));
  const categoryResults = {
    total: tests.length,
    passed: 0,
    failed: 0,
    tests: []
  };
  
  for (const [testId, testSpec] of tests) {
    if (testSpec.Category === category) {
      const result = await executeTest(testId, testSpec);
      categoryResults.tests.push(result);
      
      if (result.status === 'passed') {
        categoryResults.passed++;
        results.passed++;
      } else {
        categoryResults.failed++;
        results.failed++;
      }
      
      results.details.push(result);
      
      // Add small delay between tests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  results.categories[category] = categoryResults;
  console.log(chalk.cyan(`Category complete: ${categoryResults.passed}/${categoryResults.total} passed`));
}

/**
 * Generate test report
 */
function generateReport() {
  results.endTime = new Date();
  const duration = (results.endTime - results.startTime) / 1000 / 60; // minutes
  
  console.log(chalk.yellow('\n━━━ TEST EXECUTION SUMMARY ━━━'));
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(chalk.green(`Passed: ${results.passed}`));
  console.log(chalk.red(`Failed: ${results.failed}`));
  console.log(chalk.gray(`Skipped: ${results.skipped}`));
  console.log(`Duration: ${duration.toFixed(1)} minutes`);
  console.log(`Success Rate: ${((results.passed / results.totalTests) * 100).toFixed(1)}%`);
  
  // Category breakdown
  console.log(chalk.yellow('\n━━━ CATEGORY BREAKDOWN ━━━'));
  for (const [category, data] of Object.entries(results.categories)) {
    const rate = ((data.passed / data.total) * 100).toFixed(1);
    console.log(`${category}: ${data.passed}/${data.total} (${rate}%)`);
  }
  
  // Failed tests
  const failedTests = results.details.filter(t => t.status === 'failed');
  if (failedTests.length > 0) {
    console.log(chalk.red('\n━━━ FAILED TESTS ━━━'));
    for (const test of failedTests) {
      console.log(chalk.red(`✗ ${test.testId}: ${test.description}`));
      console.log(chalk.gray(`  Error: ${test.error}`));
    }
  }
  
  // Save detailed report
  fs.writeFileSync(CONFIG.reportPath, JSON.stringify(results, null, 2));
  console.log(chalk.green(`\n✓ Detailed report saved to: ${CONFIG.reportPath}`));
}

/**
 * Main execution function
 */
async function main() {
  console.log(chalk.bold.cyan('SAMS Users/Auth Security Test Execution'));
  console.log(chalk.gray('━'.repeat(50)));
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    category: null,
    testId: null,
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose')
  };
  
  // Extract category or test ID
  const categoryIndex = args.indexOf('--category');
  if (categoryIndex !== -1 && args[categoryIndex + 1]) {
    options.category = args[categoryIndex + 1];
  }
  
  const testIndex = args.indexOf('--test');
  if (testIndex !== -1 && args[testIndex + 1]) {
    options.testId = args[testIndex + 1];
  }
  
  // Load test plan
  const testPlan = await loadTestPlan();
  
  // Initialize tokens
  await initializeTokens();
  
  // Get all tests (excluding metadata)
  const allTests = Object.entries(testPlan).filter(([key]) => key.includes('-'));
  results.totalTests = allTests.length;
  
  // Dry run mode
  if (options.dryRun) {
    console.log(chalk.yellow('\n━━━ DRY RUN MODE ━━━'));
    const categories = [...new Set(allTests.map(([, spec]) => spec.Category))];
    console.log(`Would run ${allTests.length} tests across ${categories.length} categories:`);
    categories.forEach(cat => {
      const count = allTests.filter(([, spec]) => spec.Category === cat).length;
      console.log(`  - ${cat}: ${count} tests`);
    });
    return;
  }
  
  // Execute tests
  if (options.testId) {
    // Run single test
    const test = allTests.find(([id]) => id === options.testId);
    if (test) {
      await executeTest(test[0], test[1]);
    } else {
      console.error(chalk.red(`Test ${options.testId} not found`));
    }
  } else if (options.category) {
    // Run category
    await executeCategory(options.category, allTests);
  } else {
    // Run all tests by category
    const categories = [...new Set(allTests.map(([, spec]) => spec.Category))];
    for (const category of categories) {
      await executeCategory(category, allTests);
    }
  }
  
  // Generate report
  generateReport();
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\n✗ Unhandled error:'), error);
  process.exit(1);
});

// Run the tests
main().catch(error => {
  console.error(chalk.red('\n✗ Execution failed:'), error);
  process.exit(1);
});
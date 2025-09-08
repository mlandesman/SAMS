/**
 * Real Test Execution Using Test Harness
 * Executes tests from TEST_PLAN_USERS_AUTH_COMPLETE.yaml
 */

import { testHarness } from './testHarness.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test plan
const testPlanPath = path.join(__dirname, 'TEST_PLAN_USERS_AUTH_COMPLETE.yaml');
let testPlan;
try {
  // Fix the YAML by reading as string first
  let yamlContent = fs.readFileSync(testPlanPath, 'utf8');
  // Fix the duplicate Authorization header issue in EDGE-011
  yamlContent = yamlContent.replace(
    'Authorization: "Bearer ${TOKEN1}"\n      Authorization: "Bearer ${TOKEN2}"',
    'Authorization: ["Bearer ${TOKEN1}", "Bearer ${TOKEN2}"]'
  );
  testPlan = yaml.load(yamlContent);
  console.log('✅ Test plan loaded successfully');
} catch (error) {
  console.error('❌ Failed to load test plan:', error.message);
  process.exit(1);
}

// Import axios for auth-less tests
import axios from 'axios';

// Convert test spec to test harness format
function convertTestToHarnessFormat(testId, testSpec) {
  // Special case: Tests that need to be run WITHOUT authentication
  if (testSpec.Description.includes('without any authorization') || 
      testSpec.Description.includes('without authorization') ||
      testSpec.Description.includes('No authorization header')) {
    
    return {
      name: `${testId}: ${testSpec.Description}`,
      async test() {
        const startTime = Date.now();
        
        try {
          console.log('   🔓 Running WITHOUT authentication (raw HTTP request)');
          
          // Use raw axios without any auth headers
          const response = await axios({
            method: testSpec.Method,
            url: testSpec.Request.URL,
            headers: testSpec.Request.Headers || {},
            data: testSpec.Request.Body,
            validateStatus: () => true // Accept any status code
          });
          
          const expectedStatus = testSpec['Expected Result'].Status;
          const expectedBody = testSpec['Expected Result'].Body;
          const passed = response.status === expectedStatus;
          
          let message = `Expected status ${expectedStatus}, got ${response.status}`;
          if (passed && expectedBody) {
            const bodyMatches = checkBodyMatch(response.data, expectedBody);
            if (!bodyMatches.matches) {
              passed = false;
              message = `Status OK but ${bodyMatches.reason}`;
            }
          }
          
          console.log(`   📊 Raw Response: ${response.status} - ${JSON.stringify(response.data)}`);
          
          return {
            passed: passed,
            actualStatus: response.status,
            expectedStatus: expectedStatus,
            actualBody: response.data,
            expectedBody: expectedBody,
            message: passed ? testSpec['Expected Result']['Plain English'] : message,
            securityImpact: testSpec['Security Impact'],
            duration: Date.now() - startTime
          };
          
        } catch (error) {
          return {
            passed: false,
            error: error.message,
            actualStatus: error.response?.status,
            expectedStatus: testSpec['Expected Result'].Status,
            message: `Test error: ${error.message}`,
            duration: Date.now() - startTime
          };
        }
      }
    };
  }
  
  // Regular test using test harness with auth
  return {
    name: `${testId}: ${testSpec.Description}`,
    async test({ api }) {
      const startTime = Date.now();
      
      try {
        // Prepare headers
        const headers = { ...testSpec.Request.Headers };
        
        // Special handling for auth tests with specific tokens
        if (testId.startsWith('AUTH-') && headers.Authorization) {
          // For tests that need specific auth tokens, set them directly
          if (headers.Authorization.includes('${')) {
            // Replace token placeholders with test values
            headers.Authorization = headers.Authorization
              .replace('${EXPIRED_TOKEN}', 'eyJhbGciOiJIUzI1NiIsImV4cCI6MTAwMH0.expired.token')
              .replace('${DIFFERENT_PROJECT_TOKEN}', 'eyJhbGciOiJIUzI1NiIsInByb2plY3QiOiJvdGhlciJ9.different.project')
              .replace('${VALID_TOKEN}', api.token || 'valid-token')
              .replace('${ADMIN_TOKEN}', api.token || 'admin-token')
              .replace('${VERY_LONG_STRING}', 'A'.repeat(10000))
              .replace("' OR 1=1--", "' OR 1=1--");
          }
          // Override the test harness auth
          api.defaults.headers.common['Authorization'] = headers.Authorization;
        }
        
        // Prepare URL - remove base URL if present
        const url = testSpec.Request.URL.replace('http://localhost:5001', '');
        
        // Make the request
        const response = await api.request({
          method: testSpec.Method,
          url: url,
          headers: headers,
          data: testSpec.Request.Body,
          validateStatus: () => true // Accept any status code
        });
        
        // Check results
        const expectedStatus = testSpec['Expected Result'].Status;
        const expectedBody = testSpec['Expected Result'].Body;
        let passed = response.status === expectedStatus;
        
        let message = `Expected status ${expectedStatus}, got ${response.status}`;
        if (passed && expectedBody) {
          // Simple body check for key fields
          const bodyMatches = checkBodyMatch(response.data, expectedBody);
          if (!bodyMatches.matches) {
            passed = false;
            message = `Status OK but ${bodyMatches.reason}`;
          }
        }
        
        return {
          passed: passed,
          actualStatus: response.status,
          expectedStatus: expectedStatus,
          actualBody: response.data,
          expectedBody: expectedBody,
          message: passed ? testSpec['Expected Result']['Plain English'] : message,
          securityImpact: testSpec['Security Impact'],
          duration: Date.now() - startTime
        };
        
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          actualStatus: error.response?.status,
          expectedStatus: testSpec['Expected Result'].Status,
          message: `Test error: ${error.message}`,
          duration: Date.now() - startTime
        };
      }
    }
  };
}

// Check if response body matches expected
function checkBodyMatch(actual, expected) {
  if (!expected) return { matches: true };
  
  for (const [key, value] of Object.entries(expected)) {
    if (!actual || !actual.hasOwnProperty(key)) {
      return { matches: false, reason: `missing field '${key}'` };
    }
    if (actual[key] !== value) {
      return { 
        matches: false, 
        reason: `field '${key}' expected '${value}' but got '${actual[key]}'` 
      };
    }
  }
  return { matches: true };
}

// Main execution
async function main() {
  console.log('\n🚀 Starting REAL Test Execution with Test Harness');
  console.log('=' + '='.repeat(59));
  
  // Get first 5 tests for initial execution
  const allTests = Object.entries(testPlan)
    .filter(([key]) => key.includes('-') && !key.startsWith('metadata'));
  
  const firstFiveTests = allTests.slice(0, 5);
  
  console.log(`\n📋 Executing first 5 tests for verification:`);
  firstFiveTests.forEach(([id, spec]) => {
    console.log(`  - ${id}: ${spec.Description}`);
  });
  console.log('\n' + '-'.repeat(60) + '\n');
  
  // Execute first 5 tests
  const results = [];
  for (const [testId, testSpec] of firstFiveTests) {
    const harnessTest = convertTestToHarnessFormat(testId, testSpec);
    const result = await testHarness.runTest(harnessTest);
    results.push({
      ...result,
      testId: testId,
      category: testSpec.Category,
      endpoint: `${testSpec.Method} ${testSpec.Endpoint}`
    });
    
    // Show actual response data
    console.log(`   📊 Response Data:`);
    console.log(`      Status: ${result.actualStatus}`);
    console.log(`      Body: ${JSON.stringify(result.actualBody || result.data, null, 2).split('\n').map(l => '      ' + l).join('\n')}`);
    console.log('');
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary of first 5 tests
  console.log('\n' + '='.repeat(60));
  console.log('📊 First 5 Tests Summary:');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  
  console.log(`Total: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach((r, i) => {
    const status = r.passed ? '✅' : '❌';
    console.log(`\n${i + 1}. ${status} ${r.testId} - ${r.name}`);
    console.log(`   Endpoint: ${r.endpoint}`);
    console.log(`   Status: ${r.actualStatus} (expected ${r.expectedStatus})`);
    console.log(`   Duration: ${r.duration}ms`);
    if (!r.passed) {
      console.log(`   Error: ${r.error || r.message}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ First 5 tests executed with REAL test harness');
  console.log('📝 Waiting for approval to continue with remaining 80 tests...');
  console.log('='.repeat(60));
}

// Execute
main().catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});
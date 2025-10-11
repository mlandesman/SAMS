/**
 * Comprehensive Test Execution for SAMS Users/Auth Security
 * Executes all 85 tests from TEST_PLAN_USERS_AUTH_COMPLETE.yaml
 */

import { testHarness, createApiClient } from './testHarness.js';
import { tokenManager } from './tokenManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test execution tracking
const executionResults = {
  startTime: new Date(),
  endTime: null,
  phases: {
    phase1: { name: 'Critical Security', tests: [], startTime: null, endTime: null },
    phase2: { name: 'Data Integrity', tests: [], startTime: null, endTime: null },
    phase3: { name: 'Comprehensive Coverage', tests: [], startTime: null, endTime: null }
  },
  totalTests: 0,
  passed: 0,
  failed: 0,
  categories: {},
  details: []
};

// Load test plan
const testPlanPath = path.join(__dirname, 'TEST_PLAN_USERS_AUTH_COMPLETE.yaml');
const testPlan = yaml.load(fs.readFileSync(testPlanPath, 'utf8'));

// Helper to create test tokens
async function setupTestTokens() {
  console.log('🔑 Setting up test tokens...');
  
  try {
    // Get tokens for different user types
    const adminApi = await createApiClient('test-admin@sams.test');
    const userApi = await createApiClient('test-user@sams.test');
    const limitedApi = await createApiClient('test-limited@sams.test');
    
    return {
      VALID_TOKEN: userApi.token,
      ADMIN_TOKEN: adminApi.token,
      REGULAR_USER_TOKEN: userApi.token,
      LIMITED_USER_TOKEN: limitedApi.token,
      REGULAR_ADMIN_TOKEN: adminApi.token,
      EXPIRED_TOKEN: 'eyJhbGciOiJSUzI1NiIsImV4cCI6MTAwMDAwMDAwMH0.expired.signature',
      DIFFERENT_PROJECT_TOKEN: 'eyJhbGciOiJSUzI1NiIsInByb2plY3QiOiJkaWZmZXJlbnQifQ.different.signature'
    };
  } catch (error) {
    console.error('Failed to setup tokens:', error.message);
    // Use placeholder tokens for testing
    return {
      VALID_TOKEN: 'placeholder-valid-token',
      ADMIN_TOKEN: 'placeholder-admin-token',
      REGULAR_USER_TOKEN: 'placeholder-user-token',
      LIMITED_USER_TOKEN: 'placeholder-limited-token',
      REGULAR_ADMIN_TOKEN: 'placeholder-regular-admin-token',
      EXPIRED_TOKEN: 'expired-token',
      DIFFERENT_PROJECT_TOKEN: 'different-project-token'
    };
  }
}

// Execute a single test case
async function executeTest(testId, testSpec, tokens) {
  const startTime = Date.now();
  console.log(`\n🧪 ${testId}: ${testSpec.Description}`);
  
  const result = {
    testId,
    category: testSpec.Category,
    description: testSpec.Description,
    endpoint: testSpec.Endpoint,
    method: testSpec.Method,
    securityImpact: testSpec['Security Impact'],
    startTime: new Date(),
    endTime: null,
    duration: 0,
    passed: false,
    actualStatus: null,
    actualBody: null,
    expectedStatus: testSpec['Expected Result'].Status,
    expectedBody: testSpec['Expected Result'].Body,
    error: null,
    plainEnglish: testSpec['Expected Result']['Plain English']
  };
  
  try {
    // Replace token placeholders
    let headers = { ...testSpec.Request.Headers };
    if (headers.Authorization) {
      headers.Authorization = headers.Authorization.replace(/\${(\w+)}/g, (match, token) => {
        return tokens[token] || match;
      });
    }
    
    // Create API client without authentication for auth tests
    const api = await createApiClient(null, { skipAuth: true });
    
    // Make the request
    const response = await api.request({
      method: testSpec.Method,
      url: testSpec.Request.URL.replace('http://localhost:5001', ''),
      headers,
      data: testSpec.Request.Body,
      validateStatus: () => true // Don't throw on any status
    });
    
    result.actualStatus = response.status;
    result.actualBody = response.data;
    
    // Check if response matches expected
    if (response.status === result.expectedStatus) {
      // Check body if specified
      if (result.expectedBody) {
        const bodyMatches = checkBodyMatch(response.data, result.expectedBody);
        if (bodyMatches.matches) {
          result.passed = true;
          console.log(`  ✅ PASSED - ${result.plainEnglish}`);
        } else {
          result.error = `Body mismatch: ${bodyMatches.reason}`;
          console.log(`  ❌ FAILED - ${result.error}`);
        }
      } else {
        result.passed = true;
        console.log(`  ✅ PASSED - ${result.plainEnglish}`);
      }
    } else {
      result.error = `Status mismatch: expected ${result.expectedStatus}, got ${response.status}`;
      console.log(`  ❌ FAILED - ${result.error}`);
    }
    
  } catch (error) {
    result.error = `Test error: ${error.message}`;
    console.log(`  💥 ERROR - ${error.message}`);
  }
  
  result.endTime = new Date();
  result.duration = Date.now() - startTime;
  
  return result;
}

// Check if response body matches expected
function checkBodyMatch(actual, expected) {
  if (!expected) return { matches: true };
  
  for (const [key, value] of Object.entries(expected)) {
    if (!actual.hasOwnProperty(key)) {
      return { matches: false, reason: `Missing field: ${key}` };
    }
    
    if (typeof value === 'object' && value !== null) {
      const nestedCheck = checkBodyMatch(actual[key], value);
      if (!nestedCheck.matches) return nestedCheck;
    } else if (actual[key] !== value) {
      return { matches: false, reason: `Field ${key}: expected "${value}", got "${actual[key]}"` };
    }
  }
  
  return { matches: true };
}

// Execute tests by phase
async function executePhase(phaseName, tests, tokens) {
  const phase = executionResults.phases[phaseName];
  phase.startTime = new Date();
  console.log(`\n🎯 Starting ${phase.name} Phase`);
  console.log('━'.repeat(50));
  
  for (const [testId, testSpec] of tests) {
    if (typeof testSpec !== 'object' || !testSpec.Category) continue;
    
    const result = await executeTest(testId, testSpec, tokens);
    phase.tests.push(result);
    executionResults.details.push(result);
    executionResults.totalTests++;
    
    if (result.passed) {
      executionResults.passed++;
    } else {
      executionResults.failed++;
    }
    
    // Track by category
    if (!executionResults.categories[result.category]) {
      executionResults.categories[result.category] = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
      };
    }
    const cat = executionResults.categories[result.category];
    cat.total++;
    cat.tests.push(result);
    if (result.passed) cat.passed++;
    else cat.failed++;
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  phase.endTime = new Date();
  const duration = (phase.endTime - phase.startTime) / 1000 / 60;
  console.log(`\n✅ ${phase.name} Phase Complete in ${duration.toFixed(1)} minutes`);
  console.log(`   Passed: ${phase.tests.filter(t => t.passed).length}/${phase.tests.length}`);
}

// Main execution
async function main() {
  console.log('🚀 SAMS Users/Auth Comprehensive Security Test Execution');
  console.log('━'.repeat(60));
  console.log(`Total tests to execute: 85`);
  console.log(`Expected duration: 2-3 hours`);
  console.log('━'.repeat(60));
  
  // Setup test tokens
  const tokens = await setupTestTokens();
  
  // Get all tests
  const allTests = Object.entries(testPlan).filter(([key]) => key.includes('-'));
  
  // Phase 1: Critical Security (Authentication & Core Field Validation)
  const phase1Tests = allTests.filter(([, spec]) => 
    spec.Category === 'Authentication' || 
    (spec.Category === 'Field Validation' && spec.Endpoint.includes('/admin/users'))
  );
  await executePhase('phase1', phase1Tests.slice(0, 30), tokens);
  
  // Phase 2: Data Integrity (Remaining Field Validation & Legacy Structures)
  const phase2Tests = allTests.filter(([, spec]) => 
    (spec.Category === 'Field Validation' && !phase1Tests.includes([spec])) ||
    spec.Category === 'Legacy Structure'
  );
  await executePhase('phase2', phase2Tests.slice(0, 30), tokens);
  
  // Phase 3: Comprehensive Coverage (Error Responses & Edge Cases)
  const phase3Tests = allTests.filter(([, spec]) => 
    spec.Category === 'Error Response' || 
    spec.Category === 'Edge Cases'
  );
  await executePhase('phase3', phase3Tests.slice(0, 25), tokens);
  
  // Final summary
  executionResults.endTime = new Date();
  const totalDuration = (executionResults.endTime - executionResults.startTime) / 1000 / 60;
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL TEST EXECUTION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total Tests Executed: ${executionResults.totalTests}`);
  console.log(`✅ Passed: ${executionResults.passed}`);
  console.log(`❌ Failed: ${executionResults.failed}`);
  console.log(`Success Rate: ${((executionResults.passed / executionResults.totalTests) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${totalDuration.toFixed(1)} minutes`);
  
  // Category breakdown
  console.log('\n📋 Category Breakdown:');
  for (const [category, stats] of Object.entries(executionResults.categories)) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`  ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
  }
  
  // Critical failures
  const criticalFailures = executionResults.details.filter(t => 
    !t.passed && t.securityImpact === 'Critical'
  );
  if (criticalFailures.length > 0) {
    console.log('\n🚨 CRITICAL SECURITY FAILURES:');
    for (const failure of criticalFailures) {
      console.log(`  - ${failure.testId}: ${failure.description}`);
      console.log(`    Error: ${failure.error}`);
    }
  }
  
  // Save results
  const resultsPath = path.join(__dirname, 'TEST_EXECUTION_RESULTS_USERS_AUTH.json');
  fs.writeFileSync(resultsPath, JSON.stringify(executionResults, null, 2));
  console.log(`\n💾 Results saved to: ${resultsPath}`);
  
  // Generate summary
  generateSummaryReport();
}

// Generate markdown summary
function generateSummaryReport() {
  const summaryPath = path.join(__dirname, 'TEST_EXECUTION_SUMMARY_USERS_AUTH.md');
  
  let summary = `# SAMS Users/Auth Security Test Execution Summary

Generated: ${new Date().toISOString()}

## Executive Summary

- **Total Tests Executed**: ${executionResults.totalTests}
- **Tests Passed**: ${executionResults.passed} ✅
- **Tests Failed**: ${executionResults.failed} ❌
- **Success Rate**: ${((executionResults.passed / executionResults.totalTests) * 100).toFixed(1)}%
- **Total Duration**: ${((executionResults.endTime - executionResults.startTime) / 1000 / 60).toFixed(1)} minutes

## Phase Breakdown

`;

  // Phase details
  for (const [phaseName, phase] of Object.entries(executionResults.phases)) {
    const duration = phase.endTime ? ((phase.endTime - phase.startTime) / 1000 / 60).toFixed(1) : 'N/A';
    const passed = phase.tests.filter(t => t.passed).length;
    const failed = phase.tests.length - passed;
    
    summary += `### ${phase.name}
- Duration: ${duration} minutes
- Tests: ${phase.tests.length}
- Passed: ${passed} ✅
- Failed: ${failed} ❌

`;
  }

  // Category results
  summary += `## Category Results

| Category | Total | Passed | Failed | Success Rate |
|----------|-------|--------|--------|--------------|
`;

  for (const [category, stats] of Object.entries(executionResults.categories)) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    summary += `| ${category} | ${stats.total} | ${stats.passed} | ${stats.failed} | ${rate}% |\n`;
  }

  // Critical failures
  const criticalFailures = executionResults.details.filter(t => 
    !t.passed && t.securityImpact === 'Critical'
  );
  
  if (criticalFailures.length > 0) {
    summary += `\n## 🚨 Critical Security Failures

These failures represent critical security vulnerabilities that must be addressed immediately:

`;
    for (const failure of criticalFailures) {
      summary += `### ${failure.testId}: ${failure.description}
- **Endpoint**: ${failure.method} ${failure.endpoint}
- **Error**: ${failure.error}
- **Expected**: Status ${failure.expectedStatus}
- **Actual**: Status ${failure.actualStatus}
- **Plain English**: ${failure.plainEnglish}

`;
    }
  }

  // High priority failures
  const highFailures = executionResults.details.filter(t => 
    !t.passed && t.securityImpact === 'High'
  );
  
  if (highFailures.length > 0) {
    summary += `\n## ⚠️ High Priority Failures

`;
    for (const failure of highFailures) {
      summary += `- **${failure.testId}**: ${failure.description} - ${failure.error}\n`;
    }
  }

  // Success stories
  const successCategories = Object.entries(executionResults.categories)
    .filter(([, stats]) => stats.passed === stats.total)
    .map(([cat]) => cat);
  
  if (successCategories.length > 0) {
    summary += `\n## ✅ Fully Passing Categories

The following categories have 100% test success:
`;
    for (const cat of successCategories) {
      summary += `- ${cat}\n`;
    }
  }

  // Recommendations
  summary += `\n## Recommendations

Based on the test results:

1. **Immediate Action Required**: Address all critical security failures before deployment
2. **High Priority**: Fix high-priority failures within the next sprint
3. **Code Review**: Review all failing endpoints for security vulnerabilities
4. **Regression Testing**: Re-run this test suite after fixes are implemented
5. **Monitoring**: Implement monitoring for the identified security patterns

## Test Execution Details

- Test Plan: TEST_PLAN_USERS_AUTH_COMPLETE.yaml
- Execution Script: executeComprehensiveTests.js
- Results File: TEST_EXECUTION_RESULTS_USERS_AUTH.json
- Backend URL: http://localhost:5001

## Next Steps

1. Review all failed tests in detail
2. Prioritize fixes based on security impact
3. Implement corrections following secure coding practices
4. Re-execute test suite to verify fixes
5. Document any changes to security architecture
`;

  fs.writeFileSync(summaryPath, summary);
  console.log(`📄 Summary report saved to: ${summaryPath}`);
}

// Run the tests
main().catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});
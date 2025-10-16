#!/usr/bin/env node

/**
 * Credit Balance API Test Suite
 * 
 * Tests all 4 Credit Balance CRUD endpoints with real authentication
 * 
 * Usage:
 *   node backend/testing/test-credit-api.js
 * 
 * Requirements:
 *   - Backend server running on http://localhost:5001
 *   - Valid Firebase authentication token (from testHarness.js)
 *   - Test unit exists in Firebase (AVII/203 recommended)
 */

import fetch from 'node-fetch';

// Test Configuration
const BASE_URL = 'http://localhost:5001';
const CLIENT_ID = 'AVII';
const TEST_UNIT_ID = '203'; // Use existing unit for testing

// ANSI Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Get auth token from environment or prompt
const AUTH_TOKEN = process.env.FIREBASE_TOKEN || '';

if (!AUTH_TOKEN) {
  console.error(`${colors.red}❌ ERROR: No authentication token provided${colors.reset}`);
  console.log(`\nPlease set FIREBASE_TOKEN environment variable:`);
  console.log(`  export FIREBASE_TOKEN="your-token-here"`);
  console.log(`\nOr get token from: node backend/testing/testHarness.js\n`);
  process.exit(1);
}

// Test Results Tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Helper: Make authenticated request
async function apiRequest(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

// Helper: Log test result
function logTest(name, passed, message, data = null) {
  const icon = passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
  const status = passed ? 'PASS' : 'FAIL';
  
  console.log(`${icon} ${status} - ${name}`);
  if (message) {
    console.log(`  ${passed ? colors.green : colors.red}${message}${colors.reset}`);
  }
  if (data) {
    console.log(`  ${colors.cyan}${JSON.stringify(data, null, 2)}${colors.reset}`);
  }
  
  results.tests.push({ name, passed, message });
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

// Helper: Test section header
function logSection(title) {
  console.log(`\n${colors.blue}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════${colors.reset}\n`);
}

// Store initial state for cleanup
let initialBalance = null;
let testTransactionId = null;

// Test Suite
async function runTests() {
  console.log(`${colors.cyan}`);
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     Credit Balance API Test Suite               ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Client: ${CLIENT_ID}`);
  console.log(`Test Unit: ${TEST_UNIT_ID}\n`);
  
  try {
    // ═══════════════════════════════════════════
    // TEST 1: GET Credit Balance
    // ═══════════════════════════════════════════
    logSection('TEST 1: GET Credit Balance');
    
    try {
      const result = await apiRequest('GET', `/credit/${CLIENT_ID}/${TEST_UNIT_ID}`);
      
      if (result.ok && result.data.clientId === CLIENT_ID && result.data.unitId === TEST_UNIT_ID) {
        initialBalance = result.data.creditBalance;
        logTest(
          'Get credit balance',
          true,
          `Retrieved balance: ${result.data.creditBalanceDisplay}`,
          { balance: result.data.creditBalance, lastUpdated: result.data.lastUpdated }
        );
      } else {
        logTest('Get credit balance', false, `Unexpected response: ${result.status}`, result.data);
      }
    } catch (error) {
      logTest('Get credit balance', false, `Error: ${error.message}`);
    }
    
    // ═══════════════════════════════════════════
    // TEST 2: POST Update Credit Balance (Add)
    // ═══════════════════════════════════════════
    logSection('TEST 2: POST Update Credit Balance (Add Credit)');
    
    try {
      testTransactionId = `test_${Date.now()}`;
      const testAmount = 5000; // 50.00 pesos in centavos
      
      const result = await apiRequest('POST', `/credit/${CLIENT_ID}/${TEST_UNIT_ID}`, {
        amount: testAmount,
        transactionId: testTransactionId,
        note: 'Test credit addition - automated test',
        source: 'test_suite'
      });
      
      if (result.ok && result.data.success) {
        const expectedNewBalance = (initialBalance * 100) + testAmount;
        const actualNewBalance = result.data.newBalance;
        
        if (actualNewBalance === expectedNewBalance) {
          logTest(
            'Add credit to balance',
            true,
            `Added ${testAmount / 100} pesos successfully`,
            { 
              previousBalance: result.data.previousBalance / 100,
              newBalance: result.data.newBalance / 100,
              amountChange: result.data.amountChange / 100
            }
          );
        } else {
          logTest(
            'Add credit to balance',
            false,
            `Balance mismatch: expected ${expectedNewBalance}, got ${actualNewBalance}`
          );
        }
      } else {
        logTest('Add credit to balance', false, `Failed to update: ${result.status}`, result.data);
      }
    } catch (error) {
      logTest('Add credit to balance', false, `Error: ${error.message}`);
    }
    
    // ═══════════════════════════════════════════
    // TEST 3: GET Credit History
    // ═══════════════════════════════════════════
    logSection('TEST 3: GET Credit History');
    
    try {
      const result = await apiRequest('GET', `/credit/${CLIENT_ID}/${TEST_UNIT_ID}/history?limit=10`);
      
      if (result.ok && Array.isArray(result.data.history)) {
        const historyCount = result.data.history.length;
        const foundTestEntry = result.data.history.find(
          entry => entry.transactionId === testTransactionId
        );
        
        if (foundTestEntry) {
          logTest(
            'Get credit history',
            true,
            `Retrieved ${historyCount} entries, found test transaction`,
            {
              currentBalance: result.data.currentBalance,
              historyCount,
              testEntry: foundTestEntry
            }
          );
        } else {
          logTest(
            'Get credit history',
            false,
            `Test transaction not found in history (may need time to propagate)`,
            { historyCount }
          );
        }
      } else {
        logTest('Get credit history', false, `Unexpected response: ${result.status}`, result.data);
      }
    } catch (error) {
      logTest('Get credit history', false, `Error: ${error.message}`);
    }
    
    // ═══════════════════════════════════════════
    // TEST 4: POST Update Credit Balance (Subtract - Reversal)
    // ═══════════════════════════════════════════
    logSection('TEST 4: POST Update Credit Balance (Subtract/Reverse)');
    
    try {
      const reversalTransactionId = `${testTransactionId}_reversal`;
      const reversalAmount = -5000; // Negative to subtract
      
      const result = await apiRequest('POST', `/credit/${CLIENT_ID}/${TEST_UNIT_ID}`, {
        amount: reversalAmount,
        transactionId: reversalTransactionId,
        note: 'Test credit reversal - cleanup',
        source: 'test_suite'
      });
      
      if (result.ok && result.data.success) {
        const balanceAfterReversal = result.data.newBalance / 100;
        const balanceMatches = Math.abs(balanceAfterReversal - initialBalance) < 0.01; // Allow for rounding
        
        if (balanceMatches) {
          logTest(
            'Subtract credit (reversal)',
            true,
            `Reversed test credit successfully, back to original balance`,
            {
              previousBalance: result.data.previousBalance / 100,
              newBalance: result.data.newBalance / 100,
              originalBalance: initialBalance
            }
          );
        } else {
          logTest(
            'Subtract credit (reversal)',
            false,
            `Balance mismatch after reversal: expected ${initialBalance}, got ${balanceAfterReversal}`
          );
        }
      } else {
        logTest('Subtract credit (reversal)', false, `Failed to reverse: ${result.status}`, result.data);
      }
    } catch (error) {
      logTest('Subtract credit (reversal)', false, `Error: ${error.message}`);
    }
    
    // ═══════════════════════════════════════════
    // TEST 5: POST Add Credit History Entry (Backdated)
    // ═══════════════════════════════════════════
    logSection('TEST 5: POST Add Credit History Entry');
    
    try {
      const historicalDate = new Date('2025-10-01T10:00:00.000Z').toISOString();
      const historicalAmount = 0; // Zero amount for history-only test
      const historicalTxnId = `historical_test_${Date.now()}`;
      
      const result = await apiRequest('POST', `/credit/${CLIENT_ID}/${TEST_UNIT_ID}/history`, {
        amount: historicalAmount,
        date: historicalDate,
        transactionId: historicalTxnId,
        note: 'Test historical entry - no balance change',
        source: 'test_suite'
      });
      
      if (result.ok && result.data.success && result.data.entryAdded) {
        logTest(
          'Add backdated history entry',
          true,
          `Added historical entry successfully`,
          {
            entryAdded: result.data.entryAdded,
            date: historicalDate
          }
        );
      } else {
        logTest('Add backdated history entry', false, `Failed to add: ${result.status}`, result.data);
      }
    } catch (error) {
      logTest('Add backdated history entry', false, `Error: ${error.message}`);
    }
    
    // ═══════════════════════════════════════════
    // TEST 6: Validation Tests
    // ═══════════════════════════════════════════
    logSection('TEST 6: Input Validation');
    
    // Test 6a: Missing required fields
    try {
      const result = await apiRequest('POST', `/credit/${CLIENT_ID}/${TEST_UNIT_ID}`, {
        amount: 1000
        // Missing transactionId, note, source
      });
      
      if (!result.ok && result.status === 400) {
        logTest('Validation: Missing required fields', true, 'Correctly rejected invalid request');
      } else {
        logTest('Validation: Missing required fields', false, 'Should have rejected request');
      }
    } catch (error) {
      logTest('Validation: Missing required fields', false, `Error: ${error.message}`);
    }
    
    // Test 6b: Invalid amount format
    try {
      const result = await apiRequest('POST', `/credit/${CLIENT_ID}/${TEST_UNIT_ID}`, {
        amount: 'invalid',
        transactionId: 'test',
        note: 'test',
        source: 'test'
      });
      
      if (!result.ok && result.status === 400) {
        logTest('Validation: Invalid amount format', true, 'Correctly rejected invalid amount');
      } else {
        logTest('Validation: Invalid amount format', false, 'Should have rejected invalid amount');
      }
    } catch (error) {
      logTest('Validation: Invalid amount format', false, `Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`${colors.red}Fatal error during tests: ${error.message}${colors.reset}`);
    console.error(error.stack);
  }
  
  // ═══════════════════════════════════════════
  // Test Summary
  // ═══════════════════════════════════════════
  logSection('Test Summary');
  
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  
  if (results.failed === 0) {
    console.log(`\n${colors.green}╔══════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.green}║  ✓ ALL TESTS PASSED                             ║${colors.reset}`);
    console.log(`${colors.green}╚══════════════════════════════════════════════════╝${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}╔══════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.red}║  ✗ SOME TESTS FAILED                             ║${colors.reset}`);
    console.log(`${colors.red}╚══════════════════════════════════════════════════╝${colors.reset}\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
  console.error(error.stack);
  process.exit(1);
});


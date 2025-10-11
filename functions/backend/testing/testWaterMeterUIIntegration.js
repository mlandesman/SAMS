#!/usr/bin/env node

/**
 * Water Meter UI Integration Test
 * Tests all API endpoints used by the frontend Water Bills UI
 * Provides detailed output for Manager review
 */

const API_BASE = 'http://localhost:5001/api';
const CLIENT_ID = 'AVII';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
}

function logTest(testName) {
  log(`\n▶ Testing: ${testName}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logData(label, data) {
  log(`\n📊 ${label}:`, 'yellow');
  console.log(JSON.stringify(data, null, 2));
}

// Test 1: Fetch Water Meters Configuration
async function testFetchWaterMeters() {
  logTest('GET /api/clients/AVII/watermeters');
  
  try {
    const response = await fetch(`${API_BASE}/clients/${CLIENT_ID}/watermeters`);
    const data = await response.json();
    
    log(`Response Status: ${response.status}`);
    
    if (response.ok) {
      logSuccess('Water meters fetched successfully');
      logData('Water Meters Data', data);
      
      // Validate response structure
      if (data.meters && Array.isArray(data.meters)) {
        log(`\n📈 Meters Summary:`, 'blue');
        log(`  - Total meters: ${data.meters.length}`);
        if (data.meters.length > 0) {
          log(`  - Sample meter:`, 'blue');
          console.log(`    Unit ID: ${data.meters[0].unitId}`);
          console.log(`    Meter Number: ${data.meters[0].meterNumber || 'N/A'}`);
          console.log(`    Status: ${data.meters[0].status || 'active'}`);
        }
      }
      return { success: true, metersCount: data.meters?.length || 0 };
    } else {
      logError(`Failed with status ${response.status}`);
      logData('Error Response', data);
      return { success: false, error: data };
    }
  } catch (error) {
    logError(`Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 2: Fetch Latest Readings
async function testFetchLatestReadings() {
  logTest('GET /api/clients/AVII/watermeters/readings/latest');
  
  try {
    const response = await fetch(`${API_BASE}/clients/${CLIENT_ID}/watermeters/readings/latest`);
    const data = await response.json();
    
    log(`Response Status: ${response.status}`);
    
    if (response.ok) {
      logSuccess('Latest readings fetched successfully');
      logData('Latest Readings Data', data);
      
      // Validate and display readings
      if (data.readings && typeof data.readings === 'object') {
        const unitIds = Object.keys(data.readings);
        log(`\n📈 Readings Summary:`, 'blue');
        log(`  - Units with readings: ${unitIds.length}`);
        
        if (unitIds.length > 0) {
          log(`  - Sample readings (first 3):`, 'blue');
          unitIds.slice(0, 3).forEach(unitId => {
            const reading = data.readings[unitId];
            console.log(`    Unit ${unitId}:`);
            console.log(`      Reading: ${reading.reading}`);
            console.log(`      Date: ${reading.readingDate}`);
            console.log(`      Notes: ${reading.notes || 'None'}`);
          });
        }
      }
      return { success: true, readingsCount: Object.keys(data.readings || {}).length };
    } else {
      logError(`Failed with status ${response.status}`);
      logData('Error Response', data);
      return { success: false, error: data };
    }
  } catch (error) {
    logError(`Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 3: Submit Batch Readings
async function testSubmitBatchReadings() {
  logTest('POST /api/clients/AVII/watermeters/readings');
  
  const testReadings = [
    { unitId: '101', reading: 12345, notes: 'Test reading 1' },
    { unitId: '102', reading: 23456, notes: 'Test reading 2' },
    { unitId: '103', reading: 34567, notes: 'Test reading 3' }
  ];
  
  const payload = {
    clientId: CLIENT_ID,
    readings: testReadings,
    readingDate: new Date().toISOString().split('T')[0]
  };
  
  logData('Request Payload', payload);
  
  try {
    const response = await fetch(`${API_BASE}/clients/${CLIENT_ID}/watermeters/readings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    log(`Response Status: ${response.status}`);
    
    if (response.ok) {
      logSuccess('Batch readings submitted successfully');
      logData('Response Data', data);
      
      // Display summary
      if (data.saved) {
        log(`\n📈 Submission Summary:`, 'blue');
        log(`  - Readings saved: ${data.saved.length}`);
        log(`  - Reading date: ${payload.readingDate}`);
        if (data.saved.length > 0) {
          log(`  - Units processed: ${data.saved.map(r => r.unitId).join(', ')}`);
        }
      }
      return { success: true, savedCount: data.saved?.length || 0 };
    } else {
      logError(`Failed with status ${response.status}`);
      logData('Error Response', data);
      
      // Check for validation errors
      if (data.errors && Array.isArray(data.errors)) {
        log('\n⚠️  Validation Errors:', 'yellow');
        data.errors.forEach(error => {
          console.log(`  - ${error}`);
        });
      }
      return { success: false, error: data };
    }
  } catch (error) {
    logError(`Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 4: Generate Bills
async function testGenerateBills() {
  logTest('POST /api/clients/AVII/watermeters/bills/generate');
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const payload = {
    clientId: CLIENT_ID,
    billingMonth: currentMonth,
    dueDate: dueDate
  };
  
  logData('Request Payload', payload);
  
  try {
    const response = await fetch(`${API_BASE}/clients/${CLIENT_ID}/watermeters/bills/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    log(`Response Status: ${response.status}`);
    
    if (response.ok) {
      logSuccess('Bills generated successfully');
      logData('Response Data', data);
      
      // Display bill summary
      if (data.bills && Array.isArray(data.bills)) {
        log(`\n📈 Bill Generation Summary:`, 'blue');
        log(`  - Bills generated: ${data.bills.length}`);
        log(`  - Billing month: ${currentMonth}`);
        log(`  - Due date: ${dueDate}`);
        
        if (data.bills.length > 0) {
          const totalAmount = data.bills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          log(`  - Total amount: $${(totalAmount / 100).toFixed(2)}`);
          
          log(`\n  Sample bills (first 3):`, 'blue');
          data.bills.slice(0, 3).forEach(bill => {
            console.log(`    Unit ${bill.unitId}:`);
            console.log(`      Amount: $${(bill.amount / 100).toFixed(2)}`);
            console.log(`      Consumption: ${bill.consumption} gal`);
            console.log(`      Status: ${bill.status}`);
          });
        }
      }
      return { success: true, billsCount: data.bills?.length || 0 };
    } else {
      logError(`Failed with status ${response.status}`);
      logData('Error Response', data);
      return { success: false, error: data };
    }
  } catch (error) {
    logError(`Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test 5: Fetch Water Bills
async function testFetchWaterBills() {
  logTest('GET /api/clients/AVII/watermeters/bills');
  
  try {
    const response = await fetch(`${API_BASE}/clients/${CLIENT_ID}/watermeters/bills`);
    const data = await response.json();
    
    log(`Response Status: ${response.status}`);
    
    if (response.ok) {
      logSuccess('Water bills fetched successfully');
      logData('Water Bills Data', data);
      
      // Display bills summary
      if (data.bills && Array.isArray(data.bills)) {
        log(`\n📈 Bills Summary:`, 'blue');
        log(`  - Total bills: ${data.bills.length}`);
        
        const unpaidBills = data.bills.filter(b => b.status === 'unpaid');
        const paidBills = data.bills.filter(b => b.status === 'paid');
        
        log(`  - Unpaid bills: ${unpaidBills.length}`);
        log(`  - Paid bills: ${paidBills.length}`);
        
        if (unpaidBills.length > 0) {
          const totalUnpaid = unpaidBills.reduce((sum, bill) => sum + (bill.amount || 0), 0);
          log(`  - Total unpaid amount: $${(totalUnpaid / 100).toFixed(2)}`);
        }
        
        if (data.bills.length > 0) {
          log(`\n  Recent bills (first 3):`, 'blue');
          data.bills.slice(0, 3).forEach(bill => {
            console.log(`    Bill ${bill.id}:`);
            console.log(`      Unit: ${bill.unitId}`);
            console.log(`      Month: ${bill.billingMonth}`);
            console.log(`      Amount: $${(bill.amount / 100).toFixed(2)}`);
            console.log(`      Status: ${bill.status}`);
          });
        }
      }
      return { success: true, billsCount: data.bills?.length || 0 };
    } else {
      logError(`Failed with status ${response.status}`);
      logData('Error Response', data);
      return { success: false, error: data };
    }
  } catch (error) {
    logError(`Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runAllTests() {
  logSection('WATER METER UI INTEGRATION TESTS');
  log('Testing all API endpoints for Water Bills frontend\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Run all tests
  const tests = [
    { name: 'Fetch Water Meters', fn: testFetchWaterMeters },
    { name: 'Fetch Latest Readings', fn: testFetchLatestReadings },
    { name: 'Submit Batch Readings', fn: testSubmitBatchReadings },
    { name: 'Generate Bills', fn: testGenerateBills },
    { name: 'Fetch Water Bills', fn: testFetchWaterBills }
  ];
  
  for (const test of tests) {
    const result = await test.fn();
    results.tests.push({ name: test.name, ...result });
    
    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Final summary
  logSection('TEST RESULTS SUMMARY');
  
  log(`\n📊 Overall Results:`, 'bright');
  log(`  Total Tests: ${results.passed + results.failed}`);
  logSuccess(`  Passed: ${results.passed}`);
  if (results.failed > 0) {
    logError(`  Failed: ${results.failed}`);
  }
  
  log(`\n📋 Test Details:`, 'bright');
  results.tests.forEach((test, index) => {
    const status = test.success ? '✅' : '❌';
    const color = test.success ? 'green' : 'red';
    log(`  ${index + 1}. ${test.name}: ${status}`, color);
    if (test.success) {
      if (test.metersCount !== undefined) log(`     - Meters: ${test.metersCount}`);
      if (test.readingsCount !== undefined) log(`     - Readings: ${test.readingsCount}`);
      if (test.savedCount !== undefined) log(`     - Saved: ${test.savedCount}`);
      if (test.billsCount !== undefined) log(`     - Bills: ${test.billsCount}`);
    } else {
      log(`     - Error: ${JSON.stringify(test.error)}`, 'red');
    }
  });
  
  // Recommendations
  log(`\n💡 Recommendations:`, 'bright');
  if (results.failed === 0) {
    logSuccess('  All API endpoints are working correctly!');
    log('  The frontend Water Bills UI should function properly.');
  } else {
    logError('  Some API endpoints are not responding as expected.');
    log('  Please check the backend logs for more details.');
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

// Run the tests
runAllTests().catch(error => {
  logError(`Test runner failed: ${error.message}`);
  process.exit(1);
});
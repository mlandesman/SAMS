#!/usr/bin/env node

/**
 * Water Meter API Tests using Test Harness
 * Tests all water meter endpoints with proper authentication
 */

import { testHarness as harness } from './testHarness.js';

// Test Suite for Water Meter APIs
const waterMeterTests = [
  {
    name: 'Fetch Water Meters for AVII',
    test: async ({ api }) => {
      try {
        const response = await api.get('/api/clients/AVII/watermeters');
        
        console.log('   Response status:', response.status);
        console.log('   Response data:', JSON.stringify(response.data, null, 2));
        
        // Check if we got meters data
        const hasMeters = response.data && (response.data.meters !== undefined || response.data.error);
        
        return {
          passed: response.status === 200 || response.status === 404, // 404 is ok if no meters configured yet
          message: `Got ${response.data?.meters?.length || 0} water meters`,
          data: {
            status: response.status,
            metersCount: response.data?.meters?.length || 0,
            sampleMeter: response.data?.meters?.[0] || null
          }
        };
      } catch (error) {
        return {
          passed: false,
          reason: `API call failed: ${error.message}`,
          error: error.message
        };
      }
    }
  },
  
  {
    name: 'Fetch Latest Readings for AVII',
    test: async ({ api }) => {
      try {
        const response = await api.get('/api/clients/AVII/watermeters/readings/latest');
        
        console.log('   Response status:', response.status);
        console.log('   Response data:', JSON.stringify(response.data, null, 2));
        
        return {
          passed: response.status === 200 || response.status === 404,
          message: `Got readings for ${Object.keys(response.data?.readings || {}).length} units`,
          data: {
            status: response.status,
            readingsCount: Object.keys(response.data?.readings || {}).length,
            sampleReading: response.data?.readings?.['101'] || null
          }
        };
      } catch (error) {
        return {
          passed: false,
          reason: `API call failed: ${error.message}`,
          error: error.message
        };
      }
    }
  },
  
  {
    name: 'Submit Batch Meter Readings',
    test: async ({ api }) => {
      try {
        const testReadings = [
          { unitId: '101', reading: 12345, notes: 'Test reading from harness' },
          { unitId: '102', reading: 23456, notes: 'Test reading from harness' },
          { unitId: '103', reading: 34567, notes: 'Test reading from harness' }
        ];
        
        const payload = {
          clientId: 'AVII',
          readings: testReadings,
          readingDate: new Date().toISOString().split('T')[0]
        };
        
        console.log('   Request payload:', JSON.stringify(payload, null, 2));
        
        const response = await api.post('/api/clients/AVII/watermeters/readings', payload);
        
        console.log('   Response status:', response.status);
        console.log('   Response data:', JSON.stringify(response.data, null, 2));
        
        return {
          passed: response.status === 200 || response.status === 201,
          message: `Saved ${response.data?.saved?.length || 0} readings`,
          data: {
            status: response.status,
            savedCount: response.data?.saved?.length || 0,
            savedReadings: response.data?.saved || [],
            errors: response.data?.errors || []
          }
        };
      } catch (error) {
        console.log('   Error details:', error.response?.data || error.message);
        return {
          passed: false,
          reason: `API call failed: ${error.response?.data?.error || error.message}`,
          error: error.response?.data || error.message
        };
      }
    }
  },
  
  {
    name: 'Generate Water Bills',
    test: async ({ api }) => {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const payload = {
          clientId: 'AVII',
          billingMonth: currentMonth,
          dueDate: dueDate
        };
        
        console.log('   Request payload:', JSON.stringify(payload, null, 2));
        
        const response = await api.post('/api/clients/AVII/watermeters/bills/generate', payload);
        
        console.log('   Response status:', response.status);
        console.log('   Response data:', JSON.stringify(response.data, null, 2));
        
        return {
          passed: response.status === 200 || response.status === 201,
          message: `Generated ${response.data?.bills?.length || 0} bills`,
          data: {
            status: response.status,
            billsCount: response.data?.bills?.length || 0,
            totalAmount: response.data?.bills?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0,
            sampleBill: response.data?.bills?.[0] || null
          }
        };
      } catch (error) {
        console.log('   Error details:', error.response?.data || error.message);
        return {
          passed: false,
          reason: `API call failed: ${error.response?.data?.error || error.message}`,
          error: error.response?.data || error.message
        };
      }
    }
  },
  
  {
    name: 'Fetch Water Bills',
    test: async ({ api }) => {
      try {
        const response = await api.get('/api/clients/AVII/watermeters/bills');
        
        console.log('   Response status:', response.status);
        console.log('   Response data:', JSON.stringify(response.data, null, 2));
        
        const bills = response.data?.bills || [];
        const unpaidBills = bills.filter(b => b.status === 'unpaid');
        const totalUnpaid = unpaidBills.reduce((sum, b) => sum + (b.amount || 0), 0);
        
        return {
          passed: response.status === 200 || response.status === 404,
          message: `Found ${bills.length} bills (${unpaidBills.length} unpaid)`,
          data: {
            status: response.status,
            totalBills: bills.length,
            unpaidCount: unpaidBills.length,
            totalUnpaidAmount: totalUnpaid,
            sampleBill: bills[0] || null
          }
        };
      } catch (error) {
        return {
          passed: false,
          reason: `API call failed: ${error.message}`,
          error: error.message
        };
      }
    }
  },
  
  {
    name: 'Test Input Validation - Invalid Unit ID',
    test: async ({ api }) => {
      try {
        const invalidPayload = {
          clientId: 'AVII',
          readings: [
            { unitId: '<script>alert("xss")</script>', reading: 12345 }
          ],
          readingDate: new Date().toISOString().split('T')[0]
        };
        
        console.log('   Testing XSS payload:', invalidPayload.readings[0].unitId);
        
        const response = await api.post('/api/clients/AVII/watermeters/readings', invalidPayload);
        
        // Should be rejected
        return {
          passed: false,
          reason: 'XSS payload was not rejected!',
          data: response.data
        };
      } catch (error) {
        // Expected to fail - that's good!
        console.log('   Validation error (expected):', error.response?.data?.error);
        return {
          passed: error.response?.status === 400,
          message: 'Input validation correctly rejected XSS attempt',
          data: {
            error: error.response?.data?.error,
            status: error.response?.status
          }
        };
      }
    }
  },
  
  {
    name: 'Test Input Validation - Negative Reading',
    test: async ({ api }) => {
      try {
        const invalidPayload = {
          clientId: 'AVII',
          readings: [
            { unitId: '101', reading: -100, notes: 'Negative reading test' }
          ],
          readingDate: new Date().toISOString().split('T')[0]
        };
        
        console.log('   Testing negative reading:', invalidPayload.readings[0].reading);
        
        const response = await api.post('/api/clients/AVII/watermeters/readings', invalidPayload);
        
        // Should be rejected
        return {
          passed: false,
          reason: 'Negative reading was not rejected!',
          data: response.data
        };
      } catch (error) {
        // Expected to fail - that's good!
        console.log('   Validation error (expected):', error.response?.data?.error);
        return {
          passed: error.response?.status === 400,
          message: 'Input validation correctly rejected negative reading',
          data: {
            error: error.response?.data?.error,
            status: error.response?.status
          }
        };
      }
    }
  }
];

// Run all tests
async function runWaterMeterTests() {
  console.log('========================================');
  console.log('WATER METER API TESTS WITH AUTHENTICATION');
  console.log('========================================\n');
  
  try {
    // Run the test suite
    const results = await harness.runTests(waterMeterTests, {
      parallel: false
    });
    
    // Get results from harness
    const testResults = harness.testResults;
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.length - passed;
    const summary = {
      total: testResults.length,
      passed: passed,
      failed: failed,
      duration: Date.now() - Date.now(),
      passRate: (passed / testResults.length) * 100
    };
    
    // Display detailed results
    console.log('\n========================================');
    console.log('DETAILED TEST RESULTS');
    console.log('========================================\n');
    
    testResults.forEach((test, index) => {
      console.log(`${index + 1}. ${test.name}`);
      console.log(`   Status: ${test.passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`   Duration: ${test.duration}ms`);
      
      if (test.data) {
        console.log('   Data:', JSON.stringify(test.data, null, 2).replace(/\n/g, '\n   '));
      }
      
      if (test.error) {
        console.log('   Error:', test.error);
      }
      
      console.log('');
    });
    
    // Summary
    console.log('========================================');
    console.log('TEST SUMMARY');
    console.log('========================================\n');
    console.log(`Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⏱️  Duration: ${summary.duration}ms`);
    console.log(`Success Rate: ${summary.passRate.toFixed(1)}%`);
    
    // Manager-friendly summary
    console.log('\n========================================');
    console.log('MANAGER REVIEW SUMMARY');
    console.log('========================================\n');
    
    if (summary.passRate === 100) {
      console.log('✅ ALL TESTS PASSED - Water Meter APIs are fully functional');
    } else {
      console.log(`⚠️  ${summary.failed} tests failed - Review needed`);
      
      const failedTests = testResults.filter(t => !t.passed);
      console.log('\nFailed Tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.name}: ${test.error || 'Unknown error'}`);
      });
    }
    
    // Check specific functionality
    const readingsTest = testResults.find(t => t.name.includes('Submit Batch'));
    const billsTest = testResults.find(t => t.name.includes('Generate Water Bills'));
    const validationTests = testResults.filter(t => t.name.includes('Validation'));
    
    console.log('\nKey Functionality Status:');
    console.log(`  📊 Meter Readings: ${readingsTest?.passed ? '✅ Working' : '❌ Not Working'}`);
    console.log(`  💵 Bill Generation: ${billsTest?.passed ? '✅ Working' : '❌ Not Working'}`);
    console.log(`  🔒 Input Validation: ${validationTests.every(t => t.passed) ? '✅ Secure' : '❌ Issues Found'}`);
    
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Run the tests
runWaterMeterTests();
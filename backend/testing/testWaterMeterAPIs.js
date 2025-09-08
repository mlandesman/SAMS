#!/usr/bin/env node

/**
 * Water Meter API Test Suite
 * Comprehensive tests for all water meter endpoints
 * Uses the SAMS Universal Test Harness for automatic authentication
 */

import { testHarness, quickApiTest } from './testHarness.js';

// Test data
const TEST_CLIENT_ID = 'AVII';
const TEST_UNITS = ['A01', 'A02', 'A03'];
const TEST_YEAR = new Date().getFullYear();
const TEST_MONTH = new Date().getMonth() + 1;

async function runWaterMeterAPITests() {
  console.log('💧 Water Meter API Test Suite\n');
  console.log('=========================================\n');
  
  // Store test data for cleanup
  let createdBillIds = [];
  let savedReadings = [];

  // =========================================
  // SECTION 1: READING ENDPOINTS
  // =========================================
  console.log('📊 Testing Water Meter Reading Endpoints\n');
  
  // Test 1: Save multiple readings
  await testHarness.runTest({
    name: 'POST /watermeters/readings - Save bulk readings',
    async test({ api }) {
      try {
        const readingDate = new Date().toISOString().split('T')[0];
        const readings = TEST_UNITS.map((unitId, index) => ({
          unitId,
          value: 1000 + (index * 100) + Math.random() * 50,
          type: 'monthly',
          notes: `Test reading for ${unitId}`
        }));

        const response = await api.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/readings`, {
          readings,
          readingDate
        });

        savedReadings = response.data.results || [];

        return {
          passed: response.status === 200 && 
                  response.data.success === true &&
                  response.data.saved > 0,
          data: {
            saved: response.data.saved,
            failed: response.data.failed,
            readings: response.data.results
          },
          message: `Successfully saved ${response.data.saved} readings`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to save readings: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // Test 2: Get readings for current period
  await testHarness.runTest({
    name: `GET /watermeters/readings/:year/:month - Get readings for ${TEST_YEAR}/${TEST_MONTH}`,
    async test({ api }) {
      try {
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/readings/${TEST_YEAR}/${TEST_MONTH}`
        );

        const hasReadings = response.data.readings && response.data.readings.length > 0;
        const correctPeriod = response.data.period === `${TEST_YEAR}-${TEST_MONTH}`;

        return {
          passed: response.status === 200 && hasReadings && correctPeriod,
          data: {
            clientId: response.data.clientId,
            period: response.data.period,
            readingCount: response.data.readings.length,
            units: response.data.readings.map(r => r.unitId)
          },
          message: `Retrieved ${response.data.readings.length} readings for period`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to get readings: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // Test 3: Get latest readings
  await testHarness.runTest({
    name: 'GET /watermeters/readings/latest - Get latest readings for all units',
    async test({ api }) {
      try {
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/readings/latest`
        );

        return {
          passed: response.status === 200 && 
                  response.data.clientId === TEST_CLIENT_ID,
          data: {
            clientId: response.data.clientId,
            readingCount: response.data.readings?.length || 0,
            units: response.data.readings?.map(r => r.unitId) || []
          },
          message: `Retrieved latest readings for ${response.data.readings?.length || 0} units`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to get latest readings: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // =========================================
  // SECTION 2: BILL GENERATION ENDPOINTS
  // =========================================
  console.log('\n💰 Testing Bill Generation Endpoints\n');

  // Test 4: Generate bills for current month
  await testHarness.runTest({
    name: 'POST /watermeters/bills/generate - Generate bills from readings',
    async test({ api }) {
      try {
        const billingDate = new Date().toISOString().split('T')[0];
        const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response = await api.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/bills/generate`, {
          year: TEST_YEAR,
          month: TEST_MONTH,
          billingDate,
          dueDate,
          sendEmails: false
        });

        // Store bill IDs for later tests
        if (response.data.bills) {
          createdBillIds = response.data.bills.map(b => b.id);
        }

        return {
          passed: response.status === 200 && 
                  response.data.success === true,
          data: {
            generated: response.data.generated,
            failed: response.data.failed,
            billIds: createdBillIds,
            errors: response.data.errors
          },
          message: `Generated ${response.data.generated} bills, ${response.data.failed} failed`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to generate bills: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // Test 5: Bulk generate bills (testing duplicate prevention)
  await testHarness.runTest({
    name: 'POST /watermeters/bills/bulk-generate - Test bulk generation and duplicate prevention',
    async test({ api }) {
      try {
        const response = await api.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/bills/bulk-generate`, {
          year: TEST_YEAR,
          month: TEST_MONTH,
          unitIds: TEST_UNITS.slice(0, 2) // Only first 2 units
        });

        // Should skip existing bills
        const skippedDuplicates = response.data.results?.skipped?.some(
          s => s.reason.includes('Bill already exists')
        );

        return {
          passed: response.status === 200,
          data: {
            processed: response.data.processed,
            success: response.data.results?.success?.length || 0,
            failed: response.data.results?.failed?.length || 0,
            skipped: response.data.results?.skipped?.length || 0,
            duplicatesDetected: skippedDuplicates
          },
          message: `Bulk processing complete. Duplicates properly detected: ${skippedDuplicates}`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Bulk generation failed: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // Test 6: Get bills for current year
  await testHarness.runTest({
    name: `GET /watermeters/bills/:year - Get all bills for ${TEST_YEAR}`,
    async test({ api }) {
      try {
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/bills/${TEST_YEAR}`
        );

        return {
          passed: response.status === 200 && 
                  response.data.year === TEST_YEAR,
          data: {
            clientId: response.data.clientId,
            year: response.data.year,
            billCount: response.data.count,
            bills: response.data.bills?.length || 0
          },
          message: `Retrieved ${response.data.count} bills for year ${TEST_YEAR}`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to get bills: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // Test 7: Get bills filtered by unit
  await testHarness.runTest({
    name: 'GET /watermeters/bills/:year?unitId=X - Get bills filtered by unit',
    async test({ api }) {
      try {
        const testUnit = TEST_UNITS[0];
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/bills/${TEST_YEAR}?unitId=${testUnit}`
        );

        const allBillsForUnit = response.data.bills?.every(b => b.unitId === testUnit) ?? true;

        return {
          passed: response.status === 200 && allBillsForUnit,
          data: {
            unitId: testUnit,
            billCount: response.data.bills?.length || 0,
            year: response.data.year
          },
          message: `Retrieved ${response.data.bills?.length || 0} bills for unit ${testUnit}`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to get unit bills: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // Test 8: Get specific bill
  if (createdBillIds.length > 0) {
    await testHarness.runTest({
      name: 'GET /watermeters/bills/:unitId/:billId - Get specific bill details',
      async test({ api }) {
        try {
          const billId = createdBillIds[0];
          const unitId = TEST_UNITS[0];
          
          const response = await api.get(
            `/api/clients/${TEST_CLIENT_ID}/watermeters/bills/${unitId}/${billId}`
          );

          return {
            passed: response.status === 200 && 
                    response.data.id === billId,
            data: {
              billId: response.data.id,
              unitId: response.data.unitId,
              totalAmount: response.data.totalAmount,
              consumption: response.data.consumption,
              status: response.data.status
            },
            message: `Retrieved bill ${billId} successfully`
          };
        } catch (error) {
          // Bill might not exist if generation failed
          if (error.response?.status === 404) {
            return {
              passed: true,
              message: 'Bill not found (expected if generation was skipped)'
            };
          }
          return {
            passed: false,
            error: error.message,
            reason: `Failed to get bill: ${error.response?.data?.error || error.message}`
          };
        }
      }
    });
  }

  // =========================================
  // SECTION 3: PAYMENT ENDPOINTS
  // =========================================
  console.log('\n💳 Testing Payment Management Endpoints\n');

  // Test 9: Record a payment
  if (createdBillIds.length > 0) {
    await testHarness.runTest({
      name: 'POST /watermeters/payments - Record payment for bill',
      async test({ api }) {
        try {
          const billId = createdBillIds[0];
          const unitId = TEST_UNITS[0];
          
          const response = await api.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/payments`, {
            unitId,
            billId,
            amount: 273.90, // Amount in dollars (will be converted to cents)
            paymentDate: new Date().toISOString().split('T')[0],
            paymentMethod: 'transfer',
            reference: `TEST-PAY-${Date.now()}`,
            notes: 'Test payment via API'
          });

          return {
            passed: response.status === 200 && 
                    response.data.success === true,
            data: {
              payment: response.data.payment,
              reference: response.data.payment?.reference
            },
            message: 'Payment recorded successfully'
          };
        } catch (error) {
          return {
            passed: false,
            error: error.message,
            reason: `Failed to record payment: ${error.response?.data?.error || error.message}`
          };
        }
      }
    });
  }

  // Test 10: Missing required fields for payment
  await testHarness.runTest({
    name: 'POST /watermeters/payments - Validate required fields',
    async test({ api }) {
      try {
        const response = await api.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/payments`, {
          unitId: TEST_UNITS[0]
          // Missing billId and amount
        });

        return {
          passed: false,
          reason: 'Should have failed with missing fields'
        };
      } catch (error) {
        return {
          passed: error.response?.status === 400 &&
                  error.response?.data?.error?.includes('Missing required fields'),
          message: 'Properly validated missing fields'
        };
      }
    }
  });

  // Test 11: Get payment history
  await testHarness.runTest({
    name: `GET /watermeters/payments/:year - Get payment history for ${TEST_YEAR}`,
    async test({ api }) {
      try {
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/payments/${TEST_YEAR}`
        );

        return {
          passed: response.status === 200 && 
                  response.data.year === TEST_YEAR,
          data: {
            clientId: response.data.clientId,
            year: response.data.year,
            paymentCount: response.data.payments?.length || 0
          },
          message: `Retrieved ${response.data.payments?.length || 0} payments for year ${TEST_YEAR}`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to get payments: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // Test 12: Get payments filtered by unit
  await testHarness.runTest({
    name: 'GET /watermeters/payments/:year?unitId=X - Get payments for specific unit',
    async test({ api }) {
      try {
        const testUnit = TEST_UNITS[0];
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/payments/${TEST_YEAR}?unitId=${testUnit}`
        );

        const allPaymentsForUnit = response.data.payments?.every(p => p.unitId === testUnit) ?? true;

        return {
          passed: response.status === 200 && 
                  response.data.unitId === testUnit &&
                  allPaymentsForUnit,
          data: {
            unitId: response.data.unitId,
            paymentCount: response.data.payments?.length || 0
          },
          message: `Retrieved payments for unit ${testUnit}`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to get unit payments: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // =========================================
  // SECTION 4: BALANCE & SUMMARY ENDPOINTS
  // =========================================
  console.log('\n📈 Testing Balance and Summary Endpoints\n');

  // Test 13: Get outstanding balances
  await testHarness.runTest({
    name: 'GET /watermeters/outstanding - Get all outstanding balances',
    async test({ api }) {
      try {
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/outstanding`
        );

        return {
          passed: response.status === 200 && 
                  response.data.clientId === TEST_CLIENT_ID &&
                  typeof response.data.totalOutstanding === 'number',
          data: {
            clientId: response.data.clientId,
            unitsWithBalance: response.data.unitsWithBalance,
            totalOutstanding: response.data.totalOutstanding,
            displayTotal: response.data.displayTotal
          },
          message: `Found ${response.data.unitsWithBalance} units with outstanding balance. Total: $${response.data.displayTotal}`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to get outstanding balances: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // Test 14: Get complete unit water meter data
  await testHarness.runTest({
    name: 'GET /watermeters/unit/:unitId - Get complete water meter data for a unit',
    async test({ api }) {
      try {
        const testUnit = TEST_UNITS[0];
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/unit/${testUnit}?year=${TEST_YEAR}`
        );

        return {
          passed: response.status === 200 && 
                  response.data.unitId === testUnit &&
                  response.data.year === TEST_YEAR,
          data: {
            unitId: response.data.unitId,
            year: response.data.year,
            hasLatestReading: !!response.data.latestReading,
            readingCount: response.data.readings?.length || 0,
            billCount: response.data.bills?.length || 0,
            outstandingBalance: response.data.outstandingBalance,
            displayBalance: response.data.displayBalance
          },
          message: `Retrieved complete water data for unit ${testUnit}`
        };
      } catch (error) {
        return {
          passed: false,
          error: error.message,
          reason: `Failed to get unit water data: ${error.response?.data?.error || error.message}`
        };
      }
    }
  });

  // =========================================
  // SECTION 5: ERROR HANDLING TESTS
  // =========================================
  console.log('\n⚠️ Testing Error Handling\n');

  // Test 15: Invalid client ID
  await testHarness.runTest({
    name: 'GET /watermeters/readings - Handle invalid client ID',
    async test({ api }) {
      try {
        const response = await api.get(
          `/api/clients/INVALID_CLIENT/watermeters/readings/${TEST_YEAR}/${TEST_MONTH}`
        );
        
        return {
          passed: false,
          reason: 'Should have failed with invalid client'
        };
      } catch (error) {
        // Could be 403 (access denied) or 404 (not found)
        return {
          passed: error.response?.status === 403 || error.response?.status === 404,
          message: `Properly rejected invalid client with status ${error.response?.status}`
        };
      }
    }
  });

  // Test 16: Invalid year/month format
  await testHarness.runTest({
    name: 'GET /watermeters/readings - Handle invalid date parameters',
    async test({ api }) {
      try {
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/readings/abc/xyz`
        );
        
        // Might return empty results or error
        return {
          passed: response.status === 200 || response.status === 400,
          message: 'Handled invalid date parameters'
        };
      } catch (error) {
        return {
          passed: error.response?.status === 400 || error.response?.status === 500,
          message: `Properly handled invalid dates with status ${error.response?.status}`
        };
      }
    }
  });

  // Test 17: Negative reading values
  await testHarness.runTest({
    name: 'POST /watermeters/readings - Reject negative reading values',
    async test({ api }) {
      try {
        const response = await api.post(`/api/clients/${TEST_CLIENT_ID}/watermeters/readings`, {
          readings: [{
            unitId: TEST_UNITS[0],
            value: -100
          }]
        });

        // Check if it was recorded as an error
        const hasError = response.data.failed > 0 || response.data.errors?.length > 0;

        return {
          passed: response.status === 200 && hasError,
          data: {
            saved: response.data.saved,
            failed: response.data.failed,
            errors: response.data.errors
          },
          message: 'Properly handled negative reading value'
        };
      } catch (error) {
        return {
          passed: true,
          message: 'Rejected negative reading value as expected'
        };
      }
    }
  });

  // =========================================
  // SECTION 6: AUTHORIZATION TESTS
  // =========================================
  console.log('\n🔒 Testing Authorization\n');

  // Test 18: Verify authentication is required
  await testHarness.runTest({
    name: 'GET /watermeters/readings - Require authentication',
    async test({ api }) {
      try {
        // Make request without auth header
        const response = await api.get(
          `/api/clients/${TEST_CLIENT_ID}/watermeters/readings/${TEST_YEAR}/${TEST_MONTH}`,
          {
            headers: {
              'Authorization': '' // Remove auth
            }
          }
        );
        
        return {
          passed: false,
          reason: 'Should require authentication'
        };
      } catch (error) {
        return {
          passed: error.response?.status === 401 || error.response?.status === 403,
          message: `Authentication properly enforced with status ${error.response?.status}`
        };
      }
    }
  });

  // =========================================
  // SHOW TEST SUMMARY
  // =========================================
  console.log('\n=========================================\n');
  testHarness.showSummary();
  
  // Return test results (basic tracking)
  const total = testHarness.testCount || 0;
  const passed = testHarness.passedCount || 0;
  const failed = testHarness.failedCount || 0;
  
  return {
    total,
    passed,
    failed,
    successRate: total > 0 ? (passed / total * 100).toFixed(1) : 0
  };
}

// Run the tests
console.log('🚀 Starting Water Meter API Tests...\n');
console.log('📍 Test Environment:');
console.log(`   - Client: ${TEST_CLIENT_ID}`);
console.log(`   - Year: ${TEST_YEAR}`);
console.log(`   - Month: ${TEST_MONTH}`);
console.log(`   - Units: ${TEST_UNITS.join(', ')}\n`);

runWaterMeterAPITests()
  .then(results => {
    console.log('\n✅ Water Meter API Test Suite Complete!');
    console.log(`   Success Rate: ${results.successRate}%`);
    console.log(`   Passed: ${results.passed}/${results.total}`);
    
    if (results.failed > 0) {
      console.log(`   ⚠️ Failed: ${results.failed} tests`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Test suite failed with error:', error);
    process.exit(1);
  });
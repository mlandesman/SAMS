#!/usr/bin/env node

/**
 * Quick Water Meter API Test
 * Fast smoke test for core water meter functionality
 */

import { testHarness, quickApiTest } from './testHarness.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = 'A01';
const YEAR = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1;

async function quickWaterMeterTest() {
  console.log('💧 Quick Water Meter API Test\n');
  console.log('================================\n');

  // Test 1: Save a reading
  console.log('📊 Testing Reading Operations...\n');
  
  await testHarness.runTest({
    name: 'Save Water Reading',
    async test({ api }) {
      const reading = {
        unitId: UNIT_ID,
        value: 1234.56 + Math.random() * 100,
        type: 'monthly',
        notes: 'Quick test reading'
      };

      const response = await api.post(`/api/clients/${CLIENT_ID}/watermeters/readings`, {
        readings: [reading],
        readingDate: new Date().toISOString().split('T')[0]
      });

      return {
        passed: response.data.success && response.data.saved === 1,
        data: response.data
      };
    }
  });

  // Test 2: Get readings
  await quickApiTest(
    'Get Current Month Readings',
    `/api/clients/${CLIENT_ID}/watermeters/readings/${YEAR}/${MONTH}`
  );

  // Test 3: Get latest readings
  await quickApiTest(
    'Get Latest Readings',
    `/api/clients/${CLIENT_ID}/watermeters/readings/latest`
  );

  // Test 4: Generate a bill
  console.log('\n💰 Testing Bill Operations...\n');
  
  await testHarness.runTest({
    name: 'Generate Water Bill',
    async test({ api }) {
      try {
        const response = await api.post(`/api/clients/${CLIENT_ID}/watermeters/bills/generate`, {
          year: YEAR,
          month: MONTH,
          billingDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });

        // May skip if bills already exist
        const success = response.data.success && 
                       (response.data.generated > 0 || response.data.errors?.some(e => 
                         e.error.includes('No reading') || e.error.includes('already exists')
                       ));

        return {
          passed: success,
          data: {
            generated: response.data.generated,
            failed: response.data.failed,
            errors: response.data.errors
          },
          message: response.data.generated > 0 ? 
                   `Generated ${response.data.generated} bills` : 
                   'Bills already exist or no readings available'
        };
      } catch (error) {
        return {
          passed: false,
          error: error.response?.data?.error || error.message
        };
      }
    }
  });

  // Test 5: Get bills
  await quickApiTest(
    'Get Water Bills',
    `/api/clients/${CLIENT_ID}/watermeters/bills/${YEAR}`
  );

  // Test 6: Get outstanding balances
  console.log('\n📈 Testing Balance Operations...\n');
  
  await quickApiTest(
    'Get Outstanding Balances',
    `/api/clients/${CLIENT_ID}/watermeters/outstanding`
  );

  // Test 7: Get unit water meter data
  await quickApiTest(
    'Get Unit Water Data',
    `/api/clients/${CLIENT_ID}/watermeters/unit/${UNIT_ID}?year=${YEAR}`
  );

  // Test 8: Test payment recording
  console.log('\n💳 Testing Payment Operations...\n');
  
  await testHarness.runTest({
    name: 'Record Payment (if bills exist)',
    async test({ api }) {
      try {
        // First get a bill to pay
        const billsResponse = await api.get(
          `/api/clients/${CLIENT_ID}/watermeters/bills/${YEAR}?unitId=${UNIT_ID}`
        );
        
        if (!billsResponse.data.bills || billsResponse.data.bills.length === 0) {
          return {
            passed: true,
            message: 'No bills to pay - skipping payment test'
          };
        }

        const bill = billsResponse.data.bills[0];
        
        // Record payment
        const paymentResponse = await api.post(`/api/clients/${CLIENT_ID}/watermeters/payments`, {
          unitId: UNIT_ID,
          billId: bill.id,
          amount: 100.00, // Partial payment
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'cash',
          notes: 'Quick test payment'
        });

        return {
          passed: paymentResponse.data.success === true,
          data: paymentResponse.data.payment,
          message: 'Payment recorded successfully'
        };
      } catch (error) {
        return {
          passed: false,
          error: error.response?.data?.error || error.message
        };
      }
    }
  });

  // Test 9: Get payment history
  await quickApiTest(
    'Get Payment History',
    `/api/clients/${CLIENT_ID}/watermeters/payments/${YEAR}`
  );

  // Show results
  console.log('\n================================\n');
  testHarness.showSummary();
  
  // Return simple result tracking
  return {
    total: testHarness.testCount || 0,
    passed: testHarness.passedCount || 0,
    failed: testHarness.failedCount || 0
  };
}

// Run tests
console.log('🚀 Starting Quick Water Meter Test...\n');
console.log(`📍 Testing with: Client=${CLIENT_ID}, Unit=${UNIT_ID}, Period=${YEAR}/${MONTH}\n`);

quickWaterMeterTest()
  .then(results => {
    const successRate = results.total > 0 ? 
      (results.passed / results.total * 100).toFixed(1) : 0;
    
    console.log('\n✅ Quick Test Complete!');
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Passed: ${results.passed}/${results.total}\n`);
    
    if (results.failed > 0) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
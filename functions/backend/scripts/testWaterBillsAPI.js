// scripts/testWaterBillsAPI.js
import axios from 'axios';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { spawn } = require('child_process');

const API_BASE = 'http://localhost:5001/api';
let TOKEN = null;

// Test configuration
const TEST_CONFIG = {
  clientId: 'AVII',
  year: 2026,
  month: 0, // January (0-based indexing)
  testReadings: {
    '101': 1767,
    '102': 2347,
    '103': 3456
  }
};

/**
 * Get authentication token for testing
 * Uses the test UID from critical requirements
 */
async function getAuthToken() {
  try {
    // Use the test UID from critical requirements
    const testUid = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
    
    // Try to login with test credentials
    console.log('🔐 Getting authentication token...');
    
    // For now, we'll expect the token to be provided by the user or use a mock
    // In production testing, this would authenticate through the auth endpoint
    const response = await axios.post(`${API_BASE}/auth/test-token`, {
      uid: testUid
    }).catch(() => {
      // If test-token endpoint doesn't exist, ask user to provide token
      console.log('⚠️  Test token endpoint not available');
      console.log('💡 Please provide a valid JWT token for testing:');
      console.log('   1. Login to the application');
      console.log('   2. Get JWT token from browser dev tools');
      console.log('   3. Set TOKEN variable in this script');
      return null;
    });
    
    if (response?.data?.token) {
      TOKEN = response.data.token;
      console.log('✅ Authentication token obtained');
    } else {
      // Fallback: use a placeholder that would need to be replaced
      console.log('⚠️  Using placeholder token - replace with actual token before running');
      TOKEN = 'REPLACE_WITH_ACTUAL_JWT_TOKEN';
    }
    
    return TOKEN;
  } catch (error) {
    console.error('❌ Error getting auth token:', error.message);
    throw error;
  }
}

/**
 * Initialize project structure for testing
 */
async function initializeTestProject() {
  try {
    console.log('🔧 Initializing test project structure...');
    
    const config = {
      enabled: true,
      ratePerM3: 5000, // 50.00 pesos per cubic meter (in cents)
      applyIVA: false,
      penaltyRate: 0.05, // 5% penalty
      penaltyDays: 10,
      currency: 'MXN',
      readingDay: 28,
      meterOrder: ['101', '102', '103'],
      unitsWithMeters: ['101', '102', '103']
    };
    
    const response = await axios.post(
      `${API_BASE}/clients/${TEST_CONFIG.clientId}/projects/waterBills/${TEST_CONFIG.year}/initialize`,
      config,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    
    if (response.data.success) {
      console.log('✅ Test project structure initialized');
    } else {
      throw new Error('Failed to initialize project structure');
    }
    
    return response.data;
  } catch (error) {
    // If it's already initialized, that's OK
    if (error.response?.status === 409 || error.message.includes('already exists')) {
      console.log('ℹ️  Test project structure already exists');
      return { success: true };
    }
    throw error;
  }
}

/**
 * Test 1: Submit meter readings
 */
async function testSubmitReadings() {
  try {
    console.log('\n📊 Test 1: Submitting meter readings...');
    
    const response = await axios.post(
      `${API_BASE}/clients/${TEST_CONFIG.clientId}/projects/waterBills/${TEST_CONFIG.year}/${TEST_CONFIG.month}/readings`,
      {
        readings: TEST_CONFIG.testReadings
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    
    if (!response.data.success) {
      throw new Error('Failed to submit readings');
    }
    
    console.log('✅ Readings submitted successfully');
    
    // Validate the response data
    const submittedData = response.data.data;
    if (!submittedData['101'] || !submittedData['102'] || !submittedData['103']) {
      throw new Error('Missing unit data in response');
    }
    
    // Check that consumption was calculated (assuming prior readings exist or default to 0)
    const unit101 = submittedData['101'];
    console.log(`   Unit 101: ${unit101.priorReading || 0} → ${unit101.currentReading} = ${unit101.consumption}m³`);
    console.log(`   Amount calculated: $${unit101.amount / 100} MXN`);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Test 1 FAILED:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test 2: Read back the data
 */
async function testReadData() {
  try {
    console.log('\n🔍 Test 2: Reading back data...');
    
    const response = await axios.get(
      `${API_BASE}/clients/${TEST_CONFIG.clientId}/projects/waterBills/${TEST_CONFIG.year}/${TEST_CONFIG.month}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    
    if (!response.data.success) {
      throw new Error('Failed to read data');
    }
    
    const periodData = response.data.data;
    if (!periodData.units) {
      throw new Error('No units data found');
    }
    
    // Validate that our submitted readings are there
    const unit101 = periodData.units['101'];
    if (!unit101) {
      throw new Error('Unit 101 data not found');
    }
    
    if (unit101.currentReading !== TEST_CONFIG.testReadings['101']) {
      throw new Error(`Wrong reading: ${unit101.currentReading} (expected ${TEST_CONFIG.testReadings['101']})`);
    }
    
    console.log('✅ Data reads back correctly');
    console.log(`   Unit 101: ${unit101.priorReading || 0} → ${unit101.currentReading} = ${unit101.consumption}m³`);
    console.log(`   Amount due: $${unit101.amount / 100} MXN`);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Test 2 FAILED:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test 3: Process payment
 */
async function testProcessPayment() {
  try {
    console.log('\n💰 Test 3: Processing payment...');
    
    // First, get the current amount due for unit 101
    const dataResponse = await axios.get(
      `${API_BASE}/clients/${TEST_CONFIG.clientId}/projects/waterBills/${TEST_CONFIG.year}/${TEST_CONFIG.month}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    
    const unit101 = dataResponse.data.data.units['101'];
    const amountDue = unit101.amount;
    
    console.log(`   Amount due for unit 101: $${amountDue / 100} MXN`);
    
    const response = await axios.post(
      `${API_BASE}/clients/${TEST_CONFIG.clientId}/projects/waterBills/${TEST_CONFIG.year}/${TEST_CONFIG.month}/payments`,
      {
        unitId: '101', // CRITICAL: Using unitId NOT id per requirements
        amount: amountDue / 100, // Convert cents to dollars for API
        method: 'bank_transfer'
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    
    if (!response.data.success) {
      throw new Error('Payment not processed');
    }
    
    const payment = response.data.payment;
    if (!payment.principalPaid || payment.principalPaid !== amountDue) {
      throw new Error(`Payment not processed correctly: ${payment.principalPaid} vs ${amountDue}`);
    }
    
    console.log('✅ Payment processed successfully');
    console.log(`   Principal paid: $${payment.principalPaid / 100} MXN`);
    console.log(`   Penalty paid: $${payment.penaltyPaid / 100} MXN`);
    console.log(`   Payment ID: ${payment.paymentId}`);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Test 3 FAILED:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test 4: Verify payment status
 */
async function testVerifyPayment() {
  try {
    console.log('\n🔍 Test 4: Verifying payment status...');
    
    const response = await axios.get(
      `${API_BASE}/clients/${TEST_CONFIG.clientId}/projects/waterBills/${TEST_CONFIG.year}/${TEST_CONFIG.month}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    
    const unit101 = response.data.data.units['101'];
    
    if (!unit101.paid) {
      throw new Error('Unit not marked as paid');
    }
    
    if (unit101.monthsBehind !== 0 || unit101.unpaidBalance !== 0) {
      throw new Error(`Data integrity error: monthsBehind=${unit101.monthsBehind}, unpaidBalance=${unit101.unpaidBalance}`);
    }
    
    if (!unit101.paymentRecord) {
      throw new Error('Payment record not found');
    }
    
    console.log('✅ Payment status verified');
    console.log(`   Paid: ${unit101.paid}`);
    console.log(`   Months behind: ${unit101.monthsBehind}`);
    console.log(`   Unpaid balance: $${unit101.unpaidBalance / 100} MXN`);
    console.log(`   Payment record: ${unit101.paymentRecord.paymentId}`);
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Test 4 FAILED:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test 5: Data integrity validation
 */
async function testDataIntegrity() {
  try {
    console.log('\n🛡️  Test 5: Data integrity validation...');
    
    // Get all data for the year
    const response = await axios.get(
      `${API_BASE}/clients/${TEST_CONFIG.clientId}/projects/waterBills/${TEST_CONFIG.year}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    
    const yearData = response.data.data;
    let issuesFound = 0;
    
    // Check each month's data
    Object.entries(yearData.months).forEach(([monthIndex, monthData]) => {
      if (monthData.units) {
        Object.entries(monthData.units).forEach(([unitId, unit]) => {
          // Validate data integrity rules
          if (unit.monthsBehind > 0 && unit.unpaidBalance === 0) {
            console.error(`   ❌ Unit ${unitId} month ${monthIndex}: ${unit.monthsBehind} months behind but no unpaid balance`);
            issuesFound++;
          }
          
          if (unit.monthsBehind === 0 && unit.unpaidBalance > 0) {
            console.error(`   ❌ Unit ${unitId} month ${monthIndex}: Has unpaid balance but monthsBehind is 0`);
            issuesFound++;
          }
          
          if (unit.monthsBehind < 0 || unit.unpaidBalance < 0) {
            console.error(`   ❌ Unit ${unitId} month ${monthIndex}: Negative values detected`);
            issuesFound++;
          }
        });
      }
    });
    
    if (issuesFound === 0) {
      console.log('✅ Data integrity validation passed');
      console.log(`   Checked all units across ${Object.keys(yearData.months).length} months`);
    } else {
      throw new Error(`${issuesFound} data integrity issues found`);
    }
    
    return response.data;
    
  } catch (error) {
    console.error('❌ Test 5 FAILED:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Testing Water Bills API (Projects Pattern)...\n');
  console.log('=' .repeat(60));
  
  try {
    // Setup
    await getAuthToken();
    
    if (TOKEN === 'REPLACE_WITH_ACTUAL_JWT_TOKEN') {
      console.log('\n❌ CANNOT RUN TESTS: Please set a valid JWT token');
      console.log('To get a token:');
      console.log('1. Login to the SAMS application');
      console.log('2. Open browser developer tools');
      console.log('3. Look in localStorage or network requests for JWT token');
      console.log('4. Replace TOKEN variable in this script');
      return;
    }
    
    await initializeTestProject();
    
    // Run tests in sequence
    await testSubmitReadings();
    await testReadData();
    await testProcessPayment();
    await testVerifyPayment();
    await testDataIntegrity();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('\n✅ Backend API is ready for frontend integration');
    console.log('✅ Data integrity validated');
    console.log('✅ Payment processing working correctly');
    console.log('✅ Generic projects pattern implemented successfully');
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.error('❌ TEST SUITE FAILED');
    console.error('Error:', error.message);
    
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Ensure backend server is running on port 3001');
    console.log('2. Verify authentication token is valid');
    console.log('3. Check that AVII client exists in database');
    console.log('4. Review server logs for detailed error information');
    
    process.exit(1);
  }
}

/**
 * Check if backend server is running
 */
async function checkServerHealth() {
  try {
    const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Water Bills API Test Suite');
  console.log('Configuration:', {
    API_BASE,
    clientId: TEST_CONFIG.clientId,
    year: TEST_CONFIG.year,
    month: TEST_CONFIG.month
  });
  
  // Check server health first
  console.log('\n🔍 Checking server health...');
  const serverHealthy = await checkServerHealth();
  
  if (!serverHealthy) {
    console.error('❌ Backend server is not responding');
    console.error(`Please ensure server is running on ${API_BASE}`);
    process.exit(1);
  }
  
  console.log('✅ Backend server is responding');
  
  // Run the test suite
  await runAllTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  runAllTests,
  TEST_CONFIG,
  getAuthToken,
  testSubmitReadings,
  testReadData,
  testProcessPayment,
  testVerifyPayment,
  testDataIntegrity
};
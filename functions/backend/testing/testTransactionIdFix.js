import { createApiClient } from './apiClient.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';
import { getNow } from '../services/DateService.js';

const { generateTransactionId } = databaseFieldMappings;

/**
 * Test script to verify transaction ID generation fix
 * Tests that transaction IDs preserve the correct date without timezone conversion
 */

async function testTransactionIdGeneration() {
  console.log('\n🧪 Testing Transaction ID Generation Fix\n');
  console.log('=' * 60);
  
  // Test 1: Test with a specific date (January 7th, 2025)
  console.log('\n📅 Test 1: User-entered date (January 7, 2025)');
  const userDate = new Date('2025-01-07T00:00:00.000Z');
  console.log(`Input UTC Date: ${userDate.toISOString()}`);
  
  const id1 = await generateTransactionId(userDate.toISOString());
  console.log(`Generated ID: ${id1}`);
  console.log(`ID Date Part: ${id1.split('_')[0]}`);
  console.log(`✅ Should be: 2025-01-07 (not 2025-01-06)`);
  
  // Test 2: Test with current time using getNow()
  console.log('\n📅 Test 2: System-generated timestamp (getNow)');
  const nowCancun = getNow();
  console.log(`getNow() result: ${nowCancun.toISOString()}`);
  console.log(`Local string: ${nowCancun.toString()}`);
  
  const id2 = await generateTransactionId(nowCancun.toISOString());
  console.log(`Generated ID: ${id2}`);
  console.log(`ID Date Part: ${id2.split('_')[0]}`);
  
  // Test 3: Test without providing a date (should use getNow internally)
  console.log('\n📅 Test 3: No date provided (uses getNow internally)');
  const id3 = await generateTransactionId();
  console.log(`Generated ID: ${id3}`);
  console.log(`ID Date Part: ${id3.split('_')[0]}`);
  
  // Test 4: Test edge case - late night UTC time
  console.log('\n📅 Test 4: Edge case - Late night UTC (should not shift date)');
  const lateNight = new Date('2025-01-07T23:00:00.000Z');
  console.log(`Input UTC Date: ${lateNight.toISOString()}`);
  
  const id4 = await generateTransactionId(lateNight.toISOString());
  console.log(`Generated ID: ${id4}`);
  console.log(`ID Date Part: ${id4.split('_')[0]}`);
  console.log(`✅ Should be: 2025-01-07`);
  
  console.log('\n' + '=' * 60);
  console.log('✅ Transaction ID generation test complete');
}

// Test actual transaction creation via API
async function testTransactionCreation() {
  console.log('\n\n🧪 Testing Transaction Creation via API\n');
  console.log('=' * 60);
  
  const api = await createApiClient();
  
  // Create a test transaction with specific date
  const testDate = '2025-01-07';
  const testTransaction = {
    date: testDate,
    amount: 100.00,
    type: 'income',
    category: 'Test Category',
    vendor: 'Test Vendor',
    description: 'Test transaction for ID generation',
    paymentMethod: 'cash',
    account: 'checking',
    taxDeductible: false,
    cleared: true
  };
  
  console.log(`\n📝 Creating transaction for date: ${testDate}`);
  
  try {
    const response = await api.post('/transactions', testTransaction);
    const created = response.data;
    
    console.log(`Transaction ID: ${created.id}`);
    console.log(`ID Date Part: ${created.id.split('_')[0]}`);
    console.log(`Transaction Date: ${created.date}`);
    console.log(`✅ ID should start with: 2025-01-07`);
    
    // Clean up - delete the test transaction
    await api.delete(`/transactions/${created.id}`);
    console.log('🧹 Test transaction deleted');
    
  } catch (error) {
    console.error('❌ Error creating transaction:', error.response?.data || error.message);
  }
  
  console.log('\n' + '=' * 60);
  console.log('✅ API transaction test complete');
}

// Run all tests
async function runAllTests() {
  await testTransactionIdGeneration();
  await testTransactionCreation();
  process.exit(0);
}

runAllTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
import { testHarness } from './testHarness.js';

/**
 * Test HOA payment functionality with allocations array only
 * Verifies that duesDistribution removal doesn't break HOA payments
 */

async function testHOAPaymentAllocations() {
  const harness = testHarness;
  
  console.log('\n🧪 Testing HOA Payment with Allocations Only\n');
  
  // Test creating an HOA payment
  await harness.runTest({
    name: 'Create HOA Payment',
    test: async (client) => {
    const paymentData = {
      unit: "PH3A", 
      year: 2025,
      amount: 12000,
      transactionType: "income",
      category: "HOA Dues",
      method: "bank_transfer",
      notes: "Test payment - allocations only",
      months: [1, 2, 3] // January, February, March
    };
    
    const response = await client.post('/api/hoa-dues/payment', paymentData);
    
    // Check that payment was created successfully
    harness.assertEqual(response.status, 200, 'Payment should be created successfully');
    harness.assertTrue(response.data.transactionId, 'Should return transaction ID');
    
    // Fetch the transaction to verify structure
    const txResponse = await client.get(`/api/transactions/${response.data.transactionId}`);
    const transaction = txResponse.data;
    
    console.log('\n📄 Transaction structure:');
    console.log('- Has allocations:', !!transaction.allocations);
    console.log('- Allocations count:', transaction.allocations?.length || 0);
    console.log('- Has duesDistribution:', !!transaction.duesDistribution);
    console.log('- Category:', transaction.category);
    console.log('- Amount:', transaction.amount);
    
    // Verify allocations exist and are correct
    harness.assertTrue(transaction.allocations, 'Transaction should have allocations array');
    harness.assertEqual(transaction.allocations.length, 3, 'Should have 3 allocations (one per month)');
    
    // Verify no duesDistribution field exists
    harness.assertFalse(transaction.hasOwnProperty('duesDistribution'), 'Transaction should NOT have duesDistribution field');
    
    // Check allocation structure
    if (transaction.allocations && transaction.allocations.length > 0) {
      const firstAllocation = transaction.allocations[0];
      console.log('\n📊 First allocation structure:', JSON.stringify(firstAllocation, null, 2));
      
      harness.assertEqual(firstAllocation.type, 'hoa_month', 'Allocation type should be hoa_month');
      harness.assertTrue(firstAllocation.data, 'Allocation should have data object');
      harness.assertTrue(firstAllocation.data.month, 'Allocation data should have month');
      harness.assertTrue(firstAllocation.data.unitId, 'Allocation data should have unitId');
      harness.assertEqual(firstAllocation.data.year, 2025, 'Allocation data should have correct year');
      harness.assertEqual(firstAllocation.amount, 4000, 'Each month allocation should be 4000 (12000/3)');
    }
    
    return response.data.transactionId;
  }});
  
  // Test fetching HOA dues data
  await harness.runTest({
    name: 'Fetch HOA Dues Data',
    test: async (client) => {
    const response = await client.get('/api/hoa-dues/unit/PH3A/2025');
    
    harness.assertEqual(response.status, 200, 'Should fetch dues data successfully');
    
    const duesData = response.data.hoaDues;
    console.log('\n💰 HOA Dues data:');
    console.log('- Unit:', duesData.unit);
    console.log('- Year:', duesData.year);
    console.log('- Credit balance:', duesData.creditBalance);
    console.log('- Payments count:', Object.keys(duesData.payments || {}).length);
    
    // Check if our payment was recorded
    const hasJanuary = duesData.payments && duesData.payments[1];
    const hasFebruary = duesData.payments && duesData.payments[2];
    const hasMarch = duesData.payments && duesData.payments[3];
    
    harness.assertTrue(hasJanuary, 'January payment should be recorded');
    harness.assertTrue(hasFebruary, 'February payment should be recorded');
    harness.assertTrue(hasMarch, 'March payment should be recorded');
    
    return duesData;
  }});
  
  console.log('\n✅ HOA Payment Allocations Test Complete!\n');
}

// Run the test
testHOAPaymentAllocations()
  .then(() => {
    console.log('All tests completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
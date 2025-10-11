// Test script to verify that HOA overpayment notes are properly added to transaction records
import { getDb } from '../backend/firebase.js';
import { recordDuesPayment } from '../backend/controllers/hoaDuesController.js';

const clientId = 'mtc'; // Use a test client ID
const unitId = 'TEST_OVERPAY'; // Use a test unit ID for this specific test
const year = 2025; // Use current year

async function runOverpaymentTest() {
  try {
    console.log('🔍 Starting HOA overpayment notes test...');
    
    // Test Case 1: Simple Overpayment (No existing credit)
    console.log('\n=== Test Case 1: Simple Overpayment ===');
    const paymentData1 = {
      amount: 1200,
      date: new Date(),
      method: 'Credit Card',
      description: 'HOA Dues Payment',
      notes: 'Test overpayment',
      scheduledAmount: 1000,
      creditBalanceAdded: 200, // Overpayment amount
      newCreditBalance: 200 // New total credit balance
    };
    
    const distribution1 = [
      { month: 1, amountToAdd: 1000 } // Only $1000 applied to dues, $200 becomes credit
    ];
    
    console.log('📝 Creating simple overpayment test:', { paymentData1, distribution1 });
    const result1 = await recordDuesPayment(clientId, unitId + '_1', year, paymentData1, distribution1);
    console.log('✅ Simple overpayment recorded:', result1.transactionId);
    
    // Verify transaction notes
    const db = await getDb();
    const transactionDoc1 = await db.collection('clients').doc(clientId)
                              .collection('transactions').doc(result1.transactionId).get();
    
    if (transactionDoc1.exists) {
      const transactionData1 = transactionDoc1.data();
      console.log('✅ Transaction notes:', transactionData1.notes);
      
      // Check if notes contain expected overpayment information
      const notes = transactionData1.notes || '';
      const hasOverpaymentInfo = notes.includes('Overpayment Credit Added: $200.00');
      const hasNewBalance = notes.includes('New Credit Balance: $200.00');
      
      if (hasOverpaymentInfo && hasNewBalance) {
        console.log('✅ Test Case 1 PASSED: Overpayment notes are correctly added');
      } else {
        console.error('❌ Test Case 1 FAILED: Missing overpayment information in notes');
        console.error('Expected: Overpayment Credit Added, New Credit Balance');
        console.error('Actual notes:', notes);
      }
    } else {
      console.error('❌ Test Case 1 FAILED: Transaction record not found!');
    }
    
    // Test Case 2: Overpayment with Existing Credit
    console.log('\n=== Test Case 2: Overpayment with Existing Credit ===');
    const paymentData2 = {
      amount: 1200,
      date: new Date(),
      method: 'Check',
      checkNumber: '67890',
      description: 'HOA Dues Payment',
      notes: 'Test overpayment with existing credit',
      scheduledAmount: 1000,
      creditBalanceAdded: 200, // New overpayment amount
      newCreditBalance: 350 // Previous $150 + new $200
    };
    
    const distribution2 = [
      { month: 2, amountToAdd: 1000 }
    ];
    
    console.log('📝 Creating overpayment with existing credit test:', { paymentData2, distribution2 });
    const result2 = await recordDuesPayment(clientId, unitId + '_2', year, paymentData2, distribution2);
    console.log('✅ Overpayment with existing credit recorded:', result2.transactionId);
    
    // Verify transaction notes
    const transactionDoc2 = await db.collection('clients').doc(clientId)
                              .collection('transactions').doc(result2.transactionId).get();
    
    if (transactionDoc2.exists) {
      const transactionData2 = transactionDoc2.data();
      console.log('✅ Transaction notes:', transactionData2.notes);
      
      // Check if notes contain expected overpayment information including previous balance
      const notes = transactionData2.notes || '';
      const hasOverpaymentInfo = notes.includes('Overpayment Credit Added: $200.00');
      const hasPreviousBalance = notes.includes('Previous Credit Balance: $150.00');
      const hasNewBalance = notes.includes('New Credit Balance: $350.00');
      
      if (hasOverpaymentInfo && hasPreviousBalance && hasNewBalance) {
        console.log('✅ Test Case 2 PASSED: Overpayment with existing credit notes are correctly added');
      } else {
        console.error('❌ Test Case 2 FAILED: Missing complete overpayment information in notes');
        console.error('Expected: Overpayment Credit Added, Previous Credit Balance, New Credit Balance');
        console.error('Actual notes:', notes);
      }
    } else {
      console.error('❌ Test Case 2 FAILED: Transaction record not found!');
    }
    
    // Test Case 3: Credit Usage (should still work)
    console.log('\n=== Test Case 3: Credit Usage (Control Test) ===');
    const paymentData3 = {
      amount: 800,
      date: new Date(),
      method: 'Credit Card',
      description: 'HOA Dues Payment',
      notes: 'Test credit usage',
      scheduledAmount: 1000,
      creditUsed: 200, // Using existing credit
      newCreditBalance: 0 // Credit balance goes to zero
    };
    
    const distribution3 = [
      { month: 3, amountToAdd: 1000 } // $800 payment + $200 credit = $1000 dues
    ];
    
    console.log('📝 Creating credit usage test:', { paymentData3, distribution3 });
    const result3 = await recordDuesPayment(clientId, unitId + '_3', year, paymentData3, distribution3);
    console.log('✅ Credit usage recorded:', result3.transactionId);
    
    // Verify transaction notes
    const transactionDoc3 = await db.collection('clients').doc(clientId)
                              .collection('transactions').doc(result3.transactionId).get();
    
    if (transactionDoc3.exists) {
      const transactionData3 = transactionDoc3.data();
      console.log('✅ Transaction notes:', transactionData3.notes);
      
      // Check if notes contain expected credit usage information
      const notes = transactionData3.notes || '';
      const hasCreditUsage = notes.includes('Credit Balance Applied: $200.00');
      
      if (hasCreditUsage) {
        console.log('✅ Test Case 3 PASSED: Credit usage notes are correctly added');
      } else {
        console.error('❌ Test Case 3 FAILED: Missing credit usage information in notes');
        console.error('Expected: Credit Balance Applied');
        console.error('Actual notes:', notes);
      }
    } else {
      console.error('❌ Test Case 3 FAILED: Transaction record not found!');
    }
    
    console.log('\n🎉 All overpayment notes tests completed!');
    
  } catch (error) {
    console.error('❌ Error during overpayment notes test:', error);
    throw error;
  }
}

// Run the test
runOverpaymentTest().catch(console.error);
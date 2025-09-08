// Test script to verify the new concise notes format
import { getDb } from '../backend/firebase.js';
import { recordDuesPayment } from '../backend/controllers/hoaDuesController.js';

const clientId = 'mtc'; // Use test client
const year = 2025;

async function testNewNotesFormat() {
  try {
    console.log('🔍 Testing new concise notes format...');
    
    // Test Case 1: Simple overpayment like your screenshot (4600 dues + 400 credit = 5000 payment)
    console.log('\n=== Test Case 1: $4600 Dues + $400 credit (matches your example) ===');
    const paymentData1 = {
      amount: 5000,
      date: new Date(),
      method: 'bank_transfer',
      description: 'HOA Dues Payment',
      notes: 'Jul 2025 payment',
      scheduledAmount: 4600,
      creditBalanceAdded: 400,
      newCreditBalance: 400
    };
    
    const distribution1 = [
      { month: 7, amountToAdd: 4600 }
    ];
    
    const result1 = await recordDuesPayment(clientId, 'TEST_FORMAT_1', year, paymentData1, distribution1);
    
    const db = await getDb();
    const transactionDoc1 = await db.collection('clients').doc(clientId)
                              .collection('transactions').doc(result1.transactionId).get();
    
    if (transactionDoc1.exists) {
      const notes1 = transactionDoc1.data().notes;
      console.log('✅ Notes:', notes1);
      
      if (notes1.includes('$4600 Dues + $400 credit')) {
        console.log('✅ PASSED: Correct format for overpayment');
      } else {
        console.log('❌ FAILED: Expected "$4600 Dues + $400 credit"');
      }
    }
    
    // Test Case 2: Multiple months + credit (15000 dues + 1000 credit = 16000 payment)
    console.log('\n=== Test Case 2: $15000 Dues + $1000 credit ===');
    const paymentData2 = {
      amount: 16000,
      date: new Date(),
      method: 'check',
      checkNumber: '12345',
      description: 'HOA Dues Payment',
      notes: 'Multi-month payment',
      scheduledAmount: 5000, // Monthly amount
      creditBalanceAdded: 1000,
      newCreditBalance: 1000
    };
    
    const distribution2 = [
      { month: 1, amountToAdd: 5000 },
      { month: 2, amountToAdd: 5000 },
      { month: 3, amountToAdd: 5000 }
    ]; // 3 months = 15000, overpayment = 1000
    
    const result2 = await recordDuesPayment(clientId, 'TEST_FORMAT_2', year, paymentData2, distribution2);
    
    const transactionDoc2 = await db.collection('clients').doc(clientId)
                              .collection('transactions').doc(result2.transactionId).get();
    
    if (transactionDoc2.exists) {
      const notes2 = transactionDoc2.data().notes;
      console.log('✅ Notes:', notes2);
      
      if (notes2.includes('$15000 Dues + $1000 credit')) {
        console.log('✅ PASSED: Correct format for multi-month overpayment');
      } else {
        console.log('❌ FAILED: Expected "$15000 Dues + $1000 credit"');
      }
    }
    
    // Test Case 3: Credit usage (800 payment + 200 credit = 1000 dues)
    console.log('\n=== Test Case 3: $800 Dues + $200 credit (credit usage) ===');
    const paymentData3 = {
      amount: 800,
      date: new Date(),
      method: 'Credit Card',
      description: 'HOA Dues Payment',
      notes: 'Using existing credit',
      scheduledAmount: 1000,
      creditUsed: 200,
      newCreditBalance: 0
    };
    
    const distribution3 = [
      { month: 4, amountToAdd: 1000 }
    ];
    
    const result3 = await recordDuesPayment(clientId, 'TEST_FORMAT_3', year, paymentData3, distribution3);
    
    const transactionDoc3 = await db.collection('clients').doc(clientId)
                              .collection('transactions').doc(result3.transactionId).get();
    
    if (transactionDoc3.exists) {
      const notes3 = transactionDoc3.data().notes;
      console.log('✅ Notes:', notes3);
      
      if (notes3.includes('$800 Dues + $200 credit')) {
        console.log('✅ PASSED: Correct format for credit usage');
      } else {
        console.log('❌ FAILED: Expected "$800 Dues + $200 credit"');
      }
    }
    
    console.log('\n🎉 All format tests completed!');
    
  } catch (error) {
    console.error('❌ Error during format test:', error);
    throw error;
  }
}

// Run the test
testNewNotesFormat().catch(console.error);
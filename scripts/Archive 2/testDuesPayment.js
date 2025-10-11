// Test script to verify that HOA dues payments are properly saved to both transactions and dues collections
import { getDb } from '../backend/firebase.js';
import { recordDuesPayment } from '../backend/controllers/hoaDuesController.js';

const clientId = 'mtc'; // Use a test client ID
const unitId = 'A101';  // Use a test unit ID
const year = 2025;     // Use current year

async function runTest() {
  try {
    console.log('🔍 Starting HOA dues payment test...');
    
    // Define a test payment
    const paymentData = {
      amount: 500,
      date: new Date(),
      method: 'check',
      checkNumber: '12345',
      description: 'Test HOA Dues Payment',
      notes: 'This is a test payment from the test script',
      scheduledAmount: 1000
    };
    
    // Define how to distribute the payment across months
    const distribution = [
      { month: 1, amountToAdd: 250 },
      { month: 2, amountToAdd: 250 }
    ];
    
    console.log('📝 Creating test payment:', { paymentData, distribution });
    
    // Record the payment
    const result = await recordDuesPayment(clientId, unitId, year, paymentData, distribution);
    
    console.log('✅ Payment recorded successfully:', result);
    
    // Verify the records were created
    const db = await getDb();
    
    // Check the transaction collection
    console.log('🔍 Checking transaction record...');
    const transactionDoc = await db.collection('clients').doc(clientId)
                             .collection('transactions').doc(result.transactionId).get();
                             
    if (transactionDoc.exists) {
      console.log('✅ Transaction record found:', transactionDoc.data());
    } else {
      console.error('❌ Transaction record not found!');
    }
    
    // Check the dues collection
    console.log('🔍 Checking dues record...');
    const duesDoc = await db.collection('clients').doc(clientId)
                       .collection('units').doc(unitId)
                       .collection('dues').doc(year.toString()).get();
                       
    if (duesDoc.exists) {
      const duesData = duesDoc.data();
      console.log('✅ Dues record found:', {
        creditBalance: duesData.creditBalance,
        scheduledAmount: duesData.scheduledAmount,
        payments: duesData.payments
      });
      
      // Verify the payment is in the payments array
      const hasNewPayment = duesData.payments?.some(p => p.transactionId === result.transactionId);
      if (hasNewPayment) {
        console.log('✅ New payment found in the dues record payments array');
      } else {
        console.error('❌ New payment NOT found in the dues record payments array!');
      }
    } else {
      console.error('❌ Dues record not found!');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
runTest().then(() => {
  console.log('🏁 Test completed');
}).catch(err => {
  console.error('💥 Fatal error:', err);
});

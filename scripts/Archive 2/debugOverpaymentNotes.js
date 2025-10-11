// Debug script to test the exact overpayment scenario from the screenshots
import { getDb } from '../backend/firebase.js';
import { recordDuesPayment } from '../backend/controllers/hoaDuesController.js';

const clientId = 'cv'; // Based on the screenshots, looks like CV client
const unitId = '1A'; // Unit 1A from screenshot
const year = 2025;

async function debugActualPayment() {
  try {
    console.log('🔍 Starting debug for actual overpayment scenario...');
    console.log('Simulating: Unit 1A, 4600 pesos dues, 5000 pesos payment (400 overpayment)');
    
    // Simulate the EXACT payment from your screenshot
    const paymentData = {
      amount: 5000,
      date: new Date('2025-06-21T19:00:00.000Z'), // Match screenshot date
      method: 'bank_transfer',
      description: 'HOA Dues payment for Unit 1A',
      notes: 'Jul 2025 - Overpayment by 400 pesos. Automatic credit notes →',
      scheduledAmount: 4600, // Monthly dues
      creditBalanceAdded: 400, // THIS SHOULD TRIGGER THE NOTES
      newCreditBalance: 400, // Assuming no existing credit
      creditUsed: 0,
      creditRepairAmount: 0
    };
    
    // Distribution: All 4600 goes to month 7 (July)
    const distribution = [
      { month: 7, amountToAdd: 4600 } // Full dues amount
    ];
    
    console.log('📝 Payment data being sent to backend:');
    console.log(JSON.stringify(paymentData, null, 2));
    console.log('📝 Distribution:');
    console.log(JSON.stringify(distribution, null, 2));
    
    // Add extra logging to see what's happening
    console.log('\n=== CRITICAL DEBUG INFO ===');
    console.log('creditBalanceAdded:', paymentData.creditBalanceAdded);
    console.log('Type of creditBalanceAdded:', typeof paymentData.creditBalanceAdded);
    console.log('creditBalanceAdded > 0?', paymentData.creditBalanceAdded && paymentData.creditBalanceAdded > 0);
    console.log('newCreditBalance:', paymentData.newCreditBalance);
    console.log('============================\n');
    
    // Record the payment
    const result = await recordDuesPayment(clientId, unitId, year, paymentData, distribution);
    
    console.log('✅ Payment recorded with transaction ID:', result.transactionId);
    
    // Immediately check the transaction record
    const db = await getDb();
    const transactionDoc = await db.collection('clients').doc(clientId)
                              .collection('transactions').doc(result.transactionId).get();
    
    if (transactionDoc.exists) {
      const transactionData = transactionDoc.data();
      console.log('\n=== TRANSACTION RECORD ===');
      console.log('Transaction ID:', result.transactionId);
      console.log('Amount:', transactionData.amount);
      console.log('Method:', transactionData.paymentMethod);
      console.log('Notes:');
      console.log('-------');
      console.log(transactionData.notes);
      console.log('-------');
      console.log('End of notes\n');
      
      // Check if overpayment notes are present
      const notes = transactionData.notes || '';
      const hasOverpaymentInfo = notes.includes('Overpayment Credit Added');
      const hasNewBalance = notes.includes('New Credit Balance');
      
      if (hasOverpaymentInfo && hasNewBalance) {
        console.log('✅ SUCCESS: Overpayment notes are correctly added to transaction!');
      } else {
        console.log('❌ PROBLEM: Overpayment notes are missing from transaction!');
        console.log('Expected to find: "Overpayment Credit Added" and "New Credit Balance"');
      }
      
      // Let's also check what creditBalanceAdded actually was in the backend
      console.log('\n=== DEBUGGING THE BACKEND LOGIC ===');
      console.log('Let me manually check the condition...');
      
      // Simulate the backend condition
      const testCreditBalanceAdded = paymentData.creditBalanceAdded;
      console.log('testCreditBalanceAdded:', testCreditBalanceAdded);
      console.log('testCreditBalanceAdded > 0:', testCreditBalanceAdded > 0);
      
      if (testCreditBalanceAdded && testCreditBalanceAdded > 0) {
        console.log('✅ Backend condition SHOULD have been met');
        let testNotes = 'HOA Dues payment for Unit 1A - Jul 2025 - Overpayment by 400 pesos. Automatic credit notes →';
        testNotes += `\nOverpayment Credit Added: $${testCreditBalanceAdded.toFixed(2)}`;
        testNotes += `\nNew Credit Balance: $${paymentData.newCreditBalance.toFixed(2)}`;
        console.log('Expected notes should look like:');
        console.log('-------');
        console.log(testNotes);
        console.log('-------');
      } else {
        console.log('❌ Backend condition was NOT met - this is the problem!');
      }
      
    } else {
      console.error('❌ Transaction record not found!');
    }
    
    console.log('\n🔍 Debug completed!');
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
    throw error;
  }
}

// Run the debug
debugActualPayment().catch(console.error);
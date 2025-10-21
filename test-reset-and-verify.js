// Test to understand the current bill state and reset if needed
import { waterPaymentsService } from './backend/services/waterPaymentsService.js';

async function analyzeCurrentBillState() {
  console.log('🔍 ANALYZING CURRENT BILL STATE');
  console.log('================================');
  
  try {
    // Ensure database is initialized
    await waterPaymentsService._initializeDb();
    console.log('✅ Database initialized');
    // Get unpaid bills to see current state
    const unpaidBills = await waterPaymentsService._getUnpaidBillsForUnit('AVII', '102');
    
    console.log(`📋 Found ${unpaidBills.length} unpaid bills:`);
    unpaidBills.forEach(bill => {
      console.log(`   📄 Bill ${bill.period}: $${bill.unpaidAmount} (Status: ${bill.status})`);
    });
    
    // Let's also test what happens if we try to make a small payment
    console.log('\n🧪 TESTING SMALL PAYMENT ($100)');
    console.log('================================');
    
    const result = await waterPaymentsService.calculatePaymentDistribution(
      'AVII', // clientId
      '102',  // unitId
      100,    // paymentAmount
      0,      // currentCreditBalance
      '2025-07-16',
      0       // selectedMonth (July)
    );
    
    console.log(`✅ Payment distribution result:`);
    console.log(`   📊 Total bills due: $${result.totalBillsDue}`);
    console.log(`   💳 Credit used: $${result.creditUsed}`);
    console.log(`   💰 New credit balance: $${result.newCreditBalance}`);
    console.log(`   📋 Bill payments: ${result.billPayments.length}`);
    
    result.billPayments.forEach(billPayment => {
      console.log(`   📄 Bill ${billPayment.billPeriod}: $${billPayment.amountPaid} (Status: ${billPayment.newStatus})`);
    });
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }
}

// Run the analysis
analyzeCurrentBillState().catch(console.error);

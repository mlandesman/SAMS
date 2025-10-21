/**
 * TEST: Exact payment amount to verify overpayment calculation
 */

import { waterPaymentsService } from '../backend/services/waterPaymentsService.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '102';

async function testExactPayment() {
  console.log(`\n🧪 TESTING: Exact Payment Amount`);
  console.log('='.repeat(50));
  
  try {
    // Pay exactly the total due amount
    const paymentAmount = 1377.50;  // Exact total due
    const currentCredit = 50;       // $50 credit
    const selectedMonth = 0;        // July (2026-00)
    const paymentDate = '2025-10-20';  // Current date
    
    console.log(`Payment: $${paymentAmount} + $${currentCredit} credit = $${paymentAmount + currentCredit}`);
    console.log(`Expected total due: $1377.50`);
    
    const distribution = await waterPaymentsService.calculatePaymentDistribution(
      CLIENT_ID,
      UNIT_ID,
      paymentAmount,
      currentCredit,
      paymentDate,
      selectedMonth
    );
    
    console.log(`\nResult:`);
    console.log(`  Total Base Charges: $${distribution.totalBaseCharges}`);
    console.log(`  Total Penalties: $${distribution.totalPenalties}`);
    console.log(`  Credit Used: $${distribution.creditUsed}`);
    console.log(`  Overpayment: $${distribution.overpayment}`);
    console.log(`  New Credit Balance: $${distribution.newCreditBalance}`);
    
    if (distribution.overpayment > 0) {
      console.log(`\n✅ SUCCESS: Overpayment calculated correctly`);
    } else {
      console.log(`\n❌ ISSUE: No overpayment shown`);
    }
    
  } catch (error) {
    console.error(`Error:`, error.message);
  }
}

testExactPayment();

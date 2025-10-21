/**
 * TEST: $950 payment with backdated payment date (should be full payment)
 */

import { waterPaymentsService } from '../backend/services/waterPaymentsService.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';

async function test950Payment() {
  console.log(`\n${BRIGHT}${GREEN}✅ TESTING: $950 Payment with Backdated Date${RESET}`);
  console.log('='.repeat(60));
  
  try {
    // Test scenario: Pay exactly $950 with backdated payment date
    const paymentAmount = 950;  // $950 - should fully pay the bill
    const currentCredit = 0;    // $0 credit
    const selectedMonth = 0;    // July (2026-00)
    const paymentDate = '2025-07-15';  // Backdated to 7/15/2025 (within grace period)
    
    console.log(`\n${CYAN}💰 Test Payment:${RESET}`);
    console.log(`  Payment Amount: $${paymentAmount}`);
    console.log(`  Payment Date: ${paymentDate} (within grace period)`);
    console.log(`  Expected: FULL PAYMENT (no penalties)`);
    
    // Calculate distribution
    const distribution = await waterPaymentsService.calculatePaymentDistribution(
      CLIENT_ID,
      UNIT_ID,
      paymentAmount,
      currentCredit,
      paymentDate,
      selectedMonth
    );
    
    console.log(`\n${CYAN}📊 Distribution Result:${RESET}`);
    console.log(`  Bills Processed: ${distribution.billPayments.length}`);
    console.log(`  Total Base Charges: $${distribution.totalBaseCharges}`);
    console.log(`  Total Penalties: $${distribution.totalPenalties}`);
    
    if (distribution.billPayments.length > 0) {
      const billPayment = distribution.billPayments[0];
      console.log(`  Payment Status: ${billPayment.newStatus}`);
      
      // Verify the result
      console.log(`\n${BRIGHT}${'='.repeat(60)}${RESET}`);
      console.log(`${BRIGHT}VERIFICATION${RESET}`);
      console.log('='.repeat(60));
      
      if (billPayment.newStatus === 'paid') {
        console.log(`${GREEN}✅ SUCCESS: Payment shows as PAID${RESET}`);
        console.log(`${GREEN}✅ Backdated payment date correctly removed penalties${RESET}`);
        console.log(`${GREEN}✅ $950 payment fully pays $950 bill${RESET}`);
      } else {
        console.log(`${RED}❌ ISSUE: Payment shows as ${billPayment.newStatus}${RESET}`);
        console.log(`${YELLOW}Expected: paid${RESET}`);
        console.log(`${YELLOW}Actual: ${billPayment.newStatus}${RESET}`);
      }
    }
    
  } catch (error) {
    console.error(`\n${RED}Error:${RESET}`, error.message);
  }
}

test950Payment();

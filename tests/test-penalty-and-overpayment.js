/**
 * TEST: Penalty calculation with current date (10/20/2025)
 * Should show penalties for July bill
 */

import { waterPaymentsService } from '../backend/services/waterPaymentsService.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '102'; // Using Unit 102 as shown in screenshot

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';

async function testPenaltyCalculation() {
  console.log(`\n${BRIGHT}${RED}🐛 TESTING: Penalty Calculation Bug${RESET}`);
  console.log('='.repeat(60));
  
  try {
    // Test scenario: Pay $950 with current date (should show penalties)
    const paymentAmount = 950;  // $950 - should fully pay the bill
    const currentCredit = 50;   // $50 credit (as shown in screenshot)
    const selectedMonth = 0;    // July (2026-00)
    const paymentDate = '2025-10-20';  // Current date (should have penalties)
    
    console.log(`\n${CYAN}💰 Test Payment:${RESET}`);
    console.log(`  Payment Amount: $${paymentAmount}`);
    console.log(`  Credit Balance: $${currentCredit}`);
    console.log(`  Payment Date: ${paymentDate} (current date - should have penalties)`);
    console.log(`  Expected: Should show penalties for July bill`);
    
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
    console.log(`  Credit Used: $${distribution.creditUsed}`);
    console.log(`  Overpayment: $${distribution.overpayment}`);
    console.log(`  New Credit Balance: $${distribution.newCreditBalance}`);
    
    if (distribution.billPayments.length > 0) {
      const billPayment = distribution.billPayments[0];
      console.log(`\n${CYAN}📄 Bill Payment Details:${RESET}`);
      console.log(`  Period: ${billPayment.billPeriod}`);
      console.log(`  Amount Paid: $${billPayment.amountPaid}`);
      console.log(`  Base Charge Paid: $${billPayment.baseChargePaid}`);
      console.log(`  Penalty Paid: $${billPayment.penaltyPaid}`);
      console.log(`  Status: ${billPayment.newStatus}`);
      
      // Verify the result
      console.log(`\n${BRIGHT}${'='.repeat(60)}${RESET}`);
      console.log(`${BRIGHT}VERIFICATION${RESET}`);
      console.log('='.repeat(60));
      
      if (billPayment.penaltyPaid > 0) {
        console.log(`${GREEN}✅ SUCCESS: Penalties calculated correctly${RESET}`);
        console.log(`${GREEN}✅ Penalty amount: $${billPayment.penaltyPaid}${RESET}`);
      } else {
        console.log(`${RED}❌ BUG: No penalties calculated${RESET}`);
        console.log(`${YELLOW}Expected: Penalties for July bill paid in October${RESET}`);
        console.log(`${YELLOW}Actual: $0 penalties${RESET}`);
      }
      
      if (distribution.overpayment > 0) {
        console.log(`${GREEN}✅ SUCCESS: Overpayment handled correctly${RESET}`);
        console.log(`${GREEN}✅ Overpayment: $${distribution.overpayment}${RESET}`);
        console.log(`${GREEN}✅ New credit balance: $${distribution.newCreditBalance}${RESET}`);
      } else {
        console.log(`${YELLOW}ℹ️  No overpayment in this scenario${RESET}`);
      }
    }
    
    // Test overpayment scenario
    console.log(`\n${BRIGHT}${'='.repeat(60)}${RESET}`);
    console.log(`${BRIGHT}TESTING OVERPAYMENT SCENARIO${RESET}`);
    console.log('='.repeat(60));
    
    const overpaymentAmount = 1000;  // $1000 payment for $950 bill
    
    console.log(`\n${CYAN}💰 Overpayment Test:${RESET}`);
    console.log(`  Payment Amount: $${overpaymentAmount}`);
    console.log(`  Credit Balance: $${currentCredit}`);
    console.log(`  Expected: Should show overpayment going to credit`);
    
    const overpaymentDistribution = await waterPaymentsService.calculatePaymentDistribution(
      CLIENT_ID,
      UNIT_ID,
      overpaymentAmount,
      currentCredit,
      paymentDate,
      selectedMonth
    );
    
    console.log(`\n${CYAN}📊 Overpayment Result:${RESET}`);
    console.log(`  Total Base Charges: $${overpaymentDistribution.totalBaseCharges}`);
    console.log(`  Total Penalties: $${overpaymentDistribution.totalPenalties}`);
    console.log(`  Credit Used: $${overpaymentDistribution.creditUsed}`);
    console.log(`  Overpayment: $${overpaymentDistribution.overpayment}`);
    console.log(`  New Credit Balance: $${overpaymentDistribution.newCreditBalance}`);
    
    if (overpaymentDistribution.overpayment > 0) {
      console.log(`\n${GREEN}✅ SUCCESS: Overpayment calculated correctly${RESET}`);
      console.log(`${GREEN}✅ Overpayment: $${overpaymentDistribution.overpayment}${RESET}`);
      console.log(`${GREEN}✅ New credit balance: $${overpaymentDistribution.newCreditBalance}${RESET}`);
    } else {
      console.log(`\n${RED}❌ BUG: Overpayment not calculated${RESET}`);
      console.log(`${YELLOW}Expected: Overpayment of $${overpaymentAmount - 950}${RESET}`);
      console.log(`${YELLOW}Actual: $${overpaymentDistribution.overpayment}${RESET}`);
    }
    
  } catch (error) {
    console.error(`\n${RED}Error:${RESET}`, error.message);
  }
}

testPenaltyCalculation();

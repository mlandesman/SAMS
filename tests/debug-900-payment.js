/**
 * DEBUG: Why $900 payment doesn't pay $900 bill with payment date 7/15/25
 * 
 * Reproducing the exact scenario from the screenshot
 */

import { waterPaymentsService } from '../backend/services/waterPaymentsService.js';
import { getDb } from '../backend/firebase.js';
import { centavosToPesos } from '../backend/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';

async function debug900Payment() {
  console.log(`\n${BRIGHT}${RED}🐛 DEBUG: $900 Payment Issue${RESET}`);
  console.log('='.repeat(80));
  
  try {
    // Get the actual bill for Unit 101
    const db = await getDb();
    const billRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-00');
    
    const billDoc = await billRef.get();
    const unitBill = billDoc.data()?.bills?.units?.[UNIT_ID];
    
    if (!unitBill) {
      console.log(`${RED}✗ Bill not found for Unit ${UNIT_ID}${RESET}`);
      return;
    }
    
    console.log(`\n${CYAN}📋 Current Bill State (Unit ${UNIT_ID}, July):${RESET}`);
    console.log(`  Current Charge: $${centavosToPesos(unitBill.currentCharge || 0)}`);
    console.log(`  Penalty Amount: $${centavosToPesos(unitBill.penaltyAmount || 0)}`);
    console.log(`  Total Amount: $${centavosToPesos(unitBill.totalAmount || 0)}`);
    console.log(`  Paid Amount: $${centavosToPesos(unitBill.paidAmount || 0)}`);
    console.log(`  Status: ${unitBill.status}`);
    
    const billCharge = centavosToPesos(unitBill.currentCharge || 0);
    const billPenalty = centavosToPesos(unitBill.penaltyAmount || 0);
    const totalBill = billCharge + billPenalty;
    
    // Test scenario: Pay exactly what the screenshot shows
    const paymentAmount = 900;  // $900 as shown in screenshot
    const currentCredit = 0;    // $0 credit as shown
    const selectedMonth = 0;    // July (2026-00)
    const paymentDate = '2025-07-15';  // Backdated to 7/15/2025
    
    console.log(`\n${CYAN}💰 Test Payment (From Screenshot):${RESET}`);
    console.log(`  Payment Amount: $${paymentAmount}`);
    console.log(`  Current Credit: $${currentCredit}`);
    console.log(`  Selected Month: ${selectedMonth} (July)`);
    console.log(`  Payment Date: ${paymentDate} (Backdated)`);
    
    console.log(`\n${CYAN}📊 Expected vs Actual:${RESET}`);
    console.log(`  Bill Total: $${totalBill}`);
    console.log(`  Payment: $${paymentAmount}`);
    console.log(`  Expected Result: ${paymentAmount >= totalBill ? 'FULL PAYMENT' : 'PARTIAL PAYMENT'}`);
    
    // Calculate distribution with backdated payment
    console.log(`\n${YELLOW}🔄 Calculating distribution with backdated payment...${RESET}`);
    
    const distribution = await waterPaymentsService.calculatePaymentDistribution(
      CLIENT_ID,
      UNIT_ID,
      paymentAmount,
      currentCredit,
      paymentDate,  // 2025-07-15 - backdated!
      selectedMonth
    );
    
    console.log(`\n${CYAN}📊 Distribution Result:${RESET}`);
    console.log(`  Bills Processed: ${distribution.billPayments.length}`);
    console.log(`  Total Base Charges: $${distribution.totalBaseCharges}`);
    console.log(`  Total Penalties: $${distribution.totalPenalties}`);
    console.log(`  Credit Used: $${distribution.creditUsed}`);
    
    if (distribution.billPayments.length > 0) {
      console.log(`\n${CYAN}📄 Bill Payments:${RESET}`);
      distribution.billPayments.forEach((bp, i) => {
        console.log(`  ${i + 1}. ${bp.billPeriod}:`);
        console.log(`     Amount Paid: $${bp.amountPaid}`);
        console.log(`     Base Charge Paid: $${bp.baseChargePaid}`);
        console.log(`     Penalty Paid: $${bp.penaltyPaid}`);
        console.log(`     New Status: ${bp.newStatus}`);
      });
    }
    
    // Check what the issue might be
    console.log(`\n${BRIGHT}${'='.repeat(80)}${RESET}`);
    console.log(`${BRIGHT}DIAGNOSIS${RESET}`);
    console.log('='.repeat(80));
    
    if (distribution.billPayments.length === 0) {
      console.log(`${RED}❌ NO BILLS PROCESSED${RESET}`);
      console.log(`${YELLOW}This means:${RESET}`);
      console.log(`${YELLOW}  • selectedMonth filtering removed all bills${RESET}`);
      console.log(`${YELLOW}  • No unpaid bills found${RESET}`);
      console.log(`${YELLOW}  • Bill already paid${RESET}`);
      return;
    }
    
    const billPayment = distribution.billPayments[0];
    const totalPaid = billPayment.baseChargePaid + billPayment.penaltyPaid;
    const totalDue = distribution.totalBaseCharges + distribution.totalPenalties;
    
    console.log(`\n${CYAN}🔍 Payment Analysis:${RESET}`);
    console.log(`  Total Due: $${totalDue}`);
    console.log(`  Total Paid: $${totalPaid}`);
    console.log(`  Payment Status: ${billPayment.newStatus}`);
    
    if (billPayment.newStatus === 'partial') {
      console.log(`\n${RED}❌ PARTIAL PAYMENT ISSUE DETECTED${RESET}`);
      console.log(`${YELLOW}Why partial when payment = bill amount?${RESET}`);
      
      // Check if penalties were added due to payment date
      if (distribution.totalPenalties > 0) {
        console.log(`\n${RED}🐛 PENALTY ISSUE:${RESET}`);
        console.log(`${YELLOW}  • Bill base charge: $${distribution.totalBaseCharges}${RESET}`);
        console.log(`${YELLOW}  • Penalties calculated: $${distribution.totalPenalties}${RESET}`);
        console.log(`${YELLOW}  • Total due: $${totalDue}${RESET}`);
        console.log(`${YELLOW}  • Payment: $${paymentAmount}${RESET}`);
        console.log(`${YELLOW}  • Result: $${paymentAmount} < $${totalDue} = PARTIAL${RESET}`);
        
        console.log(`\n${YELLOW}💡 SOLUTION:${RESET}`);
        console.log(`${YELLOW}  The backdated payment date (7/15/2025) is triggering penalty calculation${RESET}`);
        console.log(`${YELLOW}  Even though it's within grace period, penalties are being added${RESET}`);
        console.log(`${YELLOW}  Payment needs to be $${totalDue} to fully pay the bill${RESET}`);
      } else {
        console.log(`\n${YELLOW}🤔 OTHER ISSUE:${RESET}`);
        console.log(`${YELLOW}  • No penalties calculated${RESET}`);
        console.log(`${YELLOW}  • But still showing as partial${RESET}`);
        console.log(`${YELLOW}  • Need to investigate further${RESET}`);
      }
    } else if (billPayment.newStatus === 'paid') {
      console.log(`\n${GREEN}✅ PAYMENT SHOULD BE FULL${RESET}`);
      console.log(`${YELLOW}If screenshot shows partial, there might be a UI display issue${RESET}`);
    }
    
    // Test with current date to compare
    console.log(`\n${CYAN}🔄 Testing with current date for comparison...${RESET}`);
    
    const distributionCurrent = await waterPaymentsService.calculatePaymentDistribution(
      CLIENT_ID,
      UNIT_ID,
      paymentAmount,
      currentCredit,
      '2025-10-20',  // Current date
      selectedMonth
    );
    
    console.log(`\n${CYAN}📊 Current Date Result:${RESET}`);
    console.log(`  Total Base Charges: $${distributionCurrent.totalBaseCharges}`);
    console.log(`  Total Penalties: $${distributionCurrent.totalPenalties}`);
    
    if (distributionCurrent.billPayments.length > 0) {
      const currentBillPayment = distributionCurrent.billPayments[0];
      console.log(`  Payment Status: ${currentBillPayment.newStatus}`);
      
      if (currentBillPayment.newStatus !== billPayment.newStatus) {
        console.log(`\n${YELLOW}💡 DATE IMPACT CONFIRMED:${RESET}`);
        console.log(`${YELLOW}  • Backdated (7/15): ${billPayment.newStatus}${RESET}`);
        console.log(`${YELLOW}  • Current (10/20): ${currentBillPayment.newStatus}${RESET}`);
        console.log(`${YELLOW}  • Payment date affects penalty calculation${RESET}`);
      }
    }
    
  } catch (error) {
    console.error(`\n${RED}Error:${RESET}`, error.message);
    console.error(error.stack);
  }
}

debug900Payment();

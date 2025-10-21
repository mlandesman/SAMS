/**
 * VERIFY: Allocation amounts are correct
 * 
 * This test verifies that allocation amounts match actual payments
 * Addresses concern: "totalBaseCharges shows $1900 but payment is $950"
 */

import { waterPaymentsService } from '../backend/services/waterPaymentsService.js';
import { getDb } from '../backend/firebase.js';
import { centavosToPesos } from '../backend/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';  // Use Unit 101 which we know has $950 bill

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';

async function verifyAllocations() {
  console.log(`\n${BRIGHT}${CYAN}🔍 ALLOCATION AMOUNT VERIFICATION${RESET}`);
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
    
    console.log(`\n${CYAN}📋 Actual Bill Data (Unit ${UNIT_ID}, July):${RESET}`);
    console.log(`  Current Charge: $${centavosToPesos(unitBill.currentCharge || 0)}`);
    console.log(`  Penalty Amount: $${centavosToPesos(unitBill.penaltyAmount || 0)}`);
    console.log(`  Total Amount: $${centavosToPesos(unitBill.totalAmount || 0)}`);
    console.log(`  Paid Amount: $${centavosToPesos(unitBill.paidAmount || 0)}`);
    console.log(`  Status: ${unitBill.status}`);
    
    const billCharge = centavosToPesos(unitBill.currentCharge || 0);
    
    // Test scenario: Pay exactly the base charge amount
    const paymentAmount = billCharge;
    const currentCredit = 0;
    const selectedMonth = 0;
    
    console.log(`\n${CYAN}💰 Test Payment:${RESET}`);
    console.log(`  Payment Amount: $${paymentAmount}`);
    console.log(`  Current Credit: $${currentCredit}`);
    console.log(`  Selected Month: ${selectedMonth}`);
    
    // Calculate distribution
    const distribution = await waterPaymentsService.calculatePaymentDistribution(
      CLIENT_ID,
      UNIT_ID,
      paymentAmount,
      currentCredit,
      '2025-10-19',
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
      });
    }
    
    if (distribution.allocations.length > 0) {
      console.log(`\n${CYAN}📦 Allocations:${RESET}`);
      distribution.allocations.forEach((alloc, i) => {
        console.log(`  ${i + 1}. ${alloc.type} (${alloc.targetId}):`);
        console.log(`     Amount: $${alloc.amount}`);
        console.log(`     Category: ${alloc.categoryName}`);
      });
    }
    
    // VERIFICATION
    console.log(`\n${BRIGHT}${'='.repeat(80)}${RESET}`);
    console.log(`${BRIGHT}VERIFICATION${RESET}`);
    console.log('='.repeat(80));
    
    let issues = [];
    
    // Check 1: Payment amount matches bill charge
    if (Math.abs(paymentAmount - billCharge) < 0.01) {
      console.log(`${GREEN}✓ Payment ($${paymentAmount}) matches bill charge ($${billCharge})${RESET}`);
    } else {
      console.log(`${RED}✗ Payment ($${paymentAmount}) doesn't match bill charge ($${billCharge})${RESET}`);
      issues.push('Payment/bill mismatch');
    }
    
    // Check 2: Total base charges matches payment
    if (Math.abs(distribution.totalBaseCharges - paymentAmount) < 0.01) {
      console.log(`${GREEN}✓ Total base charges ($${distribution.totalBaseCharges}) matches payment ($${paymentAmount})${RESET}`);
    } else {
      console.log(`${RED}✗ Total base charges ($${distribution.totalBaseCharges}) doesn't match payment ($${paymentAmount})${RESET}`);
      console.log(`${YELLOW}   Expected: $${paymentAmount}${RESET}`);
      console.log(`${YELLOW}   Actual: $${distribution.totalBaseCharges}${RESET}`);
      console.log(`${YELLOW}   Difference: $${Math.abs(distribution.totalBaseCharges - paymentAmount)}${RESET}`);
      issues.push(`Base charges wrong: $${distribution.totalBaseCharges} vs $${paymentAmount}`);
    }
    
    // Check 3: Allocation amounts sum correctly
    const waterBillAllocation = distribution.allocations.find(a => a.type === 'water_bill');
    if (waterBillAllocation) {
      if (Math.abs(waterBillAllocation.amount - paymentAmount) < 0.01) {
        console.log(`${GREEN}✓ Water bill allocation ($${waterBillAllocation.amount}) matches payment ($${paymentAmount})${RESET}`);
      } else {
        console.log(`${RED}✗ Water bill allocation ($${waterBillAllocation.amount}) doesn't match payment ($${paymentAmount})${RESET}`);
        console.log(`${YELLOW}   Expected: $${paymentAmount}${RESET}`);
        console.log(`${YELLOW}   Actual: $${waterBillAllocation.amount}${RESET}`);
        console.log(`${YELLOW}   This is DOUBLE the expected amount!${RESET}`);
        issues.push(`Allocation wrong: $${waterBillAllocation.amount} vs $${paymentAmount}`);
      }
    }
    
    // Results
    if (issues.length === 0) {
      console.log(`\n${GREEN}${BRIGHT}✅ ALL CHECKS PASSED - Allocations are correct!${RESET}`);
    } else {
      console.log(`\n${RED}${BRIGHT}❌ ISSUES FOUND:${RESET}`);
      issues.forEach(issue => console.log(`${RED}  • ${issue}${RESET}`));
      
      console.log(`\n${YELLOW}${BRIGHT}🐛 ALLOCATION BUG DETECTED${RESET}`);
      console.log(`${YELLOW}This will cause:${RESET}`);
      console.log(`${YELLOW}  • User pays $${paymentAmount} but system records $${distribution.totalBaseCharges}${RESET}`);
      console.log(`${YELLOW}  • Account balances will be wrong${RESET}`);
      console.log(`${YELLOW}  • Transaction records will be wrong${RESET}`);
      console.log(`${YELLOW}  • User will try to pay again${RESET}`);
    }
    
  } catch (error) {
    console.error(`\n${RED}Error:${RESET}`, error.message);
    console.error(error.stack);
  }
}

verifyAllocations();


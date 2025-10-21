/**
 * WATER BILLS QUICK CHECK
 * 
 * Fast diagnostic to verify the payment calculation matches expectations
 * Run this to quickly check if preview vs payment are aligned
 */

import { config } from 'dotenv';
import { waterPaymentsService } from '../backend/services/waterPaymentsService.js';

config();

const clientId = 'AVII';
const unitId = '101';  // Change this to test different units

console.log('\n🔍 WATER BILLS PAYMENT QUICK CHECK');
console.log('=' .repeat(80));

async function quickCheck() {
  try {
    // Test parameters
    const paymentAmount = 950.00;
    const paymentDate = '2025-10-19'; // Today
    const currentCredit = 0;
    const selectedMonth = 0; // July only
    
    console.log('\n📋 Test Parameters:');
    console.log(`  Client: ${clientId}`);
    console.log(`  Unit: ${unitId}`);
    console.log(`  Payment Amount: $${paymentAmount}`);
    console.log(`  Payment Date: ${paymentDate}`);
    console.log(`  Selected Month: ${selectedMonth} (July)`);
    console.log(`  Current Credit: $${currentCredit}`);
    
    // Call 1: WITH selectedMonth (like preview does)
    console.log('\n\n🎬 PREVIEW CALL (with selectedMonth):');
    console.log('-'.repeat(80));
    
    const preview = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      selectedMonth  // ← PASSED
    );
    
    console.log(`  Bills Processed: ${preview.billPayments.length}`);
    console.log(`  Total Base Charges: $${preview.totalBaseCharges}`);
    console.log(`  Total Penalties: $${preview.totalPenalties}`);
    console.log(`  Total Bills Due: $${preview.totalBillsDue}`);
    console.log(`  Credit Used: $${preview.creditUsed}`);
    console.log(`  Overpayment: $${preview.overpayment}`);
    
    if (preview.billPayments.length > 0) {
      console.log('\n  Bill Details:');
      preview.billPayments.forEach((bill, i) => {
        console.log(`    ${i + 1}. ${bill.billPeriod}: $${bill.amountPaid} (${bill.newStatus})`);
        console.log(`       Base: $${bill.baseChargePaid}, Penalty: $${bill.penaltyPaid}`);
      });
    }
    
    // Call 2: WITHOUT selectedMonth (like recordPayment currently does)
    console.log('\n\n💳 PAYMENT CALL (without selectedMonth - BUG):');
    console.log('-'.repeat(80));
    
    const payment = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      undefined  // ← NOT PASSED (mimicking current bug)
    );
    
    console.log(`  Bills Processed: ${payment.billPayments.length}`);
    console.log(`  Total Base Charges: $${payment.totalBaseCharges}`);
    console.log(`  Total Penalties: $${payment.totalPenalties}`);
    console.log(`  Total Bills Due: $${payment.totalBillsDue}`);
    console.log(`  Credit Used: $${payment.creditUsed}`);
    console.log(`  Overpayment: $${payment.overpayment}`);
    
    if (payment.billPayments.length > 0) {
      console.log('\n  Bill Details:');
      payment.billPayments.forEach((bill, i) => {
        console.log(`    ${i + 1}. ${bill.billPeriod}: $${bill.amountPaid} (${bill.newStatus})`);
        console.log(`       Base: $${bill.baseChargePaid}, Penalty: $${bill.penaltyPaid}`);
      });
    }
    
    // Comparison
    console.log('\n\n📊 COMPARISON:');
    console.log('=' .repeat(80));
    
    const billsDiffer = preview.billPayments.length !== payment.billPayments.length;
    const chargesDiffer = Math.abs(preview.totalBaseCharges - payment.totalBaseCharges) > 0.01;
    const penaltiesDiffer = Math.abs(preview.totalPenalties - payment.totalPenalties) > 0.01;
    const totalsDiffer = Math.abs(preview.totalBillsDue - payment.totalBillsDue) > 0.01;
    
    console.log(`  Bills Processed: ${preview.billPayments.length} vs ${payment.billPayments.length} ${billsDiffer ? '❌ DIFFER' : '✅ MATCH'}`);
    console.log(`  Total Base Charges: $${preview.totalBaseCharges} vs $${payment.totalBaseCharges} ${chargesDiffer ? '❌ DIFFER' : '✅ MATCH'}`);
    console.log(`  Total Penalties: $${preview.totalPenalties} vs $${payment.totalPenalties} ${penaltiesDiffer ? '❌ DIFFER' : '✅ MATCH'}`);
    console.log(`  Total Bills Due: $${preview.totalBillsDue} vs $${payment.totalBillsDue} ${totalsDiffer ? '❌ DIFFER' : '✅ MATCH'}`);
    
    if (billsDiffer || chargesDiffer || penaltiesDiffer || totalsDiffer) {
      console.log('\n❌ PREVIEW AND PAYMENT CALCULATIONS DIFFER');
      console.log('   This explains why the frontend gets out of sync!');
      console.log('\n🔧 ROOT CAUSE:');
      console.log('   recordPayment() does NOT pass selectedMonth to calculatePaymentDistribution()');
      console.log('   Line 536 in waterPaymentsService.js needs to be fixed');
    } else {
      console.log('\n✅ PREVIEW AND PAYMENT CALCULATIONS MATCH');
      console.log('   The calculation logic is working correctly');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

quickCheck();


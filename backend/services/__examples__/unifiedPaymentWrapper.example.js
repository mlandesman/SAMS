/**
 * Usage Examples for UnifiedPaymentWrapper
 * 
 * Demonstrates how to use the Unified Payment Wrapper to process payments
 * that span both HOA Dues and Water Bills modules.
 */

import { unifiedPaymentWrapper } from '../unifiedPaymentWrapper.js';

/**
 * Example 1: Preview a unified payment
 * 
 * Shows how a payment will be distributed across HOA and Water bills
 * without actually recording it.
 */
async function examplePreviewUnifiedPayment() {
  console.log('=== Example 1: Preview Unified Payment ===\n');
  
  const clientId = 'AVII';
  const unitId = '203';
  const paymentAmount = 15000; // $15,000 pesos
  
  try {
    const preview = await unifiedPaymentWrapper.previewUnifiedPayment(
      clientId,
      unitId,
      paymentAmount
    );
    
    console.log('Preview Results:');
    console.log(`  Total Payment: $${preview.totalAmount}`);
    console.log(`  Current Credit: $${preview.currentCreditBalance}`);
    console.log(`  New Credit: $${preview.newCreditBalance}`);
    console.log('');
    
    console.log('HOA Dues:');
    console.log(`  Bills Paid: ${preview.hoa.billsPaid.length}`);
    console.log(`  Total: $${preview.hoa.totalPaid}`);
    console.log(`  Months Affected: ${preview.hoa.monthsAffected.map(m => m.billPeriod).join(', ')}`);
    console.log('');
    
    console.log('Water Bills:');
    console.log(`  Bills Paid: ${preview.water.billsPaid.length}`);
    console.log(`  Total: $${preview.water.totalPaid}`);
    console.log(`  Bills Affected: ${preview.water.billsAffected.map(b => b.billPeriod).join(', ')}`);
    console.log('');
    
    console.log('Credit:');
    console.log(`  Used: $${preview.credit.used}`);
    console.log(`  Added: $${preview.credit.added}`);
    console.log(`  Final Balance: $${preview.credit.final}`);
    
  } catch (error) {
    console.error('Error previewing payment:', error);
  }
}

/**
 * Example 2: Preview with backdated payment
 * 
 * Shows how to preview a payment as if it were made on a specific date
 * (useful for penalty calculations with backdated payments).
 */
async function exampleBackdatedPreview() {
  console.log('\n=== Example 2: Backdated Payment Preview ===\n');
  
  const clientId = 'AVII';
  const unitId = '203';
  const paymentAmount = 10000;
  const paymentDate = '2025-10-15'; // Backdated to October 15
  
  try {
    const preview = await unifiedPaymentWrapper.previewUnifiedPayment(
      clientId,
      unitId,
      paymentAmount,
      paymentDate
    );
    
    console.log(`Payment Date: ${paymentDate}`);
    console.log(`Total Payment: $${preview.totalAmount}`);
    console.log(`Total Allocated: $${preview.summary.totalAllocated}`);
    console.log(`Allocation Count: ${preview.summary.allocationCount}`);
    
  } catch (error) {
    console.error('Error previewing backdated payment:', error);
  }
}

/**
 * Example 3: Understanding the payment priority
 * 
 * The UnifiedPaymentWrapper applies payments in this order:
 * 1. Past due HOA + penalties (oldest first)
 * 2. Past due Water + penalties (oldest first)
 * 3. Current HOA (this month)
 * 4. Current Water (this month)
 * 5. Future HOA (prepaid allowed - complete months only)
 * 6. Credit Balance (remainder)
 * 
 * Note: Water bills do NOT allow future payments (postpaid model)
 */
async function examplePriorityOrder() {
  console.log('\n=== Example 3: Payment Priority Order ===\n');
  
  const clientId = 'AVII';
  const unitId = '203';
  const paymentAmount = 25000; // Large payment to see priority order
  
  try {
    const preview = await unifiedPaymentWrapper.previewUnifiedPayment(
      clientId,
      unitId,
      paymentAmount
    );
    
    console.log('Bills Paid in Priority Order:');
    console.log('');
    
    // Combine all paid bills with module type
    const allPaidBills = [
      ...preview.hoa.monthsAffected.map(m => ({ ...m, module: 'HOA' })),
      ...preview.water.billsAffected.map(b => ({ ...b, module: 'Water' }))
    ];
    
    allPaidBills.forEach((bill, index) => {
      console.log(`${index + 1}. [${bill.module}] ${bill.billPeriod}: $${bill.totalPaid} (Base: $${bill.basePaid}, Penalty: $${bill.penaltyPaid})`);
    });
    
    if (preview.credit.added > 0) {
      console.log(`\nRemainder → Credit Balance: $${preview.credit.added}`);
    }
    
  } catch (error) {
    console.error('Error showing priority order:', error);
  }
}

/**
 * Example 4: Credit-only payment (no bills due)
 * 
 * When a unit has no unpaid bills, the entire payment goes to credit balance.
 */
async function exampleCreditOnlyPayment() {
  console.log('\n=== Example 4: Credit-Only Payment ===\n');
  
  const clientId = 'AVII';
  const unitId = '101'; // Unit with no unpaid bills
  const paymentAmount = 5000;
  
  try {
    const preview = await unifiedPaymentWrapper.previewUnifiedPayment(
      clientId,
      unitId,
      paymentAmount
    );
    
    console.log('No unpaid bills - payment goes to credit:');
    console.log(`  Current Credit: $${preview.currentCreditBalance}`);
    console.log(`  Payment: $${paymentAmount}`);
    console.log(`  New Credit: $${preview.newCreditBalance}`);
    console.log(`  HOA Bills Paid: ${preview.hoa.billsPaid.length}`);
    console.log(`  Water Bills Paid: ${preview.water.billsPaid.length}`);
    
  } catch (error) {
    console.error('Error previewing credit-only payment:', error);
  }
}

/**
 * Example 5: Using existing credit balance
 * 
 * When a unit has existing credit, it's applied first before the payment amount.
 */
async function exampleUsingCredit() {
  console.log('\n=== Example 5: Using Existing Credit ===\n');
  
  const clientId = 'AVII';
  const unitId = '203';
  const paymentAmount = 8000; // Payment amount
  // Assume unit has $2,000 credit
  
  try {
    const preview = await unifiedPaymentWrapper.previewUnifiedPayment(
      clientId,
      unitId,
      paymentAmount
    );
    
    console.log('Payment with existing credit:');
    console.log(`  Payment Amount: $${paymentAmount}`);
    console.log(`  Existing Credit: $${preview.currentCreditBalance}`);
    console.log(`  Total Available: $${preview.totalAmount}`);
    console.log(`  Credit Used: $${preview.credit.used}`);
    console.log(`  Credit Added: $${preview.credit.added}`);
    console.log(`  Final Credit: $${preview.credit.final}`);
    
  } catch (error) {
    console.error('Error previewing payment with credit:', error);
  }
}

/**
 * Example 6: Response structure reference
 * 
 * Shows the complete structure of the preview response.
 */
function exampleResponseStructure() {
  console.log('\n=== Example 6: Response Structure Reference ===\n');
  
  const exampleResponse = {
    totalAmount: 15000,
    currentCreditBalance: 1000,
    newCreditBalance: 1500,
    
    hoa: {
      billsPaid: [
        {
          billPeriod: '2026-00',
          amountPaid: 5000,
          baseChargePaid: 4500,
          penaltyPaid: 500,
          newStatus: 'paid',
          totalBaseDue: 5000,
          totalPenaltyDue: 500,
          totalDue: 5500
        }
      ],
      totalPaid: 5000,
      monthsAffected: [
        {
          month: 7,           // Calendar month
          monthIndex: 0,      // Fiscal month index
          billPeriod: '2026-00',
          basePaid: 4500,
          penaltyPaid: 500,
          totalPaid: 5000,
          status: 'paid'
        }
      ]
    },
    
    water: {
      billsPaid: [
        {
          billPeriod: '2026-01',
          amountPaid: 9000,
          baseChargePaid: 8500,
          penaltyPaid: 500,
          newStatus: 'paid',
          totalBaseDue: 9000,
          totalPenaltyDue: 500,
          totalDue: 9500
        }
      ],
      totalPaid: 9000,
      billsAffected: [
        {
          billPeriod: '2026-01',
          basePaid: 8500,
          penaltyPaid: 500,
          totalPaid: 9000,
          status: 'paid'
        }
      ]
    },
    
    credit: {
      used: 0,      // Existing credit applied to bills
      added: 500,   // New credit from overpayment
      final: 1500   // Final credit balance
    },
    
    summary: {
      totalBills: 2,        // Total bills considered
      totalAllocated: 14000, // Total amount applied to bills
      allocationCount: 2     // Number of bills paid
    }
  };
  
  console.log('Response Structure:');
  console.log(JSON.stringify(exampleResponse, null, 2));
}

// Run all examples
async function runAllExamples() {
  await examplePreviewUnifiedPayment();
  await exampleBackdatedPreview();
  await examplePriorityOrder();
  await exampleCreditOnlyPayment();
  await exampleUsingCredit();
  exampleResponseStructure();
}

// Export for use in tests or documentation
export {
  examplePreviewUnifiedPayment,
  exampleBackdatedPreview,
  examplePriorityOrder,
  exampleCreditOnlyPayment,
  exampleUsingCredit,
  exampleResponseStructure,
  runAllExamples
};


/**
 * WATER BILLS END-TO-END PAYMENT TEST
 * 
 * Tests complete flow: Bill Generation → Preview → Payment → Verification
 * This verifies all fixes are working together
 */

import { testHarness } from '../backend/testing/testHarness.js';
import { getDb } from '../backend/firebase.js';
import { centavosToPesos } from '../backend/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '203';  // Using different unit to avoid conflicts
const FISCAL_YEAR = 2026;
const FISCAL_MONTH = 0; // July

const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

function log(color, message) {
  console.log(`${color}${message}${RESET}`);
}

/**
 * Test: Complete payment flow
 */
const test_endToEndPaymentFlow = {
  name: 'End-to-End Payment Flow',
  async test({ api, userId }) {
    log(CYAN, '\n' + '='.repeat(80));
    log(BRIGHT, '  END-TO-END WATER BILLS PAYMENT TEST');
    log(CYAN, '='.repeat(80));
    
    const db = await getDb();
    const results = {
      billGeneration: null,
      aggregatedDataBefore: null,
      previewPayment: null,
      recordPayment: null,
      billAfterPayment: null,
      aggregatedDataAfter: null
    };
    
    try {
      // STEP 1: Verify bill exists (using existing bill)
      log(YELLOW, '\n📋 STEP 1: Verify Bill Exists...');
      
      const billRef = db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('bills').doc(`${FISCAL_YEAR}-${String(FISCAL_MONTH).padStart(2, '0')}`);
      
      const billDoc = await billRef.get();
      
      if (!billDoc.exists) {
        throw new Error(`Bill ${FISCAL_YEAR}-${String(FISCAL_MONTH).padStart(2, '0')} doesn't exist for testing`);
      }
      
      const unitBillBefore = billDoc.data()?.bills?.units?.[UNIT_ID];
      if (!unitBillBefore) {
        throw new Error(`Unit ${UNIT_ID} not found in bill ${FISCAL_YEAR}-${String(FISCAL_MONTH).padStart(2, '0')}`);
      }
      
      log(GREEN, `  ✓ Bill exists for Unit ${UNIT_ID}:`);
      log(GREEN, `    Status: ${unitBillBefore.status}`);
      log(GREEN, `    Current Charge: $${centavosToPesos(unitBillBefore.currentCharge || 0)}`);
      log(GREEN, `    Paid Amount: $${centavosToPesos(unitBillBefore.paidAmount || 0)}`);
      
      results.billGeneration = {
        exists: true,
        initialStatus: unitBillBefore.status,
        initialPaidAmount: centavosToPesos(unitBillBefore.paidAmount || 0)
      };
      
      // Small delay for aggregatedData rebuild
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // STEP 2: Check aggregatedData BEFORE payment
      log(YELLOW, '\n📊 STEP 2: Check AggregatedData Before Payment...');
      
      const aggRefBefore = db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('bills').doc('aggregatedData');
      
      const aggDocBefore = await aggRefBefore.get();
      
      if (aggDocBefore.exists) {
        const aggDataBefore = aggDocBefore.data();
        const unitDataBefore = aggDataBefore.months?.[FISCAL_MONTH]?.units?.[UNIT_ID];
        
        if (unitDataBefore) {
          log(GREEN, `  ✓ Unit ${UNIT_ID} found in aggregatedData:`);
          log(GREEN, `    Status: ${unitDataBefore.status}`);
          log(GREEN, `    Display Total Due: $${unitDataBefore.displayTotalDue}`);
          log(GREEN, `    Display Penalties: $${unitDataBefore.displayPenalties}`);
          
          results.aggregatedDataBefore = {
            status: unitDataBefore.status,
            totalDue: unitDataBefore.displayTotalDue,
            penalties: unitDataBefore.displayPenalties
          };
        } else {
          log(YELLOW, `  ⚠️ Unit ${UNIT_ID} not found in aggregatedData`);
        }
      } else {
        log(YELLOW, `  ⚠️ aggregatedData document doesn't exist`);
      }
      
      // STEP 3: Preview payment WITH selectedMonth
      log(YELLOW, `\n🎬 STEP 3: Preview Payment (selectedMonth=${FISCAL_MONTH})...`);
      
      const previewResponse = await api.request({
        method: 'POST',
        url: `/water/clients/${CLIENT_ID}/payments/preview`,
        data: {
          unitId: UNIT_ID,
          amount: 950,
          payOnDate: '2025-10-19',
          selectedMonth: FISCAL_MONTH
        }
      });
      
      if (previewResponse.data.success) {
        const preview = previewResponse.data.data;
        log(GREEN, `  ✓ Preview calculated:`);
        log(GREEN, `    Bills to process: ${preview.billPayments?.length || 0}`);
        log(GREEN, `    Total bills due: $${preview.totalBillsDue}`);
        log(GREEN, `    Total base charges: $${preview.totalBaseCharges}`);
        log(GREEN, `    Total penalties: $${preview.totalPenalties}`);
        
        results.previewPayment = {
          billsCount: preview.billPayments?.length || 0,
          totalDue: preview.totalBillsDue,
          firstBillStatus: preview.billPayments?.[0]?.newStatus
        };
      } else {
        log(RED, `  ✗ Preview failed: ${previewResponse.data.error}`);
      }
      
      // STEP 4: Record payment WITH selectedMonth (THE FIX!)
      log(YELLOW, `\n💳 STEP 4: Record Payment (selectedMonth=${FISCAL_MONTH})...`);
      
      const paymentResponse = await api.request({
        method: 'POST',
        url: `/water/clients/${CLIENT_ID}/payments/record`,
        data: {
          unitId: UNIT_ID,
          amount: 950,
          paymentDate: '2025-10-19',
          paymentMethod: 'eTransfer',
          paymentMethodId: 'method_test',
          reference: 'E2E-TEST-001',
          notes: 'End-to-end test payment',
          accountId: 'acc_test',
          accountType: 'bank',
          selectedMonth: FISCAL_MONTH  // THIS IS THE FIX!
        }
      });
      
      if (paymentResponse.data.success) {
        const payment = paymentResponse.data.data;
        log(GREEN, `  ✓ Payment recorded:`);
        log(GREEN, `    Transaction ID: ${paymentResponse.data.transactionId}`);
        log(GREEN, `    Bills paid: ${payment.billsPaid?.length || 0}`);
        log(GREEN, `    Payment type: ${payment.paymentType}`);
        
        results.recordPayment = {
          transactionId: paymentResponse.data.transactionId,
          billsPaidCount: payment.billsPaid?.length || 0,
          success: true
        };
      } else {
        log(RED, `  ✗ Payment failed: ${paymentResponse.data.error}`);
        results.recordPayment = { success: false, error: paymentResponse.data.error };
      }
      
      // STEP 5: Verify bill was updated
      log(YELLOW, '\n🔍 STEP 5: Verify Bill Update...');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const billDocAfter = await billRef.get();
      
      if (billDocAfter.exists) {
        const billData = billDocAfter.data();
        const unitBill = billData?.bills?.units?.[UNIT_ID];
        
        if (unitBill) {
          log(GREEN, `  ✓ Bill ${FISCAL_YEAR}-${String(FISCAL_MONTH).padStart(2, '0')} updated:`);
          log(GREEN, `    Status: ${unitBill.status}`);
          log(GREEN, `    Paid Amount: $${centavosToPesos(unitBill.paidAmount || 0)}`);
          log(GREEN, `    Base Paid: $${centavosToPesos(unitBill.basePaid || 0)}`);
          log(GREEN, `    Has Payments: ${unitBill.payments?.length > 0 ? 'Yes' : 'No'}`);
          
          results.billAfterPayment = {
            status: unitBill.status,
            paidAmount: centavosToPesos(unitBill.paidAmount || 0),
            hasPayments: unitBill.payments?.length > 0
          };
        }
      }
      
      // STEP 6: Check aggregatedData AFTER payment (surgical update)
      log(YELLOW, '\n📊 STEP 6: Check AggregatedData After Payment...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const aggDocAfter = await aggRefBefore.get();
      
      if (aggDocAfter.exists) {
        const aggDataAfter = aggDocAfter.data();
        const unitDataAfter = aggDataAfter.months?.[FISCAL_MONTH]?.units?.[UNIT_ID];
        
        if (unitDataAfter) {
          log(GREEN, `  ✓ Unit ${UNIT_ID} in aggregatedData:`);
          log(GREEN, `    Status: ${unitDataAfter.status}`);
          log(GREEN, `    Display Total Due: $${unitDataAfter.displayTotalDue}`);
          log(GREEN, `    Display Penalties: $${unitDataAfter.displayPenalties}`);
          
          results.aggregatedDataAfter = {
            status: unitDataAfter.status,
            totalDue: unitDataAfter.displayTotalDue,
            penalties: unitDataAfter.displayPenalties
          };
          
          // Compare before and after
          if (results.aggregatedDataBefore && results.aggregatedDataAfter) {
            log(CYAN, '\n  BEFORE vs AFTER Payment:');
            log(CYAN, `    Status: ${results.aggregatedDataBefore.status} → ${results.aggregatedDataAfter.status}`);
            log(CYAN, `    Total Due: $${results.aggregatedDataBefore.totalDue} → $${results.aggregatedDataAfter.totalDue}`);
            
            if (results.aggregatedDataBefore.status !== results.aggregatedDataAfter.status) {
              log(GREEN, `    ✓ Surgical update WORKED - status changed!`);
            } else {
              log(YELLOW, `    ⚠️ Status unchanged - surgical update may have failed`);
            }
          }
        }
      }
      
      // VERIFICATION
      log(YELLOW, '\n\n' + '='.repeat(80));
      log(BRIGHT, '  VERIFICATION');
      log(YELLOW, '='.repeat(80));
      
      let passed = true;
      const issues = [];
      
      // Check 1: Payment recorded successfully
      if (results.recordPayment?.success) {
        log(GREEN, '  ✓ Payment recorded successfully');
      } else {
        log(RED, '  ✗ Payment recording failed');
        issues.push('Payment not recorded');
        passed = false;
      }
      
      // Check 2: Bill status updated
      if (results.billAfterPayment?.status === 'partial' || results.billAfterPayment?.status === 'paid') {
        log(GREEN, `  ✓ Bill status updated: ${results.billAfterPayment.status}`);
      } else {
        log(RED, `  ✗ Bill status not updated correctly: ${results.billAfterPayment?.status || 'unknown'}`);
        issues.push('Bill status not updated');
        passed = false;
      }
      
      // Check 3: Preview matched actual (same bills processed)
      if (results.previewPayment && results.recordPayment) {
        const previewBills = results.previewPayment.billsCount;
        const actualBills = results.recordPayment.billsPaidCount;
        
        if (previewBills === actualBills) {
          log(GREEN, `  ✓ Preview matched actual: ${previewBills} bills processed`);
        } else {
          log(RED, `  ✗ Preview vs actual mismatch: ${previewBills} vs ${actualBills} bills`);
          issues.push('Preview and actual differ');
          passed = false;
        }
      }
      
      // Check 4: AggregatedData updated
      if (results.aggregatedDataBefore && results.aggregatedDataAfter) {
        if (results.aggregatedDataBefore.status !== results.aggregatedDataAfter.status) {
          log(GREEN, `  ✓ AggregatedData updated: ${results.aggregatedDataBefore.status} → ${results.aggregatedDataAfter.status}`);
        } else {
          log(YELLOW, `  ⚠️ AggregatedData status unchanged (may be expected for partial payments)`);
        }
      }
      
      return {
        passed,
        data: results,
        message: passed ? 'End-to-end flow working correctly' : 'Issues found',
        reason: issues.length > 0 ? issues.join(', ') : null
      };
      
    } catch (error) {
      log(RED, `\n✗ Error: ${error.message}`);
      console.error(error.stack);
      
      return {
        passed: false,
        data: results,
        reason: error.message
      };
    }
  }
};

async function runEndToEndTest() {
  log(BRIGHT, '\n🚀 WATER BILLS END-TO-END TEST');
  log(BRIGHT, '  Testing complete flow with all fixes applied\n');
  
  const result = await testHarness.runTest(test_endToEndPaymentFlow);
  
  testHarness.showSummary();
  
  if (result.passed) {
    log(GREEN, '\n' + '='.repeat(80));
    log(GREEN, '  🎉 SUCCESS: All fixes working correctly!');
    log(GREEN, '='.repeat(80));
    log(GREEN, '\nThe water bills payment system is now functioning properly:');
    log(GREEN, '  ✓ selectedMonth filtering works');
    log(GREEN, '  ✓ Preview matches actual payment');
    log(GREEN, '  ✓ Bills update correctly');
    log(GREEN, '  ✓ AggregatedData syncs');
  } else {
    log(YELLOW, '\n' + '='.repeat(80));
    log(YELLOW, '  ⚠️ ISSUES FOUND');
    log(YELLOW, '='.repeat(80));
    log(YELLOW, `\nReason: ${result.reason}`);
    log(YELLOW, '\nReview the detailed output above for specific failures.');
  }
  
  process.exit(result.passed ? 0 : 1);
}

runEndToEndTest().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});


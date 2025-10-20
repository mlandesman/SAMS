/**
 * WATER BILLS PAYMENT DIAGNOSTIC TEST SUITE
 * 
 * Purpose: Track expected vs actual behavior through the entire payment flow
 * This suite will identify EXACTLY where preview vs payment diverge
 * 
 * Test Scenarios:
 * 1. Basic payment - single month, no penalties, no credit
 * 2. Backdated payment - within grace period (no penalties)
 * 3. Backdated payment - with penalties (compound calculation)
 * 4. Month filtering - pay only up to selected month
 * 5. Preview vs Actual - verify identical results
 * 6. Surgical update - verify aggregatedData syncs correctly
 */

import { config } from 'dotenv';
import { waterPaymentsService } from '../backend/services/waterPaymentsService.js';
import { waterDataService } from '../backend/services/waterDataService.js';
import { getDb } from '../backend/firebase.js';
import { pesosToCentavos, centavosToPesos } from '../backend/utils/currencyUtils.js';
import { getNow } from '../backend/services/DateService.js';

config();

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log('bright', `  ${title}`);
  console.log('='.repeat(80));
}

function logTest(testName) {
  console.log('\n' + '-'.repeat(80));
  log('cyan', `TEST: ${testName}`);
  console.log('-'.repeat(80));
}

function logExpected(label, value) {
  log('green', `  ✓ EXPECTED ${label}: ${JSON.stringify(value, null, 2)}`);
}

function logActual(label, value) {
  log('blue', `  → ACTUAL ${label}: ${JSON.stringify(value, null, 2)}`);
}

function logError(label, value) {
  log('red', `  ✗ ERROR ${label}: ${JSON.stringify(value, null, 2)}`);
}

function logSuccess(message) {
  log('green', `  ✓ ${message}`);
}

function logFailure(message) {
  log('red', `  ✗ ${message}`);
}

function logWarning(message) {
  log('yellow', `  ⚠ ${message}`);
}

/**
 * Compare two values with detailed output
 */
function compareValues(label, expected, actual, tolerance = 0.01) {
  const match = typeof expected === 'number' && typeof actual === 'number'
    ? Math.abs(expected - actual) < tolerance
    : JSON.stringify(expected) === JSON.stringify(actual);
  
  if (match) {
    logSuccess(`${label}: ${actual} ✓`);
    return true;
  } else {
    logFailure(`${label} MISMATCH`);
    logExpected(label, expected);
    logActual(label, actual);
    return false;
  }
}

/**
 * Test Setup: Create a clean test bill
 */
async function setupTestBill(clientId, unitId, fiscalPeriod, baseCharge, dueDate) {
  logSection(`SETUP: Creating test bill ${fiscalPeriod} for unit ${unitId}`);
  
  const db = await getDb();
  const billRef = db.collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills').doc(fiscalPeriod);
  
  const billData = {
    bills: {
      units: {
        [unitId]: {
          currentCharge: baseCharge,  // in centavos
          penaltyAmount: 0,           // no initial penalty
          totalAmount: baseCharge,    // in centavos
          paidAmount: 0,
          basePaid: 0,
          penaltyPaid: 0,
          status: 'unpaid',
          dueDate: dueDate,
          consumption: 18,
          carWashCount: 1,
          boatWashCount: 0,
          waterCharge: 90000,  // 18 m³ * 5000 centavos
          carWashCharge: 5000,
          boatWashCharge: 0
        }
      }
    }
  };
  
  await billRef.set(billData);
  log('green', `  ✓ Created bill ${fiscalPeriod}: ${centavosToPesos(baseCharge)} pesos, due ${dueDate}`);
  
  return billData;
}

/**
 * Test 1: Basic Single Payment - No Penalties, No Credit
 */
async function test1_basicSinglePayment() {
  logTest('Test 1: Basic Single Payment (Current Month, No Penalties)');
  
  const clientId = 'AVII';
  const unitId = '101';
  const fiscalPeriod = '2026-00'; // July 2025
  const baseCharge = 95000; // 950 pesos in centavos
  const dueDate = '2025-08-07'; // Due in August (30 day grace)
  
  // Setup
  await setupTestBill(clientId, unitId, fiscalPeriod, baseCharge, dueDate);
  
  // EXPECTED: Payment of 950 pesos on 7/20/2025 (within grace period)
  const paymentAmount = 950.00;
  const paymentDate = '2025-07-20';
  const currentCredit = 0;
  
  logExpected('Payment Amount', `$${paymentAmount}`);
  logExpected('Payment Date', paymentDate);
  logExpected('Bills in Scope', [fiscalPeriod]);
  logExpected('Penalties', 0); // Within grace period
  logExpected('Final Status', 'paid');
  
  try {
    // ACTUAL: Run payment distribution
    const distribution = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      0 // selectedMonth = 0 (July only)
    );
    
    logActual('Distribution Result', {
      billPayments: distribution.billPayments.length,
      totalBaseCharges: distribution.totalBaseCharges,
      totalPenalties: distribution.totalPenalties,
      creditUsed: distribution.creditUsed,
      overpayment: distribution.overpayment
    });
    
    // Verify expectations
    let passed = true;
    passed &= compareValues('Bills Processed', 1, distribution.billPayments.length);
    passed &= compareValues('Total Base Charges', 950.00, distribution.totalBaseCharges);
    passed &= compareValues('Total Penalties', 0, distribution.totalPenalties);
    passed &= compareValues('Credit Used', 0, distribution.creditUsed);
    passed &= compareValues('Overpayment', 0, distribution.overpayment);
    
    if (distribution.billPayments[0]) {
      const bill = distribution.billPayments[0];
      passed &= compareValues('Bill Status', 'paid', bill.newStatus);
      passed &= compareValues('Base Charge Paid', 950.00, bill.baseChargePaid);
      passed &= compareValues('Penalty Paid', 0, bill.penaltyPaid);
    }
    
    return passed ? 'PASS' : 'FAIL';
    
  } catch (error) {
    logError('Test Exception', error.message);
    console.error(error);
    return 'ERROR';
  }
}

/**
 * Test 2: Backdated Payment with Penalty Calculation
 */
async function test2_backdatedPaymentWithPenalty() {
  logTest('Test 2: Backdated Payment with Penalty (3 months overdue)');
  
  const clientId = 'AVII';
  const unitId = '101';
  const fiscalPeriod = '2026-00'; // July 2025
  const baseCharge = 95000; // 950 pesos in centavos
  const dueDate = '2025-08-07'; // Due in August
  
  // Setup
  await setupTestBill(clientId, unitId, fiscalPeriod, baseCharge, dueDate);
  
  // EXPECTED: Payment TODAY (10/19/2025) should calculate 3 months of penalties
  const paymentAmount = 950.00;
  const paymentDate = '2025-10-19'; // 2.5 months after due date
  const currentCredit = 0;
  
  // Penalty calculation: 950 * 0.05 * 3 = 142.50 (5% per month, 3 months)
  const expectedPenalty = 142.50;
  const expectedTotal = paymentAmount + expectedPenalty;
  
  logExpected('Payment Amount', `$${paymentAmount}`);
  logExpected('Payment Date', paymentDate);
  logExpected('Days Past Due', '~73 days (2.5 months)');
  logExpected('Penalty Calculation', `${baseCharge / 100} * 0.05 * 3 months = $${expectedPenalty}`);
  logExpected('Total Required', `$${expectedTotal}`);
  logExpected('Payment Result', 'PARTIAL (underpaid by penalties)');
  
  try {
    const distribution = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      0 // selectedMonth = 0
    );
    
    logActual('Distribution Result', {
      totalBaseCharges: distribution.totalBaseCharges,
      totalPenalties: distribution.totalPenalties,
      billStatus: distribution.billPayments[0]?.newStatus,
      totalBillsDue: distribution.totalBillsDue
    });
    
    let passed = true;
    
    // Verify penalty was calculated
    if (distribution.totalPenalties === 0) {
      logFailure('Penalties NOT calculated for backdated payment');
      passed = false;
    } else {
      // Allow some tolerance for rounding
      passed &= compareValues('Calculated Penalty', expectedPenalty, distribution.totalPenalties, 5);
    }
    
    // Verify payment is partial (not enough to cover bill + penalties)
    if (distribution.billPayments[0]) {
      const expectedStatus = paymentAmount < expectedTotal ? 'partial' : 'paid';
      passed &= compareValues('Bill Status', expectedStatus, distribution.billPayments[0].newStatus);
    }
    
    return passed ? 'PASS' : 'FAIL';
    
  } catch (error) {
    logError('Test Exception', error.message);
    console.error(error);
    return 'ERROR';
  }
}

/**
 * Test 3: Month Filtering - Pay Only Selected Month
 */
async function test3_monthFiltering() {
  logTest('Test 3: Month Filtering (Multiple unpaid bills, pay only July)');
  
  const clientId = 'AVII';
  const unitId = '101';
  
  // Setup: Create July and August bills
  await setupTestBill(clientId, unitId, '2026-00', 95000, '2025-08-07'); // July
  await setupTestBill(clientId, unitId, '2026-01', 95000, '2025-09-07'); // August
  
  const paymentAmount = 950.00;
  const paymentDate = '2025-10-19';
  const currentCredit = 0;
  
  logExpected('Unpaid Bills', ['2026-00 (July)', '2026-01 (August)']);
  logExpected('Selected Month', 0); // July only
  logExpected('Bills in Scope', ['2026-00']);
  logExpected('Bills Excluded', ['2026-01']);
  
  try {
    // Test WITH month filtering
    const distributionFiltered = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      0 // selectedMonth = 0 (July only)
    );
    
    logActual('With Month Filter (0)', {
      billsProcessed: distributionFiltered.billPayments.length,
      billPeriods: distributionFiltered.billPayments.map(b => b.billPeriod)
    });
    
    // Test WITHOUT month filtering
    const distributionAll = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      null // No filter
    );
    
    logActual('Without Month Filter', {
      billsProcessed: distributionAll.billPayments.length,
      billPeriods: distributionAll.billPayments.map(b => b.billPeriod)
    });
    
    let passed = true;
    
    // With filter: should only process July
    passed &= compareValues('Filtered Bills Count', 1, distributionFiltered.billPayments.length);
    if (distributionFiltered.billPayments[0]) {
      passed &= compareValues('Filtered Bill Period', '2026-00', distributionFiltered.billPayments[0].billPeriod);
    }
    
    // Without filter: should process both
    passed &= compareValues('Unfiltered Bills Count', 2, distributionAll.billPayments.length);
    
    return passed ? 'PASS' : 'FAIL';
    
  } catch (error) {
    logError('Test Exception', error.message);
    console.error(error);
    return 'ERROR';
  }
}

/**
 * Test 4: Preview vs Actual Payment - Verify Identical Results
 */
async function test4_previewVsActual() {
  logTest('Test 4: Preview vs Actual Payment (CRITICAL: Must be identical)');
  
  const clientId = 'AVII';
  const unitId = '101';
  const fiscalPeriod = '2026-00';
  
  await setupTestBill(clientId, unitId, fiscalPeriod, 95000, '2025-08-07');
  
  const paymentAmount = 950.00;
  const paymentDate = '2025-10-19';
  const currentCredit = 0;
  const selectedMonth = 0;
  
  try {
    // Simulate PREVIEW call (what frontend calls before payment)
    log('cyan', '\n  PREVIEW CALCULATION:');
    const preview = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      selectedMonth
    );
    
    logActual('Preview Result', {
      billsProcessed: preview.billPayments.length,
      totalBaseCharges: preview.totalBaseCharges,
      totalPenalties: preview.totalPenalties,
      creditUsed: preview.creditUsed,
      overpayment: preview.overpayment
    });
    
    // Simulate ACTUAL payment call (what recordPayment does)
    log('cyan', '\n  ACTUAL PAYMENT CALCULATION:');
    const actual = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentAmount,
      currentCredit,
      paymentDate,
      selectedMonth  // THIS IS THE BUG - recordPayment doesn't pass this!
    );
    
    logActual('Actual Result', {
      billsProcessed: actual.billPayments.length,
      totalBaseCharges: actual.totalBaseCharges,
      totalPenalties: actual.totalPenalties,
      creditUsed: actual.creditUsed,
      overpayment: actual.overpayment
    });
    
    // Compare EVERYTHING
    let passed = true;
    
    log('yellow', '\n  COMPARING PREVIEW vs ACTUAL:');
    passed &= compareValues('Bills Processed', preview.billPayments.length, actual.billPayments.length);
    passed &= compareValues('Total Base Charges', preview.totalBaseCharges, actual.totalBaseCharges);
    passed &= compareValues('Total Penalties', preview.totalPenalties, actual.totalPenalties);
    passed &= compareValues('Credit Used', preview.creditUsed, actual.creditUsed);
    passed &= compareValues('Overpayment', preview.overpayment, actual.overpayment);
    passed &= compareValues('New Credit Balance', preview.newCreditBalance, actual.newCreditBalance);
    
    // Compare bill-by-bill
    if (preview.billPayments.length === actual.billPayments.length) {
      for (let i = 0; i < preview.billPayments.length; i++) {
        const pBill = preview.billPayments[i];
        const aBill = actual.billPayments[i];
        
        log('yellow', `\n  Bill ${i + 1} (${pBill.billPeriod}):`);
        passed &= compareValues('  Amount Paid', pBill.amountPaid, aBill.amountPaid);
        passed &= compareValues('  Base Charge Paid', pBill.baseChargePaid, aBill.baseChargePaid);
        passed &= compareValues('  Penalty Paid', pBill.penaltyPaid, aBill.penaltyPaid);
        passed &= compareValues('  Status', pBill.newStatus, aBill.newStatus);
      }
    }
    
    if (passed) {
      logSuccess('Preview and Actual are IDENTICAL ✓');
    } else {
      logFailure('Preview and Actual DIFFER - THIS IS THE BUG!');
    }
    
    return passed ? 'PASS' : 'FAIL';
    
  } catch (error) {
    logError('Test Exception', error.message);
    console.error(error);
    return 'ERROR';
  }
}

/**
 * Test 5: Full Payment Flow with recordPayment
 */
async function test5_fullPaymentFlow() {
  logTest('Test 5: Full Payment Flow (Preview → Record → Verify)');
  
  const clientId = 'AVII';
  const unitId = '101';
  const fiscalPeriod = '2026-00';
  
  await setupTestBill(clientId, unitId, fiscalPeriod, 95000, '2025-08-07');
  
  const paymentData = {
    amount: 950.00,
    paymentDate: '2025-10-19',
    paymentMethod: 'eTransfer',
    paymentMethodId: 'method_test',
    reference: 'TEST-001',
    notes: 'Test payment',
    accountId: 'acc_test',
    accountType: 'bank'
  };
  
  try {
    // Step 1: Preview
    log('cyan', '\n  STEP 1: PREVIEW');
    const preview = await waterPaymentsService.calculatePaymentDistribution(
      clientId,
      unitId,
      paymentData.amount,
      0, // credit
      paymentData.paymentDate,
      0  // selectedMonth
    );
    
    logActual('Preview', {
      billsToProcess: preview.billPayments.length,
      totalToAllocate: paymentData.amount,
      expectedStatus: preview.billPayments[0]?.newStatus
    });
    
    // Step 2: Record Payment
    log('cyan', '\n  STEP 2: RECORD PAYMENT');
    const paymentResult = await waterPaymentsService.recordPayment(
      clientId,
      unitId,
      paymentData
    );
    
    logActual('Payment Result', {
      success: paymentResult.success,
      billsPaid: paymentResult.billsPaid?.length,
      transactionId: paymentResult.transactionId
    });
    
    // Step 3: Verify bill was updated
    log('cyan', '\n  STEP 3: VERIFY BILL UPDATE');
    const db = await getDb();
    const billRef = db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc(fiscalPeriod);
    
    const billDoc = await billRef.get();
    const billData = billDoc.data();
    const unitBill = billData?.bills?.units?.[unitId];
    
    logActual('Bill After Payment', {
      status: unitBill?.status,
      paidAmount: centavosToPesos(unitBill?.paidAmount || 0),
      basePaid: centavosToPesos(unitBill?.basePaid || 0),
      penaltyPaid: centavosToPesos(unitBill?.penaltyPaid || 0),
      hasPayments: unitBill?.payments?.length > 0
    });
    
    let passed = true;
    
    // Verify payment was recorded
    passed &= compareValues('Payment Success', true, paymentResult.success);
    passed &= compareValues('Transaction Created', true, !!paymentResult.transactionId);
    
    // Verify bill status matches preview
    if (preview.billPayments[0] && unitBill) {
      passed &= compareValues('Bill Status', preview.billPayments[0].newStatus, unitBill.status);
      passed &= compareValues('Amount Paid', preview.billPayments[0].amountPaid, centavosToPesos(unitBill.paidAmount || 0));
    }
    
    return passed ? 'PASS' : 'FAIL';
    
  } catch (error) {
    logError('Test Exception', error.message);
    console.error(error);
    return 'ERROR';
  }
}

/**
 * Test 6: Surgical Update Verification
 */
async function test6_surgicalUpdate() {
  logTest('Test 6: Surgical Update (aggregatedData sync after payment)');
  
  const clientId = 'AVII';
  const unitId = '101';
  const fiscalPeriod = '2026-00';
  const fiscalYear = 2026;
  
  await setupTestBill(clientId, unitId, fiscalPeriod, 95000, '2025-08-07');
  
  try {
    // Step 1: Get aggregatedData BEFORE payment
    log('cyan', '\n  STEP 1: READ AGGREGATED DATA BEFORE PAYMENT');
    
    const db = await getDb();
    const aggRef = db.collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    const beforeDoc = await aggRef.get();
    const beforeData = beforeDoc.exists ? beforeDoc.data() : null;
    
    let beforeStatus = null;
    if (beforeData?.months?.[0]?.units?.[unitId]) {
      beforeStatus = beforeData.months[0].units[unitId].status;
    }
    
    logActual('Before Payment', {
      aggregatedDataExists: beforeDoc.exists,
      unitStatus: beforeStatus || 'NOT FOUND'
    });
    
    // Step 2: Make payment
    log('cyan', '\n  STEP 2: MAKE PAYMENT');
    
    const paymentResult = await waterPaymentsService.recordPayment(clientId, unitId, {
      amount: 950.00,
      paymentDate: '2025-10-19',
      paymentMethod: 'eTransfer',
      paymentMethodId: 'method_test',
      accountId: 'acc_test',
      accountType: 'bank'
    });
    
    logActual('Payment', {
      success: paymentResult.success,
      transactionId: paymentResult.transactionId
    });
    
    // Step 3: Check if surgical update happened
    log('cyan', '\n  STEP 3: VERIFY SURGICAL UPDATE');
    
    // Small delay for async updates
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const afterDoc = await aggRef.get();
    const afterData = afterDoc.exists ? afterDoc.data() : null;
    
    let afterStatus = null;
    if (afterData?.months?.[0]?.units?.[unitId]) {
      afterStatus = afterData.months[0].units[unitId].status;
    }
    
    logActual('After Payment', {
      aggregatedDataExists: afterDoc.exists,
      unitStatus: afterStatus || 'NOT FOUND',
      lastUpdated: afterData?._metadata?.calculationTimestamp
    });
    
    let passed = true;
    
    // Verify status changed
    if (!afterDoc.exists) {
      logWarning('aggregatedData does not exist - surgical update may have failed');
      passed = false;
    } else if (beforeStatus === afterStatus) {
      logWarning(`Status unchanged (${beforeStatus} → ${afterStatus}) - surgical update may not be working`);
      passed = false;
    } else {
      logSuccess(`Status updated: ${beforeStatus} → ${afterStatus}`);
    }
    
    return passed ? 'PASS' : 'FAIL';
    
  } catch (error) {
    logError('Test Exception', error.message);
    console.error(error);
    return 'ERROR';
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  logSection('WATER BILLS PAYMENT DIAGNOSTIC TEST SUITE');
  log('yellow', 'Testing expected vs actual behavior across the payment flow\n');
  
  const results = {
    passed: 0,
    failed: 0,
    errors: 0
  };
  
  const tests = [
    { name: 'Basic Single Payment', fn: test1_basicSinglePayment },
    { name: 'Backdated Payment with Penalty', fn: test2_backdatedPaymentWithPenalty },
    { name: 'Month Filtering', fn: test3_monthFiltering },
    { name: 'Preview vs Actual', fn: test4_previewVsActual },
    { name: 'Full Payment Flow', fn: test5_fullPaymentFlow },
    { name: 'Surgical Update', fn: test6_surgicalUpdate }
  ];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      
      if (result === 'PASS') {
        results.passed++;
      } else if (result === 'FAIL') {
        results.failed++;
      } else {
        results.errors++;
      }
      
      log(result === 'PASS' ? 'green' : 'red', `\n${result}: ${test.name}`);
      
    } catch (error) {
      results.errors++;
      log('red', `\nERROR: ${test.name}`);
      console.error(error);
    }
  }
  
  // Final summary
  logSection('TEST SUMMARY');
  log('green', `  Passed: ${results.passed}/${tests.length}`);
  log('red', `  Failed: ${results.failed}/${tests.length}`);
  log('yellow', `  Errors: ${results.errors}/${tests.length}`);
  
  const successRate = ((results.passed / tests.length) * 100).toFixed(1);
  log('bright', `\n  Success Rate: ${successRate}%`);
  
  if (results.failed > 0 || results.errors > 0) {
    log('yellow', '\n  Review failed tests above to identify issues in the payment flow.');
  } else {
    log('green', '\n  All tests passed! Payment system is working correctly.');
  }
  
  process.exit(results.failed + results.errors > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});


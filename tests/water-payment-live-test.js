/**
 * WATER BILLS PAYMENT LIVE TEST
 * 
 * Uses testHarness with auth tokens to test against real data
 * Identifies where preview vs payment diverge in the actual system
 */

import { testHarness, testConfig } from '../backend/testing/testHarness.js';
import { waterPaymentsService } from '../backend/services/waterPaymentsService.js';
import { getDb } from '../backend/firebase.js';
import { centavosToPesos } from '../backend/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';  // Change this to test different units

// Color codes
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
 * Test 1: Get current unpaid bills from live data
 */
const test1_getLiveBills = {
  name: 'Get Live Unpaid Bills',
  async test({ api, userId }) {
    log(CYAN, '\n📋 Fetching live unpaid bills from Firestore...');
    
    try {
      const db = await getDb();
      
      // Get all bill documents for this unit
      const billsSnapshot = await db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('bills')
        .orderBy('__name__')
        .get();
      
      const unpaidBills = [];
      
      billsSnapshot.forEach(doc => {
        const billData = doc.data();
        const unitBill = billData?.bills?.units?.[UNIT_ID];
        
        if (unitBill && unitBill.status !== 'paid') {
          unpaidBills.push({
            period: doc.id,
            status: unitBill.status,
            currentCharge: centavosToPesos(unitBill.currentCharge || 0),
            penaltyAmount: centavosToPesos(unitBill.penaltyAmount || 0),
            totalAmount: centavosToPesos(unitBill.totalAmount || 0),
            paidAmount: centavosToPesos(unitBill.paidAmount || 0),
            unpaidAmount: centavosToPesos(unitBill.totalAmount - (unitBill.paidAmount || 0))
          });
        }
      });
      
      log(BLUE, `\nFound ${unpaidBills.length} unpaid bills for Unit ${UNIT_ID}:`);
      unpaidBills.forEach(bill => {
        log(BLUE, `  ${bill.period}: $${bill.unpaidAmount} unpaid (base: $${bill.currentCharge}, penalty: $${bill.penaltyAmount}) [${bill.status}]`);
      });
      
      return {
        passed: true,
        data: { unpaidBills, count: unpaidBills.length },
        message: `Found ${unpaidBills.length} unpaid bills`
      };
      
    } catch (error) {
      return {
        passed: false,
        reason: `Failed to fetch bills: ${error.message}`
      };
    }
  }
};

/**
 * Test 2: Preview payment WITH selectedMonth
 */
const test2_previewWithMonth = {
  name: 'Preview Payment WITH selectedMonth (Month 0 = July)',
  async test({ api, userId }) {
    log(CYAN, '\n🎬 Testing PREVIEW with selectedMonth=0...');
    
    try {
      const paymentAmount = 950.00;
      const currentCredit = 0;
      const paymentDate = '2025-10-19';
      const selectedMonth = 0;  // July only
      
      log(YELLOW, `\nParameters:`);
      log(YELLOW, `  Payment: $${paymentAmount}`);
      log(YELLOW, `  Date: ${paymentDate}`);
      log(YELLOW, `  Selected Month: ${selectedMonth} (July only)`);
      log(YELLOW, `  Credit: $${currentCredit}`);
      
      const preview = await waterPaymentsService.calculatePaymentDistribution(
        CLIENT_ID,
        UNIT_ID,
        paymentAmount,
        currentCredit,
        paymentDate,
        selectedMonth  // ← FILTER TO JULY ONLY
      );
      
      log(GREEN, `\n✓ Preview Result:`);
      log(GREEN, `  Bills Processed: ${preview.billPayments.length}`);
      log(GREEN, `  Total Base Charges: $${preview.totalBaseCharges}`);
      log(GREEN, `  Total Penalties: $${preview.totalPenalties}`);
      log(GREEN, `  Total Bills Due: $${preview.totalBillsDue}`);
      log(GREEN, `  Credit Used: $${preview.creditUsed}`);
      log(GREEN, `  Overpayment: $${preview.overpayment}`);
      
      if (preview.billPayments.length > 0) {
        log(GREEN, `\n  Bill Details:`);
        preview.billPayments.forEach((bill, i) => {
          log(GREEN, `    ${i + 1}. ${bill.billPeriod}: $${bill.amountPaid} (${bill.newStatus})`);
          log(GREEN, `       Base: $${bill.baseChargePaid}, Penalty: $${bill.penaltyPaid}`);
        });
      }
      
      return {
        passed: true,
        data: { 
          preview,
          billsProcessed: preview.billPayments.length,
          totalBillsDue: preview.totalBillsDue
        },
        message: `Preview processed ${preview.billPayments.length} bills`
      };
      
    } catch (error) {
      return {
        passed: false,
        reason: `Preview failed: ${error.message}`
      };
    }
  }
};

/**
 * Test 3: Preview payment WITHOUT selectedMonth
 */
const test3_previewWithoutMonth = {
  name: 'Preview Payment WITHOUT selectedMonth (All Bills)',
  async test({ api, userId }) {
    log(CYAN, '\n🎬 Testing PREVIEW without selectedMonth...');
    
    try {
      const paymentAmount = 950.00;
      const currentCredit = 0;
      const paymentDate = '2025-10-19';
      
      log(YELLOW, `\nParameters:`);
      log(YELLOW, `  Payment: $${paymentAmount}`);
      log(YELLOW, `  Date: ${paymentDate}`);
      log(YELLOW, `  Selected Month: undefined (ALL BILLS)`);
      log(YELLOW, `  Credit: $${currentCredit}`);
      
      const preview = await waterPaymentsService.calculatePaymentDistribution(
        CLIENT_ID,
        UNIT_ID,
        paymentAmount,
        currentCredit,
        paymentDate,
        undefined  // ← NO FILTER (like recordPayment currently does)
      );
      
      log(BLUE, `\n✓ Preview Result:`);
      log(BLUE, `  Bills Processed: ${preview.billPayments.length}`);
      log(BLUE, `  Total Base Charges: $${preview.totalBaseCharges}`);
      log(BLUE, `  Total Penalties: $${preview.totalPenalties}`);
      log(BLUE, `  Total Bills Due: $${preview.totalBillsDue}`);
      log(BLUE, `  Credit Used: $${preview.creditUsed}`);
      log(BLUE, `  Overpayment: $${preview.overpayment}`);
      
      if (preview.billPayments.length > 0) {
        log(BLUE, `\n  Bill Details:`);
        preview.billPayments.forEach((bill, i) => {
          log(BLUE, `    ${i + 1}. ${bill.billPeriod}: $${bill.amountPaid} (${bill.newStatus})`);
          log(BLUE, `       Base: $${bill.baseChargePaid}, Penalty: $${bill.penaltyPaid}`);
        });
      }
      
      return {
        passed: true,
        data: { 
          preview,
          billsProcessed: preview.billPayments.length,
          totalBillsDue: preview.totalBillsDue
        },
        message: `Preview processed ${preview.billPayments.length} bills`
      };
      
    } catch (error) {
      return {
        passed: false,
        reason: `Preview failed: ${error.message}`
      };
    }
  }
};

/**
 * Test 4: Compare preview WITH vs WITHOUT selectedMonth
 */
const test4_compareResults = {
  name: 'Compare Preview WITH vs WITHOUT selectedMonth',
  dependencies: ['test2_previewWithMonth', 'test3_previewWithoutMonth'],
  async test({ api, userId }, previousResults) {
    log(CYAN, '\n📊 Comparing preview results...');
    
    // Get previous test results
    const withMonth = previousResults.find(r => r.name.includes('WITH selectedMonth'));
    const withoutMonth = previousResults.find(r => r.name.includes('WITHOUT selectedMonth'));
    
    if (!withMonth || !withoutMonth) {
      return {
        passed: false,
        reason: 'Could not find previous test results to compare'
      };
    }
    
    const with_data = withMonth.data.preview;
    const without_data = withoutMonth.data.preview;
    
    log(YELLOW, `\n${BRIGHT}COMPARISON:${RESET}`);
    log(YELLOW, '='.repeat(80));
    
    const billsDiffer = with_data.billPayments.length !== without_data.billPayments.length;
    const chargesDiffer = Math.abs(with_data.totalBaseCharges - without_data.totalBaseCharges) > 0.01;
    const penaltiesDiffer = Math.abs(with_data.totalPenalties - without_data.totalPenalties) > 0.01;
    const totalsDiffer = Math.abs(with_data.totalBillsDue - without_data.totalBillsDue) > 0.01;
    
    const billsMatch = !billsDiffer;
    const chargesMatch = !chargesDiffer;
    const penaltiesMatch = !penaltiesDiffer;
    const totalsMatch = !totalsDiffer;
    
    log(YELLOW, `  Bills Processed:`);
    log(YELLOW, `    WITH selectedMonth: ${with_data.billPayments.length}`);
    log(YELLOW, `    WITHOUT selectedMonth: ${without_data.billPayments.length}`);
    log(billsMatch ? GREEN : RED, `    ${billsMatch ? '✅ MATCH' : '❌ DIFFER'}`);
    
    log(YELLOW, `\n  Total Base Charges:`);
    log(YELLOW, `    WITH selectedMonth: $${with_data.totalBaseCharges}`);
    log(YELLOW, `    WITHOUT selectedMonth: $${without_data.totalBaseCharges}`);
    log(chargesMatch ? GREEN : RED, `    ${chargesMatch ? '✅ MATCH' : '❌ DIFFER'}`);
    
    log(YELLOW, `\n  Total Penalties:`);
    log(YELLOW, `    WITH selectedMonth: $${with_data.totalPenalties}`);
    log(YELLOW, `    WITHOUT selectedMonth: $${without_data.totalPenalties}`);
    log(penaltiesMatch ? GREEN : RED, `    ${penaltiesMatch ? '✅ MATCH' : '❌ DIFFER'}`);
    
    log(YELLOW, `\n  Total Bills Due:`);
    log(YELLOW, `    WITH selectedMonth: $${with_data.totalBillsDue}`);
    log(YELLOW, `    WITHOUT selectedMonth: $${without_data.totalBillsDue}`);
    log(totalsMatch ? GREEN : RED, `    ${totalsMatch ? '✅ MATCH' : '❌ DIFFER'}`);
    
    const allMatch = billsMatch && chargesMatch && penaltiesMatch && totalsMatch;
    
    if (!allMatch) {
      log(RED, `\n${BRIGHT}❌ BUG CONFIRMED!${RESET}`);
      log(RED, `\nselectedMonth parameter changes the calculation results!`);
      log(RED, `This is why preview and payment differ.`);
      log(RED, `\n🔧 FIX REQUIRED:`);
      log(RED, `  1. Frontend must send selectedMonth to record endpoint`);
      log(RED, `  2. Backend recordPayment() must pass selectedMonth to calculatePaymentDistribution()`);
    } else {
      log(GREEN, `\n${BRIGHT}✅ Results match - selectedMonth filter is working correctly${RESET}`);
    }
    
    return {
      passed: allMatch,
      data: {
        billsMatch,
        chargesMatch,
        penaltiesMatch,
        totalsMatch,
        with_data,
        without_data
      },
      message: allMatch ? 'Results match' : 'Results differ - bug confirmed',
      reason: allMatch ? null : 'selectedMonth parameter causes different calculations'
    };
  }
};

/**
 * Test 5: Check aggregatedData sync
 */
const test5_checkAggregatedData = {
  name: 'Check AggregatedData Status',
  async test({ api, userId }) {
    log(CYAN, '\n📊 Checking aggregatedData document...');
    
    try {
      const db = await getDb();
      
      const aggRef = db.collection('clients').doc(CLIENT_ID)
        .collection('projects').doc('waterBills')
        .collection('bills').doc('aggregatedData');
      
      const aggDoc = await aggRef.get();
      
      if (!aggDoc.exists) {
        log(YELLOW, `\n⚠️ aggregatedData document does NOT exist`);
        log(YELLOW, `   This means surgical updates will fail`);
        return {
          passed: false,
          reason: 'aggregatedData document does not exist',
          data: { exists: false }
        };
      }
      
      const aggData = aggDoc.data();
      
      log(GREEN, `\n✓ aggregatedData exists:`);
      log(GREEN, `  Fiscal Year: ${aggData.fiscalYear}`);
      log(GREEN, `  Months: ${aggData.months?.length || 0}`);
      log(GREEN, `  Last Updated: ${aggData._metadata?.calculationTimestamp}`);
      
      // Check if our unit exists in the data
      let unitFound = false;
      let unitStatus = null;
      
      if (aggData.months && aggData.months[0]) {
        const julyData = aggData.months[0];
        const unitData = julyData.units?.[UNIT_ID];
        
        if (unitData) {
          unitFound = true;
          unitStatus = unitData.status;
          
          log(GREEN, `\n  Unit ${UNIT_ID} in July (month 0):`);
          log(GREEN, `    Status: ${unitData.status}`);
          log(GREEN, `    Display Total Due: $${unitData.displayTotalDue}`);
          log(GREEN, `    Display Penalties: $${unitData.displayPenalties}`);
        }
      }
      
      if (!unitFound) {
        log(YELLOW, `\n⚠️ Unit ${UNIT_ID} not found in aggregatedData`);
      }
      
      return {
        passed: true,
        data: {
          exists: true,
          fiscalYear: aggData.fiscalYear,
          monthsCount: aggData.months?.length,
          unitFound,
          unitStatus
        },
        message: `aggregatedData exists, unit ${unitFound ? 'found' : 'not found'}`
      };
      
    } catch (error) {
      return {
        passed: false,
        reason: `Failed to check aggregatedData: ${error.message}`
      };
    }
  }
};

/**
 * Run all tests
 */
async function runLiveTests() {
  log(BRIGHT, `\n${'='.repeat(80)}`);
  log(BRIGHT, '  WATER BILLS PAYMENT LIVE TEST SUITE');
  log(BRIGHT, '  Testing against real data with authentication');
  log(BRIGHT, '='.repeat(80));
  
  log(YELLOW, `\nTest Configuration:`);
  log(YELLOW, `  Client: ${CLIENT_ID}`);
  log(YELLOW, `  Unit: ${UNIT_ID}`);
  log(YELLOW, `  API: ${testConfig.API_BASE_URL}`);
  
  const tests = [
    test1_getLiveBills,
    test2_previewWithMonth,
    test3_previewWithoutMonth,
    test4_compareResults,
    test5_checkAggregatedData
  ];
  
  // Store results for comparison test
  const results = [];
  
  for (const testDef of tests) {
    const result = await testHarness.runTest({
      ...testDef,
      test: async (context) => {
        // Pass previous results to comparison test
        if (testDef.dependencies) {
          return await testDef.test(context, results);
        }
        return await testDef.test(context);
      }
    });
    
    results.push(result);
    
    // Stop on critical failures
    if (!result.passed && testDef.name.includes('Get Live')) {
      log(RED, `\n❌ Critical test failed - cannot continue`);
      break;
    }
  }
  
  testHarness.showSummary();
  
  // Final analysis
  const comparisonTest = results.find(r => r.name.includes('Compare'));
  if (comparisonTest && !comparisonTest.passed) {
    log(RED, `\n\n${'='.repeat(80)}`);
    log(RED, `${BRIGHT}🐛 BUG ANALYSIS${RESET}`);
    log(RED, '='.repeat(80));
    log(RED, `\nThe tests have CONFIRMED the bug:`);
    log(RED, `  • Preview WITH selectedMonth filters bills correctly`);
    log(RED, `  • Preview WITHOUT selectedMonth processes ALL bills`);
    log(RED, `  • recordPayment() doesn't pass selectedMonth`);
    log(RED, `  • This causes preview vs payment to differ`);
    log(RED, `\nREQUIRED FIXES:`);
    log(RED, `  1. backend/services/waterPaymentsService.js:536`);
    log(RED, `     Add selectedMonth parameter to calculatePaymentDistribution call`);
    log(RED, `  2. frontend/sams-ui/src/components/water/WaterPaymentModal.jsx:315`);
    log(RED, `     Add selectedMonth to payment data sent to backend`);
    log(RED, '='.repeat(80));
  }
  
  process.exit(results.filter(r => !r.passed).length > 0 ? 1 : 0);
}

// Run the tests
runLiveTests().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});


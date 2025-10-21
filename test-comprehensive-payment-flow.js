// Comprehensive test suite for payment distribution logic
// Tests preview-to-payment consistency across all scenarios
import { waterPaymentsService } from './backend/services/waterPaymentsService.js';

// Test configuration
const CLIENT_ID = 'AVII';
const UNIT_ID = '102';

// Mock bill data - realistic scenarios
const mockBillScenarios = {
  // Scenario 1: Clean slate - all bills unpaid
  cleanSlate: [
    { period: '2026-00', baseCharge: 95000, penaltyAmount: 0, totalAmount: 95000, paidAmount: 0, basePaid: 0, penaltyPaid: 0, status: 'unpaid' }, // July: $950
    { period: '2026-01', baseCharge: 20000, penaltyAmount: 0, totalAmount: 20000, paidAmount: 0, basePaid: 0, penaltyPaid: 0, status: 'unpaid' }, // August: $200
    { period: '2026-02', baseCharge: 20000, penaltyAmount: 0, totalAmount: 20000, paidAmount: 0, basePaid: 0, penaltyPaid: 0, status: 'unpaid' }, // September: $200
    { period: '2026-03', baseCharge: 65000, penaltyAmount: 0, totalAmount: 65000, paidAmount: 0, basePaid: 0, penaltyPaid: 0, status: 'unpaid' }  // October: $650
  ],
  
  // Scenario 2: Partial payments with penalties
  partialWithPenalties: [
    { period: '2026-00', baseCharge: 95000, penaltyAmount: 5000, totalAmount: 100000, paidAmount: 50000, basePaid: 50000, penaltyPaid: 0, status: 'partial' }, // July: $1000 total, $500 paid, $500 unpaid
    { period: '2026-01', baseCharge: 20000, penaltyAmount: 1000, totalAmount: 21000, paidAmount: 0, basePaid: 0, penaltyPaid: 0, status: 'unpaid' }, // August: $210 total
    { period: '2026-02', baseCharge: 20000, penaltyAmount: 2000, totalAmount: 22000, paidAmount: 0, basePaid: 0, penaltyPaid: 0, status: 'unpaid' }, // September: $220 total
    { period: '2026-03', baseCharge: 65000, penaltyAmount: 0, totalAmount: 65000, paidAmount: 0, basePaid: 0, penaltyPaid: 0, status: 'unpaid' }  // October: $650 total
  ],
  
  // Scenario 3: Mixed paid/unpaid bills
  mixedStatus: [
    { period: '2026-00', baseCharge: 95000, penaltyAmount: 0, totalAmount: 95000, paidAmount: 95000, basePaid: 95000, penaltyPaid: 0, status: 'paid' }, // July: $950 paid
    { period: '2026-01', baseCharge: 20000, penaltyAmount: 1000, totalAmount: 21000, paidAmount: 10000, basePaid: 10000, penaltyPaid: 0, status: 'partial' }, // August: $210 total, $100 paid, $110 unpaid
    { period: '2026-02', baseCharge: 20000, penaltyAmount: 2000, totalAmount: 22000, paidAmount: 0, basePaid: 0, penaltyPaid: 0, status: 'unpaid' }, // September: $220 total
    { period: '2026-03', baseCharge: 65000, penaltyAmount: 3000, totalAmount: 68000, paidAmount: 0, basePaid: 0, penaltyPaid: 0, status: 'unpaid' }  // October: $680 total
  ]
};

// Mock the _getUnpaidBillsForUnit method
const originalGetUnpaidBillsForUnit = waterPaymentsService._getUnpaidBillsForUnit;

function createMockBills(scenarioData) {
  return scenarioData.map(bill => ({
    id: bill.period,
    period: bill.period,
    penaltyAmount: bill.penaltyAmount,
    totalAmount: bill.totalAmount,
    currentCharge: bill.baseCharge,
    paidAmount: bill.paidAmount,
    basePaid: bill.basePaid,
    penaltyPaid: bill.penaltyPaid,
    unpaidAmount: bill.totalAmount - bill.paidAmount,
    status: bill.status,
    monthsOverdue: 0,
    daysOverdue: 0,
    dueDate: `2025-${String(parseInt(bill.period.split('-')[1]) + 7).padStart(2, '0')}-01`,
    lastPenaltyUpdate: null,
    _dynamicCalculation: false,
    _usingStoredPenalties: true,
    _originalTotalAmount: bill.totalAmount
  }));
}

async function testPaymentScenario(scenarioName, scenarioData, testCases) {
  console.log(`\n🧪 TESTING SCENARIO: ${scenarioName.toUpperCase()}`);
  console.log('='.repeat(60));
  
  const mockBills = createMockBills(scenarioData);
  console.log(`📋 Mock Bills Created:`);
  mockBills.forEach(bill => {
    const unpaid = bill.totalAmount - bill.paidAmount;
    console.log(`   ${bill.period}: $${bill.totalAmount/100} total, $${bill.paidAmount/100} paid, $${unpaid/100} unpaid (${bill.status})`);
  });
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    console.log(`\n🔬 ${testCase.name}`);
    console.log(`📝 ${testCase.description}`);
    console.log(`💰 Payment: $${testCase.paymentAmount} on ${testCase.payOnDate} for month ${testCase.selectedMonth}`);
    
    // Mock the unpaid bills for this test
    waterPaymentsService._getUnpaidBillsForUnit = async function(clientId, unitId) {
      console.log(`🔧 [MOCK] Returning ${mockBills.length} bills for ${scenarioName}`);
      return mockBills;
    };
    
    try {
      const result = await waterPaymentsService.calculatePaymentDistribution(
        CLIENT_ID,
        UNIT_ID,
        testCase.paymentAmount,
        0, // currentCreditBalance
        testCase.payOnDate,
        testCase.selectedMonth
      );
      
      console.log(`✅ Preview Result:`);
      console.log(`   📊 Total bills due: $${result.totalBillsDue}`);
      console.log(`   💳 Credit used: $${result.creditUsed}`);
      console.log(`   💰 New credit balance: $${result.newCreditBalance}`);
      console.log(`   📋 Bill payments: ${result.billPayments.length}`);
      
      result.billPayments.forEach(billPayment => {
        console.log(`   📄 Bill ${billPayment.billPeriod}: $${billPayment.amountPaid} (Status: ${billPayment.newStatus})`);
      });
      
      // Validate expectations
      console.log(`\n🔍 Validation:`);
      
      // Check if expected bills were processed
      const processedBills = result.billPayments.map(bp => bp.billPeriod);
      const billsMatch = testCase.expectedBills.every(expected => processedBills.includes(expected));
      console.log(`   📋 Expected bills processed: ${billsMatch ? '✅' : '❌'} (Expected: ${testCase.expectedBills.join(', ')}, Got: ${processedBills.join(', ')})`);
      
      // Check status
      const statusMatch = testCase.expectedStatus ? result.billPayments.some(bp => bp.newStatus === testCase.expectedStatus) : true;
      console.log(`   📊 Expected status found: ${statusMatch ? '✅' : '❌'} (Expected: ${testCase.expectedStatus})`);
      
      // Check credit balance (with tolerance)
      const creditMatch = testCase.expectedCredit !== undefined ? Math.abs(result.newCreditBalance - testCase.expectedCredit) < 0.01 : true;
      console.log(`   💰 Expected credit balance: ${creditMatch ? '✅' : '❌'} (Expected: $${testCase.expectedCredit}, Got: $${result.newCreditBalance})`);
      
      // Check total bills due calculation
      const expectedTotalDue = testCase.expectedTotalDue !== undefined ? Math.abs(result.totalBillsDue - testCase.expectedTotalDue) < 0.01 : true;
      console.log(`   📊 Expected total bills due: ${expectedTotalDue ? '✅' : '❌'} (Expected: $${testCase.expectedTotalDue}, Got: $${result.totalBillsDue})`);
      
      const testPassed = billsMatch && statusMatch && creditMatch && expectedTotalDue;
      console.log(`   🎯 Overall test result: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (testPassed) passed++;
      else failed++;
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failed++;
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return { passed, failed };
}

async function runComprehensiveTests() {
  console.log('🚀 COMPREHENSIVE PAYMENT DISTRIBUTION TESTS');
  console.log('===========================================');
  console.log(`🎯 Testing with Client: ${CLIENT_ID}, Unit: ${UNIT_ID}`);
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  // Scenario 1: Clean Slate - All bills unpaid
  const cleanSlateTests = [
    {
      name: "Full payment of July bill only",
      description: "Pay $950 for July (month 0), should pay July only",
      paymentAmount: 950,
      payOnDate: "2025-07-16",
      selectedMonth: 0,
      expectedBills: ["2026-00"],
      expectedStatus: "paid",
      expectedCredit: 0,
      expectedTotalDue: 950
    },
    {
      name: "Partial payment of July bill",
      description: "Pay $500 for July (month 0), should leave $450 unpaid",
      paymentAmount: 500,
      payOnDate: "2025-07-16",
      selectedMonth: 0,
      expectedBills: ["2026-00"],
      expectedStatus: "partial",
      expectedCredit: 0,
      expectedTotalDue: 950
    },
    {
      name: "Overpayment of July bill",
      description: "Pay $1200 for July (month 0), should create $250 credit",
      paymentAmount: 1200,
      payOnDate: "2025-07-16",
      selectedMonth: 0,
      expectedBills: ["2026-00"],
      expectedStatus: "paid",
      expectedCredit: 250,
      expectedTotalDue: 950
    },
    {
      name: "Pay July and August",
      description: "Pay $1150 for August (month 1), should pay both July and August",
      paymentAmount: 1150,
      payOnDate: "2025-07-16",
      selectedMonth: 1,
      expectedBills: ["2026-00", "2026-01"],
      expectedStatus: "paid",
      expectedCredit: 0,
      expectedTotalDue: 1150
    },
    {
      name: "Pay all bills",
      description: "Pay $2000 for October (month 3), should pay all bills",
      paymentAmount: 2000,
      payOnDate: "2025-07-16",
      selectedMonth: 3,
      expectedBills: ["2026-00", "2026-01", "2026-02", "2026-03"],
      expectedStatus: "paid",
      expectedCredit: 0,
      expectedTotalDue: 2000
    }
  ];
  
  const scenario1Result = await testPaymentScenario("Clean Slate", mockBillScenarios.cleanSlate, cleanSlateTests);
  totalPassed += scenario1Result.passed;
  totalFailed += scenario1Result.failed;
  
  // Scenario 2: Partial payments with penalties
  const partialWithPenaltiesTests = [
    {
      name: "Complete July partial payment",
      description: "Pay remaining $500 for July (month 0), should complete July",
      paymentAmount: 500,
      payOnDate: "2025-07-16",
      selectedMonth: 0,
      expectedBills: ["2026-00"],
      expectedStatus: "paid",
      expectedCredit: 0,
      expectedTotalDue: 500
    },
    {
      name: "Partial completion of July",
      description: "Pay $300 of remaining $500 for July (month 0), should leave $200 unpaid",
      paymentAmount: 300,
      payOnDate: "2025-07-16",
      selectedMonth: 0,
      expectedBills: ["2026-00"],
      expectedStatus: "partial",
      expectedCredit: 0,
      expectedTotalDue: 500
    },
    {
      name: "Pay remaining July + August",
      description: "Pay $710 for August (month 1), should complete July and August",
      paymentAmount: 710,
      payOnDate: "2025-07-16",
      selectedMonth: 1,
      expectedBills: ["2026-00", "2026-01"],
      expectedStatus: "paid",
      expectedCredit: 0,
      expectedTotalDue: 710
    }
  ];
  
  const scenario2Result = await testPaymentScenario("Partial with Penalties", mockBillScenarios.partialWithPenalties, partialWithPenaltiesTests);
  totalPassed += scenario2Result.passed;
  totalFailed += scenario2Result.failed;
  
  // Scenario 3: Mixed status bills
  const mixedStatusTests = [
    {
      name: "Complete August partial payment",
      description: "Pay remaining $110 for August (month 1), should complete August",
      paymentAmount: 110,
      payOnDate: "2025-07-16",
      selectedMonth: 1,
      expectedBills: ["2026-01"],
      expectedStatus: "paid",
      expectedCredit: 0,
      expectedTotalDue: 110
    },
    {
      name: "Pay August + September",
      description: "Pay $330 for September (month 2), should complete August and September",
      paymentAmount: 330,
      payOnDate: "2025-07-16",
      selectedMonth: 2,
      expectedBills: ["2026-01", "2026-02"],
      expectedStatus: "paid",
      expectedCredit: 0,
      expectedTotalDue: 330
    },
    {
      name: "Pay all remaining bills",
      description: "Pay $1010 for October (month 3), should complete all remaining bills",
      paymentAmount: 1010,
      payOnDate: "2025-07-16",
      selectedMonth: 3,
      expectedBills: ["2026-01", "2026-02", "2026-03"],
      expectedStatus: "paid",
      expectedCredit: 0,
      expectedTotalDue: 1010
    }
  ];
  
  const scenario3Result = await testPaymentScenario("Mixed Status", mockBillScenarios.mixedStatus, mixedStatusTests);
  totalPassed += scenario3Result.passed;
  totalFailed += scenario3Result.failed;
  
  // Restore original method
  waterPaymentsService._getUnpaidBillsForUnit = originalGetUnpaidBillsForUnit;
  
  // Final Summary
  console.log('\n📊 COMPREHENSIVE TEST SUMMARY');
  console.log('==============================');
  console.log(`✅ Total Passed: ${totalPassed}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log(`📈 Overall Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Payment distribution logic is working correctly for:');
    console.log('   - Clean slate scenarios (all bills unpaid)');
    console.log('   - Partial payment scenarios with penalties');
    console.log('   - Mixed status scenarios (some paid, some unpaid)');
    console.log('   - Full payments, partial payments, and overpayments');
    console.log('   - Month filtering across different selected months');
    console.log('   - Credit balance creation for overpayments');
    console.log('\n🚀 The system is ready for production use!');
  } else {
    console.log('\n⚠️  Some tests failed. Review the logs above for details.');
    console.log('🔧 Fix the identified issues before deploying to production.');
  }
}

// Run the comprehensive tests
runComprehensiveTests().catch(console.error);

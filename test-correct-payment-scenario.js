// Test payment distribution with corrected bill data simulation
import { waterPaymentsService } from './backend/services/waterPaymentsService.js';

// Mock the _getUnpaidBillsForUnit method to return correct data
const originalGetUnpaidBillsForUnit = waterPaymentsService._getUnpaidBillsForUnit;

waterPaymentsService._getUnpaidBillsForUnit = async function(clientId, unitId) {
  console.log(`🔧 [MOCK] Returning corrected unpaid bills for unit ${unitId}`);
  
  // Simulate the correct state: July bill has $57.88 + penalties unpaid
  const mockBills = [
    {
      id: '2026-00',
      period: '2026-00',
      penaltyAmount: 788, // $7.88 in penalties
      totalAmount: 95788, // $957.88 total
      currentCharge: 95000, // $950.00 base charge
      paidAmount: 90000, // $900.00 paid (leaving $57.88 unpaid)
      basePaid: 90000, // $900.00 base paid
      penaltyPaid: 0, // $0.00 penalties paid
      unpaidAmount: 5788, // $57.88 unpaid (95788 - 90000)
      status: 'partial',
      monthsOverdue: 0,
      daysOverdue: 0,
      dueDate: '2025-07-15',
      lastPenaltyUpdate: null,
      _dynamicCalculation: false,
      _usingStoredPenalties: true,
      _originalTotalAmount: 95788
    }
  ];
  
  console.log(`🔧 [MOCK] Returning ${mockBills.length} bills:`, mockBills.map(b => `${b.period}: $${b.unpaidAmount} unpaid`));
  
  return mockBills;
};

async function testCorrectPaymentScenario() {
  console.log('🧪 TESTING CORRECT PAYMENT SCENARIO');
  console.log('===================================');
  
  const testScenarios = [
    {
      name: "Test 1: Pay remaining $57.88 on July bill",
      description: "Should pay the remaining balance on July bill",
      paymentAmount: 57.88,
      payOnDate: "2025-07-16",
      selectedMonth: 0,
      expectedBills: ["2026-00"],
      expectedStatus: "paid",
      expectedCredit: 0
    },
    {
      name: "Test 2: Pay $50 of remaining $57.88 on July bill",
      description: "Should leave $7.88 unpaid on July bill",
      paymentAmount: 50,
      payOnDate: "2025-07-16",
      selectedMonth: 0,
      expectedBills: ["2026-00"],
      expectedStatus: "partial",
      expectedCredit: 0
    },
    {
      name: "Test 3: Overpay remaining $57.88 with $100",
      description: "Should pay July bill and create $42.12 credit",
      paymentAmount: 100,
      payOnDate: "2025-07-16",
      selectedMonth: 0,
      expectedBills: ["2026-00"],
      expectedStatus: "paid",
      expectedCredit: 42.12
    }
  ];
  
  for (const scenario of testScenarios) {
    console.log(`\n🧪 ${scenario.name}`);
    console.log(`📝 ${scenario.description}`);
    console.log(`💰 Payment: $${scenario.paymentAmount} on ${scenario.payOnDate} for month ${scenario.selectedMonth}`);
    
    try {
      const result = await waterPaymentsService.calculatePaymentDistribution(
        'AVII', // clientId
        '102',  // unitId
        scenario.paymentAmount,
        0,      // currentCreditBalance
        scenario.payOnDate,
        scenario.selectedMonth
      );
      
      console.log(`✅ Response received:`);
      console.log(`   📊 Total bills due: $${result.totalBillsDue}`);
      console.log(`   💳 Credit used: $${result.creditUsed}`);
      console.log(`   💰 New credit balance: $${result.newCreditBalance}`);
      console.log(`   📋 Bill payments: ${result.billPayments.length}`);
      
      // Analyze bill payments
      result.billPayments.forEach(billPayment => {
        console.log(`   📄 Bill ${billPayment.billPeriod}: $${billPayment.amountPaid} (Status: ${billPayment.newStatus})`);
      });
      
      // Validate expectations
      console.log(`\n🔍 Validation:`);
      
      // Check if expected bills were processed
      const processedBills = result.billPayments.map(bp => bp.billPeriod);
      const billsMatch = scenario.expectedBills.every(expected => processedBills.includes(expected));
      console.log(`   📋 Expected bills processed: ${billsMatch ? '✅' : '❌'} (Expected: ${scenario.expectedBills.join(', ')}, Got: ${processedBills.join(', ')})`);
      
      // Check status
      const statusMatch = result.billPayments.some(bp => bp.newStatus === scenario.expectedStatus);
      console.log(`   📊 Expected status found: ${statusMatch ? '✅' : '❌'} (Expected: ${scenario.expectedStatus})`);
      
      // Check credit balance
      const creditMatch = Math.abs(result.newCreditBalance - scenario.expectedCredit) < 0.01;
      console.log(`   💰 Expected credit balance: ${creditMatch ? '✅' : '❌'} (Expected: $${scenario.expectedCredit}, Got: $${result.newCreditBalance})`);
      
      const testPassed = billsMatch && statusMatch && creditMatch;
      console.log(`   🎯 Overall test result: ${testPassed ? '✅ PASSED' : '❌ FAILED'}`);
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Restore original method
  waterPaymentsService._getUnpaidBillsForUnit = originalGetUnpaidBillsForUnit;
  console.log('\n✅ Restored original _getUnpaidBillsForUnit method');
}

// Run the test
testCorrectPaymentScenario().catch(console.error);

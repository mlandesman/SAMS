// Direct service test without authentication
import { waterPaymentsService } from './backend/services/waterPaymentsService.js';

// Test scenarios for payment distribution
const testScenarios = [
  {
    name: "Test 1: Full payment of July bill ($950)",
    description: "Should pay July bill in full, no credit created",
    paymentAmount: 950,
    payOnDate: "2025-07-16",
    selectedMonth: 0, // July
    expectedBills: ["2026-00"], // July bill
    expectedStatus: "paid"
  },
  {
    name: "Test 2: Partial payment of July bill ($900 of $950)",
    description: "Should leave $50 + penalties unpaid on July bill",
    paymentAmount: 900,
    payOnDate: "2025-07-16", 
    selectedMonth: 0, // July
    expectedBills: ["2026-00"], // July bill
    expectedStatus: "partial"
  }
];

async function runPaymentTest(scenario) {
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
    
    return { success: true, result };
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting Payment Distribution Tests (Direct Service)');
  console.log(`🎯 Testing with Client: AVII, Unit: 102`);
  
  const results = [];
  
  for (const scenario of testScenarios) {
    const result = await runPaymentTest(scenario);
    results.push({ scenario, result });
    
    // Wait a moment between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  
  let passed = 0;
  let failed = 0;
  
  results.forEach(({ scenario, result }) => {
    if (result.success) {
      console.log(`✅ ${scenario.name}`);
      passed++;
    } else {
      console.log(`❌ ${scenario.name}`);
      failed++;
    }
  });
  
  console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
}

// Run the tests
runAllTests().catch(console.error);

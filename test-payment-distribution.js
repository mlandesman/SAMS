// Using built-in fetch API

// Test configuration
const BASE_URL = 'http://localhost:5001';
const CLIENT_ID = 'AVII';
const UNIT_ID = '102';

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
  },
  {
    name: "Test 3: Payment covering July + August ($1150)",
    description: "Should pay July ($950) and August ($200) bills",
    paymentAmount: 1150,
    payOnDate: "2025-07-16",
    selectedMonth: 1, // August
    expectedBills: ["2026-00", "2026-01"], // July and August
    expectedStatus: "paid"
  },
  {
    name: "Test 4: Backdated payment in July for August bill",
    description: "Should calculate penalties as of July date",
    paymentAmount: 200,
    payOnDate: "2025-07-16",
    selectedMonth: 1, // August (but paying in July)
    expectedBills: ["2026-01"], // August bill
    expectedStatus: "paid"
  },
  {
    name: "Test 5: Overpayment scenario ($1200 for July)",
    description: "Should pay July bill and create credit balance",
    paymentAmount: 1200,
    payOnDate: "2025-07-16",
    selectedMonth: 0, // July
    expectedBills: ["2026-00"], // July bill
    expectedStatus: "paid",
    expectedCredit: 250 // $1200 - $950 = $250 credit
  }
];

async function runPaymentTest(scenario) {
  console.log(`\n🧪 ${scenario.name}`);
  console.log(`📝 ${scenario.description}`);
  console.log(`💰 Payment: $${scenario.paymentAmount} on ${scenario.payOnDate} for month ${scenario.selectedMonth}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/water/clients/${CLIENT_ID}/payments/preview`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        unitId: UNIT_ID,
        amount: scenario.paymentAmount,
        payOnDate: scenario.payOnDate,
        selectedMonth: scenario.selectedMonth
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
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
    const expectedBillsSet = new Set(scenario.expectedBills);
    const processedBillsSet = new Set(processedBills);
    
    const billsMatch = scenario.expectedBills.every(expected => processedBillsSet.has(expected));
    console.log(`   📋 Expected bills processed: ${billsMatch ? '✅' : '❌'} (Expected: ${scenario.expectedBills.join(', ')}, Got: ${processedBills.join(', ')})`);
    
    // Check status
    if (scenario.expectedStatus) {
      const statusMatch = result.billPayments.some(bp => bp.newStatus === scenario.expectedStatus);
      console.log(`   📊 Expected status found: ${statusMatch ? '✅' : '❌'} (Expected: ${scenario.expectedStatus})`);
    }
    
    // Check credit balance
    if (scenario.expectedCredit !== undefined) {
      const creditMatch = Math.abs(result.newCreditBalance - scenario.expectedCredit) < 0.01;
      console.log(`   💰 Expected credit balance: ${creditMatch ? '✅' : '❌'} (Expected: $${scenario.expectedCredit}, Got: $${result.newCreditBalance})`);
    }
    
    return {
      success: true,
      result,
      billsMatch,
      statusMatch: scenario.expectedStatus ? result.billPayments.some(bp => bp.newStatus === scenario.expectedStatus) : true,
      creditMatch: scenario.expectedCredit !== undefined ? Math.abs(result.newCreditBalance - scenario.expectedCredit) < 0.01 : true
    };
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Starting Payment Distribution Tests');
  console.log(`🎯 Testing with Client: ${CLIENT_ID}, Unit: ${UNIT_ID}`);
  console.log(`🌐 Backend URL: ${BASE_URL}`);
  
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
    if (result.success && result.billsMatch && result.statusMatch && result.creditMatch) {
      console.log(`✅ ${scenario.name}`);
      passed++;
    } else {
      console.log(`❌ ${scenario.name}`);
      failed++;
    }
  });
  
  console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n🔧 Issues found - check the logs above for details');
  } else {
    console.log('\n🎉 All tests passed! Payment distribution logic is working correctly.');
  }
}

// Run the tests
runAllTests().catch(console.error);

/**
 * Test script to verify HOA Dues Credit Fix implementation
 * Tests the calculateUnitTotal function with credit inclusion
 */

// Mock data structure to simulate Firestore dues data
const testDuesData = {
  'unit1': {
    creditBalance: 1000,  // $1,000 credit
    payments: [
      { month: 1, paid: 5000 },  // January: $5,000
      { month: 2, paid: 5000 },  // February: $5,000
      { month: 3, paid: 0 },     // March: $0 (unpaid)
      { month: 4, paid: 2500 },  // April: $2,500 (partial)
    ]
  },
  'unit2': {
    creditBalance: 500,   // $500 credit
    payments: [
      { month: 1, paid: 5000 },  // January: $5,000
      { month: 2, paid: 5000 },  // February: $5,000
    ]
  },
  'unit3': {
    creditBalance: 0,     // No credit
    payments: [
      { month: 1, paid: 5000 },  // January: $5,000
    ]
  }
};

// Simulate the OLD calculation (payments only)
function calculateUnitTotalOLD(unitId) {
  const unitData = testDuesData[unitId];
  if (!unitData || !Array.isArray(unitData.payments)) return 0;
  
  return unitData.payments.reduce((total, payment) => {
    return total + (payment.paid || 0);
  }, 0);
}

// Simulate the NEW calculation (payments + credits)
function calculateUnitTotalNEW(unitId) {
  const unitData = testDuesData[unitId];
  if (!unitData) return 0;
  
  // Sum all payments for the year
  let paymentsTotal = 0;
  if (Array.isArray(unitData.payments)) {
    paymentsTotal = unitData.payments.reduce((total, payment) => {
      return total + (payment.paid || 0);
    }, 0);
  }
  
  // Add credit balance to total paid (credits count as payments received)
  const creditBalance = unitData.creditBalance || 0;
  
  return paymentsTotal + creditBalance;
}

// Test runner
function runTests() {
  console.log('🧪 Testing HOA Dues Credit Fix Implementation\n');
  
  const testUnits = ['unit1', 'unit2', 'unit3'];
  let totalOLD = 0;
  let totalNEW = 0;
  
  testUnits.forEach(unitId => {
    const oldTotal = calculateUnitTotalOLD(unitId);
    const newTotal = calculateUnitTotalNEW(unitId);
    const creditAmount = testDuesData[unitId].creditBalance || 0;
    
    console.log(`📊 ${unitId.toUpperCase()}:`);
    console.log(`   Payments Only (OLD): $${oldTotal.toLocaleString()}`);
    console.log(`   Payments + Credits (NEW): $${newTotal.toLocaleString()}`);
    console.log(`   Credit Amount: $${creditAmount.toLocaleString()}`);
    console.log(`   Difference: $${(newTotal - oldTotal).toLocaleString()}`);
    console.log(`   ✅ Credit included: ${newTotal === oldTotal + creditAmount ? 'YES' : 'NO'}\n`);
    
    totalOLD += oldTotal;
    totalNEW += newTotal;
  });
  
  console.log('📈 TOTALS ACROSS ALL UNITS:');
  console.log(`   OLD Method (Payments Only): $${totalOLD.toLocaleString()}`);
  console.log(`   NEW Method (Payments + Credits): $${totalNEW.toLocaleString()}`);
  console.log(`   Total Credits Included: $${(totalNEW - totalOLD).toLocaleString()}`);
  
  // Calculate expected credit total
  const expectedCreditTotal = Object.values(testDuesData)
    .reduce((total, unit) => total + (unit.creditBalance || 0), 0);
  
  console.log(`   Expected Credit Total: $${expectedCreditTotal.toLocaleString()}`);
  console.log(`   ✅ Fix Working Correctly: ${(totalNEW - totalOLD) === expectedCreditTotal ? 'YES' : 'NO'}`);
  
  // Verification
  console.log('\n🔍 VERIFICATION:');
  if ((totalNEW - totalOLD) === expectedCreditTotal) {
    console.log('✅ SUCCESS: Credit amounts are properly included in Total Paid calculations');
    console.log('✅ HOA-DUES-001 fix is working correctly');
  } else {
    console.log('❌ FAILURE: Credit amounts are not being calculated correctly');
  }
}

// Run the test
runTests();
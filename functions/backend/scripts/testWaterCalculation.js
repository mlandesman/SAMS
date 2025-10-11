#!/usr/bin/env node

/**
 * Test script to verify water billing calculations
 * Expected: 54.78m³ × $50/m³ = $2,739.00 MXN
 */

// Test calculation without using the service (pure math)
function testCalculation() {
  console.log('=== Water Billing Calculation Test ===\n');
  
  // Test data
  const consumption = 54.78; // m³
  const ratePerM3 = 5000; // cents ($50.00 MXN)
  
  // Calculate
  const subtotal = Math.round(consumption * ratePerM3);
  const expectedCents = 273900; // Expected result in cents
  const expectedPesos = expectedCents / 100; // $2,739.00 MXN
  
  console.log('Input:');
  console.log(`  Consumption: ${consumption} m³`);
  console.log(`  Rate: ${ratePerM3} cents/m³ ($${ratePerM3/100} MXN/m³)`);
  console.log('');
  
  console.log('Calculation:');
  console.log(`  ${consumption} m³ × ${ratePerM3} cents/m³ = ${subtotal} cents`);
  console.log('');
  
  console.log('Result:');
  console.log(`  Total (cents): ${subtotal}`);
  console.log(`  Total (MXN): $${(subtotal/100).toFixed(2)}`);
  console.log('');
  
  console.log('Validation:');
  console.log(`  Expected: ${expectedCents} cents ($${expectedPesos.toFixed(2)} MXN)`);
  console.log(`  Actual: ${subtotal} cents ($${(subtotal/100).toFixed(2)} MXN)`);
  console.log(`  Match: ${subtotal === expectedCents ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  // Test with penalty
  console.log('=== With 5% Penalty Test ===\n');
  const penaltyRate = 0.05; // 5% as decimal
  const penalty = Math.round(subtotal * penaltyRate);
  const totalWithPenalty = subtotal + penalty;
  
  console.log('Penalty Calculation:');
  console.log(`  Subtotal: ${subtotal} cents`);
  console.log(`  Penalty Rate: ${penaltyRate} (${penaltyRate * 100}%)`);
  console.log(`  Penalty: ${penalty} cents ($${(penalty/100).toFixed(2)} MXN)`);
  console.log(`  Total with Penalty: ${totalWithPenalty} cents ($${(totalWithPenalty/100).toFixed(2)} MXN)`);
  console.log('');
  
  // Test edge cases
  console.log('=== Edge Cases ===\n');
  
  // Zero consumption
  const zeroConsumption = 0;
  const zeroCharge = Math.round(zeroConsumption * ratePerM3);
  console.log(`Zero consumption: ${zeroConsumption} m³ = ${zeroCharge} cents ($${(zeroCharge/100).toFixed(2)} MXN)`);
  
  // Small consumption
  const smallConsumption = 0.5;
  const smallCharge = Math.round(smallConsumption * ratePerM3);
  console.log(`Small consumption: ${smallConsumption} m³ = ${smallCharge} cents ($${(smallCharge/100).toFixed(2)} MXN)`);
  
  // Large consumption
  const largeConsumption = 100;
  const largeCharge = Math.round(largeConsumption * ratePerM3);
  console.log(`Large consumption: ${largeConsumption} m³ = ${largeCharge} cents ($${(largeCharge/100).toFixed(2)} MXN)`);
  
  console.log('\n=== All Tests Complete ===');
  
  return subtotal === expectedCents;
}

// Run test
const passed = testCalculation();
process.exit(passed ? 0 : 1);
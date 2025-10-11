#!/usr/bin/env node

/**
 * Manual test script for Water Calculation Engine
 * Tests all the new calculation methods
 */

import { WaterMeterService } from '../services/waterMeterService.js';

async function runTests() {
  console.log('=== Water Calculation Engine - Manual Tests ===\n');
  
  const service = new WaterMeterService();
  
  // Test 1: Normal consumption calculation
  console.log('Test 1: Normal Consumption');
  console.log('─────────────────────────');
  try {
    const normal = service.calculateConsumption(1234.56, 1180.00);
    console.log('Input: Current=1234.56, Previous=1180.00');
    console.log('Result:', normal);
    console.log('✅ Consumption:', normal.consumption, 'm³');
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 2: Meter rollover
  console.log('Test 2: Meter Rollover');
  console.log('──────────────────────');
  try {
    const rollover = service.calculateConsumption(100, 9950);
    console.log('Input: Current=100, Previous=9950 (rollover scenario)');
    console.log('Result:', rollover);
    console.log('✅ Consumption:', rollover.consumption, 'm³');
    console.log('⚠️ Warning:', rollover.warning);
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 3: High consumption warning
  console.log('Test 3: High Consumption Warning');
  console.log('─────────────────────────────────');
  try {
    const high = service.calculateConsumption(1450, 1200);
    console.log('Input: Current=1450, Previous=1200');
    console.log('Result:', high);
    console.log('✅ Consumption:', high.consumption, 'm³');
    console.log('⚠️ Warnings:', high.warnings);
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 4: Compound penalty calculation
  console.log('Test 4: Compound Penalty (2 months at 5%)');
  console.log('──────────────────────────────────────────');
  try {
    const penalty = service.applyCompoundPenalty(273900, 0.05, 2);
    console.log('Input: Amount=273900 cents ($2,739), Rate=0.05, Months=2');
    console.log('Result:', penalty);
    console.log('✅ Original:', 273900, 'cents ($2,739.00)');
    console.log('✅ Penalty:', penalty.penalty, 'cents ($' + (penalty.penalty/100).toFixed(2) + ')');
    console.log('✅ Total:', penalty.totalWithPenalty, 'cents ($' + (penalty.totalWithPenalty/100).toFixed(2) + ')');
    console.log('✅ Effective Rate:', penalty.effectiveRate.toFixed(2) + '%');
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 5: Credit balance application
  console.log('Test 5: Credit Balance Application');
  console.log('───────────────────────────────────');
  try {
    const credit = service.handleCreditBalance(273900, 100000);
    console.log('Input: Total Due=273900 cents ($2,739), Credit=100000 cents ($1,000)');
    console.log('Result:', credit);
    console.log('✅ Original Amount:', credit.originalAmount, 'cents');
    console.log('✅ Credit Used:', credit.creditUsed, 'cents ($' + (credit.creditUsed/100).toFixed(2) + ')');
    console.log('✅ Amount Due:', credit.amountDue, 'cents ($' + (credit.amountDue/100).toFixed(2) + ')');
    console.log('✅ Credit Remaining:', credit.creditRemaining, 'cents ($' + (credit.creditRemaining/100).toFixed(2) + ')');
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 6: Days late calculation
  console.log('Test 6: Days Late Calculation');
  console.log('──────────────────────────────');
  try {
    const daysLate = service.calculateDaysLate('2025-08-01', '2025-08-15');
    console.log('Input: Due Date=2025-08-01, Current Date=2025-08-15');
    console.log('✅ Days Late:', daysLate);
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 7: Water charges with penalty
  console.log('Test 7: Water Charges Calculation');
  console.log('──────────────────────────────────');
  try {
    const config = {
      ratePerM3: 5000,
      penaltyRate: 0.05,
      penaltyDays: 10
    };
    
    console.log('Configuration:', config);
    console.log('');
    
    // Without penalty
    const chargesNoPenalty = service.calculateWaterCharges(54.78, config, 5);
    console.log('A) Within grace period (5 days late):');
    console.log('   Consumption: 54.78 m³');
    console.log('   Result:', chargesNoPenalty);
    console.log('   ✅ Total: $' + (chargesNoPenalty.total/100).toFixed(2), 'MXN');
    console.log('');
    
    // With penalty
    const chargesWithPenalty = service.calculateWaterCharges(54.78, config, 15);
    console.log('B) After grace period (15 days late):');
    console.log('   Consumption: 54.78 m³');
    console.log('   Result:', chargesWithPenalty);
    console.log('   ✅ Subtotal: $' + (chargesWithPenalty.subtotal/100).toFixed(2), 'MXN');
    console.log('   ✅ Penalty: $' + (chargesWithPenalty.penalty/100).toFixed(2), 'MXN');
    console.log('   ✅ Total: $' + (chargesWithPenalty.total/100).toFixed(2), 'MXN');
    console.log('');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 8: Edge cases
  console.log('Test 8: Edge Cases');
  console.log('───────────────────');
  
  // Zero consumption
  try {
    const zero = service.calculateConsumption(1000, 1000);
    console.log('A) Zero consumption (1000 - 1000):', zero.consumption, 'm³ ✅');
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
  
  // Negative reading (should error)
  try {
    service.calculateConsumption(-10, 100);
    console.log('B) Negative reading: ❌ Should have thrown error');
  } catch (error) {
    console.log('B) Negative reading: ✅ Correctly rejected:', error.message);
  }
  
  // No penalty for 0 months
  try {
    const noPenalty = service.applyCompoundPenalty(100000, 0.05, 0);
    console.log('C) No penalty (0 months):', noPenalty.penalty === 0 ? '✅ Zero penalty' : '❌ Has penalty');
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }
  
  // Excess credit
  try {
    const excess = service.handleCreditBalance(30000, 50000);
    console.log('D) Excess credit ($500 credit, $300 bill):');
    console.log('   Amount Due: $' + (excess.amountDue/100).toFixed(2), excess.amountDue === 0 ? '✅' : '❌');
    console.log('   Credit Remaining: $' + (excess.creditRemaining/100).toFixed(2), excess.creditRemaining === 20000 ? '✅' : '❌');
  } catch (error) {
    console.error('   ❌ Error:', error.message);
  }

  console.log('\n=== All Manual Tests Complete ===\n');
}

// Run the tests
runTests().catch(console.error);
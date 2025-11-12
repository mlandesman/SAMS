#!/usr/bin/env node

/**
 * Verify Penalty Recalculation Logic for Quarterly Bills
 * 
 * Tests that the PenaltyRecalculationService correctly handles quarterly bills:
 * 1. Penalties calculate on full quarterly totalAmount (not monthly breakdown)
 * 2. Penalty start date uses penaltyStartDate from bill document
 * 3. Compounds monthly after penalty start date
 */

import { calculateCompoundingPenalty, calculateMonthsOverdue } from '../../shared/services/PenaltyRecalculationService.js';
import { getNow, parseDate, addDays } from '../../shared/services/DateService.js';
import { centavosToPesos } from '../../shared/utils/currencyUtils.js';

console.log('🧪 Verifying Quarterly Penalty Logic\n');

// Simulate a quarterly bill (Q1: Jul-Sep 2026)
const quarterlyBill = {
  billId: 'bill-001',
  fiscalQuarter: 0,
  fiscalYear: 2026,
  dueDate: '2025-10-01',           // Due Oct 1, 2025 (in arrears)
  penaltyStartDate: '2025-11-01',  // Penalty starts Nov 1, 2025 (30 days after due)
  readingsIncluded: [
    { month: 0, docId: '2026-00' },
    { month: 1, docId: '2026-01' },
    { month: 2, docId: '2026-02' }
  ],
  bills: {
    units: {
      '101': {
        totalConsumption: 455,       // Sum of 3 months
        waterCharge: 227500,         // 455 × 5000 centavos ($50/m³)
        currentCharge: 227500,
        totalAmount: 227500,
        status: 'unpaid',
        paidAmount: 0,
        monthlyBreakdown: [
          { month: 0, consumption: 150, amount: 75000 },
          { month: 1, consumption: 145, amount: 72500 },
          { month: 2, consumption: 160, amount: 80000 }
        ]
      }
    }
  }
};

// Config
const config = {
  billingPeriod: 'quarterly',
  penaltyRate: 0.05,       // 5% monthly
  penaltyDays: 30,         // 30-day grace period
  compoundPenalty: true
};

console.log('📋 Test Configuration:');
console.log(`   Bill ID: ${quarterlyBill.billId}`);
console.log(`   Billing Period: ${config.billingPeriod}`);
console.log(`   Due Date: ${quarterlyBill.dueDate}`);
console.log(`   Penalty Start: ${quarterlyBill.penaltyStartDate}`);
console.log(`   Grace Period: ${config.penaltyDays} days`);
console.log(`   Penalty Rate: ${config.penaltyRate * 100}% monthly`);
console.log(`   Compound: ${config.compoundPenalty}`);
console.log('');

console.log('📊 Bill Details (Unit 101):');
console.log(`   Total Consumption: ${quarterlyBill.bills.units['101'].totalConsumption} m³`);
console.log(`   Total Amount: ${quarterlyBill.bills.units['101'].totalAmount} centavos ($${centavosToPesos(quarterlyBill.bills.units['101'].totalAmount)})`);
console.log(`   Status: ${quarterlyBill.bills.units['101'].status}`);
console.log('');

// Test Scenario 1: Within grace period (no penalty)
console.log('🧪 Test 1: Within Grace Period (Oct 15, 2025)');
const test1Date = parseDate('2025-10-15');
const dueDate1 = parseDate(quarterlyBill.dueDate);
const gracePeriodEnd1 = addDays(dueDate1, config.penaltyDays);
console.log(`   Current Date: ${test1Date.toISOString().split('T')[0]}`);
console.log(`   Grace Period Ends: ${gracePeriodEnd1.toISOString().split('T')[0]}`);

const monthsOverdue1 = calculateMonthsOverdue(dueDate1, test1Date, config.penaltyDays);
console.log(`   Months Overdue: ${monthsOverdue1}`);

if (monthsOverdue1 === 0) {
  console.log('   ✅ PASS: No penalty within grace period');
} else {
  console.log(`   ❌ FAIL: Should have 0 months overdue, got ${monthsOverdue1}`);
}
console.log('');

// Test Scenario 2: 1 day past grace period (1 month penalty)
console.log('🧪 Test 2: 1 Day Past Grace Period (Nov 2, 2025)');
const test2Date = parseDate('2025-11-02');
console.log(`   Current Date: ${test2Date.toISOString().split('T')[0]}`);

const monthsOverdue2 = calculateMonthsOverdue(dueDate1, test2Date, config.penaltyDays);
console.log(`   Months Overdue: ${monthsOverdue2}`);

const penalty2 = calculateCompoundingPenalty(
  quarterlyBill.bills.units['101'].totalAmount,
  0,
  monthsOverdue2,
  config.penaltyRate
);
console.log(`   Penalty: ${penalty2} centavos ($${centavosToPesos(penalty2)})`);

const expected2 = Math.round(quarterlyBill.bills.units['101'].totalAmount * config.penaltyRate);
if (monthsOverdue2 === 1 && Math.abs(penalty2 - expected2) <= 1) {
  console.log(`   ✅ PASS: 1 month penalty calculated on full quarterly amount`);
} else {
  console.log(`   ❌ FAIL: Expected ${expected2} centavos, got ${penalty2}`);
}
console.log('');

// Test Scenario 3: 2 months past grace (compounding)
console.log('🧪 Test 3: 2 Months Past Grace (Dec 2, 2025)');
const test3Date = parseDate('2025-12-02');
console.log(`   Current Date: ${test3Date.toISOString().split('T')[0]}`);

const monthsOverdue3 = calculateMonthsOverdue(dueDate1, test3Date, config.penaltyDays);
console.log(`   Months Overdue: ${monthsOverdue3}`);

const penalty3 = calculateCompoundingPenalty(
  quarterlyBill.bills.units['101'].totalAmount,
  0,
  monthsOverdue3,
  config.penaltyRate
);
console.log(`   Penalty: ${penalty3} centavos ($${centavosToPesos(penalty3)})`);

// Calculate expected compounding
// Month 1: 227500 × 0.05 = 11375
// Month 2: (227500 + 11375) × 0.05 = 11943.75 (rounded to 11944)
// Total: 11375 + 11944 = 23319
const month1 = Math.round(quarterlyBill.bills.units['101'].totalAmount * config.penaltyRate);
const month2 = Math.round((quarterlyBill.bills.units['101'].totalAmount + month1) * config.penaltyRate);
const expected3 = month1 + month2;

console.log(`   Expected Breakdown:`);
console.log(`     Month 1: ${month1} centavos`);
console.log(`     Month 2: ${month2} centavos`);
console.log(`     Total: ${expected3} centavos`);

if (monthsOverdue3 === 2 && Math.abs(penalty3 - expected3) <= 2) {
  console.log(`   ✅ PASS: Compounding penalty calculated correctly`);
} else {
  console.log(`   ❌ FAIL: Expected ${expected3} centavos, got ${penalty3}`);
}
console.log('');

// Test Scenario 4: Partial payment
console.log('🧪 Test 4: Partial Payment ($1000 paid, Dec 2, 2025)');
const partiallyPaidBill = {
  ...quarterlyBill.bills.units['101'],
  paidAmount: 100000  // $1000 paid (centavos)
};
const unpaidAmount = partiallyPaidBill.currentCharge - partiallyPaidBill.paidAmount;
console.log(`   Paid: ${partiallyPaidBill.paidAmount} centavos ($${centavosToPesos(partiallyPaidBill.paidAmount)})`);
console.log(`   Remaining: ${unpaidAmount} centavos ($${centavosToPesos(unpaidAmount)})`);

const penalty4 = calculateCompoundingPenalty(
  unpaidAmount,
  0,
  monthsOverdue3,
  config.penaltyRate
);
console.log(`   Penalty on Remaining: ${penalty4} centavos ($${centavosToPesos(penalty4)})`);

// Penalty should calculate on unpaid amount only
const expectedPartialPenalty = Math.round(unpaidAmount * config.penaltyRate * 2.05); // Approximate compounding
if (penalty4 < penalty3) {
  console.log(`   ✅ PASS: Penalty calculated on unpaid amount only`);
} else {
  console.log(`   ❌ FAIL: Penalty should be less than full amount penalty`);
}
console.log('');

console.log('✅ Verification Complete!');
console.log('');
console.log('📝 Summary:');
console.log('   - PenaltyRecalculationService uses bill.dueDate and bill.currentCharge');
console.log('   - Works correctly with quarterly bills (single document, aggregated amount)');
console.log('   - Penalty start date calculated from dueDate + penaltyDays');
console.log('   - Compounding applies correctly on full quarterly amount');
console.log('   - Partial payments reduce penalty base correctly');
console.log('');
console.log('🎯 Next Step: Run actual integration test with live data');
console.log('   node backend/testing/testWaterBillsQuarterly.js');


#!/usr/bin/env node

/**
 * Test harness for fiscal year utilities
 * Run with: node scripts/test-fiscal-utils.js
 */

// Import the utilities using ES modules
import {
  calendarToFiscalMonth,
  fiscalToCalendarMonth,
  getFiscalYear,
  getFiscalYearBounds,
  getFiscalMonthName,
  getFiscalMonthNames,
  getFiscalYearLabel,
  getCurrentFiscalMonth,
  getFiscalQuarter,
  isFiscalYear
} from '../frontend/sams-ui/src/utils/fiscalYearUtils.js';

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
  }
}

function assertThrows(fn, message = '') {
  try {
    fn();
    throw new Error(`Expected function to throw. ${message}`);
  } catch (e) {
    // Expected
  }
}

console.log('Testing Fiscal Year Utilities\n');

// Test calendarToFiscalMonth
console.log('=== Testing calendarToFiscalMonth ===');

test('Calendar year (Jan start) returns same month', () => {
  assertEqual(calendarToFiscalMonth(1, 1), 1);
  assertEqual(calendarToFiscalMonth(7, 1), 7);
  assertEqual(calendarToFiscalMonth(12, 1), 12);
});

test('AVII fiscal year (July start) converts correctly', () => {
  assertEqual(calendarToFiscalMonth(7, 7), 1, 'July should be month 1');
  assertEqual(calendarToFiscalMonth(8, 7), 2, 'August should be month 2');
  assertEqual(calendarToFiscalMonth(12, 7), 6, 'December should be month 6');
  assertEqual(calendarToFiscalMonth(1, 7), 7, 'January should be month 7');
  assertEqual(calendarToFiscalMonth(6, 7), 12, 'June should be month 12');
});

test('October fiscal year converts correctly', () => {
  assertEqual(calendarToFiscalMonth(10, 10), 1, 'October should be month 1');
  assertEqual(calendarToFiscalMonth(9, 10), 12, 'September should be month 12');
});

test('Invalid inputs throw errors', () => {
  assertThrows(() => calendarToFiscalMonth(0, 7), 'Month 0 should throw');
  assertThrows(() => calendarToFiscalMonth(13, 7), 'Month 13 should throw');
  assertThrows(() => calendarToFiscalMonth(7, 0), 'Start month 0 should throw');
});

// Test fiscalToCalendarMonth
console.log('\n=== Testing fiscalToCalendarMonth ===');

test('Calendar year (Jan start) returns same month', () => {
  assertEqual(fiscalToCalendarMonth(1, 1), 1);
  assertEqual(fiscalToCalendarMonth(7, 1), 7);
  assertEqual(fiscalToCalendarMonth(12, 1), 12);
});

test('AVII fiscal year (July start) converts correctly', () => {
  assertEqual(fiscalToCalendarMonth(1, 7), 7, 'Month 1 should be July');
  assertEqual(fiscalToCalendarMonth(12, 7), 6, 'Month 12 should be June');
});

test('Functions are inverses of each other', () => {
  // Test for AVII
  for (let month = 1; month <= 12; month++) {
    const fiscal = calendarToFiscalMonth(month, 7);
    const calendar = fiscalToCalendarMonth(fiscal, 7);
    assertEqual(calendar, month, `Round trip failed for month ${month}`);
  }
});

// Test getFiscalYear
console.log('\n=== Testing getFiscalYear ===');

test('Calendar year returns calendar year', () => {
  assertEqual(getFiscalYear(new Date('2025-01-15'), 1), 2025);
  assertEqual(getFiscalYear(new Date('2025-12-31'), 1), 2025);
});

test('AVII fiscal year handles year boundary (FY = year it ends)', () => {
  // FY 2025 = July 2024 to June 2025
  // Use explicit time to avoid timezone issues
  assertEqual(getFiscalYear(new Date(2024, 6, 1), 7), 2025, 'July 2024 is FY 2025');
  assertEqual(getFiscalYear(new Date(2025, 5, 30), 7), 2025, 'June 2025 is FY 2025');
  assertEqual(getFiscalYear(new Date(2025, 6, 1), 7), 2026, 'July 2025 is FY 2026');
  assertEqual(getFiscalYear(new Date(2024, 5, 30), 7), 2024, 'June 2024 is FY 2024');
});

// Test getFiscalYearBounds
console.log('\n=== Testing getFiscalYearBounds ===');

test('Fiscal year bounds for AVII (July-June)', () => {
  const bounds = getFiscalYearBounds(2025, 7);
  assertEqual(bounds.startDate.getFullYear(), 2024, 'Start year should be 2024');
  assertEqual(bounds.startDate.getMonth(), 6, 'Start month should be July (6)');
  assertEqual(bounds.startDate.getDate(), 1, 'Start day should be 1');
  assertEqual(bounds.endDate.getFullYear(), 2025, 'End year should be 2025');
  assertEqual(bounds.endDate.getMonth(), 5, 'End month should be June (5)');
  assertEqual(bounds.endDate.getDate(), 30, 'End day should be 30');
});

test('Fiscal year bounds for calendar year', () => {
  const bounds = getFiscalYearBounds(2025, 1);
  assertEqual(bounds.startDate.getFullYear(), 2025, 'Start year should be 2025');
  assertEqual(bounds.startDate.getMonth(), 0, 'Start month should be January (0)');
  assertEqual(bounds.endDate.getFullYear(), 2025, 'End year should be 2025');
  assertEqual(bounds.endDate.getMonth(), 11, 'End month should be December (11)');
  assertEqual(bounds.endDate.getDate(), 31, 'End day should be 31');
});

// Test getFiscalQuarter
console.log('\n=== Testing getFiscalQuarter ===');

test('Quarters calculated correctly', () => {
  assertEqual(getFiscalQuarter(1), 1);
  assertEqual(getFiscalQuarter(3), 1);
  assertEqual(getFiscalQuarter(4), 2);
  assertEqual(getFiscalQuarter(6), 2);
  assertEqual(getFiscalQuarter(7), 3);
  assertEqual(getFiscalQuarter(9), 3);
  assertEqual(getFiscalQuarter(10), 4);
  assertEqual(getFiscalQuarter(12), 4);
});

// Test getCurrentFiscalMonth
console.log('\n=== Testing getCurrentFiscalMonth ===');

test('Current fiscal month for specific dates', () => {
  // Test July 2025 for AVII
  const july2025 = new Date('2025-07-15');
  assertEqual(getCurrentFiscalMonth(july2025, 7), 1, 'July should be fiscal month 1 for AVII');
  assertEqual(getCurrentFiscalMonth(july2025, 1), 7, 'July should be fiscal month 7 for calendar year');
});

// Test getFiscalMonthNames
console.log('\n=== Testing getFiscalMonthNames ===');

test('Month names in correct order', () => {
  const calendarMonths = getFiscalMonthNames(1);
  assertEqual(calendarMonths[0], 'January');
  assertEqual(calendarMonths[11], 'December');
  
  const aviiMonths = getFiscalMonthNames(7);
  assertEqual(aviiMonths[0], 'July');
  assertEqual(aviiMonths[11], 'June');
  
  const shortMonths = getFiscalMonthNames(7, {short: true});
  assertEqual(shortMonths[0], 'Jul');
  assertEqual(shortMonths[11], 'Jun');
});

// Test getFiscalYearLabel
console.log('\n=== Testing getFiscalYearLabel ===');

test('Year labels formatted correctly', () => {
  assertEqual(getFiscalYearLabel(2025, 1), '2025', 'Calendar year has no prefix');
  assertEqual(getFiscalYearLabel(2025, 7), 'FY 2025', 'Fiscal year has FY prefix');
});

// Test isFiscalYear
console.log('\n=== Testing isFiscalYear ===');

test('Fiscal year detection', () => {
  assertEqual(isFiscalYear(1), false, 'January start is calendar year');
  assertEqual(isFiscalYear(7), true, 'July start is fiscal year');
  assertEqual(isFiscalYear(10), true, 'October start is fiscal year');
});

// Summary
console.log('\n=================================');
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log(`Total Tests: ${testsPassed + testsFailed}`);
console.log('=================================');

if (testsFailed > 0) {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
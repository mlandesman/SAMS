#!/usr/bin/env node

import { getFiscalYear } from '../frontend/sams-ui/src/utils/fiscalYearUtils.js';

// Test fiscal year calculation
const testDate = new Date('2025-07-31'); // Today
const fiscalYearStartMonth = 7; // July

console.log('Testing fiscal year calculation:');
console.log('Date:', testDate.toISOString());
console.log('Fiscal Year Start Month:', fiscalYearStartMonth);

const fiscalYear = getFiscalYear(testDate, fiscalYearStartMonth);
console.log('Calculated Fiscal Year:', fiscalYear);

// Test a few more dates
console.log('\nAdditional tests:');
const testDates = [
  new Date('2025-06-30'), // Last day of FY 2025
  new Date('2025-07-01'), // First day of FY 2026
  new Date('2025-12-31'), // End of calendar year 2025, still FY 2026
  new Date('2026-06-30'), // Last day of FY 2026
];

testDates.forEach(date => {
  const fy = getFiscalYear(date, fiscalYearStartMonth);
  console.log(`${date.toISOString().split('T')[0]} -> FY ${fy}`);
});
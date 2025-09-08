import { getFiscalYear } from '../frontend/sams-ui/src/utils/fiscalYearUtils.js';

console.log('Debugging getFiscalYear function:\n');

const testDate = new Date('2024-07-01');
console.log('Test date:', testDate.toISOString());
console.log('Month:', testDate.getMonth() + 1);
console.log('Year:', testDate.getFullYear());
console.log('Fiscal year start month:', 7);
console.log('Result:', getFiscalYear(testDate, 7));

// Let's trace through the logic
const month = testDate.getMonth() + 1; // 7
const year = testDate.getFullYear(); // 2024
const fiscalYearStartMonth = 7;

console.log('\nTracing logic:');
console.log('fiscalYearStartMonth === 1?', fiscalYearStartMonth === 1); // false
console.log('month >= fiscalYearStartMonth?', month >= fiscalYearStartMonth); // 7 >= 7 = true
console.log('Should return year + 1:', year + 1); // 2025
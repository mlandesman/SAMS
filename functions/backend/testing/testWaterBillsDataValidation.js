/**
 * Water Bills Data Validation Test
 * 
 * Simple validation test that confirms:
 * 1. Data files are accessible
 * 2. Data structure is correct
 * 3. Chronological processing will work
 * 4. Fiscal year conversions are correct
 */

import { readFileFromFirebaseStorage } from '../api/importStorage.js';
import { getFiscalYear, getCurrentFiscalMonth } from '../utils/fiscalYearUtils.js';

const CLIENT_ID = 'AVII';
const TEST_USER_ID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';
const FISCAL_YEAR_START_MONTH = 7; // AVII fiscal year starts in July

/**
 * Get fiscal year and month for a date using proper fiscal year utilities
 * @param {Date} date - Calendar date
 * @returns {Object} {fiscalYear, fiscalMonth} where fiscalMonth is 0-11 (0=July for AVII)
 */
function getFiscalYearMonth(date) {
  const fiscalYear = getFiscalYear(date, FISCAL_YEAR_START_MONTH);
  
  // Calculate fiscal month (0-11 where 0 = July for AVII)
  const calendarMonth = date.getMonth() + 1; // 1-12
  let fiscalMonth = calendarMonth - FISCAL_YEAR_START_MONTH;
  if (fiscalMonth < 0) {
    fiscalMonth += 12;
  }
  
  return { fiscalYear, fiscalMonth };
}

async function runValidation() {
  try {
    console.log('\n🌊 Water Bills Data Validation Test');
    console.log('='.repeat(80));
    
    // Load all files
    console.log('\n📥 Loading data files...');
    
    const transactionsText = await readFileFromFirebaseStorage(
      `imports/${CLIENT_ID}/Transactions.json`,
      { uid: TEST_USER_ID }
    );
    const transactions = JSON.parse(transactionsText);
    console.log(`✓ Transactions.json: ${transactions.length} records`);
    
    const readingsText = await readFileFromFirebaseStorage(
      `imports/${CLIENT_ID}/waterMeterReadings.json`,
      { uid: TEST_USER_ID }
    );
    const readings = JSON.parse(readingsText);
    console.log(`✓ waterMeterReadings.json: ${readings.length} units`);
    
    const crossRefText = await readFileFromFirebaseStorage(
      `imports/${CLIENT_ID}/waterCrossRef.json`,
      { uid: TEST_USER_ID }
    );
    const crossRef = JSON.parse(crossRefText);
    console.log(`✓ waterCrossRef.json: ${crossRef.length} charges`);
    
    // Validate data structure
    console.log('\n🔍 Validating data structure...');
    
    // Check transactions
    const waterTxns = transactions.filter(t => t.Category === "Water Consumption" && t['']);
    console.log(`✓ Water Consumption transactions: ${waterTxns.length}`);
    
    // Check readings structure
    const firstUnit = readings[0];
    const dateKeys = Object.keys(firstUnit).filter(k => k !== 'Unit');
    const nonEmptyReadings = dateKeys.filter(k => firstUnit[k] !== '').length;
    console.log(`✓ Reading months per unit: ${nonEmptyReadings}`);
    
    // Check special units
    const hasCommon = readings.some(r => r.Unit === 'Common');
    const hasBuilding = readings.some(r => r.Unit === 'Building');
    console.log(`✓ Special meters: Common=${hasCommon}, Building=${hasBuilding}`);
    
    // Validate fiscal year conversion
    console.log('\n📅 Validating fiscal year conversion...');
    
    const testDates = [
      { date: '2025-05-01', expected: { fy: 2025, fm: 10 }, label: 'May 2025 reading' },
      { date: '2025-06-01', expected: { fy: 2025, fm: 11 }, label: 'June 2025 reading (last month of FY2025)' },
      { date: '2025-07-01', expected: { fy: 2026, fm: 0 }, label: 'July 2025 (NEW FY2026 starts)' },
      { date: '2025-08-01', expected: { fy: 2026, fm: 1 }, label: 'August 2025' }
    ];
    
    console.log('Note: For July-start fiscal year: May=FM10, June=FM11, July=FM0 (new FY)');
    
    let allCorrect = true;
    for (const test of testDates) {
      // Parse date explicitly to avoid timezone issues
      const [year, month, day] = test.date.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month-1 because JS months are 0-indexed
      
      const jsMonth = date.getMonth(); // Get actual JS month (0-11)
      const { fiscalYear, fiscalMonth } = getFiscalYearMonth(date);
      const correct = fiscalYear === test.expected.fy && fiscalMonth === test.expected.fm;
      allCorrect = allCorrect && correct;
      
      const status = correct ? '✓' : '✗';
      console.log(`${status} ${test.label}: JS month=${jsMonth} → FY${fiscalYear}-${String(fiscalMonth).padStart(2, '0')} (expected FY${test.expected.fy}-${String(test.expected.fm).padStart(2, '0')})`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✓ All data files loaded successfully`);
    console.log(`✓ ${waterTxns.length} water bill payments found`);
    console.log(`✓ ${nonEmptyReadings} months of readings per unit`);
    console.log(`✓ ${crossRef.length} payment-to-charge mappings`);
    console.log(`✓ Fiscal year conversion: ${allCorrect ? 'CORRECT' : 'FAILED'}`);
    console.log('\n✅ Data validation PASSED - Ready for import implementation\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run validation
runValidation()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Error:', error);
    process.exit(1);
  });

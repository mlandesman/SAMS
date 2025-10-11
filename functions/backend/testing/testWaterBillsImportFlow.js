/**
 * Test Water Bills Import Flow
 * 
 * This test validates the complete water bills import process:
 * 1. Load data files from Firebase Storage
 * 2. Parse readings chronologically
 * 3. Simulate month-by-month processing
 * 4. Validate fiscal year conversions
 * 5. Test payment-to-charge mapping
 */

import { testHarness } from './testHarness.js';
import { readFileFromFirebaseStorage } from '../api/importStorage.js';

const CLIENT_ID = 'AVII';

/**
 * Parse date string from waterMeterReadings.json
 * "Thu May 01 2025 00:00:00 GMT-0500 (Eastern Standard Time)" → Date
 */
function parseDateString(dateStr) {
  return new Date(dateStr);
}

/**
 * Format date as YYYY-MM
 */
function formatMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get next month
 * "2025-05" → "2025-06"
 */
function getNextMonth(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + 1);
  return formatMonth(date);
}

/**
 * Convert calendar date to fiscal year/month
 * AVII fiscal year starts in July (month 7)
 */
function getFiscalYearMonth(calendarDate) {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth() + 1; // 1-12
  
  let fiscalYear, fiscalMonth;
  
  if (month >= 7) {
    // July-December: new fiscal year
    fiscalYear = year + 1;
    fiscalMonth = month - 7; // July=0, Aug=1, ..., Dec=5
  } else {
    // January-June: previous fiscal year
    fiscalYear = year;
    fiscalMonth = month + 5; // Jan=6, Feb=7, ..., Jun=11
  }
  
  return { fiscalYear, fiscalMonth };
}

/**
 * Extract unit ID from unit string
 */
function extractUnitId(unitString) {
  if (!unitString) return null;
  const match = unitString.match(/^(\d+)/);
  return match ? match[1] : unitString;
}

/**
 * Parse readings into chronological structure
 */
function parseReadingsChronologically(readingsData) {
  const readingsByMonth = {};
  
  // Get all unique dates from first unit
  const firstUnit = readingsData[0];
  const dateKeys = Object.keys(firstUnit).filter(key => key !== 'Unit');
  
  for (const dateKey of dateKeys) {
    const reading = firstUnit[dateKey];
    if (reading === '') continue; // Skip empty readings
    
    const date = parseDateString(dateKey);
    const monthStr = formatMonth(date);
    
    if (!readingsByMonth[monthStr]) {
      readingsByMonth[monthStr] = {
        date: date,
        readings: {}
      };
    }
    
    // Extract readings for all units for this month
    for (const unitData of readingsData) {
      const unitId = unitData.Unit;
      const reading = unitData[dateKey];
      
      if (reading !== '') {
        readingsByMonth[monthStr].readings[unitId] = reading;
      }
    }
  }
  
  return readingsByMonth;
}

/**
 * Group payments by month
 */
function groupPaymentsByMonth(waterCrossRef) {
  const paymentsByMonth = {};
  
  for (const charge of waterCrossRef) {
    const paymentDate = new Date(charge.PaymentDate);
    const monthStr = formatMonth(paymentDate);
    
    if (!paymentsByMonth[monthStr]) {
      paymentsByMonth[monthStr] = [];
    }
    
    paymentsByMonth[monthStr].push(charge);
  }
  
  return paymentsByMonth;
}

/**
 * Build chronology of reading → billing → payment cycles
 */
function buildChronology(readingsData, waterCrossRef) {
  const readingsByMonth = parseReadingsChronologically(readingsData);
  const paymentsByMonth = groupPaymentsByMonth(waterCrossRef);
  
  const chronology = [];
  const sortedMonths = Object.keys(readingsByMonth).sort();
  
  for (const readingMonth of sortedMonths) {
    const billingMonth = getNextMonth(readingMonth);
    const readingDate = readingsByMonth[readingMonth].date;
    const readings = readingsByMonth[readingMonth].readings;
    
    // Get fiscal year/month for billing
    const billingDate = new Date(billingMonth + '-01');
    const { fiscalYear, fiscalMonth } = getFiscalYearMonth(billingDate);
    
    // Get payments for billing month
    const payments = paymentsByMonth[billingMonth] || [];
    
    chronology.push({
      readingMonth,
      billingMonth,
      readingDate,
      fiscalYear,
      fiscalMonth,
      readings,
      paymentCount: payments.length,
      unitCount: Object.keys(readings).length
    });
  }
  
  return chronology;
}

/**
 * Test 1: Load and Parse Data Files
 */
async function testLoadDataFiles() {
  return await testHarness.runTest({
    name: 'Load Water Bills Data Files',
    async test({ api, userId }) {
      console.log('\n📥 Loading data files from Firebase Storage...\n');
      
      // Load Transactions.json
      const transactionsText = await readFileFromFirebaseStorage(
        `imports/${CLIENT_ID}/Transactions.json`,
        { uid: userId }
      );
      const transactionsData = JSON.parse(transactionsText);
      console.log(`✓ Transactions.json: ${transactionsData.length} records`);
      
      // Load waterMeterReadings.json
      const readingsText = await readFileFromFirebaseStorage(
        `imports/${CLIENT_ID}/waterMeterReadings.json`,
        { uid: userId }
      );
      const readingsData = JSON.parse(readingsText);
      console.log(`✓ waterMeterReadings.json: ${readingsData.length} units`);
      
      // Load waterCrossRef.json
      const crossRefText = await readFileFromFirebaseStorage(
        `imports/${CLIENT_ID}/waterCrossRef.json`,
        { uid: userId }
      );
      const waterCrossRef = JSON.parse(crossRefText);
      console.log(`✓ waterCrossRef.json: ${waterCrossRef.length} charges`);
      
      // Count water consumption transactions
      const waterTransactions = transactionsData.filter(
        t => t.Category === "Water Consumption" && t['']
      );
      console.log(`✓ Water Consumption transactions: ${waterTransactions.length}`);
      
      return {
        passed: true,
        data: {
          transactions: transactionsData.length,
          waterTransactions: waterTransactions.length,
          readingsUnits: readingsData.length,
          charges: waterCrossRef.length
        }
      };
    }
  });
}

/**
 * Test 2: Parse Readings Chronologically
 */
async function testParseReadings() {
  return await testHarness.runTest({
    name: 'Parse Readings Chronologically',
    async test({ api, userId }) {
      console.log('\n📊 Parsing readings chronologically...\n');
      
      const readingsText = await readFileFromFirebaseStorage(
        `imports/${CLIENT_ID}/waterMeterReadings.json`,
        { uid: userId }
      );
      const readingsData = JSON.parse(readingsText);
      
      const readingsByMonth = parseReadingsChronologically(readingsData);
      const months = Object.keys(readingsByMonth).sort();
      
      console.log(`Found ${months.length} months with readings:\n`);
      
      for (const month of months) {
        const data = readingsByMonth[month];
        const unitCount = Object.keys(data.readings).length;
        const hasSpecial = data.readings['Common'] || data.readings['Building'];
        
        console.log(`  ${month}: ${unitCount} units${hasSpecial ? ' (+ special meters)' : ''}`);
      }
      
      return {
        passed: months.length > 0,
        data: {
          monthCount: months.length,
          months: months,
          firstMonth: months[0],
          lastMonth: months[months.length - 1]
        }
      };
    }
  });
}

/**
 * Test 3: Validate Fiscal Year Conversion
 */
async function testFiscalYearConversion() {
  return await testHarness.runTest({
    name: 'Validate Fiscal Year Conversion',
    async test({ api, userId }) {
      console.log('\n📅 Testing fiscal year conversion...\n');
      
      const testCases = [
        { input: '2025-05', expectedFY: 2025, expectedFM: 10, label: 'May 2025 (reading)' },
        { input: '2025-06', expectedFY: 2025, expectedFM: 11, label: 'June 2025 (billing)' },
        { input: '2025-07', expectedFY: 2026, expectedFM: 0, label: 'July 2025 (new FY)' },
        { input: '2025-08', expectedFY: 2026, expectedFM: 1, label: 'August 2025' },
        { input: '2026-06', expectedFY: 2026, expectedFM: 11, label: 'June 2026 (end of FY)' }
      ];
      
      let allPassed = true;
      
      for (const testCase of testCases) {
        const date = new Date(testCase.input + '-01');
        const { fiscalYear, fiscalMonth } = getFiscalYearMonth(date);
        
        const passed = fiscalYear === testCase.expectedFY && fiscalMonth === testCase.expectedFM;
        allPassed = allPassed && passed;
        
        const status = passed ? '✅' : '❌';
        console.log(`${status} ${testCase.label}: ${testCase.input} → FY${fiscalYear}-${String(fiscalMonth).padStart(2, '0')}`);
        
        if (!passed) {
          console.log(`   Expected: FY${testCase.expectedFY}-${String(testCase.expectedFM).padStart(2, '0')}`);
        }
      }
      
      return {
        passed: allPassed,
        data: {
          testCases: testCases.length,
          allPassed
        }
      };
    }
  });
}

/**
 * Test 4: Build Import Chronology
 */
async function testBuildChronology() {
  return await testHarness.runTest({
    name: 'Build Import Chronology',
    async test({ api, userId }) {
      console.log('\n🔄 Building import chronology...\n');
      
      const readingsText = await readFileFromFirebaseStorage(
        `imports/${CLIENT_ID}/waterMeterReadings.json`,
        { uid: userId }
      );
      const readingsData = JSON.parse(readingsText);
      
      const crossRefText = await readFileFromFirebaseStorage(
        `imports/${CLIENT_ID}/waterCrossRef.json`,
        { uid: userId }
      );
      const waterCrossRef = JSON.parse(crossRefText);
      
      const chronology = buildChronology(readingsData, waterCrossRef);
      
      console.log(`Built chronology with ${chronology.length} cycles:\n`);
      console.log('Reading → Billing → Payments');
      console.log('─'.repeat(80));
      
      for (const cycle of chronology) {
        const fiscalLabel = `FY${cycle.fiscalYear}-${String(cycle.fiscalMonth).padStart(2, '0')}`;
        console.log(`${cycle.readingMonth} → ${cycle.billingMonth} (${fiscalLabel}): ${cycle.unitCount} units, ${cycle.paymentCount} payments`);
      }
      
      return {
        passed: chronology.length > 0,
        data: {
          cycleCount: chronology.length,
          cycles: chronology.map(c => ({
            reading: c.readingMonth,
            billing: c.billingMonth,
            fiscal: `${c.fiscalYear}-${c.fiscalMonth}`,
            units: c.unitCount,
            payments: c.paymentCount
          }))
        }
      };
    }
  });
}

/**
 * Test 5: Validate Payment Timing
 */
async function testPaymentTiming() {
  return await testHarness.runTest({
    name: 'Validate Payment Timing',
    async test({ api, userId }) {
      console.log('\n💰 Analyzing payment timing...\n');
      
      const crossRefText = await readFileFromFirebaseStorage(
        `imports/${CLIENT_ID}/waterCrossRef.json`,
        { uid: userId }
      );
      const waterCrossRef = JSON.parse(crossRefText);
      
      // Group by payment and analyze charge dates
      const paymentAnalysis = {};
      
      for (const charge of waterCrossRef) {
        const paySeq = charge.PaymentSeq;
        const paymentDate = new Date(charge.PaymentDate);
        const chargeDate = new Date(charge.ChargeDate);
        const paymentMonth = formatMonth(paymentDate);
        const chargeMonth = formatMonth(chargeDate);
        
        if (!paymentAnalysis[paySeq]) {
          paymentAnalysis[paySeq] = {
            paymentSeq: paySeq,
            paymentMonth: paymentMonth,
            chargeMonths: new Set(),
            totalAmount: 0,
            chargeCount: 0
          };
        }
        
        paymentAnalysis[paySeq].chargeMonths.add(chargeMonth);
        paymentAnalysis[paySeq].totalAmount += charge.AmountApplied;
        paymentAnalysis[paySeq].chargeCount++;
      }
      
      console.log('Payment Analysis:');
      console.log('─'.repeat(80));
      
      let crossMonthPayments = 0;
      
      for (const [paySeq, analysis] of Object.entries(paymentAnalysis)) {
        const chargeMonths = Array.from(analysis.chargeMonths).sort();
        const isCrossMonth = chargeMonths.length > 1;
        
        if (isCrossMonth) crossMonthPayments++;
        
        const label = isCrossMonth ? '🔀' : '  ';
        console.log(`${label} ${paySeq}`);
        console.log(`   Payment Month: ${analysis.paymentMonth}`);
        console.log(`   Charge Months: ${chargeMonths.join(', ')}`);
        console.log(`   Total: $${analysis.totalAmount.toFixed(2)} (${analysis.chargeCount} charges)`);
        console.log('');
      }
      
      console.log(`Cross-month payments: ${crossMonthPayments}/${Object.keys(paymentAnalysis).length}`);
      
      return {
        passed: true,
        data: {
          totalPayments: Object.keys(paymentAnalysis).length,
          crossMonthPayments
        }
      };
    }
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n🌊 Water Bills Import Flow Test Suite');
  console.log('='.repeat(80));
  console.log(`Client: ${CLIENT_ID}`);
  console.log('='.repeat(80));
  
  const tests = [
    testLoadDataFiles,
    testParseReadings,
    testFiscalYearConversion,
    testBuildChronology,
    testPaymentTiming
  ];
  
  const results = await testHarness.runTests(
    tests.map(fn => ({ name: fn.name, test: fn })),
    { stopOnFailure: true, showSummary: true }
  );
  
  return results;
}

// Run the test suite
runAllTests()
  .then(results => {
    console.log('\n✅ Test suite completed');
    process.exit(results.failed === 0 ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Test suite error:', error);
    process.exit(1);
  });

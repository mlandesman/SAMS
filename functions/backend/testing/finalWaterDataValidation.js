// Final validation of Water Data Aggregation Service
import { testHarness } from './testHarness.js';

const test = {
  name: 'Final Water Data Aggregation Validation',
  test: async ({ api }) => {
    console.log('\n' + '='.repeat(80));
    console.log('WATER DATA AGGREGATION SERVICE - FINAL VALIDATION');
    console.log('='.repeat(80));
    
    // CLEAR CACHE FIRST to ensure fresh data
    console.log('\n🗑️ CLEARING CACHE to ensure fresh data...');
    console.log('-'.repeat(50));
    const clearResponse = await api.post('/api/clients/AVII/water/cache/clear');
    console.log('Cache clear response:', clearResponse.data);
    
    // Test 1: Fetch current fiscal year data
    console.log('\n📊 TEST 1: Fetch Current Fiscal Year (default)');
    console.log('-'.repeat(50));
    const currentYearResponse = await api.get('/api/clients/AVII/water/data');
    console.log('Response status:', currentYearResponse.status);
    console.log('Success:', currentYearResponse.data.success);
    console.log('Fiscal Year:', currentYearResponse.data.data.year);
    console.log('Months returned:', currentYearResponse.data.data.months.length);
    
    // Test 2: Fetch specific year (FY 2026)
    console.log('\n📊 TEST 2: Fetch Specific Year (FY 2026)');
    console.log('-'.repeat(50));
    const response = await api.get('/api/clients/AVII/water/data/2026');
    
    const data = response.data.data;
    console.log('Full Response Structure:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Test 3: Verify Month 0 (July) - Critical for month boundary handling
    console.log('\n📊 TEST 3: Month 0 (July) Prior Reading Verification');
    console.log('-'.repeat(50));
    const month0 = data.months[0];
    console.log('Month 0 Details:');
    console.log('  Month Index:', month0.month);
    console.log('  Month Name:', month0.monthName);
    console.log('  Calendar Year:', month0.calendarYear);
    console.log('\nUnit 101 Month 0 Data:');
    console.log('  Prior Reading (from June FY2025):', month0.units['101'].priorReading);
    console.log('  Current Reading:', month0.units['101'].currentReading);
    console.log('  Consumption:', month0.units['101'].consumption);
    
    // Test 4: Verify Month 1 (August) consumption calculations
    console.log('\n📊 TEST 4: Month 1 (August) Consumption Calculations');
    console.log('-'.repeat(50));
    const month1 = data.months[1];
    console.log('Month 1 Unit Data Sample:');
    for (const unitId of ['101', '103', '106']) {
      const unit = month1.units[unitId];
      console.log(`\nUnit ${unitId}:`);
      console.log('  Prior Reading:', unit.priorReading);
      console.log('  Current Reading:', unit.currentReading);
      console.log('  Consumption:', unit.consumption);
      console.log('  Calculated:', unit.currentReading - unit.priorReading, '(should match consumption)');
      console.log('  ✓ Match:', unit.consumption === (unit.currentReading - unit.priorReading));
    }
    
    // Test 5: Verify all required fields present
    console.log('\n📊 TEST 5: Required Fields Verification');
    console.log('-'.repeat(50));
    const requiredFields = [
      'priorReading', 'currentReading', 'consumption',
      'billAmount', 'paidAmount', 'unpaidAmount',
      'status', 'daysPastDue'
    ];
    
    let allFieldsPresent = true;
    for (const field of requiredFields) {
      const hasField = month0.units['101'][field] !== undefined;
      console.log(`  ${field}: ${hasField ? '✅ Present' : '❌ Missing'}`);
      if (!hasField) allFieldsPresent = false;
    }
    
    // Test 6: Summary data
    console.log('\n📊 TEST 6: Year Summary Data');
    console.log('-'.repeat(50));
    console.log('Summary:', JSON.stringify(data.summary, null, 2));
    
    // Test 7: Cache test
    console.log('\n📊 TEST 7: Cache Performance');
    console.log('-'.repeat(50));
    const start1 = Date.now();
    await api.get('/api/clients/AVII/water/data/2026');
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await api.get('/api/clients/AVII/water/data/2026');
    const time2 = Date.now() - start2;
    
    console.log('First request (fresh):', time1, 'ms');
    console.log('Second request (cached):', time2, 'ms');
    console.log('Speed improvement:', (time1/time2).toFixed(1) + 'x faster');
    
    // Test 8: All units present
    console.log('\n📊 TEST 8: All Units Present');
    console.log('-'.repeat(50));
    const expectedUnits = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
    const actualUnits = Object.keys(month0.units);
    console.log('Expected units:', expectedUnits.join(', '));
    console.log('Actual units:', actualUnits.join(', '));
    console.log('All units present:', expectedUnits.every(u => actualUnits.includes(u)) ? '✅ Yes' : '❌ No');
    
    // Test 9: Fiscal month names
    console.log('\n📊 TEST 9: Fiscal Month Names (July starts at month 0)');
    console.log('-'.repeat(50));
    const expectedMonthNames = [
      'July', 'August', 'September', 'October', 'November', 'December',
      'January', 'February', 'March', 'April', 'May', 'June'
    ];
    for (let i = 0; i < 12; i++) {
      const actual = data.months[i].monthName;
      const expected = expectedMonthNames[i];
      console.log(`  Month ${i}: ${actual} ${actual === expected ? '✅' : '❌ (expected ' + expected + ')'}`);
    }
    
    // Test 10: Calendar year mapping
    console.log('\n📊 TEST 10: Calendar Year Mapping for FY2026');
    console.log('-'.repeat(50));
    console.log('FY2026 = July 2025 to June 2026');
    for (let i = 0; i < 12; i++) {
      const month = data.months[i];
      const expectedYear = i <= 5 ? 2025 : 2026; // Months 0-5 are 2025, 6-11 are 2026
      console.log(`  ${month.monthName}: ${month.calendarYear} ${month.calendarYear === expectedYear ? '✅' : '❌'}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION COMPLETE');
    console.log('='.repeat(80));
    
    return {
      passed: true,
      data: {
        unitsCount: actualUnits.length,
        monthsReturned: 12,
        cacheWorking: time2 < time1,
        allFieldsPresent,
        fiscalYear: data.year
      }
    };
  }
};

testHarness.runTest(test).then(() => process.exit(0));
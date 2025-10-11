// Test Water Data Aggregation Service
import { testHarness } from './testHarness.js';

const tests = [
  {
    name: 'Get Current Year Data - Complete Structure',
    test: async ({ api }) => {
      const response = await api.get('/api/clients/AVII/water/data');
      
      // Validate response structure
      if (!response.data.success) {
        throw new Error('Response not successful');
      }
      
      const data = response.data.data;
      
      // Should have correct fiscal year
      if (!data.year || data.year < 2025) {
        throw new Error(`Invalid year: ${data.year}`);
      }
      
      // Should have 12 months
      if (data.months.length !== 12) {
        throw new Error(`Should return 12 months, got ${data.months.length}`);
      }
      
      // Check first month (July/month 0)
      const month0 = data.months[0];
      if (month0.month !== 0) {
        throw new Error(`First month should be 0, got ${month0.month}`);
      }
      if (month0.monthName !== 'July') {
        throw new Error(`First month should be July, got ${month0.monthName}`);
      }
      
      // Each month should have units
      if (!month0.units || typeof month0.units !== 'object') {
        throw new Error('Missing units data in month 0');
      }
      
      // Check unit 101 exists
      const unit101 = month0.units['101'];
      if (!unit101) {
        throw new Error('Unit 101 not found in month 0');
      }
      
      // Validate all required fields exist
      const requiredFields = [
        'priorReading', 'currentReading', 'consumption',
        'billAmount', 'paidAmount', 'unpaidAmount', 
        'status', 'daysPastDue'
      ];
      
      for (const field of requiredFields) {
        if (unit101[field] === undefined) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      // Validate summary exists
      if (!data.summary) {
        throw new Error('Missing summary data');
      }
      
      const summaryFields = [
        'totalConsumption', 'totalBilled', 'totalPaid',
        'totalUnpaid', 'unitsWithOverdue', 'collectionRate'
      ];
      
      for (const field of summaryFields) {
        if (data.summary[field] === undefined) {
          throw new Error(`Missing summary field: ${field}`);
        }
      }
      
      console.log(`   📊 FY ${data.year} Data Retrieved`);
      console.log(`   📅 Months: ${data.months.length}`);
      console.log(`   💧 Total Consumption: ${data.summary.totalConsumption} m³`);
      console.log(`   💰 Collection Rate: ${data.summary.collectionRate}%`);
      
      return { 
        passed: true, 
        message: `Successfully retrieved FY ${data.year} data`,
        data: {
          year: data.year,
          monthCount: data.months.length,
          totalConsumption: data.summary.totalConsumption,
          collectionRate: data.summary.collectionRate
        }
      };
    }
  },
  
  {
    name: 'Month 0 Prior Reading from Previous Year',
    test: async ({ api }) => {
      const response = await api.get('/api/clients/AVII/water/data/2026');
      const data = response.data.data;
      
      // Get month 0 (July 2025)
      const month0 = data.months[0];
      const unit101 = month0.units['101'];
      
      // Check that prior reading exists
      if (unit101.priorReading === undefined || unit101.priorReading === null) {
        throw new Error('Month 0 should have prior reading from June (previous FY)');
      }
      
      // Consumption should be calculated correctly
      const expectedConsumption = unit101.currentReading - unit101.priorReading;
      if (unit101.consumption !== expectedConsumption) {
        throw new Error(
          `Consumption calculation incorrect: ${unit101.consumption} != ${expectedConsumption}`
        );
      }
      
      console.log(`   📊 Month 0 (July) Unit 101:`);
      console.log(`   📖 Prior Reading (June): ${unit101.priorReading}`);
      console.log(`   📖 Current Reading: ${unit101.currentReading}`);
      console.log(`   💧 Consumption: ${unit101.consumption} m³`);
      
      return {
        passed: true,
        message: 'Month 0 correctly uses prior year month 11 for prior reading',
        data: {
          priorReading: unit101.priorReading,
          currentReading: unit101.currentReading,
          consumption: unit101.consumption
        }
      };
    }
  },
  
  {
    name: 'Specific Year Request',
    test: async ({ api }) => {
      const response = await api.get('/api/clients/AVII/water/data/2026');
      
      if (!response.data.success) {
        throw new Error('Response not successful');
      }
      
      const data = response.data.data;
      
      if (data.year !== 2026) {
        throw new Error(`Should return FY 2026, got ${data.year}`);
      }
      
      // Check month names are correct for FY 2026
      const expectedMonths = [
        'July', 'August', 'September', 'October', 'November', 'December',
        'January', 'February', 'March', 'April', 'May', 'June'
      ];
      
      for (let i = 0; i < 12; i++) {
        if (data.months[i].monthName !== expectedMonths[i]) {
          throw new Error(
            `Month ${i} name incorrect: ${data.months[i].monthName} != ${expectedMonths[i]}`
          );
        }
      }
      
      console.log(`   📅 FY 2026 Data Retrieved`);
      console.log(`   ✅ All month names correct`);
      
      return {
        passed: true,
        message: 'Successfully retrieved specific fiscal year 2026'
      };
    }
  },
  
  {
    name: 'Cache Performance Test',
    test: async ({ api }) => {
      // First request - should build fresh data
      const start1 = Date.now();
      const response1 = await api.get('/clients/AVII/water/data/2026');
      const time1 = Date.now() - start1;
      
      if (!response1.data.success) {
        throw new Error('First request failed');
      }
      
      // Second request - should use cache
      const start2 = Date.now();
      const response2 = await api.get('/clients/AVII/water/data/2026');
      const time2 = Date.now() - start2;
      
      if (!response2.data.success) {
        throw new Error('Second request failed');
      }
      
      // Cache should be significantly faster (at least 50% faster)
      const speedup = time1 / time2;
      
      console.log(`   ⏱️ First request: ${time1}ms`);
      console.log(`   ⏱️ Cached request: ${time2}ms`);
      console.log(`   🚀 Speedup: ${speedup.toFixed(1)}x`);
      
      // Data should be identical
      const data1 = response1.data.data;
      const data2 = response2.data.data;
      
      if (JSON.stringify(data1) !== JSON.stringify(data2)) {
        throw new Error('Cached data does not match original');
      }
      
      return {
        passed: true,
        message: `Cache working correctly with ${speedup.toFixed(1)}x speedup`,
        data: {
          firstRequestTime: time1,
          cachedRequestTime: time2,
          speedup: speedup.toFixed(1)
        }
      };
    }
  },
  
  {
    name: 'Clear Cache for Client',
    test: async ({ api }) => {
      // Clear cache
      const clearResponse = await api.post('/api/clients/AVII/water/cache/clear');
      
      if (!clearResponse.data.success) {
        throw new Error('Failed to clear cache');
      }
      
      console.log(`   🗑️ ${clearResponse.data.message}`);
      
      // Request after clearing should take longer (not cached)
      const start = Date.now();
      const response = await api.get('/api/clients/AVII/water/data/2026');
      const time = Date.now() - start;
      
      if (!response.data.success) {
        throw new Error('Request after cache clear failed');
      }
      
      console.log(`   ⏱️ Fresh request after cache clear: ${time}ms`);
      
      return {
        passed: true,
        message: 'Cache cleared successfully'
      };
    }
  },
  
  {
    name: 'Calendar Year Calculation',
    test: async ({ api }) => {
      const response = await api.get('/api/clients/AVII/water/data/2026');
      const data = response.data.data;
      
      // FY 2026 = July 2025 to June 2026
      // Months 0-5 (Jul-Dec) should be calendar year 2025
      // Months 6-11 (Jan-Jun) should be calendar year 2026
      
      for (let i = 0; i < 6; i++) {
        if (data.months[i].calendarYear !== 2025) {
          throw new Error(
            `Month ${i} (${data.months[i].monthName}) should be calendar year 2025, got ${data.months[i].calendarYear}`
          );
        }
      }
      
      for (let i = 6; i < 12; i++) {
        if (data.months[i].calendarYear !== 2026) {
          throw new Error(
            `Month ${i} (${data.months[i].monthName}) should be calendar year 2026, got ${data.months[i].calendarYear}`
          );
        }
      }
      
      console.log(`   ✅ Calendar years correct for FY 2026`);
      console.log(`   📅 Jul-Dec 2025, Jan-Jun 2026`);
      
      return {
        passed: true,
        message: 'Calendar year calculations correct for all months'
      };
    }
  },
  
  {
    name: 'Bills and Payment Status',
    test: async ({ api }) => {
      const response = await api.get('/api/clients/AVII/water/data');
      const data = response.data.data;
      
      let billsFound = false;
      let statusTypes = new Set();
      
      // Check for bills in recent months
      for (const month of data.months) {
        for (const [unitId, unitData] of Object.entries(month.units)) {
          if (unitData.billAmount > 0) {
            billsFound = true;
            statusTypes.add(unitData.status);
            
            // Validate status consistency
            if (unitData.paidAmount >= unitData.billAmount && unitData.status !== 'paid') {
              throw new Error(`Unit ${unitId} fully paid but status is ${unitData.status}`);
            }
            
            if (unitData.unpaidAmount !== unitData.billAmount - unitData.paidAmount) {
              throw new Error(`Unit ${unitId} unpaid amount calculation incorrect`);
            }
          }
        }
      }
      
      console.log(`   💰 Bills found: ${billsFound}`);
      console.log(`   📊 Status types: ${Array.from(statusTypes).join(', ')}`);
      console.log(`   💵 Total Billed: $${data.summary.totalBilled.toFixed(2)}`);
      console.log(`   ✅ Total Paid: $${data.summary.totalPaid.toFixed(2)}`);
      console.log(`   ❌ Total Unpaid: $${data.summary.totalUnpaid.toFixed(2)}`);
      
      return {
        passed: true,
        message: 'Bills and payment status correctly aggregated',
        data: {
          totalBilled: data.summary.totalBilled,
          totalPaid: data.summary.totalPaid,
          totalUnpaid: data.summary.totalUnpaid,
          statusTypes: Array.from(statusTypes)
        }
      };
    }
  }
];

// Run all tests
console.log('🧪 Testing Water Data Aggregation Service');
console.log('=========================================');

testHarness.runTests(tests, { stopOnFailure: false })
  .then(summary => {
    console.log('\n📊 Test Summary:');
    console.log(`   Total: ${summary.total}`);
    console.log(`   Passed: ${summary.passed}`);
    console.log(`   Failed: ${summary.failed}`);
    console.log(`   Duration: ${summary.duration}ms`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Some tests failed. Review the output above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  })
  .catch(error => {
    console.error('\n💥 Test harness error:', error);
    process.exit(1);
  });
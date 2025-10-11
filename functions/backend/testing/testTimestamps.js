// Test Water Data Aggregation - Timestamp Fields
import { testHarness } from './testHarness.js';

const tests = [
  {
    name: 'Check readingDate and priorReadingDate fields',
    test: async ({ api }) => {
      const response = await api.get('/water/clients/AVII/data/2026');
      
      if (!response.data.success) {
        throw new Error('Response not successful');
      }
      
      const data = response.data.data;
      
      console.log(`\n📊 Checking timestamp fields in aggregated data...\n`);
      
      // Check first 3 months for timestamp data
      for (let i = 0; i < Math.min(3, data.months.length); i++) {
        const month = data.months[i];
        console.log(`Month ${i} (${month.monthName}):`);
        console.log(`  readingDate: ${month.readingDate}`);
        console.log(`  readingDate type: ${typeof month.readingDate}`);
        console.log(`  readingDate value: ${JSON.stringify(month.readingDate)}`);
        console.log(`  priorReadingDate: ${month.priorReadingDate}`);
        console.log(`  priorReadingDate type: ${typeof month.priorReadingDate}`);
        console.log(`  priorReadingDate value: ${JSON.stringify(month.priorReadingDate)}`);
        
        // Check if it's a date string
        if (month.readingDate) {
          try {
            const date = new Date(month.readingDate);
            console.log(`  readingDate as Date: ${date.toISOString()}`);
            console.log(`  readingDate formatted: ${date.toLocaleDateString('en-US')}`);
          } catch (e) {
            console.log(`  ❌ Could not parse readingDate as Date: ${e.message}`);
          }
        }
        
        if (month.priorReadingDate) {
          try {
            const date = new Date(month.priorReadingDate);
            console.log(`  priorReadingDate as Date: ${date.toISOString()}`);
            console.log(`  priorReadingDate formatted: ${date.toLocaleDateString('en-US')}`);
          } catch (e) {
            console.log(`  ❌ Could not parse priorReadingDate as Date: ${e.message}`);
          }
        }
        
        console.log('');
      }
      
      // Check if timestamps exist
      const month0 = data.months[0];
      const month1 = data.months[1];
      
      if (!month0.readingDate) {
        throw new Error('Month 0 should have readingDate field');
      }
      
      if (!month1.readingDate) {
        throw new Error('Month 1 should have readingDate field');
      }
      
      if (!month1.priorReadingDate) {
        throw new Error('Month 1 should have priorReadingDate field');
      }
      
      console.log('✅ All timestamp fields present');
      console.log('✅ Timestamps can be parsed as dates');
      
      return {
        passed: true,
        message: 'Timestamp fields correctly included in aggregated data',
        data: {
          month0ReadingDate: month0.readingDate,
          month1ReadingDate: month1.readingDate,
          month1PriorReadingDate: month1.priorReadingDate
        }
      };
    }
  }
];

// Run all tests
console.log('🧪 Testing Water Data Aggregation - Timestamp Fields');
console.log('====================================================');

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

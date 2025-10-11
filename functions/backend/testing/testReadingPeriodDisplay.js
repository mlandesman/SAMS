// Test script to verify reading period display data structure
// This helps confirm backend is sending correct data format

import waterDataService from '../services/waterDataService.js';
import { DateService } from '../services/DateService.js';

async function testReadingPeriodDisplay() {
  const dateService = new DateService({ timezone: 'America/Cancun' });
  
  console.log('\n=== Testing Reading Period Display ===\n');
  
  try {
    // Test client ID - you may need to adjust this
    const clientId = 'AVII';
    const year = 2025;
    
    console.log(`Testing for client: ${clientId}, FY: ${year}\n`);
    
    // Get aggregated water data
    const yearData = await waterDataService.getYearData(clientId, year);
    
    // Check each month that has data
    for (const monthData of yearData.months || []) {
      if (monthData.readingPeriod) {
        console.log(`Month ${monthData.month + 1} (${monthData.monthName}):`);
        console.log(`  Reading Period Display: "${monthData.readingPeriod.display}"`);
        
        if (monthData.readingPeriod.start && monthData.readingPeriod.end) {
          console.log(`  Start: ${monthData.readingPeriod.start.display} (${monthData.readingPeriod.start.timestamp})`);
          console.log(`  End: ${monthData.readingPeriod.end.display} (${monthData.readingPeriod.end.timestamp})`);
        }
        console.log('');
      }
    }
    
    // Test specific month (current or recent)
    const testMonth = 2; // September (0-indexed)
    const monthData = yearData.months?.find(m => m.month === testMonth);
    
    if (monthData) {
      console.log(`\nDetailed check for Month ${testMonth + 1}:`);
      console.log('Full monthData.readingPeriod:', JSON.stringify(monthData.readingPeriod, null, 2));
      
      if (!monthData.readingPeriod) {
        console.log('⚠️  No readingPeriod data found - this is the issue!');
      } else if (!monthData.readingPeriod.display) {
        console.log('⚠️  readingPeriod exists but missing display property!');
      } else {
        console.log('✅ readingPeriod.display is present:', monthData.readingPeriod.display);
      }
    }
    
  } catch (error) {
    console.error('Error testing reading period display:', error);
  }
  
  process.exit(0);
}

testReadingPeriodDisplay();
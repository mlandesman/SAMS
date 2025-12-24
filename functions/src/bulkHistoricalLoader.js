import { admin } from '../backend/firebase.js';
import { populateHistoricalRates } from './exchangeRatesUpdater.js';

/**
 * Load 2 years of historical exchange rate data in quarters
 * This function splits the data loading into manageable chunks to avoid timeouts
 */
async function loadTwoYearsHistoricalData() {
  console.log('🚀 Starting 2-year historical data load...');
  
  const today = new Date();
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  // Define quarters for the past 2 years
  const quarters = [];
  const currentQuarter = new Date(twoYearsAgo);
  
  while (currentQuarter < today) {
    const quarterStart = new Date(currentQuarter);
    const quarterEnd = new Date(currentQuarter);
    quarterEnd.setMonth(quarterEnd.getMonth() + 3);
    
    // Don't go beyond today
    if (quarterEnd > today) {
      quarterEnd.setTime(today.getTime());
    }
    
    quarters.push({
      start: quarterStart.toISOString().split('T')[0],
      end: quarterEnd.toISOString().split('T')[0],
      name: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`
    });
    
    currentQuarter.setMonth(currentQuarter.getMonth() + 3);
  }
  
  console.log(`📅 Will load data for ${quarters.length} quarters:`);
  quarters.forEach(q => console.log(`  - ${q.name}: ${q.start} to ${q.end}`));
  
  const results = {
    totalDatesProcessed: 0,
    quarters: [],
    errors: []
  };
  
  // Process each quarter
  for (const quarter of quarters) {
    console.log(`\n📊 Processing ${quarter.name}...`);
    
    try {
      const quarterResult = await populateHistoricalRates(
        quarter.start,
        quarter.end,
        false // not a dry run
      );
      
      results.quarters.push({
        name: quarter.name,
        ...quarterResult
      });
      
      results.totalDatesProcessed += quarterResult.datesProcessed || 0;
      
      console.log(`✅ ${quarter.name} completed: ${quarterResult.datesProcessed} dates processed`);
      
      // Small delay between quarters to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Failed to process ${quarter.name}:`, error.message);
      results.errors.push({
        quarter: quarter.name,
        error: error.message
      });
    }
  }
  
  // Summary
  console.log('\n📈 Historical Data Load Summary:');
  console.log('================================');
  console.log(`Total dates processed: ${results.totalDatesProcessed}`);
  console.log(`Quarters completed: ${results.quarters.length}/${quarters.length}`);
  if (results.errors.length > 0) {
    console.log(`Errors encountered: ${results.errors.length}`);
    results.errors.forEach(e => console.log(`  - ${e.quarter}: ${e.error}`));
  }
  
  return results;
}

/**
 * Load historical data for a specific year
 * @param {number} year - The year to load data for
 */
async function loadHistoricalDataForYear(year) {
  console.log(`📅 Loading historical data for year ${year}...`);
  
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const today = new Date().toISOString().split('T')[0];
  
  // Don't go beyond today
  const actualEndDate = endDate > today ? today : endDate;
  
  try {
    const result = await populateHistoricalRates(startDate, actualEndDate, false);
    console.log(`✅ Year ${year} completed: ${result.datesProcessed} dates processed`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to load data for year ${year}:`, error.message);
    throw error;
  }
}

export {
  loadTwoYearsHistoricalData,
  loadHistoricalDataForYear
};
/**
 * REBUILD: aggregatedData to fix displayTotalDue mismatch
 */

import { waterDataService } from '../backend/services/waterDataService.js';

const CLIENT_ID = 'AVII';
const YEAR = 2026;

async function rebuildAggregatedData() {
  console.log(`\n🔄 REBUILDING aggregatedData for ${CLIENT_ID} FY${YEAR}`);
  console.log('='.repeat(60));
  
  try {
    console.log('🔄 Calling waterDataService.buildYearData...');
    const result = await waterDataService.buildYearData(CLIENT_ID, YEAR);
    
    console.log('✅ Rebuild completed successfully!');
    console.log('Result:', result);
    
  } catch (error) {
    console.error(`❌ Error rebuilding aggregatedData:`, error.message);
    console.error(error.stack);
  }
}

rebuildAggregatedData();

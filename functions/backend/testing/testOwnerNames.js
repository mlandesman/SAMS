import { waterDataService } from '../services/waterDataService.js';

async function testOwnerNames() {
  console.log('Testing owner names in aggregation...');
  
  // Clear cache to get fresh data
  waterDataService.clearCache();
  
  // Fetch aggregated data
  const data = await waterDataService.getYearData('AVII', 2026);
  
  // Check first month's units
  const july = data.months[0];
  
  console.log('\nUnit Owner Names:');
  for (const [unitId, unitData] of Object.entries(july.units)) {
    console.log(`Unit ${unitId}: ${unitData.ownerLastName || '❌ MISSING'}`);
  }
  
  // Verify all units have owner names
  const missingOwners = Object.entries(july.units)
    .filter(([id, data]) => !data.ownerLastName)
    .map(([id]) => id);
  
  if (missingOwners.length > 0) {
    console.error('❌ Units missing owner names:', missingOwners);
  } else {
    console.log('✅ All units have owner names!');
  }
}

testOwnerNames().catch(console.error);
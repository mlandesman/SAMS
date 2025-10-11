// Quick check of units endpoint
import { testHarness } from './testHarness.js';

const test = {
  name: 'Check AVII Units',
  test: async ({ api }) => {
    // Check units endpoint
    const response = await api.get('/api/clients/AVII/units');
    
    console.log('Units response status:', response.status);
    console.log('Units found:', response.data?.units?.length || 0);
    
    if (response.data?.units?.length > 0) {
      console.log('First 3 units:');
      response.data.units.slice(0, 3).forEach(unit => {
        console.log(`  - Unit ${unit.unitId}: ${unit.address || 'No address'}`);
      });
    }
    
    return { passed: true, data: { unitCount: response.data?.units?.length || 0 } };
  }
};

testHarness.runTest(test).then(() => process.exit(0));
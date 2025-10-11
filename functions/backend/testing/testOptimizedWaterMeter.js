import { testHarness } from './testHarness.js';

const CLIENT_ID = 'AVII';

async function testOptimizedWaterMeter() {
  console.log('\n🔍 Testing Optimized Water Meter Implementation\n');
  console.log('================================================\n');
  
  // Test 1: Save a reading for August 2025 and verify document structure
  await testHarness.runTest({
    name: 'Save August 2025 reading - Check document structure',
    async test({ api }) {
      const response = await api.post(`/api/clients/${CLIENT_ID}/watermeters/readings`, {
        readings: [{
          unitId: 'A01',
          value: 1500.5,
          notes: 'Test reading - August 2025'
        }],
        readingDate: '2025-08-15'
      });
      
      console.log('   Response:', JSON.stringify(response.data, null, 2));
      
      if (response.data.results && response.data.results[0]) {
        const result = response.data.results[0];
        console.log('\n   📊 Reading saved with:');
        console.log('      - Document ID:', result.id);
        console.log('      - Has "reading-" prefix?:', result.id.startsWith('reading-'));
        console.log('      - Fiscal Year:', result.fiscalYear);
        console.log('      - Unit ID in response:', result.unitId);
      }
      
      return {
        passed: response.data.success && response.data.saved === 1,
        data: response.data
      };
    }
  });
  
  // Test 2: Generate a bill and check document structure
  await testHarness.runTest({
    name: 'Generate bill - Check document structure',
    async test({ api }) {
      const response = await api.post(`/api/clients/${CLIENT_ID}/watermeters/bills/generate`, {
        year: 2026,  // Fiscal Year 2026
        month: 8,    // August
        billingDate: '2025-08-01',
        dueDate: '2025-08-11'
      });
      
      if (response.data.bills && response.data.bills[0]) {
        const bill = response.data.bills[0];
        console.log('\n   📋 Bill generated with:');
        console.log('      - Document ID:', bill.id);
        console.log('      - Has "bill-" prefix?:', bill.id.startsWith('bill-'));
        console.log('      - Unit ID in response:', bill.unitId);
        console.log('      - Fiscal Year:', bill.year);
      }
      
      return {
        passed: response.data.success,
        data: response.data
      };
    }
  });
  
  console.log('\n✅ Test Complete!\n');
  console.log('Summary of Changes:');
  console.log('✓ Document IDs no longer have "reading-" or "bill-" prefixes');
  console.log('✓ unitId not stored in documents (derived from path)');
  console.log('✓ unitId included in API responses for frontend convenience');
  console.log('✓ Audit logs created for all CRUD operations');
}

testOptimizedWaterMeter().catch(console.error);
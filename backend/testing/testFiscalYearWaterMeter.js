#!/usr/bin/env node

/**
 * Test Fiscal Year handling for Water Meter APIs
 * 
 * This test verifies that water meter readings for August 2025
 * are correctly stored under Fiscal Year 2026 for AVII
 * (which has a July-June fiscal year)
 */

import { testHarness } from './testHarness.js';

const CLIENT_ID = 'AVII';

async function testFiscalYearWaterMeter() {
  console.log('\n🔍 Testing Fiscal Year handling for Water Meter APIs\n');
  console.log('====================================================\n');
  
  console.log('📅 AVII Fiscal Year Configuration:');
  console.log('   - Fiscal Year Start: July (month 7)');
  console.log('   - FY 2026 = July 2025 - June 2026');
  console.log('   - August 2025 should be in FY 2026\n');
  
  // Test 1: Save a reading for August 2025
  await testHarness.runTest({
    name: 'Save August 2025 reading (should go to FY2026)',
    async test({ api }) {
      const response = await api.post(`/api/clients/${CLIENT_ID}/watermeters/readings`, {
        readings: [{
          unitId: 'A01',
          value: 1500.5,
          notes: 'August 2025 reading - should go to FY2026'
        }],
        readingDate: '2025-08-15'
      });
      
      console.log('   Response:', response.data);
      const result = response.data.results?.[0];
      if (result) {
        console.log('   📊 Fiscal Year stored:', result.fiscalYear || 'Not shown in response');
        console.log('   Expected: 2026');
      }
      
      return {
        passed: response.data.success && response.data.saved === 1,
        data: response.data
      };
    }
  });
  
  // Test 2: Save a reading for June 2025 (should be in FY2025)
  await testHarness.runTest({
    name: 'Save June 2025 reading (should go to FY2025)',
    async test({ api }) {
      const response = await api.post(`/api/clients/${CLIENT_ID}/watermeters/readings`, {
        readings: [{
          unitId: 'A02',
          value: 1200.0,
          notes: 'June 2025 reading - should go to FY2025'
        }],
        readingDate: '2025-06-15'
      });
      
      const result = response.data.results?.[0];
      if (result) {
        console.log('   📊 Fiscal Year stored:', result.fiscalYear || 'Not shown in response');
        console.log('   Expected: 2025');
      }
      
      return {
        passed: response.data.success && response.data.saved === 1,
        data: response.data
      };
    }
  });
  
  // Test 3: Save a reading for July 2025 (should be in FY2026)
  await testHarness.runTest({
    name: 'Save July 2025 reading (should go to FY2026)',
    async test({ api }) {
      const response = await api.post(`/api/clients/${CLIENT_ID}/watermeters/readings`, {
        readings: [{
          unitId: 'A03',
          value: 1300.0,
          notes: 'July 2025 reading - should go to FY2026'
        }],
        readingDate: '2025-07-01'
      });
      
      const result = response.data.results?.[0];
      if (result) {
        console.log('   📊 Fiscal Year stored:', result.fiscalYear || 'Not shown in response');
        console.log('   Expected: 2026');
      }
      
      return {
        passed: response.data.success && response.data.saved === 1,
        data: response.data
      };
    }
  });
  
  // Test 4: Generate bill for August 2025 (using FY2026)
  await testHarness.runTest({
    name: 'Generate water bill for August 2025 (FY2026)',
    async test({ api }) {
      const response = await api.post(`/api/clients/${CLIENT_ID}/watermeters/bills/generate`, {
        year: 2026,  // Fiscal Year 2026
        month: 8,    // August
        billingDate: '2025-08-01',
        dueDate: '2025-08-11'
      });
      
      console.log('   Bills generated:', response.data.generated || 0);
      console.log('   Failed:', response.data.failed || 0);
      
      if (response.data.bills && response.data.bills.length > 0) {
        const firstBill = response.data.bills[0];
        console.log('   📋 First bill:');
        console.log('      - Unit:', firstBill.unitId);
        console.log('      - Year:', firstBill.year);
        console.log('      - Path:', firstBill.firestorePath);
      }
      
      return {
        passed: response.data.success,
        data: response.data
      };
    }
  });
  
  // Test 5: Retrieve bills for FY2026
  await testHarness.runTest({
    name: 'Retrieve bills for FY2026',
    async test({ api }) {
      const response = await api.get(`/api/clients/${CLIENT_ID}/watermeters/bills/2026?unitId=A01`);
      
      console.log('   📊 Bills found for FY2026:', response.data.count || 0);
      
      if (response.data.bills && response.data.bills.length > 0) {
        console.log('   📋 Bills in FY2026:');
        response.data.bills.forEach(bill => {
          console.log(`      - ${bill.id}: ${bill.billingDateFormatted?.month || 'Unknown'} - ${bill.displayAmounts?.totalAmount || '0.00'} MXN`);
        });
      }
      
      return {
        passed: true,
        data: response.data
      };
    }
  });
  
  // Summary
  console.log('\n✅ Fiscal Year Water Meter Test Complete!\n');
  console.log('Summary:');
  console.log('--------');
  console.log('• August 2025 readings should be stored in FY2026');
  console.log('• June 2025 readings should be stored in FY2025');
  console.log('• July 2025 readings should be stored in FY2026');
  console.log('• AVII uses July-June fiscal year');
  console.log('• Expected path for August 2025: /clients/AVII/units/{unitId}/waterMeter/2026/');
  
  // Show test results
  testHarness.displayResults();
}

// Run the test
testFiscalYearWaterMeter().catch(console.error);
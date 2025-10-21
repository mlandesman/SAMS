import { createApiClient } from './backend/testing/testHarness.js';

/**
 * Test Bills Tab Fix - Verify readings preview shows up before bills are generated
 */

async function testBillsTabFix() {
  console.log('🔍 Testing Bills Tab Fix - Readings Preview Before Bill Generation');
  console.log('==================================================================\n');
  
  try {
    // Create API client with authentication
    const apiClient = await createApiClient();
    
    // Test with AVII client, year 2026
    const clientId = 'AVII';
    const year = 2026;
    
    console.log(`📊 Fetching year data for ${clientId} FY${year}`);
    console.log(`   Endpoint: GET /water/clients/${clientId}/bills/${year}\n`);
    
    const response = await apiClient.get(`/water/clients/${clientId}/bills/${year}`);
    
    if (!response || !response.data) {
      console.error('❌ API call failed:', response?.error || 'No response');
      return;
    }
    
    const data = response.data;
    console.log(`✅ API call successful`);
    console.log(`📦 Received data with ${data.months.length} months\n`);
    
    // Analyze each month
    console.log('📋 Month-by-Month Analysis:');
    console.log('─'.repeat(80));
    
    for (let i = 0; i < data.months.length; i++) {
      const month = data.months[i];
      const fiscalMonthName = month.fiscalMonthName;
      const unitCount = Object.keys(month.units || {}).length;
      
      // Check if month has bills or just readings
      let hasBills = false;
      let hasReadings = false;
      let statusCounts = { nobill: 0, paid: 0, unpaid: 0, partial: 0 };
      
      for (const [unitId, unitData] of Object.entries(month.units || {})) {
        if (unitData.status) {
          statusCounts[unitData.status]++;
          if (unitData.status !== 'nobill') {
            hasBills = true;
          }
        }
        if (unitData.currentReading && unitData.currentReading.reading !== undefined) {
          hasReadings = true;
        }
      }
      
      const dataType = hasBills ? '📄 BILLS' : (hasReadings ? '📊 READINGS' : '❓ EMPTY');
      
      console.log(`Month ${i} (${fiscalMonthName}): ${dataType} - ${unitCount} units`);
      
      if (hasBills) {
        console.log(`   Status breakdown: paid=${statusCounts.paid}, unpaid=${statusCounts.unpaid}, partial=${statusCounts.partial}, nobill=${statusCounts.nobill}`);
      } else if (hasReadings) {
        console.log(`   ✨ READINGS PREVIEW - This is what users need to see before generating bills!`);
      }
    }
    
    console.log('─'.repeat(80));
    console.log('');
    
    // Summary
    const billMonths = data.months.filter(m => {
      return Object.values(m.units || {}).some(u => u.status && u.status !== 'nobill');
    }).length;
    
    const readingMonths = data.months.filter(m => {
      return Object.values(m.units || {}).some(u => u.currentReading && u.currentReading.reading !== undefined);
    }).length;
    
    console.log('📊 SUMMARY:');
    console.log(`   Total months returned: ${data.months.length}`);
    console.log(`   Months with bills: ${billMonths}`);
    console.log(`   Months with readings: ${readingMonths}`);
    console.log('');
    
    if (readingMonths > billMonths) {
      console.log('✅ SUCCESS! Backend is now returning readings data for months without bills.');
      console.log('   Users can now preview what bills will look like BEFORE generating them.');
      console.log('   This fixes the critical safety issue where users were blind before bill generation.');
    } else if (readingMonths === billMonths) {
      console.log('⚠️  WARNING: All readings months also have bills.');
      console.log('   This test needs to be run with a month that has readings but NO bills yet.');
    } else {
      console.log('❌ ISSUE: Fewer reading months than bill months - this should not happen.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testBillsTabFix().catch(console.error);


import { createApiClient } from './backend/testing/testHarness.js';

async function testSimple() {
  try {
    const apiClient = await createApiClient();
    const response = await apiClient.get(`/water/clients/AVII/bills/2026`);
    
    // API client returns the data directly
    const data = response?.data || response;
    
    if (!data || !data.months) {
      console.log('FAIL: No valid data returned');
      console.log('Response:', response);
      return;
    }
    console.log(`\n✅ SUCCESS: Received ${data.months.length} months of data\n`);
    
    // Count months with bills vs readings
    let billMonths = 0;
    let readingMonths = 0;
    
    for (const month of data.months) {
      const hasBills = month.billsGenerated === true;
      const hasReadings = Object.values(month.units || {}).some(u => 
        u.currentReading && u.currentReading.reading !== undefined && u.currentReading.reading > 0
      );
      
      if (hasBills) billMonths++;
      if (hasReadings) readingMonths++;
      
      const monthType = hasBills ? 'BILLS' : (hasReadings ? 'READINGS' : 'EMPTY');
      console.log(`Month ${month.month} (${month.monthName}): ${monthType}`);
    }
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total months: ${data.months.length}`);
    console.log(`   Months with bills: ${billMonths}`);
    console.log(`   Months with readings: ${readingMonths}`);
    
    if (readingMonths > billMonths) {
      console.log(`\n✅ FIX VERIFIED! Backend now returns ${readingMonths - billMonths} months with readings but no bills.`);
      console.log(`   Users can now preview bills BEFORE generating them!`);
    } else {
      console.log(`\n⚠️  No months with readings-only found. All readings months also have bills.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimple();


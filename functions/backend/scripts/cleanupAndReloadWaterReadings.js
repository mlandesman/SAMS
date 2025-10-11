import { testHarness } from '../testing/testHarness.js';
import { WaterMeterService } from '../services/waterMeterService.js';
import admin from 'firebase-admin';
import fs from 'fs';
import csv from 'csv-parser';

async function cleanupAndReloadWaterReadings() {
  console.log('🧹 Cleaning up and reloading water meter readings for AVII\n');
  
  const service = new WaterMeterService();
  await service.loadConfig('AVII');
  
  const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
  const db = admin.firestore();
  
  // Step 1: Purge all existing water meter readings
  console.log('🗑️  Step 1: Purging all existing water meter readings...\n');
  
  for (const unitId of units) {
    console.log(`Purging unit ${unitId}...`);
    
    // Delete FY2025 readings
    try {
      const fy2025Path = `clients/AVII/units/${unitId}/waterMeter/2025/readings`;
      const fy2025Snapshot = await db.collection(fy2025Path).get();
      const fy2025Batch = db.batch();
      fy2025Snapshot.docs.forEach(doc => fy2025Batch.delete(doc.ref));
      if (!fy2025Snapshot.empty) {
        await fy2025Batch.commit();
        console.log(`  ✅ Deleted ${fy2025Snapshot.size} FY2025 readings`);
      }
    } catch (error) {
      console.log(`  ⚠️  FY2025 cleanup error: ${error.message}`);
    }
    
    // Delete FY2026 readings
    try {
      const fy2026Path = `clients/AVII/units/${unitId}/waterMeter/2026/readings`;
      const fy2026Snapshot = await db.collection(fy2026Path).get();
      const fy2026Batch = db.batch();
      fy2026Snapshot.docs.forEach(doc => fy2026Batch.delete(doc.ref));
      if (!fy2026Snapshot.empty) {
        await fy2026Batch.commit();
        console.log(`  ✅ Deleted ${fy2026Snapshot.size} FY2026 readings`);
      }
    } catch (error) {
      console.log(`  ⚠️  FY2026 cleanup error: ${error.message}`);
    }
  }
  
  console.log('\n✨ All existing readings purged!\n');
  
  // Step 2: Load CSV data
  console.log('📊 Step 2: Loading CSV data...\n');
  
  const csvPath = '/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/Property Management/Aventuras Villas II/Water Bills/SAMS/water-meters-initial.csv';
  
  const csvData = [];
  
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const unit = row['Unit'];
        const may28 = parseInt(row['4/28/25'].replace(/,/g, '')); // May 28
        const june28 = parseInt(row['5/28/25'].replace(/,/g, '')); // June 28  
        const july28 = parseInt(row['6/28/25'].replace(/,/g, '')); // July 28
        
        csvData.push({
          unitId: unit,
          may28,
          june28,
          july28
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });
  
  console.log(`✅ Loaded data for ${csvData.length} units from CSV\n`);
  
  // Step 3: Store May 28 readings in FY2025 (year-end baseline)
  console.log('📝 Step 3: Storing May 28 baseline readings in FY2025...\n');
  
  const may28Readings = csvData.map(data => ({
    unitId: data.unitId,
    value: data.may28,
    notes: 'May 2025 year-end baseline reading (FY2025 final)'
  }));
  
  await testHarness.runTest({
    name: 'Store May 28 baseline readings in FY2025',
    testUser: 'fjXv8gX1CYWBvOZ1CS27j96oRCT2',
    async test({ api }) {
      const response = await api.request({
        method: 'POST',
        url: '/api/clients/AVII/watermeters/readings',
        data: {
          clientId: 'AVII',
          readings: may28Readings,
          readingDate: '2025-05-28'
        },
        validateStatus: () => true
      });
      
      console.log(`May 28 baseline: Status ${response.status}`);
      if (response.status === 200 || response.status === 201) {
        console.log(`✅ Successfully stored ${may28Readings.length} baseline readings in FY2025`);
        return { passed: true };
      } else {
        console.log(`❌ Failed: ${JSON.stringify(response.data)}`);
        return { passed: false };
      }
    }
  });
  
  // Step 4: Calculate and store July billing consumption (June 28 - May 28) in FY2026
  console.log('\n📊 Step 4: Calculating July billing consumption and storing in FY2026...\n');
  
  const julyBillingData = csvData.map(data => {
    const consumption = data.june28 - data.may28;
    return {
      unitId: data.unitId,
      consumption,
      currentReading: data.june28,
      previousReading: data.may28,
      notes: `July 2025 billing: ${consumption} gallons (${data.june28} - ${data.may28})`
    };
  });
  
  console.log('July billing consumption calculations:');
  julyBillingData.forEach(data => {
    console.log(`  Unit ${data.unitId}: ${data.consumption} gallons`);
  });
  
  // For now, we'll store the June 28 reading in FY2026 with proper consumption notes
  const julyReadings = csvData.map(data => ({
    unitId: data.unitId,
    value: data.june28,
    notes: `June 28 reading for July 2025 billing (consumption: ${data.june28 - data.may28} gallons)`
  }));
  
  await testHarness.runTest({
    name: 'Store June 28 readings for July billing in FY2026',
    testUser: 'fjXv8gX1CYWBvOZ1CS27j96oRCT2',
    async test({ api }) {
      const response = await api.request({
        method: 'POST',
        url: '/api/clients/AVII/watermeters/readings',
        data: {
          clientId: 'AVII',
          readings: julyReadings,
          readingDate: '2025-06-28'
        },
        validateStatus: () => true
      });
      
      console.log(`June 28 for July billing: Status ${response.status}`);
      if (response.status === 200 || response.status === 201) {
        console.log(`✅ Successfully stored ${julyReadings.length} readings for July billing in FY2026`);
        return { passed: true };
      } else {
        console.log(`❌ Failed: ${JSON.stringify(response.data)}`);
        return { passed: false };
      }
    }
  });
  
  // Step 5: Calculate and store August billing consumption (July 28 - June 28) in FY2026
  console.log('\n📊 Step 5: Storing July 28 readings for August billing in FY2026...\n');
  
  const augustReadings = csvData.map(data => ({
    unitId: data.unitId,
    value: data.july28,
    notes: `July 28 reading for August 2025 billing (consumption: ${data.july28 - data.june28} gallons)`
  }));
  
  await testHarness.runTest({
    name: 'Store July 28 readings for August billing in FY2026',
    testUser: 'fjXv8gX1CYWBvOZ1CS27j96oRCT2',
    async test({ api }) {
      const response = await api.request({
        method: 'POST',
        url: '/api/clients/AVII/watermeters/readings',
        data: {
          clientId: 'AVII',
          readings: augustReadings,
          readingDate: '2025-07-28'
        },
        validateStatus: () => true
      });
      
      console.log(`July 28 for August billing: Status ${response.status}`);
      if (response.status === 200 || response.status === 201) {
        console.log(`✅ Successfully stored ${augustReadings.length} readings for August billing in FY2026`);
        return { passed: true };
      } else {
        console.log(`❌ Failed: ${JSON.stringify(response.data)}`);
        return { passed: false };
      }
    }
  });
  
  console.log('\n🎉 Cleanup and reload complete!\n');
  console.log('📋 Summary:');
  console.log(`  • Purged all existing readings for ${units.length} units`);
  console.log('  • May 28 baseline readings stored in FY2025');
  console.log('  • June 28 readings stored in FY2026 for July billing');
  console.log('  • July 28 readings stored in FY2026 for August billing');
  console.log('\n🏗️  Ready for common area meter configuration and bill generation!');
}

// Run the cleanup and reload
cleanupAndReloadWaterReadings().catch(console.error);
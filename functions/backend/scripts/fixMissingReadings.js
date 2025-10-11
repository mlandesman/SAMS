import { testHarness } from '../testing/testHarness.js';
import admin from 'firebase-admin';
import fs from 'fs';
import csv from 'csv-parser';

async function fixMissingReadings() {
  console.log('🔧 Checking and fixing missing water meter readings for AVII\n');
  
  // Initialize Firebase
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert('./serviceAccountKey.json')
    });
  }
  
  const db = admin.firestore();
  const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
  
  // Step 1: Check existing readings for Unit 101 as example
  console.log('🔍 Step 1: Checking existing readings for Unit 101...\n');
  
  const fy2025Path = 'clients/AVII/units/101/waterMeter/2025/readings';
  const fy2026Path = 'clients/AVII/units/101/waterMeter/2026/readings';
  
  console.log('📅 FY2025 Readings:');
  const fy2025Snapshot = await db.collection(fy2025Path).orderBy('date').get();
  if (fy2025Snapshot.empty) {
    console.log('  ❌ No FY2025 readings found');
  } else {
    fy2025Snapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      const date = data.date._seconds ? new Date(data.date._seconds * 1000) : new Date(data.date);
      console.log(`  ${i+1}. ${data.reading || data.value} gallons on ${date.toDateString()} - ${data.notes || 'No notes'}`);
    });
  }
  
  console.log('\n📅 FY2026 Readings:');
  const fy2026Snapshot = await db.collection(fy2026Path).orderBy('date').get();
  if (fy2026Snapshot.empty) {
    console.log('  ❌ No FY2026 readings found');
  } else {
    fy2026Snapshot.docs.forEach((doc, i) => {
      const data = doc.data();
      const date = data.date._seconds ? new Date(data.date._seconds * 1000) : new Date(data.date);
      console.log(`  ${i+1}. ${data.reading || data.value} gallons on ${date.toDateString()} - ${data.notes || 'No notes'}`);
    });
  }
  
  console.log(`\n📊 Total readings for Unit 101: FY2025=${fy2025Snapshot.size}, FY2026=${fy2026Snapshot.size}`);
  
  // Step 2: Load CSV data
  console.log('\n📊 Step 2: Loading CSV data...\n');
  
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
  
  // Step 3: Add missing readings if needed
  if (fy2025Snapshot.empty || fy2026Snapshot.size < 2) {
    console.log('🔧 Step 3: Adding missing readings...\n');
    
    // Add May 28 baseline to FY2025 if missing
    if (fy2025Snapshot.empty) {
      console.log('➕ Adding May 28 baseline readings to FY2025...');
      const may28Readings = csvData.map(data => ({
        unitId: data.unitId,
        value: data.may28,
        notes: 'May 2025 year-end baseline reading (FY2025 final)'
      }));
      
      await testHarness.runTest({
        name: 'Add missing May 28 baseline readings',
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
            console.log(`✅ Successfully added ${may28Readings.length} baseline readings to FY2025`);
            return { passed: true };
          } else {
            console.log(`❌ Failed: ${JSON.stringify(response.data)}`);
            return { passed: false };
          }
        }
      });
    }
    
    // Add June 28 readings to FY2026 if missing
    if (fy2026Snapshot.size < 2) {
      console.log('➕ Adding June 28 readings for July billing to FY2026...');
      const june28Readings = csvData.map(data => ({
        unitId: data.unitId,
        value: data.june28,
        notes: `June 28 reading for July 2025 billing (consumption: ${data.june28 - data.may28} gallons)`
      }));
      
      await testHarness.runTest({
        name: 'Add missing June 28 readings',
        testUser: 'fjXv8gX1CYWBvOZ1CS27j96oRCT2',
        async test({ api }) {
          const response = await api.request({
            method: 'POST',
            url: '/api/clients/AVII/watermeters/readings',
            data: {
              clientId: 'AVII',
              readings: june28Readings,
              readingDate: '2025-06-28'
            },
            validateStatus: () => true
          });
          
          console.log(`June 28 readings: Status ${response.status}`);
          if (response.status === 200 || response.status === 201) {
            console.log(`✅ Successfully added ${june28Readings.length} June 28 readings to FY2026`);
            return { passed: true };
          } else {
            console.log(`❌ Failed: ${JSON.stringify(response.data)}`);
            return { passed: false };
          }
        }
      });
    }
  } else {
    console.log('✅ All required readings are present!');
  }
  
  console.log('\n🎉 Fix complete! Water History table should now display consumption data.');
}

// Run the fix
fixMissingReadings().catch(console.error);
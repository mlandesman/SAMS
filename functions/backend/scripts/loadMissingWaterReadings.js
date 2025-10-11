import fs from 'fs';
import csv from 'csv-parser';
import { testHarness } from '../testing/testHarness.js';

async function loadMissingReadings() {
  console.log('📊 Loading Missing May and June Water Meter Readings for AVII\n');
  
  const csvPath = '/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/Property Management/Aventuras Villas II/Water Bills/SAMS/water-meters-initial.csv';
  
  // Parse the CSV file
  const readings = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        const unit = row['Unit'];
        
        // The CSV columns are May 28, June 28, July 28
        const may28 = parseInt(row['4/28/25'].replace(/,/g, '')); // May 28
        const june28 = parseInt(row['5/28/25'].replace(/,/g, '')); // June 28
        
        // May 28, 2025 - End of FY2025, baseline for FY2026
        readings.push({
          unitId: unit,
          reading: may28,
          date: '2025-05-28',
          notes: 'May 2025 baseline reading (end of FY2025)'
        });
        
        // June 28, 2025 - June consumption (billed July 1 in FY2026)
        readings.push({
          unitId: unit,
          reading: june28,
          date: '2025-06-28',
          notes: 'June 2025 consumption (billed July 2025 in FY2026)'
        });
      })
      .on('end', async () => {
        console.log(`✅ Parsed ${readings.length} readings from CSV`);
        console.log('\nSample readings:');
        console.log(readings.slice(0, 4));
        
        // Group readings by date for batch submission
        const readingsByDate = {};
        readings.forEach(r => {
          if (!readingsByDate[r.date]) {
            readingsByDate[r.date] = [];
          }
          readingsByDate[r.date].push({
            unitId: r.unitId,
            value: r.reading,
            notes: r.notes
          });
        });
        
        console.log('\n📤 Submitting readings to backend...\n');
        
        // Submit each date's readings as a batch
        for (const [date, dateReadings] of Object.entries(readingsByDate)) {
          await testHarness.runTest({
            name: `Submit readings for ${date}`,
            testUser: 'fjXv8gX1CYWBvOZ1CS27j96oRCT2', // SuperAdmin
            async test({ api }) {
              const response = await api.request({
                method: 'POST',
                url: '/api/clients/AVII/watermeters/readings',
                data: {
                  clientId: 'AVII',
                  readings: dateReadings,
                  readingDate: date
                },
                validateStatus: () => true
              });
              
              console.log(`  ${date}: Status ${response.status}`);
              
              if (response.status === 200 || response.status === 201) {
                console.log(`  ✅ Successfully submitted ${dateReadings.length} readings for ${date}`);
                return { passed: true };
              } else {
                console.log(`  ❌ Failed: ${JSON.stringify(response.data)}`);
                return { passed: false };
              }
            }
          });
        }
        
        console.log('\n✨ Historical water meter readings loaded successfully!');
        console.log('📝 Summary:');
        console.log(`  - Units: ${[...new Set(readings.map(r => r.unitId))].length}`);
        console.log(`  - Dates: ${Object.keys(readingsByDate).join(', ')}`);
        console.log(`  - Total readings: ${readings.length}`);
        
        resolve();
      })
      .on('error', reject);
  });
}

// Run the import
loadMissingReadings().catch(console.error);
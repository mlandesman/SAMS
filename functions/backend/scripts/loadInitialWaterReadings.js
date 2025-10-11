import fs from 'fs';
import csv from 'csv-parser';
import { testHarness } from '../testing/testHarness.js';

async function loadInitialWaterReadings() {
  console.log('📊 Loading Initial Water Meter Readings for AVII\n');
  
  const csvPath = '/Users/michael/Library/CloudStorage/GoogleDrive-michael@landesman.com/My Drive/Sandyland/Property Management/Aventuras Villas II/Water Bills/SAMS/water-meters-initial.csv';
  
  // Parse the CSV file
  const readings = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // The CSV columns are actually May 28, June 28, July 28
        const unit = row['Unit'];
        
        // Parse readings, removing commas from numbers
        const may28 = parseInt(row['4/28/25'].replace(/,/g, '')); // Column labeled 4/28 is actually May 28
        const june28 = parseInt(row['5/28/25'].replace(/,/g, '')); // Column labeled 5/28 is actually June 28
        const july28 = parseInt(row['6/28/25'].replace(/,/g, '')); // Column labeled 6/28 is actually July 28
        
        // For FY2026 cash-basis accounting:
        // May 28 reading = End of FY2025, baseline for FY2026
        // June 28 reading = June consumption (billed in July FY2026)
        // July 28 reading = July consumption (billed in August FY2026)
        
        // We already loaded May 28 and June 28, so just load July 28 now
        
        // July 28, 2025 - July consumption (will be billed in August FY2026)
        readings.push({
          unitId: unit,
          reading: july28,
          date: '2025-07-28',
          notes: 'July 2025 consumption (billed August 2025 in FY2026)'
        });
      })
      .on('end', async () => {
        console.log(`✅ Parsed ${readings.length} readings from CSV`);
        console.log('\nSample readings:');
        console.log(readings.slice(0, 6));
        
        // Group readings by date for batch submission
        const readingsByDate = {};
        readings.forEach(r => {
          if (!readingsByDate[r.date]) {
            readingsByDate[r.date] = [];
          }
          readingsByDate[r.date].push({
            unitId: r.unitId,
            value: r.reading,  // Backend expects 'value' not 'reading'
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
                return {
                  passed: true,
                  message: `Submitted ${dateReadings.length} readings`
                };
              } else {
                console.log(`  ❌ Failed: ${JSON.stringify(response.data)}`);
                return {
                  passed: false,
                  message: `Failed: ${response.status} - ${JSON.stringify(response.data)}`
                };
              }
            }
          });
        }
        
        console.log('\n✨ Initial water meter readings loaded successfully!');
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
loadInitialWaterReadings().catch(console.error);
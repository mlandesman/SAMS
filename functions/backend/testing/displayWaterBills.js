#!/usr/bin/env node

/**
 * Display Water Bills in Table Format
 */

import { createApiClient } from './apiClient.js';

async function displayWaterBills() {
  try {
    const api = await createApiClient();
    console.log('\n📊 WATER BILLS SUMMARY - FISCAL YEAR 2026\n');
    console.log('═'.repeat(100));
    
    // Get aggregated data
    const response = await api.get('/api/clients/AVII/water/data/2026');
    const yearData = response.data.data;
    
    // Display July (Month 0)
    const july = yearData.months[0];
    console.log('\n🗓️  JULY 2025 (Fiscal Month 0)\n');
    console.log('─'.repeat(100));
    console.log('Unit  │ Prior Reading │ Current Reading │ Consumption │     Amount │ Status');
    console.log('──────┼───────────────┼─────────────────┼─────────────┼────────────┼─────────');
    
    let julyTotal = 0;
    let julyUnits = 0;
    
    Object.entries(july.units).forEach(([unitId, data]) => {
      if (data.billAmount > 0) {
        console.log(
          `${unitId.padEnd(5)} │` +
          ` ${String(data.priorReading).padStart(13)} │` +
          ` ${String(data.currentReading).padStart(15)} │` +
          ` ${String(data.consumption).padStart(10)} m³ │` +
          ` $${data.billAmount.toFixed(2).padStart(9)} │` +
          ` ${data.status}`
        );
        julyTotal += data.billAmount;
        julyUnits++;
      }
    });
    
    console.log('──────┴───────────────┴─────────────────┴─────────────┴────────────┴─────────');
    console.log(`TOTAL: ${julyUnits} units billed`.padEnd(55) + `$${julyTotal.toFixed(2).padStart(10)}`);
    
    // Display August (Month 1)
    const august = yearData.months[1];
    console.log('\n🗓️  AUGUST 2025 (Fiscal Month 1)\n');
    console.log('─'.repeat(100));
    console.log('Unit  │ Prior Reading │ Current Reading │ Consumption │     Amount │ Status');
    console.log('──────┼───────────────┼─────────────────┼─────────────┼────────────┼─────────');
    
    let augustTotal = 0;
    let augustUnits = 0;
    
    Object.entries(august.units).forEach(([unitId, data]) => {
      if (data.billAmount > 0) {
        console.log(
          `${unitId.padEnd(5)} │` +
          ` ${String(data.priorReading).padStart(13)} │` +
          ` ${String(data.currentReading).padStart(15)} │` +
          ` ${String(data.consumption).padStart(10)} m³ │` +
          ` $${data.billAmount.toFixed(2).padStart(9)} │` +
          ` ${data.status}`
        );
        augustTotal += data.billAmount;
        augustUnits++;
      }
    });
    
    console.log('──────┴───────────────┴─────────────────┴─────────────┴────────────┴─────────');
    console.log(`TOTAL: ${augustUnits} units billed`.padEnd(55) + `$${augustTotal.toFixed(2).padStart(10)}`);
    
    // Summary
    console.log('\n═'.repeat(100));
    console.log('📈 BILLING SUMMARY\n');
    console.log(`  Configuration:`);
    console.log(`    • Rate: $50.00 MXN per m³`);
    console.log(`    • Penalty: 5% monthly after 10 days`);
    console.log(`    • Currency: Mexican Pesos (MXN)`);
    console.log('');
    console.log(`  July 2025:   ${julyUnits} units   $${julyTotal.toFixed(2)}`);
    console.log(`  August 2025: ${augustUnits} units   $${augustTotal.toFixed(2)}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  TOTAL:       ${julyUnits + augustUnits} units  $${(julyTotal + augustTotal).toFixed(2)}`);
    console.log('\n═'.repeat(100));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the display
displayWaterBills();
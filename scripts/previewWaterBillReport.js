#!/usr/bin/env node
/**
 * Preview Water Bill Report HTML
 * Generates HTML and opens in browser or saves to file
 * 
 * Usage:
 *   node scripts/previewWaterBillReport.js 103
 *   node scripts/previewWaterBillReport.js 103 --spanish
 *   node scripts/previewWaterBillReport.js 103 --save
 *   node scripts/previewWaterBillReport.js 103 --spanish --save
 * 
 * Options:
 *   --spanish    Generate Spanish version (default: English)
 *   --save       Save to file without opening browser
 *   --client     Specify client ID (default: AVII)
 */

import { generateWaterConsumptionReportHtml } from '../functions/backend/services/waterBillReportHtmlService.js';
import { writeFile } from 'fs/promises';
import { exec } from 'child_process';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const unitId = args.find(arg => !arg.startsWith('--')) || '103';
const language = args.includes('--spanish') ? 'spanish' : 'english';
const saveToFile = args.includes('--save');
const clientIdArg = args.find(arg => arg.startsWith('--client='));
const clientId = clientIdArg ? clientIdArg.split('=')[1] : 'AVII';

async function preview() {
  console.log(`\n🌊 Water Consumption Report Preview`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Client:   ${clientId}`);
  console.log(`Unit:     ${unitId}`);
  console.log(`Language: ${language}`);
  console.log(`\nGenerating report...\n`);
  
  try {
    const result = await generateWaterConsumptionReportHtml(clientId, unitId, { language });
    
    if (result.error) {
      console.error(`❌ Error: ${result.error}`);
      process.exit(1);
    }
    
    if (!result.html) {
      console.error('❌ Failed to generate HTML');
      process.exit(1);
    }
    
    // Generate filename
    const filename = `water-report-${clientId}-${unitId}-${language}.html`;
    const filepath = path.join('/tmp', filename);
    
    // Write to file
    await writeFile(filepath, result.html);
    console.log(`✅ Report generated successfully`);
    console.log(`📄 Saved to: ${filepath}`);
    
    // Display report metadata
    console.log(`\n📊 Report Metadata:`);
    console.log(`   Report ID:  ${result.meta.reportId}`);
    console.log(`   Generated:  ${result.meta.generatedAt}`);
    console.log(`   Language:   ${result.meta.language}`);
    
    // Display summary metrics
    if (result.reportData && result.reportData.summary) {
      const summary = result.reportData.summary;
      console.log(`\n📈 Summary Metrics:`);
      console.log(`   YTD Consumption:  ${summary.ytdConsumption} m³`);
      console.log(`   YTD Charges:      $${summary.ytdCharges.toFixed(2)}`);
      console.log(`   Monthly Average:  ${summary.monthlyAverage.toFixed(1)} m³/mo`);
      console.log(`   Daily Average:    ${summary.dailyAverage.toFixed(2)} m³/day`);
      console.log(`   Current Balance:  $${summary.currentBalance.toFixed(2)}`);
      console.log(`   Months with Data: ${summary.monthsWithData}`);
    }
    
    // Display comparison if available
    if (result.reportData && result.reportData.comparison) {
      const comp = result.reportData.comparison;
      console.log(`\n📊 Percentile Comparison:`);
      console.log(`   Percentile:       ${comp.percentile}th`);
      console.log(`   Total Units:      ${comp.totalUnits}`);
      console.log(`   Building Average: ${comp.buildingAverage} m³`);
    }
    
    if (!saveToFile) {
      // Open in browser (macOS)
      console.log(`\n🌐 Opening in browser...\n`);
      exec(`open "${filepath}"`, (error) => {
        if (error) {
          console.error(`❌ Failed to open browser: ${error.message}`);
          console.log(`   You can manually open: ${filepath}`);
        }
      });
    } else {
      console.log(`\n✅ File saved. Use --save flag removed to open in browser.\n`);
    }
    
  } catch (error) {
    console.error(`\n❌ Error generating report:`, error);
    console.error(error.stack);
    process.exit(1);
  }
}

preview().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

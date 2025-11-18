/**
 * Export Statement Data to JSON files
 * Calls statementDataService and saves JSON output to disk
 */

import { testHarness } from './testHarness.js';
import { queryDuesPaymentsData } from '../services/statementDataService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testUnits = [
  { clientId: 'AVII', unitId: '101' },
  { clientId: 'AVII', unitId: '106' },
  { clientId: 'MTC', unitId: 'PH3C' }
];

const outputDir = path.join(__dirname, '../../test-results');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function exportUnitData(api, clientId, unitId) {
  console.log(`\n📦 Exporting data for ${clientId} ${unitId}...`);
  
  try {
    // Call the service
    const data = await queryDuesPaymentsData(api, clientId, unitId);
    
    // Generate filename
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '-');
    const filename = `statement_data_${clientId}_${unitId}_${dateStr}.json`;
    const filepath = path.join(outputDir, filename);
    
    // Write JSON file with pretty formatting
    const jsonContent = JSON.stringify(data, null, 2);
    fs.writeFileSync(filepath, jsonContent, 'utf8');
    
    console.log(`✅ Saved to: ${filepath}`);
    console.log(`   File size: ${(jsonContent.length / 1024).toFixed(2)} KB`);
    console.log(`   Summary:`);
    console.log(`     - Final Balance: $${data.summary.finalBalance.toFixed(2)}`);
    console.log(`     - Total Due: $${data.summary.totalDue.toFixed(2)}`);
    console.log(`     - Total Paid: $${data.summary.totalPaid.toFixed(2)}`);
    console.log(`     - Transactions: ${data.summary.transactionCount}`);
    
    return { success: true, filepath, data };
  } catch (error) {
    console.error(`❌ Error exporting ${clientId} ${unitId}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Exporting Statement Data to JSON files\n');
  console.log('═══════════════════════════════════════════════════════════');
  
  const results = [];
  
  await testHarness.runTest({
    name: 'Export Statement Data',
    async test({ api }) {
      for (const { clientId, unitId } of testUnits) {
        const result = await exportUnitData(api, clientId, unitId);
        results.push({ clientId, unitId, ...result });
        
        // Small delay between exports
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      return {
        passed: results.every(r => r.success),
        message: `Exported ${results.filter(r => r.success).length}/${results.length} units`
      };
    }
  });
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Export Summary:');
  console.log('═══════════════════════════════════════════════════════════');
  
  results.forEach(({ clientId, unitId, success, filepath, error }) => {
    if (success) {
      console.log(`✅ ${clientId} ${unitId}: ${filepath}`);
    } else {
      console.log(`❌ ${clientId} ${unitId}: ${error}`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Successfully exported ${successCount}/${results.length} JSON files`);
  console.log(`📁 Output directory: ${outputDir}`);
  
  testHarness.showSummary();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


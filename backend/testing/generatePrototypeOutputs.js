/**
 * Generate prototype output files for comparison
 * Runs queryDuesPayments.js for each test unit and saves output to test-results/
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testUnits = [
  { clientId: 'AVII', unitId: '101' },
  { clientId: 'AVII', unitId: '102' },
  { clientId: 'MTC', unitId: '1A' },
  { clientId: 'MTC', unitId: '2B' }
];

const testResultsDir = path.join(__dirname, '../../test-results');

// Ensure test-results directory exists
if (!fs.existsSync(testResultsDir)) {
  fs.mkdirSync(testResultsDir, { recursive: true });
}

async function runPrototype(clientId, unitId) {
  const scriptPath = path.join(__dirname, '../testHarness/queryDuesPayments.js');
  const command = `node ${scriptPath} ${clientId} ${unitId}`;
  
  console.log(`\n🔍 Running prototype for ${clientId} ${unitId}...`);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: path.join(__dirname, '../..'),
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    // Combine stdout and stderr (prototype uses console.log)
    const output = stdout + (stderr ? '\n' + stderr : '');
    
    // Generate filename with date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '-');
    const filename = `prototype_output_${clientId}_${unitId}_${dateStr}.txt`;
    const filepath = path.join(testResultsDir, filename);
    
    // Save output to file
    fs.writeFileSync(filepath, output, 'utf8');
    console.log(`✅ Saved output to: ${filepath}`);
    
    return { success: true, filepath, output };
  } catch (error) {
    console.error(`❌ Error running prototype for ${clientId} ${unitId}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Generating prototype output files for comparison...\n');
  
  const results = [];
  
  for (const { clientId, unitId } of testUnits) {
    const result = await runPrototype(clientId, unitId);
    results.push({ clientId, unitId, ...result });
    
    // Small delay between runs
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📊 Summary:');
  console.log('═══════════════════════════════════════════════════════════');
  
  results.forEach(({ clientId, unitId, success, filepath, error }) => {
    if (success) {
      console.log(`✅ ${clientId} ${unitId}: ${filepath}`);
    } else {
      console.log(`❌ ${clientId} ${unitId}: ${error}`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Successfully generated ${successCount}/${results.length} output files`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


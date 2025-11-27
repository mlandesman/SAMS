/**
 * Statement Text Table Service
 */

import { testHarness, createApiClient } from './testHarness.js';
import { getStatementData } from '../services/statementDataService.js';
import { generateTextTable } from '../services/statementTextTableService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testUnits = [
  { clientId: 'AVII', unitId: '101' },
  { clientId: 'AVII', unitId: '102' },
  { clientId: 'AVII', unitId: '103' },
  { clientId: 'AVII', unitId: '104' },
  { clientId: 'AVII', unitId: '105' },
  { clientId: 'AVII', unitId: '106' },
  { clientId: 'AVII', unitId: '201' },
  { clientId: 'AVII', unitId: '202' },
  { clientId: 'AVII', unitId: '203' },
  { clientId: 'AVII', unitId: '204' },
  { clientId: 'MTC', unitId: '1A' },
  { clientId: 'MTC', unitId: '1B' },
  { clientId: 'MTC', unitId: '1C' },
  { clientId: 'MTC', unitId: '2A' },
  { clientId: 'MTC', unitId: '2B' },
  { clientId: 'MTC', unitId: '2C' },
  { clientId: 'MTC', unitId: 'PH1A' },
  { clientId: 'MTC', unitId: 'PH2B' },
  { clientId: 'MTC', unitId: 'PH3C' },
  { clientId: 'MTC', unitId: 'PH4D' }
];

/**
 * Generate the text table for a single unit and return it as a formatted section.
 * @param {object} api
 * @param {string} clientId
 * @param {string} unitId
 * @returns {Promise<string>} Section text including header + table
 */
async function testUnit(api, clientId, unitId) {
  console.log(`\n🧪 Testing ${clientId} ${unitId}...`);
  
  // Get statement data
  const statementData = await getStatementData(api, clientId, unitId);
  
  // Generate text output
  const textOutput = generateTextTable(statementData);

  // Build a section with a clear separator
  const sectionHeader =
    `\n========================================\n` +
    `Client: ${clientId}   Unit: ${unitId}\n` +
    `========================================\n\n`;

  // Return header + table + trailing newline
  return sectionHeader + textOutput + '\n';
}

async function runTests() {
  console.log('🧪 Testing Statement Text Table Service');
  console.log('═══════════════════════════════════════\n');
  
  try {
    // Create API client
    const api = await createApiClient();

    let combinedOutput = '';

    // Test all units and accumulate output
    for (const unit of testUnits) {
      const sectionText = await testUnit(api, unit.clientId, unit.unitId);
      combinedOutput += sectionText;
    }

    // Save one combined file for all units
    const outputDir = path.join(__dirname, '../../test-results');
    const outputPath = path.join(
      outputDir,
      'statement_text_ALL_UNITS_2025-11-18.txt'
    );

    // Ensure the output directory exists (in case it doesn’t)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, combinedOutput.trimStart(), 'utf8');
    console.log(`\n📄 Combined output saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

runTests();
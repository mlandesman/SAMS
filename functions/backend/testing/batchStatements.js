/**
 * Batch Statement Generator - Clean Output to File
 */

import { testHarness } from './testHarness.js';
import { generateStatement } from '../services/statementDataCollector.js';
import fs from 'fs/promises';

function formatPesos(amount) {
  if (!amount || isNaN(amount)) return '0.00';
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function formatStatement(statement) {
  const lines = [];
  
  lines.push(`\n═══════════════════════════════════════════════════════════════════════════════`);
  lines.push(`STATEMENT OF ACCOUNT - ${statement.clientId} Unit ${statement.unitId} (FY ${statement.fiscalYear})`);
  lines.push(`═══════════════════════════════════════════════════════════════════════════════`);
  lines.push(`Date       | Description           | Charge      | Payment     | Balance`);
  lines.push(`-----------|-----------------------|-------------|-------------|-------------`);
  lines.push(`           | Opening Balance       |             |             |        0.00`);
  
  for (const txn of statement.transactions) {
    const dateStr = formatDate(txn.date);
    const description = (txn.description || '').padEnd(21).substring(0, 21);
    const charge = txn.charge > 0 ? formatPesos(txn.charge).padStart(11) : ' '.repeat(11);
    const payment = txn.payment > 0 ? formatPesos(txn.payment).padStart(11) : ' '.repeat(11);
    const balance = formatPesos(txn.balance).padStart(11);
    
    lines.push(`${dateStr} | ${description} | ${charge} | ${payment} | ${balance}`);
  }
  
  lines.push(`-----------|-----------------------|-------------|-------------|-------------`);
  lines.push(`           | FINAL BALANCE         |             |             | ${formatPesos(statement.finalBalance).padStart(11)}`);
  lines.push(`\n💰 Credit Balance: $${formatPesos(statement.creditBalance)} MXN`);
  lines.push(`═══════════════════════════════════════════════════════════════════════════════\n`);
  
  return lines.join('\n');
}

async function generateBatchStatements(clientId, unitIds, fiscalYear) {
  const output = [];
  
  for (const unitId of unitIds) {
    await testHarness.runTest({
      name: `Statement ${clientId}/${unitId}`,
      async test({ api }) {
        const statement = await generateStatement(api, clientId, unitId, fiscalYear);
        output.push(formatStatement(statement));
        return { passed: true };
      }
    });
  }
  
  return output.join('\n');
}

// Main
const clientId = process.argv[2];
const fiscalYear = parseInt(process.argv[process.argv.length - 1]);
const unitIds = process.argv.slice(3, -1);

if (!clientId || !fiscalYear || unitIds.length === 0) {
  console.log('Usage: node backend/testing/batchStatements.js <clientId> <unitId1> [unitId2...] <fiscalYear>');
  console.log('Example: node backend/testing/batchStatements.js AVII 101 102 106 203 2026');
  process.exit(1);
}

const output = await generateBatchStatements(clientId, unitIds, fiscalYear);
const filename = `/Users/michael/Projects/SAMS/test-results/statements_${clientId}_${fiscalYear}_${Date.now()}.txt`;
await fs.writeFile(filename, output);
console.log(`\n✅ Statements generated and saved to:`);
console.log(`   ${filename}\n`);
process.exit(0);


/**
 * Show Statement of Account - Clean Output
 * Calls the production statementDataCollector service
 */

import { testHarness } from './testHarness.js';
import { generateStatement } from '../services/statementDataCollector.js';

function formatPesos(amount) {
  if (!amount || isNaN(amount)) return '0.00';
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

async function showStatement(api, clientId, unitId, fiscalYear) {
  const statement = await generateStatement(api, clientId, unitId, fiscalYear);
  
  console.log(`\n═══════════════════════════════════════════════════════════════════════════════`);
  console.log(`STATEMENT OF ACCOUNT - ${clientId} Unit ${unitId} (FY ${fiscalYear})`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════`);
  console.log(`Date       | Description           | Charge      | Payment     | Balance`);
  console.log(`-----------|-----------------------|-------------|-------------|-------------`);
  console.log(`           | Opening Balance       |             |             |        0.00`);
  
  for (const txn of statement.transactions) {
    const dateStr = formatDate(txn.date);
    const description = (txn.description || '').padEnd(21).substring(0, 21);
    const charge = txn.charge > 0 ? formatPesos(txn.charge).padStart(11) : ' '.repeat(11);
    const payment = txn.payment > 0 ? formatPesos(txn.payment).padStart(11) : ' '.repeat(11);
    const balance = formatPesos(txn.balance).padStart(11);
    
    console.log(`${dateStr} | ${description} | ${charge} | ${payment} | ${balance}`);
  }
  
  console.log(`-----------|-----------------------|-------------|-------------|-------------`);
  console.log(`           | FINAL BALANCE         |             |             | ${formatPesos(statement.finalBalance).padStart(11)}`);
  console.log(`\n💰 Credit Balance: $${formatPesos(statement.creditBalance)} MXN`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════\n`);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log('Usage: node backend/testing/showStatement.js <clientId> <unitId1> [unitId2...] <fiscalYear>');
    console.log('Example: node backend/testing/showStatement.js AVII 101 102 106 203 2026');
    process.exit(1);
  }
  
  const clientId = args[0];
  const fiscalYear = parseInt(args[args.length - 1]);
  const unitIds = args.slice(1, -1);
  
  if (isNaN(fiscalYear)) {
    console.error('Last argument must be fiscal year (number)');
    process.exit(1);
  }
  
  // Suppress verbose logging
  const originalLog = console.log;
  
  // Process each unit
  for (const unitId of unitIds) {
    await testHarness.runTest({
      name: `Statement ${clientId}/${unitId}`,
      async test({ api }) {
        // Temporarily suppress internal logs during generation
        console.log = (...args) => {
          const msg = args.join(' ');
          if (!msg.includes('═══') && !msg.includes('Date       |') && 
              !msg.includes('STATEMENT') && !msg.includes('Credit Balance') &&
              !msg.match(/^\d{4}-\d{2}-\d{2}/) && !msg.includes('Opening Balance') &&
              !msg.includes('FINAL BALANCE')) {
            return; // Suppress
          }
          originalLog(...args);
        };
        
        await showStatement(api, clientId, unitId, fiscalYear);
        
        console.log = originalLog; // Restore
        return { passed: true };
      }
    });
  }
  
  console.log = originalLog;
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

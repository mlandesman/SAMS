/**
 * Generate Statement of Account - Clean Text Output
 * 
 * Usage: node backend/testing/generateStatementText.js <clientId> <unitId> <fiscalYear>
 * Example: node backend/testing/generateStatementText.js AVII 101 2026
 */

import { testHarness } from './testHarness.js';
import { generateStatement } from '../services/statementDataCollector.js';

/**
 * Format pesos amount with commas
 */
function formatPesos(amount) {
  if (!amount || isNaN(amount)) return '0.00';
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  if (!date || !(date instanceof Date)) return 'N/A';
  return date.toISOString().split('T')[0];
}

/**
 * Generate and display statement
 */
async function displayStatement(api, clientId, unitId, fiscalYear) {
  const statement = await generateStatement(api, clientId, unitId, fiscalYear);
  
  console.log(`\n═══════════════════════════════════════════════════════════════════════════════`);
  console.log(`STATEMENT OF ACCOUNT`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════`);
  console.log(`Client: ${clientId}`);
  console.log(`Unit: ${unitId}`);
  console.log(`Fiscal Year: ${fiscalYear}`);
  console.log(`Statement Date: ${formatDate(statement.asOfDate)}`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════\n`);
  
  console.log(`📋 Chronological Transaction List with Running Balance:`);
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
  
  console.log(`\nFinal Running Balance: $${formatPesos(statement.finalBalance)} MXN\n`);
  
  console.log(`📊 Summary:`);
  console.log(`Total Due: $${formatPesos(statement.totalDue)} MXN (calculated: ${formatPesos(statement.scheduledAmount)} × 12)`);
  console.log(`Total Paid: $${formatPesos(statement.totalPaid)} MXN`);
  console.log(`Outstanding: $${formatPesos(statement.totalOutstanding)} MXN`);
  console.log(`\n💰 Credit Balance: $${formatPesos(statement.creditBalance)} MXN`);
  
  console.log(`\n═══════════════════════════════════════════════════════════════════════════════\n`);
  
  return statement;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.log('Usage: node backend/testing/generateStatementText.js <clientId> <unitId> <fiscalYear>');
    console.log('Example: node backend/testing/generateStatementText.js AVII 101 2026');
    process.exit(1);
  }
  
  const [clientId, unitId, fiscalYearStr] = args;
  const fiscalYear = parseInt(fiscalYearStr);
  
  if (isNaN(fiscalYear)) {
    console.error(`Invalid fiscal year: ${fiscalYearStr}`);
    process.exit(1);
  }
  
  // Run using test harness (suppresses test harness logs)
  process.env.SUPPRESS_TEST_LOGS = 'true';
  
  await testHarness.runTest({
    name: `Generate Statement for ${clientId} unit ${unitId}`,
    async test({ api }) {
      await displayStatement(api, clientId, unitId, fiscalYear);
      return { passed: true };
    }
  });
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

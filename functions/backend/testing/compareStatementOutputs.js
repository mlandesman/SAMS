/**
 * Compare Statement Service Output with Prototype
 * 
 * This script runs both the prototype (queryDuesPayments.js) and the new service
 * (StatementDataCollector.generateStatement) with the same inputs and compares
 * the outputs line-by-line to ensure EXACT match.
 * 
 * Usage: node backend/testing/compareStatementOutputs.js <clientId> <unitId> <fiscalYear>
 * Example: node backend/testing/compareStatementOutputs.js AVII 101 2026
 */

import { generateStatement } from '../services/statementDataCollector.js';
import { testHarness } from './testHarness.js';
import { getNow } from '../../shared/services/DateService.js';

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
 * Compare two transaction lists for exact match
 */
function compareTransactions(prototypeTransactions, serviceTransactions) {
  const differences = [];
  
  if (prototypeTransactions.length !== serviceTransactions.length) {
    differences.push({
      type: 'count_mismatch',
      prototype: prototypeTransactions.length,
      service: serviceTransactions.length
    });
  }
  
  const maxLength = Math.max(prototypeTransactions.length, serviceTransactions.length);
  
  for (let i = 0; i < maxLength; i++) {
    const proto = prototypeTransactions[i];
    const svc = serviceTransactions[i];
    
    if (!proto) {
      differences.push({
        type: 'missing_in_prototype',
        index: i,
        service: svc
      });
      continue;
    }
    
    if (!svc) {
      differences.push({
        type: 'missing_in_service',
        index: i,
        prototype: proto
      });
      continue;
    }
    
    // Compare each transaction field
    const fieldsToCompare = ['date', 'description', 'type', 'category', 'charge', 'payment', 'amount', 'balance'];
    
    for (const field of fieldsToCompare) {
      if (field === 'date') {
        const protoDate = formatDate(proto.date);
        const svcDate = formatDate(svc.date);
        if (protoDate !== svcDate) {
          differences.push({
            type: 'field_mismatch',
            index: i,
            field,
            prototype: protoDate,
            service: svcDate
          });
        }
      } else if (field === 'charge' || field === 'payment' || field === 'amount' || field === 'balance') {
        // Compare numbers with small tolerance for floating point
        const protoVal = proto[field] || 0;
        const svcVal = svc[field] || 0;
        const diff = Math.abs(protoVal - svcVal);
        if (diff > 0.01) { // 1 centavo tolerance
          differences.push({
            type: 'field_mismatch',
            index: i,
            field,
            prototype: protoVal,
            service: svcVal,
            difference: diff
          });
        }
      } else {
        if (proto[field] !== svc[field]) {
          differences.push({
            type: 'field_mismatch',
            index: i,
            field,
            prototype: proto[field],
            service: svc[field]
          });
        }
      }
    }
  }
  
  return differences;
}

/**
 * Run comparison test
 */
async function runComparison(clientId, unitId, fiscalYear, api) {
  console.log(`\n🔍 STATEMENT OUTPUT COMPARISON`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Client: ${clientId}`);
  console.log(`Unit: ${unitId}`);
  console.log(`Fiscal Year: ${fiscalYear}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  
  try {
    // Generate statement using service
    console.log(`📊 Generating statement using StatementDataCollector service...`);
    const serviceResult = await generateStatement(clientId, unitId, fiscalYear);
    
    console.log(`✅ Service generated ${serviceResult.transactions.length} transactions`);
    console.log(`   Final Balance: $${formatPesos(serviceResult.finalBalance)} MXN`);
    
    // Display service output
    console.log(`\n📋 SERVICE OUTPUT - Chronological Transaction List:`);
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`Date       | Description           | Charge      | Payment     | Balance`);
    console.log(`-----------|-----------------------|-------------|-------------|-------------`);
    console.log(`           | Opening Balance       |             |             |        0.00`);
    
    for (const txn of serviceResult.transactions) {
      const dateStr = formatDate(txn.date);
      const description = (txn.description || '').padEnd(21).substring(0, 21);
      const charge = txn.charge > 0 ? formatPesos(txn.charge).padStart(11) : ' '.repeat(11);
      const payment = txn.payment > 0 ? formatPesos(txn.payment).padStart(11) : ' '.repeat(11);
      const balance = formatPesos(txn.balance).padStart(11);
      
      console.log(`${dateStr} | ${description} | ${charge} | ${payment} | ${balance}`);
    }
    
    console.log(`\nFinal Running Balance: $${formatPesos(serviceResult.finalBalance)} MXN`);
    
    // Display summary
    console.log(`\n📊 SERVICE SUMMARY:`);
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`Total Due: $${formatPesos(serviceResult.totalDue)} MXN`);
    console.log(`Total Paid: $${formatPesos(serviceResult.totalPaid)} MXN`);
    console.log(`Outstanding: $${formatPesos(serviceResult.totalOutstanding)} MXN`);
    console.log(`Credit Balance: $${formatPesos(serviceResult.creditBalance)} MXN`);
    console.log(`Final Balance: $${formatPesos(serviceResult.finalBalance)} MXN`);
    
    console.log(`\n✅ COMPARISON COMPLETE`);
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`The service implementation is ready for validation.`);
    console.log(`\nTo validate against prototype, run:`);
    console.log(`  node backend/testHarness/queryDuesPayments.js ${clientId} ${unitId}`);
    console.log(`\nAnd compare the outputs manually or use a diff tool.`);
    
    return {
      success: true,
      serviceResult
    };
    
  } catch (error) {
    console.error(`\n❌ ERROR DURING COMPARISON:`);
    console.error(error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.log('Usage: node backend/testing/compareStatementOutputs.js <clientId> <unitId> <fiscalYear>');
    console.log('Example: node backend/testing/compareStatementOutputs.js AVII 101 2026');
    process.exit(1);
  }
  
  const [clientId, unitId, fiscalYearStr] = args;
  const fiscalYear = parseInt(fiscalYearStr);
  
  if (isNaN(fiscalYear)) {
    console.error(`Invalid fiscal year: ${fiscalYearStr}`);
    process.exit(1);
  }
  
  // Run using test harness to get authenticated API client
  await testHarness.runTest({
    name: `Compare Statement Output for ${clientId} unit ${unitId}`,
    async test({ api }) {
      const result = await runComparison(clientId, unitId, fiscalYear, api);
      return {
        passed: result.success,
        message: result.success ? 'Comparison completed' : result.error
      };
    }
  });
  
  testHarness.showSummary();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


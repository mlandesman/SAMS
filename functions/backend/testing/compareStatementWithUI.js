/**
 * Compare Statement Output with UI Expected Values
 * 
 * This script helps identify discrepancies between:
 * - Statement text output
 * - Firebase data
 * - UI display values
 */

import { createApiClient } from './apiClient.js';
import { getStatementData } from '../services/statementDataService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expected values from statement output (from the text file)
const expectedValues = {
  'AVII_101': {
    finalBalance: 29197.31,
    totalDue: 58070.16,
    totalPaid: 48391.80,
    outstanding: 9678.36,
    creditBalance: 0.00
  },
  'AVII_102': {
    finalBalance: 67879.23,
    totalDue: 62261.52,
    totalPaid: 0.00,
    outstanding: 62261.52,
    creditBalance: 0.00
  },
  'AVII_103': {
    finalBalance: 31052.76,
    totalDue: 58907.76,
    totalPaid: 53998.78,
    outstanding: 4908.98,
    creditBalance: 4871.12
  },
  'AVII_104': {
    finalBalance: 41629.95,
    totalDue: 60032.52,
    totalPaid: 25013.55,
    outstanding: 35018.97,
    creditBalance: 0.00
  },
  'AVII_105': {
    finalBalance: 66476.92,
    totalDue: 132982.56,
    totalPaid: 77573.16,
    outstanding: 55409.40,
    creditBalance: 1279.36
  },
  'AVII_106': {
    finalBalance: 126301.59,
    totalDue: 144243.72,
    totalPaid: 24040.62,
    outstanding: 120203.10,
    creditBalance: 0.00
  },
  'AVII_201': {
    finalBalance: 34341.80,
    totalDue: 68688.60,
    totalPaid: 34344.30,
    outstanding: 34344.30,
    creditBalance: 0.00
  },
  'AVII_202': {
    finalBalance: 68424.12,
    totalDue: 80505.36,
    totalPaid: 33543.90,
    outstanding: 46961.46,
    creditBalance: 0.00
  },
  'AVII_203': {
    finalBalance: 75450.91,
    totalDue: 74336.40,
    totalPaid: 37168.20,
    outstanding: 37168.20,
    creditBalance: 35.75
  },
  'AVII_204': {
    finalBalance: 53601.48,
    totalDue: 77710.68,
    totalPaid: 38855.34,
    outstanding: 38855.34,
    creditBalance: 0.00
  },
  'MTC_1A': {
    finalBalance: -4561.00,
    totalDue: 55200.00,
    totalPaid: 55200.00,
    outstanding: 0.00,
    creditBalance: 0.00
  },
  'MTC_1B': {
    finalBalance: 4900.00,
    totalDue: 52800.00,
    totalPaid: 48400.00,
    outstanding: 4400.00,
    creditBalance: 86.00
  },
  'MTC_1C': {
    finalBalance: 0.00,
    totalDue: 52800.00,
    totalPaid: 52800.00,
    outstanding: 0.00,
    creditBalance: 400.00
  },
  'MTC_2A': {
    finalBalance: 19000.00,
    totalDue: 55200.00,
    totalPaid: 50600.00,
    outstanding: 4600.00,
    creditBalance: 294.00
  },
  'MTC_2B': {
    finalBalance: 0.00,
    totalDue: 52800.00,
    totalPaid: 52800.00,
    outstanding: 0.00,
    creditBalance: 0.00
  },
  'MTC_2C': {
    finalBalance: 0.00,
    totalDue: 52800.00,
    totalPaid: 52800.00,
    outstanding: 0.00,
    creditBalance: 0.00
  },
  'MTC_PH1A': {
    finalBalance: -600.00,
    totalDue: 69600.00,
    totalPaid: 63800.00,
    outstanding: 5800.00,
    creditBalance: 600.00
  },
  'MTC_PH2B': {
    finalBalance: 34836.00,
    totalDue: 69600.00,
    totalPaid: 69600.00,
    outstanding: 0.00,
    creditBalance: 0.00
  },
  'MTC_PH3C': {
    finalBalance: 16800.00,
    totalDue: 69600.00,
    totalPaid: 69600.00,
    outstanding: 0.00,
    creditBalance: 910.44
  },
  'MTC_PH4D': {
    finalBalance: 0.00,
    totalDue: 69600.00,
    totalPaid: 69600.00,
    outstanding: 0.00,
    creditBalance: 14400.00
  }
};

async function getApiClient() {
  // Use the createApiClient from apiClient.js which handles authentication
  return await createApiClient();
}

function compareValues(actual, expected, tolerance = 0.01) {
  return Math.abs(actual - expected) <= tolerance;
}

function formatDifference(actual, expected) {
  const diff = actual - expected;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)}`;
}

async function compareUnit(api, clientId, unitId) {
  const key = `${clientId}_${unitId}`;
  const expected = expectedValues[key];
  
  if (!expected) {
    console.log(`⚠️  No expected values for ${key}`);
    return null;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Comparing ${clientId} - ${unitId}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Get statement data
    const statementData = await getStatementData(api, clientId, unitId);
    const { summary, creditBalance } = statementData;
    
    // Compare values
    const results = {
      finalBalance: {
        expected: expected.finalBalance,
        actual: summary.finalBalance,
        match: compareValues(summary.finalBalance, expected.finalBalance),
        diff: formatDifference(summary.finalBalance, expected.finalBalance)
      },
      totalDue: {
        expected: expected.totalDue,
        actual: summary.totalDue,
        match: compareValues(summary.totalDue, expected.totalDue),
        diff: formatDifference(summary.totalDue, expected.totalDue)
      },
      totalPaid: {
        expected: expected.totalPaid,
        actual: summary.totalPaid,
        match: compareValues(summary.totalPaid, expected.totalPaid),
        diff: formatDifference(summary.totalPaid, expected.totalPaid)
      },
      outstanding: {
        expected: expected.outstanding,
        actual: summary.totalOutstanding,
        match: compareValues(summary.totalOutstanding, expected.outstanding),
        diff: formatDifference(summary.totalOutstanding, expected.outstanding)
      },
      creditBalance: {
        expected: expected.creditBalance,
        actual: creditBalance?.creditBalance || 0,
        match: compareValues(creditBalance?.creditBalance || 0, expected.creditBalance),
        diff: formatDifference(creditBalance?.creditBalance || 0, expected.creditBalance)
      }
    };
    
    // Display results
    console.log('\n📊 Comparison Results:');
    for (const [field, result] of Object.entries(results)) {
      const status = result.match ? '✅' : '❌';
      const fieldName = field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1');
      console.log(`   ${status} ${fieldName}:`);
      console.log(`      Expected: $${result.expected.toFixed(2)}`);
      console.log(`      Actual:   $${result.actual.toFixed(2)}`);
      if (!result.match) {
        console.log(`      Diff:     ${result.diff}`);
      }
    }
    
    // Calculate overall match
    const allMatch = Object.values(results).every(r => r.match);
    
    return {
      unitId: key,
      allMatch,
      results
    };
    
  } catch (error) {
    console.error(`❌ Error comparing ${clientId} ${unitId}:`, error.message);
    return null;
  }
}

async function generateComparisonReport(comparisons) {
  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON SUMMARY REPORT');
  console.log('='.repeat(80));
  
  const successful = comparisons.filter(c => c !== null);
  const matching = successful.filter(c => c.allMatch);
  const mismatched = successful.filter(c => !c.allMatch);
  
  console.log(`\n📈 Overall Results:`);
  console.log(`   Total Units: ${comparisons.length}`);
  console.log(`   Successful Comparisons: ${successful.length}`);
  console.log(`   ✅ Fully Matching: ${matching.length}`);
  console.log(`   ❌ With Discrepancies: ${mismatched.length}`);
  
  if (mismatched.length > 0) {
    console.log('\n⚠️  UNITS WITH DISCREPANCIES:');
    mismatched.forEach(unit => {
      console.log(`\n   ${unit.unitId}:`);
      for (const [field, result] of Object.entries(unit.results)) {
        if (!result.match) {
          console.log(`      ${field}: Expected ${result.expected.toFixed(2)}, Got ${result.actual.toFixed(2)} (${result.diff})`);
        }
      }
    });
  }
  
  // Save detailed report
  const testResultsDir = path.join(path.dirname(__dirname), 'test-results');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }
  
  const reportPath = path.join(testResultsDir, 'comparison_report_' + new Date().toISOString().split('T')[0] + '.json');
  fs.writeFileSync(reportPath, JSON.stringify({ comparisons: successful, summary: { total: comparisons.length, matching: matching.length, mismatched: mismatched.length } }, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

async function runComparison() {
  console.log('🔍 Statement vs UI Comparison Tool');
  console.log('='.repeat(80));
  console.log('Comparing statement output values with expected values\n');
  
  try {
    // Create API client
    const api = await getApiClient();
    
    const comparisons = [];
    
    // Compare all units
    for (const key of Object.keys(expectedValues)) {
      const [clientId, unitId] = key.split('_');
      const comparison = await compareUnit(api, clientId, unitId);
      comparisons.push(comparison);
      
      // Small delay between units
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Generate comparison report
    await generateComparisonReport(comparisons);
    
    console.log('\n✅ Comparison complete!');
    console.log('\nNext steps:');
    console.log('1. Review units with discrepancies');
    console.log('2. Check Firebase directly for those units');
    console.log('3. Compare with UI display values');
    console.log('4. Identify if issue is in data collection or calculation');
    
  } catch (error) {
    console.error('❌ Comparison failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run comparison
runComparison();

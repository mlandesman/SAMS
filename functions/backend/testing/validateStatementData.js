/**
 * Validate Statement Data Against Firebase
 * 
 * This script helps validate statement data by:
 * 1. Fetching raw data from Firebase for each unit
 * 2. Comparing against statement output
 * 3. Highlighting discrepancies
 */

import { createApiClient } from './apiClient.js';
import { getStatementData } from '../services/statementDataService.js';

// Test units to validate
const testUnits = [
  // AVII Units
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
  // MTC Units
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

async function getApiClient() {
  // Use the createApiClient from apiClient.js which handles authentication
  return await createApiClient();
}

function formatCurrency(amount) {
  if (!amount || isNaN(amount)) return '$0.00';
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(date) {
  if (!date) return 'N/A';
  
  // Handle string dates
  if (typeof date === 'string') return date.split('T')[0];
  
  // Handle Firestore Timestamp objects
  if (date.toDate && typeof date.toDate === 'function') {
    return date.toDate().toISOString().split('T')[0];
  }
  
  // Handle Date objects
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  
  // Handle objects with seconds/nanoseconds (Firestore timestamp)
  if (date._seconds || date.seconds) {
    const seconds = date._seconds || date.seconds;
    return new Date(seconds * 1000).toISOString().split('T')[0];
  }
  
  // Try to create a Date object as last resort
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch (e) {
    return 'Invalid Date';
  }
}

async function validateUnit(api, clientId, unitId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Validating ${clientId} - ${unitId}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // Get statement data
    const statementData = await getStatementData(api, clientId, unitId);
    
    // Extract key values
    const {
      hoaDuesRaw,
      waterBillsRaw,
      transactions,
      creditBalance,
      chronologicalTransactions,
      summary,
      clientConfig
    } = statementData;
    
    console.log('\n📊 Configuration:');
    console.log(`   Fiscal Year: ${clientConfig.fiscalYear}`);
    console.log(`   Fiscal Year Start: Month ${clientConfig.fiscalYearStartMonth}`);
    console.log(`   Dues Frequency: ${clientConfig.duesFrequency}`);
    console.log(`   Scheduled Amount: ${formatCurrency(summary.scheduledAmount)}/month`);
    
    console.log('\n💵 HOA Dues Data:');
    console.log(`   Total Due: ${formatCurrency(summary.totalDue)} (${summary.scheduledAmount} × 12)`);
    console.log(`   Total Paid: ${formatCurrency(summary.totalPaid)}`);
    console.log(`   Outstanding: ${formatCurrency(summary.totalOutstanding)}`);
    
    // Show HOA dues breakdown
    if (hoaDuesRaw && hoaDuesRaw.dues) {
      console.log('\n   Monthly/Quarterly Breakdown:');
      const duesArray = Array.isArray(hoaDuesRaw.dues) ? hoaDuesRaw.dues : Object.values(hoaDuesRaw.dues);
      duesArray.forEach(due => {
        const status = due.paid ? '✓' : due.charge > 0 ? '✗' : '-';
        console.log(`   ${status} ${due.description || `Month ${due.month}`}: Charge: ${formatCurrency(due.charge)}, Paid: ${formatCurrency(due.paid)}`);
      });
    }
    
    console.log('\n💧 Water Bills:');
    if (waterBillsRaw && waterBillsRaw.length > 0) {
      waterBillsRaw.forEach(bill => {
        const status = bill.status === 'Paid' ? '✓' : '✗';
        console.log(`   ${status} ${bill.billId}: ${formatCurrency(bill.totalAmount)} (Base: ${formatCurrency(bill.baseCharge)}, Penalty: ${formatCurrency(bill.penalty)})`);
      });
    } else {
      console.log('   No water bills');
    }
    
    console.log('\n💰 Credit Balance:');
    if (creditBalance) {
      console.log(`   Current Balance: ${formatCurrency(creditBalance.creditBalance)}`);
      console.log(`   Last Updated: ${formatDate(creditBalance.lastUpdated)}`);
    } else {
      console.log('   No credit balance');
    }
    
    console.log('\n📝 Transactions:');
    console.log(`   Total Count: ${transactions.length}`);
    const paymentTransactions = transactions.filter(t => t.type === 'payment' || t.type === 'Payment');
    const chargeTransactions = transactions.filter(t => t.type === 'charge' || t.type === 'Charge');
    console.log(`   Payments: ${paymentTransactions.length}`);
    console.log(`   Charges: ${chargeTransactions.length}`);
    
    // Debug: Show transaction types if counts don't match
    if (paymentTransactions.length + chargeTransactions.length !== transactions.length) {
      const uniqueTypes = [...new Set(transactions.map(t => t.type))];
      console.log(`   Transaction types found: ${uniqueTypes.join(', ')}`);
    }
    
    // Show last 5 transactions
    if (transactions.length > 0) {
      console.log('\n   Recent Transactions:');
      const sortedTransactions = transactions.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0);
        const dateB = new Date(b.date || b.createdAt || 0);
        return dateB - dateA;
      });
      sortedTransactions.slice(0, 5).forEach(txn => {
        const dateStr = formatDate(txn.date || txn.createdAt);
        // Convert from centavos to pesos
        const amountInPesos = Math.abs(txn.amount) / 100;
        const amount = formatCurrency(amountInPesos);
        const type = txn.type === 'payment' ? 'Payment' : 'Charge';
        const description = txn.description || txn.category || 'No description';
        console.log(`   ${dateStr} - ${type}: ${amount} (${description})`);
      });
    }
    
    console.log('\n📈 Running Balance Summary:');
    console.log(`   Opening Balance: $0.00`);
    console.log(`   Final Balance: ${formatCurrency(summary.finalBalance)}`);
    
    // Validate calculations
    console.log('\n✅ Validation Checks:');
    
    // Check 1: Total Due calculation
    const calculatedTotalDue = summary.scheduledAmount * 12;
    const totalDueMatch = Math.abs(calculatedTotalDue - summary.totalDue) < 0.01;
    console.log(`   Total Due Calculation: ${totalDueMatch ? '✓' : '✗'} (${formatCurrency(calculatedTotalDue)} vs ${formatCurrency(summary.totalDue)})`);
    
    // Check 2: Outstanding calculation
    const calculatedOutstanding = summary.totalDue - summary.totalPaid;
    const outstandingMatch = Math.abs(calculatedOutstanding - summary.totalOutstanding) < 0.01;
    console.log(`   Outstanding Calculation: ${outstandingMatch ? '✓' : '✗'} (${formatCurrency(calculatedOutstanding)} vs ${formatCurrency(summary.totalOutstanding)})`);
    
    // Check 3: Final balance
    const hasTransactions = chronologicalTransactions.length > 0;
    if (hasTransactions) {
      const lastTransaction = chronologicalTransactions[chronologicalTransactions.length - 1];
      const balanceMatch = Math.abs(lastTransaction.balance - summary.finalBalance) < 0.01;
      console.log(`   Final Balance Match: ${balanceMatch ? '✓' : '✗'} (${formatCurrency(lastTransaction.balance)} vs ${formatCurrency(summary.finalBalance)})`);
    }
    
    // Return summary for aggregation
    return {
      unitId: `${clientId}_${unitId}`,
      scheduledAmount: summary.scheduledAmount,
      totalDue: summary.totalDue,
      totalPaid: summary.totalPaid,
      totalOutstanding: summary.totalOutstanding,
      finalBalance: summary.finalBalance,
      creditBalance: creditBalance?.creditBalance || 0,
      hasWaterBills: waterBillsRaw && waterBillsRaw.length > 0,
      transactionCount: transactions.length
    };
    
  } catch (error) {
    console.error(`❌ Error validating ${clientId} ${unitId}:`, error.message);
    return null;
  }
}

async function generateSummaryReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION SUMMARY REPORT');
  console.log('='.repeat(80));
  
  // Group by client
  const aviiResults = results.filter(r => r && r.unitId.startsWith('AVII'));
  const mtcResults = results.filter(r => r && r.unitId.startsWith('MTC'));
  
  console.log('\n🏢 AVII CLIENT SUMMARY:');
  console.log(`   Units Validated: ${aviiResults.length}`);
  
  const aviiTotals = aviiResults.reduce((acc, r) => ({
    totalDue: acc.totalDue + r.totalDue,
    totalPaid: acc.totalPaid + r.totalPaid,
    totalOutstanding: acc.totalOutstanding + r.totalOutstanding,
    creditBalance: acc.creditBalance + r.creditBalance
  }), { totalDue: 0, totalPaid: 0, totalOutstanding: 0, creditBalance: 0 });
  
  console.log(`   Total Due (All Units): ${formatCurrency(aviiTotals.totalDue)}`);
  console.log(`   Total Paid (All Units): ${formatCurrency(aviiTotals.totalPaid)}`);
  console.log(`   Total Outstanding (All Units): ${formatCurrency(aviiTotals.totalOutstanding)}`);
  console.log(`   Total Credit Balance (All Units): ${formatCurrency(aviiTotals.creditBalance)}`);
  
  console.log('\n🏢 MTC CLIENT SUMMARY:');
  console.log(`   Units Validated: ${mtcResults.length}`);
  
  const mtcTotals = mtcResults.reduce((acc, r) => ({
    totalDue: acc.totalDue + r.totalDue,
    totalPaid: acc.totalPaid + r.totalPaid,
    totalOutstanding: acc.totalOutstanding + r.totalOutstanding,
    creditBalance: acc.creditBalance + r.creditBalance
  }), { totalDue: 0, totalPaid: 0, totalOutstanding: 0, creditBalance: 0 });
  
  console.log(`   Total Due (All Units): ${formatCurrency(mtcTotals.totalDue)}`);
  console.log(`   Total Paid (All Units): ${formatCurrency(mtcTotals.totalPaid)}`);
  console.log(`   Total Outstanding (All Units): ${formatCurrency(mtcTotals.totalOutstanding)}`);
  console.log(`   Total Credit Balance (All Units): ${formatCurrency(mtcTotals.creditBalance)}`);
  
  // Units with issues
  console.log('\n⚠️  UNITS REQUIRING ATTENTION:');
  
  // Units with high outstanding balance
  const highOutstanding = results
    .filter(r => r && r.totalOutstanding > 50000)
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
    
  if (highOutstanding.length > 0) {
    console.log('\n   High Outstanding Balances:');
    highOutstanding.forEach(unit => {
      console.log(`   ${unit.unitId}: ${formatCurrency(unit.totalOutstanding)}`);
    });
  }
  
  // Units with credit balance
  const hasCredit = results.filter(r => r && r.creditBalance > 0);
  if (hasCredit.length > 0) {
    console.log('\n   Units with Credit Balance:');
    hasCredit.forEach(unit => {
      console.log(`   ${unit.unitId}: ${formatCurrency(unit.creditBalance)}`);
    });
  }
  
  // Units with negative balance
  const negativeBalance = results.filter(r => r && r.finalBalance < 0);
  if (negativeBalance.length > 0) {
    console.log('\n   Units with Negative Balance:');
    negativeBalance.forEach(unit => {
      console.log(`   ${unit.unitId}: ${formatCurrency(unit.finalBalance)}`);
    });
  }
}

async function runValidation() {
  console.log('🔍 Statement Data Validation Tool');
  console.log('='.repeat(80));
  console.log('This tool validates statement data against Firebase records\n');
  
  try {
    // Create API client
    const api = await getApiClient();
    
    const results = [];
    
    // Validate all units
    for (const unit of testUnits) {
      const result = await validateUnit(api, unit.clientId, unit.unitId);
      if (result) {
        results.push(result);
      }
      
      // Small delay between units to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Generate summary report
    await generateSummaryReport(results);
    
    console.log('\n✅ Validation complete!');
    console.log('\nTo compare with UI:');
    console.log('1. Open HOA Dues view for each client');
    console.log('2. Check the displayed totals match the values above');
    console.log('3. Open Water Bills view and verify bill statuses');
    console.log('4. Check credit balances in the UI match the reported values');
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run validation
runValidation();

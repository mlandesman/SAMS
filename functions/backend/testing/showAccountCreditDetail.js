/**
 * Show Account Credit Detail
 * 
 * Shows all transactions and allocations that contribute to Account Credit income
 * and reconciles with current credit balance
 * 
 * Usage: node backend/testing/showAccountCreditDetail.js <clientId> <fiscalYear>
 * Example: node backend/testing/showAccountCreditDetail.js MTC 2025
 */

import { testHarness } from './testHarness.js';
import { getFiscalYear, getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { getNow } from '../../shared/services/DateService.js';

/**
 * Format centavos to pesos
 */
function centavosToPesos(centavos) {
  if (!centavos || isNaN(centavos)) return 0;
  return centavos / 100;
}

/**
 * Format pesos with commas
 */
function formatPesos(amount) {
  if (!amount || isNaN(amount)) return '0.00';
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Parse date from various formats
 */
function parseDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') {
    return new Date(dateValue);
  } else if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  } else if (dateValue instanceof Date) {
    return dateValue;
  } else if (dateValue.iso) {
    return new Date(dateValue.iso);
  } else if (dateValue.seconds) {
    return new Date(dateValue.seconds * 1000);
  }
  return new Date(dateValue);
}

/**
 * Check if categoryId is Account Credit related
 */
function isAccountCreditCategory(categoryId) {
  if (!categoryId) return false;
  const normalized = categoryId.toLowerCase();
  return normalized === 'account-credit' || 
         normalized === 'account_credit' || 
         normalized === 'accountcredit' ||
         normalized === 'credit_added' ||
         normalized === 'credit_used';
}

/**
 * Show Account Credit detail
 */
async function showAccountCreditDetail(api, clientId, fiscalYear) {
  try {
    // Get client configuration
    const clientResponse = await api.get(`/clients/${clientId}`);
    const clientData = clientResponse.data;
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    const fiscalYearBounds = getFiscalYearBounds(fiscalYear, fiscalYearStartMonth);
    
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`ACCOUNT CREDIT DETAIL FOR FISCAL YEAR ${fiscalYear}`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    console.log(`Fiscal Year Period: ${fiscalYearBounds.startDate.toISOString().split('T')[0]} to ${fiscalYearBounds.endDate.toISOString().split('T')[0]}`);
    
    // Query all income transactions
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', '2024-01-01');
    queryParams.append('endDate', '2025-12-31');
    
    const transactionsResponse = await api.get(`/clients/${clientId}/transactions?${queryParams.toString()}`);
    const allTransactions = Array.isArray(transactionsResponse.data) ? transactionsResponse.data : [];
    
    // Filter to transactions with Account Credit allocations or category
    const creditTransactions = [];
    let totalCreditAdded = 0;
    let totalCreditUsed = 0;
    
    for (const txn of allTransactions) {
      const txnDate = parseDate(txn.date);
      const txnInFY = txnDate && 
        txnDate.getTime() >= fiscalYearBounds.startDate.getTime() &&
        txnDate.getTime() <= fiscalYearBounds.endDate.getTime();
      
      // Check if this transaction has Account Credit allocations or category
      const isSplit = txn.categoryId === '-split-' || 
                      txn.categoryId === '-Split-' ||
                      txn.categoryName === '-Split-' ||
                      (txn.categoryId === null && txn.allocations && txn.allocations.length > 0);
      
      if (isSplit && txn.allocations && Array.isArray(txn.allocations)) {
        for (const alloc of txn.allocations) {
          if (isAccountCreditCategory(alloc.categoryId)) {
            const allocAmount = centavosToPesos(alloc.amount || 0);
            if (txnInFY) {
              if (allocAmount > 0) {
                totalCreditAdded += allocAmount;
              } else {
                totalCreditUsed += Math.abs(allocAmount);
              }
              creditTransactions.push({
                transactionId: txn.id,
                date: txnDate ? txnDate.toISOString().split('T')[0] : 'N/A',
                type: txn.type,
                unitId: txn.unitId || 'N/A',
                amount: allocAmount,
                isAdded: allocAmount > 0,
                allocation: alloc,
                notes: txn.notes || 'N/A'
              });
            }
          }
        }
      } else if (!isSplit && isAccountCreditCategory(txn.categoryId)) {
        const amount = centavosToPesos(txn.amount || 0);
        if (txnInFY && amount > 0) {
          totalCreditAdded += amount;
          creditTransactions.push({
            transactionId: txn.id,
            date: txnDate ? txnDate.toISOString().split('T')[0] : 'N/A',
            type: txn.type,
            unitId: txn.unitId || 'N/A',
            amount: amount,
            isAdded: true,
            allocation: null,
            notes: txn.notes || 'N/A'
          });
        }
      }
    }
    
    // Sort by date
    creditTransactions.sort((a, b) => a.date.localeCompare(b.date));
    
    // Get current credit balances
    console.log(`\nFetching current credit balances for all units...`);
    const unitsResponse = await api.get(`/clients/${clientId}/units`);
    const units = Array.isArray(unitsResponse.data) ? unitsResponse.data : [];
    
    const creditBalances = {};
    let totalCurrentBalance = 0;
    
    for (const unit of units) {
      if (unit.id === 'creditBalances') continue;
      
      try {
        const creditResponse = await api.get(`/clients/${clientId}/units/${unit.id}/credit`);
        const creditData = creditResponse.data;
        const balance = creditData.balance || 0;
        creditBalances[unit.id] = balance;
        totalCurrentBalance += balance;
      } catch (error) {
        // Unit might not have credit data
        creditBalances[unit.id] = 0;
      }
    }
    
    // Display summary
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`SUMMARY`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    console.log(`Account Credit Income (FY ${fiscalYear}):`);
    console.log(`  Credit Added:  $${formatPesos(totalCreditAdded)}`);
    console.log(`  Credit Used:   $${formatPesos(totalCreditUsed)}`);
    console.log(`  Net Change:    $${formatPesos(totalCreditAdded - totalCreditUsed)}`);
    console.log(`\nCurrent Credit Balances (Available to Spend):`);
    console.log(`  Total Balance: $${formatPesos(totalCurrentBalance)}`);
    console.log(`\nReconciliation:`);
    console.log(`  Starting Balance + Credit Added - Credit Used = Current Balance`);
    console.log(`  Starting Balance = Current Balance - Credit Added + Credit Used`);
    console.log(`  Starting Balance ≈ $${formatPesos(totalCurrentBalance - totalCreditAdded + totalCreditUsed)}`);
    
    // Display all transactions
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`ALL ACCOUNT CREDIT TRANSACTIONS (${creditTransactions.length} transactions)`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    
    let runningTotal = 0;
    for (const item of creditTransactions) {
      runningTotal += item.amount;
      const sign = item.isAdded ? '+' : '-';
      const label = item.isAdded ? 'CREDIT ADDED' : 'CREDIT USED';
      
      console.log(`\n${item.date} | ${item.transactionId}`);
      console.log(`  Unit: ${item.unitId}`);
      console.log(`  ${label}: ${sign}$${formatPesos(Math.abs(item.amount))}`);
      console.log(`  Notes: ${item.notes}`);
      if (item.allocation) {
        console.log(`  Allocation: ${item.allocation.categoryName} (${item.allocation.categoryId})`);
        if (item.allocation.data?.creditType) {
          console.log(`  Credit Type: ${item.allocation.data.creditType}`);
        }
      }
      console.log(`  Running Net: $${formatPesos(runningTotal)}`);
    }
    
    // Display current balances by unit
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`CURRENT CREDIT BALANCES BY UNIT`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    
    const sortedUnits = Object.entries(creditBalances)
      .filter(([unitId]) => unitId !== 'creditBalances')
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    
    for (const [unitId, balance] of sortedUnits) {
      if (balance !== 0) {
        console.log(`  ${unitId}: $${formatPesos(balance)}`);
      }
    }
    
    console.log(`\n  Total: $${formatPesos(totalCurrentBalance)}`);
    
    // Show breakdown by unit for transactions
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`CREDIT ACTIVITY BY UNIT`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    
    const unitSummary = {};
    for (const item of creditTransactions) {
      const unitId = item.unitId;
      if (!unitSummary[unitId]) {
        unitSummary[unitId] = { added: 0, used: 0, current: creditBalances[unitId] || 0 };
      }
      if (item.isAdded) {
        unitSummary[unitId].added += item.amount;
      } else {
        unitSummary[unitId].used += Math.abs(item.amount);
      }
    }
    
    for (const [unitId, summary] of Object.entries(unitSummary).sort((a, b) => {
      const aTotal = a[1].added - a[1].used;
      const bTotal = b[1].added - b[1].used;
      return Math.abs(bTotal) - Math.abs(aTotal);
    })) {
      if (summary.added > 0 || summary.used > 0 || summary.current !== 0) {
        console.log(`\n  ${unitId}:`);
        console.log(`    Credit Added:  $${formatPesos(summary.added)}`);
        console.log(`    Credit Used:   $${formatPesos(summary.used)}`);
        console.log(`    Net Change:    $${formatPesos(summary.added - summary.used)}`);
        console.log(`    Current Balance: $${formatPesos(summary.current)}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('Usage: node backend/testing/showAccountCreditDetail.js <clientId> <fiscalYear>');
    console.log('Example: node backend/testing/showAccountCreditDetail.js MTC 2025');
    process.exit(1);
  }
  
  const [clientId, fiscalYearStr] = args;
  const fiscalYear = parseInt(fiscalYearStr, 10);
  
  await testHarness.runTest({
    name: `Show Account Credit Detail for ${clientId} FY ${fiscalYear}`,
    async test({ api }) {
      await showAccountCreditDetail(api, clientId, fiscalYear);
      return { passed: true };
    }
  });
  
  testHarness.showSummary();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


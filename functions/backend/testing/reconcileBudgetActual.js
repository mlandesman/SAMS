/**
 * Reconcile Budget vs Actual Report
 * 
 * Analyzes why HOA Dues Actual doesn't match expected $600,000
 * and why Account Credit shows $63,203 instead of $23,729 current balance
 * 
 * Usage: node backend/testing/reconcileBudgetActual.js <clientId> <fiscalYear>
 * Example: node backend/testing/reconcileBudgetActual.js MTC 2025
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
 * Check if categoryId is HOA Dues
 */
function isHOADuesCategory(categoryId) {
  if (!categoryId) return false;
  const normalized = categoryId.toLowerCase();
  return normalized === 'hoa-dues' || normalized === 'hoadues' || normalized === 'hoa_dues';
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
 * Reconcile the discrepancy
 */
async function reconcileBudgetActual(api, clientId, fiscalYear) {
  try {
    // Get client configuration
    const clientResponse = await api.get(`/clients/${clientId}`);
    const clientData = clientResponse.data;
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    const fiscalYearBounds = getFiscalYearBounds(fiscalYear, fiscalYearStartMonth);
    
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`RECONCILIATION ANALYSIS FOR FISCAL YEAR ${fiscalYear}`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    console.log(`Fiscal Year Period: ${fiscalYearBounds.startDate.toISOString().split('T')[0]} to ${fiscalYearBounds.endDate.toISOString().split('T')[0]}`);
    
    // Query all income transactions
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', '2024-01-01');
    queryParams.append('endDate', '2025-12-31');
    
    const transactionsResponse = await api.get(`/clients/${clientId}/transactions?${queryParams.toString()}`);
    const allTransactions = Array.isArray(transactionsResponse.data) ? transactionsResponse.data : [];
    const deposits = allTransactions.filter(txn => txn.type === 'income' && (txn.amount || 0) > 0);
    
    console.log(`\nTotal deposits found: ${deposits.length}`);
    
    // Analyze HOA Dues allocations
    const hoaDuesCounted = [];
    const hoaDuesExcluded = [];
    const accountCreditAdded = [];
    const accountCreditUsed = [];
    
    let totalHOAAllocations = 0;
    let totalHOACounted = 0;
    let totalHOAExcluded = 0;
    let totalCreditAdded = 0;
    let totalCreditUsed = 0;
    
    for (const deposit of deposits) {
      const depositDate = parseDate(deposit.date);
      const depositFiscalYear = depositDate ? getFiscalYear(depositDate, fiscalYearStartMonth) : null;
      const allocations = deposit.allocations || [];
      
      // Check if split transaction
      const isSplit = deposit.categoryId === '-split-' || 
                      deposit.categoryId === '-Split-' ||
                      deposit.categoryName === '-Split-' ||
                      (deposit.categoryId === null && allocations.length > 0);
      
      if (isSplit && allocations.length > 0) {
        for (const alloc of allocations) {
          const allocCategoryId = alloc.categoryId;
          const allocAmount = centavosToPesos(alloc.amount || 0);
          const allocData = alloc.data || {};
          const allocFiscalYear = allocData.year;
          
          if (isHOADuesCategory(allocCategoryId)) {
            totalHOAAllocations += allocAmount;
            if (allocFiscalYear === fiscalYear) {
              totalHOACounted += allocAmount;
              hoaDuesCounted.push({
                transactionId: deposit.id,
                depositDate: depositDate ? depositDate.toISOString().split('T')[0] : 'N/A',
                depositFY: depositFiscalYear,
                amount: allocAmount,
                month: allocData.month,
                targetName: alloc.targetName || alloc.targetId
              });
            } else {
              totalHOAExcluded += allocAmount;
              hoaDuesExcluded.push({
                transactionId: deposit.id,
                depositDate: depositDate ? depositDate.toISOString().split('T')[0] : 'N/A',
                depositFY: depositFiscalYear,
                amount: allocAmount,
                appliedFY: allocFiscalYear,
                month: allocData.month,
                targetName: alloc.targetName || alloc.targetId,
                reason: allocFiscalYear ? `Applied to FY ${allocFiscalYear} (not ${fiscalYear})` : 'No data.year specified'
              });
            }
          } else if (isAccountCreditCategory(allocCategoryId)) {
            if (allocAmount > 0) {
              // Credit added
              const depositInFY = depositDate && 
                depositDate.getTime() >= fiscalYearBounds.startDate.getTime() &&
                depositDate.getTime() <= fiscalYearBounds.endDate.getTime();
              if (depositInFY) {
                totalCreditAdded += allocAmount;
                accountCreditAdded.push({
                  transactionId: deposit.id,
                  depositDate: depositDate ? depositDate.toISOString().split('T')[0] : 'N/A',
                  amount: allocAmount
                });
              }
            } else {
              // Credit used (negative)
              totalCreditUsed += Math.abs(allocAmount);
              accountCreditUsed.push({
                transactionId: deposit.id,
                depositDate: depositDate ? depositDate.toISOString().split('T')[0] : 'N/A',
                amount: Math.abs(allocAmount)
              });
            }
          }
        }
      } else if (!isSplit && deposit.categoryId) {
        // Non-split transaction
        const categoryId = deposit.categoryId;
        const amount = centavosToPesos(deposit.amount || 0);
        const depositInFY = depositDate && 
          depositDate.getTime() >= fiscalYearBounds.startDate.getTime() &&
          depositDate.getTime() <= fiscalYearBounds.endDate.getTime();
        
        if (isHOADuesCategory(categoryId)) {
          totalHOAAllocations += amount;
          if (depositInFY) {
            totalHOACounted += amount;
            hoaDuesCounted.push({
              transactionId: deposit.id,
              depositDate: depositDate ? depositDate.toISOString().split('T')[0] : 'N/A',
              depositFY: depositFiscalYear,
              amount: amount,
              reason: 'Non-split transaction (no allocations) - using cash basis fallback'
            });
          } else {
            totalHOAExcluded += amount;
            hoaDuesExcluded.push({
              transactionId: deposit.id,
              depositDate: depositDate ? depositDate.toISOString().split('T')[0] : 'N/A',
              depositFY: depositFiscalYear,
              amount: amount,
              reason: 'Non-split transaction (no allocations) - deposit outside fiscal year'
            });
          }
        } else if (isAccountCreditCategory(categoryId) && amount > 0 && depositInFY) {
          totalCreditAdded += amount;
          accountCreditAdded.push({
            transactionId: deposit.id,
            depositDate: depositDate ? depositDate.toISOString().split('T')[0] : 'N/A',
            amount: amount,
            reason: 'Non-split transaction'
          });
        }
      }
    }
    
    // Summary
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`HOA DUES ANALYSIS (Accrual Basis)`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    console.log(`Total HOA Dues Allocations Found: $${formatPesos(totalHOAAllocations)}`);
    console.log(`  ✅ Counted for FY ${fiscalYear}: $${formatPesos(totalHOACounted)}`);
    console.log(`  ❌ Excluded (applied to other FY): $${formatPesos(totalHOAExcluded)}`);
    console.log(`\nExpected: $600,000.00`);
    console.log(`Actual Counted: $${formatPesos(totalHOACounted)}`);
    console.log(`Difference: $${formatPesos(600000 - totalHOACounted)}`);
    
    if (hoaDuesExcluded.length > 0) {
      console.log(`\n⚠️  Excluded HOA Dues Allocations (${hoaDuesExcluded.length}):`);
      hoaDuesExcluded.slice(0, 20).forEach(item => {
        console.log(`  • ${item.transactionId} (${item.depositDate}, FY ${item.depositFY})`);
        console.log(`    Amount: $${formatPesos(item.amount)}`);
        console.log(`    Reason: ${item.reason}`);
        if (item.appliedFY) {
          console.log(`    Applied to: ${item.targetName} (FY ${item.appliedFY})`);
        }
      });
      if (hoaDuesExcluded.length > 20) {
        console.log(`  ... and ${hoaDuesExcluded.length - 20} more`);
      }
    }
    
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`ACCOUNT CREDIT ANALYSIS (Cash Basis - Credit Added Only)`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    console.log(`Credit Added in FY ${fiscalYear}: $${formatPesos(totalCreditAdded)}`);
    console.log(`Credit Used (during year): $${formatPesos(totalCreditUsed)}`);
    console.log(`Net Credit Change: $${formatPesos(totalCreditAdded - totalCreditAdded)}`);
    console.log(`\nNote: Budget vs Actual shows credit ADDED, not current balance`);
    console.log(`Current balance ($23,729) = credit added - credit used + starting balance`);
    
    if (accountCreditAdded.length > 0) {
      console.log(`\nCredit Added Allocations (${accountCreditAdded.length}):`);
      accountCreditAdded.slice(0, 20).forEach(item => {
        console.log(`  • ${item.transactionId} (${item.depositDate}): $${formatPesos(item.amount)}`);
      });
      if (accountCreditAdded.length > 20) {
        console.log(`  ... and ${accountCreditAdded.length - 20} more`);
      }
    }
    
    // Check for transactions without allocations that should have them
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`TRANSACTIONS WITHOUT ALLOCATIONS (Potential Issues)`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    
    const hoaDuesWithoutAllocations = deposits.filter(deposit => {
      const isHOADues = isHOADuesCategory(deposit.categoryId);
      const hasAllocations = deposit.allocations && deposit.allocations.length > 0;
      const depositInFY = parseDate(deposit.date) && 
        parseDate(deposit.date).getTime() >= fiscalYearBounds.startDate.getTime() &&
        parseDate(deposit.date).getTime() <= fiscalYearBounds.endDate.getTime();
      return isHOADues && !hasAllocations && depositInFY;
    });
    
    if (hoaDuesWithoutAllocations.length > 0) {
      console.log(`Found ${hoaDuesWithoutAllocations.length} HOA Dues transactions in FY ${fiscalYear} without allocations:\n`);
      hoaDuesWithoutAllocations.forEach(deposit => {
        const amount = centavosToPesos(deposit.amount || 0);
        const date = parseDate(deposit.date);
        console.log(`  • ${deposit.id}`);
        console.log(`    Date: ${date ? date.toISOString().split('T')[0] : 'N/A'}`);
        console.log(`    Unit: ${deposit.unitId || 'N/A'}`);
        console.log(`    Amount: $${formatPesos(amount)}`);
        console.log(`    Notes: ${deposit.notes || 'N/A'}`);
        console.log(`    ⚠️  Using cash basis fallback (no allocations)`);
        console.log('');
      });
    } else {
      console.log(`✅ All HOA Dues transactions have allocations`);
    }
    
    // Final reconciliation
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`RECONCILIATION SUMMARY`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    console.log(`HOA Dues Expected: $600,000.00`);
    console.log(`HOA Dues Actual:   $${formatPesos(totalHOACounted)}`);
    console.log(`Shortfall:         $${formatPesos(600000 - totalHOACounted)}`);
    console.log(`\nPossible reasons for shortfall:`);
    console.log(`  1. Payments applied to bills outside FY ${fiscalYear} (prepayments for future FY)`);
    console.log(`  2. Payments without allocations using cash basis (deposit outside FY ${fiscalYear})`);
    console.log(`  3. Payments missing data.year in allocations`);
    console.log(`\nAccount Credit Added: $${formatPesos(totalCreditAdded)}`);
    console.log(`Account Credit Used:  $${formatPesos(totalCreditUsed)}`);
    console.log(`\nNote: $63,203 = total credit ADDED during the year (cash basis)`);
    console.log(`      $23,729 = current credit balance (credit added - credit used + starting balance)`);
    
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
    console.log('Usage: node backend/testing/reconcileBudgetActual.js <clientId> <fiscalYear>');
    console.log('Example: node backend/testing/reconcileBudgetActual.js MTC 2025');
    process.exit(1);
  }
  
  const [clientId, fiscalYearStr] = args;
  const fiscalYear = parseInt(fiscalYearStr, 10);
  
  await testHarness.runTest({
    name: `Reconcile Budget vs Actual for ${clientId} FY ${fiscalYear}`,
    async test({ api }) {
      await reconcileBudgetActual(api, clientId, fiscalYear);
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


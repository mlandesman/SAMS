/**
 * Analyze Budget vs Actual Allocations
 * 
 * This script examines transaction allocations to verify accrual-basis HOA Dues tracking
 * Specifically checks for prepayments (payments made in one fiscal year for bills in another)
 * 
 * Usage: node backend/testing/analyzeBudgetActualAllocations.js <clientId> [unitId]
 * Example: node backend/testing/analyzeBudgetActualAllocations.js MTC PH2B
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
 * Check if categoryId is Account Credit
 */
function isAccountCreditCategory(categoryId) {
  if (!categoryId) return false;
  const normalized = categoryId.toLowerCase();
  return normalized === 'account-credit' || normalized === 'account_credit' || normalized === 'accountcredit';
}

/**
 * Fetch transaction with allocations
 */
async function fetchTransaction(api, clientId, transactionId) {
  try {
    const response = await api.get(`/clients/${clientId}/transactions/${transactionId}`);
    return response.data || null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`  ❌ Error fetching transaction ${transactionId}:`, error.message);
    return null;
  }
}

/**
 * Analyze transactions for a unit or all units
 */
async function analyzeTransactions(api, clientId, unitId = null) {
  try {
    // Get client configuration
    console.log(`\n🔍 Fetching client configuration for ${clientId}...`);
    const clientResponse = await api.get(`/clients/${clientId}`);
    
    if (!clientResponse.data) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const clientData = clientResponse.data;
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    const now = getNow();
    const currentFiscalYear = getFiscalYear(now, fiscalYearStartMonth);
    const fiscalYearBounds = getFiscalYearBounds(currentFiscalYear, fiscalYearStartMonth);
    
    console.log(`📅 Fiscal Year Start Month: ${fiscalYearStartMonth}`);
    console.log(`📅 Current Fiscal Year: ${currentFiscalYear}`);
    console.log(`📅 Fiscal Year Period: ${fiscalYearBounds.startDate.toISOString().split('T')[0]} to ${fiscalYearBounds.endDate.toISOString().split('T')[0]}`);
    
    // Query transactions - look for transactions in 2024 and 2025
    console.log(`\n🔍 Querying transactions...`);
    const startDate = '2024-01-01';
    const endDate = '2025-12-31';
    
    // Build query parameters - don't filter by unitId in query (unitIds may have spaces/names)
    // We'll filter in memory after fetching
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', startDate);
    queryParams.append('endDate', endDate);
    
    const transactionsResponse = await api.get(`/clients/${clientId}/transactions?${queryParams.toString()}`);
    let transactions = Array.isArray(transactionsResponse.data) ? transactionsResponse.data : [];
    
    // Filter by unitId in memory (handles unitIds with spaces/names like "PH2B (Name)")
    if (unitId) {
      const originalCount = transactions.length;
      transactions = transactions.filter(txn => {
        const txnUnitId = txn.unitId || '';
        // Check if unitId matches exactly or is at the start of the unitId string (before space/paren)
        return txnUnitId === unitId || txnUnitId.startsWith(unitId + ' ') || txnUnitId.startsWith(unitId + '(');
      });
      console.log(`   Filtered ${transactions.length} transactions for unitId containing "${unitId}" (from ${originalCount} total)`);
    } else {
      console.log(`   Found ${transactions.length} total transactions`);
    }
    
    console.log(`   Found ${transactions.length} transactions`);
    
    // Filter transactions that have HOA Dues or Account Credit allocations
    const relevantTransactions = [];
    const hoaDuesByYear = new Map(); // fiscalYear -> { total: 0, allocations: [] }
    const accountCreditByYear = new Map(); // fiscalYear -> { total: 0, allocations: [] }
    
    for (const transaction of transactions) {
      const allocations = transaction.allocations || [];
      const hasHOADues = allocations.some(a => isHOADuesCategory(a.categoryId));
      const hasAccountCredit = allocations.some(a => isAccountCreditCategory(a.categoryId));
      
      if (hasHOADues || hasAccountCredit) {
        relevantTransactions.push({
          transaction,
          hoaAllocations: allocations.filter(a => isHOADuesCategory(a.categoryId)),
          creditAllocations: allocations.filter(a => isAccountCreditCategory(a.categoryId))
        });
        
        // Process HOA Dues allocations
        allocations.forEach(alloc => {
          if (isHOADuesCategory(alloc.categoryId)) {
            const allocData = alloc.data || {};
            const allocFiscalYear = allocData.year;
            const allocAmount = centavosToPesos(alloc.amount || 0);
            
            if (allocFiscalYear) {
              if (!hoaDuesByYear.has(allocFiscalYear)) {
                hoaDuesByYear.set(allocFiscalYear, { total: 0, allocations: [] });
              }
              const yearData = hoaDuesByYear.get(allocFiscalYear);
              yearData.total += allocAmount;
              yearData.allocations.push({
                transactionId: transaction.id,
                transactionDate: transaction.date,
                amount: allocAmount,
                month: allocData.month,
                year: allocFiscalYear,
                targetName: alloc.targetName || alloc.targetId
              });
            }
          }
        });
        
        // Process Account Credit allocations
        allocations.forEach(alloc => {
          if (isAccountCreditCategory(alloc.categoryId)) {
            const transactionDate = parseDate(transaction.date);
            const transactionFiscalYear = transactionDate ? getFiscalYear(transactionDate, fiscalYearStartMonth) : null;
            const allocAmount = centavosToPesos(alloc.amount || 0);
            
            if (transactionFiscalYear) {
              if (!accountCreditByYear.has(transactionFiscalYear)) {
                accountCreditByYear.set(transactionFiscalYear, { total: 0, allocations: [] });
              }
              const yearData = accountCreditByYear.get(transactionFiscalYear);
              yearData.total += allocAmount;
              yearData.allocations.push({
                transactionId: transaction.id,
                transactionDate: transaction.date,
                amount: allocAmount
              });
            }
          }
        });
      }
    }
    
    console.log(`\n📊 Found ${relevantTransactions.length} transactions with HOA Dues or Account Credit allocations\n`);
    
    // Display summary by fiscal year
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    console.log(`HOA DUES ALLOCATIONS BY FISCAL YEAR (Accrual Basis - Applied Year):`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    
    const sortedHoaYears = Array.from(hoaDuesByYear.keys()).sort((a, b) => a - b);
    for (const year of sortedHoaYears) {
      const yearData = hoaDuesByYear.get(year);
      console.log(`\nFiscal Year ${year}:`);
      console.log(`  Total HOA Dues Applied: $${formatPesos(yearData.total)}`);
      console.log(`  Number of Allocations: ${yearData.allocations.length}`);
      
      // Show transaction details
      const transactionsByTxn = new Map();
      yearData.allocations.forEach(alloc => {
        if (!transactionsByTxn.has(alloc.transactionId)) {
          transactionsByTxn.set(alloc.transactionId, []);
        }
        transactionsByTxn.get(alloc.transactionId).push(alloc);
      });
      
      console.log(`  Transactions:`);
      for (const [txnId, allocs] of transactionsByTxn.entries()) {
        const txn = transactions.find(t => t.id === txnId);
        const txnDate = parseDate(txn?.date);
        const txnDateStr = txnDate ? txnDate.toISOString().split('T')[0] : 'N/A';
        const txnFiscalYear = txnDate ? getFiscalYear(txnDate, fiscalYearStartMonth) : null;
        const totalAllocAmount = allocs.reduce((sum, a) => sum + a.amount, 0);
        
        console.log(`    Transaction: ${txnId}`);
        console.log(`      Payment Date: ${txnDateStr} (FY ${txnFiscalYear})`);
        console.log(`      Total HOA Dues Applied to FY ${year}: $${formatPesos(totalAllocAmount)}`);
        
        allocs.forEach(alloc => {
          console.log(`        • ${alloc.targetName || `Month ${alloc.month}`}: $${formatPesos(alloc.amount)}`);
        });
        
        // Highlight prepayments (payment in different fiscal year than applied year)
        if (txnFiscalYear && txnFiscalYear !== year) {
          console.log(`        ⚠️  PREPAYMENT: Paid in FY ${txnFiscalYear} but applied to FY ${year}`);
        }
      }
    }
    
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`ACCOUNT CREDIT ALLOCATIONS BY FISCAL YEAR (Cash Basis - Payment Year):`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    
    const sortedCreditYears = Array.from(accountCreditByYear.keys()).sort((a, b) => a - b);
    for (const year of sortedCreditYears) {
      const yearData = accountCreditByYear.get(year);
      console.log(`\nFiscal Year ${year}:`);
      console.log(`  Total Account Credit: $${formatPesos(yearData.total)}`);
      console.log(`  Number of Allocations: ${yearData.allocations.length}`);
      
      yearData.allocations.forEach(alloc => {
        const txnDate = parseDate(alloc.transactionDate);
        const txnDateStr = txnDate ? txnDate.toISOString().split('T')[0] : 'N/A';
        console.log(`    Transaction: ${alloc.transactionId} (${txnDateStr}): $${formatPesos(alloc.amount)}`);
      });
    }
    
    // Detailed transaction breakdown
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`DETAILED TRANSACTION BREAKDOWN:`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    
    for (const { transaction, hoaAllocations, creditAllocations } of relevantTransactions) {
      const txnDate = parseDate(transaction.date);
      const txnDateStr = txnDate ? txnDate.toISOString().split('T')[0] : 'N/A';
      const txnFiscalYear = txnDate ? getFiscalYear(txnDate, fiscalYearStartMonth) : null;
      const txnAmount = centavosToPesos(transaction.amount || 0);
      
      console.log(`\nTransaction: ${transaction.id}`);
      console.log(`  Date: ${txnDateStr} (FY ${txnFiscalYear})`);
      console.log(`  Unit: ${transaction.unitId || 'N/A'}`);
      console.log(`  Total Amount: $${formatPesos(txnAmount)}`);
      console.log(`  Payment Method: ${transaction.paymentMethod || transaction.method || 'N/A'}`);
      
      if (hoaAllocations.length > 0) {
        console.log(`  HOA Dues Allocations (${hoaAllocations.length}):`);
        hoaAllocations.forEach(alloc => {
          const allocData = alloc.data || {};
          const allocFiscalYear = allocData.year;
          const allocAmount = centavosToPesos(alloc.amount || 0);
          const month = allocData.month;
          const targetName = alloc.targetName || alloc.targetId || 'Unknown';
          
          console.log(`    • ${targetName}`);
          console.log(`      Amount: $${formatPesos(allocAmount)}`);
          console.log(`      Applied to FY: ${allocFiscalYear || 'N/A'}${month ? `, Month: ${month}` : ''}`);
          console.log(`      Category ID: ${alloc.categoryId || 'N/A'}`);
          
          if (allocFiscalYear && txnFiscalYear && allocFiscalYear !== txnFiscalYear) {
            console.log(`      ⚠️  PREPAYMENT: Payment in FY ${txnFiscalYear}, Applied to FY ${allocFiscalYear}`);
          }
        });
      }
      
      if (creditAllocations.length > 0) {
        console.log(`  Account Credit Allocations (${creditAllocations.length}):`);
        creditAllocations.forEach(alloc => {
          const allocAmount = centavosToPesos(alloc.amount || 0);
          console.log(`    • Amount: $${formatPesos(allocAmount)} (categoryId: ${alloc.categoryId || 'N/A'})`);
        });
      }
      
      // Show all allocations for context
      const allAllocations = transaction.allocations || [];
      if (allAllocations.length > hoaAllocations.length + creditAllocations.length) {
        console.log(`  Other Allocations:`);
        allAllocations.forEach(alloc => {
          if (!isHOADuesCategory(alloc.categoryId) && !isAccountCreditCategory(alloc.categoryId)) {
            const allocAmount = centavosToPesos(alloc.amount || 0);
            console.log(`    • ${alloc.categoryName || alloc.categoryId || 'Unknown'}: $${formatPesos(allocAmount)}`);
          }
        });
      }
    }
    
    // Summary for current fiscal year
    console.log(`\n═══════════════════════════════════════════════════════════════════════`);
    console.log(`SUMMARY FOR FISCAL YEAR ${currentFiscalYear}:`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    
    const currentYearHoa = hoaDuesByYear.get(currentFiscalYear);
    const currentYearCredit = accountCreditByYear.get(currentFiscalYear);
    
    console.log(`HOA Dues (Accrual Basis - Applied to FY ${currentFiscalYear}):`);
    console.log(`  Total: $${formatPesos(currentYearHoa?.total || 0)}`);
    console.log(`  Allocations: ${currentYearHoa?.allocations.length || 0}`);
    
    console.log(`\nAccount Credit (Cash Basis - Paid in FY ${currentFiscalYear}):`);
    console.log(`  Total: $${formatPesos(currentYearCredit?.total || 0)}`);
    console.log(`  Allocations: ${currentYearCredit?.allocations.length || 0}`);
    
    return {
      hoaDuesByYear,
      accountCreditByYear,
      relevantTransactions
    };
    
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
  
  if (args.length < 1 || args.length > 2) {
    console.log('Usage: node backend/testing/analyzeBudgetActualAllocations.js <clientId> [unitId]');
    console.log('Example: node backend/testing/analyzeBudgetActualAllocations.js MTC PH2B');
    process.exit(1);
  }
  
  const [clientId, unitId] = args;
  
  await testHarness.runTest({
    name: `Analyze Budget vs Actual Allocations for ${clientId}${unitId ? ` unit ${unitId}` : ''}`,
    async test({ api }) {
      console.log(`🏢 Client: ${clientId}`);
      if (unitId) {
        console.log(`🏠 Unit: ${unitId}`);
      } else {
        console.log(`🏠 Unit: ALL`);
      }
      
      await analyzeTransactions(api, clientId, unitId);
      
      return {
        passed: true,
        message: 'Analysis completed successfully'
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


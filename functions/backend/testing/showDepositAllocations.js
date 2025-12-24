/**
 * Show Deposit Allocations
 * 
 * Shows every deposit transaction and how the money is allocated,
 * using the accrual-basis algorithm from budgetActualDataService
 * 
 * Usage: node backend/testing/showDepositAllocations.js <clientId> [fiscalYear]
 * Example: node backend/testing/showDepositAllocations.js MTC 2025
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
 * Check if categoryId is HOA Dues (supports legacy formats)
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
 * Show deposit allocations
 */
async function showDepositAllocations(api, clientId, targetFiscalYear = null) {
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
    // Suppress fiscal year calculation debug logs
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      if (!args[0] || typeof args[0] !== 'string' || !args[0].includes('[FISCAL YEAR]')) {
        originalConsoleLog(...args);
      }
    };
    const effectiveFiscalYear = targetFiscalYear || getFiscalYear(now, fiscalYearStartMonth);
    const fiscalYearBounds = getFiscalYearBounds(effectiveFiscalYear, fiscalYearStartMonth);
    console.log = originalConsoleLog;
    
    console.log(`📅 Fiscal Year Start Month: ${fiscalYearStartMonth}`);
    console.log(`📅 Target Fiscal Year: ${effectiveFiscalYear}`);
    console.log(`📅 Fiscal Year Period: ${fiscalYearBounds.startDate.toISOString().split('T')[0]} to ${fiscalYearBounds.endDate.toISOString().split('T')[0]}`);
    
    // Query all income transactions (deposits)
    console.log(`\n🔍 Querying income transactions...`);
    const startDate = '2024-01-01';
    const endDate = '2025-12-31';
    
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', startDate);
    queryParams.append('endDate', endDate);
    
    const transactionsResponse = await api.get(`/clients/${clientId}/transactions?${queryParams.toString()}`);
    const allTransactions = Array.isArray(transactionsResponse.data) ? transactionsResponse.data : [];
    
    // Filter to income transactions only (type === 'income' and amount > 0)
    const deposits = allTransactions.filter(txn => 
      txn.type === 'income' && (txn.amount || 0) > 0
    );
    
    console.log(`   Found ${deposits.length} deposit transactions (from ${allTransactions.length} total transactions)\n`);
    
    // Process each deposit
    let depositNumber = 0;
    const summary = {
      totalDeposits: 0,
      hoaDuesAppliedToTargetFY: 0,
      hoaDuesAppliedToOtherFY: 0,
      accountCreditInTargetFY: 0,
      accountCreditInOtherFY: 0,
      otherCategories: 0
    };
    
    for (const deposit of deposits) {
      depositNumber++;
      const depositDate = parseDate(deposit.date);
      const depositDateStr = depositDate ? depositDate.toISOString().split('T')[0] : 'N/A';
      const depositFiscalYear = depositDate ? getFiscalYear(depositDate, fiscalYearStartMonth) : null;
      const depositAmount = centavosToPesos(deposit.amount || 0);
      const unitId = deposit.unitId || 'N/A';
      
      summary.totalDeposits += depositAmount;
      
      console.log(`═══════════════════════════════════════════════════════════════════════`);
      console.log(`Deposit #${depositNumber}: ${deposit.id}`);
      console.log(`  Date: ${depositDateStr} (FY ${depositFiscalYear || 'N/A'})`);
      console.log(`  Unit: ${unitId}`);
      console.log(`  Amount: $${formatPesos(depositAmount)}`);
      console.log(`  Payment Method: ${deposit.paymentMethod || deposit.method || 'N/A'}`);
      console.log(`  Notes: ${deposit.notes || 'N/A'}`);
      
      // Check if this is a split transaction
      const isSplit = deposit.categoryId === '-split-' || 
                      deposit.categoryId === '-Split-' ||
                      deposit.categoryName === '-Split-' ||
                      (deposit.categoryId === null && deposit.allocations && deposit.allocations.length > 0);
      
      if (isSplit && deposit.allocations && Array.isArray(deposit.allocations)) {
        console.log(`\n  Allocations (${deposit.allocations.length}):`);
        
        let allocationNumber = 0;
        for (const allocation of deposit.allocations) {
          allocationNumber++;
          const allocCategoryId = allocation.categoryId || 'N/A';
          const allocAmount = centavosToPesos(allocation.amount || 0);
          const allocData = allocation.data || {};
          const allocFiscalYear = allocData.year;
          
          console.log(`\n    ${allocationNumber}. ${allocation.categoryName || allocCategoryId}`);
          console.log(`       Amount: $${formatPesos(allocAmount)}`);
          console.log(`       Category ID: ${allocCategoryId}`);
          
          // Apply accrual-basis algorithm (same as budgetActualDataService)
          if (isHOADuesCategory(allocCategoryId)) {
            // ACCRUAL BASIS: Count only if applied to target fiscal year
            if (allocFiscalYear === effectiveFiscalYear) {
              console.log(`       ✅ COUNTS for HOA Dues in FY ${effectiveFiscalYear} (Accrual Basis)`);
              console.log(`          → Applied to: ${allocation.targetName || allocation.targetId || 'N/A'}`);
              if (allocData.month) {
                console.log(`          → Month: ${allocData.month}`);
              }
              summary.hoaDuesAppliedToTargetFY += allocAmount;
            } else {
              console.log(`       ❌ Does NOT count for FY ${effectiveFiscalYear}`);
              console.log(`          → Applied to FY ${allocFiscalYear || 'N/A'}`);
              console.log(`          → Applied to: ${allocation.targetName || allocation.targetId || 'N/A'}`);
              if (allocFiscalYear) {
                summary.hoaDuesAppliedToOtherFY += allocAmount;
              }
            }
          } else if (isAccountCreditCategory(allocCategoryId)) {
            // CASH BASIS: Count if transaction date is in target fiscal year
            const depositInTargetFY = depositDate && 
              depositDate.getTime() >= fiscalYearBounds.startDate.getTime() &&
              depositDate.getTime() <= fiscalYearBounds.endDate.getTime();
            
            if (depositInTargetFY) {
              console.log(`       ✅ COUNTS for Account Credit in FY ${effectiveFiscalYear} (Cash Basis)`);
              summary.accountCreditInTargetFY += allocAmount;
            } else {
              console.log(`       ❌ Does NOT count for FY ${effectiveFiscalYear}`);
              console.log(`          → Deposit was in FY ${depositFiscalYear || 'N/A'}`);
              if (depositFiscalYear) {
                summary.accountCreditInOtherFY += allocAmount;
              }
            }
          } else {
            // Other categories (cash basis - transaction date)
            const depositInTargetFY = depositDate && 
              depositDate.getTime() >= fiscalYearBounds.startDate.getTime() &&
              depositDate.getTime() <= fiscalYearBounds.endDate.getTime();
            
            if (depositInTargetFY) {
              console.log(`       ✅ COUNTS for "${allocation.categoryName || allocCategoryId}" in FY ${effectiveFiscalYear} (Cash Basis)`);
              summary.otherCategories += allocAmount;
            } else {
              console.log(`       ❌ Does NOT count for FY ${effectiveFiscalYear}`);
              console.log(`          → Deposit was in FY ${depositFiscalYear || 'N/A'}`);
            }
          }
        }
      } else if (deposit.categoryId && deposit.categoryId !== '-split-' && deposit.categoryId !== '-Split-') {
        // Regular (non-split) transaction
        const categoryId = deposit.categoryId;
        const categoryName = deposit.categoryName || categoryId;
        
        console.log(`\n  Category: ${categoryName} (${categoryId})`);
        console.log(`  Note: Non-split transaction - using transaction date`);
        
        // For non-split transactions, use cash basis (transaction date)
        const depositInTargetFY = depositDate && 
          depositDate.getTime() >= fiscalYearBounds.startDate.getTime() &&
          depositDate.getTime() <= fiscalYearBounds.endDate.getTime();
        
        if (isHOADuesCategory(categoryId)) {
          if (depositInTargetFY) {
            console.log(`  ✅ COUNTS for HOA Dues in FY ${effectiveFiscalYear} (Cash Basis - legacy transaction)`);
            summary.hoaDuesAppliedToTargetFY += depositAmount;
          } else {
            console.log(`  ❌ Does NOT count for FY ${effectiveFiscalYear} (deposit was in FY ${depositFiscalYear || 'N/A'})`);
          }
        } else if (isAccountCreditCategory(categoryId)) {
          if (depositInTargetFY) {
            console.log(`  ✅ COUNTS for Account Credit in FY ${effectiveFiscalYear} (Cash Basis)`);
            summary.accountCreditInTargetFY += depositAmount;
          } else {
            console.log(`  ❌ Does NOT count for FY ${effectiveFiscalYear} (deposit was in FY ${depositFiscalYear || 'N/A'})`);
          }
        } else {
          if (depositInTargetFY) {
            console.log(`  ✅ COUNTS for "${categoryName}" in FY ${effectiveFiscalYear} (Cash Basis)`);
            summary.otherCategories += depositAmount;
          } else {
            console.log(`  ❌ Does NOT count for FY ${effectiveFiscalYear} (deposit was in FY ${depositFiscalYear || 'N/A'})`);
          }
        }
      } else {
        console.log(`\n  ⚠️  Transaction has no allocations or categoryId - skipping`);
      }
      
      console.log('');
    }
    
    // Summary
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    console.log(`SUMMARY FOR FISCAL YEAR ${effectiveFiscalYear}:`);
    console.log(`═══════════════════════════════════════════════════════════════════════`);
    console.log(`Total Deposits: $${formatPesos(summary.totalDeposits)}`);
    console.log(``);
    console.log(`HOA Dues (Accrual Basis - Applied to FY ${effectiveFiscalYear}):`);
    console.log(`  Counted: $${formatPesos(summary.hoaDuesAppliedToTargetFY)}`);
    console.log(`  Excluded (applied to other FY): $${formatPesos(summary.hoaDuesAppliedToOtherFY)}`);
    console.log(``);
    console.log(`Account Credit (Cash Basis - Paid in FY ${effectiveFiscalYear}):`);
    console.log(`  Counted: $${formatPesos(summary.accountCreditInTargetFY)}`);
    console.log(`  Excluded (paid in other FY): $${formatPesos(summary.accountCreditInOtherFY)}`);
    console.log(``);
    console.log(`Other Income Categories: $${formatPesos(summary.otherCategories)}`);
    console.log(``);
    console.log(`TOTAL COUNTED FOR FY ${effectiveFiscalYear}: $${formatPesos(
      summary.hoaDuesAppliedToTargetFY + 
      summary.accountCreditInTargetFY + 
      summary.otherCategories
    )}`);
    
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
    console.log('Usage: node backend/testing/showDepositAllocations.js <clientId> [fiscalYear]');
    console.log('Example: node backend/testing/showDepositAllocations.js MTC 2025');
    process.exit(1);
  }
  
  const [clientId, fiscalYearStr] = args;
  const fiscalYear = fiscalYearStr ? parseInt(fiscalYearStr, 10) : null;
  
  await testHarness.runTest({
    name: `Show Deposit Allocations for ${clientId}${fiscalYear ? ` FY ${fiscalYear}` : ''}`,
    async test({ api }) {
      console.log(`🏢 Client: ${clientId}`);
      if (fiscalYear) {
        console.log(`📅 Fiscal Year: ${fiscalYear}`);
      }
      
      await showDepositAllocations(api, clientId, fiscalYear);
      
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


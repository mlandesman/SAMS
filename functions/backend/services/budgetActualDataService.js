/**
 * Budget vs Actual Data Service
 * 
 * Aggregates budget and actual expense data for Budget vs Actual report
 * Follows Statement of Account pattern for consistency
 */

import { getDb } from '../firebase.js';
import { getNow } from './DateService.js';
import { getFiscalYear, getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { listBudgetsByYear } from '../controllers/budgetController.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';

const { convertToTimestamp } = databaseFieldMappings;

/**
 * Get Budget vs Actual data for a client and fiscal year
 * @param {string} clientId - Client ID
 * @param {number|null} fiscalYear - Fiscal year (null = current fiscal year)
 * @param {Object} user - User object for propertyAccess validation
 * @returns {Promise<Object>} Budget vs Actual data structure
 */
export async function getBudgetActualData(clientId, fiscalYear, user) {
  try {
    if (!clientId || !user) {
      throw new Error('Missing required parameters: clientId or user');
    }

    // Validate propertyAccess
    if (!user.isSuperAdmin() && !user.hasPropertyAccess(clientId)) {
      throw new Error(`User ${user.email} lacks access to client ${clientId}`);
    }

    const db = await getDb();

    // Fetch client info
    const clientDoc = await db.doc(`clients/${clientId}`).get();
    if (!clientDoc.exists) {
      throw new Error(`Client ${clientId} not found`);
    }

    const clientData = clientDoc.data();
    // Get client name using same path as Statement service
    const clientName = clientData.basicInfo?.fullName || clientData.basicInfo?.displayName || clientData.name || clientData.displayName || clientId;
    // Handle logoUrl (convert empty string to null, check branding path)
    const logoUrl = clientData.branding?.logoUrl;
    const normalizedLogoUrl = logoUrl && logoUrl.trim() !== '' ? logoUrl : null;
    
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);

    // Calculate % of fiscal year elapsed
    const now = getNow();
    const reportDate = now;
    
    // Calculate current fiscal year if not provided
    const effectiveFiscalYear = fiscalYear || getFiscalYear(now, fiscalYearStartMonth);

    // Get fiscal year bounds
    const { startDate, endDate } = getFiscalYearBounds(effectiveFiscalYear, fiscalYearStartMonth);
    const startTimestamp = convertToTimestamp(startDate);
    const endTimestamp = convertToTimestamp(endDate);
    const fiscalYearStart = startDate.getTime();
    const fiscalYearEnd = endDate.getTime();
    const fiscalYearDuration = fiscalYearEnd - fiscalYearStart;
    const elapsedTime = Math.min(now.getTime() - fiscalYearStart, fiscalYearDuration);
    const actualPercentOfYearElapsed = Math.max(0, Math.min(100, (elapsedTime / fiscalYearDuration) * 100));
    
    // YEAR-END ADJUSTMENT: When >95% of year elapsed, treat as 100% for budget comparisons
    // This makes the report more useful for year-end reporting (final 2 weeks)
    // Variance calculations will compare YTD Actual vs Full Annual Budget instead of prorated YTD Budget
    let percentOfYearElapsed = actualPercentOfYearElapsed;
    if (actualPercentOfYearElapsed > 95) {
      percentOfYearElapsed = 100;
    }

    // Fetch all categories for this client
    const categoriesSnapshot = await db.collection(`clients/${clientId}/categories`).get();
    const categories = [];
    categoriesSnapshot.forEach(doc => {
      categories.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Fetch budgets for fiscal year
    const budgets = await listBudgetsByYear(clientId, effectiveFiscalYear, user);
    const budgetMap = new Map();
    budgets.forEach(budget => {
      budgetMap.set(budget.categoryId, budget.amount || 0);
    });

    // Fetch all transactions within fiscal year (filter type/categoryId in memory to avoid index requirement)
    // NOTE: We need transactions outside the fiscal year date range too, for accrual-basis HOA Dues
    // (payments made in different fiscal year but applied to bills in this fiscal year)
    // So we query a broader date range and filter in memory
    const extendedStartDate = new Date(startDate);
    extendedStartDate.setFullYear(extendedStartDate.getFullYear() - 1); // Look back 1 year for prepayments
    const extendedStartTimestamp = convertToTimestamp(extendedStartDate);
    
    const extendedEndDate = new Date(endDate);
    extendedEndDate.setFullYear(extendedEndDate.getFullYear() + 1); // Look ahead 1 year for late payments
    const extendedEndTimestamp = convertToTimestamp(extendedEndDate);
    
    const transactionsSnapshot = await db.collection(`clients/${clientId}/transactions`)
      .where('date', '>=', extendedStartTimestamp)
      .where('date', '<=', extendedEndTimestamp)
      .get();

    // Helper function to check if categoryId is HOA Dues (supports legacy formats)
    // Supports: 'hoa-dues' (current standard), 'hoadues' (legacy), 'hoa_dues' (legacy)
    const isHOADuesCategory = (categoryId) => {
      if (!categoryId) return false;
      const normalized = categoryId.toLowerCase();
      return normalized === 'hoa-dues' || normalized === 'hoadues' || normalized === 'hoa_dues';
    };

    // Helper function to check if categoryId is Account Credit related
    const isAccountCreditCategory = (categoryId) => {
      if (!categoryId) return false;
      const normalized = categoryId.toLowerCase();
      return normalized === 'account-credit' || 
             normalized === 'account_credit' || 
             normalized === 'accountcredit' ||
             normalized === 'credit_added' ||
             normalized === 'credit_used' ||
             normalized === 'account-credit-used';
    };

    // Aggregate actual transactions by category (both income and expenses)
    // Use actual signed values - expenses are negative, income is positive
    // This allows transfers to net correctly (positive + negative = net)
    // Handle split transactions by processing allocations array
    // SPECIAL HANDLING: HOA Dues uses accrual-basis (allocations filtered by target fiscal year)
    const actualMap = new Map();
    
    // Account Credit will be fetched from creditBalances document (single source of truth)
    // No need to track from transactions - we'll query creditBalances directly
    transactionsSnapshot.forEach(doc => {
      const transaction = doc.data();
      
      // Check if this is a split transaction
      const isSplit = transaction.categoryId === '-split-' || 
                      transaction.categoryId === '-Split-' ||
                      transaction.categoryName === '-Split-' ||
                      (transaction.categoryId === null && transaction.allocations && transaction.allocations.length > 0);
      
      if (isSplit && transaction.allocations && Array.isArray(transaction.allocations)) {
        // Process split transaction: aggregate by allocation categoryId using actual signed values
        transaction.allocations.forEach(allocation => {
          if (allocation.categoryId) {
            const categoryId = allocation.categoryId;
            
            // ACCRUAL BASIS: For HOA Dues, only count allocations applied to bills in this fiscal year
            // This means: Count income when it's applied to a bill, not when payment is received
            // Example: Payment received in Nov 2025 covering Dec 2025 bill -> counts in 2025 (when applied)
            //          Payment received in Nov 2025 covering Jan 2026 bill -> counts in 2026 (when applied)
            if (isHOADuesCategory(categoryId)) {
              // Check if allocation has data.year matching the target fiscal year
              const allocationData = allocation.data || {};
              const allocationFiscalYear = allocationData.year;
              
              // Only count if this allocation is applied to a bill in the target fiscal year
              if (allocationFiscalYear === effectiveFiscalYear) {
                const currentActual = actualMap.get(categoryId) || 0;
                const allocationAmount = allocation.amount || 0; // Amount is in centavos (signed, positive for income)
                actualMap.set(categoryId, currentActual + allocationAmount);
              }
              // Skip allocations applied to other fiscal years (prepayments/future payments)
            } else {
              // CASH BASIS: For all other categories, use transaction date (current behavior)
              // Check if transaction date is within fiscal year
              const transactionDate = transaction.date;
              let transactionInFiscalYear = false;
              
              if (transactionDate) {
                // Handle various date formats
                let dateObj;
                if (transactionDate.toDate && typeof transactionDate.toDate === 'function') {
                  dateObj = transactionDate.toDate();
                } else if (transactionDate.iso) {
                  // Handle date objects with .iso property (common in SAMS transactions)
                  dateObj = new Date(transactionDate.iso);
                } else if (typeof transactionDate === 'string') {
                  dateObj = new Date(transactionDate);
                } else if (transactionDate instanceof Date) {
                  dateObj = transactionDate;
                } else if (transactionDate.seconds) {
                  dateObj = new Date(transactionDate.seconds * 1000);
                } else {
                  dateObj = new Date(transactionDate);
                }
                
                const transactionTime = dateObj.getTime();
                transactionInFiscalYear = transactionTime >= fiscalYearStart && transactionTime <= fiscalYearEnd;
              }
              
              if (transactionInFiscalYear) {
                // Skip Account Credit allocations - we'll get this data from creditBalances document
                if (isAccountCreditCategory(categoryId)) {
                  // Don't add Account Credit to actualMap - we track it separately from creditBalances
                  return; // Skip this allocation (return from forEach callback = continue)
                }
                
                // For all other categories, add to actualMap normally
                const currentActual = actualMap.get(categoryId) || 0;
                const allocationAmount = allocation.amount || 0; // Amount is in centavos (signed)
                actualMap.set(categoryId, currentActual + allocationAmount);
              }
            }
          }
        });
      } else if (transaction.categoryId && transaction.categoryId !== '-split-' && transaction.categoryId !== '-Split-') {
        // Regular (non-split) transaction - use actual signed value
        const categoryId = transaction.categoryId;
        
        // ACCRUAL BASIS: For HOA Dues regular transactions (rare, but handle for legacy data)
        if (isHOADuesCategory(categoryId)) {
          // For non-split HOA Dues transactions, we can't determine target fiscal year from allocation data
          // So we fall back to transaction date (this handles legacy pre-UPS transactions)
          const transactionDate = transaction.date;
          let transactionInFiscalYear = false;
          
          if (transactionDate) {
            let dateObj;
            if (transactionDate.toDate && typeof transactionDate.toDate === 'function') {
              dateObj = transactionDate.toDate();
            } else if (transactionDate.iso) {
              // Handle date objects with .iso property (common in SAMS transactions)
              dateObj = new Date(transactionDate.iso);
            } else if (typeof transactionDate === 'string') {
              dateObj = new Date(transactionDate);
            } else if (transactionDate instanceof Date) {
              dateObj = transactionDate;
            } else if (transactionDate.seconds) {
              dateObj = new Date(transactionDate.seconds * 1000);
            } else {
              dateObj = new Date(transactionDate);
            }
            
            const transactionTime = dateObj.getTime();
            transactionInFiscalYear = transactionTime >= fiscalYearStart && transactionTime <= fiscalYearEnd;
          }
          
          if (transactionInFiscalYear) {
            const currentActual = actualMap.get(categoryId) || 0;
            const amount = transaction.amount || 0; // Amount is in centavos (signed: positive for income)
            actualMap.set(categoryId, currentActual + amount);
          }
        } else if (isAccountCreditCategory(categoryId)) {
          // Skip Account Credit non-split transactions - we'll get this data from creditBalances document
          // Don't add Account Credit to actualMap - we track it separately from creditBalances
          // (no need to process - we'll fetch from creditBalances document later)
        } else {
          // CASH BASIS: For all other categories, use transaction date within fiscal year
          const transactionDate = transaction.date;
          let transactionInFiscalYear = false;
          
          if (transactionDate) {
            let dateObj;
            if (transactionDate.toDate && typeof transactionDate.toDate === 'function') {
              dateObj = transactionDate.toDate();
            } else if (transactionDate.iso) {
              // Handle date objects with .iso property (common in SAMS transactions)
              dateObj = new Date(transactionDate.iso);
            } else if (typeof transactionDate === 'string') {
              dateObj = new Date(transactionDate);
            } else if (transactionDate instanceof Date) {
              dateObj = transactionDate;
            } else if (transactionDate.seconds) {
              dateObj = new Date(transactionDate.seconds * 1000);
            } else {
              dateObj = new Date(transactionDate);
            }
            
            const transactionTime = dateObj.getTime();
            transactionInFiscalYear = transactionTime >= fiscalYearStart && transactionTime <= fiscalYearEnd;
          }
          
          if (transactionInFiscalYear) {
            const currentActual = actualMap.get(categoryId) || 0;
            const amount = transaction.amount || 0; // Amount is in centavos (signed: negative for expenses, positive for income)
            actualMap.set(categoryId, currentActual + amount);
          }
        }
      }
    });

    // Helper function to check if category is a project category
    const isProjectCategory = (categoryId, categoryName) => {
      const idLower = (categoryId || '').toLowerCase();
      const nameLower = (categoryName || '').toLowerCase();
      return idLower.startsWith('projects') || nameLower.startsWith('projects');
    };

    // Helper function to check if category is special assessments
    const isSpecialAssessmentsCategory = (categoryId) => {
      return (categoryId || '').toLowerCase() === 'special_assessments' || 
             (categoryId || '').toLowerCase() === 'special-assessments';
    };

    // Build category data and split into three tables
    const incomeCategories = [];
    const expenseCategories = [];
    
    // Special Assessments structure: collections (income) + expenditures (expenses)
    let specialAssessmentsCollections = null; // Single income category
    const specialAssessmentsExpenditures = []; // Multiple project expense categories
    
    // Unit Credit Accounts: Fetch from creditBalances document (single source of truth)
    // This is cleaner than parsing transaction allocations with various category IDs
    let accountCreditAdded = 0; // Credit added (positive amounts, in centavos)
    let accountCreditUsed = 0;  // Credit used (negative amounts converted to positive, in centavos)
    
    try {
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      const creditBalancesDoc = await creditBalancesRef.get();
      
      if (creditBalancesDoc.exists) {
        const creditBalancesData = creditBalancesDoc.data();
        const fiscalYearStartTimestamp = startDate.getTime();
        const fiscalYearEndTimestamp = endDate.getTime();
        
        // Iterate through all units in the creditBalances document
        for (const [unitId, unitCreditData] of Object.entries(creditBalancesData)) {
          if (!unitCreditData || !unitCreditData.history || !Array.isArray(unitCreditData.history)) {
            continue; // Skip if no history
          }
          
          // Filter history entries within the fiscal year date range
          for (const entry of unitCreditData.history) {
            // Parse timestamp - handle various formats
            let entryTimestamp = null;
            if (entry.timestamp) {
              if (entry.timestamp._seconds !== undefined) {
                entryTimestamp = entry.timestamp._seconds * 1000; // Convert to milliseconds
              } else if (typeof entry.timestamp.toDate === 'function') {
                entryTimestamp = entry.timestamp.toDate().getTime();
              } else if (entry.timestamp instanceof Date) {
                entryTimestamp = entry.timestamp.getTime();
              } else if (typeof entry.timestamp === 'string') {
                entryTimestamp = new Date(entry.timestamp).getTime();
              } else if (typeof entry.timestamp === 'number') {
                // Assume milliseconds if it's a number (check if it's seconds vs milliseconds)
                entryTimestamp = entry.timestamp < 10000000000 ? entry.timestamp * 1000 : entry.timestamp;
              }
            }
            
            // Only include entries within the fiscal year
            if (entryTimestamp !== null && entryTimestamp >= fiscalYearStartTimestamp && entryTimestamp <= fiscalYearEndTimestamp) {
              const amount = typeof entry.amount === 'number' ? entry.amount : 0; // Amount is in centavos
              
              if (amount > 0) {
                // Positive amount = credit added
                accountCreditAdded += amount;
              } else if (amount < 0) {
                // Negative amount = credit used (convert to positive for display)
                accountCreditUsed += Math.abs(amount);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching credit balances for Budget vs Actual report:`, error);
      // Continue with zero values if there's an error
    }
    
    let incomeTotals = { totalAnnualBudget: 0, totalYtdBudget: 0, totalYtdActual: 0 };
    let expenseTotals = { totalAnnualBudget: 0, totalYtdBudget: 0, totalYtdActual: 0 };
    
    categories.forEach(category => {
      const categoryId = category.id;
      
      // Skip Account Credit categories - they'll be shown in Unit Credit Accounts section
      if (isAccountCreditCategory(categoryId)) {
        return;
      }
      
      const categoryName = category.name || categoryId;
      const categoryType = category.type || 'expense';
      
      const annualBudget = budgetMap.get(categoryId) || 0; // centavos (always positive)
      const ytdBudget = Math.round(annualBudget * (percentOfYearElapsed / 100)); // centavos (prorated, always positive)
      const ytdActualRaw = actualMap.get(categoryId) || 0; // centavos (signed: negative for expenses, positive for income)
      
      // For budget comparison, we need to compare positive budget to positive actual
      // So for expenses (stored as negative), convert to positive for comparison
      // For income (stored as positive), use as-is
      const ytdActual = categoryType === 'income' 
        ? ytdActualRaw  // Income: already positive
        : Math.abs(ytdActualRaw); // Expense: convert negative to positive for comparison
      
      // Context-aware variance calculation:
      // Income: positive variance = favorable (collected more than expected)
      // Expense: positive variance = favorable (spent less than expected)
      const variance = categoryType === 'income'
        ? ytdActual - ytdBudget   // Income: positive when actual > budget (good)
        : ytdBudget - ytdActual;  // Expense: positive when budget > actual (good)
      
      const variancePercent = ytdBudget > 0 ? (variance / ytdBudget) * 100 : 0;

      const categoryData = {
        id: categoryId,
        name: categoryName,
        type: categoryType,
        annualBudget: annualBudget,
        ytdBudget: ytdBudget,
        ytdActual: ytdActual,
        variance: variance,
        variancePercent: variancePercent
      };

      // Categorize into three tables
      // Priority: Special Assessments first, then Income, then Expenses
      if (isSpecialAssessmentsCategory(categoryId)) {
        // Special Assessments income (collections) - single category
        // Use raw signed value (income is positive)
        const rawActual = actualMap.get(categoryId) || 0;
        specialAssessmentsCollections = {
          amount: rawActual, // centavos (positive for income)
          categoryName: categoryName
        };
      } else if (isProjectCategory(categoryId, categoryName)) {
        // Project expenses (expenditures) - filter out empty projects
        // Use raw signed value (expenses are negative), convert to positive for display
        const rawActual = actualMap.get(categoryId) || 0;
        const expenditureAmount = Math.abs(rawActual); // Convert to positive for display
        if (expenditureAmount > 0) {
          specialAssessmentsExpenditures.push({
            id: categoryId,
            name: categoryName,
            amount: expenditureAmount // centavos (positive for display)
          });
        }
      } else if (isAccountCreditCategory(categoryId)) {
        // Skip Account Credit categories - they're shown in Unit Credit Accounts section
        // Account Credit data comes from creditBalances document, not transactions
        return; // Don't add to income/expense arrays
      } else if (categoryType === 'income') {
        // Only include categories that have budget or actual activity
        // Hide categories where both budget and actual are zero (no activity)
        if (annualBudget > 0 || ytdActual > 0) {
          incomeCategories.push(categoryData);
          incomeTotals.totalAnnualBudget += annualBudget;
          incomeTotals.totalYtdBudget += ytdBudget;
          incomeTotals.totalYtdActual += ytdActual;
        }
      } else {
        // Only include categories that have budget or actual activity
        // Hide categories where both budget and actual are zero (no activity)
        if (annualBudget > 0 || ytdActual > 0) {
          expenseCategories.push(categoryData);
          expenseTotals.totalAnnualBudget += annualBudget;
          expenseTotals.totalYtdBudget += ytdBudget;
          expenseTotals.totalYtdActual += ytdActual;
        }
      }
    });
    
    // Build Unit Credit Accounts section (similar to Special Assessments)
    // Data comes from creditBalances document (single source of truth)
    // Calculate net balance (added - used)
    const accountCreditBalance = accountCreditAdded - accountCreditUsed;
    
    const unitCreditAccounts = {
      added: accountCreditAdded, // Credit added (centavos, positive, gross amount)
      used: accountCreditUsed,   // Credit used (centavos, positive, gross amount)
      balance: accountCreditBalance   // Net balance (centavos, can be positive or negative)
    };

    // Calculate variance totals for each table (context-aware)
    // Income: variance = actual - budget (positive = favorable)
    incomeTotals.totalVariance = incomeTotals.totalYtdActual - incomeTotals.totalYtdBudget;
    incomeTotals.totalVariancePercent = incomeTotals.totalYtdBudget > 0 
      ? (incomeTotals.totalVariance / incomeTotals.totalYtdBudget) * 100 : 0;

    // Expense: variance = budget - actual (positive = favorable)
    expenseTotals.totalVariance = expenseTotals.totalYtdBudget - expenseTotals.totalYtdActual;
    expenseTotals.totalVariancePercent = expenseTotals.totalYtdBudget > 0 
      ? (expenseTotals.totalVariance / expenseTotals.totalYtdBudget) * 100 : 0;

    // Special Assessments: Calculate fund balance (collections - expenditures)
    // Collections are positive (income), expenditures are stored as positive for display
    const totalExpenditures = specialAssessmentsExpenditures.reduce((sum, exp) => sum + exp.amount, 0);
    const collectionsAmount = specialAssessmentsCollections?.amount || 0;
    const netBalance = collectionsAmount - totalExpenditures; // Both positive, so this gives net fund balance

    // Generate report ID
    const reportId = `BUDGET-ACTUAL-${clientId}-${effectiveFiscalYear}-${now.getTime()}`;

    return {
      clientInfo: {
        id: clientId,
        name: clientName,
        logoUrl: normalizedLogoUrl,
        fiscalYearStartMonth: fiscalYearStartMonth
      },
      reportInfo: {
        fiscalYear: effectiveFiscalYear,
        reportDate: reportDate.toISOString(),
        percentOfYearElapsed: actualPercentOfYearElapsed, // Show actual % in report info
        percentOfYearElapsedForBudget: percentOfYearElapsed, // Show adjusted % used for budget calculations
        reportId: reportId
      },
      income: {
        categories: incomeCategories,
        totals: incomeTotals
      },
      specialAssessments: {
        collections: specialAssessmentsCollections || { amount: 0, categoryName: 'Special Assessments' },
        expenditures: specialAssessmentsExpenditures,
        totalExpenditures: totalExpenditures,
        netBalance: netBalance
      },
      expenses: {
        categories: expenseCategories,
        totals: expenseTotals
      },
      unitCreditAccounts: {
        added: unitCreditAccounts.added,
        used: unitCreditAccounts.used,
        balance: unitCreditAccounts.balance
      }
    };
  } catch (error) {
    console.error('❌ Error in getBudgetActualData:', error);
    throw error;
  }
}


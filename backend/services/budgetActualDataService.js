/**
 * Budget vs Actual Data Service
 * 
 * Aggregates budget and actual expense data for Budget vs Actual report
 * Follows Statement of Account pattern for consistency
 */

import { getDb } from '../firebase.js';
import { getNow } from './DateService.js';
import { getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { listBudgetsByYear } from '../controllers/budgetController.js';
import databaseFieldMappings from '../utils/databaseFieldMappings.js';

const { convertToTimestamp } = databaseFieldMappings;

/**
 * Get Budget vs Actual data for a client and fiscal year
 * @param {string} clientId - Client ID
 * @param {number} fiscalYear - Fiscal year
 * @param {Object} user - User object for propertyAccess validation
 * @returns {Promise<Object>} Budget vs Actual data structure
 */
export async function getBudgetActualData(clientId, fiscalYear, user) {
  try {
    if (!clientId || !fiscalYear || !user) {
      throw new Error('Missing required parameters: clientId, fiscalYear, or user');
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

    // Get fiscal year bounds
    const { startDate, endDate } = getFiscalYearBounds(fiscalYear, fiscalYearStartMonth);
    const startTimestamp = convertToTimestamp(startDate);
    const endTimestamp = convertToTimestamp(endDate);

    // Calculate % of fiscal year elapsed
    const now = getNow();
    const reportDate = now;
    const fiscalYearStart = startDate.getTime();
    const fiscalYearEnd = endDate.getTime();
    const fiscalYearDuration = fiscalYearEnd - fiscalYearStart;
    const elapsedTime = Math.min(now.getTime() - fiscalYearStart, fiscalYearDuration);
    const percentOfYearElapsed = Math.max(0, Math.min(100, (elapsedTime / fiscalYearDuration) * 100));

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
    const budgets = await listBudgetsByYear(clientId, fiscalYear, user);
    const budgetMap = new Map();
    budgets.forEach(budget => {
      budgetMap.set(budget.categoryId, budget.amount || 0);
    });

    // Fetch all transactions within fiscal year (filter type/categoryId in memory to avoid index requirement)
    const transactionsSnapshot = await db.collection(`clients/${clientId}/transactions`)
      .where('date', '>=', startTimestamp)
      .where('date', '<=', endTimestamp)
      .get();

    // Aggregate actual transactions by category (both income and expenses)
    // Use actual signed values - expenses are negative, income is positive
    // This allows transfers to net correctly (positive + negative = net)
    // Handle split transactions by processing allocations array
    const actualMap = new Map();
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
            const currentActual = actualMap.get(categoryId) || 0;
            const allocationAmount = allocation.amount || 0; // Amount is in centavos (signed)
            // Use actual signed value - allows transfers to net correctly
            actualMap.set(categoryId, currentActual + allocationAmount);
          }
        });
      } else if (transaction.categoryId && transaction.categoryId !== '-split-' && transaction.categoryId !== '-Split-') {
        // Regular (non-split) transaction - use actual signed value
        const categoryId = transaction.categoryId;
        const currentActual = actualMap.get(categoryId) || 0;
        const amount = transaction.amount || 0; // Amount is in centavos (signed: negative for expenses, positive for income)
        // Use actual signed value - allows transfers to net correctly
        actualMap.set(categoryId, currentActual + amount);
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
    
    let incomeTotals = { totalAnnualBudget: 0, totalYtdBudget: 0, totalYtdActual: 0 };
    let expenseTotals = { totalAnnualBudget: 0, totalYtdBudget: 0, totalYtdActual: 0 };

    categories.forEach(category => {
      const categoryId = category.id;
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
      } else if (categoryType === 'income') {
        incomeCategories.push(categoryData);
        incomeTotals.totalAnnualBudget += annualBudget;
        incomeTotals.totalYtdBudget += ytdBudget;
        incomeTotals.totalYtdActual += ytdActual;
      } else {
        expenseCategories.push(categoryData);
        expenseTotals.totalAnnualBudget += annualBudget;
        expenseTotals.totalYtdBudget += ytdBudget;
        expenseTotals.totalYtdActual += ytdActual;
      }
    });

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
    const reportId = `BUDGET-ACTUAL-${clientId}-${fiscalYear}-${now.getTime()}`;

    return {
      clientInfo: {
        id: clientId,
        name: clientName,
        logoUrl: normalizedLogoUrl,
        fiscalYearStartMonth: fiscalYearStartMonth
      },
      reportInfo: {
        fiscalYear: fiscalYear,
        reportDate: reportDate.toISOString(),
        percentOfYearElapsed: percentOfYearElapsed,
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
      }
    };
  } catch (error) {
    console.error('❌ Error in getBudgetActualData:', error);
    throw error;
  }
}


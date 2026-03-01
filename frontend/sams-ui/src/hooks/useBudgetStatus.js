/**
 * useBudgetStatus - Hook to fetch budget vs actual summary for dashboard card
 */
import { useState, useEffect, useCallback } from 'react';
import { useClient } from '../context/ClientContext';
import reportService from '../services/reportService';

export function useBudgetStatus() {
  const { selectedClient } = useClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBudgetStatus = useCallback(async () => {
    if (!selectedClient) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch budget vs actual data (uses current fiscal year by default)
      const budgetData = await reportService.getBudgetActualData(selectedClient.id);

      // Backend response shape:
      //   reportInfo: { fiscalYear, percentOfYearElapsed, ... }
      //   income:     { categories: [...], totals: { totalAnnualBudget, totalYtdBudget, totalYtdActual, totalVariance } }
      //   expenses:   { categories: [...], totals: { totalAnnualBudget, totalYtdBudget, totalYtdActual, totalVariance } }
      const incomeTotals = budgetData.income?.totals || {};
      const expenseTotals = budgetData.expenses?.totals || {};

      // Calculate summary metrics
      const totalBudget = (incomeTotals.totalAnnualBudget || 0) + 
                          (expenseTotals.totalAnnualBudget || 0);
      const totalActual = (incomeTotals.totalYtdActual || 0) + 
                          (expenseTotals.totalYtdActual || 0);
      const totalVariance = (incomeTotals.totalVariance || 0) + 
                            (expenseTotals.totalVariance || 0);

      // Calculate YTD budget based on % of year elapsed
      const percentElapsed = budgetData.reportInfo?.percentOfYearElapsed || 0;
      const ytdBudget = totalBudget * (percentElapsed / 100);

      // Determine status (favorable = actual < budget for expenses, actual > budget for income)
      // For combined, we look at net position
      const netBudgetYTD = (incomeTotals.totalYtdBudget || 0) - 
                           (expenseTotals.totalYtdBudget || 0);
      const netActual = (incomeTotals.totalYtdActual || 0) - 
                        Math.abs(expenseTotals.totalYtdActual || 0);
      const netVariance = netActual - netBudgetYTD;

      // Over-budget watch list: expense categories where actual > budget
      // Variance in BvA is (budget - actual), so negative = over budget
      const expenseCategories = budgetData.expenses?.categories || [];
      const overBudgetItems = expenseCategories
        .filter(item => item.ytdBudget > 0 && item.variance < 0)
        .map(item => ({
          category: item.name,
          overAmount: Math.abs(item.variance),
          overPercent: Math.round(Math.abs(item.variance / item.ytdBudget) * 100),
        }))
        .sort((a, b) => b.overPercent - a.overPercent)
        .slice(0, 5);

      // Expense-only status: are expenses within budget?
      const expenseYtdBudget = expenseTotals.totalYtdBudget || 0;
      const expenseYtdActual = Math.abs(expenseTotals.totalYtdActual || 0);
      const expenseVariance = expenseYtdBudget - expenseYtdActual;

      setData({
        fiscalYear: budgetData.reportInfo?.fiscalYear,
        percentElapsed: Math.round(percentElapsed),
        
        // Expense-focused metrics (what the card displays)
        expenseYtdBudget,
        expenseYtdActual,
        expenseVariance,
        expenseBudgetAnnual: expenseTotals.totalAnnualBudget || 0,

        // Status based on expense budget health
        status: expenseVariance >= 0 ? 'favorable' : 'unfavorable',
        statusText: expenseVariance >= 0 ? 'On Track' : 'Over Budget',
        statusColor: expenseVariance >= 0 ? '#059669' : '#dc2626',
        
        // Over-budget watch list for tooltip
        overBudgetItems,
        
        // Legacy fields kept for backward compat
        netBudgetYTD,
        netActual,
        netVariance,
      });

    } catch (err) {
      console.error('Error fetching budget status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedClient]);

  useEffect(() => {
    fetchBudgetStatus();
  }, [fetchBudgetStatus]);

  return {
    budgetStatus: data,
    loading,
    error,
    refresh: fetchBudgetStatus,
  };
}

export default useBudgetStatus;

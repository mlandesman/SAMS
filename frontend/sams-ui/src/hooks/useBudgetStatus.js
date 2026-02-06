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

      // Find top variance items (positive and negative)
      const allItems = [
        ...(budgetData.income?.categories || []),
        ...(budgetData.expenses?.categories || []),
      ];

      // Sort by absolute variance to find biggest misses
      const topVariances = allItems
        .filter(item => item.variance !== 0)
        .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
        .slice(0, 5)
        .map(item => ({
          category: item.category,
          variance: item.variance,
          variancePercent: item.budgetYTD ? ((item.variance / item.budgetYTD) * 100).toFixed(0) : 0,
          favorable: item.variance > 0, // positive variance is favorable
        }));

      setData({
        fiscalYear: budgetData.reportInfo?.fiscalYear,
        percentElapsed: Math.round(percentElapsed),
        
        // Income summary
        incomeBudget: incomeTotals.totalAnnualBudget || 0,
        incomeActual: incomeTotals.totalYtdActual || 0,
        incomeVariance: incomeTotals.totalVariance || 0,
        
        // Expense summary  
        expenseBudget: expenseTotals.totalAnnualBudget || 0,
        expenseActual: Math.abs(expenseTotals.totalYtdActual || 0),
        expenseVariance: expenseTotals.totalVariance || 0,
        
        // Net position
        netBudgetYTD,
        netActual,
        netVariance,
        
        // Status indicators
        status: netVariance >= 0 ? 'favorable' : 'unfavorable',
        statusText: netVariance >= 0 ? 'On Track' : 'Over Budget',
        statusColor: netVariance >= 0 ? '#059669' : '#dc2626',
        
        // Top variances for tooltip/drill-down
        topVariances,
        
        // Raw data reference
        _raw: budgetData,
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

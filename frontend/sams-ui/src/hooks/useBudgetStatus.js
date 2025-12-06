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

      // Calculate summary metrics
      const totalBudget = (budgetData.income?.totalBudget || 0) + 
                          (budgetData.expenses?.totalBudget || 0);
      const totalActual = (budgetData.income?.totalActual || 0) + 
                          (budgetData.expenses?.totalActual || 0);
      const totalVariance = (budgetData.income?.totalVariance || 0) + 
                            (budgetData.expenses?.totalVariance || 0);

      // Calculate YTD budget based on % of year elapsed
      const percentElapsed = budgetData.percentOfYearElapsed || 0;
      const ytdBudget = totalBudget * (percentElapsed / 100);

      // Determine status (favorable = actual < budget for expenses, actual > budget for income)
      // For combined, we look at net position
      const netBudgetYTD = (budgetData.income?.totalBudgetYTD || 0) - 
                           (budgetData.expenses?.totalBudgetYTD || 0);
      const netActual = (budgetData.income?.totalActual || 0) - 
                        Math.abs(budgetData.expenses?.totalActual || 0);
      const netVariance = netActual - netBudgetYTD;

      // Find top variance items (positive and negative)
      const allItems = [
        ...(budgetData.income?.items || []),
        ...(budgetData.expenses?.items || []),
        ...(budgetData.specialAssessments?.items || []),
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
        fiscalYear: budgetData.fiscalYear,
        percentElapsed: Math.round(percentElapsed),
        
        // Income summary
        incomeBudget: budgetData.income?.totalBudget || 0,
        incomeActual: budgetData.income?.totalActual || 0,
        incomeVariance: budgetData.income?.totalVariance || 0,
        
        // Expense summary  
        expenseBudget: budgetData.expenses?.totalBudget || 0,
        expenseActual: Math.abs(budgetData.expenses?.totalActual || 0),
        expenseVariance: budgetData.expenses?.totalVariance || 0,
        
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

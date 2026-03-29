/**
 * useBudgetStatus - Fetch expense budget summary for mobile dashboard card.
 * Calls GET /reports/:clientId/budget-actual/data and extracts expense totals.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuthStable.jsx';
import { config } from '../config/index.js';
import { auth } from '../services/firebase';

const API_BASE_URL = config.api.baseUrl;

export function useBudgetStatus() {
  const { currentClient, firebaseUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;

  const fetchBudgetStatus = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }

    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser || firebaseUser;
      if (!user) throw new Error('No authenticated user');
      const token = await user.getIdToken();

      const res = await fetch(
        `${API_BASE_URL}/reports/${clientId}/budget-actual/data?language=english`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const resJson = await res.json();
      const budgetData = resJson?.data ?? resJson;

      const exp = budgetData?.expenses || {};
      const totals = exp.totals || {};
      const ytdBudget = totals.totalYtdBudget || 0;
      const ytdActual = Math.abs(totals.totalYtdActual || 0);
      const variance = ytdBudget - ytdActual;

      const categories = exp.categories || [];
      const expenseCategories = categories
        .filter((c) => (c.type || '').toLowerCase() === 'expense')
        .map((c) => {
          const actual = c.ytdActual ?? 0;
          const budget = c.ytdBudget ?? 0;
          const diff = actual - budget;
          return { ...c, diff, absDiff: Math.abs(diff) };
        });
      const sortedByVariance = [...expenseCategories].sort((a, b) => b.absDiff - a.absDiff);

      setData({
        statusText: variance >= 0 ? 'On Track' : 'Over Budget',
        statusColor: variance >= 0 ? '#059669' : '#dc2626',
        expenseYtdBudget: ytdBudget,
        expenseYtdActual: ytdActual,
        expenseVariance: variance,
        topCategories: sortedByVariance.slice(0, 5),
        allCategories: sortedByVariance,
      });
    } catch (err) {
      console.error('Budget status fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId, firebaseUser]);

  useEffect(() => { fetchBudgetStatus(); }, [fetchBudgetStatus]);

  return { budgetStatus: data, loading, error };
}

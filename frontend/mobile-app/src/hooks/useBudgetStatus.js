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
      const budgetData = await res.json();

      const exp = budgetData.expenses?.totals || {};
      const ytdBudget = exp.totalYtdBudget || 0;
      const ytdActual = Math.abs(exp.totalYtdActual || 0);
      const variance = ytdBudget - ytdActual;

      setData({
        statusText: variance >= 0 ? 'On Track' : 'Over Budget',
        statusColor: variance >= 0 ? '#059669' : '#dc2626',
        expenseYtdBudget: ytdBudget,
        expenseYtdActual: ytdActual,
        expenseVariance: variance,
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

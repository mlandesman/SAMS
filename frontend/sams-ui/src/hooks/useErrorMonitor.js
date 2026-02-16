import { useState, useEffect, useCallback } from 'react';
import { getSystemErrors } from '../api/systemErrors';

const POLL_INTERVAL_MS = 60000;

/**
 * Hook for System Error Monitor data.
 * Used by ErrorMonitorCard and DashboardView for conditional rendering.
 */
export function useErrorMonitor() {
  const [errors, setErrors] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const fetchErrors = useCallback(async () => {
    try {
      setFetchError(null);
      const data = await getSystemErrors(50);
      setErrors(data.errors || []);
      setCount(data.count ?? (data.errors?.length ?? 0));
    } catch (err) {
      setFetchError(err.message || 'Unable to check');
      setErrors([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchErrors]);

  const acknowledgeError = useCallback((errorId) => {
    setErrors((prev) => prev.filter((e) => e.id !== errorId));
    setCount((prev) => Math.max(0, prev - 1));
  }, []);

  const acknowledgeAll = useCallback(() => {
    setErrors([]);
    setCount(0);
  }, []);

  const hasErrors = count > 0;
  const showCard = hasErrors || loading || !!fetchError;

  return {
    errors,
    count,
    loading,
    fetchError,
    hasErrors,
    showCard,
    fetchErrors,
    acknowledgeError,
    acknowledgeAll,
  };
}

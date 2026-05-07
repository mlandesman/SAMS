import { useCallback, useEffect, useState } from 'react';
import { getAuthInstance } from '../firebaseClient';
import { config } from '../config';
import { useClient } from '../context/ClientContext';

export function useReconciliationHealth() {
  const { selectedClient } = useClient();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const clientId = selectedClient?.id;
    if (!clientId) {
      setData(null);
      setError('');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const auth = getAuthInstance();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Unable to get authentication token');

      const res = await fetch(`${config.api.baseUrl}/clients/${clientId}/reconciliations/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      setData(payload.health || null);
    } catch (err) {
      setError(err?.message || 'Failed to load reconciliation health');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedClient?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    reconciliationHealth: data,
    loading,
    error,
    refresh
  };
}

export default useReconciliationHealth;

/**
 * useHoaConfig — Fetch HOA dues configuration for a client.
 *
 * Returns penaltyDays and penaltyRate for late-fee display logic.
 * Defaults to { penaltyDays: 10, penaltyRate: 0 } on error or missing data.
 */
import { useState, useEffect } from 'react';
import { config } from '../config/index.js';
import { auth } from '../services/firebase';

export function useHoaConfig(clientId) {
  const [hoaConfig, setHoaConfig] = useState(null);

  useEffect(() => {
    if (!clientId) {
      setHoaConfig(null);
      return;
    }

    const user = auth.currentUser;
    const tokenPromise = user?.getIdToken?.();
    if (!tokenPromise) return;

    let cancelled = false;

    tokenPromise.then((t) => {
      if (cancelled) return;
      return fetch(`${config.api.baseUrl}/clients/${clientId}/config/hoaDues`, {
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      });
    }).then(async (r) => {
      if (!r?.ok) return null;
      if (r.status === 204) {
        console.info('HOA config returned 204; using defaults.', { clientId });
        return { data: {} };
      }
      return r.json().catch((err) => {
        console.error('Failed parsing HOA config JSON:', err);
        return null;
      });
    }).then((res) => {
      if (cancelled) return;
      const d = res?.data || {};
      setHoaConfig({
        penaltyDays: d.penaltyDays ?? 10,
        penaltyRate: d.penaltyRate ?? 0,
      });
    }).catch((err) => {
      console.error('HOA config fetch failed:', err);
      if (!cancelled) setHoaConfig({ penaltyDays: 10, penaltyRate: 0 });
    });

    return () => { cancelled = true; };
  }, [clientId]);

  return { hoaConfig };
}

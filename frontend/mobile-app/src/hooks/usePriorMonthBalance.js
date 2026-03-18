/**
 * usePriorMonthBalance — Fetch last-day-of-prior-month bank+cash balance
 * for month-over-month trend display.
 *
 * Returns centavo values converted to pesos (÷100).
 */
import { useState, useEffect } from 'react';
import { config } from '../config/index.js';
import { auth } from '../services/firebase';
import { getMexicoDateTime } from '../utils/timezone.js';

export function usePriorMonthBalance(clientId) {
  const [priorMonthBalance, setPriorMonthBalance] = useState(null);
  const [priorLoading, setPriorLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setPriorMonthBalance(null);
      setPriorLoading(false);
      return;
    }

    const user = auth.currentUser;
    const tokenPromise = user?.getIdToken?.();
    if (!tokenPromise) {
      setPriorLoading(false);
      return;
    }

    const now = getMexicoDateTime();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrev = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    const asOfDate = lastDayPrev.toISOString().split('T')[0];

    let cancelled = false;
    setPriorLoading(true);

    tokenPromise.then((t) => {
      if (cancelled) return;
      return fetch(
        `${config.api.baseUrl}/clients/${clientId}/balances/current?asOfDate=${asOfDate}`,
        { headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } }
      );
    }).then((r) => r?.ok ? r.json() : null).then((res) => {
      if (cancelled) return;
      if (res?.success && res?.data) {
        const bank = res.data.bankBalance || 0;
        const cash = res.data.cashBalance || 0;
        setPriorMonthBalance(Math.round((bank + cash) / 100));
      } else {
        setPriorMonthBalance(0);
      }
    }).catch(() => {
      if (!cancelled) setPriorMonthBalance(0);
    }).finally(() => {
      if (!cancelled) setPriorLoading(false);
    });

    return () => { cancelled = true; };
  }, [clientId]);

  return { priorMonthBalance, priorLoading };
}

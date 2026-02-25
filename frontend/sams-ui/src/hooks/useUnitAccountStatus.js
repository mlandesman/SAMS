/**
 * useUnitAccountStatus — Reusable hook for Statement of Account unit data
 *
 * Fetches SoA data for a unit via GET /reports/:clientId/statement/data?unitId=...
 * Use for dashboard Unit Account Status card and mobile PWA (Sprint D).
 *
 * @param {string|null} clientId - Client ID
 * @param {string|null} unitId - Unit ID (null = skip fetch, e.g. admin user)
 * @returns {{ data: object|null, loading: boolean, error: string|null }}
 */
import { useState, useEffect } from 'react';
import reportService from '../services/reportService';

export function useUnitAccountStatus(clientId, unitId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientId || !unitId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const raw = await reportService.getStatementData(clientId, unitId, null, { language: 'english' });

        if (cancelled) return;

        // Derive amountDue and creditBalance from last line item's running balance (not getCreditBalances)
        // When statement ends with "No Payment Needed" and last balance is -600, show credit as 600
        const lineItems = raw?.lineItems || [];
        const currentItems = lineItems.filter((item) => item.isFuture !== true);
        const lastBalance = currentItems.length > 0
          ? (typeof currentItems[currentItems.length - 1].balance === 'number' ? currentItems[currentItems.length - 1].balance : 0)
          : 0;
        const amountDue = lastBalance > 0 ? lastBalance : 0;
        const creditBalance = lastBalance < 0 ? Math.abs(lastBalance) : 0;
        const owners = raw?.emailContent?.ownerNames
          ? [raw.emailContent.ownerNames]
          : (raw?.unitInfo?.owners || []).map((o) => (typeof o === 'string' ? o : o?.name)).filter(Boolean);
        const ownerNames = owners.join(' & ');

        // Next payment: prefer backend (UPC billsPaid) — correct for "all paid" case (e.g. Mar 1 in Feb)
        // Fallback to first unpaid/future charge in lineItems when backend not available
        let nextPaymentDueDate = null;
        let nextPaymentAmount = null;
        if (raw?.nextPaymentDueDate) {
          nextPaymentDueDate = typeof raw.nextPaymentDueDate === 'string'
            ? raw.nextPaymentDueDate
            : (raw.nextPaymentDueDate?.toISOString?.()?.split('T')[0] || null);
          nextPaymentAmount = typeof raw.nextPaymentAmount === 'number' ? raw.nextPaymentAmount : null;
        }
        if (!nextPaymentDueDate) {
          const charges = lineItems.filter((item) => item.type === 'charge' || (item.charge && item.charge > 0));
          for (const item of charges) {
            const bal = typeof item.balance === 'number' ? item.balance : 0;
            if (bal > 0 || item.isFuture) {
              nextPaymentDueDate = item.date || null;
              nextPaymentAmount = typeof item.charge === 'number' ? item.charge : null;
              break;
            }
          }
        }

        // Last payment: most recent lineItem with type === 'payment'
        const payments = lineItems.filter((item) => (item.type === 'payment' || (item.payment && item.payment > 0)) && !item.isFuture);
        const lastPayment = payments.length > 0
          ? payments.reduce((a, b) => {
              const dateA = a.date ? new Date(a.date).getTime() : 0;
              const dateB = b.date ? new Date(b.date).getTime() : 0;
              return dateB > dateA ? b : a;
            })
          : null;

        // YTD: months paid from dues/{year} payments (same source as HOA Dues table)
        const ytdMonthsPaid = typeof raw?.ytdMonthsPaid === 'number' ? raw.ytdMonthsPaid : 0;
        const ytdTotal = typeof raw?.ytdTotal === 'number' ? raw.ytdTotal : 12;

        setData({
          amountDue,
          creditBalance,
          nextPaymentDueDate,
          nextPaymentAmount,
          lastPayment: lastPayment
            ? {
                date: lastPayment.date,
                amount: lastPayment.payment || 0
              }
            : null,
          owners,
          ownerNames,
          lineItems,
          ytdMonthsPaid,
          ytdTotal,
          summary: raw?.summary || {}
        });
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load account status');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [clientId, unitId]);

  return { data, loading, error };
}

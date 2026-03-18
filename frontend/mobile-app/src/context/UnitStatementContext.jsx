/**
 * UnitStatementContext — SoA as single source of truth for mobile cards
 *
 * Fetches statement/data?skipHtml=true once when selectedUnitId changes.
 * All components that need unit account data read from this context
 * instead of making individual API calls.
 *
 * Derives nextPaymentDueDate from SoA lineItems (first charge with
 * balance > 0 or isFuture), guaranteeing mobile cards match the
 * Statement of Account exactly.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useSelectedUnit } from './SelectedUnitContext.jsx';
import { config } from '../config/index.js';
import { auth } from '../services/firebase';
import { getMexicoDateTime } from '../utils/timezone.js';

const UnitStatementContext = createContext(null);

export const useUnitStatement = () => {
  const context = useContext(UnitStatementContext);
  if (context === null || context === undefined) {
    throw new Error('useUnitStatement must be used within a UnitStatementProvider');
  }
  return context;
};

const API_BASE_URL = config.api.baseUrl;

async function fetchWithAuth(url) {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  const token = await user.getIdToken();
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Derive dashboard-shape data from SoA lineItems.
 * nextPaymentDueDate comes from the first charge row with balance > 0 or isFuture,
 * matching the SoA's last visible row exactly.
 */
function deriveAccountData(raw) {
  const lineItems = raw?.lineItems || [];
  const currentItems = lineItems.filter(item => item.isFuture !== true);
  const lastBalance = currentItems.length > 0
    ? (typeof currentItems[currentItems.length - 1].balance === 'number'
      ? currentItems[currentItems.length - 1].balance : 0)
    : 0;

  const amountDue = lastBalance > 0 ? lastBalance : 0;
  const creditBalance = lastBalance < 0 ? Math.abs(lastBalance) : 0;

  const owners = raw?.emailContent?.ownerNames
    ? [raw.emailContent.ownerNames]
    : (raw?.unitInfo?.owners || []).map(o => (typeof o === 'string' ? o : o?.name)).filter(Boolean);
  const ownerNames = owners.join(' & ');

  let nextPaymentDueDate = raw?.nextPaymentDueDate || null;
  let nextPaymentAmount = typeof raw?.nextPaymentAmount === 'number' ? raw.nextPaymentAmount : null;

  if (typeof nextPaymentDueDate === 'object' && nextPaymentDueDate?.toISOString) {
    nextPaymentDueDate = nextPaymentDueDate.toISOString().split('T')[0];
  }

  if (!nextPaymentDueDate) {
    const charges = lineItems.filter(item => item.type === 'charge' || (item.charge && item.charge > 0));
    for (const item of charges) {
      const bal = typeof item.balance === 'number' ? item.balance : 0;
      if (bal > 0 || item.isFuture) {
        nextPaymentDueDate = item.date || null;
        nextPaymentAmount = typeof item.charge === 'number' ? item.charge : null;
        break;
      }
    }
  }

  const payments = lineItems.filter(
    item => (item.type === 'payment' || (item.payment && item.payment > 0)) && !item.isFuture
  );
  const lastPayment = payments.length > 0
    ? payments.reduce((a, b) => {
      const dateA = a.date ? getMexicoDateTime(a.date).getTime() : 0;
      const dateB = b.date ? getMexicoDateTime(b.date).getTime() : 0;
      return dateB > dateA ? b : a;
    })
    : null;

  return {
    amountDue,
    creditBalance,
    nextPaymentDueDate,
    nextPaymentAmount,
    lastPayment: lastPayment ? { date: lastPayment.date, amount: lastPayment.payment || 0 } : null,
    owners,
    ownerNames,
    lineItems,
    ytdMonthsPaid: typeof raw?.ytdMonthsPaid === 'number' ? raw.ytdMonthsPaid : 0,
    ytdTotal: typeof raw?.ytdTotal === 'number' ? raw.ytdTotal : 12,
    summary: raw?.summary || {},
  };
}

export const UnitStatementProvider = ({ children }) => {
  const { currentClient } = useAuth();
  const { selectedUnitId } = useSelectedUnit();

  const [rawStatement, setRawStatement] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;

  const refresh = useCallback(async (getCancelled) => {
    if (!clientId || !selectedUnitId) {
      setRawStatement(null);
      setAccountData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}/reports/${clientId}/statement/data?unitId=${selectedUnitId}&skipHtml=true`;
      const json = await fetchWithAuth(url);
      if (getCancelled?.()) return;
      const raw = json.data || json;
      setRawStatement(raw);
      setAccountData(deriveAccountData(raw));
    } catch (err) {
      if (getCancelled?.()) return;
      setError(err?.message || 'Failed to load statement data');
      setRawStatement(null);
      setAccountData(null);
    } finally {
      if (!getCancelled?.()) setLoading(false);
    }
  }, [clientId, selectedUnitId]);

  useEffect(() => {
    let cancelled = false;
    const getCancelled = () => cancelled;
    refresh(getCancelled).catch(() => {});
    return () => { cancelled = true; };
  }, [refresh]);

  const value = useMemo(() => ({
    accountData,
    statementData: rawStatement,
    loading,
    error,
    refresh,
  }), [accountData, rawStatement, loading, error, refresh]);

  return (
    <UnitStatementContext.Provider value={value}>
      {children}
    </UnitStatementContext.Provider>
  );
};

export default UnitStatementContext;

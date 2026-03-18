/**
 * Owner 3-Card Dashboard — Mobile owner/manager main view
 * Replaces 8-card grid with focused: Unit Status, HOA Status, Exchange Rates
 * Sprint MOBILE-OWNER-UX (MOB-2)
 */
import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { Home as UnitIcon, Groups as HOAIcon, CurrencyExchange as CurrencyIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useSelectedUnit } from '../../context/SelectedUnitContext.jsx';
import { useDashboardData } from '../../hooks/useDashboardData.js';
import { useUnitAccountStatus } from '../../hooks/useUnitAccountStatus';
import { config } from '../../config/index.js';
import { auth } from '../../services/firebase';
import { getMexicoDateTime, formatDateForDisplay } from '../../utils/timezone.js';
import { formatPesosForDisplay } from '@shared/utils/currencyUtils.js';
import { LoadingSpinner } from '../common';

const OwnerDashboard3Cards = () => {
  const navigate = useNavigate();
  const { currentClient } = useAuth();
  const { selectedUnitId } = useSelectedUnit();
  const { data: unitData, loading: unitLoading } = useUnitAccountStatus(currentClient, selectedUnitId);
  const {
    accountBalances,
    hoaDuesStatus,
    exchangeRates,
    loading: dashLoading,
  } = useDashboardData();

  const [priorMonthBalance, setPriorMonthBalance] = useState(null);
  const [priorLoading, setPriorLoading] = useState(false);
  const [pollsCount, setPollsCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [pollsProjectsLoading, setPollsProjectsLoading] = useState(false);
  const [hoaConfig, setHoaConfig] = useState(null);

  // Prior month balance for HOA trend
  useEffect(() => {
    if (!currentClient) return;
    const user = auth.currentUser;
    const tokenPromise = user?.getIdToken?.();
    if (!tokenPromise) {
      setPriorLoading(false);
      return;
    }
    const now = getMexicoDateTime();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    const asOfDate = lastDayPrevMonth.toISOString().split('T')[0];

    let cancelled = false;
    setPriorLoading(true);
    tokenPromise.then((t) => {
      if (cancelled) return;
      return fetch(
        `${config.api.baseUrl}/clients/${currentClient}/balances/current?asOfDate=${asOfDate}`,
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
  }, [currentClient]);

  // Polls and projects count
  useEffect(() => {
    if (!currentClient) return;
    const user = auth.currentUser;
    const tokenPromise = user?.getIdToken?.();
    if (!tokenPromise) {
      setPollsProjectsLoading(false);
      return;
    }
    let cancelled = false;
    setPollsProjectsLoading(true);
    tokenPromise.then((t) => {
      if (cancelled) return;
      const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
      return Promise.all([
        fetch(`${config.api.baseUrl}/vote/clients/${currentClient}/polls`, { headers }),
        fetch(`${config.api.baseUrl}/clients/${currentClient}/projects`, { headers }),
      ]);
    }).then(async ([pollsRes, projectsRes]) => {
      if (cancelled) return;
      const [pollsJson, projectsJson] = await Promise.all([
        pollsRes?.ok ? pollsRes.json().catch(() => null) : Promise.resolve(null),
        projectsRes?.ok ? projectsRes.json().catch(() => null) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (pollsJson) {
        const list = pollsJson?.data || pollsJson?.polls || pollsJson || [];
        const arr = Array.isArray(list) ? list : Object.values(list);
        setPollsCount(arr.filter((p) => p?.status === 'published').length);
      }
      if (projectsJson) {
        const list = projectsJson?.data || projectsJson?.projects || projectsJson || [];
        const arr = Array.isArray(list) ? list : Object.values(list);
        setProjectsCount(arr.filter((p) => p?.status === 'approved' || p?.status === 'in-progress').length);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setPollsProjectsLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentClient]);

  // HOA config for late fee line (penaltyRate > 0 = has late fees)
  useEffect(() => {
    if (!currentClient) return;
    const user = auth.currentUser;
    const tokenPromise = user?.getIdToken?.();
    if (!tokenPromise) return;
    let cancelled = false;
    tokenPromise.then((t) => {
      if (cancelled) return;
      return fetch(`${config.api.baseUrl}/clients/${currentClient}/config/hoaDues`, {
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      });
    }).then((r) => (r?.ok ? r.json() : null)).then((res) => {
      if (!cancelled && res?.data) {
        const d = res.data;
        setHoaConfig({
          penaltyDays: d.penaltyDays ?? 10,
          penaltyRate: d.penaltyRate ?? 0,
        });
      } else if (!cancelled) {
        setHoaConfig({ penaltyDays: 10, penaltyRate: 0 });
      }
    }).catch(() => {
      if (!cancelled) setHoaConfig({ penaltyDays: 10, penaltyRate: 0 });
    });
    return () => { cancelled = true; };
  }, [currentClient]);

  const dueDate = unitData?.nextPaymentDueDate || unitData?.summary?.nextPaymentDueDate;
  const amountDue = unitData?.amountDue ?? 0;
  const creditBalance = unitData?.creditBalance ?? 0;
  const nextPaymentAmount = unitData?.nextPaymentAmount ?? 0;
  const now = getMexicoDateTime();
  const dueDateObj = dueDate ? new Date(dueDate + 'T12:00:00') : null;
  const daysPastDue = dueDateObj && now > dueDateObj
    ? Math.max(0, Math.floor((now - dueDateObj) / (24 * 60 * 60 * 1000)))
    : 0;
  const isPastDue = daysPastDue > 0;

  const totalCreditBalances = hoaDuesStatus?.totalCreditBalances ?? 0; // pesos
  const currentTotal = accountBalances?.total ?? 0; // pesos (bank + cash)
  const netTotal = Math.max(0, currentTotal - totalCreditBalances); // Bank + Cash - Credit Balances
  const priorTotal = priorMonthBalance ?? 0; // pesos (bank + cash only, no prior-month credit data)
  const delta = currentTotal - priorTotal; // Bank + Cash vs Bank + Cash (prior) — credits not comparable
  const hasLateFees = hoaConfig && hoaConfig.penaltyRate > 0;
  const lateFeeDate = hasLateFees && dueDateObj && hoaConfig.penaltyDays != null
    ? (() => {
        const d = new Date(dueDateObj);
        d.setDate(d.getDate() + (hoaConfig.penaltyDays || 0));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      })()
    : null;

  const cards = [
    {
      title: 'Unit Status',
      icon: UnitIcon,
      color: amountDue > 0 ? (isPastDue ? '#dc2626' : '#1f2937') : '#059669',
      loading: unitLoading,
      onClick: () => navigate('/unit-dashboard'),
      content: (
        <>
          <Typography variant="h5" sx={{ fontWeight: 700, color: amountDue > 0 ? (isPastDue ? '#dc2626' : '#1f2937') : '#059669', mb: 0.5 }}>
            {amountDue > 0 ? formatPesosForDisplay(amountDue) : (creditBalance > 0 ? formatPesosForDisplay(creditBalance) : formatPesosForDisplay(0))}
          </Typography>
          {amountDue > 0 && (
            <Typography variant="body2" color="text.secondary">
              Due {dueDate ? formatDateForDisplay(dueDate) : '(date not set)'}
            </Typography>
          )}
          {daysPastDue > 0 && (
            <Typography variant="body2" sx={{ color: '#dc2626', fontWeight: 600, mt: 0.5 }}>
              {daysPastDue} days past due
            </Typography>
          )}
          {!daysPastDue && amountDue <= 0 && nextPaymentAmount > 0 && (
            <Typography variant="body2" sx={{ color: 'text.primary', mt: 0.5 }}>
              Next: {formatPesosForDisplay(nextPaymentAmount)} due {dueDate ? formatDateForDisplay(dueDate) : '(date not set)'}
            </Typography>
          )}
          {!daysPastDue && amountDue <= 0 && nextPaymentAmount <= 0 && (
            <Typography variant="body2" sx={{ color: '#059669', mt: 0.5 }}>Current</Typography>
          )}
          {hasLateFees && lateFeeDate && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Late fees apply after {lateFeeDate}
            </Typography>
          )}
        </>
      ),
    },
    {
      title: 'HOA Status',
      icon: HOAIcon,
      color: '#0863bf',
      loading: dashLoading.accounts || priorLoading || pollsProjectsLoading,
      onClick: () => navigate('/hoa'),
      content: (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Bank + Cash − Credit Balances
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0863bf', mb: 0.5 }}>
            {formatPesosForDisplay(netTotal)}
          </Typography>
          {!priorLoading && priorTotal != null && (
            <Typography
              variant="body2"
              sx={{
                color: delta >= 0 ? '#059669' : '#dc2626',
                mb: 0.5,
              }}
            >
              {delta >= 0 ? 'Up' : 'Down'} {formatPesosForDisplay(Math.abs(delta))} from last month
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Collection: {Math.round(hoaDuesStatus?.collectionRate ?? 0)}%
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            {pollsCount} poll{pollsCount !== 1 ? 's' : ''} • {projectsCount} project{projectsCount !== 1 ? 's' : ''}
          </Typography>
        </>
      ),
    },
    {
      title: 'Exchange Rates',
      icon: CurrencyIcon,
      color: '#7c3aed',
      loading: dashLoading.rates,
      onClick: () => navigate('/exchange-rates'),
      content: (
        <>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#7c3aed', mb: 0.5 }}>
            1 USD = {(exchangeRates?.rates?.USD ?? 0).toFixed(2)} MXN
          </Typography>
          <Typography variant="body2" color="text.secondary">
            1 CAD = {(exchangeRates?.rates?.CAD ?? 0).toFixed(2)} MXN
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Updated {exchangeRates?.lastUpdated || '—'}
          </Typography>
        </>
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400, mx: 'auto', pb: 2 }}>
      {cards.map((c) => (
        <Card
          key={c.title}
          onClick={c.onClick}
          sx={{
            borderRadius: '16px',
            cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            '&:active': { transform: 'scale(0.98)' },
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  backgroundColor: `${c.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mr: 1,
                }}
              >
                <c.icon sx={{ color: c.color, fontSize: 20 }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={600}>
                {c.title}
              </Typography>
            </Box>
            {c.loading ? (
              <Box display="flex" justifyContent="center" py={2}>
                <LoadingSpinner size="small" />
              </Box>
            ) : (
              c.content
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default OwnerDashboard3Cards;

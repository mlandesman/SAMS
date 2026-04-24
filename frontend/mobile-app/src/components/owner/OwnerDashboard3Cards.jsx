/**
 * Owner 3-Card Dashboard — Mobile owner/manager main view
 * Replaces 8-card grid with focused: Unit Status, HOA Status, Exchange Rates
 * Sprint MOBILE-OWNER-UX (MOB-2)
 */
import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import { Home as UnitIcon, Groups as HOAIcon, CurrencyExchange as CurrencyIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useSelectedUnit } from '../../context/SelectedUnitContext.jsx';
import { useDashboardData } from '../../hooks/useDashboardData.js';
import { useUnitAccountStatus } from '../../hooks/useUnitAccountStatus';
import { usePriorMonthBalance } from '../../hooks/usePriorMonthBalance.js';
import { usePollsProjects } from '../../hooks/usePollsProjects.js';
import { useHoaConfig } from '../../hooks/useHoaConfig.js';
import { getMexicoDateTime, formatDateForDisplay } from '../../utils/timezone.js';
import { formatPesosForDisplay } from '@shared/utils/currencyUtils.js';
import { LoadingSpinner } from '../common';
import { useMobileStrings } from '../../hooks/useMobileStrings.js';

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

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
  const { priorMonthBalance, priorLoading } = usePriorMonthBalance(clientId);
  const { pollsCount, projectsCount, loading: pollsProjectsLoading } = usePollsProjects(clientId);
  const { hoaConfig } = useHoaConfig(clientId);
  const t = useMobileStrings();

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
      title: t('owner.card.unitStatus'),
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
              {t('owner.due', {
                date: dueDate ? formatDateForDisplay(dueDate) : t('owner.dateNotSet')
              })}
            </Typography>
          )}
          {daysPastDue > 0 && (
            <Typography variant="body2" sx={{ color: '#dc2626', fontWeight: 600, mt: 0.5 }}>
              {t('owner.daysPastDue', { days: daysPastDue })}
            </Typography>
          )}
          {!daysPastDue && amountDue <= 0 && nextPaymentAmount > 0 && (
            <Typography variant="body2" sx={{ color: 'text.primary', mt: 0.5 }}>
              {t('owner.nextDue', {
                amount: formatPesosForDisplay(nextPaymentAmount),
                date: dueDate ? formatDateForDisplay(dueDate) : t('owner.dateNotSet')
              })}
            </Typography>
          )}
          {!daysPastDue && amountDue <= 0 && nextPaymentAmount <= 0 && (
            <Typography variant="body2" sx={{ color: '#059669', mt: 0.5 }}>{t('owner.current')}</Typography>
          )}
          {hasLateFees && lateFeeDate && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {t('owner.lateFeesAfter', { date: lateFeeDate })}
            </Typography>
          )}
        </>
      ),
    },
    {
      title: t('owner.card.hoaStatus'),
      icon: HOAIcon,
      color: '#0863bf',
      loading: dashLoading.accounts || priorLoading || pollsProjectsLoading,
      onClick: () => navigate('/hoa'),
      content: (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {t('owner.bankCashMinusCredits')}
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
              {delta >= 0
                ? t('owner.upFromLastMonth', { amount: formatPesosForDisplay(Math.abs(delta)) })
                : t('owner.downFromLastMonth', { amount: formatPesosForDisplay(Math.abs(delta)) })}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {t('owner.collectionRate', { rate: Math.round(hoaDuesStatus?.collectionRate ?? 0) })}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            {t('owner.pollProjectCount', { polls: pollsCount, projects: projectsCount })}
          </Typography>
        </>
      ),
    },
    {
      title: t('owner.card.exchangeRates'),
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
            {t('owner.updatedAt', { value: exchangeRates?.lastUpdated || '—' })}
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

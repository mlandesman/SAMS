/**
 * HOA Sub-Dashboard — Mobile owner view
 * Single scrollable page: Financial Health, Active Polls, Active Projects, Budget Summary
 * Sprint MOBILE-OWNER-UX (MOB-4)
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Collapse,
  Button,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useDashboardData } from '../../hooks/useDashboardData.js';
import { usePriorMonthBalance } from '../../hooks/usePriorMonthBalance.js';
import { usePollsProjects } from '../../hooks/usePollsProjects.js';
import { useSessionPreferences } from '../../context/SessionPreferencesContext.jsx';
import { config } from '../../config/index.js';
import { auth } from '../../services/firebase';
import { formatDateForDisplay } from '../../utils/timezone.js';
import { formatPesosForDisplay, formatCurrency, centavosToPesos } from '@shared/utils/currencyUtils.js';
import { LoadingSpinner } from '../common';
import { useMobileStrings } from '../../hooks/useMobileStrings.js';
import { pickLocalized } from '../../utils/localization.js';

const HOADashboard = () => {
  const { currentClient } = useAuth();
  const {
    accountBalances,
    hoaDuesStatus,
    loading: dashLoading,
  } = useDashboardData();

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
  const { priorMonthBalance, priorLoading } = usePriorMonthBalance(clientId);
  const { polls, projects, loading: pollsProjectsLoading } = usePollsProjects(clientId);
  const { preferredLanguageUi } = useSessionPreferences();
  const t = useMobileStrings();

  const [budgetData, setBudgetData] = useState(null);
  const [budgetLocalizedLabels, setBudgetLocalizedLabels] = useState({});
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [projectExpanded, setProjectExpanded] = useState(null);
  const [showAllBudgetCategories, setShowAllBudgetCategories] = useState(false);

  // Budget data
  useEffect(() => {
    if (!clientId) return;
    const user = auth.currentUser;
    const tokenPromise = user?.getIdToken?.();
    if (!tokenPromise) {
      setBudgetLoading(false);
      return;
    }
    let cancelled = false;
    setBudgetLoading(true);
    tokenPromise.then((t) =>
      fetch(`${config.api.baseUrl}/reports/${clientId}/budget-actual/data?language=${preferredLanguageUi === 'ES' ? 'spanish' : 'english'}`, {
        headers: {
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
      })
    ).then((r) => (r?.ok ? r.json() : null)).then((res) => {
      if (!cancelled && res?.data) {
        setBudgetData(res.data);
        setBudgetLocalizedLabels(res.data.localizedLabels || {});
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setBudgetLoading(false); });
    return () => { cancelled = true; };
  }, [clientId, preferredLanguageUi]);

  if (!currentClient) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">{t('hoa.selectClient')}</Typography>
      </Box>
    );
  }

  const totalCreditBalances = hoaDuesStatus?.totalCreditBalances ?? 0; // pesos
  const currentTotal = accountBalances?.total ?? 0; // pesos (bank + cash)
  const netTotal = Math.max(0, currentTotal - totalCreditBalances); // Bank + Cash − Credit Balances
  const priorTotal = priorMonthBalance ?? 0; // bank + cash only (no prior-month credit data)
  const delta = currentTotal - priorTotal; // Bank + Cash vs Bank + Cash (prior) — credits not comparable
  const accounts = accountBalances?.accounts || [];
  const collectionRate = Math.round(hoaDuesStatus?.collectionRate ?? 0);

  const allSortedByVariance = useMemo(() => {
    const expenseCats = budgetData?.expenses?.categories || [];
    const withDiff = expenseCats.map((c) => {
      const actual = c.ytdActual ?? 0;
      const budget = c.ytdBudget ?? 0;
      const diff = actual - budget;
      return { ...c, diff, absDiff: Math.abs(diff) };
    });
    return [...withDiff].sort((a, b) => b.absDiff - a.absDiff);
  }, [budgetData]);

  const displayBudgetCats = showAllBudgetCategories
    ? allSortedByVariance
    : allSortedByVariance.slice(0, 5);

  const budgetLabel = (key, fallback) => pickLocalized(budgetLocalizedLabels?.[key], fallback);

  return (
    <Box sx={{ p: 2, pb: 12 }}>
      {/* Financial Health — Bank, Cash, Credit Balances, total less credits */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('hoa.financialHealth')}</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0863bf', mb: 1 }}>
            {formatPesosForDisplay(netTotal)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {t('owner.bankCashMinusCredits')}
          </Typography>
          {!priorLoading && priorTotal != null && (
            <Typography variant="body2" sx={{ color: delta >= 0 ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              {delta >= 0 ? <UpIcon fontSize="small" /> : <DownIcon fontSize="small" />}
              {delta >= 0
                ? t('owner.upFromLastMonth', { amount: formatPesosForDisplay(Math.abs(delta)) })
                : t('owner.downFromLastMonth', { amount: formatPesosForDisplay(Math.abs(delta)) })}
            </Typography>
          )}
          <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            {accounts.map((acc) => (
              <Box key={acc.id || acc.name} display="flex" justifyContent="space-between" py={0.5}>
                <Typography variant="body2" color="text.secondary">{acc.name || acc.id || t('hoa.accountFallback')}</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatPesosForDisplay(Math.round((acc.balance || 0) / 100))}
                </Typography>
              </Box>
            ))}
            {totalCreditBalances > 0 && (
              <Box display="flex" justifyContent="space-between" py={0.5}>
                <Typography variant="body2" color="text.secondary">{t('hoa.creditBalances')}</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatPesosForDisplay(totalCreditBalances)}
                </Typography>
              </Box>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('hoa.collection', { rate: collectionRate })}
          </Typography>
        </CardContent>
      </Card>

      {/* Section B: Active Polls */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('hoa.activePolls')}</Typography>
          {pollsProjectsLoading ? (
            <Box display="flex" justifyContent="center" py={2}><LoadingSpinner size="small" /></Box>
          ) : polls.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{t('hoa.noActivePolls')}</Typography>
          ) : (
            <List dense disablePadding>
              {polls.map((p) => (
                <ListItem key={p.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={p.titleDisplay || p.title || p.question || t('hoa.pollFallback')}
                    secondary={p.closingDate ? t('hoa.closes', { date: formatDateForDisplay(p.closingDate) }) : null}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip label={t('hoa.voteNeeded')} size="small" color="warning" sx={{ fontSize: '0.7rem' }} />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Section C: Active Projects */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('hoa.activeProjects')}</Typography>
          {pollsProjectsLoading ? (
            <Box display="flex" justifyContent="center" py={2}><LoadingSpinner size="small" /></Box>
          ) : projects.length === 0 ? (
            <Typography variant="body2" color="text.secondary">{t('hoa.noActiveProjects')}</Typography>
          ) : (
            <List dense disablePadding>
              {projects.map((p) => (
                <React.Fragment key={p.id}>
                  <ListItem
                    disablePadding
                    sx={{ py: 0.5, cursor: 'pointer' }}
                    onClick={() => setProjectExpanded(projectExpanded === p.id ? null : p.id)}
                  >
                    <ListItemText
                      primary={p.nameDisplay || p.name || p.title || t('hoa.projectFallback')}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                    <Chip label={p.statusDisplay || p.status || '—'} size="small" sx={{ fontSize: '0.7rem', mr: 0.5 }} />
                    <Typography variant="body2" fontWeight={500}>
                      {formatPesosForDisplay(Math.round((p.totalCost || p.cost || 0) / 100))}
                    </Typography>
                    {projectExpanded === p.id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </ListItem>
                  <Collapse in={projectExpanded === p.id}>
                    <Box sx={{ pl: 2, pr: 2, pb: 1 }}>
                      {p.vendorName && (
                        <Typography variant="caption" color="text.secondary">
                          {t('hoa.vendor', { name: p.vendorName })}
                        </Typography>
                      )}
                      {p.milestones && p.milestones.length > 0 && (
                        <Box sx={{ mt: 0.5 }}>
                          {p.milestones.slice(0, 5).map((m, i) => (
                            <Typography key={i} variant="caption" display="block">
                              • {m.name || m.description || t('hoa.milestoneFallback')}: {m.status || '—'}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Section D: Budget Summary — Expense categories only (not income) */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>{t('hoa.budgetSummary')}</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {t('hoa.expenseOnly')}
          </Typography>
          {budgetLoading ? (
            <Box display="flex" justifyContent="center" py={2}><LoadingSpinner size="small" /></Box>
          ) : !budgetData ? (
            <Typography variant="body2" color="text.secondary">{t('hoa.noBudgetData')}</Typography>
          ) : (
            <>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">{t('hoa.expenseBudgetYtd')}</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatCurrency(budgetData.expenses?.totals?.totalYtdBudget || 0)}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">{t('hoa.expenseActualYtd')}</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatCurrency(budgetData.expenses?.totals?.totalYtdActual || 0)}
                </Typography>
              </Box>
              {allSortedByVariance.length > 0 && (
                <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                  <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', fontWeight: 600, color: '#6b7280', padding: '4px 8px 4px 0' }}>
                          {budgetLabel('topCategories', t('hoa.topCategories'))}
                        </th>
                        <th style={{ textAlign: 'right', fontWeight: 600, color: '#6b7280', padding: '4px 8px' }}>
                          {budgetLabel('actualYtd', t('hoa.actualYtd'))}
                        </th>
                        <th style={{ textAlign: 'right', fontWeight: 600, color: '#6b7280', padding: '4px 0 4px 8px' }}>
                          {budgetLabel('vsBudget', t('hoa.vsBudget'))}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayBudgetCats.map((c) => {
                        const diffPesos = centavosToPesos(c.diff);
                        const absPesos = Math.abs(diffPesos);
                        const isOver = c.diff > 0;
                        const diffColor = c.diff === 0 ? '#6b7280' : (isOver ? '#dc2626' : '#059669');
                        const diffLabel = c.diff === 0 ? '—' : (isOver ? `>${formatPesosForDisplay(absPesos)}` : `<${formatPesosForDisplay(absPesos)}`);
                        return (
                          <tr key={c.id}>
                            <td style={{ padding: '4px 8px 4px 0', verticalAlign: 'top' }}>
                              {pickLocalized(c.nameLocalized, c.name || c.id)}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(c.ytdActual || 0)}</td>
                            <td style={{ padding: '4px 0 4px 8px', textAlign: 'right', color: diffColor }}>{diffLabel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Box>
                  {allSortedByVariance.length > 5 && (
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => setShowAllBudgetCategories((v) => !v)}
                    >
                      {showAllBudgetCategories ? t('hoa.showLess') : t('hoa.showMore')}
                    </Button>
                  )}
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default HOADashboard;

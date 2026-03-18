/**
 * HOA Sub-Dashboard — Mobile owner view
 * Single scrollable page: Financial Health, Active Polls, Active Projects, Budget Summary
 * Sprint MOBILE-OWNER-UX (MOB-4)
 */
import React, { useState, useEffect } from 'react';
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
import { config } from '../../config/index.js';
import { auth } from '../../services/firebase';
import { getMexicoDateTime, formatDateForDisplay } from '../../utils/timezone.js';
import { formatCurrency, centavosToPesos, pesosToCentavos } from '@shared/utils/currencyUtils.js';
import { LoadingSpinner } from '../common';

const formatPesoDisplay = (pesos) => formatCurrency(pesosToCentavos(pesos ?? 0));

const HOADashboard = () => {
  const { currentClient } = useAuth();
  const {
    accountBalances,
    hoaDuesStatus,
    loading: dashLoading,
  } = useDashboardData();

  const [priorMonthBalance, setPriorMonthBalance] = useState(null);
  const [priorLoading, setPriorLoading] = useState(false);
  const [polls, setPolls] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pollsProjectsLoading, setPollsProjectsLoading] = useState(false);
  const [budgetData, setBudgetData] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [projectExpanded, setProjectExpanded] = useState(null);

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;

  // Prior month balance
  useEffect(() => {
    if (!clientId) return;
    const user = auth.currentUser;
    if (!user?.getIdToken) return;
    const now = getMexicoDateTime();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrev = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    const asOfDate = lastDayPrev.toISOString().split('T')[0];
    let cancelled = false;
    setPriorLoading(true);
    user.getIdToken().then((t) =>
      fetch(`${config.api.baseUrl}/clients/${clientId}/balances/current?asOfDate=${asOfDate}`, {
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      })
    ).then((r) => (r?.ok ? r.json() : null)).then((res) => {
      if (cancelled) return;
      if (res?.success && res?.data) {
        const bank = res.data.bankBalance || 0;
        const cash = res.data.cashBalance || 0;
        setPriorMonthBalance(Math.round((bank + cash) / 100));
      } else {
        setPriorMonthBalance(0);
      }
    }).catch(() => { if (!cancelled) setPriorMonthBalance(0); }).finally(() => { if (!cancelled) setPriorLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  // Polls and projects
  useEffect(() => {
    if (!clientId) return;
    const user = auth.currentUser;
    if (!user?.getIdToken) return;
    let cancelled = false;
    setPollsProjectsLoading(true);
    user.getIdToken().then((t) => {
      if (cancelled) return;
      const headers = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
      return Promise.all([
        fetch(`${config.api.baseUrl}/vote/clients/${clientId}/polls`, { headers }),
        fetch(`${config.api.baseUrl}/clients/${clientId}/projects`, { headers }),
      ]);
    }).then(async ([pR, projR]) => {
      if (cancelled) return;
      const [pollsJson, projectsJson] = await Promise.all([
        pR?.ok ? pR.json().catch(() => null) : Promise.resolve(null),
        projR?.ok ? projR.json().catch(() => null) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      if (pollsJson) {
        const list = pollsJson?.data || pollsJson?.polls || pollsJson || [];
        const arr = Array.isArray(list) ? list : Object.values(list);
        setPolls(arr.filter((p) => p?.status === 'published'));
      }
      if (projectsJson) {
        const list = projectsJson?.data || projectsJson?.projects || projectsJson || [];
        const arr = Array.isArray(list) ? list : Object.values(list);
        setProjects(arr.filter((p) => p?.status === 'approved' || p?.status === 'in-progress'));
      }
    }).catch(() => {}).finally(() => { if (!cancelled) setPollsProjectsLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  // Budget data
  useEffect(() => {
    if (!clientId) return;
    const user = auth.currentUser;
    if (!user?.getIdToken) return;
    let cancelled = false;
    setBudgetLoading(true);
    user.getIdToken().then((t) =>
      fetch(`${config.api.baseUrl}/reports/${clientId}/budget-actual/data?language=english`, {
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      })
    ).then((r) => (r?.ok ? r.json() : null)).then((res) => {
      if (!cancelled && res?.data) setBudgetData(res.data);
    }).catch(() => {}).finally(() => { if (!cancelled) setBudgetLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (!currentClient) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">Select a client to view HOA information.</Typography>
      </Box>
    );
  }

  const currentTotal = accountBalances?.total ?? 0;
  const priorTotal = priorMonthBalance ?? 0;
  const delta = currentTotal - priorTotal;
  const accounts = accountBalances?.accounts || [];
  const collectionRate = Math.round(hoaDuesStatus?.collectionRate ?? 0);

  const expenseCats = budgetData?.expenses?.categories || [];
  const withDiff = expenseCats.map((c) => {
    const actual = c.ytdActual ?? 0;
    const budget = c.ytdBudget ?? 0;
    const diff = actual - budget;
    return { ...c, diff, absDiff: Math.abs(diff) };
  });
  const top5ByVariance = [...withDiff].sort((a, b) => b.absDiff - a.absDiff).slice(0, 5);

  return (
    <Box sx={{ p: 2, pb: 12 }}>
      {/* Section A: Financial Health */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Financial Health</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0863bf', mb: 1 }}>
            {formatPesoDisplay(currentTotal)}
          </Typography>
          {!priorLoading && priorTotal != null && (
            <Typography variant="body2" sx={{ color: delta >= 0 ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {delta >= 0 ? <UpIcon fontSize="small" /> : <DownIcon fontSize="small" />}
              {delta >= 0 ? 'Up' : 'Down'} {formatPesoDisplay(Math.abs(delta))} from last month
            </Typography>
          )}
          {accounts.length > 0 && (
            <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              {accounts.map((acc) => (
                <Box key={acc.id || acc.name} display="flex" justifyContent="space-between" py={0.5}>
                  <Typography variant="body2" color="text.secondary">{acc.name || acc.id || 'Account'}</Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {formatPesoDisplay(Math.round((acc.balance || 0) / 100))}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Collection: {collectionRate}%
          </Typography>
        </CardContent>
      </Card>

      {/* Section B: Active Polls */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Active Polls</Typography>
          {pollsProjectsLoading ? (
            <Box display="flex" justifyContent="center" py={2}><LoadingSpinner size="small" /></Box>
          ) : polls.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No active polls</Typography>
          ) : (
            <List dense disablePadding>
              {polls.map((p) => (
                <ListItem key={p.id} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={p.title || p.question || 'Poll'}
                    secondary={p.closingDate ? `Closes ${formatDateForDisplay(p.closingDate)}` : null}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  <Chip label="Vote Needed" size="small" color="warning" sx={{ fontSize: '0.7rem' }} />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Section C: Active Projects */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Active Projects</Typography>
          {pollsProjectsLoading ? (
            <Box display="flex" justifyContent="center" py={2}><LoadingSpinner size="small" /></Box>
          ) : projects.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No active projects</Typography>
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
                      primary={p.name || p.title || 'Project'}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                    <Chip label={p.status || '—'} size="small" sx={{ fontSize: '0.7rem', mr: 0.5 }} />
                    <Typography variant="body2" fontWeight={500}>
                      {formatPesoDisplay(Math.round((p.totalCost || p.cost || 0) / 100))}
                    </Typography>
                    {projectExpanded === p.id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </ListItem>
                  <Collapse in={projectExpanded === p.id}>
                    <Box sx={{ pl: 2, pr: 2, pb: 1 }}>
                      {p.vendorName && (
                        <Typography variant="caption" color="text.secondary">Vendor: {p.vendorName}</Typography>
                      )}
                      {p.milestones && p.milestones.length > 0 && (
                        <Box sx={{ mt: 0.5 }}>
                          {p.milestones.slice(0, 5).map((m, i) => (
                            <Typography key={i} variant="caption" display="block">
                              • {m.name || m.description || 'Milestone'}: {m.status || '—'}
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
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Budget Summary</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Expense spending only (excludes income)
          </Typography>
          {budgetLoading ? (
            <Box display="flex" justifyContent="center" py={2}><LoadingSpinner size="small" /></Box>
          ) : !budgetData ? (
            <Typography variant="body2" color="text.secondary">No budget data</Typography>
          ) : (
            <>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Expense Budget YTD</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatPesoDisplay(centavosToPesos(budgetData.expenses?.totals?.totalYtdBudget || 0))}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">Expense Actual YTD</Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatPesoDisplay(centavosToPesos(budgetData.expenses?.totals?.totalYtdActual || 0))}
                </Typography>
              </Box>
              {top5ByVariance.length > 0 && (
                <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                  <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', fontWeight: 600, color: '#6b7280', padding: '4px 8px 4px 0' }}>Top Categories</th>
                        <th style={{ textAlign: 'right', fontWeight: 600, color: '#6b7280', padding: '4px 8px' }}>Actual YTD</th>
                        <th style={{ textAlign: 'right', fontWeight: 600, color: '#6b7280', padding: '4px 0 4px 8px' }}>vs Budget</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top5ByVariance.map((c) => {
                        const diffPesos = centavosToPesos(c.diff);
                        const absPesos = Math.abs(diffPesos);
                        const isOver = c.diff > 0;
                        const diffColor = c.diff === 0 ? '#6b7280' : (isOver ? '#dc2626' : '#059669');
                        const diffLabel = c.diff === 0 ? '—' : (isOver ? `>${formatPesoDisplay(absPesos)}` : `<${formatPesoDisplay(absPesos)}`);
                        return (
                          <tr key={c.id}>
                            <td style={{ padding: '4px 8px 4px 0', verticalAlign: 'top' }}>{c.name || c.id}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatPesoDisplay(centavosToPesos(c.ytdActual || 0))}</td>
                            <td style={{ padding: '4px 0 4px 8px', textAlign: 'right', color: diffColor }}>{diffLabel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Box>
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

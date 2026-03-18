/**
 * Budget Detail View — Fiscal year, YTD budget vs actual, variance
 * Sprint MOBILE-ADMIN-UX (ADM-5)
 */
import React from 'react';
import { Box, Typography, Card, CardContent, LinearProgress } from '@mui/material';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useClients } from '../../hooks/useClients.jsx';
import { useBudgetStatus } from '../../hooks/useBudgetStatus.js';
import { getCurrentFiscalPeriod } from '../../utils/fiscalYearUtils.js';
import { formatCurrency } from '@shared/utils/currencyUtils.js';
import { LoadingSpinner } from '../common';

const BudgetDetail = () => {
  const { currentClient } = useAuth();
  const { selectedClient } = useClients();
  const { budgetStatus, loading, error } = useBudgetStatus();
  const currentClientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;

  let fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth;
  if (fiscalYearStartMonth == null && currentClientId === 'AVII') {
    fiscalYearStartMonth = 7;
  } else if (fiscalYearStartMonth == null) {
    fiscalYearStartMonth = 1;
  }
  const fiscalPeriod = getCurrentFiscalPeriod(undefined, fiscalYearStartMonth);
  const percentElapsed = fiscalPeriod ? (fiscalPeriod.month / 12) * 100 : 0;
  const fiscalYearLabel = fiscalPeriod ? `FY ${fiscalPeriod.year}` : '—';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <LoadingSpinner size="medium" message="Loading budget..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Failed to load budget: {error}</Typography>
      </Box>
    );
  }

  const ytdBudget = budgetStatus?.expenseYtdBudget ?? 0;
  const ytdActual = budgetStatus?.expenseYtdActual ?? 0;
  const variance = budgetStatus?.expenseVariance ?? 0;
  const statusText = budgetStatus?.statusText ?? '—';
  const statusColor = budgetStatus?.statusColor ?? '#6b7280';
  const topCategories = budgetStatus?.topCategories ?? [];

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Budget Detail
      </Typography>

      <Card sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">
            Fiscal Year
          </Typography>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {fiscalYearLabel}
          </Typography>

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
            Period Elapsed
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, percentElapsed)}
            sx={{ height: 8, borderRadius: 4, mb: 2 }}
          />
          <Typography variant="caption" color="text.secondary">
            {percentElapsed.toFixed(0)}% of FY elapsed
          </Typography>

          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                YTD Budget
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {formatCurrency(ytdBudget)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                YTD Actual
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {formatCurrency(ytdActual)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Variance
              </Typography>
              <Typography
                variant="body1"
                fontWeight={600}
                sx={{ color: variance >= 0 ? '#059669' : '#dc2626' }}
              >
                {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
            <Typography variant="subtitle2" color="text.secondary">
              Status
            </Typography>
            <Typography variant="h6" sx={{ color: statusColor, fontWeight: 600 }}>
              {statusText}
            </Typography>
          </Box>

          {topCategories.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Top Categories Budget vs Actual
              </Typography>
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontWeight: 600, color: '#6b7280', padding: '4px 8px 4px 0' }}>Category</th>
                    <th style={{ textAlign: 'right', fontWeight: 600, color: '#6b7280', padding: '4px 8px' }}>Actual YTD</th>
                    <th style={{ textAlign: 'right', fontWeight: 600, color: '#6b7280', padding: '4px 0 4px 8px' }}>vs Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {topCategories.map((c) => {
                    const diffCentavos = c.diff || 0;
                    const absDiffCentavos = Math.abs(diffCentavos);
                    const isOver = diffCentavos > 0;
                    const diffColor = diffCentavos === 0 ? '#6b7280' : (isOver ? '#dc2626' : '#059669');
                    const diffLabel = diffCentavos === 0
                      ? '—'
                      : (isOver ? `>${formatCurrency(absDiffCentavos)}` : `<${formatCurrency(absDiffCentavos)}`);
                    return (
                      <tr key={c.id}>
                        <td style={{ padding: '4px 8px 4px 0', verticalAlign: 'top' }}>{c.name || c.id}</td>
                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{formatCurrency(c.ytdActual || 0)}</td>
                        <td style={{ padding: '4px 0 4px 8px', textAlign: 'right', color: diffColor }}>{diffLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default BudgetDetail;

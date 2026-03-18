/**
 * Budget Detail View — Fiscal year, YTD budget vs actual, variance
 * Sprint MOBILE-ADMIN-UX (ADM-5)
 */
import React from 'react';
import { Box, Typography, Card, CardContent, LinearProgress } from '@mui/material';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useBudgetStatus } from '../../hooks/useBudgetStatus.js';
import { getCurrentFiscalPeriod } from '../../utils/fiscalYearUtils.js';
import { formatPesosForDisplay } from '@shared/utils/currencyUtils.js';
import { LoadingSpinner } from '../common';

const BudgetDetail = () => {
  const { currentClient } = useAuth();
  const { budgetStatus, loading, error } = useBudgetStatus();

  const fiscalYearStartMonth = currentClient?.configuration?.fiscalYearStartMonth ?? 1;
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
                {formatPesosForDisplay(ytdBudget)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                YTD Actual
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {formatPesosForDisplay(ytdActual)}
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
                {variance >= 0 ? '+' : ''}{formatPesosForDisplay(variance)}
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
        </CardContent>
      </Card>
    </Box>
  );
};

export default BudgetDetail;

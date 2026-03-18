/**
 * Admin 3-Card Dashboard + Sub-dashboard detail cards
 * Sprint MOBILE-ADMIN-UX (ADM-1, ADM-2)
 * Replaces inline admin card grid with focused: Account Balances, Collection Status, Exchange Rates
 * Plus expandable Past Due Units, Water Bills Past Due, Polls/Projects summary
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  AccountBalance as BalanceIcon,
  Home as HomeIcon,
  CurrencyExchange as CurrencyIcon,
  Receipt as ReceiptIcon,
  Water as WaterIcon,
  Assignment as ProjectIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useClients } from '../../hooks/useClients.jsx';
import { useDashboardData } from '../../hooks/useDashboardData.js';
import { usePriorMonthBalance } from '../../hooks/usePriorMonthBalance.js';
import { usePollsProjects } from '../../hooks/usePollsProjects.js';
import { hasWaterBills } from '../../utils/clientFeatures.js';
import { formatPesosForDisplay } from '@shared/utils/currencyUtils.js';
import { LoadingSpinner } from '../common';
import ExpandableCard from '../dashboard/ExpandableCard.jsx';
import CompactCard from '../dashboard/CompactCard.jsx';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentClient } = useAuth();
  const { selectedClient } = useClients();
  const {
    accountBalances,
    hoaDuesStatus,
    exchangeRates,
    waterBillsStatus,
    loading: dashLoading,
    error,
  } = useDashboardData();

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
  const { priorMonthBalance, priorLoading } = usePriorMonthBalance(clientId);
  const { pollsCount, projectsCount, loading: pollsProjectsLoading } = usePollsProjects(clientId);
  const clientHasWaterBills = selectedClient ? hasWaterBills(selectedClient) : false;

  const [ratesModalOpen, setRatesModalOpen] = useState(false);

  // Account Balances: MoM trend (bank+cash vs prior month bank+cash)
  const currentTotal = accountBalances?.total ?? 0;
  const priorTotal = priorMonthBalance ?? 0;
  const delta = currentTotal - priorTotal;

  // Format past due details for ExpandableCard
  const pastDueDetails = (hoaDuesStatus.pastDueDetails || []).map((unit) => ({
    id: unit.unitId,
    label: unit.unitId,
    sublabel: unit.owner,
    value: formatPesosForDisplay(unit.amountDue),
  }));

  const waterPastDueDetails = (waterBillsStatus.pastDueDetails || []).map((unit) => ({
    id: unit.unitId,
    label: unit.unitId,
    sublabel: unit.owner,
    value: formatPesosForDisplay(unit.amountDue),
  }));

  const mainCards = [
    {
      title: 'Account Balances',
      icon: BalanceIcon,
      color: '#0863bf',
      loading: dashLoading.accounts || priorLoading,
      onClick: () => navigate('/expense-entry'),
      content: (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Bank + Cash
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0863bf', mb: 0.5 }}>
            {formatPesosForDisplay(currentTotal)}
          </Typography>
          {!priorLoading && priorTotal != null && (
            <Typography
              variant="body2"
              sx={{ color: delta >= 0 ? '#059669' : '#dc2626', mb: 0.5 }}
            >
              {delta >= 0 ? 'Up' : 'Down'} {formatPesosForDisplay(Math.abs(delta))} from last month
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Bank: {formatPesosForDisplay(accountBalances?.bank ?? 0)} · Cash:{' '}
            {formatPesosForDisplay(accountBalances?.cash ?? 0)}
          </Typography>
        </>
      ),
    },
    {
      title: 'Collection Status',
      icon: HomeIcon,
      color: '#059669',
      loading: dashLoading.dues,
      content: (
        <>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#059669', mb: 0.5 }}>
            {Math.round(hoaDuesStatus?.collectionRate ?? 0)}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatPesosForDisplay(hoaDuesStatus?.pastDueAmount ?? 0)} past due ·{' '}
            {hoaDuesStatus?.overdueCount ?? 0} unit{(hoaDuesStatus?.overdueCount ?? 0) !== 1 ? 's' : ''}
          </Typography>
        </>
      ),
    },
    {
      title: 'Exchange Rates',
      icon: CurrencyIcon,
      color: '#7c3aed',
      loading: dashLoading.rates,
      onClick: () => setRatesModalOpen(true),
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
      {/* 3 Main Cards */}
      {mainCards.map((c) => (
        <Card
          key={c.title}
          onClick={c.onClick}
          sx={{
            borderRadius: '16px',
            cursor: c.onClick ? 'pointer' : 'default',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            '&:active': c.onClick ? { transform: 'scale(0.98)' } : {},
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

      {/* ADM-2: Sub-dashboard detail cards */}
      {/* Past Due Units */}
      <ExpandableCard
        icon={ReceiptIcon}
        title="Past Due Units"
        value={formatPesosForDisplay(hoaDuesStatus?.pastDueAmount ?? 0)}
        subtitle={`${hoaDuesStatus?.overdueCount ?? 0} unit${(hoaDuesStatus?.overdueCount ?? 0) !== 1 ? 's' : ''} need attention`}
        color="#dc2626"
        loading={dashLoading.dues}
        details={pastDueDetails}
        alertMessage={
          (hoaDuesStatus?.overdueCount ?? 0) > 0
            ? `${hoaDuesStatus.overdueCount} unit${hoaDuesStatus.overdueCount !== 1 ? 's' : ''} past due`
            : null
        }
        emptyMessage="All units are current!"
      />

      {/* Water Bills Past Due */}
      {clientHasWaterBills && (
        <ExpandableCard
          icon={WaterIcon}
          title="Water Bills Past Due"
          value={formatPesosForDisplay(waterBillsStatus?.totalUnpaid ?? 0)}
          subtitle={`${waterBillsStatus?.overdueCount ?? 0} unit${(waterBillsStatus?.overdueCount ?? 0) !== 1 ? 's' : ''} unpaid`}
          color="#0891b2"
          loading={dashLoading.water}
          error={error?.water ? 'Water bills not available' : null}
          details={waterPastDueDetails}
          alertMessage={
            (waterBillsStatus?.overdueCount ?? 0) > 0
              ? `${waterBillsStatus.overdueCount} unit${waterBillsStatus.overdueCount !== 1 ? 's' : ''} past due`
              : null
          }
          emptyMessage="All water bills current!"
        >
          {waterBillsStatus?.totalBilled > 0 && (
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
              <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <span>Collection Rate:</span>
                <strong
                  style={{
                    color: (waterBillsStatus?.collectionRate ?? 0) >= 80 ? '#059669' : '#dc2626',
                  }}
                >
                  {(waterBillsStatus?.collectionRate ?? 0).toFixed(1)}%
                </strong>
              </Typography>
            </Box>
          )}
        </ExpandableCard>
      )}

      {/* Polls/Projects Summary */}
      <CompactCard
        icon={ProjectIcon}
        title="Polls & Projects"
        value={`${pollsCount} poll${pollsCount !== 1 ? 's' : ''}, ${projectsCount} project${projectsCount !== 1 ? 's' : ''}`}
        subtitle="Active"
        color="#9ca3af"
        loading={pollsProjectsLoading}
      />

      {/* Exchange Rates Modal */}
      <Dialog
        open={ratesModalOpen}
        onClose={() => setRatesModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center">
            <CurrencyIcon sx={{ color: '#7c3aed', mr: 1 }} />
            Exchange Rates
          </Box>
        </DialogTitle>
        <DialogContent>
          {dashLoading.rates ? (
            <Box display="flex" justifyContent="center" py={3}>
              <LoadingSpinner size="small" />
            </Box>
          ) : error?.rates ? (
            <Typography color="error">Unable to load exchange rates</Typography>
          ) : exchangeRates?.rates ? (
            <List dense>
              {[
                { code: 'USD', label: 'US Dollar', value: exchangeRates.rates.USD },
                { code: 'CAD', label: 'Canadian Dollar', value: exchangeRates.rates.CAD },
                { code: 'EUR', label: 'Euro', value: exchangeRates.rates.EUR },
                {
                  code: 'COP',
                  label: 'Colombian Peso',
                  value: exchangeRates.rates.COP ? 1 / exchangeRates.rates.COP : null,
                },
              ].map((currency, index) => (
                <React.Fragment key={currency.code}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body1" fontWeight={500}>
                            {currency.code}
                          </Typography>
                          <Typography variant="body1" fontWeight={700} color="#7c3aed">
                            {currency.value?.toFixed(currency.code === 'COP' ? 4 : 2) || 'N/A'}
                          </Typography>
                        </Box>
                      }
                      secondary={currency.label}
                    />
                  </ListItem>
                  {index < 3 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary" textAlign="center">
              No data available
            </Typography>
          )}
          {exchangeRates?.lastUpdated && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              textAlign="center"
              mt={2}
            >
              Last updated: {exchangeRates.lastUpdated}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRatesModalOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              setRatesModalOpen(false);
              navigate('/exchange-rates');
            }}
            startIcon={<CalculateIcon />}
          >
            Calculator
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;

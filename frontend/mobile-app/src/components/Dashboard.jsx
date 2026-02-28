/**
 * PWA Dashboard - Refactored with compact cards
 * GitHub #47 - 2-column grid layout with tap-to-expand
 */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { LoadingSpinner } from './common';
import {
  AccountBalance as BalanceIcon,
  TrendingUp as TrendingUpIcon,
  Receipt as ReceiptIcon,
  CurrencyExchange as CurrencyIcon,
  Home as HomeIcon,
  Assignment as ProjectIcon,
  Calculate as CalculateIcon,
  Water as WaterIcon,
  Description as StatementIcon,
  Payments as PaymentIcon,
  ArrowForward as ArrowIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { useClients } from '../hooks/useClients.jsx';
import { useSelectedUnit } from '../context/SelectedUnitContext.jsx';
import { useUnitAccountStatus } from '../hooks/useUnitAccountStatus';
import ClientSwitcher from './ClientSwitcher.jsx';
import { hasWaterBills } from '../utils/clientFeatures.js';
import { VERSION } from '../utils/versionUtils.js';
import CompactCard from './dashboard/CompactCard.jsx';
import ExpandableCard from './dashboard/ExpandableCard.jsx';

const Dashboard = () => {
  const navigate = useNavigate();
  const { samsUser, currentClient, isAuthenticated } = useAuth();
  const { selectedClient, selectClient } = useClients();
  const { selectedUnitId } = useSelectedUnit();
  const { data: unitAccountData } = useUnitAccountStatus(currentClient, selectedUnitId);
  const { 
    accountBalances, 
    hoaDuesStatus, 
    exchangeRates,
    waterBillsStatus,
    loading, 
    error 
  } = useDashboardData();
  
  // Modal state for detailed views
  const [ratesModalOpen, setRatesModalOpen] = useState(false);
  
  // Check if client has water bills enabled
  const clientHasWaterBills = selectedClient ? hasWaterBills(selectedClient) : false;

  if (!isAuthenticated) {
    return <LoadingSpinner message="Authenticating..." size="medium" />;
  }

  // Block maintenance users from accessing Dashboard
  const isMaintenance = samsUser?.globalRole === 'maintenance';
  if (isMaintenance) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          El Dashboard no está disponible para trabajadores de mantenimiento.
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => navigate('/tareas')}
          sx={{ textTransform: 'none' }}
        >
          Ir a Tareas
        </Button>
      </Box>
    );
  }

  const isAdmin = samsUser?.globalRole === 'admin';
  const isSuperAdmin = samsUser?.globalRole === 'superAdmin';
  const isAdminOrSuperAdmin = isAdmin || isSuperAdmin;
  const userRole = isSuperAdmin ? 'SuperAdmin' : (isAdmin ? 'Admin' : 'Owner');

  // Format past due details for ExpandableCard
  const pastDueDetails = (hoaDuesStatus.pastDueDetails || []).map(unit => ({
    id: unit.unitId,
    label: unit.unitId,
    sublabel: unit.owner,
    value: `$${unit.amountDue?.toLocaleString() || '0'}`,
  }));

  // Format water bills past due details
  const waterPastDueDetails = (waterBillsStatus.pastDueDetails || []).map(unit => ({
    id: unit.unitId,
    label: unit.unitId,
    sublabel: unit.owner,
    value: `$${unit.amountDue?.toLocaleString() || '0'}`,
  }));

  return (
    <Box className="mobile-dashboard" sx={{ minHeight: '100vh' }}>
      <Box className="mobile-dashboard-content" sx={{ p: 2, pb: 10 }}>
        {/* Header */}
        <Box mb={2} textAlign="center">
          <Typography variant="h5" sx={{ fontWeight: 600, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            Dashboard
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center" my={1}>
            <Chip 
              label={userRole} 
              color={isAdminOrSuperAdmin ? 'primary' : 'secondary'} 
              size="small" 
              sx={{ fontWeight: 600 }}
            />
          </Box>
          {currentClient && (
            <ClientSwitcher 
              currentClient={currentClient}
              onClientChange={async (newClientId) => {
                try {
                  await selectClient(newClientId);
                } catch (error) {
                  console.error('❌ Failed to change client:', error);
                }
              }}
            />
          )}
        </Box>

        {/* === COMPACT CARDS GRID (2 columns) === */}
        <Box 
          sx={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1.5,
            maxWidth: 400,
            mx: 'auto',
            mb: 2,
          }}
        >
          {/* Account Balance Card */}
          <CompactCard
            icon={BalanceIcon}
            title="Balance"
            value={`$${accountBalances.total?.toLocaleString() || '0'}`}
            subtitle="Total Accounts"
            color="#0863bf"
            loading={loading.accounts}
            secondaryLabel="Bank"
            secondaryValue={`$${accountBalances.bank?.toLocaleString() || '0'}`}
            onClick={() => navigate(isAdminOrSuperAdmin ? '/expense-entry' : '/transactions')}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                color: '#6b7280',
                fontSize: '0.7rem',
                mt: 0.5,
              }}
            >
              <span>Cash</span>
              <strong style={{ color: '#374151' }}>${accountBalances.cash?.toLocaleString() || '0'}</strong>
            </Typography>
          </CompactCard>

          {/* HOA Dues Card */}
          <CompactCard
            icon={HomeIcon}
            title="HOA Dues"
            value={`${hoaDuesStatus.collectionRate?.toFixed(0) || '0'}%`}
            subtitle="Collection Rate"
            color="#059669"
            loading={loading.dues}
            progress={hoaDuesStatus.collectionRate || 0}
            onClick={isAdminOrSuperAdmin ? undefined : () => navigate('/my-report')}
          />

          {/* Exchange Rates Card */}
          <CompactCard
            icon={CurrencyIcon}
            title="USD Rate"
            value={exchangeRates?.rates?.USD?.toFixed(2) || '—'}
            subtitle={exchangeRates?.lastUpdated ? `MXN · ${exchangeRates.lastUpdated}` : 'MXN per USD'}
            color="#7c3aed"
            loading={loading.rates}
            onClick={() => setRatesModalOpen(true)}
            secondaryLabel="CAD"
            secondaryValue={exchangeRates?.rates?.CAD?.toFixed(2) || '—'}
          />

          {/* Budget Status Card - Shows actual data now! */}
          <CompactCard
            icon={TrendingUpIcon}
            title="Budget"
            value="On Track"
            subtitle="YTD Status"
            color="#f59e0b"
            onClick={() => navigate('/reports')}
          />

          {/* === NON-ADMIN USER CARDS === */}
          {!isAdminOrSuperAdmin && (
            <>
              {/* My Account Card */}
              <CompactCard
                icon={StatementIcon}
                title="My Account"
                value="View"
                subtitle="Statement of Account"
                color="#3b82f6"
                onClick={() => navigate('/statement')}
              />

              {/* Payment Due Card — uses unit-specific data */}
              <CompactCard
                icon={PaymentIcon}
                title="Payment Due"
                value={(unitAccountData?.amountDue > 0) 
                  ? `$${unitAccountData.amountDue?.toLocaleString()}`
                  : 'Current'
                }
                subtitle={(unitAccountData?.amountDue > 0) ? 'Balance Due' : 'All paid up'}
                color={(unitAccountData?.amountDue > 0) ? '#dc2626' : '#059669'}
                badge={(unitAccountData?.amountDue > 0) ? { text: 'Action', color: '#dc2626' } : null}
                onClick={() => navigate('/my-report')}
              />
            </>
          )}

          {/* Projects Card (Placeholder) */}
          <CompactCard
            icon={ProjectIcon}
            title="Projects"
            value="Soon"
            subtitle="Coming soon"
            color="#9ca3af"
          />

          {/* Water Bills Card (if applicable) */}
          {clientHasWaterBills && !isAdminOrSuperAdmin && (
            <CompactCard
              icon={WaterIcon}
              title="Water"
              value={waterBillsStatus.totalUnpaid > 0 
                ? `$${waterBillsStatus.totalUnpaid?.toLocaleString()}` 
                : 'Current'
              }
              subtitle={waterBillsStatus.totalUnpaid > 0 ? 'Outstanding' : 'Paid up'}
              color="#0891b2"
              badge={waterBillsStatus.totalUnpaid > 0 ? { text: 'Due', color: '#0891b2' } : null}
            />
          )}

          {/* About/Version Card - Last card in grid */}
          <CompactCard
            icon={InfoIcon}
            title="About"
            value={`v${VERSION}`}
            subtitle="Tap for details"
            color="#64748b"
            onClick={() => navigate('/about')}
          />
        </Box>

        {/* === FULL-WIDTH EXPANDABLE CARDS (Admin Only) === */}
        {isAdminOrSuperAdmin && (
          <Box sx={{ maxWidth: 400, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Past Due Units Card */}
            <ExpandableCard
              icon={ReceiptIcon}
              title="Past Due Units"
              value={`$${hoaDuesStatus.pastDueAmount?.toLocaleString() || '0'}`}
              subtitle={`${hoaDuesStatus.overdueCount || 0} unit${hoaDuesStatus.overdueCount !== 1 ? 's' : ''} need attention`}
              color="#dc2626"
              loading={loading.dues}
              details={pastDueDetails}
              alertMessage={hoaDuesStatus.overdueCount > 0 
                ? `${hoaDuesStatus.overdueCount} unit${hoaDuesStatus.overdueCount !== 1 ? 's' : ''} past due`
                : null
              }
              emptyMessage="All units are current!"
            />

            {/* Water Bills Past Due Card */}
            {clientHasWaterBills && (
              <ExpandableCard
                icon={WaterIcon}
                title="Water Bills Past Due"
                value={`$${waterBillsStatus.totalUnpaid?.toLocaleString() || '0'}`}
                subtitle={`${waterBillsStatus.overdueCount || 0} unit${waterBillsStatus.overdueCount !== 1 ? 's' : ''} unpaid`}
                color="#0891b2"
                loading={loading.water}
                error={error.water ? 'Water bills not available' : null}
                details={waterPastDueDetails}
                alertMessage={waterBillsStatus.overdueCount > 0 
                  ? `${waterBillsStatus.overdueCount} unit${waterBillsStatus.overdueCount !== 1 ? 's' : ''} past due`
                  : null
                }
                emptyMessage="All water bills current!"
              >
                {/* Additional stats */}
                {waterBillsStatus.totalBilled > 0 && (
                  <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <span>Collection Rate:</span>
                      <strong style={{ color: waterBillsStatus.collectionRate >= 80 ? '#059669' : '#dc2626' }}>
                        {waterBillsStatus.collectionRate?.toFixed(1) || '0'}%
                      </strong>
                    </Typography>
                  </Box>
                )}
              </ExpandableCard>
            )}
          </Box>
        )}

        {/* Quick Actions for Non-Admins */}
        {!isAdminOrSuperAdmin && (
          <Box sx={{ maxWidth: 400, mx: 'auto', mt: 2 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<ArrowIcon />}
              onClick={() => navigate('/statement')}
              sx={{
                background: 'linear-gradient(135deg, #0863bf 0%, #3b82f6 100%)',
                borderRadius: '12px',
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(8, 99, 191, 0.3)',
              }}
            >
              View Full Statement of Account
            </Button>
          </Box>
        )}
      </Box>

      {/* Exchange Rates Modal */}
      <Dialog 
        open={ratesModalOpen} 
        onClose={() => setRatesModalOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: '16px' }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center">
            <CurrencyIcon sx={{ color: '#7c3aed', mr: 1 }} />
            Exchange Rates
          </Box>
        </DialogTitle>
        <DialogContent>
          {loading.rates ? (
            <Box display="flex" justifyContent="center" py={3}>
              <LoadingSpinner size="small" />
            </Box>
          ) : error.rates ? (
            <Alert severity="error">Unable to load exchange rates</Alert>
          ) : exchangeRates?.rates ? (
            <List dense>
              {[
                { code: 'USD', label: 'US Dollar', value: exchangeRates.rates.USD },
                { code: 'CAD', label: 'Canadian Dollar', value: exchangeRates.rates.CAD },
                { code: 'EUR', label: 'Euro', value: exchangeRates.rates.EUR },
                { code: 'COP', label: 'Colombian Peso', value: exchangeRates.rates.COP ? (1/exchangeRates.rates.COP) : null },
              ].map((currency, index) => (
                <React.Fragment key={currency.code}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body1" fontWeight={500}>{currency.code}</Typography>
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
            <Typography color="text.secondary" textAlign="center">No data available</Typography>
          )}
          {exchangeRates?.lastUpdated && (
            <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>
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

export default Dashboard;

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  IconButton,
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { useClients } from '../hooks/useClients.jsx';
import ClientSwitcher from './ClientSwitcher.jsx';

const Dashboard = () => {
  const navigate = useNavigate();
  const { samsUser, currentClient, isAuthenticated } = useAuth();
  const { selectedClient } = useClients();
  const { 
    accountBalances, 
    hoaDuesStatus, 
    exchangeRates, 
    loading, 
    error 
  } = useDashboardData();

  if (!isAuthenticated) {
    return <LoadingSpinner message="Authenticating..." size="medium" />;
  }

  const isAdmin = samsUser?.globalRole === 'admin';
  const isSuperAdmin = samsUser?.globalRole === 'superAdmin';
  const userRole = isSuperAdmin ? 'SuperAdmin' : (isAdmin ? 'Administrator' : 'Unit Owner');

  return (
    <Box className="mobile-dashboard" sx={{ minHeight: '100vh' }}>
      <Box className="mobile-dashboard-content" p={2} pb={10}>
        {/* Header */}
        <Box mb={3} textAlign="center">
          <Typography variant="h5" gutterBottom>
            Dashboard
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center" mb={1}>
            <Chip 
              label={userRole} 
              color={isAdmin ? 'primary' : 'secondary'} 
              size="small" 
            />
          </Box>
          {currentClient && (
            <ClientSwitcher 
              currentClient={currentClient}
              onClientChange={(newClient) => {
                // TODO: Implement client change logic
                console.log('Client change to:', newClient);
              }}
            />
          )}
        </Box>

      {/* Welcome Message */}
      <Alert 
        severity="info" 
        sx={{ mb: 3 }}
        icon={<BalanceIcon />}
      >
        Welcome to Sandyland Asset Management. {isAdmin ? 
          'You have administrator access with full system capabilities.' : 
          'Access your unit information and exchange rates.'
        }
      </Alert>

      {/* Data Cards */}
      <Grid 
        container 
        spacing={2}
        className="dashboard-cards-container"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '400px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        
        {/* Account Balance Card */}
        <Grid item xs={12} className="dashboard-card">
          <Card 
            className="mobile-card"
            sx={{ 
              height: '100%',
              margin: 0,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <BalanceIcon sx={{ color: '#0863bf', mr: 1, fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Account Balances</Typography>
              </Box>
              {loading.accounts ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <LoadingSpinner size="small" />
                </Box>
              ) : (
                <>
                  <Typography variant="h4" sx={{ color: '#0863bf', fontWeight: 700, mb: 1 }}>
                    ${accountBalances.total?.toLocaleString() || '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Total Balance
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <span>Bank Accounts:</span>
                      <strong>${accountBalances.bank?.toLocaleString() || '0'}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Cash Accounts:</span>
                      <strong>${accountBalances.cash?.toLocaleString() || '0'}</strong>
                    </Typography>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* HOA Dues Status Card */}
        <Grid item xs={12} className="dashboard-card">
          <Card 
            className="mobile-card"
            sx={{ 
              height: '100%',
              margin: 0,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <HomeIcon sx={{ color: '#059669', mr: 1, fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>HOA Dues Status</Typography>
              </Box>
              {loading.dues ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <LoadingSpinner size="small" />
                </Box>
              ) : (
                <>
                  <Typography variant="h4" sx={{ color: '#059669', fontWeight: 700, mb: 1 }}>
                    {hoaDuesStatus.collectionRate?.toFixed(1) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Collection Rate
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ 
                      width: '100%', 
                      backgroundColor: '#e2e8f0', 
                      borderRadius: '10px',
                      height: '8px',
                      overflow: 'hidden'
                    }}>
                      <Box sx={{
                        width: `${hoaDuesStatus.collectionRate || 0}%`,
                        backgroundColor: '#059669',
                        height: '100%',
                        transition: 'width 0.3s ease'
                      }} />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <span>Annual Dues:</span>
                      <strong>${hoaDuesStatus.totalDue?.toLocaleString() || '0'}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <span>Collected:</span>
                      <strong style={{ color: '#059669' }}>${hoaDuesStatus.collected?.toLocaleString() || '0'}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Outstanding:</span>
                      <strong style={{ color: '#d97706' }}>${hoaDuesStatus.outstanding?.toLocaleString() || '0'}</strong>
                    </Typography>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Past Due Units Card (Admin Only) */}
        {isAdmin && (
          <Grid item xs={12} className="dashboard-card">
            <Card 
              sx={{ 
                height: '100%',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
                }
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <ReceiptIcon sx={{ color: '#dc2626', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Past Due Units</Typography>
                </Box>
                {loading.dues ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <LoadingSpinner size="small" />
                  </Box>
                ) : (
                  <>
                    <Typography variant="h4" sx={{ color: '#dc2626', fontWeight: 700, mb: 1 }}>
                      ${hoaDuesStatus.pastDueAmount?.toLocaleString() || '0'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Past Due Amount
                    </Typography>
                    <Box>
                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <span>Units Past Due:</span>
                        <strong>{hoaDuesStatus.overdueCount || 0}</strong>
                      </Typography>
                      {hoaDuesStatus.overdueCount > 0 && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          {hoaDuesStatus.overdueCount} unit{hoaDuesStatus.overdueCount !== 1 ? 's' : ''} need attention
                        </Alert>
                      )}
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Exchange Rate Card */}
        <Grid item xs={12} className="dashboard-card">
          <Card 
            className="mobile-card"
            onClick={() => navigate('/exchange-rates')}
            sx={{ 
              height: '100%',
              margin: 0,
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center">
                  <CurrencyIcon sx={{ color: '#7c3aed', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Exchange Rates</Typography>
                </Box>
                <IconButton 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/exchange-rates');
                  }}
                  sx={{ 
                    color: '#7c3aed',
                    bgcolor: 'rgba(124, 58, 237, 0.1)',
                    '&:hover': {
                      bgcolor: 'rgba(124, 58, 237, 0.2)'
                    }
                  }}
                  title="View All"
                >
                  <CalculateIcon />
                </IconButton>
              </Box>
              {loading.rates ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <LoadingSpinner size="small" />
                </Box>
              ) : error.rates ? (
                <Box textAlign="center" py={2}>
                  <Typography variant="body2" color="error">
                    Unable to load exchange rates
                  </Typography>
                </Box>
              ) : exchangeRates?.rates ? (
                <>
                  {/* Individual Currency Rows */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <span>USD:</span>
                      <strong>{exchangeRates.rates.USD?.toFixed(2) || 'N/A'}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <span>CAD:</span>
                      <strong>{exchangeRates.rates.CAD?.toFixed(2) || 'N/A'}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <span>EUR:</span>
                      <strong>{exchangeRates.rates.EUR?.toFixed(2) || 'N/A'}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <span>COP:</span>
                      <strong>{exchangeRates.rates.COP ? (1/exchangeRates.rates.COP).toFixed(4) : 'N/A'}</strong>
                    </Typography>
                  </Box>
                  
                  {/* Footer Info */}
                  <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid rgba(0, 0, 0, 0.12)' }}>
                    <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                      Last updated: {exchangeRates.lastUpdated || 'Never'}
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box textAlign="center" py={2}>
                  <Typography variant="body2" color="text.secondary">
                    No exchange rate data available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Projects and Budget Cards - Horizontal Layout */}
        <Grid item xs={12} sx={{ width: '100%', maxWidth: '350px' }}>
          <Box className="dashboard-horizontal-cards" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {/* Projects Card (Placeholder) */}
            <Card 
              sx={{ 
                height: '100%',
                minHeight: '120px',
                opacity: 0.7,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
                }
              }}
            >
              <CardContent sx={{ padding: '12px !important' }}>
                <Box display="flex" alignItems="center" mb={1}>
                  <ProjectIcon sx={{ color: '#6b7280', mr: 0.5, fontSize: 20 }} />
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.875rem' }}>Projects</Typography>
                </Box>
                <Typography variant="h5" sx={{ color: '#6b7280', fontWeight: 700, mb: 0.5, fontSize: '1.25rem' }}>
                  Coming Soon
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Project tracking
                </Typography>
              </CardContent>
            </Card>

            {/* Budget Card (Placeholder) */}
            <Card 
              sx={{ 
                height: '100%',
                minHeight: '120px',
                opacity: 0.7,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
                }
              }}
            >
              <CardContent sx={{ padding: '12px !important' }}>
                <Box display="flex" alignItems="center" mb={1}>
                  <TrendingUpIcon sx={{ color: '#6b7280', mr: 0.5, fontSize: 20 }} />
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.875rem' }}>Budget</Typography>
                </Box>
                <Typography variant="h5" sx={{ color: '#6b7280', fontWeight: 700, mb: 0.5, fontSize: '1.25rem' }}>
                  Coming Soon
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Budget analysis
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Grid>

      </Grid>
      </Box>
    </Box>
  );
};

export default Dashboard;

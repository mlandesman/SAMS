import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  AccountBalance as BalanceIcon,
  TrendingUp as TrendingUpIcon,
  Receipt as ReceiptIcon,
  CurrencyExchange as CurrencyIcon,
  Home as HomeIcon,
  Assignment as ProjectIcon,
  Calculate as CalculateIcon,
  Water as WaterIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useClient } from '../context/ClientContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { hasWaterBills } from '../utils/clientFeatures';
import ActivityActionBar from '../components/common/ActivityActionBar';
import CurrencyCalculatorModal from '../components/CurrencyCalculatorModal';
import { LoadingSpinner } from '../components/common';
import ClientSwitcher from '../components/ClientSwitcher';
import './DashboardView.css';

function DashboardView() {
  const navigate = useNavigate();
  const { currentUser, samsUser } = useAuth();
  const { selectedClient, menuConfig } = useClient();
  const { 
    accountBalances, 
    hoaDuesStatus, 
    waterBillsStatus,
    loading, 
    error,
    refresh 
  } = useDashboardData();
  
  // Get enhanced exchange rates with multi-currency support
  const { 
    exchangeRate: exchangeRates, 
    loading: exchangeLoading, 
    error: exchangeError 
  } = useExchangeRates();
  
  // Currency calculator modal state
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  if (!currentUser) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <LoadingSpinner message="Loading..." />
      </Box>
    );
  }

  // Get user role with proper SuperAdmin detection
  const getUserRole = () => {
    if (!samsUser) return 'Unit Owner';
    
    // Check if SuperAdmin by email first
    if (samsUser.email === 'michael@landesman.com') {
      return 'Super Admin';
    }
    
    // Check globalRole
    if (samsUser.globalRole === 'superAdmin') {
      return 'Super Admin';
    }
    
    if (samsUser.globalRole === 'admin') {
      return 'Administrator';
    }
    
    if (samsUser.globalRole === 'unitManager') {
      return 'Unit Manager';
    }
    
    // Default to Unit Owner
    return 'Unit Owner';
  };
  
  const userRole = getUserRole();
  const isAdmin = userRole === 'Administrator' || userRole === 'Super Admin';

  return (
    <>
      <ActivityActionBar>
        {/* No action buttons needed for dashboard */}
      </ActivityActionBar>
      
      <div className="dashboard">
        {/* Header */}
        <Box mb={3}>
        <Typography variant="h4" gutterBottom sx={{ color: 'white', fontWeight: 600 }}>
          Dashboard
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
          <Chip 
            label={userRole} 
            color={isAdmin ? 'primary' : 'secondary'} 
            size="small" 
          />
          {selectedClient && <ClientSwitcher />}
        </Box>
      </Box>

      {/* Welcome Message */}
      <Alert 
        severity="info" 
        sx={{ 
          mb: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          '& .MuiAlert-icon': { color: '#0863bf' }
        }}
        icon={<BalanceIcon />}
      >
        Welcome to Sandyland Asset Management. {isAdmin ? 
          'You have administrator access with full system capabilities.' : 
          'Access your unit information and financial data.'
        }
      </Alert>

      {/* Data Cards */}
      <Grid container spacing={3}>
        
        {/* Account Balance Card */}
        <Grid item xs={12} sm={6} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
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
        <Grid item xs={12} sm={6} md={4}>
          <Tooltip
            title="Click to receive payment"
            arrow
            placement="top"
          >
            <Card 
              sx={{ 
                height: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
                }
              }}
              onClick={() => {
                navigate('/transactions', { state: { openUnifiedPayment: true } });
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
                      <Box 
                        className="hoa-progress-fill"
                        sx={{
                          '--progress-width': `${hoaDuesStatus.collectionRate || 0}%`,
                          width: `${hoaDuesStatus.collectionRate || 0}%`
                        }} 
                      />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <span>Currently Due:</span>
                      <strong>${hoaDuesStatus.currentlyDue?.toLocaleString() || '0'}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <span>Current Paid:</span>
                      <strong style={{ color: '#059669' }}>${hoaDuesStatus.currentPaid?.toLocaleString() || '0'}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Pre-Paid:</span>
                      <strong style={{ color: '#7c3aed' }}>${hoaDuesStatus.futurePayments?.toLocaleString() || '0'}</strong>
                    </Typography>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
          </Tooltip>
        </Grid>

        {/* HOA Dues Past Due Card */}
        {isAdmin && (
          <Grid item xs={12} sm={6} md={4}>
            <Card 
              sx={{ 
                height: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
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
                    <Tooltip
                      title={
                        hoaDuesStatus.pastDueDetails?.length > 0 ? (
                          <Box sx={{ p: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'white' }}>
                              Past Due Details
                            </Typography>
                            {hoaDuesStatus.pastDueDetails.map((unit, index) => (
                              <Box key={unit.unitId} sx={{ mb: index < hoaDuesStatus.pastDueDetails.length - 1 ? 1 : 0 }}>
                                <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, color: 'white' }}>
                                  <span>
                                    <strong>{unit.unitId}</strong> - {unit.owner}
                                  </span>
                                  <strong>${Math.round(unit.amountDue).toLocaleString()}</strong>
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        ) : 'No units past due'
                      }
                      arrow
                      placement="top"
                      PopperProps={{
                        sx: {
                          '& .MuiTooltip-tooltip': {
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            maxWidth: 'none',
                            padding: 0,
                            color: 'white'
                          }
                        }
                      }}
                    >
                      <Box sx={{ cursor: hoaDuesStatus.overdueCount > 0 ? 'pointer' : 'default' }}>
                        <Typography variant="h4" sx={{ color: '#dc2626', fontWeight: 700, mb: 1 }}>
                          ${hoaDuesStatus.pastDueAmount?.toLocaleString() || '0'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Past Due Amount
                        </Typography>
                        <Box>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Units Past Due:</span>
                            <strong>{hoaDuesStatus.overdueCount || 0}</strong>
                          </Typography>
                        </Box>
                      </Box>
                    </Tooltip>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Water Bills Past Due Card - Only show for clients with water bills enabled */}
        {isAdmin && hasWaterBills(selectedClient, menuConfig) && (
          <Grid item xs={12} sm={6} md={4}>
            <Card 
              sx={{ 
                height: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
                }
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Box display="flex" alignItems="center">
                    <WaterIcon sx={{ color: '#0891b2', mr: 1, fontSize: 28 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Water Bills Past Due</Typography>
                  </Box>
                  <Tooltip title="Refresh water bills data">
                    <IconButton 
                      size="small" 
                      onClick={refresh.water}
                      disabled={loading.water}
                      sx={{ 
                        color: '#0891b2',
                        '&:hover': { backgroundColor: '#0891b220' }
                      }}
                    >
                      <TrendingUpIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                {loading.water ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <LoadingSpinner size="small" />
                  </Box>
                ) : error.water ? (
                  <Box textAlign="center" py={2}>
                    <Typography variant="body2" color="text.secondary">
                      Water bills not available
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Tooltip
                      title={
                        waterBillsStatus.pastDueDetails?.length > 0 ? (
                          <Box sx={{ p: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'white' }}>
                              Water Bills Past Due Details
                            </Typography>
                            {waterBillsStatus.pastDueDetails.map((unit, index) => (
                              <Box key={unit.unitId} sx={{ mb: index < waterBillsStatus.pastDueDetails.length - 1 ? 1 : 0 }}>
                                <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, color: 'white' }}>
                                  <span>
                                    <strong>{unit.unitId}</strong> - {unit.owner}
                                  </span>
                                  <strong>${Math.round(unit.amountDue).toLocaleString()}</strong>
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        ) : 'No water bills past due'
                      }
                      arrow
                      placement="top"
                      PopperProps={{
                        sx: {
                          '& .MuiTooltip-tooltip': {
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            maxWidth: 'none',
                            padding: 0,
                            color: 'white'
                          }
                        }
                      }}
                    >
                      <Box sx={{ cursor: waterBillsStatus.overdueCount > 0 ? 'pointer' : 'default' }}>
                        <Typography variant="h4" sx={{ color: '#0891b2', fontWeight: 700, mb: 1 }}>
                          ${waterBillsStatus.totalUnpaid?.toLocaleString() || '0'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Past Due Amount
                        </Typography>
                        <Box>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <span>Units Past Due:</span>
                            <strong>{waterBillsStatus.overdueCount || 0}</strong>
                          </Typography>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Collection Rate:</span>
                            <strong style={{ color: waterBillsStatus.collectionRate >= 80 ? '#059669' : '#dc2626' }}>
                              {waterBillsStatus.collectionRate?.toFixed(1) || '0'}%
                            </strong>
                          </Typography>
                        </Box>
                      </Box>
                    </Tooltip>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Exchange Rate Card */}
        <Grid item xs={12} sm={6} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
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
                  onClick={() => setCalculatorOpen(true)}
                  sx={{ 
                    color: '#7c3aed',
                    bgcolor: 'rgba(124, 58, 237, 0.1)',
                    '&:hover': {
                      bgcolor: 'rgba(124, 58, 237, 0.2)'
                    }
                  }}
                  title="Open Calculator"
                >
                  <CalculateIcon />
                </IconButton>
              </Box>
              {exchangeLoading ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <LoadingSpinner size="small" />
                </Box>
              ) : exchangeError ? (
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

        {/* Projects Card (Placeholder) */}
        <Grid item xs={12} sm={6} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              opacity: 0.7,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
              }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ProjectIcon sx={{ color: '#6b7280', mr: 1, fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#6b7280' }}>Projects</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#6b7280', fontWeight: 700, mb: 1 }}>
                Coming Soon
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Project tracking and budget management will be available in a future update.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Budget Card (Placeholder) */}
        <Grid item xs={12} sm={6} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              opacity: 0.7,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
              }
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <TrendingUpIcon sx={{ color: '#6b7280', mr: 1, fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#6b7280' }}>Budget Analysis</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#6b7280', fontWeight: 700, mb: 1 }}>
                Coming Soon
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Budget vs actual analysis and variance reporting will be available in a future update.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

      </Grid>

      {/* Quick Actions */}
      <Box mt={4}>
        <Typography variant="h6" gutterBottom sx={{ color: '#0863bf', fontWeight: 600 }}>
          Quick Actions
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Use the navigation menu to access {isAdmin ? 
            'expense entry, exchange rates, and client management features' : 
            'exchange rates and your financial information'
          }.
        </Typography>
      </Box>
      
    </div>
    
    {/* Currency Calculator Modal */}
    <CurrencyCalculatorModal
      open={calculatorOpen}
      onClose={() => setCalculatorOpen(false)}
      rates={exchangeRates}
      loading={exchangeLoading}
    />
    </>
  );
}

export default DashboardView;
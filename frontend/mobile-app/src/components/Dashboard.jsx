import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Water as WaterIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { useClients } from '../hooks/useClients.jsx';
import ClientSwitcher from './ClientSwitcher.jsx';
import { hasWaterBills } from '../utils/clientFeatures.js';

const Dashboard = () => {
  const navigate = useNavigate();
  const { samsUser, currentClient, isAuthenticated } = useAuth();
  const { selectedClient, selectClient } = useClients();
  const { 
    accountBalances, 
    hoaDuesStatus, 
    exchangeRates,
    waterBillsStatus,
    loading, 
    error 
  } = useDashboardData();
  
  const [pastDueExpanded, setPastDueExpanded] = useState(false);
  const [waterBillsExpanded, setWaterBillsExpanded] = useState(false);
  
  // Check if client has water bills enabled
  const clientHasWaterBills = selectedClient ? hasWaterBills(selectedClient) : false;

  if (!isAuthenticated) {
    return <LoadingSpinner message="Authenticating..." size="medium" />;
  }

  // Block maintenance users from accessing Dashboard (contains sensitive financial data)
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
  const isAdminOrSuperAdmin = isAdmin || isSuperAdmin; // Combined check for admin features
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
              color={isAdminOrSuperAdmin ? 'primary' : 'secondary'} 
              size="small" 
            />
          </Box>
          {currentClient && (
            <ClientSwitcher 
              currentClient={currentClient}
              onClientChange={async (newClientId) => {
                try {
                  await selectClient(newClientId);
                  // Dashboard data will automatically refresh via useDashboardData hook
                  // which depends on currentClient from useAuth
                  console.log('✅ Client changed to:', newClientId);
                } catch (error) {
                  console.error('❌ Failed to change client:', error);
                }
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
        Welcome to Sandyland Asset Management. {isAdminOrSuperAdmin ? 
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
        {isAdminOrSuperAdmin && (
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
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Box display="flex" alignItems="center">
                    <ReceiptIcon sx={{ color: '#dc2626', mr: 1, fontSize: 28 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Past Due Units</Typography>
                  </Box>
                  {hoaDuesStatus.overdueCount > 0 && (
                    <IconButton
                      onClick={() => setPastDueExpanded(!pastDueExpanded)}
                      size="small"
                      sx={{ color: '#dc2626' }}
                    >
                      {pastDueExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
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
                        <>
                          <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
                            {hoaDuesStatus.overdueCount} unit{hoaDuesStatus.overdueCount !== 1 ? 's' : ''} need attention
                          </Alert>
                          <Collapse in={pastDueExpanded}>
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#dc2626' }}>
                                Past Due Details
                              </Typography>
                              {hoaDuesStatus.pastDueDetails && hoaDuesStatus.pastDueDetails.length > 0 ? (
                                <List dense sx={{ bgcolor: 'rgba(220, 38, 38, 0.05)', borderRadius: 1, p: 0 }}>
                                  {hoaDuesStatus.pastDueDetails.map((unit, index) => (
                                    <React.Fragment key={unit.unitId}>
                                      <ListItem sx={{ py: 0.75, px: 1.5 }}>
                                        <ListItemText
                                          primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {unit.unitId}
                                                {unit.owner && ` - ${unit.owner}`}
                                              </Typography>
                                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626' }}>
                                                ${unit.amountDue?.toLocaleString() || '0'}
                                              </Typography>
                                            </Box>
                                          }
                                        />
                                      </ListItem>
                                      {index < hoaDuesStatus.pastDueDetails.length - 1 && <Divider />}
                                    </React.Fragment>
                                  ))}
                                </List>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                  No detailed information available
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </>
                      )}
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Water Bills Past Due Card - Only show for clients with water bills enabled */}
        {isAdminOrSuperAdmin && clientHasWaterBills && (
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
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Box display="flex" alignItems="center">
                    <WaterIcon sx={{ color: '#0891b2', mr: 1, fontSize: 28 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Water Bills Past Due</Typography>
                  </Box>
                  {waterBillsStatus.overdueCount > 0 && (
                    <IconButton
                      onClick={() => setWaterBillsExpanded(!waterBillsExpanded)}
                      size="small"
                      sx={{ color: '#0891b2' }}
                    >
                      {waterBillsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
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
                      {waterBillsStatus.overdueCount > 0 && (
                        <>
                          <Alert severity="warning" sx={{ mt: 1, mb: 1 }}>
                            {waterBillsStatus.overdueCount} unit{waterBillsStatus.overdueCount !== 1 ? 's' : ''} need attention
                          </Alert>
                          <Collapse in={waterBillsExpanded}>
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#0891b2' }}>
                                Water Bills Past Due Details
                              </Typography>
                              {waterBillsStatus.pastDueDetails && waterBillsStatus.pastDueDetails.length > 0 ? (
                                <List dense sx={{ bgcolor: 'rgba(8, 145, 178, 0.05)', borderRadius: 1, p: 0 }}>
                                  {waterBillsStatus.pastDueDetails.map((unit, index) => (
                                    <React.Fragment key={unit.unitId}>
                                      <ListItem sx={{ py: 0.75, px: 1.5 }}>
                                        <ListItemText
                                          primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {unit.unitId}
                                                {unit.owner && ` - ${unit.owner}`}
                                              </Typography>
                                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0891b2' }}>
                                                ${unit.amountDue?.toLocaleString() || '0'}
                                              </Typography>
                                            </Box>
                                          }
                                        />
                                      </ListItem>
                                      {index < waterBillsStatus.pastDueDetails.length - 1 && <Divider />}
                                    </React.Fragment>
                                  ))}
                                </List>
                              ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                  No detailed information available
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </>
                      )}
                      {waterBillsStatus.totalBilled > 0 && (
                        <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid rgba(0, 0, 0, 0.12)' }}>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <span>Total Billed:</span>
                            <strong>${waterBillsStatus.totalBilled?.toLocaleString() || '0'}</strong>
                          </Typography>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <span>Total Paid:</span>
                            <strong style={{ color: '#059669' }}>${waterBillsStatus.totalPaid?.toLocaleString() || '0'}</strong>
                          </Typography>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Collection Rate:</span>
                            <strong style={{ color: waterBillsStatus.collectionRate >= 80 ? '#059669' : '#dc2626' }}>
                              {waterBillsStatus.collectionRate?.toFixed(1) || '0'}%
                            </strong>
                          </Typography>
                        </Box>
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

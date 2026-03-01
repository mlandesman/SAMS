import React, { useEffect, useState } from 'react';
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
  Menu,
  MenuItem,
  LinearProgress,
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
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useClient } from '../context/ClientContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { useBudgetStatus } from '../hooks/useBudgetStatus';
import { useUnitAccountStatus } from '../hooks/useUnitAccountStatus';
import { isAdmin as checkIsAdmin, isSuperAdmin as checkIsSuperAdmin } from '../utils/userRoles';
import { hasWaterBills } from '../utils/clientFeatures';
import { getMexicoDateTime } from '../utils/timezone';
import ActivityActionBar from '../components/common/ActivityActionBar';
import CurrencyCalculatorModal from '../components/CurrencyCalculatorModal';
import { LoadingSpinner } from '../components/common';
import ClientSwitcher from '../components/ClientSwitcher';
import { ErrorMonitorSection } from '../components/Dashboard/ErrorMonitorCard';
import { getPolls, getPoll } from '../api/polls';
import './DashboardView.css';

const formatDateDisplay = (value) => {
  if (!value) return '—';
  return value.display || value.ISO_8601 || value.iso || '—';
};

function DashboardView() {
  const navigate = useNavigate();
  const { currentUser, samsUser } = useAuth();
  const { selectedClient, selectedUnitId, setSelectedUnitId, setUnitOwnerNames, menuConfig } = useClient();
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
  
  // Get budget status for dashboard card
  const {
    budgetStatus,
    loading: budgetLoading,
    error: budgetError,
  } = useBudgetStatus();

  const [pollCard, setPollCard] = useState(null);
  const [pollLoading, setPollLoading] = useState(false);
  const [pollError, setPollError] = useState('');
  const [unitMenuAnchor, setUnitMenuAnchor] = useState(null);
  
  const formatDate = (value) => {
    if (!value || typeof value !== 'string') return '—';
    return value.split('T')[0];
  };

  const getNowMs = () => {
    if (typeof performance !== 'undefined' && performance.timeOrigin) {
      return performance.timeOrigin + performance.now();
    }
    return null;
  };

  const buildResultSummary = (summary) => {
    if (!summary?.breakdown || summary.breakdown.length === 0) {
      return null;
    }
    const sorted = [...summary.breakdown].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
    const top = sorted[0];
    if (!top) return null;
    return `${top.label || top.optionId} ${Math.round(top.percentage || 0)}%`;
  };

  useEffect(() => {
    const loadPolls = async () => {
      if (!selectedClient?.id) {
        setPollCard(null);
        return;
      }

      setPollLoading(true);
      setPollError('');
      try {
        const openResult = await getPolls(selectedClient.id, 'open');
        const closedResult = await getPolls(selectedClient.id, 'closed');
        const openPoll = (openResult.data || [])[0] || null;
        const closedPolls = closedResult.data || [];
        const nowMs = getNowMs();
        const recentClosed = closedPolls.find((poll) => {
          if (!nowMs) return true;
          const closedAt = poll.closedAt || poll.closesAt;
          if (!closedAt) return false;
          const isoValue = closedAt.iso || closedAt.ISO_8601 || closedAt;
          const diff = isoValue ? nowMs - Date.parse(isoValue) : Number.POSITIVE_INFINITY;
          return diff <= 30 * 24 * 60 * 60 * 1000;
        });

        if (openPoll) {
          const pollDetail = await getPoll(selectedClient.id, openPoll.pollId || openPoll.id);
          setPollCard({
            mode: 'open',
            poll: pollDetail.data,
            summary: pollDetail.data?.summary || null,
          });
        } else if (recentClosed) {
          const pollDetail = await getPoll(selectedClient.id, recentClosed.pollId || recentClosed.id);
          setPollCard({
            mode: 'closed',
            poll: pollDetail.data,
            summary: pollDetail.data?.summary || pollDetail.data?.results || null,
          });
        } else {
          setPollCard(null);
        }
      } catch (err) {
        setPollError(err.message || 'Failed to load polls');
      } finally {
        setPollLoading(false);
      }
    };

    loadPolls();
  }, [selectedClient?.id]);
  
  // Currency calculator modal state
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const isAdmin = checkIsAdmin(samsUser, selectedClient?.id);
  const isSuperAdmin = checkIsSuperAdmin(samsUser);

  // Display label for the role chip (client-level admin shows "Administrator" too)
  const getUserRole = () => {
    if (!samsUser) return 'Unit Owner';
    if (isSuperAdmin) return 'Super Admin';
    if (isAdmin) return 'Administrator';
    if (samsUser.globalRole === 'unitManager') return 'Unit Manager';
    const pa = samsUser?.propertyAccess?.[selectedClient?.id];
    if (pa?.role === 'unitManager') return 'Unit Manager';
    return 'Unit Owner';
  };
  const userRole = getUserRole();

  // For non-admin: get authorized units and property role (unitOwner = green, unitManager = purple)
  const propertyAccess = samsUser?.samsProfile?.propertyAccess?.[selectedClient?.id] ?? samsUser?.propertyAccess?.[selectedClient?.id];
  const isUnitOwnerOrManager = propertyAccess && (propertyAccess.role === 'unitOwner' || propertyAccess.role === 'unitManager');
  const unitChipColor = propertyAccess?.role === 'unitOwner' ? 'success' : 'secondary'; // green for Owner, purple for Manager
  const authorizedUnits = [];
  if (isUnitOwnerOrManager && propertyAccess) {
    if (propertyAccess.unitId) {
      authorizedUnits.push({ id: propertyAccess.unitId, name: `Unit ${propertyAccess.unitId}` });
    }
    if (propertyAccess.units && Array.isArray(propertyAccess.units)) {
      propertyAccess.units.forEach((unit) => {
        const uid = unit.id || unit.unitId;
        if (uid && !authorizedUnits.find((u) => u.id === uid)) {
          authorizedUnits.push({ id: uid, name: unit.name || `Unit ${uid}` });
        }
      });
    }
    // Profile may use unitAssignments (array of { unitId, role }) instead of units
    if (propertyAccess.unitAssignments && Array.isArray(propertyAccess.unitAssignments)) {
      propertyAccess.unitAssignments.forEach((a) => {
        const id = a.unitId || a.id;
        if (id && !authorizedUnits.find((u) => u.id === id)) {
          authorizedUnits.push({ id, name: a.name || `Unit ${id}` });
        }
      });
    }
  }
  const hasMultipleUnits = authorizedUnits.length > 1;
  const currentUnitLabel = authorizedUnits.find((u) => u.id === selectedUnitId)?.name ?? (authorizedUnits[0] ? authorizedUnits[0].name : null);
  const unitMenuOpen = Boolean(unitMenuAnchor);

  const handleUnitMenuClose = () => {
    setUnitMenuAnchor(null);
  };
  const handleUnitSelect = (unitId) => {
    setSelectedUnitId(unitId);
    handleUnitMenuClose();
  };

  // Unit Account Status (SoA data) — non-admin only, re-fetches when selectedUnitId changes
  const unitAccountClientId = selectedClient?.id;
  const unitAccountUnitId = isUnitOwnerOrManager ? selectedUnitId : null;
  const { data: unitAccountData, loading: unitAccountLoading, error: unitAccountError } = useUnitAccountStatus(unitAccountClientId, unitAccountUnitId);

  // Sync owner names to context for ActivityActionBar
  useEffect(() => {
    if (unitAccountData?.ownerNames) {
      setUnitOwnerNames(unitAccountData.ownerNames);
    } else if (!unitAccountLoading && !unitAccountUnitId) {
      setUnitOwnerNames(null);
    }
  }, [unitAccountData?.ownerNames, unitAccountLoading, unitAccountUnitId, setUnitOwnerNames]);

  // Sync selectedUnitId to first authorized unit when none set or selection invalid
  useEffect(() => {
    const access = samsUser?.samsProfile?.propertyAccess?.[selectedClient?.id] ?? samsUser?.propertyAccess?.[selectedClient?.id];
    if (!access || (access.role !== 'unitOwner' && access.role !== 'unitManager')) return;
    const units = [];
    if (access.unitId) units.push({ id: access.unitId, name: `Unit ${access.unitId}` });
    if (access.units && Array.isArray(access.units)) {
      access.units.forEach((u) => {
        const uid = u.id || u.unitId;
        if (uid && !units.find((x) => x.id === uid)) units.push({ id: uid, name: u.name || `Unit ${uid}` });
      });
    }
    if (access.unitAssignments && Array.isArray(access.unitAssignments)) {
      access.unitAssignments.forEach((a) => {
        const id = a.unitId || a.id;
        if (id && !units.find((x) => x.id === id)) units.push({ id, name: a.name || `Unit ${id}` });
      });
    }
    if (units.length === 0) return;
    const validIds = units.map((u) => u.id);
    if (!selectedUnitId || !validIds.includes(selectedUnitId)) {
      setSelectedUnitId(units[0].id);
    }
  }, [samsUser, selectedClient?.id, selectedUnitId, setSelectedUnitId]);

  if (!currentUser) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <LoadingSpinner message="Loading..." />
      </Box>
    );
  }

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
          {isAdmin ? (
            <Chip label={userRole} color="primary" size="small" />
          ) : isUnitOwnerOrManager && currentUnitLabel ? (
            <>
              {/* Unit label: display-only (not a button, avoids 1Password) */}
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 24,
                  px: 1,
                  borderRadius: 1,
                  typography: 'caption',
                  fontWeight: 500,
                  color: unitChipColor === 'success' ? 'success.contrastText' : 'secondary.contrastText',
                  bgcolor: unitChipColor === 'success' ? 'success.main' : 'secondary.main',
                }}
              >
                {currentUnitLabel}
              </Box>
              {/* Separate control to switch unit: only when more than one unit */}
              {hasMultipleUnits && (
                <>
                  <Tooltip title="Switch unit">
                    <IconButton
                      type="button"
                      size="small"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setUnitMenuAnchor(e.currentTarget);
                      }}
                      sx={{
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                      }}
                      aria-label="Switch unit"
                    >
                      <ArrowDropDownIcon />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={unitMenuAnchor}
                    open={unitMenuOpen}
                    onClose={handleUnitMenuClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    PaperProps={{
                      sx: { mt: 1.5, minWidth: 140 },
                    }}
                  >
                    {authorizedUnits.map((u) => (
                      <MenuItem
                        key={u.id}
                        onClick={() => handleUnitSelect(u.id)}
                        selected={u.id === selectedUnitId}
                      >
                        {u.name}
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              )}
            </>
          ) : (
            <Chip label={userRole} color="secondary" size="small" />
          )}
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
        {/* System Error Monitor — SuperAdmin only. Card hidden when no errors; status in StatusBar */}
        {isSuperAdmin && <ErrorMonitorSection />}

        {/* Unit Account Status Card — non-admin only (replaces HOA Dues Status position) */}
        {isUnitOwnerOrManager && selectedUnitId && (
          <Grid item xs={12} sm={6} md={4}>
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
              onClick={() => navigate('/reports')}
            >
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <ReceiptIcon sx={{ color: '#059669', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Unit Account Status</Typography>
                </Box>
                {unitAccountLoading ? (
                  <Box display="flex" flexDirection="column" gap={1} py={2}>
                    <LoadingSpinner size="small" />
                    <Typography variant="body2" color="text.secondary">Loading...</Typography>
                  </Box>
                ) : unitAccountError ? (
                  <Alert severity="warning" sx={{ py: 1 }}>
                    {unitAccountError}
                  </Alert>
                ) : unitAccountData ? (
                  <>
                    <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                      <Chip
                        label={unitAccountData.amountDue <= 0 ? 'Current' : `Balance Due: $${unitAccountData.amountDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        color={unitAccountData.amountDue <= 0 ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {unitAccountData.nextPaymentDueDate && unitAccountData.nextPaymentAmount != null
                        ? `${getMexicoDateTime(unitAccountData.nextPaymentDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — $${unitAccountData.nextPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
                        : unitAccountData.amountDue <= 0
                          ? 'Paid through period'
                          : '—'}
                    </Typography>
                    {unitAccountData.creditBalance > 0 && (
                      <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                        ${unitAccountData.creditBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credit
                      </Typography>
                    )}
                    {unitAccountData.lastPayment && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Last: {unitAccountData.lastPayment.date ? getMexicoDateTime(unitAccountData.lastPayment.date).toLocaleDateString('en-US') : '—'} — ${(unitAccountData.lastPayment.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    )}
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        YTD: {unitAccountData.ytdMonthsPaid}/{unitAccountData.ytdTotal} months
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={unitAccountData.ytdTotal > 0 ? Math.min(100, (unitAccountData.ytdMonthsPaid / unitAccountData.ytdTotal) * 100) : 0}
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </Grid>
        )}

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

        {/* HOA Dues Status Card — admin only (non-admin sees Unit Account Status instead) */}
        {isAdmin && (
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
        )}

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

        {/* Polls Dashboard Card */}
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
                <ProjectIcon sx={{ color: '#2563eb', mr: 1, fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>Polls</Typography>
              </Box>
              {pollLoading ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <LoadingSpinner size="small" />
                </Box>
              ) : pollError ? (
                <Typography variant="body2" color="text.secondary">
                  {pollError}
                </Typography>
              ) : pollCard ? (
                <>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {pollCard.poll?.title || 'Active Poll'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pollCard.mode === 'open' ? 'Active Vote' : 'Recent Result'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {pollCard.summary?.totalUnits
                      ? `${Math.round((pollCard.summary.totalResponses / pollCard.summary.totalUnits) * 100)}% returned`
                      : 'No responses yet'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pollCard.mode === 'open' ? 'Closes' : 'Closed'}: {formatDateDisplay(pollCard.poll?.closesAt || pollCard.poll?.closedAt)}
                  </Typography>
                  {pollCard.summary && (
                    <Typography variant="body2" color="text.secondary">
                      {buildResultSummary(pollCard.summary) || 'Results pending'}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active polls.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Budget Status Card */}
        <Grid item xs={12} sm={6} md={4}>
          <Tooltip
            title={
              budgetStatus?.overBudgetItems?.length > 0 ? (
                <Box sx={{ p: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'white' }}>
                    Over-Budget Watch List
                  </Typography>
                  {budgetStatus.overBudgetItems.map((item, index) => (
                    <Box key={index} sx={{ mb: index < budgetStatus.overBudgetItems.length - 1 ? 0.75 : 0 }}>
                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, color: 'white' }}>
                        <span>{item.category}</span>
                        <strong style={{ color: '#fca5a5' }}>
                          +{item.overPercent}%
                        </strong>
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : budgetStatus ? 'All categories within budget' : 'View Budget vs Actual Report'
            }
            arrow
            placement="top"
            PopperProps={{
              sx: {
                '& .MuiTooltip-tooltip': {
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  maxWidth: 280,
                  padding: 0,
                  color: 'white'
                }
              }
            }}
          >
            <Card 
              onClick={() => navigate('/reports', { state: { activeTab: 'budget-actual' } })}
              sx={{ 
                height: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 25px rgba(8, 99, 191, 0.15)'
                }
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <TrendingUpIcon sx={{ color: budgetStatus?.statusColor || '#f59e0b', mr: 1, fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>Budget Status</Typography>
                </Box>
                {budgetLoading ? (
                  <Box display="flex" justifyContent="center" py={2}>
                    <LoadingSpinner size="small" />
                  </Box>
                ) : budgetError ? (
                  <Box>
                    <Typography variant="h4" sx={{ color: '#6b7280', fontWeight: 700, mb: 1 }}>
                      --
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Unable to load budget data
                    </Typography>
                  </Box>
                ) : budgetStatus ? (
                  <>
                    <Typography variant="h4" sx={{ color: budgetStatus.statusColor, fontWeight: 700, mb: 1 }}>
                      {budgetStatus.statusText}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      FY {budgetStatus.fiscalYear} • {budgetStatus.percentElapsed}% elapsed
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
                          width: `${budgetStatus.percentElapsed}%`,
                          backgroundColor: budgetStatus.statusColor,
                          height: '100%',
                          transition: 'width 0.3s ease'
                        }} />
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <span>YTD Budget:</span>
                        <strong>${Math.round(budgetStatus.expenseYtdBudget)?.toLocaleString() || '0'}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <span>YTD Actual:</span>
                        <strong>${Math.round(budgetStatus.expenseYtdActual)?.toLocaleString() || '0'}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Variance:</span>
                        <strong style={{ color: budgetStatus.expenseVariance >= 0 ? '#059669' : '#dc2626' }}>
                          {budgetStatus.expenseVariance >= 0 ? '+' : '-'}${Math.abs(Math.round(budgetStatus.expenseVariance))?.toLocaleString() || '0'}
                        </strong>
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No budget data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Tooltip>
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
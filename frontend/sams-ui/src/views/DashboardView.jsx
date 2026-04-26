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
import { useDesktopStrings } from '../hooks/useDesktopStrings';
import './DashboardView.css';

const formatDateDisplay = (value) => {
  if (!value) return '—';
  return value.display || value.ISO_8601 || value.iso || '—';
};

function DashboardView() {
  const navigate = useNavigate();
  const { t, language } = useDesktopStrings();
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
        setPollError(err.message || t('dashboard.pollLoadError'));
      } finally {
        setPollLoading(false);
      }
    };

    loadPolls();
  }, [selectedClient?.id, t]);
  
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
  const locale = language === 'ES' ? 'es-MX' : 'en-US';
  const formatMoney = (value) => Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatCompactMoney = (value) => Number(value || 0).toLocaleString(locale);

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
        <LoadingSpinner message={t('dashboard.loading')} />
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
          {t('dashboard.title')}
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
          t('dashboard.welcome.admin') : 
          t('dashboard.welcome.user')
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
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('dashboard.unitAccountStatus')}</Typography>
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
                        label={
                          unitAccountData.amountDue <= 0
                            ? t('dashboard.current')
                            : t('dashboard.balanceDue', { amount: `$${formatMoney(unitAccountData.amountDue)}` })
                        }
                        color={unitAccountData.amountDue <= 0 ? 'success' : 'error'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {unitAccountData.nextPaymentDueDate && unitAccountData.nextPaymentAmount != null
                        ? `${getMexicoDateTime(unitAccountData.nextPaymentDueDate).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })} - $${formatMoney(unitAccountData.nextPaymentAmount)} MXN`
                        : unitAccountData.amountDue <= 0
                          ? t('dashboard.paidThroughPeriod')
                          : '—'}
                    </Typography>
                    {unitAccountData.creditBalance > 0 && (
                      <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                        {t('dashboard.creditAmount', { amount: `$${formatMoney(unitAccountData.creditBalance)}` })}
                      </Typography>
                    )}
                    {unitAccountData.lastPayment && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {t('dashboard.lastPayment', {
                          date: unitAccountData.lastPayment.date ? getMexicoDateTime(unitAccountData.lastPayment.date).toLocaleDateString(locale) : '—',
                          amount: `$${formatMoney(unitAccountData.lastPayment.amount || 0)}`
                        })}
                      </Typography>
                    )}
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        {t('dashboard.ytdMonths', {
                          paid: unitAccountData.ytdMonthsPaid,
                          total: unitAccountData.ytdTotal
                        })}
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
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('dashboard.accountBalances')}</Typography>
              </Box>
              {loading.accounts ? (
                <Box display="flex" justifyContent="center" py={2}>
                  <LoadingSpinner size="small" />
                </Box>
              ) : (
                <>
                  <Typography variant="h4" sx={{ color: '#0863bf', fontWeight: 700, mb: 1 }}>
                    ${formatCompactMoney(accountBalances.total)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    {t('dashboard.accountFormula')}
                  </Typography>
                  <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <span>{t('dashboard.bankAccounts')}:</span>
                      <strong>${formatCompactMoney(accountBalances.bank)}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <span>{t('dashboard.cashAccounts')}:</span>
                      <strong>${formatCompactMoney(accountBalances.cash)}</strong>
                    </Typography>
                    {(accountBalances.unitCreditsPesos || 0) > 0 && (
                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <span style={{ color: 'rgba(0,0,0,0.6)' }}>{t('dashboard.creditBalances')}</span>
                        <strong>
                          ${formatCompactMoney(Math.round(accountBalances.unitCreditsPesos))}
                        </strong>
                      </Typography>
                    )}
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
            title={t('dashboard.receivePaymentHint')}
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
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('dashboard.hoaDuesStatus')}</Typography>
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
                    {t('dashboard.collectionRate')}
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
                      <span>{t('dashboard.currentlyDue')}:</span>
                      <strong>${formatCompactMoney(hoaDuesStatus.currentlyDue)}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <span>{t('dashboard.currentPaid')}:</span>
                      <strong style={{ color: '#059669' }}>${formatCompactMoney(hoaDuesStatus.currentPaid)}</strong>
                    </Typography>
                    <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t('dashboard.prePaid')}:</span>
                      <strong style={{ color: '#7c3aed' }}>${formatCompactMoney(hoaDuesStatus.futurePayments)}</strong>
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
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('dashboard.pastDueUnits')}</Typography>
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
                              {t('dashboard.pastDueDetails')}
                            </Typography>
                            {hoaDuesStatus.pastDueDetails.map((unit, index) => (
                              <Box key={unit.unitId} sx={{ mb: index < hoaDuesStatus.pastDueDetails.length - 1 ? 1 : 0 }}>
                                <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, color: 'white' }}>
                                  <span>
                                    <strong>{unit.unitId}</strong> - {unit.owner}
                                  </span>
                                  <strong>${formatCompactMoney(Math.round(unit.amountDue))}</strong>
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        ) : t('dashboard.noUnitsPastDue')
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
                          ${formatCompactMoney(hoaDuesStatus.pastDueAmount)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {t('dashboard.pastDueAmount')}
                        </Typography>
                        <Box>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('dashboard.unitsPastDue')}:</span>
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
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('dashboard.waterBillsPastDue')}</Typography>
                  </Box>
                  <Tooltip title={t('dashboard.refreshWaterHint')}>
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
                      {t('dashboard.waterUnavailable')}
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Tooltip
                      title={
                        waterBillsStatus.pastDueDetails?.length > 0 ? (
                          <Box sx={{ p: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'white' }}>
                              {t('dashboard.waterBillsPastDueDetails')}
                            </Typography>
                            {waterBillsStatus.pastDueDetails.map((unit, index) => (
                              <Box key={unit.unitId} sx={{ mb: index < waterBillsStatus.pastDueDetails.length - 1 ? 1 : 0 }}>
                                <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, color: 'white' }}>
                                  <span>
                                    <strong>{unit.unitId}</strong> - {unit.owner}
                                  </span>
                                  <strong>${formatCompactMoney(Math.round(unit.amountDue))}</strong>
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        ) : t('dashboard.noWaterPastDue')
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
                          ${formatCompactMoney(waterBillsStatus.totalUnpaid)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {t('dashboard.pastDueAmount')}
                        </Typography>
                        <Box>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <span>{t('dashboard.unitsPastDue')}:</span>
                            <strong>{waterBillsStatus.overdueCount || 0}</strong>
                          </Typography>
                          <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{t('dashboard.collectionRate')}:</span>
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
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('dashboard.exchangeRates')}</Typography>
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
                  title={t('dashboard.openCalculator')}
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
                    {t('dashboard.exchangeLoadError')}
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
                      {t('dashboard.lastUpdated')}: {exchangeRates.lastUpdated || 'Never'}
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box textAlign="center" py={2}>
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.exchangeNoData')}
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
                <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('dashboard.polls')}</Typography>
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
                    {pollCard.poll?.title || t('dashboard.activePoll')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pollCard.mode === 'open' ? t('dashboard.activeVote') : t('dashboard.recentResult')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {pollCard.summary?.totalUnits
                      ? t('dashboard.returnedPct', { percent: Math.round((pollCard.summary.totalResponses / pollCard.summary.totalUnits) * 100) })
                      : t('dashboard.noResponses')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {pollCard.mode === 'open' ? t('dashboard.closes') : t('dashboard.closed')}: {formatDateDisplay(pollCard.poll?.closesAt || pollCard.poll?.closedAt)}
                  </Typography>
                  {pollCard.summary && (
                    <Typography variant="body2" color="text.secondary">
                      {buildResultSummary(pollCard.summary) || t('dashboard.resultsPending')}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('dashboard.noActivePolls')}
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
                    {t('dashboard.overBudgetWatchList')}
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
              ) : budgetStatus ? t('dashboard.allCategoriesWithinBudget') : t('dashboard.viewBudgetReport')
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
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>{t('dashboard.budgetStatus')}</Typography>
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
                      {t('dashboard.budgetLoadError')}
                    </Typography>
                  </Box>
                ) : budgetStatus ? (
                  <>
                    <Typography variant="h4" sx={{ color: budgetStatus.statusColor, fontWeight: 700, mb: 1 }}>
                      {budgetStatus.statusText}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {t('dashboard.fyElapsed', { year: budgetStatus.fiscalYear, percent: budgetStatus.percentElapsed })}
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
                        <span>{t('dashboard.ytdBudget')}:</span>
                        <strong>${formatCompactMoney(Math.round(budgetStatus.expenseYtdBudget))}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <span>{t('dashboard.ytdActual')}:</span>
                        <strong>${formatCompactMoney(Math.round(budgetStatus.expenseYtdActual))}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{t('dashboard.variance')}:</span>
                        <strong style={{ color: budgetStatus.expenseVariance >= 0 ? '#059669' : '#dc2626' }}>
                          {budgetStatus.expenseVariance >= 0 ? '+' : '-'}${formatCompactMoney(Math.abs(Math.round(budgetStatus.expenseVariance)))}
                        </strong>
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('dashboard.noBudgetData')}
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
          {t('dashboard.quickActions')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isAdmin ? t('dashboard.quickActionsAdmin') : t('dashboard.quickActionsUser')}
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
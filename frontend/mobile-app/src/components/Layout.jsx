import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Select,
  MenuItem,
  FormControl,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ArrowBack,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  AccountCircle,
  Dashboard as DashboardIcon,
  Receipt as TransactionsIcon,
  Description as StatementIcon,
  Assessment as StatusIcon,
  Info as AboutIcon,
  PictureAsPdf as PdfIcon,
  TrendingUp as BudgetIcon,
  Home as HomeIcon,
  DownloadForOffline as InstallIcon,
  Contacts as ContactsIcon,
  CurrencyExchange as ExchangeRatesIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useSessionPreferences } from '../context/SessionPreferencesContext.jsx';
import { useSelectedUnit } from '../context/SelectedUnitContext.jsx';
import PWANavigation from './PWANavigation.jsx';
import UserProfileManager from './UserProfileManager.jsx';
import InstallBanner from './InstallBanner.jsx';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import {
  isOwnerOrManager as checkIsOwnerOrManager,
  hasClientAdminForClient,
} from '../utils/authUtils.js';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, samsUser, currentClient } = useAuth();
  const { preferredLanguageUi, setPreferredLanguageUi } = useSessionPreferences();
  const { selectedUnitId, setSelectedUnitId, availableUnits } = useSelectedUnit();

  const isOwnerOrManager = checkIsOwnerOrManager(samsUser);
  const isSuperAdmin = samsUser?.globalRole === 'superAdmin';
  const isAdminOrSuperAdmin = isAdmin || isSuperAdmin;
  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
  const showAdminShell =
    isAdminOrSuperAdmin || Boolean(clientId && hasClientAdminForClient(samsUser, clientId));
  const selectedUnitRole = availableUnits?.find(u => u.unitId === selectedUnitId)?.role;
  const roleLabel = isSuperAdmin
    ? 'SuperAdmin'
    : showAdminShell
      ? 'Admin'
      : selectedUnitRole === 'unitManager'
        ? 'Manager'
        : isOwnerOrManager
          ? 'Owner'
          : null;
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const {
    showInstallUI,
    isMobile,
    isIOS,
    isInstalled,
    canPromptInstall,
    promptInstall,
    dismiss,
    reopenInstallUI
  } = useInstallPrompt();

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/auth':
        return 'Sandyland Mobile';
      case '/clients':
        return 'Select Client';
      case '/confirmation':
        return 'Confirmation';
      case '/expense-entry':
        return 'Add Expense';
      case '/':
      case '/dashboard':
        return 'Dashboard';
      case '/exchange-rates':
        return 'Exchange Rates';
      case '/my-report':
        return 'Current Status';
      case '/statement':
        return 'Statement of Account';
      case '/about':
        return 'About';
      case '/transactions':
        return 'Transactions';
      case '/unit-dashboard':
        return 'My Unit';
      case '/hoa':
        return 'HOA';
      case '/more':
        return 'More';
      case '/tareas':
        return 'Tareas';
      case '/propane-reading':
        return 'Lectura de Gas';
      case '/water-reading':
      case '/tareas/agua':
        return 'Lectura de Agua';
      case '/unit-directory':
        return 'Unit Directory';
      case '/admin/transactions':
        return 'Transactions';
      case '/admin/record-payment':
        return 'Record Payment';
      case '/admin/budget':
        return 'Budget';
      default:
        if (location.pathname.startsWith('/expense/')) {
          return 'Add Expense';
        }
        return 'Dashboard';
    }
  };

  const canGoBack = () => {
    // Back navigation disabled - using bottom navigation for all routing
    return false;
  };

  const handleBack = () => {
    if (location.pathname === '/confirmation') {
      navigate('/clients');
    } else if (location.pathname.startsWith('/expense/')) {
      navigate('/clients');
    } else {
      navigate(-1);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const showLogoutButton = () => {
    return user && location.pathname !== '/auth';
  };

  return (
    <div className="mobile-app">
      <AppBar 
        position="fixed" 
        elevation={1}
        sx={{ 
          paddingTop: 'env(safe-area-inset-top)',
          zIndex: 1200 
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important' }}>
          {user && location.pathname !== '/auth' && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 1 }}
              aria-label="open menu"
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
            <Typography
              variant="h6"
              component="h1"
              sx={{ 
                fontSize: '18px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {getPageTitle()}
            </Typography>
            {roleLabel && (
              <Chip
                label={!showAdminShell && selectedUnitId ? `Unit ${selectedUnitId} - ${roleLabel}` : roleLabel}
                size="small"
                color={showAdminShell ? 'primary' : 'secondary'}
                sx={{
                  backgroundColor: showAdminShell ? undefined : 'rgba(255,255,255,0.2)',
                  color: 'inherit',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  height: 24,
                }}
              />
            )}
          </Box>

          {showLogoutButton() && (
            <IconButton
              color="inherit"
              onClick={() => setProfileOpen(true)}
              aria-label="profile"
            >
              <AccountCircle />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Hamburger menu drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        PaperProps={{ sx: { width: 260, paddingTop: 'env(safe-area-inset-top)' } }}
      >
        <Box sx={{ pt: 2, pb: 1, px: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>SAMS Mobile</Typography>
        </Box>
        <Divider />

        {user && (
          <>
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Language / Idioma
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                fullWidth
                value={preferredLanguageUi}
                onChange={(_, v) => {
                  if (v) setPreferredLanguageUi(v);
                }}
              >
                <ToggleButton value="EN" sx={{ textTransform: 'none' }}>English</ToggleButton>
                <ToggleButton value="ES" sx={{ textTransform: 'none' }}>Español</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Divider />
          </>
        )}

        {/* Unit selector for non-admin-shell users */}
        {!showAdminShell && availableUnits.length > 0 && (
          <>
            <Box sx={{ px: 2, py: 1.5 }}>
              {availableUnits.length === 1 ? (
                <Chip
                  icon={<HomeIcon />}
                  label={`Unit ${availableUnits[0].unitId}`}
                  color="primary"
                  sx={{ fontWeight: 600, fontSize: '0.85rem' }}
                />
              ) : (
                <FormControl size="small" fullWidth>
                  <Select
                    value={selectedUnitId || ''}
                    onChange={(e) => {
                      setSelectedUnitId(e.target.value);
                      setDrawerOpen(false);
                    }}
                    displayEmpty
                    sx={{ fontWeight: 600, fontSize: '0.9rem' }}
                    renderValue={(val) => val ? `Unit ${val}` : 'Select Unit'}
                  >
                    {availableUnits.map((u) => (
                      <MenuItem key={u.unitId} value={u.unitId}>
                        Unit {u.unitId}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
            <Divider />
          </>
        )}

        <List>
          {(showAdminShell
            ? [
                { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
                { label: 'Unit Directory', icon: <ContactsIcon />, path: '/unit-directory' },
                { label: 'Budget', icon: <BudgetIcon />, path: '/admin/budget' },
                { label: 'Exchange Rates', icon: <ExchangeRatesIcon />, path: '/exchange-rates' },
                { label: 'About', icon: <AboutIcon />, path: '/about' },
              ]
            : [
                // Owner/Manager: bottom tabs cover Home, My Unit, HOA, More — hamburger keeps unit selector + Logout only
                // No duplicate nav items; secondary access via More tab
              ]
          ).map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => { navigate(item.path); setDrawerOpen(false); }}
                sx={{ minHeight: 48 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
          {!isInstalled && isMobile && (
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  reopenInstallUI();
                  setDrawerOpen(false);
                }}
                sx={{ minHeight: 48 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <InstallIcon />
                </ListItemIcon>
                <ListItemText primary="Install App" />
              </ListItemButton>
            </ListItem>
          )}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => { setDrawerOpen(false); handleLogout(); }}
              sx={{ minHeight: 48 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon /></ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>

      {/* Offline indicator */}
      <div className={`offline-indicator ${!isOnline ? 'show' : ''}`}>
        <Typography variant="body2">
          You're offline. Some features may not work.
        </Typography>
      </div>

      <main className="mobile-content">
        {children}
      </main>

      <PWANavigation />
      
      {/* User Profile Manager */}
      <UserProfileManager 
        open={profileOpen} 
        onClose={() => setProfileOpen(false)} 
      />

      <InstallBanner
        open={showInstallUI && location.pathname !== '/auth'}
        isIOS={isIOS}
        canPromptInstall={canPromptInstall}
        promptInstall={promptInstall}
        dismiss={dismiss}
      />
    </div>
  );
};

export default Layout;

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
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  Select,
  MenuItem,
  FormControl,
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
  Add as AddIcon,
  PictureAsPdf as PdfIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useSelectedUnit } from '../context/SelectedUnitContext.jsx';
import PWANavigation from './PWANavigation.jsx';
import UserProfileManager from './UserProfileManager.jsx';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { selectedUnitId, setSelectedUnitId, availableUnits } = useSelectedUnit();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      case '/tareas':
        return 'Tareas';
      case '/propane-reading':
        return 'Lectura de Gas';
      case '/water-reading':
      case '/tareas/agua':
        return 'Lectura de Agua';
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
            {!isAdmin && selectedUnitId && (
              <Chip
                label={`Unit ${selectedUnitId}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
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

        {/* Unit selector for non-admin users */}
        {!isAdmin && availableUnits.length > 0 && (
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
                    onChange={(e) => setSelectedUnitId(e.target.value)}
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
          {(isAdmin
            ? [
                { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
                { label: 'Add Expense', icon: <AddIcon />, path: '/expense-entry' },
                { label: 'About', icon: <AboutIcon />, path: '/about' },
              ]
            : [
                { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
                { label: 'Current Status', icon: <StatusIcon />, path: '/my-report' },
                { label: 'Transactions', icon: <TransactionsIcon />, path: '/transactions' },
                { label: 'Statement of Account', icon: <PdfIcon />, path: '/statement' },
                { label: 'About', icon: <AboutIcon />, path: '/about' },
              ]
          ).map((item) => (
            <ListItem
              button
              key={item.path}
              selected={location.pathname === item.path}
              onClick={() => { navigate(item.path); setDrawerOpen(false); }}
              sx={{ minHeight: 48 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem
            button
            onClick={() => { setDrawerOpen(false); handleLogout(); }}
            sx={{ minHeight: 48 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Logout" />
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
    </div>
  );
};

export default Layout;

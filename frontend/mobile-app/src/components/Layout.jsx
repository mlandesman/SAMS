import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
} from '@mui/material';
import {
  ArrowBack,
  Logout,
  Menu as MenuIcon,
  AccountCircle,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import PWANavigation from './PWANavigation.jsx';
import UserProfileManager from './UserProfileManager.jsx';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [profileOpen, setProfileOpen] = useState(false);

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
        return 'Unit Report';
      case '/about':
        return 'About';
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
          {canGoBack() && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={handleBack}
              sx={{ mr: 1 }}
              aria-label="go back"
            >
              <ArrowBack />
            </IconButton>
          )}
          
          <Typography
            variant="h6"
            component="h1"
            sx={{ 
              flexGrow: 1, 
              fontSize: '18px',
              fontWeight: 500,
            }}
          >
            {getPageTitle()}
          </Typography>

          {showLogoutButton() && (
            <>
              <IconButton
                color="inherit"
                onClick={() => setProfileOpen(true)}
                aria-label="profile"
                sx={{ mr: 1 }}
              >
                <AccountCircle />
              </IconButton>
              
              <IconButton
                color="inherit"
                onClick={handleLogout}
                aria-label="logout"
              >
                <Logout />
              </IconButton>
            </>
          )}
        </Toolbar>
      </AppBar>

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

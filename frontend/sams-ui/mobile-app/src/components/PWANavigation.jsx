import React from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Paper
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CurrencyExchange as CurrencyIcon,
  Add as AddIcon,
  Business as BusinessIcon,
  Assessment as ReportIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';

const PWANavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { samsUser } = useAuth();
  
  const isAdmin = samsUser?.globalRole === 'admin' || samsUser?.globalRole === 'superAdmin';
  const isUnitOwner = samsUser?.globalRole === 'unitOwner' || 
    (samsUser?.clientAccess && 
     Object.values(samsUser.clientAccess).some(access => 
       access.role === 'unitOwner' || access.role === 'unitManager'
     ));
  
  // Debug logging
  console.log('PWANavigation Debug:', {
    samsUser: samsUser,
    globalRole: samsUser?.globalRole,
    clientAccess: samsUser?.clientAccess,
    isAdmin,
    isUnitOwner,
    location: location.pathname
  });

  // Don't show navigation on auth screen
  if (location.pathname === '/auth' || location.pathname === '/test') {
    return null;
  }

  const getValue = () => {
    const path = location.pathname;
    const navItems = getNavItems();
    const index = navItems.findIndex(item => item.path === path);
    return index >= 0 ? index : 0;
  };

  const adminNavItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { label: 'Add Expense', icon: <AddIcon />, path: '/expense-entry' },
    { label: 'Clients', icon: <BusinessIcon />, path: '/clients' },
  ];

  const unitOwnerNavItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { label: 'Unit Report', icon: <ReportIcon />, path: '/my-report' },
  ];

  // For users with both admin and unit owner roles, show extended nav
  const mixedNavItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { label: 'Add Expense', icon: <AddIcon />, path: '/expense-entry' },
    { label: 'Unit Report', icon: <ReportIcon />, path: '/my-report' },
    { label: 'Clients', icon: <BusinessIcon />, path: '/clients' },
  ];

  const getNavItems = () => {
    if (isAdmin && isUnitOwner) return mixedNavItems;
    if (isAdmin) return adminNavItems;
    if (isUnitOwner) return unitOwnerNavItems;
    return unitOwnerNavItems; // Default fallback for unit owners
  };

  const navItems = getNavItems();

  const handleNavigation = (event, newValue) => {
    if (newValue < navItems.length) {
      navigate(navItems[newValue].path);
    }
  };

  return (
    <Box sx={{ pb: 7 }}>
      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          zIndex: 1000,
          borderTop: '1px solid #e0e0e0',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }} 
        elevation={3}
      >
        <BottomNavigation
          value={getValue()}
          onChange={handleNavigation}
          showLabels
          sx={{
            '& .MuiBottomNavigationAction-root': {
              fontSize: '0.75rem',
              '&.Mui-selected': {
                color: '#1976d2',
              },
            },
          }}
        >
          {navItems.map((item, index) => (
            <BottomNavigationAction
              key={index}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default PWANavigation;

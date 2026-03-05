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
import { useAuth } from '../context/AuthContext';

const PWANavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  
  // Adapt to main UI auth context structure
  const samsUser = currentUser;
  
  const isAdmin = samsUser?.globalRole === 'admin' || samsUser?.globalRole === 'superAdmin';
  const isUnitOwner = samsUser?.globalRole === 'unitOwner' || 
    (samsUser?.propertyAccess && 
     Object.values(samsUser.propertyAccess).some(access => 
       access.role === 'unitOwner' || access.role === 'unitManager'
     ));
  
  // Debug logging
  console.log('PWANavigation Debug:', {
    samsUser: samsUser,
    globalRole: samsUser?.globalRole,
    propertyAccess: samsUser?.propertyAccess,
    isAdmin,
    isUnitOwner,
    location: location.pathname
  });

  // Don't show navigation on auth screen
  if (location.pathname === '/auth' || location.pathname === '/test') {
    return null;
  }

  const adminNavItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { label: 'Add Expense', icon: <AddIcon />, path: '/add-expense' },
    { label: 'Unit Report', icon: <ReportIcon />, path: '/unit-report' },
    { label: 'HOA Dues', icon: <AddIcon />, path: '/hoa-dues' },
  ];

  const unitOwnerNavItems = [
    { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { label: 'Unit Report', icon: <ReportIcon />, path: '/unit-report' },
  ];

  // For users with both admin and unit owner roles, show extended nav
  const mixedNavItems = adminNavItems;

  const getNavItems = () => {
    if (isAdmin && isUnitOwner) return mixedNavItems;
    if (isAdmin) return adminNavItems;
    if (isUnitOwner) return unitOwnerNavItems;
    return unitOwnerNavItems; // Default fallback for unit owners
  };

  const getValue = () => {
    const path = location.pathname;
    const navItems = getNavItems();
    
    // Find the index of the current path in the navigation items
    const index = navItems.findIndex(item => item.path === path);
    return index >= 0 ? index : 0;
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
          borderTop: '1px solid #e0e0e0'
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

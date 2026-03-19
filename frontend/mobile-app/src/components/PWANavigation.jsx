import React from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Paper
} from '@mui/material';
import {
  Home as HomeIcon,
  Apartment as UnitIcon,
  Groups as HOAIcon,
  MoreHoriz as MoreIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Assignment as TaskIcon,
  Receipt as ReceiptIcon,
  Payments as PaymentIcon,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';

import { isOwnerOrManager as checkIsOwnerOrManager } from '../utils/authUtils.js';

const PWANavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { samsUser } = useAuth();
  
  const isAdmin = samsUser?.globalRole === 'admin' || samsUser?.globalRole === 'superAdmin';
  const isMaintenance = samsUser?.globalRole === 'maintenance';
  const isOwnerOrManager = checkIsOwnerOrManager(samsUser);

  // Don't show navigation on auth screen
  if (location.pathname === '/auth' || location.pathname === '/test') {
    return null;
  }

  // Maintenance: bottom nav with Tareas only
  if (isMaintenance) {
    const maintenanceNavItems = [
      { label: 'Tareas', icon: <TaskIcon />, path: '/tareas' },
    ];
    const getValue = () => {
      const index = maintenanceNavItems.findIndex(item => item.path === location.pathname);
      return index >= 0 ? index : 0;
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
            onChange={(e, v) => v < maintenanceNavItems.length && navigate(maintenanceNavItems[v].path)}
            showLabels
            sx={{ '& .MuiBottomNavigationAction-root.Mui-selected': { color: 'primary.main' } }}
          >
            {maintenanceNavItems.map((item, i) => (
              <BottomNavigationAction key={i} label={item.label} icon={item.icon} />
            ))}
          </BottomNavigation>
        </Paper>
      </Box>
    );
  }

  // Owner/Manager: 4-tab layout (Home, My Unit, HOA, More)
  if (isOwnerOrManager && !isAdmin) {
    const ownerNavItems = [
      { label: 'Home', icon: <HomeIcon />, path: '/' },
      { label: 'My Unit', icon: <UnitIcon />, path: '/unit-dashboard' },
      { label: 'HOA', icon: <HOAIcon />, path: '/hoa' },
      { label: 'More', icon: <MoreIcon />, path: '/more' },
    ];
    const getValue = () => {
      const index = ownerNavItems.findIndex(item => item.path === location.pathname);
      return index >= 0 ? index : 0;
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
            onChange={(e, v) => v < ownerNavItems.length && navigate(ownerNavItems[v].path)}
            showLabels
            sx={{ '& .MuiBottomNavigationAction-root.Mui-selected': { color: 'primary.main' } }}
          >
            {ownerNavItems.map((item, i) => (
              <BottomNavigationAction key={i} label={item.label} icon={item.icon} />
            ))}
          </BottomNavigation>
        </Paper>
      </Box>
    );
  }

  // Users who are not admin, maintenance, or owner/manager: no bottom nav
  if (!isAdmin && !isMaintenance && !isOwnerOrManager) {
    return null;
  }

  // Admin: 4-tab layout (Home, Transactions, Record Payment, Add Expense)
  const adminNavItems = [
    { label: 'Home', icon: <DashboardIcon />, path: '/' },
    { label: 'Transactions', icon: <ReceiptIcon />, path: '/admin/transactions' },
    { label: 'Payment', icon: <PaymentIcon />, path: '/admin/record-payment' },
    { label: 'Expense', icon: <AddIcon />, path: '/expense-entry' },
  ];

  const navItems = adminNavItems;

  const getValue = () => {
    const index = navItems.findIndex(item => item.path === location.pathname);
    return index >= 0 ? index : 0;
  };

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
                color: 'primary.main',
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

/**
 * More Menu — Secondary screens for mobile owners
 * Links: Statement of Account, Exchange Rate Calculator, About, Install App
 * Sprint MOBILE-OWNER-UX (MOB-5)
 */
import React from 'react';
import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import {
  PictureAsPdf as StatementIcon,
  CurrencyExchange as ExchangeIcon,
  Info as AboutIcon,
  DownloadForOffline as InstallIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useInstallPrompt } from '../../hooks/useInstallPrompt.js';

const MoreMenu = () => {
  const navigate = useNavigate();
  const { isInstalled, isMobile, reopenInstallUI } = useInstallPrompt();

  const items = [
    { label: 'Statement of Account', icon: <StatementIcon />, path: '/statement' },
    { label: 'Exchange Rate Calculator', icon: <ExchangeIcon />, path: '/exchange-rates' },
    { label: 'About', icon: <AboutIcon />, path: '/about' },
  ];

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>More</Typography>
      <List disablePadding>
        {items.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => navigate(item.path)}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
        {!isInstalled && isMobile && (
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => reopenInstallUI()}
              sx={{ borderRadius: 1, minHeight: 48 }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}><InstallIcon /></ListItemIcon>
              <ListItemText primary="Install App" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );
};

export default MoreMenu;

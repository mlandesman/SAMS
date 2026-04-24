/**
 * More Menu — Secondary screens for mobile owners
 * Statement of Account lives on My Unit + /statement (issue #251); not duplicated here.
 * Links: Exchange Rate Calculator, About, Install App
 */
import React from 'react';
import { Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import {
  CurrencyExchange as ExchangeIcon,
  Info as AboutIcon,
  DownloadForOffline as InstallIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useInstallPrompt } from '../../hooks/useInstallPrompt.js';
import { useMobileStrings } from '../../hooks/useMobileStrings.js';

const MoreMenu = () => {
  const navigate = useNavigate();
  const { isInstalled, isMobile, reopenInstallUI } = useInstallPrompt();
  const t = useMobileStrings();

  const items = [
    { label: t('more.exchangeRateCalculator'), icon: <ExchangeIcon />, path: '/exchange-rates' },
    { label: t('more.about'), icon: <AboutIcon />, path: '/about' },
  ];

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>{t('more.title')}</Typography>
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
              <ListItemText primary={t('layout.installApp')} />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );
};

export default MoreMenu;

/**
 * PWA Dashboard - Refactored with compact cards
 * GitHub #47 - 2-column grid layout with tap-to-expand
 * Sprint MOBILE-ADMIN-UX: Admin uses AdminDashboard (ADM-1, ADM-2)
 */
import React from 'react';
import { Box, Alert, Button } from '@mui/material';
import { LoadingSpinner } from './common';
import { ArrowForward as ArrowIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useClients } from '../hooks/useClients.jsx';
import { useMobileStrings } from '../hooks/useMobileStrings.js';
import ClientSwitcher from './ClientSwitcher.jsx';
import {
  isOwnerOrManager as checkIsOwnerOrManager,
  hasClientAdminForClient,
} from '../utils/authUtils.js';
import OwnerDashboard3Cards from './owner/OwnerDashboard3Cards.jsx';
import AdminDashboard from './admin/AdminDashboard.jsx';

const Dashboard = () => {
  const navigate = useNavigate();
  const { samsUser, currentClient, isAuthenticated } = useAuth();
  const { selectClient } = useClients();
  const t = useMobileStrings();

  if (!isAuthenticated) {
    return <LoadingSpinner message={t('dashboard.authenticating')} size="medium" />;
  }

  // Block maintenance users from accessing Dashboard
  const isMaintenance = samsUser?.globalRole === 'maintenance';
  if (isMaintenance) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('dashboard.maintenanceBlocked')}
        </Alert>
        <Button 
          variant="contained" 
          onClick={() => navigate('/tareas')}
          sx={{ textTransform: 'none' }}
        >
          {t('dashboard.goToTasks')}
        </Button>
      </Box>
    );
  }

  const isAdmin = samsUser?.globalRole === 'admin';
  const isSuperAdmin = samsUser?.globalRole === 'superAdmin';
  const isAdminOrSuperAdmin = isAdmin || isSuperAdmin;
  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
  const isClientScopedAdmin = Boolean(clientId && hasClientAdminForClient(samsUser, clientId));
  const showAdminDashboard = isAdminOrSuperAdmin || isClientScopedAdmin;
  const isOwnerOrManager = checkIsOwnerOrManager(samsUser);

  return (
    <Box className="mobile-dashboard" sx={{ minHeight: '100vh' }}>
      <Box className="mobile-dashboard-content" sx={{ p: 2, pb: 10 }}>
        {/* Header — title and role chip moved to Layout top bar */}
        <Box mb={2} textAlign="center">
          {currentClient && (
            <ClientSwitcher 
              currentClient={currentClient}
              onClientChange={async (newClientId) => {
                try {
                  await selectClient(newClientId);
                } catch (error) {
                  console.error('❌ Failed to change client:', error);
                }
              }}
            />
          )}
        </Box>

        {/* Owner/Manager: 3-card focused dashboard */}
        {isOwnerOrManager && !showAdminDashboard && (
          <OwnerDashboard3Cards />
        )}

        {/* Admin: 3-card dashboard + sub-dashboard (ADM-1, ADM-2) */}
        {showAdminDashboard && <AdminDashboard />}

        {/* Quick Actions for Non-Admins (legacy 8-card flow — hidden when 3-card shown) */}
        {!showAdminDashboard && !isOwnerOrManager && (
          <Box sx={{ maxWidth: 400, mx: 'auto', mt: 2 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<ArrowIcon />}
              onClick={() => navigate('/statement')}
              sx={{
                background: 'linear-gradient(135deg, #0863bf 0%, #3b82f6 100%)',
                borderRadius: '12px',
                py: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(8, 99, 191, 0.3)',
              }}
            >
              {t('dashboard.viewFullStatement')}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;

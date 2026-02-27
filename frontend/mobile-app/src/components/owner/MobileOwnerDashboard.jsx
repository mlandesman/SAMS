import React from 'react';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useSelectedUnit } from '../../context/SelectedUnitContext.jsx';
import { useUnitAccountStatus } from '../../hooks/useUnitAccountStatus';
import UnitSwitcher from './UnitSwitcher';
import AccountStatusCard from './AccountStatusCard';
import CreditBanner from './CreditBanner';
import LastPaymentCard from './LastPaymentCard';
import RecentTransactionsPreview from './RecentTransactionsPreview';

const MobileOwnerDashboard = () => {
  const { currentClient } = useAuth();
  const { selectedUnitId, availableUnits } = useSelectedUnit();
  const { data, loading, error } = useUnitAccountStatus(currentClient, selectedUnitId);

  if (!selectedUnitId && availableUnits.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', mt: 4 }}>
        <Typography variant="body1" color="text.secondary">
          No units assigned to your account. Please contact your administrator.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Loading your dashboard...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, mt: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button
          variant="outlined"
          fullWidth
          onClick={() => window.location.reload()}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <UnitSwitcher />

      {data?.ownerNames && (
        <Typography variant="body2" sx={{ color: '#6c757d', mb: 2, textAlign: 'center' }}>
          {data.ownerNames}
        </Typography>
      )}

      <AccountStatusCard data={data} unitId={selectedUnitId} />
      <CreditBanner creditBalance={data?.creditBalance} />
      <LastPaymentCard lastPayment={data?.lastPayment} />
      <RecentTransactionsPreview lineItems={data?.lineItems} />
    </Box>
  );
};

export default MobileOwnerDashboard;

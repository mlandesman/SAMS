/**
 * My Unit Report - Uses SelectedUnitContext for unit detection
 * Wrapper component for UnitReport that handles unit owner authentication
 */

import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useSelectedUnit } from '../context/SelectedUnitContext.jsx';
import UnitReport from './UnitReport.jsx';

const MyUnitReport = () => {
  const { selectedUnitId, availableUnits } = useSelectedUnit();

  if (!selectedUnitId && availableUnits.length === 0) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        p: 5,
        textAlign: 'center',
      }}>
        <Typography variant="body1" color="text.secondary">
          No unit assigned to your account. Please contact your administrator.
        </Typography>
      </Box>
    );
  }

  if (!selectedUnitId) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}>
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">
          Loading your unit information...
        </Typography>
      </Box>
    );
  }

  return <UnitReport unitId={selectedUnitId} />;
};

export default MyUnitReport;

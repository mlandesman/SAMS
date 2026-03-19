/**
 * DetailRow — label/value row for transaction and other detail views
 * Shared by AdminTransactions, TransactionsList, UnitReport
 */
import React from 'react';
import { Box, Typography } from '@mui/material';

const DetailRow = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.75, gap: 2 }}>
    <Typography variant="caption" sx={{ color: '#6c757d', fontWeight: 600, flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography variant="caption" sx={{ fontWeight: 500, color: '#333', textAlign: 'right', wordBreak: 'break-word' }}>
      {value}
    </Typography>
  </Box>
);

export default DetailRow;

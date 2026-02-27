import React from 'react';
import { Alert } from '@mui/material';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0);

const CreditBanner = ({ creditBalance }) => {
  if (!creditBalance || creditBalance <= 0) return null;

  return (
    <Alert
      severity="success"
      sx={{ mb: 2, fontWeight: 500 }}
    >
      You have a credit of {formatCurrency(creditBalance)}
    </Alert>
  );
};

export default CreditBanner;

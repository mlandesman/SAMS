import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0);

const AccountStatusCard = ({ data, unitId }) => {
  const amountDue = data?.amountDue ?? 0;
  const creditBalance = data?.creditBalance ?? 0;

  let status, statusColor, bgColor, borderColor, displayAmount;

  if (amountDue > 0) {
    status = 'Balance Due';
    statusColor = '#d32f2f';
    bgColor = '#fff5f5';
    borderColor = '#ffcdd2';
    displayAmount = formatCurrency(amountDue);
  } else if (creditBalance > 0) {
    status = 'Credit';
    statusColor = '#1565c0';
    bgColor = '#e3f2fd';
    borderColor = '#bbdefb';
    displayAmount = formatCurrency(creditBalance);
  } else {
    status = 'Current';
    statusColor = '#2e7d32';
    bgColor = '#e8f5e9';
    borderColor = '#c8e6c9';
    displayAmount = null;
  }

  return (
    <Card
      sx={{
        mb: 2,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${statusColor}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 0.5 }}>
              Unit {unitId}
            </Typography>
            <Typography variant="h6" sx={{ color: statusColor, fontWeight: 700 }}>
              {status}
            </Typography>
          </Box>
          {displayAmount && (
            <Typography variant="h5" sx={{ color: statusColor, fontWeight: 700 }}>
              {displayAmount}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" sx={{ color: '#999', mt: 1, display: 'block' }}>
          As of {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default AccountStatusCard;

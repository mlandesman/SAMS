import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const LastPaymentCard = ({ lastPayment }) => {
  if (!lastPayment) {
    return (
      <Card sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 0.5 }}>
            Last Payment
          </Typography>
          <Typography variant="body2" sx={{ color: '#999' }}>
            No recent payments
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 0.5 }}>
          Last Payment
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {formatDate(lastPayment.date)}
          </Typography>
          <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 700 }}>
            {formatCurrency(lastPayment.amount)}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LastPaymentCard;

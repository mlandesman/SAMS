import React from 'react';
import { Box, Typography, Card, CardContent, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

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
  });
};

const RecentTransactionsPreview = ({ lineItems }) => {
  const navigate = useNavigate();

  if (!lineItems || lineItems.length === 0) {
    return (
      <Card sx={{ mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1 }}>
            Recent Transactions
          </Typography>
          <Typography variant="body2" sx={{ color: '#999' }}>
            No transactions found.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const pastItems = lineItems.filter(item => !item.isFuture);
  const recent = pastItems.slice(-5).reverse();

  return (
    <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
        <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 1.5 }}>
          Recent Transactions
        </Typography>

        {recent.map((item, idx) => {
          const isCharge = item.charge && item.charge > 0;
          const isPayment = item.payment && item.payment > 0;
          const amount = isPayment ? item.payment : (isCharge ? item.charge : 0);
          const amountColor = isPayment ? '#2e7d32' : (isCharge ? '#d32f2f' : '#333');

          return (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                py: 1,
                borderBottom: idx < recent.length - 1 ? '1px solid #f0f0f0' : 'none',
                minHeight: 48,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.85rem' }} noWrap>
                  {item.description || '—'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#999' }}>
                  {formatDate(item.date)}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography variant="body2" sx={{ color: amountColor, fontWeight: 600, fontSize: '0.85rem' }}>
                  {formatCurrency(amount)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#999' }}>
                  Bal: {formatCurrency(item.balance)}
                </Typography>
              </Box>
            </Box>
          );
        })}

        {pastItems.length > 5 && (
          <Button
            size="small"
            fullWidth
            onClick={() => navigate('/transactions')}
            sx={{ mt: 1, textTransform: 'none', fontWeight: 500 }}
          >
            View All Transactions
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentTransactionsPreview;

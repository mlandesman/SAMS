import React, { useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useSelectedUnit } from '../../context/SelectedUnitContext.jsx';
import { useUnitAccountStatus } from '../../hooks/useUnitAccountStatus';

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

const TransactionsList = () => {
  const { currentClient } = useAuth();
  const { selectedUnitId } = useSelectedUnit();
  const { data, loading, error } = useUnitAccountStatus(currentClient, selectedUnitId);
  const [selectedTx, setSelectedTx] = useState(null);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">Loading transactions...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, mt: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="outlined" fullWidth onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </Box>
    );
  }

  const lineItems = data?.lineItems || [];
  const pastItems = lineItems.filter(item => !item.isFuture);
  const transactions = pastItems.slice().reverse().slice(0, 10);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 2 }}>
        Unit {selectedUnitId} — Last {transactions.length} transactions
      </Typography>

      {transactions.length === 0 ? (
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              No transactions found.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {transactions.map((item, idx) => {
              const isCharge = item.charge && item.charge > 0;
              const isPayment = item.payment && item.payment > 0;
              const amount = isPayment ? item.payment : (isCharge ? item.charge : 0);
              const amountColor = isPayment ? '#2e7d32' : (isCharge ? '#d32f2f' : '#333');

              return (
                <Box
                  key={idx}
                  onClick={() => setSelectedTx(item)}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    px: 2,
                    py: 1.5,
                    minHeight: 56,
                    borderBottom: idx < transactions.length - 1 ? '1px solid #f0f0f0' : 'none',
                    cursor: 'pointer',
                    '&:active': { backgroundColor: '#f5f5f5' },
                    WebkitTapHighlightColor: 'rgba(25, 118, 210, 0.08)',
                    touchAction: 'manipulation',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0, mr: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }} noWrap>
                      {item.description || '—'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999' }}>
                      {formatDate(item.date)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography variant="body2" sx={{ color: amountColor, fontWeight: 600 }}>
                      {formatCurrency(amount)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999' }}>
                      Bal: {formatCurrency(item.balance)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Transaction detail dialog */}
      <Dialog
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        fullWidth
        maxWidth="xs"
      >
        {selectedTx && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
              Transaction Details
              <IconButton size="small" onClick={() => setSelectedTx(null)} aria-label="close">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <DetailRow label="Date" value={formatDate(selectedTx.date)} />
              <DetailRow label="Description" value={selectedTx.description || '—'} />
              {selectedTx.charge > 0 && (
                <DetailRow label="Charge" value={formatCurrency(selectedTx.charge)} valueColor="#d32f2f" />
              )}
              {selectedTx.payment > 0 && (
                <DetailRow label="Payment" value={formatCurrency(selectedTx.payment)} valueColor="#2e7d32" />
              )}
              <DetailRow label="Running Balance" value={formatCurrency(selectedTx.balance)} />
              {selectedTx.type && (
                <DetailRow label="Type" value={selectedTx.type} />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedTx(null)} fullWidth variant="contained">
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

const DetailRow = ({ label, value, valueColor }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 2 }}>
    <Typography variant="body2" sx={{ color: '#6c757d', fontWeight: 600, flexShrink: 0 }}>
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{ fontWeight: 500, color: valueColor || '#333', textAlign: 'right', wordBreak: 'break-word' }}
    >
      {value}
    </Typography>
  </Box>
);

export default TransactionsList;

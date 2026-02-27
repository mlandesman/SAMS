import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  Collapse,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { config } from '../../config/index.js';
import { auth } from '../../services/firebase';

const API_BASE_URL = config.api.baseUrl;

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0);

const centavosToPesos = (centavos) => (centavos || 0) / 100;

const formatDate = (dateValue) => {
  if (!dateValue) return '—';
  if (typeof dateValue === 'object' && dateValue !== null) {
    return dateValue.unambiguous_long_date || dateValue.display || dateValue.ISO_8601 || '—';
  }
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const TransactionsList = () => {
  const { currentClient, firebaseUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (clientId) fetchTransactions();
  }, [clientId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser || firebaseUser;
      if (!user) throw new Error('No authenticated user');

      const token = await user.getIdToken();
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;
      const url = `${API_BASE_URL}/clients/${clientId}/transactions?startDate=${startDate}&endDate=${endDate}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const txList = Array.isArray(data) ? data : (data.transactions || []);
      setTransactions(txList);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

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
        <Button variant="outlined" fullWidth onClick={fetchTransactions}>Try Again</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 2 }}>
        {currentYear} Fiscal Year — {transactions.length} transactions
      </Typography>

      {transactions.length === 0 ? (
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              No transactions found for {currentYear}.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {transactions.map((tx, idx) => {
              const amount = centavosToPesos(tx.amount);
              const isExpanded = expandedId === tx.id;
              const isExpense = tx.type === 'expense';

              return (
                <Box key={tx.id || idx}>
                  <Box
                    onClick={() => toggleExpanded(tx.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      px: 2,
                      py: 1.5,
                      minHeight: 56,
                      borderBottom: (idx < transactions.length - 1 || isExpanded) ? '1px solid #f0f0f0' : 'none',
                      cursor: 'pointer',
                      '&:active': { backgroundColor: '#f5f5f5' },
                      WebkitTapHighlightColor: 'rgba(25, 118, 210, 0.08)',
                      touchAction: 'manipulation',
                    }}
                  >
                    <Box sx={{ flex: '0 0 90px', mr: 1 }}>
                      <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                        {formatDate(tx.date)}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }} noWrap>
                        {tx.vendorName || tx.description || tx.notes || '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: isExpense ? '#d32f2f' : '#2e7d32',
                        }}
                      >
                        {isExpense ? '-' : ''}{formatCurrency(amount)}
                      </Typography>
                      {isExpanded ? <ExpandLessIcon sx={{ fontSize: 18, color: '#999' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: '#999' }} />}
                    </Box>
                  </Box>

                  <Collapse in={isExpanded}>
                    <Box sx={{ px: 2, py: 1.5, backgroundColor: '#fafafa', borderBottom: idx < transactions.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                      {tx.categoryName && (
                        <DetailRow label="Category" value={tx.categoryName} />
                      )}
                      {tx.accountName && (
                        <DetailRow label="Account" value={tx.accountName} />
                      )}
                      {tx.paymentMethod && (
                        <DetailRow label="Payment Method" value={tx.paymentMethod} />
                      )}
                      {tx.unitId && (
                        <DetailRow label="Unit" value={tx.unitId} />
                      )}
                      {tx.notes && (
                        <DetailRow label="Notes" value={tx.notes} />
                      )}
                      {tx.type && (
                        <Chip
                          label={tx.type}
                          size="small"
                          sx={{ mt: 0.5, textTransform: 'capitalize', fontSize: '0.7rem' }}
                          color={tx.type === 'income' ? 'success' : 'default'}
                        />
                      )}
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

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

export default TransactionsList;

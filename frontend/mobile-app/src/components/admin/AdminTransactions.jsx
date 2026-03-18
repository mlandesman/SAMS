/**
 * Admin Transactions View — All units, year/type filters, expandable rows
 * Sprint MOBILE-ADMIN-UX (ADM-3)
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  Card,
  CardContent,
  Collapse,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { config } from '../../config/index.js';
import { auth } from '../../services/firebase';
import { getMexicoDate } from '../../utils/timezone.js';
import { formatPesosForDisplay, centavosToPesos } from '@shared/utils/currencyUtils.js';
import { formatTransactionDate } from '../../utils/transactionDisplay.js';
import { LoadingSpinner, DetailRow } from '../common';

const API_BASE_URL = config.api.baseUrl;
const PAGE_SIZE = 50;

const AdminTransactions = () => {
  const { currentClient } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRowKey, setExpandedRowKey] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedYear, setSelectedYear] = useState(getMexicoDate().getFullYear());
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'income' | 'expense'

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
  const currentYear = getMexicoDate().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  useEffect(() => {
    if (clientId) fetchTransactions();
  }, [clientId, selectedYear]);

  useEffect(() => {
    setExpandedRowKey(null);
    setVisibleCount(PAGE_SIZE);
  }, [selectedYear, typeFilter, transactions]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser;
      if (!user) throw new Error('No authenticated user');

      const token = await user.getIdToken();
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const url = `${API_BASE_URL}/clients/${clientId}/transactions?startDate=${startDate}&endDate=${endDate}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const txList = Array.isArray(data) ? data : data.transactions || [];
      setTransactions(txList);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const getRowKey = (tx, idx) => tx.id ?? `idx-${idx}`;

  const toggleExpanded = (rowKey) => {
    setExpandedRowKey((prev) => (prev === rowKey ? null : rowKey));
  };

  const handleTypeFilter = (_, value) => {
    if (value != null) setTypeFilter(value);
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter === 'all') return true;
    return tx.type === typeFilter;
  });

  const displayedTransactions = filteredTransactions.slice(0, visibleCount);
  const hasMore = filteredTransactions.length > visibleCount;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <LoadingSpinner size="medium" message="Loading transactions..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, mt: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="outlined" fullWidth onClick={fetchTransactions}>
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      {/* Year filter chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {yearOptions.map((y) => (
          <Chip
            key={y}
            label={y}
            onClick={() => setSelectedYear(y)}
            color={selectedYear === y ? 'primary' : 'default'}
            variant={selectedYear === y ? 'filled' : 'outlined'}
            sx={{ fontWeight: selectedYear === y ? 600 : 400 }}
          />
        ))}
      </Box>

      {/* Type filter toggle */}
      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={typeFilter}
          exclusive
          onChange={handleTypeFilter}
          size="small"
          fullWidth
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', py: 1 } }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="income">Income</ToggleButton>
          <ToggleButton value="expense">Expense</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 2 }}>
        {selectedYear} — {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
      </Typography>

      {filteredTransactions.length === 0 ? (
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              No transactions found for {selectedYear}
              {typeFilter !== 'all' ? ` (${typeFilter} only)` : ''}.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {displayedTransactions.map((tx, idx) => {
              const amount = centavosToPesos(tx.amount);
              const rowKey = getRowKey(tx, idx);
              const isExpanded = expandedRowKey === rowKey;
              const isExpense = tx.type === 'expense';

              return (
                <Box key={rowKey}>
                  <Box
                    onClick={() => toggleExpanded(rowKey)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      px: 2,
                      py: 1.5,
                      minHeight: 56,
                      borderBottom:
                        idx < displayedTransactions.length - 1 || isExpanded
                          ? '1px solid #f0f0f0'
                          : 'none',
                      cursor: 'pointer',
                      '&:active': { backgroundColor: '#f5f5f5' },
                      WebkitTapHighlightColor: 'rgba(25, 118, 210, 0.08)',
                      touchAction: 'manipulation',
                    }}
                  >
                    <Box sx={{ flex: '0 0 72px', mr: 1 }}>
                      <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                        {formatTransactionDate(tx.date)}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }} noWrap>
                        {tx.vendorName || tx.description || tx.notes || '—'}
                      </Typography>
                      {tx.unitId && (
                        <Typography variant="caption" sx={{ color: '#6c757d', fontSize: '0.7rem' }}>
                          Unit {tx.unitId}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: isExpense ? '#d32f2f' : '#2e7d32',
                        }}
                      >
                        {isExpense ? '-' : '+'}{formatPesosForDisplay(amount)}
                      </Typography>
                      {isExpanded ? (
                        <ExpandLessIcon sx={{ fontSize: 18, color: '#999' }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: 18, color: '#999' }} />
                      )}
                    </Box>
                  </Box>

                  <Collapse in={isExpanded}>
                    <Box
                      sx={{
                        px: 2,
                        py: 1.5,
                        backgroundColor: '#fafafa',
                        borderBottom:
                          idx < displayedTransactions.length - 1 ? '1px solid #f0f0f0' : 'none',
                      }}
                    >
                      {tx.categoryName && <DetailRow label="Category" value={tx.categoryName} />}
                      {tx.unitId && <DetailRow label="Unit" value={tx.unitId} />}
                      {tx.accountName && <DetailRow label="Account" value={tx.accountName} />}
                      {tx.paymentMethod && <DetailRow label="Payment Method" value={tx.paymentMethod} />}
                      {tx.notes && <DetailRow label="Notes" value={tx.notes} />}
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

      {hasMore && (
        <Box sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
          >
            Load More
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
            Showing {displayedTransactions.length} of {filteredTransactions.length} transactions
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AdminTransactions;

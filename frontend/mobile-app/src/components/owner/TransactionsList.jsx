import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  Card,
  CardContent,
  Collapse,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Badge,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useClients } from '../../hooks/useClients.jsx';
import { config } from '../../config/index.js';
import { auth } from '../../services/firebase';
import { getMexicoDate } from '../../utils/timezone.js';
import { getFiscalYear } from '../../utils/fiscalYearUtils.js';
import { formatTransactionDate } from '../../utils/transactionDisplay.js';
import { formatPesosForDisplay, centavosToPesos } from '@shared/utils/currencyUtils.js';
import { filterMobileOwnerTransactions } from '../../utils/transactionMobileFilters.js';
import { useMobileTransactionFilterOptions } from '../../hooks/useMobileTransactionFilterOptions.js';
import { LoadingSpinner, DetailRow } from '../common';
import { getOwnerTransactionFetchRange } from '../../utils/transactionMobileDateRanges.js';
import {
  getTransactionDocumentCount,
  openQueuedTransactionAttachments,
} from '../../utils/transactionAttachments.js';
import TransactionAttachmentsDialog from '../transactions/TransactionAttachmentsDialog.jsx';
import DocumentViewer from '../documents/DocumentViewer';

const API_BASE_URL = config.api.baseUrl;

const DATE_PRESETS = [
  { id: 'currentMonth', label: 'This month' },
  { id: 'prior3Months', label: 'Prior 3 mo' },
  { id: 'currentYear', label: 'This year' },
];

const TransactionsList = () => {
  const { currentClient, firebaseUser } = useAuth();
  const { selectedClient } = useClients();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  /** User year chip; scoped to clientId so a new client uses fiscal default immediately (no wrong first fetch). */
  const [yearPick, setYearPick] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [datePreset, setDatePreset] = useState(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [attachmentIds, setAttachmentIds] = useState([]);
  const [singleDocPreviewId, setSingleDocPreviewId] = useState(null);

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;

  const fiscalYearStartMonth = useMemo(() => {
    let m = selectedClient?.configuration?.fiscalYearStartMonth;
    if (m == null && clientId === 'AVII') m = 7;
    else if (m == null) m = 1;
    return m;
  }, [selectedClient, clientId]);

  const currentFiscalYear = useMemo(
    () => getFiscalYear(getMexicoDate(), fiscalYearStartMonth),
    [fiscalYearStartMonth]
  );

  const yearOptions = useMemo(
    () => [currentFiscalYear, currentFiscalYear - 1, currentFiscalYear - 2],
    [currentFiscalYear]
  );

  const selectedYear = useMemo(() => {
    if (!clientId) return null;
    if (yearPick != null && yearPick.clientId === clientId) return yearPick.year;
    return getFiscalYear(getMexicoDate(), fiscalYearStartMonth);
  }, [clientId, fiscalYearStartMonth, yearPick]);

  const { startDate, endDate } = useMemo(() => {
    if (selectedYear == null) {
      return { startDate: null, endDate: null };
    }
    return getOwnerTransactionFetchRange(selectedYear, datePreset, fiscalYearStartMonth);
  }, [selectedYear, datePreset, fiscalYearStartMonth]);

  const fetchTransactions = useCallback(async () => {
    if (!clientId || !startDate || !endDate) return;
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser || firebaseUser;
      if (!user) throw new Error('No authenticated user');

      const token = await user.getIdToken();
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
  }, [clientId, firebaseUser, startDate, endDate]);

  useEffect(() => {
    if (clientId && startDate && endDate) fetchTransactions();
  }, [clientId, startDate, endDate, fetchTransactions]);

  useEffect(() => {
    setVendorFilter('');
    setCategoryFilter('');
    setUnitFilter('');
  }, [selectedYear, datePreset]);

  const { vendorOptions, categoryOptions, unitOptions } = useMobileTransactionFilterOptions(transactions);

  const filteredTransactions = useMemo(
    () =>
      filterMobileOwnerTransactions(transactions, {
        typeFilter,
        searchText,
        vendorFilter,
        categoryFilter,
        unitFilter,
      }),
    [transactions, typeFilter, searchText, vendorFilter, categoryFilter, unitFilter]
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (searchText.trim()) n += 1;
    if (typeFilter !== 'all') n += 1;
    if (vendorFilter) n += 1;
    if (categoryFilter) n += 1;
    if (unitFilter) n += 1;
    if (datePreset) n += 1;
    return n;
  }, [searchText, typeFilter, vendorFilter, categoryFilter, unitFilter, datePreset]);

  const toggleExpanded = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const openAttachments = (tx, e) => {
    if (e) e.stopPropagation();
    openQueuedTransactionAttachments(tx, setAttachmentIds, setAttachmentOpen, setSingleDocPreviewId);
  };

  const handleYearClick = (y) => {
    setDatePreset(null);
    if (clientId) setYearPick({ clientId, year: y });
  };

  const handleTypeFilter = (_, value) => {
    if (value != null) setTypeFilter(value);
  };

  const clearAllFilters = () => {
    setSearchText('');
    setVendorFilter('');
    setCategoryFilter('');
    setUnitFilter('');
    setDatePreset(null);
    setTypeFilter('all');
  };

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
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="outlined" fullWidth onClick={fetchTransactions}>Try Again</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <TextField
        size="small"
        fullWidth
        placeholder="Search transactions…"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        sx={{ mb: 1.5 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Badge badgeContent={activeFilterCount} color="primary" invisible={activeFilterCount === 0}>
          <Chip
            icon={<FilterListIcon />}
            label="Filters"
            onClick={() => setFiltersExpanded((v) => !v)}
            variant={filtersExpanded ? 'filled' : 'outlined'}
            color={filtersExpanded ? 'primary' : 'default'}
          />
        </Badge>
        {activeFilterCount > 0 && (
          <Button size="small" onClick={clearAllFilters}>Clear all</Button>
        )}
      </Box>

      <Collapse in={filtersExpanded}>
        <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary">Year</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {yearOptions.map((y) => (
              <Chip
                key={y}
                label={y}
                size="small"
                onClick={() => handleYearClick(y)}
                color={!datePreset && selectedYear === y ? 'primary' : 'default'}
                variant={!datePreset && selectedYear === y ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">Date range</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {DATE_PRESETS.map((p) => (
              <Chip
                key={p.id}
                size="small"
                label={p.label}
                onClick={() => setDatePreset(datePreset === p.id ? null : p.id)}
                color={datePreset === p.id ? 'secondary' : 'default'}
                variant={datePreset === p.id ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">Type</Typography>
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
          <TextField
            select
            size="small"
            label="Vendor"
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            fullWidth
          >
            <MenuItem value="">All</MenuItem>
            {vendorOptions.map((v) => (
              <MenuItem key={v} value={v}>{v}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            fullWidth
          >
            <MenuItem value="">All</MenuItem>
            {categoryOptions.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Unit"
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            fullWidth
          >
            <MenuItem value="">All</MenuItem>
            {unitOptions.map((u) => (
              <MenuItem key={u} value={u}>{u}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Collapse>

      <Typography variant="subtitle2" sx={{ color: '#6c757d', mb: 2 }}>
        Showing {filteredTransactions.length} of {transactions.length} transactions
        {datePreset ? ` · ${DATE_PRESETS.find((p) => p.id === datePreset)?.label || ''}` : selectedYear != null ? ` · ${selectedYear}` : ''}
      </Typography>

      {filteredTransactions.length === 0 ? (
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              No transactions match your filters.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {filteredTransactions.map((tx, idx) => {
              const amount = centavosToPesos(tx.amount);
              const isExpanded = expandedId === tx.id;
              const isExpense = tx.type === 'expense';
              const docCount = getTransactionDocumentCount(tx.documents);

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
                      borderBottom: (idx < filteredTransactions.length - 1 || isExpanded) ? '1px solid #f0f0f0' : 'none',
                      cursor: 'pointer',
                      '&:active': { backgroundColor: '#f5f5f5' },
                      WebkitTapHighlightColor: 'rgba(25, 118, 210, 0.08)',
                      touchAction: 'manipulation',
                    }}
                  >
                    <Box sx={{ flex: '0 0 90px', mr: 1 }}>
                      <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                        {formatTransactionDate(tx.date)}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }} noWrap>
                        {tx.vendorName || tx.description || tx.notes || '—'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: isExpense ? '#d32f2f' : '#2e7d32',
                          textAlign: 'right',
                          minWidth: 72,
                        }}
                      >
                        {isExpense ? '-' : '+'}
                        {formatPesosForDisplay(Math.abs(amount))}
                      </Typography>
                      {isExpanded ? <ExpandLessIcon sx={{ fontSize: 18, color: '#999' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: '#999' }} />}
                    </Box>
                  </Box>

                  <Collapse in={isExpanded}>
                    <Box sx={{ px: 2, py: 1.5, backgroundColor: '#fafafa', borderBottom: idx < filteredTransactions.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
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
                      {docCount > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Attachments ({docCount})
                          </Typography>
                          <IconButton size="small" aria-label="Open attachments" onClick={(e) => openAttachments(tx, e)}>
                            <Badge badgeContent={docCount} color="primary" max={99}>
                              <AttachFileIcon fontSize="small" />
                            </Badge>
                          </IconButton>
                        </Box>
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

      <Dialog
        open={Boolean(singleDocPreviewId)}
        onClose={() => setSingleDocPreviewId(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 5 }}>
          Attachment
          <IconButton
            aria-label="close"
            onClick={() => setSingleDocPreviewId(null)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {singleDocPreviewId && (
            <DocumentViewer
              clientId={clientId}
              documentId={singleDocPreviewId}
              showDelete={false}
              compact={false}
            />
          )}
        </DialogContent>
      </Dialog>

      <TransactionAttachmentsDialog
        open={attachmentOpen}
        onClose={() => {
          setAttachmentOpen(false);
          setAttachmentIds([]);
        }}
        clientId={clientId}
        documentIds={attachmentIds}
      />
    </Box>
  );
};

export default TransactionsList;

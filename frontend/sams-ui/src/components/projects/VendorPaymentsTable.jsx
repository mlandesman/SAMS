import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Link,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Alert,
  DialogContentText
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { formatCurrency as formatCurrencyShared } from '../../utils/currencyUtils';
import { getMexicoDateTime, getMexicoDateString } from '../../utils/timezone';
import { recordVendorPayment } from '../../api/projects';
import { deleteTransaction } from '../../api/transaction';
import { clientAPI } from '../../api/client';
import { getVendors } from '../../api/vendors';

function formatCurrency(centavos) {
  if (centavos === null || centavos === undefined) return '-';
  return formatCurrencyShared(centavos, 'USD');
}

/**
 * Format date for display (uses getMexicoDateTime - no new Date() for parsing)
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = getMexicoDateTime(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

const PAYMENT_METHODS = ['eTransfer', 'Cash', 'Check', 'Wire Transfer', 'Other'];

/**
 * VendorPaymentsTable - Displays vendor payments for a project
 *
 * @param {object} props
 * @param {array} props.vendorPayments - Array of payment objects
 * @param {function} props.onTransactionClick - Optional callback when clicking transaction link
 * @param {function} props.onRefresh - Callback to refresh project data after add/delete
 * @param {string} props.clientId - Client ID
 * @param {string} props.projectId - Project ID
 * @param {string} props.defaultVendor - Pre-fill vendor name (e.g. from selected bid)
 */
function VendorPaymentsTable({
  vendorPayments = [],
  onTransactionClick,
  onRefresh,
  clientId,
  projectId,
  defaultVendor = '',
  defaultVendorId = ''
}) {
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState({
    date: getMexicoDateString(),
    vendorId: defaultVendorId,
    vendor: defaultVendor,
    amount: '',
    description: '',
    accountId: '',
    paymentMethod: 'eTransfer'
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const payments = vendorPayments || [];

  useEffect(() => {
    setFormData(prev => ({ ...prev, vendor: defaultVendor, vendorId: defaultVendorId }));
  }, [defaultVendor, defaultVendorId]);

  useEffect(() => {
    if (recordDialogOpen && clientId) {
      Promise.all([
        clientAPI.getAccounts(clientId),
        clientAPI.getPaymentMethods(clientId),
        getVendors(clientId)
      ]).then(([accountsRes, methodsRes, vendorsRes]) => {
        const vendorsList = (vendorsRes?.data || [])
          .filter(v => v.status === 'active')
          .sort((a, b) => a.name.localeCompare(b.name));
        setVendors(vendorsList);
        const accs = Array.isArray(accountsRes) ? accountsRes : (accountsRes?.accounts || accountsRes?.data || []);
        const methods = Array.isArray(methodsRes) ? methodsRes : (methodsRes?.paymentMethods || methodsRes?.data || []);
        setAccounts(accs);
        setPaymentMethods(methods.length > 0 ? methods.map(m => m.name || m) : PAYMENT_METHODS);
        if (accs.length > 0 && !formData.accountId) {
          const defaultAcc = accs.find(a => a.type === 'bank') || accs[0];
          setFormData(prev => ({ ...prev, accountId: defaultAcc?.id || '' }));
        }
      }).catch(err => {
        console.error('Failed to load accounts/payment methods:', err);
        setPaymentMethods(PAYMENT_METHODS);
      });
    }
  }, [recordDialogOpen, clientId]);

  const handleOpenRecord = () => {
    setFormData({
      date: getMexicoDateString(),
      vendorId: defaultVendorId,
      vendor: defaultVendor,
      amount: '',
      description: '',
      accountId: accounts[0]?.id || '',
      paymentMethod: 'eTransfer'
    });
    setError('');
    setRecordDialogOpen(true);
  };

  const handleCloseRecord = () => {
    setRecordDialogOpen(false);
    setError('');
  };

  const handleRecordSubmit = async () => {
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    if (!formData.accountId) {
      setError('Please select a bank account');
      return;
    }
    const acc = accounts.find(a => a.id === formData.accountId);
    const accountType = acc?.type || 'bank';

    setSubmitting(true);
    setError('');
    try {
      await recordVendorPayment(clientId, projectId, {
        date: formData.date,
        amount,
        vendor: formData.vendor || 'Vendor',
        vendorId: formData.vendorId,
        description: formData.description,
        accountId: formData.accountId,
        accountType,
        paymentMethod: formData.paymentMethod
      });
      handleCloseRecord();
      onRefresh?.();
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    const transactionId = confirmDeleteId;
    if (!transactionId || !clientId) return;
    setConfirmDeleteId(null);
    setDeletingId(transactionId);
    setDeleteError('');
    try {
      await deleteTransaction(clientId, transactionId);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete payment:', err);
      setDeleteError(err.message || 'Failed to delete payment');
    } finally {
      setDeletingId(null);
    }
  };

  // Sort payments by date descending (most recent first) - use getMexicoDateTime for comparison
  const sortedPayments = useMemo(() => {
    if (!payments || payments.length === 0) return [];

    return [...payments].sort((a, b) => {
      const dateA = getMexicoDateTime(a.date || '');
      const dateB = getMexicoDateTime(b.date || '');
      return dateB - dateA;
    });
  }, [payments]);

  const totalPaid = useMemo(() => {
    return sortedPayments.reduce((sum, p) => sum + Math.abs(p.amount || 0), 0);
  }, [sortedPayments]);

  const handleTransactionClick = (txnId) => {
    if (onTransactionClick && txnId) onTransactionClick(txnId);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Vendor Payments
        </Typography>
        {clientId && projectId && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<FontAwesomeIcon icon={faPlus} size="sm" />}
            onClick={handleOpenRecord}
          >
            Record Payment
          </Button>
        )}
      </Box>

      {sortedPayments.length === 0 ? (
        <Box sx={{ py: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No vendor payments recorded for this project.
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.100' }}>
                <TableCell>Date</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="center" width={80}>Transaction</TableCell>
                {clientId && <TableCell align="center" width={60}></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPayments.map((payment, idx) => (
                <TableRow
                  key={payment.transactionId || idx}
                  sx={{ '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                >
                  <TableCell>
                    <Typography variant="body2">{formatDate(payment.date)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{payment.vendor || '-'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="error.main">
                      {formatCurrency(payment.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {payment.description || payment.notes || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {payment.transactionId ? (
                      <Tooltip title="View transaction">
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => handleTransactionClick(payment.transactionId)}
                          sx={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 0.5
                          }}
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} size="sm" />
                        </Link>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.disabled">-</Typography>
                    )}
                  </TableCell>
                  {clientId && (
                    <TableCell align="center">
                      <Tooltip title="Delete payment">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setConfirmDeleteId(payment.transactionId)}
                          disabled={deletingId === payment.transactionId}
                        >
                          <FontAwesomeIcon icon={faTrash} size="sm" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell colSpan={2}>
                  <Typography variant="body2" fontWeight="bold">
                    Total ({sortedPayments.length} payment{sortedPayments.length !== 1 ? 's' : ''})
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="bold" color="error.main">
                    {formatCurrency(-totalPaid)}
                  </Typography>
                </TableCell>
                <TableCell colSpan={clientId ? 3 : 2}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={recordDialogOpen} onClose={handleCloseRecord} maxWidth="sm" fullWidth>
        <DialogTitle>Record Vendor Payment</DialogTitle>
        <DialogContent>
          {error && (
            <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Date"
              type="date"
              value={formData.date}
              onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Vendor</InputLabel>
              <Select
                value={formData.vendorId}
                label="Vendor"
                onChange={e => {
                  const vid = e.target.value;
                  const v = vendors.find(v => v.id === vid);
                  setFormData(prev => ({ ...prev, vendorId: vid, vendor: v?.name || '' }));
                }}
              >
                {vendors.map(v => (
                  <MenuItem key={v.id} value={v.id}>
                    {v.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Amount (pesos)"
              type="number"
              value={formData.amount}
              onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              inputProps={{ min: 0, step: 0.01 }}
              fullWidth
            />
            <TextField
              label="Description / Notes"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Bank Account</InputLabel>
              <Select
                value={formData.accountId}
                label="Bank Account"
                onChange={e => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
              >
                {accounts.map(acc => (
                  <MenuItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type || 'bank'})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={formData.paymentMethod}
                label="Payment Method"
                onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
              >
                {paymentMethods.map(m => (
                  <MenuItem key={m} value={typeof m === 'string' ? m : m.name}>
                    {typeof m === 'string' ? m : m.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRecord}>Cancel</Button>
          <Button variant="contained" onClick={handleRecordSubmit} disabled={submitting}>
            {submitting ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} maxWidth="xs">
        <DialogTitle>Delete Vendor Payment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the payment transaction and reverse the account balance. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {deleteError && (
        <Alert severity="error" onClose={() => setDeleteError('')} sx={{ mt: 1 }}>
          {deleteError}
        </Alert>
      )}
    </Box>
  );
}

export default VendorPaymentsTable;

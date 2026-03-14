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
  IconButton,
  Alert
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { formatCurrency as formatCurrencyShared } from '@shared/utils/currencyUtils';
import { getMexicoDateTime, getMexicoDateString } from '../../utils/timezone';
import { recordVendorPayment } from '../../api/projects';
import { deleteTransaction } from '../../api/transaction';
import { clientAPI } from '../../api/client';
import { getVendors } from '../../api/vendors';
import SandylandConfirmModal from '../shared/SandylandConfirmModal';
import '../../styles/SandylandModalTheme.css';

function formatCurrency(centavos) {
  if (centavos === null || centavos === undefined) return '-';
  return formatCurrencyShared(centavos, 'USD');
}

/**
 * Format date for display (uses getMexicoDateTime for timezone-safe parsing)
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
  installments = [],
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
    paymentMethod: 'eTransfer',
    milestoneIndex: ''
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
      paymentMethod: 'eTransfer',
      milestoneIndex: ''
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
        paymentMethod: formData.paymentMethod,
        milestoneIndex: formData.milestoneIndex !== '' ? Number(formData.milestoneIndex) : null
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
                {installments.length > 0 && <TableCell>Milestone</TableCell>}
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
                  {installments.length > 0 && (
                    <TableCell>
                      <Typography variant="body2">
                        {payment.milestoneIndex != null && installments[payment.milestoneIndex]
                          ? installments[payment.milestoneIndex].milestone
                          : '-'}
                      </Typography>
                    </TableCell>
                  )}
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
                <TableCell colSpan={installments.length > 0 ? 3 : 2}>
                  <Typography variant="body2" fontWeight="bold">
                    Total ({sortedPayments.length} payment{sortedPayments.length !== 1 ? 's' : ''})
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight="bold" color="error.main">
                    {formatCurrency(-totalPaid)}
                  </Typography>
                </TableCell>
                <TableCell colSpan={clientId ? (installments.length > 0 ? 4 : 3) : (installments.length > 0 ? 3 : 2)}></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Record Payment Dialog - Sandyland modal */}
      {recordDialogOpen && (
        <div className="sandyland-modal-overlay" onClick={handleCloseRecord}>
          <div
            className="sandyland-modal"
            style={{ width: 550, maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sandyland-modal-header">
              <h2 className="sandyland-modal-title">Record Vendor Payment</h2>
            </div>
            <div className="sandyland-modal-content">
              {error && (
                <div className="sandyland-error-alert" style={{ marginBottom: 16 }}>{error}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="sandyland-form-field full-width">
                  <label>Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="sandyland-form-field full-width">
                  <label>Vendor</label>
                  <select
                    value={formData.vendorId}
                    onChange={e => {
                      const vid = e.target.value;
                      const v = vendors.find(v => v.id === vid);
                      setFormData(prev => ({ ...prev, vendorId: vid, vendor: v?.name || '' }));
                    }}
                  >
                    <option value="">Select vendor…</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                {installments && installments.length > 0 && (
                  <div className="sandyland-form-field full-width">
                    <label>Vendor Milestone (optional)</label>
                    <select
                      value={formData.milestoneIndex}
                      onChange={e => setFormData(prev => ({ ...prev, milestoneIndex: e.target.value }))}
                    >
                      <option value="">— Select milestone —</option>
                      {installments.map((inst, i) => (
                        <option key={i} value={i}>{inst.milestone} ({inst.percentOfTotal}%)</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="sandyland-form-field full-width">
                  <label>Amount (pesos)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.amount}
                    onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="sandyland-form-field full-width">
                  <label>Description / Notes</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="sandyland-form-field full-width">
                  <label>Bank Account</label>
                  <select
                    value={formData.accountId}
                    onChange={e => setFormData(prev => ({ ...prev, accountId: e.target.value }))}
                  >
                    <option value="">Select account…</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type || 'bank'})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sandyland-form-field full-width">
                  <label>Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  >
                    {paymentMethods.map(m => (
                      <option key={m} value={typeof m === 'string' ? m : m.name}>
                        {typeof m === 'string' ? m : m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="sandyland-modal-buttons">
              <button className="sandyland-btn sandyland-btn-secondary" onClick={handleCloseRecord}>
                Cancel
              </button>
              <button
                className="sandyland-btn sandyland-btn-primary"
                onClick={handleRecordSubmit}
                disabled={submitting}
              >
                {submitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation - SandylandConfirmModal */}
      <SandylandConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Vendor Payment"
        message="This will permanently delete the payment transaction and reverse the account balance. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        type="danger"
      />

      {deleteError && (
        <Alert severity="error" onClose={() => setDeleteError('')} sx={{ mt: 1 }}>
          {deleteError}
        </Alert>
      )}
    </Box>
  );
}

export default VendorPaymentsTable;

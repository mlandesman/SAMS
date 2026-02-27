/**
 * Unit Report Component for Mobile PWA
 * Mobile-first financial report for unit owners
 *
 * Features:
 * - Touch-optimized interface (48px min touch targets)
 * - Real API integration
 * - Transaction detail modal
 * - Responsive design
 * - Integrates SelectedUnitContext for unit switching
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Select,
  MenuItem,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuthStable.jsx';
import { useSelectedUnit } from '../context/SelectedUnitContext.jsx';
import { useUnitAccountStatus } from '../hooks/useUnitAccountStatus';
import { normalizeOwners, normalizeManagers } from '../utils/unitContactUtils.js';
import { config } from '../config/index.js';
import { auth } from '../services/firebase';
import './UnitReport.css';

const API_BASE_URL = config.api.baseUrl;

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const UnitReport = ({ unitId: propUnitId }) => {
  const { currentClient, firebaseUser } = useAuth();
  const { selectedUnitId, setSelectedUnitId, availableUnits } = useSelectedUnit();
  const currentUnitId = propUnitId || selectedUnitId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Fetch account status for the summary header
  const { data: accountStatus } = useUnitAccountStatus(
    typeof currentClient === 'string' ? currentClient : currentClient?.id,
    currentUnitId
  );

  useEffect(() => {
    const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
    if (clientId && currentUnitId) {
      fetchUnitReport(clientId, currentUnitId);
    }
  }, [currentClient, currentUnitId]);

  const fetchUnitReport = async (clientId, unitId) => {
    try {
      setLoading(true);
      setError(null);

      if (!firebaseUser) throw new Error('No authenticated user');

      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/reports/unit/${unitId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.unit) {
        data.unit.owners = normalizeOwners(data.unit.owners);
        data.unit.managers = normalizeManagers(data.unit.managers);
      }
      setReportData(data);
    } catch (err) {
      console.error('Error fetching unit report:', err);
      setError(err.message || 'Failed to load unit report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary">Loading your financial report...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, mt: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="outlined" fullWidth onClick={() => {
          const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
          if (clientId && currentUnitId) fetchUnitReport(clientId, currentUnitId);
        }}>
          Try Again
        </Button>
      </Box>
    );
  }

  if (!reportData) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', mt: 4 }}>
        <Typography variant="body1" color="text.secondary">No report data available for this unit.</Typography>
      </Box>
    );
  }

  const { unit, currentStatus, transactions } = reportData;

  // Determine display status from accountStatus hook (same endpoint as desktop)
  const amountDue = accountStatus?.amountDue ?? currentStatus?.amountDue ?? 0;
  const creditBalance = accountStatus?.creditBalance ?? currentStatus?.creditBalance ?? 0;
  let statusLabel, statusColor;
  if (amountDue > 0) {
    statusLabel = `Balance Due: ${formatCurrency(amountDue)}`;
    statusColor = '#d32f2f';
  } else if (creditBalance > 0) {
    statusLabel = `Credit: ${formatCurrency(creditBalance)}`;
    statusColor = '#1565c0';
  } else {
    statusLabel = 'Current';
    statusColor = '#2e7d32';
  }

  // Payment calendar
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  const paymentData = reportData?.paymentCalendar || reportData?.payments;
  const paymentCalendar = months.map((month, index) => {
    let status = 'not-due';
    if (paymentData && paymentData[index + 1]) {
      if (paymentData[index + 1].paid > 0) status = 'paid';
      else if (index < currentMonth) status = 'past-due';
      else if (index === currentMonth) status = 'due-soon';
    } else {
      if (index < currentMonth) status = 'past-due';
      else if (index === currentMonth) status = 'due-soon';
    }
    return { month, status };
  });

  return (
    <div className="unit-report-mobile">
      {/* Unit info */}
      <div className="unit-info-section">
        <div className="unit-number-display">Unit {unit.unitId}</div>
        <div className="people-list">
          {unit.owners.map((owner, i) => (
            <div key={`owner-${i}`} className="person-item">{owner.name}</div>
          ))}
          {unit.managers.map((manager, i) => (
            <div key={`mgr-${i}`} className="person-item manager">{manager.name} (Mgr)</div>
          ))}
        </div>
      </div>

      {/* Unit switcher via context */}
      {availableUnits.length > 1 && (
        <Box sx={{ mx: 2, mb: 1 }}>
          <FormControl size="small" fullWidth>
            <Select
              value={currentUnitId || ''}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              sx={{ fontWeight: 600 }}
            >
              {availableUnits.map((u) => (
                <MenuItem key={u.unitId} value={u.unitId}>Unit {u.unitId}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Clean summary header */}
      <div className="status-card enhanced">
        <div className="financial-summary">
          <div className="summary-row">
            <span className="label">Status:</span>
            <span className="value" style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
          </div>
          {currentStatus?.ytdPaid && (
            <div className="summary-row">
              <span className="label">YTD Total:</span>
              <span className="value">{formatCurrency((currentStatus.ytdPaid.hoaDues || 0) + (currentStatus.ytdPaid.projects || 0))}</span>
            </div>
          )}
          {accountStatus?.lastPayment && (
            <div className="summary-row">
              <span className="label">Last Payment:</span>
              <span className="value">{formatDate(accountStatus.lastPayment.date)} — {formatCurrency(accountStatus.lastPayment.amount)}</span>
            </div>
          )}
        </div>

        {/* Payment calendar grid — 4 cols on very small screens, 6 on larger */}
        <div className="payment-calendar">
          <div className="calendar-row">
            {paymentCalendar.slice(0, 6).map((item, i) => (
              <div key={i} className={`calendar-cell ${item.status}`}>{item.month}</div>
            ))}
          </div>
          <div className="calendar-row">
            {paymentCalendar.slice(6, 12).map((item, i) => (
              <div key={i + 6} className={`calendar-cell ${item.status}`}>{item.month}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="transactions-section">
        <h3>Recent Transactions</h3>
        {transactions.length === 0 ? (
          <div className="no-transactions"><p>No transactions found for this unit.</p></div>
        ) : (
          <div className="transactions-list">
            {transactions.map((tx) => {
              const isPayment = tx.payment && tx.payment > 0;
              const isCharge = tx.charge && tx.charge > 0;
              const amount = isPayment ? tx.payment : (isCharge ? tx.charge : tx.amount);
              const amountColor = isPayment ? '#2e7d32' : (isCharge ? '#d32f2f' : undefined);

              return (
                <div
                  key={tx.id || `${tx.date}-${tx.description}`}
                  className="transaction-item"
                  onClick={() => setSelectedTransaction(tx)}
                >
                  <div className="transaction-date">{formatDate(tx.date)}</div>
                  <div className="transaction-amount" style={amountColor ? { color: amountColor } : undefined}>
                    {formatCurrency(amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction detail dialog (MUI) */}
      <Dialog open={!!selectedTransaction} onClose={() => setSelectedTransaction(null)} fullWidth maxWidth="xs">
        {selectedTransaction && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
              Transaction Details
              <IconButton size="small" onClick={() => setSelectedTransaction(null)} aria-label="close">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <DetailRow label="Date" value={formatDate(selectedTransaction.date)} />
              <DetailRow label="Amount" value={formatCurrency(selectedTransaction.amount || selectedTransaction.payment || selectedTransaction.charge)} />
              {selectedTransaction.description && (
                <DetailRow label="Description" value={selectedTransaction.description} />
              )}
              {selectedTransaction.category && (
                <DetailRow label="Category" value={selectedTransaction.category} />
              )}
              {selectedTransaction.paymentMethod && (
                <DetailRow label="Payment Method" value={selectedTransaction.paymentMethod} />
              )}
              {typeof selectedTransaction.balance === 'number' && (
                <DetailRow label="Running Balance" value={formatCurrency(selectedTransaction.balance)} />
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedTransaction(null)} fullWidth variant="contained">Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 2 }}>
    <Typography variant="body2" sx={{ color: '#6c757d', fontWeight: 600, flexShrink: 0 }}>{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: 500, color: '#333', textAlign: 'right', wordBreak: 'break-word' }}>{value}</Typography>
  </Box>
);

export default UnitReport;

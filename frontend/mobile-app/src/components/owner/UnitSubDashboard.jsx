/**
 * Unit Sub-Dashboard — Mobile owner view
 * Single scrollable page: Account Summary, Payment Info, Fee Schedule, Recent Transactions, Stored Statements
 * Sprint MOBILE-OWNER-UX (MOB-3)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Button,
  List,
  ListItem,
  ListItemText,
  Alert,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PictureAsPdf as PdfIcon,
  NoteAdd as GenerateIcon,
} from '@mui/icons-material';
import { LoadingSpinner } from '../common';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { useSelectedUnit } from '../../context/SelectedUnitContext.jsx';
import { useUnitAccountStatus } from '../../hooks/useUnitAccountStatus';
import { config } from '../../config/index.js';
import { auth, db } from '../../services/firebase';
import { getMexicoDateTime } from '../../utils/timezone.js';

const formatPeso = (amount) =>
  typeof amount === 'number' && !isNaN(amount)
    ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr + 'T12:00:00') : new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const UnitSubDashboard = () => {
  const navigate = useNavigate();
  const { currentClient, firebaseUser } = useAuth();
  const { selectedUnitId } = useSelectedUnit();
  const { data: unitData, loading: unitLoading, error: unitError } = useUnitAccountStatus(currentClient, selectedUnitId);

  const [statementData, setStatementData] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [transactionsExpanded, setTransactionsExpanded] = useState(true);
  const [storedStatements, setStoredStatements] = useState([]);
  const [storedLoading, setStoredLoading] = useState(false);
  const [hoaConfig, setHoaConfig] = useState(null);

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;

  // Fetch statement data for transactions
  const fetchStatementData = useCallback(async () => {
    if (!clientId || !selectedUnitId) return;
    setStatementLoading(true);
    try {
      const user = auth.currentUser || firebaseUser;
      if (!user) throw new Error('Not authenticated');
      const token = await user.getIdToken();
      const res = await fetch(
        `${config.api.baseUrl}/reports/${clientId}/statement/data?unitId=${selectedUnitId}&language=english`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setStatementData(json.data || json);
    } catch (err) {
      console.error('Statement data fetch error:', err);
      setStatementData(null);
    } finally {
      setStatementLoading(false);
    }
  }, [clientId, selectedUnitId, firebaseUser]);

  useEffect(() => {
    fetchStatementData();
  }, [fetchStatementData]);

  // Stored statements
  const fetchStoredStatements = useCallback(async () => {
    if (!clientId || !selectedUnitId) return;
    setStoredLoading(true);
    try {
      const ref = collection(db, 'clients', clientId, 'accountStatements');
      const q = query(
        ref,
        where('unitId', '==', selectedUnitId),
        orderBy('calendarYear', 'desc'),
        orderBy('calendarMonth', 'desc')
      );
      const snap = await getDocs(q);
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setStoredStatements(list);
    } catch (err) {
      console.error('Stored statements fetch error:', err);
      setStoredStatements([]);
    } finally {
      setStoredLoading(false);
    }
  }, [clientId, selectedUnitId]);

  useEffect(() => {
    fetchStoredStatements();
  }, [fetchStoredStatements]);

  // HOA config for late fee
  useEffect(() => {
    if (!clientId) return;
    auth.currentUser?.getIdToken?.().then((t) =>
      fetch(`${config.api.baseUrl}/clients/${clientId}/config/hoaDues`, {
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      })
    ).then((r) => (r?.ok ? r.json() : null)).then((res) => {
      const d = res?.data || {};
      setHoaConfig({ penaltyDays: d.penaltyDays ?? 10, penaltyRate: d.penaltyRate ?? 0 });
    }).catch(() => setHoaConfig({ penaltyDays: 10, penaltyRate: 0 }));
  }, [clientId]);

  if (!currentClient || !selectedUnitId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">Select a unit to view your account.</Typography>
      </Box>
    );
  }

  if (unitError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{unitError}</Alert>
      </Box>
    );
  }

  const unitReady = !unitLoading && unitData;
  const dueDate = unitData?.nextPaymentDueDate || unitData?.summary?.nextPaymentDueDate;
  const amountDue = unitData?.amountDue ?? 0;
  const creditBalance = unitData?.creditBalance ?? 0;
  const nextPaymentAmount = unitData?.nextPaymentAmount ?? 0;
  const now = getMexicoDateTime();
  const dueDateObj = dueDate ? new Date(dueDate + 'T12:00:00') : null;
  const daysPastDue = dueDateObj && now > dueDateObj
    ? Math.max(0, Math.floor((now - dueDateObj) / (24 * 60 * 60 * 1000)))
    : 0;
  const hasLateFees = hoaConfig && hoaConfig.penaltyRate > 0;
  const lateFeeDate = hasLateFees && dueDateObj && hoaConfig.penaltyDays != null
    ? (() => {
        const d = new Date(dueDateObj);
        d.setDate(d.getDate() + (hoaConfig.penaltyDays || 0));
        return formatDate(d.toISOString().split('T')[0]);
      })()
    : null;

  const lineItems = statementData?.lineItems || [];
  const nonFuture = lineItems.filter((i) => !i.isFuture);
  const recentTx = nonFuture.slice(-10).reverse();

  const handleGenerateStatement = async () => {
    navigate('/statement');
  };

  return (
    <Box sx={{ p: 2, pb: 12 }}>
      {/* Section A: Account Summary — Net balance: positive = you owe, negative = credit */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Account Summary</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Net balance (red = you owe; green = credit)
          </Typography>
          {!unitReady ? (
            <Box display="flex" justifyContent="center" py={2}>
              <LoadingSpinner size="small" />
            </Box>
          ) : (
            <>
              <Typography variant="h5" sx={{ color: amountDue > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>
                {formatPeso(amountDue > 0 ? amountDue : (creditBalance > 0 ? creditBalance : 0))}
              </Typography>
              {amountDue > 0 && (
                <Typography variant="body2" color="text.secondary">Amount due</Typography>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section B: Payment Info — Amount currently due and its due date */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Payment Info</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Amount due now • Due date (— = not set)
          </Typography>
          {!unitReady ? (
            <Box display="flex" justifyContent="center" py={2}>
              <LoadingSpinner size="small" />
            </Box>
          ) : (
            <>
              <Typography variant="body1" fontWeight={600}>{formatPeso(amountDue)}</Typography>
              <Typography variant="body2" color="text.secondary">Due {formatDate(dueDate)}</Typography>
              {daysPastDue > 0 && (
                <Typography variant="body2" sx={{ color: '#dc2626', fontWeight: 600 }}>{daysPastDue} days past due</Typography>
              )}
              {hasLateFees && lateFeeDate && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Late fees apply after {lateFeeDate}
                </Typography>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section C: Fee Schedule — Next upcoming HOA dues amount */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Fee Schedule</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            Next HOA dues amount (when known)
          </Typography>
          {!unitReady ? (
            <Box display="flex" justifyContent="center" py={2}>
              <LoadingSpinner size="small" />
            </Box>
          ) : nextPaymentAmount > 0 ? (
            <Typography variant="body2">Next payment: {formatPeso(nextPaymentAmount)}</Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">No upcoming fees</Typography>
          )}
        </CardContent>
      </Card>

      {/* Section D: Recent Transactions */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle2" color="text.secondary">Recent Transactions</Typography>
            <Button size="small" onClick={() => setTransactionsExpanded(!transactionsExpanded)}>
              {transactionsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Button>
          </Box>
          <Collapse in={transactionsExpanded}>
            {statementLoading ? (
              <Box display="flex" justifyContent="center" py={2}><LoadingSpinner size="small" /></Box>
            ) : recentTx.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No transactions</Typography>
            ) : (
              <List dense disablePadding>
                {recentTx.map((item, i) => {
                  const isPayment = item.type === 'payment' || (item.payment && item.payment > 0);
                  const amt = isPayment ? item.payment : item.charge;
                  return (
                    <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={item.description || 'Transaction'}
                        secondary={formatDate(item.date)}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ color: isPayment ? '#059669' : '#dc2626' }}
                      >
                        {isPayment ? '+' : '-'}{formatPeso(amt)}
                      </Typography>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Collapse>
          <Button fullWidth size="small" sx={{ mt: 1 }} onClick={() => navigate('/transactions')}>
            View All Transactions
          </Button>
        </CardContent>
      </Card>

      {/* Section E: Stored Statements */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Statements</Typography>
          {storedLoading ? (
            <Box display="flex" justifyContent="center" py={1}><LoadingSpinner size="small" /></Box>
          ) : storedStatements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No stored statements</Typography>
          ) : (
            <List dense disablePadding>
              {storedStatements.slice(0, 5).map((s) => (
                <ListItem key={s.id} disablePadding>
                  <ListItemText
                    primary={`${s.calendarMonth || ''}/${s.calendarYear || ''}`}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                  {s.storageUrl && (
                    <Button size="small" startIcon={<PdfIcon />} href={s.storageUrl} target="_blank" rel="noopener">
                      Open
                    </Button>
                  )}
                </ListItem>
              ))}
            </List>
          )}
          <Button
            fullWidth
            variant="contained"
            startIcon={<GenerateIcon />}
            sx={{ mt: 1 }}
            onClick={handleGenerateStatement}
          >
            Generate Current Statement
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UnitSubDashboard;

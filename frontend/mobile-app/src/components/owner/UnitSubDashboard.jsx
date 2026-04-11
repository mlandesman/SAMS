/**
 * Unit Sub-Dashboard — Mobile owner view
 * Single scrollable page: Account Summary, Payment Info, Fee Schedule, Recent Transactions, Stored Statements
 * Sprint MOBILE-OWNER-UX (MOB-3)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
import { useHoaConfig } from '../../hooks/useHoaConfig.js';
import { db } from '../../services/firebase';
import { getMexicoDateTime, formatDateForDisplay } from '../../utils/timezone.js';
import { formatPesosForDisplay } from '@shared/utils/currencyUtils.js';
import { buildStoredStatementOptions } from '../../utils/storedStatementLabels.js';

const UnitSubDashboard = () => {
  const navigate = useNavigate();
  const { currentClient } = useAuth();
  const { selectedUnitId } = useSelectedUnit();
  const { data: unitData, loading: unitLoading, error: unitError } = useUnitAccountStatus(currentClient, selectedUnitId);

  const [transactionsExpanded, setTransactionsExpanded] = useState(true);
  const [storedStatements, setStoredStatements] = useState([]);
  const [storedLoading, setStoredLoading] = useState(false);

  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;
  const { hoaConfig } = useHoaConfig(clientId);

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

  const storedStatementRows = useMemo(
    () => buildStoredStatementOptions(storedStatements),
    [storedStatements]
  );

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
        return formatDateForDisplay(d.toISOString().split('T')[0]);
      })()
    : null;

  const lineItems = unitData?.lineItems || [];
  const nonFuture = lineItems.filter((i) => !i.isFuture);
  const recentTx = nonFuture.slice(-10).reverse();

  const handleGenerateStatement = async () => {
    navigate('/statement');
  };

  const isPastDue = daysPastDue > 0;
  const amountColor = amountDue > 0 ? (isPastDue ? '#dc2626' : '#1f2937') : '#059669';

  return (
    <Box sx={{ p: 2, pb: 12 }}>
      {/* Section A: Account Summary — Combined: amount due, due date, scheduled payment */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Account Summary</Typography>
          {!unitReady ? (
            <Box display="flex" justifyContent="center" py={2}>
              <LoadingSpinner size="small" />
            </Box>
          ) : (
            <>
              <Typography variant="h5" sx={{ color: amountColor, fontWeight: 700, mb: 0.5 }}>
                {formatPesosForDisplay(amountDue > 0 ? amountDue : (creditBalance > 0 ? creditBalance : 0))}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Due {dueDate ? formatDateForDisplay(dueDate) : '(date not set)'}
              </Typography>
              {daysPastDue > 0 && (
                <Typography variant="body2" sx={{ color: '#dc2626', fontWeight: 600, mb: 1 }}>{daysPastDue} days past due</Typography>
              )}
              {hasLateFees && lateFeeDate && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Late fees apply after {lateFeeDate}
                </Typography>
              )}
              {nextPaymentAmount > 0 && (
                <>
                  <Typography variant="body2" sx={{ color: '#1f2937', mt: 1 }}>
                    {formatPesosForDisplay(nextPaymentAmount)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Scheduled payment amount
                  </Typography>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle2" color="text.secondary">Recent Transactions</Typography>
            <Button size="small" onClick={() => setTransactionsExpanded(!transactionsExpanded)}>
              {transactionsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Button>
          </Box>
          <Collapse in={transactionsExpanded}>
            {unitLoading ? (
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
                        secondary={formatDateForDisplay(item.date)}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ color: isPayment ? '#059669' : '#dc2626' }}
                      >
                        {isPayment ? '+' : '-'}{formatPesosForDisplay(amt)}
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

      {/* Stored Statements */}
      <Card sx={{ mb: 2, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Statements</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            Each month may include English (EN) and Spanish (ES) versions.
          </Typography>
          {storedLoading ? (
            <Box display="flex" justifyContent="center" py={1}><LoadingSpinner size="small" /></Box>
          ) : storedStatementRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No stored statements</Typography>
          ) : (
            <List dense disablePadding>
              {storedStatementRows.slice(0, 5).map((s) => (
                <ListItem key={s.id} disablePadding>
                  <ListItemText
                    primary={s.label}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                  {s.storageUrl && (
                    <Button
                      size="small"
                      startIcon={<PdfIcon />}
                      onClick={() => navigate('/statement', { state: { openStoredId: s.id } })}
                      sx={{ textTransform: 'none' }}
                    >
                      View
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

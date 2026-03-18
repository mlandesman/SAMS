/**
 * UPC Payment Received — Mobile step-based flow
 * Sprint MOBILE-ADMIN-UX (ADM-4)
 * Step 1: Select Unit → Step 2: Review Bills → Step 3: Enter Payment → Step 4: Confirm
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Card,
  CardContent,
  FormControlLabel,
  Checkbox,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuthStable.jsx';
import { config } from '../../config/index.js';
import { auth } from '../../services/firebase.js';
import unifiedPaymentAPI from '../../services/unifiedPaymentAPI.js';
import { getMexicoDateString } from '../../utils/timezone.js';
import { getFirstOwnerLastName } from '../../utils/unitContactUtils.js';
import { formatPesosForDisplay } from '@shared/utils/currencyUtils.js';
import { LoadingSpinner } from '../common';

const RecordPayment = () => {
  const navigate = useNavigate();
  const { currentClient } = useAuth();
  const clientId = typeof currentClient === 'string' ? currentClient : currentClient?.id;

  const [activeStep, setActiveStep] = useState(0);
  const [units, setUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [accounts, setAccounts] = useState([]);

  const [preview, setPreview] = useState(null);
  const [excludedBills, setExcludedBills] = useState([]);
  const [waivedPenalties, setWaivedPenalties] = useState([]);

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getMexicoDateString());
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentMethodName, setPaymentMethodName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accountType, setAccountType] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (clientId) loadInitialData();
  }, [clientId]);

  useEffect(() => {
    if (selectedUnitId && clientId) {
      setExcludedBills([]);
      setWaivedPenalties([]);
      fetchPreview(null);
    }
  }, [selectedUnitId, clientId]);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      setError(null);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      const [unitsRes, methodsRes, accountsRes] = await Promise.all([
        fetch(`${config.api.baseUrl}/clients/${clientId}/units`, { headers }),
        fetch(`${config.api.baseUrl}/clients/${clientId}/paymentmethods`, { headers }),
        fetch(`${config.api.baseUrl}/clients/${clientId}/accounts`, { headers }),
      ]);

      const unitsData = unitsRes.ok ? await unitsRes.json() : {};
      const unitsList = unitsData.data || unitsData.units || unitsData || [];
      setUnits(Array.isArray(unitsList) ? unitsList : Object.values(unitsList));

      if (methodsRes.ok) {
        const methodsData = await methodsRes.json();
        const methods = methodsData.data || methodsData || [];
        setPaymentMethods(Array.isArray(methods) ? methods.filter((m) => m.status !== 'inactive') : []);
      }

      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        const accs = accountsData.data || accountsData.accounts || accountsData || [];
        setAccounts(Array.isArray(accs) ? accs : []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchPreview = async (overrideAmount) => {
    if (!selectedUnitId || !clientId) return;
    try {
      setLoading(true);
      setError(null);
      const amt = overrideAmount !== undefined ? overrideAmount : (parseFloat(amount) || null);
      const previewData = await unifiedPaymentAPI.previewUnifiedPayment(clientId, selectedUnitId, {
        amount: amt,
        paymentDate,
        waivedPenalties,
        excludedBills,
      });
      setPreview(previewData);

      if (overrideAmount === undefined && !amount) {
        const totalDue = previewData.billPayments?.reduce((sum, b) => {
          if (excludedBills.includes(b.billPeriod)) return sum;
          const remaining = b.remainingDue ?? b.totalDue ?? 0;
          const waived = waivedPenalties.find((w) => w.billId === b.billPeriod);
          return sum + (remaining - (waived?.amount || 0));
        }, 0) ?? 0;
        const credit = previewData.currentCreditBalance ?? 0;
        const defaultAmt = Math.max(0, totalDue - credit);
        setAmount(defaultAmt > 0 ? String(defaultAmt) : '');
      }
    } catch (err) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const toggleBillExcluded = (billPeriod) => {
    setExcludedBills((prev) =>
      prev.includes(billPeriod) ? prev.filter((p) => p !== billPeriod) : [...prev, billPeriod]
    );
  };

  const togglePenaltyWaiver = (bill) => {
    if (bill.penaltyDue <= 0) return;
    const existing = waivedPenalties.find((w) => w.billId === bill.billPeriod);
    if (existing) {
      setWaivedPenalties((prev) => prev.filter((w) => w.billId !== bill.billPeriod));
    } else {
      setWaivedPenalties((prev) => [
        ...prev,
        { billId: bill.billPeriod, amount: bill.penaltyDue, reason: 'Administrative' },
      ]);
    }
  };

  useEffect(() => {
    if (selectedUnitId && clientId) {
      const amt = parseFloat(amount);
      fetchPreview(isNaN(amt) ? null : amt);
    }
  }, [excludedBills, waivedPenalties]);

  const handlePaymentMethodChange = (e) => {
    const id = e.target.value;
    const method = paymentMethods.find((m) => m.id === id);
    setPaymentMethodId(id);
    setPaymentMethodName(method?.name || '');
  };

  const handleAccountChange = (e) => {
    const id = e.target.value;
    const acc = accounts.find((a) => a.id === id);
    setAccountId(id);
    setAccountType(acc?.type || 'bank');
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    const effectiveAmount = isNaN(amt) ? 0 : amt;
    const creditBalance = preview?.currentCreditBalance ?? 0;

    if (effectiveAmount < 0) {
      setError('Payment amount cannot be negative');
      return;
    }
    if (effectiveAmount === 0 && creditBalance <= 0) {
      setError('Payment amount must be greater than zero when no credit balance');
      return;
    }
    if (!paymentMethodId || !accountId) {
      setError('Please select payment method and account');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await unifiedPaymentAPI.recordUnifiedPayment(
        clientId,
        selectedUnitId,
        {
          amount: effectiveAmount,
          paymentDate,
          paymentMethod: paymentMethodName,
          paymentMethodId,
          accountId,
          accountType,
          reference: reference || null,
          notes: notes || null,
          waivedPenalties,
          excludedBills,
          documents: [],
        },
        preview
      );
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Select Unit', 'Review Bills', 'Enter Payment', 'Confirm'];
  const canProceedStep0 = !!selectedUnitId && !!preview && !loading;
  const totalDue =
    preview?.billPayments?.reduce((sum, b) => {
      if (excludedBills.includes(b.billPeriod)) return sum;
      const remaining = b.remainingDue ?? b.totalDue ?? 0;
      const waived = waivedPenalties.find((w) => w.billId === b.billPeriod);
      return sum + (remaining - (waived?.amount || 0));
    }, 0) ?? 0;
  const creditBalance = preview?.currentCreditBalance ?? 0;
  const suggestedAmount = Math.max(0, totalDue - creditBalance);

  if (loadingData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <LoadingSpinner size="medium" message="Loading..." />
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          Payment recorded successfully. Redirecting to dashboard...
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Step 1: Select Unit */}
      {activeStep === 0 && (
        <Box>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Unit</InputLabel>
            <Select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              label="Unit"
            >
              {units.map((u) => {
                const uid = u.unitId || u.id;
                const ownerStr = getFirstOwnerLastName(u.owners) || '—';
                return (
                  <MenuItem key={uid} value={uid}>
                    {uid} — {ownerStr}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          {loading && <LoadingSpinner size="small" />}
          {preview && (
            <Button variant="contained" fullWidth onClick={() => setActiveStep(1)} sx={{ mt: 2 }}>
              Continue to Review Bills
            </Button>
          )}
        </Box>
      )}

      {/* Step 2: Review Bills */}
      {activeStep === 1 && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Total Due: {formatPesosForDisplay(totalDue)} · Credit: {formatPesosForDisplay(creditBalance)}
          </Typography>
          <List dense>
            {(preview?.billPayments || []).map((bill) => (
              <Card key={bill.billPeriod} sx={{ mb: 1 }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!excludedBills.includes(bill.billPeriod)}
                          onChange={() => toggleBillExcluded(bill.billPeriod)}
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {bill.billType} · {bill.billPeriod} · {formatPesosForDisplay(bill.totalDue)}
                        </Typography>
                      }
                    />
                    {bill.penaltyDue > 0 && (
                      <Chip
                        size="small"
                        label={waivedPenalties.some((w) => w.billId === bill.billPeriod) ? 'Waived' : 'Waive Penalty'}
                        onClick={() => togglePenaltyWaiver(bill)}
                        color={waivedPenalties.some((w) => w.billId === bill.billPeriod) ? 'success' : 'default'}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </List>
          <Button variant="contained" fullWidth onClick={() => setActiveStep(2)} sx={{ mt: 2 }}>
            Continue to Enter Payment
          </Button>
        </Box>
      )}

      {/* Step 3: Enter Payment */}
      {activeStep === 2 && (
        <Box>
          <TextField
            fullWidth
            label="Amount (MXN)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => fetchPreview(parseFloat(amount) || null)}
            helperText={`Suggested: ${formatPesosForDisplay(suggestedAmount)}`}
            sx={{ mb: 2 }}
            inputProps={{ min: 0, step: 0.01 }}
          />
          <TextField
            fullWidth
            label="Payment Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Payment Method</InputLabel>
            <Select value={paymentMethodId} onChange={handlePaymentMethodChange} label="Payment Method">
              {paymentMethods.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Account to Credit</InputLabel>
            <Select value={accountId} onChange={handleAccountChange} label="Account to Credit">
              {accounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name} ({a.type || 'bank'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Reference (optional)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Notes (optional)"
            multiline
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Button variant="contained" fullWidth onClick={() => setActiveStep(3)} sx={{ mt: 2 }}>
            Continue to Confirm
          </Button>
        </Box>
      )}

      {/* Step 4: Confirm */}
      {activeStep === 3 && (
        <Box>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Unit
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {selectedUnitId}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                Amount
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {formatPesosForDisplay(parseFloat(amount) || 0)}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                Date · Method · Account
              </Typography>
              <Typography variant="body1">
                {paymentDate} · {paymentMethodName} · {accounts.find((a) => a.id === accountId)?.name || accountId}
              </Typography>
            </CardContent>
          </Card>
          <Button
            variant="contained"
            fullWidth
            onClick={handleSubmit}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
        </Box>
      )}

      {activeStep > 0 && (
        <Button sx={{ mt: 2 }} onClick={() => setActiveStep((s) => s - 1)}>
          Back
        </Button>
      )}
    </Box>
  );
};

export default RecordPayment;

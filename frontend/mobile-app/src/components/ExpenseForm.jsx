import React, { useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Chip,
} from '@mui/material';
import { LoadingSpinner } from './common';
import {
  AttachMoney,
  CalendarToday,
  Category,
  Store,
  AccountBalance,
  Payment,
  Notes,
  Send,
  Refresh,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useExpenseForm } from '../hooks/useExpenseForm.jsx';
import { validateClientAccess } from '../services/api';
import { databaseFieldMappings } from '../../../src/utils/databaseFieldMappings';

const ExpenseForm = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  
  const {
    formData,
    clientData,
    loading,
    submitting,
    error,
    fieldErrors,
    updateField,
    submitExpense,
    clearError,
    isValid,
  } = useExpenseForm(clientId);

  // Validate client access on mount
  useEffect(() => {
    const checkAccess = async () => {
      const hasAccess = await validateClientAccess(clientId);
      if (!hasAccess) {
        navigate('/clients');
      }
    };
    
    if (clientId) {
      checkAccess();
    }
  }, [clientId, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    const result = await submitExpense();
    
    if (result) {
      // Navigate to confirmation screen with transaction data
      navigate('/confirmation', { 
        state: { 
          transaction: result,
          clientId: clientId,
        } 
      });
    }
  };

  const handleFieldChange = (field) => (event) => {
    updateField(field, event.target.value);
  };

  const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';
    // Use the utility for consistent formatting
    return databaseFieldMappings.formatCurrency(
      databaseFieldMappings.dollarsToCents(numValue),
      'USD'
    );
  };

  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="calc(100vh - 64px)"
        p={2}
      >
        <LoadingSpinner size="large" message="Loading form data..." />
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          Please wait...
        </Typography>
      </Box>
    );
  }

  if (error && !clientData.categories.length) {
    return (
      <Box p={2}>
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => window.location.reload()}
              startIcon={<Refresh />}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  const paymentMethods = ['Bank', 'Cash', 'Credit Card', 'Check', 'Other'];

  return (
    <Box>
      <form onSubmit={handleSubmit}>
        <Box p={2}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              onClose={clearError}
            >
              {error}
            </Alert>
          )}

          <Card>
            <CardContent className="mobile-form">
              {/* Date Field */}
              <Box className="form-group">
                <TextField
                  fullWidth
                  type="date"
                  label="Date"
                  value={formData.date}
                  onChange={handleFieldChange('date')}
                  disabled={submitting}
                  error={!!fieldErrors.date}
                  helperText={fieldErrors.date}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarToday color="action" />
                      </InputAdornment>
                    ),
                    className: 'mobile-input',
                  }}
                  InputLabelProps={{
                    shrink: true,
                  }}
                />
              </Box>

              {/* Amount Field */}
              <Box className="form-group">
                <TextField
                  fullWidth
                  type="number"
                  label="Amount"
                  value={formData.amount}
                  onChange={handleFieldChange('amount')}
                  disabled={submitting}
                  error={!!fieldErrors.amount}
                  helperText={fieldErrors.amount || (formData.amount && `$${formatCurrency(formData.amount)}`)}
                  inputProps={{
                    min: "0",
                    step: "0.01",
                    inputMode: "decimal",
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AttachMoney color="action" />
                      </InputAdornment>
                    ),
                    className: 'mobile-input',
                  }}
                />
              </Box>

              {/* Category Field */}
              <Box className="form-group">
                <FormControl 
                  fullWidth 
                  error={!!fieldErrors.category}
                  disabled={submitting}
                >
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={handleFieldChange('category')}
                    label="Category"
                    startAdornment={
                      <InputAdornment position="start">
                        <Category color="action" />
                      </InputAdornment>
                    }
                    className="mobile-input"
                  >
                    {clientData.categories.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.category && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {fieldErrors.category}
                    </Typography>
                  )}
                </FormControl>
              </Box>

              {/* Vendor Field */}
              <Box className="form-group">
                <FormControl 
                  fullWidth 
                  error={!!fieldErrors.vendor}
                  disabled={submitting}
                >
                  <InputLabel>Vendor</InputLabel>
                  <Select
                    value={formData.vendor}
                    onChange={handleFieldChange('vendor')}
                    label="Vendor"
                    startAdornment={
                      <InputAdornment position="start">
                        <Store color="action" />
                      </InputAdornment>
                    }
                    className="mobile-input"
                  >
                    {clientData.vendors.map((vendor) => (
                      <MenuItem key={vendor} value={vendor}>
                        {vendor}
                      </MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.vendor && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {fieldErrors.vendor}
                    </Typography>
                  )}
                </FormControl>
              </Box>

              {/* Account Field */}
              <Box className="form-group">
                <FormControl 
                  fullWidth 
                  error={!!fieldErrors.account}
                  disabled={submitting}
                >
                  <InputLabel>Account</InputLabel>
                  <Select
                    value={formData.account}
                    onChange={handleFieldChange('account')}
                    label="Account"
                    startAdornment={
                      <InputAdornment position="start">
                        <AccountBalance color="action" />
                      </InputAdornment>
                    }
                    className="mobile-input"
                  >
                    {clientData.accounts.map((account) => (
                      <MenuItem key={account} value={account}>
                        {account}
                      </MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.account && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {fieldErrors.account}
                    </Typography>
                  )}
                </FormControl>
              </Box>

              {/* Payment Method Field */}
              <Box className="form-group">
                <FormControl 
                  fullWidth 
                  error={!!fieldErrors.paymentMethod}
                  disabled={submitting}
                >
                  <InputLabel>Payment Method</InputLabel>
                  <Select
                    value={formData.paymentMethod}
                    onChange={handleFieldChange('paymentMethod')}
                    label="Payment Method"
                    startAdornment={
                      <InputAdornment position="start">
                        <Payment color="action" />
                      </InputAdornment>
                    }
                    className="mobile-input"
                  >
                    {paymentMethods.map((method) => (
                      <MenuItem key={method} value={method}>
                        {method}
                      </MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.paymentMethod && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                      {fieldErrors.paymentMethod}
                    </Typography>
                  )}
                </FormControl>
              </Box>

              {/* Notes Field */}
              <Box className="form-group">
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Notes (Optional)"
                  value={formData.notes}
                  onChange={handleFieldChange('notes')}
                  disabled={submitting}
                  placeholder="Add any additional details about this expense..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                        <Notes color="action" />
                      </InputAdornment>
                    ),
                    className: 'mobile-input',
                  }}
                />
              </Box>
            </CardContent>
          </Card>

          {/* Data Summary */}
          {isValid && (
            <Card sx={{ mt: 2, backgroundColor: '#f8f9fa' }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Expense Summary
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  <Chip 
                    label={`$${formatCurrency(formData.amount)}`} 
                    color="primary" 
                    size="small" 
                  />
                  <Chip 
                    label={formData.category} 
                    variant="outlined" 
                    size="small" 
                  />
                  <Chip 
                    label={formData.vendor} 
                    variant="outlined" 
                    size="small" 
                  />
                  <Chip 
                    label={formData.account} 
                    variant="outlined" 
                    size="small" 
                  />
                  <Chip 
                    label={formData.paymentMethod} 
                    variant="outlined" 
                    size="small" 
                  />
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Submit Button */}
        <Box className="action-buttons" sx={{ position: 'sticky', bottom: 0, backgroundColor: 'white', py: 2 }}>
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={!isValid || submitting}
            startIcon={submitting ? <LoadingSpinner size="small" /> : <Send />}
            className="action-button"
            sx={{
              py: 1.5,
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            {submitting ? 'Creating Expense...' : 'Create Expense'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default ExpenseForm;

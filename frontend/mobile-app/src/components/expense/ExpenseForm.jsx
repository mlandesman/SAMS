import React, { useState, useEffect } from 'react';
import { getMexicoDateString } from '../../utils/timezone';
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
  IconButton,
  Divider,
} from '@mui/material';
// Use mobile app's SAMS-branded LoadingSpinner
import { LoadingSpinner } from '../common';
import {
  AttachMoney,
  CalendarToday,
  Category,
  Store,
  Notes,
  Send,
  Close,
  ArrowBack,
  AttachFile,
} from '@mui/icons-material';
import { clientAPI } from '../../services/api';
import { DocumentUploader } from '../documents';

const ExpenseForm = ({ clientId, onSubmit, onCancel, samsUser }) => {
  console.log('📝 ExpenseForm initialized with clientId:', clientId, 'samsUser:', samsUser?.email);
  const [formData, setFormData] = useState({
    date: getMexicoDateString(), // Use Mexico timezone
    amount: '',
    category: '',
    vendor: '',
    notes: '',
    account: '',
    paymentMethod: '',
  });

  const [clientData, setClientData] = useState({
    categories: [],
    vendors: [],
    accounts: [],
    paymentMethods: [],
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Document upload state - use local state for deferred upload
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [documentUploadError, setDocumentUploadError] = useState(null);

  // Load client data
  useEffect(() => {
    const loadClientData = async () => {
      if (!clientId) return;
      
      try {
        setLoading(true);
        setError(null);

        console.log('🔄 Loading client data for clientId:', clientId);

        const [categories, vendors, accounts, paymentMethods] = await Promise.all([
          clientAPI.getCategories(clientId),
          clientAPI.getVendors(clientId),
          clientAPI.getAccounts(clientId),
          clientAPI.getPaymentMethods(clientId),
        ]);

        console.log('📋 Raw API responses:', { categories, vendors, accounts, paymentMethods });

        // Handle different API response formats:
        // - Some return {success: true, data: [...]}
        // - Others return [...] directly (like accounts)
        const rawCategories = categories.data || categories.categories || categories || [];
        const rawVendors = vendors.data || vendors.vendors || vendors || [];
        const rawAccounts = accounts.data || accounts.accounts || accounts || []; // accounts returns direct array
        const rawPaymentMethods = paymentMethods.data || paymentMethods.paymentMethods || paymentMethods || [];

        console.log('🔍 Raw data inspection:', { 
          rawCategories: rawCategories.slice(0, 2), 
          rawVendors: rawVendors.slice(0, 2), 
          rawAccounts, // Show ALL accounts, not just first 2
          rawPaymentMethods: rawPaymentMethods.slice(0, 2) 
        });

        // Extract names from objects or use strings directly, then sort alphabetically
        const processedData = {
          categories: rawCategories
            .map(item => typeof item === 'string' ? item : item.name || item.id || String(item))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
          vendors: rawVendors
            .map(item => typeof item === 'string' ? item : item.name || item.id || String(item))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
          accounts: rawAccounts.map(item => {
            if (typeof item === 'string') return item;
            // For accounts, use the actual name from Firestore, fallback to id if no name
            const accountName = item.name || item.id || `Account ${item.type || 'Unknown'}`;
            console.log('🏦 Processing account:', item, '→', accountName);
            return accountName;
          }).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
          paymentMethods: rawPaymentMethods
            .map(item => typeof item === 'string' ? item : item.name || item.id || String(item))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        };

        // Fallback for payment methods if empty
        if (processedData.paymentMethods.length === 0) {
          processedData.paymentMethods = ['Bank', 'Cash', 'Check', 'Credit Card'].sort();
        }

        // Remove fake fallback for accounts - use real data or show error
        if (processedData.accounts.length === 0) {
          console.error('❌ No accounts returned from API - this will prevent expense submission');
        }

        console.log('✅ Processed client data:', processedData);

        setClientData(processedData);

        // Auto-select first account if only one
        if (processedData.accounts.length === 1) {
          console.log('🏦 Auto-selecting single account:', processedData.accounts[0]);
          setFormData(prev => ({ ...prev, account: processedData.accounts[0] }));
        }

      } catch (error) {
        console.error('Failed to load client data:', error);
        setError('Failed to load form data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadClientData();
  }, [clientId]);

  const validateForm = () => {
    const errors = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = 'Amount is required and must be greater than 0';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }

    if (!formData.vendor) {
      errors.vendor = 'Vendor is required';
    }

    // Notes are optional - no validation required

    if (!formData.account) {
      errors.account = 'Account is required';
    }

    if (!formData.paymentMethod) {
      errors.paymentMethod = 'Payment method is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldChange = (field) => (event) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Document handling functions for deferred upload
  const handleFilesSelected = (files) => {
    console.log('📎 Files selected for expense:', files.map(f => f.name));
    setSelectedFiles(files);
    setDocumentUploadError(null);
  };

  const handleFileRemove = (index) => {
    console.log('�️ Removing file at index:', index);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setDocumentUploadError(null);
  };

  // Handle document upload error
  const handleDocumentUploadError = (error) => {
    console.error('📄 Document upload failed:', error);
    setDocumentUploadError(error.message || 'Failed to upload document');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      console.log('💰 Starting atomic expense submission for clientId:', clientId);
      console.log('📄 Selected files for upload:', selectedFiles.map(f => f.name));

      // Step 1: Upload documents if any are selected
      let uploadedDocuments = [];
      if (selectedFiles.length > 0) {
        console.log('📤 Uploading documents first...');
        uploadedDocuments = await clientAPI.uploadDocumentsForTransaction(
          clientId, 
          selectedFiles, 
          'receipt', 
          'expense_receipt'
        );
        console.log('✅ Documents uploaded:', uploadedDocuments.map(d => d.id));
      }

      // Step 2: Create transaction with document references
      const transactionData = {
        date: formData.date,
        amount: -Math.abs(parseFloat(formData.amount)),
        category: formData.category,
        vendor: formData.vendor,
        notes: formData.notes,
        account: formData.account,
        paymentMethod: formData.paymentMethod,
        type: 'expense',
        enteredBy: samsUser?.email || 'mobile-user',
        documents: uploadedDocuments.map(doc => doc.id), // Include document references
      };

      console.log('📄 Creating transaction with data:', transactionData);
      const transactionResult = await clientAPI.createTransaction(clientId, transactionData);
      const transaction = transactionResult.transaction || transactionResult.data || transactionResult;
      console.log('✅ Transaction created:', transaction.id);

      // Step 3: Link documents to transaction
      if (uploadedDocuments.length > 0) {
        console.log('🔗 Linking documents to transaction...');
        await clientAPI.linkDocumentsToTransaction(
          clientId, 
          uploadedDocuments.map(d => d.id), 
          transaction.id
        );
        console.log('✅ Documents linked to transaction');
      }
      
      console.log('✅ Atomic expense submission complete');
      
      // Reset form
      setFormData({
        date: getMexicoDateString(), // Use Mexico timezone
        amount: '',
        category: '',
        vendor: '',
        notes: '',
        account: clientData.accounts.length === 1 ? clientData.accounts[0] : '',
        paymentMethod: '',
      });
      
      // Reset document state
      setSelectedFiles([]);
      setDocumentUploadError(null);

      // Pass the result with proper structure for ExpenseConfirmation
      onSubmit({
        transaction: transaction,
        success: true,
        documentsUploaded: uploadedDocuments.length
      });

    } catch (error) {
      console.error('❌ Failed to submit expense:', error);
      setError(error.message || 'Failed to submit expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value) => {
    const numValue = parseFloat(value);
    return isNaN(numValue) ? '' : numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (loading) {
    return (
      <Box className="expense-form-loading">
        <Card>
          <CardContent>
            <LoadingSpinner message="Loading form data..." size="medium" />
          </CardContent>
        </Card>
      </Box>
    );
  }

  const clientName = samsUser?.clientAccess?.[clientId]?.clientName || clientId;

  return (
    <Box className="expense-form">
      <Card>
        <CardContent>
          {/* Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center">
              <IconButton
                onClick={onCancel}
                edge="start"
                sx={{ mr: 1 }}
              >
                <ArrowBack />
              </IconButton>
              <Box>
                <Typography variant="h6">Add Expense</Typography>
                <Typography variant="body2" color="text.secondary">
                  {clientName}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={onCancel} size="small">
              <Close />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {/* Amount - Most important field first */}
            <Box className="form-group" mb={3}>
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
                      <AttachMoney color="primary" />
                    </InputAdornment>
                  ),
                  style: { fontSize: '18px' },
                }}
                sx={{
                  '& .MuiInputBase-root': { minHeight: '56px' },
                  '& .MuiInputBase-input': { fontSize: '18px' },
                }}
              />
            </Box>

            {/* Date */}
            <Box className="form-group" mb={3}>
              <TextField
                fullWidth
                type="date"
                label="Date"
                value={formData.date}
                onChange={handleFieldChange('date')}
                disabled={submitting}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarToday color="action" />
                    </InputAdornment>
                  ),
                }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            {/* Category */}
            <Box className="form-group" mb={3}>
              <FormControl fullWidth error={!!fieldErrors.category}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={handleFieldChange('category')}
                  label="Category"
                  disabled={submitting}
                  startAdornment={
                    <InputAdornment position="start">
                      <Category color="action" />
                    </InputAdornment>
                  }                  >
                    {clientData.categories.map((category, index) => (
                      <MenuItem key={`category-${index}`} value={category}>
                        {String(category)}
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

            {/* Vendor */}
            <Box className="form-group" mb={3}>
              <FormControl fullWidth error={!!fieldErrors.vendor}>
                <InputLabel>Vendor</InputLabel>
                <Select
                  value={formData.vendor}
                  onChange={handleFieldChange('vendor')}
                  label="Vendor"
                  disabled={submitting}
                  startAdornment={
                    <InputAdornment position="start">
                      <Store color="action" />
                    </InputAdornment>
                  }                  >
                    {clientData.vendors.map((vendor, index) => (
                      <MenuItem key={`vendor-${index}`} value={vendor}>
                        {String(vendor)}
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

            {/* Notes */}
            <Box className="form-group" mb={3}>
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes}
                onChange={handleFieldChange('notes')}
                disabled={submitting}
                error={!!fieldErrors.notes}
                helperText={fieldErrors.notes}
                multiline
                rows={2}
                placeholder="Add any additional details about this expense..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                      <Notes color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Document Attachments */}
            <Box className="form-group" mb={3}>
              <Typography
                variant="body2"
                sx={{
                  mb: 1,
                  color: 'text.secondary',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <AttachFile color="action" />
                Receipt Attachments (Optional)
              </Typography>
              
              {documentUploadError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {documentUploadError}
                </Alert>
              )}
              
              <DocumentUploader
                clientId={clientId}
                uploadMode="deferred"
                selectedFiles={selectedFiles}
                onFilesSelected={handleFilesSelected}
                onFileRemove={handleFileRemove}
                onUploadError={handleDocumentUploadError}
                disabled={submitting}
                multiple={true}
                allowedTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']}
              />
            </Box>

            {/* Account */}
            <Box className="form-group" mb={3}>
              <FormControl fullWidth error={!!fieldErrors.account}>
                <InputLabel>Account</InputLabel>
                <Select
                  value={formData.account}
                  onChange={handleFieldChange('account')}
                  label="Account"
                  disabled={submitting}
                >
                  {clientData.accounts.map((account, index) => (
                    <MenuItem key={`account-${index}`} value={account}>
                      {String(account)}
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

            {/* Payment Method */}
            <Box className="form-group" mb={4}>
              <FormControl fullWidth error={!!fieldErrors.paymentMethod}>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={formData.paymentMethod}
                  onChange={handleFieldChange('paymentMethod')}
                  label="Payment Method"
                  disabled={submitting}
                >
                  {clientData.paymentMethods.map((method, index) => (
                    <MenuItem key={`payment-${index}`} value={method}>
                      {String(method)}
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

            {/* Submit Button */}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting}
              startIcon={submitting ? <LoadingSpinner size="small" show={true} /> : <Send />}
              sx={{
                minHeight: '56px',
                fontSize: '16px',
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                },
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Expense'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ExpenseForm;

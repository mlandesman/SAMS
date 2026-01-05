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
  FormControlLabel,
  Checkbox,
  Chip,
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
  AccountBalance,
} from '@mui/icons-material';
import { clientAPI } from '../../services/api';
import { DocumentUploader } from '../documents';

/**
 * ExpenseForm - Mobile expense entry form
 * 
 * Features:
 * - ID-first architecture (stores IDs, displays names)
 * - Auto-populate category from vendor's default category
 * - Bank fees checkbox (adds $5.00 commission + $0.80 IVA)
 * - Split allocations support
 * - Document attachments
 */
const ExpenseForm = ({ clientId, onSubmit, onCancel, samsUser }) => {
  console.log('📝 ExpenseForm initialized with clientId:', clientId, 'samsUser:', samsUser?.email);
  
  // Form state - ID-first architecture
  const [formData, setFormData] = useState({
    date: getMexicoDateString(), // Use Mexico timezone
    amount: '',
    categoryId: '',    // Store category ID
    vendorId: '',      // Store vendor ID
    notes: '',
    accountId: '',     // Store account ID
    paymentMethodId: '', // Store payment method ID
  });

  // Client data with full objects (id + name)
  const [clientData, setClientData] = useState({
    categories: [],     // Array of {id, name}
    vendors: [],        // Array of {id, name, category}
    accounts: [],       // Array of {id, name, type}
    paymentMethods: [], // Array of {id, name}
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Bank fees checkbox (for bank transfer expenses)
  const [addBankFees, setAddBankFees] = useState(false);
  
  // Split allocations state
  const [splitAllocations, setSplitAllocations] = useState([]);
  
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

        // Handle different API response formats
        const rawCategories = categories.data || categories.categories || categories || [];
        const rawVendors = vendors.data || vendors.vendors || vendors || [];
        const rawAccounts = accounts.data || accounts.accounts || accounts || [];
        const rawPaymentMethods = paymentMethods.data || paymentMethods.paymentMethods || paymentMethods || [];

        // Helper function to extract ID+name objects from API responses
        const extractIdNameObject = (item, fallbackPrefix = 'Unknown') => {
          if (typeof item === 'string') {
            return {
              id: item.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              name: item
            };
          }
          if (item && typeof item === 'object') {
            return {
              id: item.id || item.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown',
              name: item.name || item.id || `${fallbackPrefix} Item`,
              // Preserve additional fields
              ...item
            };
          }
          return {
            id: String(item).toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: String(item)
          };
        };

        // Process data into ID+name objects
        const processedData = {
          categories: rawCategories
            .map(item => extractIdNameObject(item, 'Category'))
            .filter(obj => obj.name && !obj.name.includes('Unknown'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
          vendors: rawVendors
            .map(item => ({
              ...extractIdNameObject(item, 'Vendor'),
              category: item.category || '' // Preserve vendor's default category
            }))
            .filter(obj => obj.name && !obj.name.includes('Unknown'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
          accounts: rawAccounts
            .map(item => ({
              ...extractIdNameObject(item, 'Account'),
              type: item.type || 'bank'
            }))
            .filter(obj => obj.name && !obj.name.includes('Unknown'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
          paymentMethods: rawPaymentMethods
            .filter(item => {
              // Only show active payment methods
              if (typeof item === 'object' && item !== null) {
                return item.status === 'active' || item.status === undefined;
              }
              return true;
            })
            .map(item => extractIdNameObject(item, 'Payment'))
            .filter(obj => obj.name && !obj.name.includes('Unknown'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        };

        // Fallback for payment methods if empty
        if (processedData.paymentMethods.length === 0) {
          processedData.paymentMethods = [
            { id: 'bank', name: 'Bank' },
            { id: 'cash', name: 'Cash' },
            { id: 'check', name: 'Check' },
            { id: 'credit-card', name: 'Credit Card' }
          ];
        }

        console.log('✅ Processed client data:', processedData);
        setClientData(processedData);

        // Set default account to bank-001 if it exists, otherwise first bank account
        const defaultAccount = processedData.accounts.find(a => a.id === 'bank-001') 
          || processedData.accounts.find(a => a.type === 'bank')
          || processedData.accounts[0];
        
        // Set default payment method to eTransfer if it exists
        const defaultPaymentMethod = processedData.paymentMethods.find(p => 
          p.id === 'etransfer' || p.name?.toLowerCase() === 'etransfer'
        ) || processedData.paymentMethods[0];

        if (defaultAccount || defaultPaymentMethod) {
          console.log('🏦 Setting defaults - Account:', defaultAccount?.name, 'Payment:', defaultPaymentMethod?.name);
          setFormData(prev => ({
            ...prev,
            accountId: defaultAccount?.id || prev.accountId,
            paymentMethodId: defaultPaymentMethod?.id || prev.paymentMethodId,
          }));
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

  // Handle vendor change - auto-populate category if vendor has default
  const handleVendorChange = (vendorId) => {
    setFormData(prev => ({ ...prev, vendorId }));
    
    // Clear vendor field error
    if (fieldErrors.vendorId) {
      setFieldErrors(prev => ({ ...prev, vendorId: null }));
    }
    
    // Find the selected vendor
    const selectedVendor = clientData.vendors.find(v => v.id === vendorId);
    
    if (selectedVendor?.category) {
      // Find the category ID matching vendor's default category
      const matchingCategory = clientData.categories.find(
        c => c.name.toLowerCase() === selectedVendor.category.toLowerCase() ||
             c.id === selectedVendor.category
      );
      
      if (matchingCategory) {
        console.log('🏷️ Auto-populating category from vendor:', matchingCategory.name);
        setFormData(prev => ({ 
          ...prev, 
          vendorId,
          categoryId: matchingCategory.id 
        }));
      }
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = 'Amount is required and must be greater than 0';
    }

    // Only require category if no split allocations and not adding bank fees
    if (splitAllocations.length === 0 && !addBankFees && !formData.categoryId) {
      errors.categoryId = 'Category is required';
    }

    if (!formData.vendorId) {
      errors.vendorId = 'Vendor is required';
    }

    if (!formData.accountId) {
      errors.accountId = 'Account is required';
    }

    if (!formData.paymentMethodId) {
      errors.paymentMethodId = 'Payment method is required';
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
    console.log('🗑️ Removing file at index:', index);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setDocumentUploadError(null);
  };

  const handleDocumentUploadError = (error) => {
    console.error('📄 Document upload failed:', error);
    setDocumentUploadError(error.message || 'Failed to upload document');
  };

  // Calculate total with bank fees
  const getTotalWithFees = () => {
    const baseAmount = parseFloat(formData.amount) || 0;
    if (addBankFees) {
      return baseAmount + 5.00 + 0.80; // Commission + IVA
    }
    return baseAmount;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      console.log('💰 Starting expense submission for clientId:', clientId);
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

      // Resolve IDs to names for the transaction
      const selectedVendor = clientData.vendors.find(v => v.id === formData.vendorId);
      const selectedCategory = clientData.categories.find(c => c.id === formData.categoryId);
      const selectedAccount = clientData.accounts.find(a => a.id === formData.accountId);
      const selectedPaymentMethod = clientData.paymentMethods.find(p => p.id === formData.paymentMethodId);

      // Build base transaction data - using ID-first architecture field names
      let transactionData = {
        date: formData.date,
        amount: -Math.abs(parseFloat(formData.amount)),
        vendorId: formData.vendorId,
        vendorName: selectedVendor?.name || '',
        notes: formData.notes,
        accountId: formData.accountId,
        accountName: selectedAccount?.name || '',
        accountType: selectedAccount?.type || 'bank',
        paymentMethodId: formData.paymentMethodId,
        paymentMethod: selectedPaymentMethod?.name || '',
        type: 'expense',
        enteredBy: samsUser?.email || 'mobile-user',
        documents: uploadedDocuments.map(doc => doc.id),
      };

      // Handle bank fees - auto-create split allocations
      if (addBankFees) {
        const originalAmount = parseFloat(formData.amount);
        const commissionAmount = 5.00;
        const ivaAmount = 0.80;
        const totalAmount = originalAmount + commissionAmount + ivaAmount;
        
        transactionData.categoryId = '-split-';
        transactionData.categoryName = '-Split-';
        transactionData.amount = -Math.abs(totalAmount);
        transactionData.notes = (formData.notes ? formData.notes + ' ' : '') + '(includes transfer fees)';
        transactionData.allocations = [
          {
            categoryName: selectedCategory?.name || 'General',
            amount: -Math.abs(originalAmount),
            notes: 'Main expense'
          },
          {
            categoryName: 'Bank: Commission Charges',
            amount: -Math.abs(commissionAmount),
            notes: 'Bank transfer fee'
          },
          {
            categoryName: 'Bank: IVA',
            amount: -Math.abs(ivaAmount),
            notes: 'Bank transfer IVA'
          }
        ];
        console.log('💰 Auto-created bank fee allocations:', transactionData.allocations);
      } else if (splitAllocations.length > 0) {
        // Use existing split allocations
        transactionData.categoryId = '-split-';
        transactionData.categoryName = '-Split-';
        transactionData.allocations = splitAllocations;
      } else {
        // Single category transaction
        transactionData.categoryId = formData.categoryId;
        transactionData.categoryName = selectedCategory?.name || '';
      }

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
      
      console.log('✅ Expense submission complete');
      
      // Reset form
      setFormData({
        date: getMexicoDateString(),
        amount: '',
        categoryId: '',
        vendorId: '',
        notes: '',
        accountId: clientData.accounts.length === 1 ? clientData.accounts[0].id : '',
        paymentMethodId: '',
      });
      setAddBankFees(false);
      setSplitAllocations([]);
      setSelectedFiles([]);
      setDocumentUploadError(null);

      // Pass the result with proper structure for ExpenseConfirmation
      onSubmit({
        transaction: transaction,
        success: true,
        documentsUploaded: uploadedDocuments.length,
        includedBankFees: addBankFees
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

  // Get display names for selected IDs
  const getVendorName = (id) => clientData.vendors.find(v => v.id === id)?.name || '';
  const getCategoryName = (id) => clientData.categories.find(c => c.id === id)?.name || '';
  const getAccountName = (id) => clientData.accounts.find(a => a.id === id)?.name || '';
  const getPaymentMethodName = (id) => clientData.paymentMethods.find(p => p.id === id)?.name || '';

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
                helperText={
                  fieldErrors.amount || 
                  (formData.amount && addBankFees 
                    ? `$${formatCurrency(formData.amount)} + $5.80 fees = $${formatCurrency(getTotalWithFees())}`
                    : formData.amount && `$${formatCurrency(formData.amount)}`
                  )
                }
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

            {/* Vendor - Moved before Category for auto-population */}
            <Box className="form-group" mb={3}>
              <FormControl fullWidth error={!!fieldErrors.vendorId}>
                <InputLabel>Vendor</InputLabel>
                <Select
                  value={formData.vendorId}
                  onChange={(e) => handleVendorChange(e.target.value)}
                  label="Vendor"
                  disabled={submitting}
                  startAdornment={
                    <InputAdornment position="start">
                      <Store color="action" />
                    </InputAdornment>
                  }
                >
                  {clientData.vendors.map((vendor) => (
                    <MenuItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                      {vendor.category && (
                        <Typography 
                          component="span" 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ ml: 1 }}
                        >
                          ({vendor.category})
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.vendorId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {fieldErrors.vendorId}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Category */}
            <Box className="form-group" mb={3}>
              <FormControl fullWidth error={!!fieldErrors.categoryId}>
                <InputLabel>Category</InputLabel>
                {(addBankFees || splitAllocations.length > 0) ? (
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip 
                      label={addBankFees ? '-Split- (with fees)' : '-Split-'} 
                      color="primary" 
                      variant="outlined"
                      icon={<Category />}
                    />
                    {addBankFees && (
                      <Typography variant="caption" color="text.secondary">
                        Expense + $5.00 commission + $0.80 IVA
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Select
                    value={formData.categoryId}
                    onChange={handleFieldChange('categoryId')}
                    label="Category"
                    disabled={submitting}
                    startAdornment={
                      <InputAdornment position="start">
                        <Category color="action" />
                      </InputAdornment>
                    }
                  >
                    {clientData.categories.map((category) => (
                      <MenuItem key={category.id} value={category.id}>
                        {category.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
                {fieldErrors.categoryId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {fieldErrors.categoryId}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Account */}
            <Box className="form-group" mb={3}>
              <FormControl fullWidth error={!!fieldErrors.accountId}>
                <InputLabel>Account</InputLabel>
                <Select
                  value={formData.accountId}
                  onChange={handleFieldChange('accountId')}
                  label="Account"
                  disabled={submitting}
                  startAdornment={
                    <InputAdornment position="start">
                      <AccountBalance color="action" />
                    </InputAdornment>
                  }
                >
                  {clientData.accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.accountId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {fieldErrors.accountId}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Payment Method */}
            <Box className="form-group" mb={3}>
              <FormControl fullWidth error={!!fieldErrors.paymentMethodId}>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={formData.paymentMethodId}
                  onChange={handleFieldChange('paymentMethodId')}
                  label="Payment Method"
                  disabled={submitting}
                >
                  {clientData.paymentMethods.map((method) => (
                    <MenuItem key={method.id} value={method.id}>
                      {method.name}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.paymentMethodId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {fieldErrors.paymentMethodId}
                  </Typography>
                )}
              </FormControl>
            </Box>

            {/* Bank Fees Checkbox */}
            <Box className="form-group" mb={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={addBankFees}
                    onChange={(e) => {
                      setAddBankFees(e.target.checked);
                      // Clear split allocations if enabling bank fees
                      if (e.target.checked) {
                        setSplitAllocations([]);
                      }
                    }}
                    disabled={submitting || splitAllocations.length > 0}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2">
                      Add Bank Transfer Fees
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Adds $5.00 commission + $0.80 IVA
                    </Typography>
                  </Box>
                }
              />
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
              {submitting 
                ? 'Submitting...' 
                : addBankFees 
                  ? `Submit Expense ($${formatCurrency(getTotalWithFees())})` 
                  : 'Submit Expense'
              }
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ExpenseForm;

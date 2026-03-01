import { useState, useEffect } from 'react';
import { getClientData, createExpense, cacheManager } from '../services/api';
import { databaseFieldMappings } from '@/utils/databaseFieldMappings.js';

export const useExpenseForm = (clientId) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    amount: '',
    category: '',
    vendor: '',
    account: '',
    paymentMethod: 'Bank',
    notes: '',
  });

  const [clientData, setClientData] = useState({
    categories: [],
    vendors: [],
    accounts: [],
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Load client data and cached form data
  useEffect(() => {
    if (!clientId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to get cached client data first
        let data = cacheManager.getCachedClientData(clientId);
        
        if (!data) {
          // Fetch fresh data if not cached
          data = await getClientData(clientId);
          // Cache the fresh data
          cacheManager.cacheClientData(clientId, data);
        }

        setClientData(data);

        // Load cached form data if available
        const cachedForm = cacheManager.getCachedFormData();
        if (cachedForm && cachedForm.clientId === clientId) {
          setFormData(prev => ({
            ...prev,
            ...cachedForm,
            // Always use today's date unless specifically set
            date: cachedForm.date || prev.date,
          }));
        }

        console.log('Client data loaded:', {
          categories: data.categories.length,
          vendors: data.vendors.length,
          accounts: data.accounts.length,
        });

      } catch (error) {
        console.error('Error loading client data:', error);
        let errorMessage = 'Failed to load form data. Please try again.';
        
        if (error.code === 'NETWORK_ERROR') {
          errorMessage = 'Network error. Please check your connection.';
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clientId]);

  // Auto-save form data to cache when it changes
  useEffect(() => {
    if (clientId && !loading) {
      const dataToCache = { ...formData, clientId };
      cacheManager.cacheFormData(dataToCache);
    }
  }, [formData, clientId, loading]);

  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear field-specific error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.date) {
      errors.date = 'Date is required';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }
    
    // Validate amount format
    if (formData.amount && !databaseFieldMappings.validateAmount(formData.amount)) {
      errors.amount = 'Invalid amount format';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }

    if (!formData.vendor) {
      errors.vendor = 'Vendor is required';
    }

    if (!formData.account) {
      errors.account = 'Account is required';
    }

    if (!formData.paymentMethod) {
      errors.paymentMethod = 'Payment method is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitExpense = async () => {
    if (!validateForm()) {
      setError('Please fix the errors below');
      return null;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Prepare expense data in the format expected by SAMS API
      const expenseData = {
        date: formData.date,
        amount: parseFloat(formData.amount), // Backend expects dollars
        category: formData.category, // Use string, not ID
        vendor: formData.vendor, // Use string, not ID
        account: formData.account,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes.trim() || undefined,
        type: 'expense', // Explicitly set as expense
        clientId: clientId,
      };

      console.log('Submitting expense:', expenseData);
      
      const result = await createExpense(clientId, expenseData);
      
      console.log('Expense created successfully:', result);

      // Clear form cache after successful submission
      cacheManager.clearFormCache();

      return result;

    } catch (error) {
      console.error('Error submitting expense:', error);
      
      let errorMessage = 'Failed to create expense. Please try again.';
      
      if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.code === 'VALIDATION_ERROR' && error.field) {
        // Handle specific field validation errors from the API
        setFieldErrors(prev => ({
          ...prev,
          [error.field]: error.message,
        }));
        errorMessage = 'Please fix the errors below';
      } else if (error.status === 400) {
        errorMessage = error.message || 'Invalid expense data. Please check your entries.';
      } else if (error.status === 403) {
        errorMessage = 'You do not have permission to create expenses for this client.';
      }
      
      setError(errorMessage);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: '',
      vendor: '',
      account: '',
      paymentMethod: 'Bank',
      notes: '',
    });
    setFieldErrors({});
    setError(null);
    cacheManager.clearFormCache();
  };

  const clearError = () => {
    setError(null);
    setFieldErrors({});
  };

  return {
    formData,
    clientData,
    loading,
    submitting,
    error,
    fieldErrors,
    updateField,
    submitExpense,
    resetForm,
    clearError,
    isValid: Object.keys(fieldErrors).length === 0 && 
             formData.date && 
             formData.amount && 
             parseFloat(formData.amount) > 0 &&
             formData.category && 
             formData.vendor && 
             formData.account,
  };
};

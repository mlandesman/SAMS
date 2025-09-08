/**
 * Unified Expense Entry Component
 * Works in both modal (desktop) and full-screen (mobile/PWA) modes
 * Based on the proven PWA ExpenseForm implementation
 */

import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { clientAPI } from '../api/client';
import { getCurrentUser } from '../firebaseClient';
import { DocumentUploader } from './documents';
import { getMexicoDateString } from '../utils/timezone';
import './UnifiedExpenseEntry.css';

const UnifiedExpenseEntry = ({ 
  mode = 'modal', // 'modal' or 'screen'
  isOpen = true,
  onClose,
  onSubmit,
  initialData = null,
  clientId: propClientId = null,
  samsUser = null
}) => {
  const { selectedClient } = useClient();
  
  // Determine the client to use
  const clientId = propClientId || selectedClient?.id;
  const clientName = selectedClient?.name || selectedClient?.displayName || clientId;
  
  // Get the current authenticated user
  const currentUser = getCurrentUser();
  const userEmail = samsUser?.email || currentUser?.email || 'unknown-user';

  // Form state - matching PWA structure
  const [formData, setFormData] = useState({
    date: getMexicoDateString(), // Use Mexico timezone for consistent date
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

  const [rawAccountData, setRawAccountData] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Document upload state - use local state for deferred upload
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Confirmation modal state - removed, now handled by parent component

  // Simple handlers for now
  const handleCancel = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop itself, not the modal content
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  // Validation function matching PWA logic
  const validateForm = () => {
    const errors = {};
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }
    
    if (!formData.category.trim()) {
      errors.category = 'Category is required';
    }
    
    if (!formData.vendor.trim()) {
      errors.vendor = 'Vendor is required';
    }
    
    if (!formData.account) {
      errors.account = 'Account is required';
    }
    
    if (!formData.paymentMethod) {
      errors.paymentMethod = 'Payment method is required';
    }
    
    if (!formData.date) {
      errors.date = 'Date is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      console.log('� Starting atomic expense submission for clientId:', clientId);
      console.log('� Selected files for upload:', selectedFiles.map(f => f.name));

      // Use the onSubmit callback if provided (modal mode)
      if (onSubmit) {
        // In modal mode, pass the raw data and let the parent handle the atomic workflow
        const transactionData = {
          date: new Date(formData.date + 'T12:00:00.000Z'), // Convert to proper timestamp
          amount: -Math.abs(parseFloat(formData.amount)), // Ensure negative for expenses
          categoryName: formData.category,
          vendorName: formData.vendor,
          notes: formData.notes,
          accountName: formData.account,
          paymentMethod: formData.paymentMethod,
          type: 'expense',
          clientId: clientId,
          enteredBy: userEmail,
        };

        // Only include documents array if there are files to upload
        if (selectedFiles.length > 0) {
          transactionData.documents = selectedFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            file: file, // Keep the file object for upload
          }));
        }

        console.log('📤 Passing transaction data to parent:', transactionData);
        await onSubmit(transactionData);
        
        // Parent (TransactionsView) will handle the success modal to survive remounts
        console.log('✅ Parent submission complete - success modal handled by parent');
        
      } else {
        // Direct API submission mode (for standalone use) - implement atomic workflow
        console.log('🔄 Direct API submission mode - implementing atomic workflow');
        
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
          date: new Date(formData.date + 'T12:00:00.000Z'), // Convert to proper timestamp
          amount: -Math.abs(parseFloat(formData.amount)), // Ensure negative for expenses
          categoryName: formData.category,
          vendorName: formData.vendor,
          notes: formData.notes,
          accountName: formData.account,
          paymentMethod: formData.paymentMethod,
          type: 'expense',
          enteredBy: userEmail,
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
      }

      // Show confirmation modal
      const confirmationData = {
        date: new Date(formData.date + 'T12:00:00.000Z'),
        amount: -Math.abs(parseFloat(formData.amount)),
        category: formData.category,
        vendor: formData.vendor,
        notes: formData.notes,
        account: formData.account,
        paymentMethod: formData.paymentMethod,
        type: 'expense',
        clientId: clientId,
      };

      // Only include documents if there are any
      if (selectedFiles.length > 0) {
        confirmationData.documents = selectedFiles.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
        }));
      }

      // Success modal handling removed - would need to be implemented for direct API mode if needed

    } catch (error) {
      console.error('❌ Failed to submit expense:', error);
      setError('Failed to submit expense. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success modal handlers removed - now handled by parent component (TransactionsView)

  // Load client data - matching PWA logic
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

        // Handle different API response formats - same as PWA
        const rawCategories = categories.data || categories.categories || categories || [];
        const rawVendors = vendors.data || vendors.vendors || vendors || [];
        const rawAccounts = accounts.data || accounts.accounts || accounts || [];
        const rawPaymentMethods = paymentMethods.data || paymentMethods.paymentMethods || paymentMethods || [];

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
            const accountName = item.name || item.id || `Account ${item.type || 'Unknown'}`;
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

        console.log('✅ Processed client data:', processedData);
        setClientData(processedData);

        // Auto-select first account if only one
        if (processedData.accounts.length === 1) {
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

  // Handle initial data - useful for editing existing transactions
  useEffect(() => {
    if (initialData) {
      console.log('🔄 Loading initial data:', initialData);
      setFormData(prev => ({
        ...prev,
        ...initialData,
        date: initialData.date || prev.date,
      }));
    }
  }, [initialData]);

  // Don't render if modal mode and not open
  if (mode === 'modal' && !isOpen) {
    return null;
  }

  // Don't render if no client selected
  if (!clientId) {
    return (
      <div className={`unified-expense-entry ${mode}`} onClick={mode === 'modal' ? handleBackdropClick : undefined}>
        <div className="expense-entry-container" onClick={e => e.stopPropagation()}>
          <div className="expense-entry-header">
            <div className="header-content">
              {mode === 'screen' && (
                <button className="back-button" onClick={handleCancel}>
                  <FontAwesomeIcon icon={faArrowLeft} />
                </button>
              )}
              <div className="header-text">
                <h2 className="entry-title">Add Expense</h2>
              </div>
              {mode === 'modal' && (
                <button className="close-button" onClick={handleCancel}>
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              )}
            </div>
          </div>
          <div className="expense-entry-content">
            <div className="error-state">
              <p className="error-message">No client selected. Please select a client first.</p>
              <button onClick={handleCancel} className="btn-cancel">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="expense-entry-container">
      <div className="expense-entry-header">
        <div className="header-content">
          {mode === 'screen' && (
            <button className="back-button" onClick={handleCancel}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
          )}
          <div className="header-text">
            <h2 className="entry-title">Add Expense</h2>
            <div className="client-name">{clientName}</div>
          </div>
          {mode === 'modal' && (
            <button className="close-button" onClick={handleCancel}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>
      </div>
      
      <div className="expense-entry-content">
        {error && (
          <div className="error-banner">
            <p className="error-message">{error}</p>
            <button 
              className="error-dismiss" 
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        )}
        
        <form className="expense-form" onSubmit={handleSubmit}>
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading form data...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p className="error-message">{error}</p>
              <button onClick={() => window.location.reload()} className="btn-retry">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* First Row: Date, Amount, and Category */}
              <div className="form-row triple">
                <div className="form-group">
                  <label htmlFor="date" className="form-label">Date</label>
                  <input
                    type="date"
                    id="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className={fieldErrors.date ? 'error' : ''}
                    required
                  />
                  {fieldErrors.date && <span className="field-error">{fieldErrors.date}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="amount" className="form-label">Amount</label>
                  <input
                    type="number"
                    id="amount"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={fieldErrors.amount ? 'error' : ''}
                    required
                  />
                  {fieldErrors.amount && <span className="field-error">{fieldErrors.amount}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="category" className="form-label">Category</label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className={fieldErrors.category ? 'error' : ''}
                    required
                  >
                    <option value="">Select category</option>
                    {clientData.categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
                </div>
              </div>

              {/* Second Row: Vendor, Payment Method, Account */}
              <div className="form-row triple">
                <div className="form-group">
                  <label htmlFor="vendor" className="form-label">Vendor</label>
                  <input
                    type="text"
                    id="vendor"
                    value={formData.vendor}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                    placeholder="Enter vendor"
                    list="vendor-suggestions"
                    className={fieldErrors.vendor ? 'error' : ''}
                    required
                  />
                  <datalist id="vendor-suggestions">
                    {clientData.vendors.map((vendor) => (
                      <option key={vendor} value={vendor} />
                    ))}
                  </datalist>
                  {fieldErrors.vendor && <span className="field-error">{fieldErrors.vendor}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="paymentMethod" className="form-label">Payment Method</label>
                  <select
                    id="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className={fieldErrors.paymentMethod ? 'error' : ''}
                    required
                  >
                    <option value="">Select method</option>
                    {clientData.paymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.paymentMethod && <span className="field-error">{fieldErrors.paymentMethod}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="account" className="form-label">Account</label>
                  <select
                    id="account"
                    value={formData.account}
                    onChange={(e) => setFormData(prev => ({ ...prev, account: e.target.value }))}
                    className={fieldErrors.account ? 'error' : ''}
                    required
                  >
                    <option value="">Select account</option>
                    {clientData.accounts.map((account) => (
                      <option key={account} value={account}>
                        {account}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.account && <span className="field-error">{fieldErrors.account}</span>}
                </div>
              </div>

              {/* Notes Row - Full Width */}
              <div className="form-row single">
                <div className="form-group">
                  <label htmlFor="notes" className="form-label">Notes</label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes about this expense"
                    rows="3"
                  />
                </div>
              </div>

              {/* Document Upload Section */}
              <div className="form-section">
                <h3 className="section-title">Documents</h3>
                <DocumentUploader
                  clientId={clientId}
                  onFilesSelected={setSelectedFiles}
                  selectedFiles={selectedFiles}
                  mode="deferred"
                  onUploadError={(error) => {
                    console.error('❌ Document selection error:', error);
                    setError('Document validation failed: ' + error.message);
                  }}
                />
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={handleCancel} 
                  className="btn-cancel"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="loading-spinner small"></span>
                      Submitting...
                    </>
                  ) : (
                    'Submit Expense'
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );

  return (
    <div className={`unified-expense-entry ${mode}`} onClick={mode === 'modal' ? handleBackdropClick : undefined}>
      <div className="expense-entry-container" onClick={e => e.stopPropagation()}>
        {content}
      </div>
      
      {/* Success Modal is now handled by parent component (TransactionsView) to survive remounts */}
    </div>
  );
};

export default UnifiedExpenseEntry;

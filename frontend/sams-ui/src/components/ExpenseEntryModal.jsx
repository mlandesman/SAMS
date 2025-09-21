import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import '../styles/InputModal.css';
import './ExpenseEntryModal.css';
import { getCategories } from '../api/categories';
import { fetchVendors, createTransaction } from '../api/transaction';
import { uploadDocumentsForTransaction, linkDocumentsToTransaction } from '../api/documents';
import { DocumentUploader } from './documents';
import TransactionConfirmationModal from './TransactionConfirmationModal';
import SplitEntryModal from './transactions/SplitEntryModal';
import { Timestamp } from 'firebase/firestore';
import { getMexicoDateString } from '../utils/timezone';
import { databaseFieldMappings } from '../utils/databaseFieldMappings';

const { dollarsToCents } = databaseFieldMappings;

/**
 * ExpenseEntryModal component for adding/editing expense transactions
 */
const ExpenseEntryModal = ({ isOpen, onClose, onSubmit, initialData = null }) => {
  const { selectedClient } = useClient();
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Document upload state
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [documentUploadError, setDocumentUploadError] = useState(null);

  // Confirmation modal state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingTransactionData, setPendingTransactionData] = useState(null);

  // Split entry modal state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitAllocations, setSplitAllocations] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    date: getMexicoDateString(), // Use Mexico timezone for consistent date
    amount: '',
    category: '',
    vendor: '',
    accountType: 'Bank', // Default to bank
    notes: '',
    unit: '' // Optional field
  });

  // Load categories and vendors when modal opens, reset document state
  useEffect(() => {
    if (isOpen) {
      // Reset document state when modal opens
      setUploadedDocuments([]);
      setDocumentUploadError(null);
      
      const loadData = async () => {
        setLoading(true);
        try {
          // Get the client ID - ensure client is selected before proceeding
          const clientId = selectedClient?.id;
          if (!clientId) {
            console.error('ExpenseEntryModal: No client selected - cannot load expense data');
            setError('No client selected. Please select a client first.');
            return;
          }
          console.log('ExpenseEntryModal: Loading data for client:', clientId);
          console.log('ExpenseEntryModal: Current selectedClient:', selectedClient);
          
          const [categoriesResponse, vendorsList] = await Promise.all([
            getCategories(clientId),
            fetchVendors(clientId)
          ]);
          
          const categoriesList = categoriesResponse.data;
          
          console.log('Loaded categories:', categoriesList.length);
          console.log('Loaded vendors:', vendorsList.length);
          
          setCategories(categoriesList);
          setVendors(vendorsList);
        } catch (error) {
          console.error('Failed to load dropdown data:', error);
        } finally {
          setLoading(false);
        }
      };
      
      loadData();
    }
  }, [isOpen, selectedClient]);

  // If initialData is provided (for editing), populate the form
  useEffect(() => {
    if (initialData) {
      let dateValue = formData.date; // Default to current date
      
      // Convert Firestore timestamp to YYYY-MM-DD format if needed
      if (initialData.date) {
        if (initialData.date instanceof Timestamp) {
          dateValue = initialData.date.toDate().toISOString().split('T')[0];
        } else if (initialData.date instanceof Date) {
          dateValue = initialData.date.toISOString().split('T')[0];
        } else if (initialData.date.toDate && typeof initialData.date.toDate === 'function') {
          dateValue = initialData.date.toDate().toISOString().split('T')[0];
        }
      }
      
      // For expenses, amounts are negative but we display positive in the form
      const displayAmount = initialData.amount 
        ? (parseFloat(initialData.amount) < 0 
            ? (parseFloat(initialData.amount) * -1).toString()
            : initialData.amount.toString())
        : '';
      
      setFormData({
        date: dateValue,
        amount: displayAmount,
        category: initialData.category || '',
        vendor: initialData.vendor || '',
        accountType: initialData.accountType || 'Bank',
        notes: initialData.notes || '',
        unit: initialData.unit || ''
      });
    }
  }, [initialData]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  // Validate form before submission
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.amount || isNaN(parseFloat(formData.amount))) {
      newErrors.amount = 'Valid amount is required';
    }
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.vendor) newErrors.vendor = 'Vendor is required';
    if (!formData.accountType) newErrors.accountType = 'Account type is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if Split button should be enabled
  const isSplitButtonEnabled = () => {
    return formData.date && 
           formData.vendor && 
           formData.amount > 0 && 
           formData.accountType;
    // Note: category is not required for split transactions
  };

  // Handle Split button click
  const handleSplitTransaction = () => {
    if (!isSplitButtonEnabled()) return;
    
    // Prepare transaction data for split modal
    const transactionDataForSplit = {
      date: formData.date,
      vendorName: formData.vendor,
      amount: dollarsToCents(formData.amount), // Convert to cents for consistency
      accountType: formData.accountType,
      paymentMethod: formData.paymentMethod,
      unit: formData.unit,
      notes: formData.notes
    };
    
    setPendingTransactionData(transactionDataForSplit);
    setShowSplitModal(true);
  };

  // Handle save from split modal
  const handleSplitSave = (allocations) => {
    setSplitAllocations(allocations);
    setShowSplitModal(false);
    
    // Prepare final transaction data with allocations
    const finalTransactionData = {
      ...pendingTransactionData,
      allocations: allocations,
      categoryName: "-Split-", // This will be set by backend
      // Remove single category since this is split
      category: undefined
    };
    
    // Show confirmation modal with split transaction data
    setPendingTransactionData(finalTransactionData);
    setShowConfirmation(true);
  };

  // Handle form submission - show confirmation first
  const handleSubmit = async (e) => {
    console.log('🔍 ExpenseEntryModal.handleSubmit function called');
    e.preventDefault();
    
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }

    console.log('✅ Form validated successfully');

    // Prepare transaction data
    const amount = parseFloat(formData.amount) * -1; // Make negative for expenses
    const transactionData = {
      date: Timestamp.fromDate(new Date(formData.date + 'T00:00:00')),
      amount,
      categoryName: formData.category,
      vendorName: formData.vendor,
      accountName: formData.accountType,
      notes: formData.notes || '',
      unitId: formData.unit || ''
    };

    // Store the transaction data and show confirmation
    setPendingTransactionData(transactionData);
    setShowConfirmation(true);
  };

  // Handle confirmed transaction creation with atomic workflow
  const handleConfirmedSubmit = async () => {
    console.log('📝 Processing confirmed transaction');
    setLoading(true);
    setDocumentUploadError(null);
    setShowConfirmation(false);

    try {
      const clientId = selectedClient?.id;
      if (!clientId) {
        console.error('ExpenseEntryModal: No client selected - cannot process transaction');
        setDocumentUploadError('No client selected. Please select a client first.');
        setLoading(false);
        return;
      }
      console.log('📝 Processing transaction for client:', clientId);
      
      // Step 1: Upload documents if any are selected
      let documentIds = [];
      if (uploadedDocuments && uploadedDocuments.length > 0) {
        console.log('📎 Uploading documents...', uploadedDocuments.length);
        try {
          const documents = await uploadDocumentsForTransaction(clientId, uploadedDocuments);
          documentIds = documents.map(doc => doc.id);
          console.log('✅ Documents uploaded successfully:', documentIds);
        } catch (error) {
          console.error('❌ Document upload failed:', error);
          setDocumentUploadError('Failed to upload documents: ' + error.message);
          setLoading(false);
          return;
        }
      }

      // Step 2: Create transaction with document references
      const transactionDataWithDocs = {
        ...pendingTransactionData,
        documents: documentIds // Include document IDs
      };
      
      console.log('📦 Creating transaction with data:', transactionDataWithDocs);
      
      if (onSubmit) {
        try {
          console.log('🚀 Calling onSubmit function');
          const result = await onSubmit(transactionDataWithDocs);
          console.log('✅ Transaction created successfully:', result);
          
          // Step 3: Link documents to transaction if we have both
          if (documentIds.length > 0 && result?.transactionId) {
            console.log('🔗 Linking documents to transaction:', result.transactionId);
            try {
              await linkDocumentsToTransaction(clientId, documentIds, result.transactionId);
              console.log('✅ Documents linked successfully');
            } catch (linkError) {
              console.error('⚠️ Failed to link documents (transaction created):', linkError);
              // Transaction was created successfully, just document linking failed
              // This is not a critical error
            }
          }
          
          console.log('✅ Transaction and document workflow completed successfully');
          
        } catch (error) {
          console.error('❌ Error calling onSubmit:', error);
          if (onClose) {
            console.log('Calling onClose due to transaction error');
            onClose();
          }
        }
      } else {
        console.error('❌ onSubmit function is not defined or null!');
        if (onClose) {
          onClose();
        }
      }
    } catch (error) {
      console.error('❌ Unexpected error in handleConfirmedSubmit:', error);
      setDocumentUploadError('Unexpected error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal expense-modal">
        <div className="modal-title">
          {initialData ? 'Edit Expense' : 'Add New Expense'}
        </div>
        
        <div className="modal-content">
          {loading ? (
            <div className="loading-message">Loading...</div>
          ) : (
            <form className="expense-form" onSubmit={(e) => {
              console.log('Form submit event triggered');
              handleSubmit(e);
            }}>
              <div className="field-row">
                <div className="form-group">
                  <label htmlFor="date" className="required-field">Date</label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className={errors.date ? 'invalid' : ''}
                  />
                  {errors.date && <div className="error-message">{errors.date}</div>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="amount" className="required-field">Amount</label>
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    className={errors.amount ? 'invalid' : ''}
                  />
                  {errors.amount && <div className="error-message">{errors.amount}</div>}
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="category" className="required-field">Category</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={errors.category ? 'invalid' : ''}
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.name || category.id}>
                      {category.name || category.id}
                    </option>
                  ))}
                </select>
                {errors.category && <div className="error-message">{errors.category}</div>}
              </div>
              
              <div className="form-group">
                <label htmlFor="vendor" className="required-field">Vendor</label>
                <select
                  id="vendor"
                  name="vendor"
                  value={formData.vendor}
                  onChange={handleChange}
                  className={errors.vendor ? 'invalid' : ''}
                >
                  <option value="">Select a vendor</option>
                  {vendors.map(vendor => (
                    <option key={vendor.id} value={vendor.name || vendor.id}>
                      {vendor.name || vendor.id}
                    </option>
                  ))}
                </select>
                {errors.vendor && <div className="error-message">{errors.vendor}</div>}
              </div>
              
              <div className="form-group">
                <label htmlFor="accountType" className="required-field">Account Type</label>
                <select
                  id="accountType"
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleChange}
                  className={errors.accountType ? 'invalid' : ''}
                >
                  <option value="Bank">Bank</option>
                  <option value="Cash">Cash</option>
                </select>
                {errors.accountType && <div className="error-message">{errors.accountType}</div>}
              </div>
              
              <div className="form-group">
                <label htmlFor="unit">Unit (Optional)</label>
                <input
                  type="text"
                  id="unit"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  placeholder="Unit ID or name (if applicable)"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Enter any additional notes..."
                  rows="3"
                />
              </div>

              {/* Document Upload Section */}
              <div className="form-group">
                <label>Documents (Optional)</label>
                <DocumentUploader
                  clientId={selectedClient?.id}
                  onUploadComplete={(documents) => {
                    console.log('✅ Documents uploaded:', documents);
                    setUploadedDocuments(documents);
                  }}
                  onUploadError={(error) => {
                    console.error('❌ Document upload error:', error);
                    setDocumentUploadError(error.message || 'Failed to upload documents');
                  }}
                  disabled={loading}
                />
                {documentUploadError && (
                  <div className="error-message">{documentUploadError}</div>
                )}
              </div>
            </form>
          )}
        </div>
        
        <div className="modal-buttons">
          <button
            className="secondary"
            onClick={(e) => {
              console.log('Cancel button clicked');
              e.preventDefault(); // Prevent default button behavior
              // Force modal to close by calling onClose directly
              if (onClose) {
                console.log('Executing onClose function');
                try {
                  onClose();
                } catch (error) {
                  console.error('Error in onClose:', error);
                }
              }
            }}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
          
          {/* Split button - only show for new transactions */}
          {!initialData && (
            <button
              className={`split-button ${isSplitButtonEnabled() ? 'enabled' : 'disabled'}`}
              onClick={(e) => {
                console.log('Split button clicked');
                e.preventDefault();
                handleSplitTransaction();
              }}
              disabled={loading || !isSplitButtonEnabled()}
              type="button"
              title="Split transaction across multiple categories"
            >
              Split
            </button>
          )}
          
          <button
            className="primary"
            onClick={(e) => {
              console.log('Save/Update button clicked');
              e.preventDefault(); // Prevent form submission through button click
              // Call handleSubmit directly to ensure it completes fully
              handleSubmit(e);
            }}
            disabled={loading}
            type="button" // Change to button to prevent double submission
          >
            {initialData ? 'Update' : 'Save'} Expense
          </button>
        </div>
      </div>

      {/* Transaction Confirmation Modal */}
      <TransactionConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleConfirmedSubmit}
        transactionData={pendingTransactionData}
        uploadedDocuments={uploadedDocuments}
      />

      {/* Split Entry Modal */}
      <SplitEntryModal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        onSave={handleSplitSave}
        transactionData={pendingTransactionData}
        existingAllocations={splitAllocations}
      />
    </div>
  );
};

export default ExpenseEntryModal;

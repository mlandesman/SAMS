/**
 * Unified Expense Entry Component
 * Works in both modal (desktop) and full-screen (mobile/PWA) modes
 * Based on the proven PWA ExpenseForm implementation
 */

import React, { useState, useEffect } from 'react';
import { useClient } from '../context/ClientContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faArrowLeft, faFile, faFilePdf, faImage } from '@fortawesome/free-solid-svg-icons';
import SplitEntryModal from './transactions/SplitEntryModal';
import { clientAPI } from '../api/client';
import { getCurrentUser } from '../firebaseClient';
import { DocumentUploader } from './documents';
import { getTransactionDocuments } from '../api/documents';
import { getMexicoDateString } from '../utils/timezone';
import { databaseFieldMappings } from '../utils/databaseFieldMappings';
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

  // Form state - ID-first architecture: stores IDs instead of names
  const [formData, setFormData] = useState({
    date: getMexicoDateString(), // Use Mexico timezone for consistent date
    amount: '',
    categoryId: '', // Stores category ID
    vendorId: '',   // Stores vendor ID  
    notes: '',
    accountId: '',     // Stores account ID
    paymentMethodId: '', // Stores payment method ID
    unitId: '',     // Stores unit ID (optional)
  });

  const [clientData, setClientData] = useState({
    categories: [],
    vendors: [],
    accounts: [],
    paymentMethods: [],
    units: [],
  });

  const [rawAccountData, setRawAccountData] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Document upload state - use local state for deferred upload
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]); // Documents already attached to transaction

  // Split entry modal state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitAllocations, setSplitAllocations] = useState([]);
  
  // Bank fees checkbox state (for AVII and corporate accounts)
  const [addBankFees, setAddBankFees] = useState(false);

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
    
    // Validate amount format
    if (formData.amount && !databaseFieldMappings.validateAmount(formData.amount)) {
      errors.amount = 'Invalid amount format';
    }
    
    // Only require category if no split allocations exist
    if (splitAllocations.length === 0 && !formData.categoryId) {
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
    
    if (!formData.date) {
      errors.date = 'Date is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle vendor change - auto-populate category if vendor has default (Issue #135)
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

  // Check if Split button should be enabled (exclude category requirement for splits)
  const isSplitButtonEnabled = () => {
    return formData.date && 
           formData.vendorId && 
           formData.amount > 0 && 
           formData.paymentMethodId && 
           formData.accountId;
    // Allow split for both new transactions AND edits
  };

  // Handle Split button click
  const handleSplitTransaction = () => {
    if (!isSplitButtonEnabled()) return;
    
    // Prepare transaction data for split modal - resolve IDs to names for display
    const selectedVendor = clientData.vendors.find(v => v.id === formData.vendorId);
    const selectedAccount = clientData.accounts.find(a => a.id === formData.accountId);
    const selectedPaymentMethod = clientData.paymentMethods.find(p => p.id === formData.paymentMethodId);
    const selectedUnit = clientData.units.find(u => u.id === formData.unitId);
    
    const transactionDataForSplit = {
      date: formData.date,
      vendorId: formData.vendorId,
      vendorName: selectedVendor?.name || '',
      amount: databaseFieldMappings.dollarsToCents(formData.amount), // Convert to cents
      accountId: formData.accountId,
      accountType: selectedAccount?.name || '',
      paymentMethodId: formData.paymentMethodId,
      paymentMethod: selectedPaymentMethod?.name || '',
      unitId: formData.unitId,
      unit: selectedUnit?.name || '',
      notes: formData.notes
    };
    
    setShowSplitModal(true);
  };

  // Handle save from split modal - only saves allocations locally
  const handleSplitSave = (allocations) => {
    try {
      setSplitAllocations(allocations);
      setShowSplitModal(false);
      console.log('✅ Split allocations saved:', allocations.length, 'categories');
    } catch (error) {
      console.error('❌ Error saving split allocations:', error);
      setError(`Failed to save split allocations: ${error.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      console.log('❌ Form validation failed');
      return;
    }

    // Monitor expense submission workflow
    console.log('💰 Starting expense submission:', formData.amount, formData.categoryId || 'split-transaction');

    try {
      setSubmitting(true);
      setError(null);

      // Find the full account object based on selected account ID
      const findFullAccountData = (accountId) => {
        const account = rawAccountData.find(acc => {
          if (typeof acc === 'string') return false; // Skip string entries
          return acc?.id === accountId;
        });
        return account;
      };

      const selectedAccountData = findFullAccountData(formData.accountId);

      // Use the onSubmit callback if provided (modal mode)
      if (onSubmit) {
        // ID-first architecture: send IDs as primary values, include names for success modal
        const selectedVendor = clientData.vendors.find(v => v.id === formData.vendorId);
        const selectedPaymentMethod = clientData.paymentMethods.find(p => p.id === formData.paymentMethodId);
        const selectedCategory = clientData.categories.find(c => c.id === formData.categoryId);
        
        const transactionData = {
          date: formData.date, // Send date as string, let backend handle timezone conversion
          amount: -Math.abs(parseFloat(formData.amount)), // Always send dollars, let backend convert to cents
          vendorId: formData.vendorId, // PRIMARY: vendor ID
          vendorName: selectedVendor?.name || '', // For success modal display
          notes: formData.notes,
          accountId: formData.accountId, // PRIMARY: account ID
          accountName: selectedAccountData?.name || '', // For success modal display
          accountType: selectedAccountData?.type || 'bank', // Account metadata
          paymentMethodId: formData.paymentMethodId, // PRIMARY: payment method ID
          paymentMethod: selectedPaymentMethod?.name || '', // For success modal display
          unitId: formData.unitId || null, // PRIMARY: unit ID
          type: 'expense',
          clientId: clientId,
          enteredBy: userEmail,
        };

        // Handle split vs regular transactions differently
        if (splitAllocations.length > 0) {
          // Split transaction: use hardcoded categoryId and allocations
          transactionData.categoryId = "-split-";
          transactionData.categoryName = "-Split-";
          // CRITICAL: Allocations from handleSplitSave are already in centavos (cents) as integers
          // Do NOT convert them - send them as-is to the backend
          transactionData.allocations = splitAllocations.map(allocation => ({
            categoryId: allocation.categoryId,
            categoryName: allocation.categoryName,
            // allocation.amount is already in centavos (cents) as an integer - send as-is
            amount: Math.round(allocation.amount || 0), // Ensure integer
            notes: allocation.notes || ''
          }));
        } else if (addBankFees) {
          // Auto-create split allocations for bank fees
          // CRITICAL: Convert dollar amounts to centavos (integers)
          const originalAmountDollars = parseFloat(formData.amount);
          const commissionAmountDollars = 5.00;
          const ivaAmountDollars = 0.80;
          const totalAmountDollars = originalAmountDollars + commissionAmountDollars + ivaAmountDollars;
          
          // Convert to centavos (integers)
          const originalAmountCentavos = Math.round(databaseFieldMappings.dollarsToCents(originalAmountDollars));
          const commissionAmountCentavos = Math.round(databaseFieldMappings.dollarsToCents(commissionAmountDollars));
          const ivaAmountCentavos = Math.round(databaseFieldMappings.dollarsToCents(ivaAmountDollars));
          const totalAmountCentavos = Math.round(databaseFieldMappings.dollarsToCents(totalAmountDollars));
          
          transactionData.categoryId = "-split-";
          transactionData.categoryName = "-Split-";
          transactionData.amount = -Math.abs(totalAmountCentavos); // Update total to include fees (in centavos)
          transactionData.notes = (formData.notes ? formData.notes + ' ' : '') + '(includes transfer fees)';
          transactionData.allocations = [
            {
              categoryName: selectedCategory?.name || '',
              amount: -Math.abs(originalAmountCentavos), // INTEGER in centavos
              notes: 'Main expense'
            },
            {
              categoryName: 'Bank: Transfer Fees',
              amount: -Math.abs(commissionAmountCentavos), // INTEGER in centavos
              notes: 'Bank transfer fee'
            },
            {
              categoryName: 'Bank: IVA',
              amount: -Math.abs(ivaAmountCentavos), // INTEGER in centavos
              notes: 'Bank transfer IVA'
            }
          ];
          console.log('💰 Auto-created bank fee allocations (centavos, integers):', transactionData.allocations);
        } else {
          // Regular transaction: use single category ID
          transactionData.categoryId = formData.categoryId;
          transactionData.categoryName = selectedCategory?.name || ''; // For success modal display
        }

        // Only include documents array if there are files to upload
        if (selectedFiles.length > 0) {
          transactionData.documents = selectedFiles.map(file => ({
            name: file.name,
            size: file.size,
            type: file.type,
            file: file, // Keep the file object for upload
          }));
        }

        await onSubmit(transactionData);
        console.log('✅ Expense submitted via parent modal workflow');
        
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

        // Step 2: Create transaction with document references - ID-first architecture
        const selectedCategory = clientData.categories.find(c => c.id === formData.categoryId);
        let transactionAmount = -Math.abs(parseFloat(formData.amount));
        let transactionNotes = formData.notes;
        let transactionCategoryId = formData.categoryId;
        let transactionAllocations = null;
        
        // Handle bank fees if checkbox is checked
        if (addBankFees) {
          // CRITICAL: Convert dollar amounts to centavos (integers) for allocations
          const originalAmountDollars = parseFloat(formData.amount);
          const commissionAmountDollars = 5.00;
          const ivaAmountDollars = 0.80;
          const totalAmountDollars = originalAmountDollars + commissionAmountDollars + ivaAmountDollars;
          
          // Transaction amount stays in dollars (backend converts to centavos)
          transactionAmount = -Math.abs(totalAmountDollars);
          transactionNotes = (formData.notes ? formData.notes + ' ' : '') + '(includes transfer fees)';
          transactionCategoryId = '-split-';
          
          // Allocations must be in centavos (integers) - convert from dollars
          const originalAmountCentavos = Math.round(databaseFieldMappings.dollarsToCents(originalAmountDollars));
          const commissionAmountCentavos = Math.round(databaseFieldMappings.dollarsToCents(commissionAmountDollars));
          const ivaAmountCentavos = Math.round(databaseFieldMappings.dollarsToCents(ivaAmountDollars));
          
          transactionAllocations = [
            {
              categoryName: selectedCategory?.name || '',
              amount: -Math.abs(originalAmountCentavos), // INTEGER in centavos
              notes: 'Main expense'
            },
            {
              categoryName: 'Bank: Transfer Fees',
              amount: -Math.abs(commissionAmountCentavos), // INTEGER in centavos
              notes: 'Bank transfer fee'
            },
            {
              categoryName: 'Bank: IVA',
              amount: -Math.abs(ivaAmountCentavos), // INTEGER in centavos
              notes: 'Bank transfer IVA'
            }
          ];
          console.log('💰 Auto-created bank fee allocations (direct API, centavos, integers):', transactionAllocations);
        }
        
        const transactionData = {
          date: formData.date, // Send date as string, let backend handle timezone conversion
          amount: transactionAmount, // Ensure negative for expenses (in dollars)
          categoryId: transactionCategoryId, // PRIMARY: category ID
          vendorId: formData.vendorId, // PRIMARY: vendor ID
          notes: transactionNotes,
          accountId: formData.accountId, // PRIMARY: account ID
          accountType: selectedAccountData?.type || 'bank', // Account metadata
          paymentMethodId: formData.paymentMethodId, // PRIMARY: payment method ID
          unitId: formData.unitId || null, // PRIMARY: unit ID
          type: 'expense',
          enteredBy: userEmail,
          documents: uploadedDocuments.map(doc => doc.id), // Include document references
          ...(transactionAllocations && { allocations: transactionAllocations }),
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

      // Show confirmation modal - using IDs
      const confirmationData = {
        date: formData.date, // Send date as string, backend will handle formatting
        amount: -Math.abs(parseFloat(formData.amount)),
        categoryId: formData.categoryId,
        vendorId: formData.vendorId,
        notes: formData.notes,
        accountId: formData.accountId,
        paymentMethodId: formData.paymentMethodId,
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
      
      // Enhanced error handling for validation failures
      if (error.isValidationError && error.validationErrors) {
        const errorMessages = Array.isArray(error.validationErrors) 
          ? error.validationErrors 
          : [error.validationErrors];
        
        const formattedErrors = errorMessages.map(err => `• ${err}`).join('\n');
        setError(`Transaction validation failed:\n\n${formattedErrors}\n\nPlease check your data and try again.`);
      } else if (error.message && error.message.includes('validation failed')) {
        // Handle validation errors that come as strings
        setError(`Validation Error: ${error.message}\n\nPlease check your data and try again.`);
      } else {
        // Generic error fallback
        setError(`Failed to submit expense: ${error.message || 'Unknown error occurred. Please try again.'}`);
      }
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

        const [categories, vendors, accounts, paymentMethods, units] = await Promise.all([
          clientAPI.getCategories(clientId),
          clientAPI.getVendors(clientId),
          clientAPI.getAccounts(clientId),
          clientAPI.getPaymentMethods(clientId),
          clientAPI.getUnits(clientId).catch(() => ({ data: [] })), // Units are optional
        ]);

        console.log('📋 Raw API responses:', { categories, vendors, accounts, paymentMethods, units });

        // Handle different API response formats - same as PWA
        const rawCategories = categories.data || categories.categories || categories || [];
        const rawVendors = vendors.data || vendors.vendors || vendors || [];
        const rawAccounts = accounts.data || accounts.accounts || accounts || [];
        const rawPaymentMethods = paymentMethods.data || paymentMethods.paymentMethods || paymentMethods || [];
        const rawUnits = units.data || units.units || units || [];

        // Helper function to safely extract ID+name objects from API responses
        const extractIdNameObject = (item, fallbackPrefix = 'Unknown') => {
          if (typeof item === 'string') {
            // Convert string to ID+name object
            return {
              id: item.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              name: item
            };
          }
          if (item && typeof item === 'object') {
            return {
              id: item.id || item.unitId || item.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown',
              name: item.name || item.id || item.unitId || `${fallbackPrefix} Item`
            };
          }
          return {
            id: String(item).toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: String(item)
          };
        };

        // CRITICAL FIX: Preserve ID+name objects instead of stripping to strings
        const processedData = {
          categories: rawCategories
            .map(item => extractIdNameObject(item, 'Category'))
            .filter(obj => obj.name && !obj.name.includes('Unknown'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
          vendors: rawVendors
            .map(item => ({
              ...extractIdNameObject(item, 'Vendor'),
              category: item.category || '' // Preserve vendor's default category for auto-population
            }))
            .filter(obj => obj.name && !obj.name.includes('Unknown'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
          accounts: rawAccounts
            .map(item => extractIdNameObject(item, 'Account'))
            .filter(obj => obj.name && !obj.name.includes('Unknown'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
          paymentMethods: rawPaymentMethods
            .filter(item => {
              // Filter to show only active payment methods (matches HOA Dues modal behavior)
              if (typeof item === 'object' && item !== null) {
                return item.status === 'active';
              }
              // If it's a string format, we can't filter by status, so include it
              return true;
            })
            .map(item => extractIdNameObject(item, 'Payment'))
            .filter(obj => obj.name && !obj.name.includes('Unknown'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
          units: rawUnits
            .map(item => extractIdNameObject(item, 'Unit'))
            .filter(obj => obj.name && !obj.name.includes('Unknown'))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        };

        // No hardcoded fallback - payment methods must come from client configuration

        console.log('✅ Processed client data:', processedData);
        console.log('🏦 Raw account data for mapping:', rawAccounts);
        setClientData(processedData);
        setRawAccountData(rawAccounts); // Store raw account data for mapping

        // Auto-select defaults for common transaction patterns (Issue #135 enhancement)
        // Default to eTransfer payment method and bank-001 account (99% of transactions)
        const defaultPaymentMethod = processedData.paymentMethods.find(p => 
          p.id === 'etransfer' || p.name?.toLowerCase() === 'etransfer'
        );
        const defaultAccount = processedData.accounts.find(a => 
          a.id === 'bank-001'
        ) || (processedData.accounts.length === 1 ? processedData.accounts[0] : null);
        
        if (defaultPaymentMethod || defaultAccount) {
          setFormData(prev => ({ 
            ...prev, 
            ...(defaultPaymentMethod && { paymentMethodId: defaultPaymentMethod.id }),
            ...(defaultAccount && { accountId: defaultAccount.id })
          }));
          
          // Auto-check bank fees for bank accounts
          if (defaultAccount) {
            const accountData = rawAccounts.find(a => a.id === defaultAccount.id || a.name === defaultAccount.name);
            const isBankAccount = accountData && accountData.type !== 'cash';
            setAddBankFees(isBankAccount);
          }
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
      console.log('🔄 Loading initial data for edit mode:', initialData);
      setFormData(prev => ({
        ...prev,
        date: initialData.date || prev.date,
        amount: initialData.amount || '',
        vendorId: initialData.vendorId || '',
        categoryId: initialData.categoryId || '',
        accountId: initialData.accountId || '',
        paymentMethodId: initialData.paymentMethodId || '',
        unitId: initialData.unitId || '',
        notes: initialData.notes || ''
      }));
      
      // Load existing allocations if this is a split transaction
      if (initialData.allocations && Array.isArray(initialData.allocations) && initialData.allocations.length > 0) {
        console.log('🔄 Loading existing split allocations:', initialData.allocations.length, 'allocations');
        // CRITICAL: Allocations from database are ALREADY stored in CENTAVOS (cents) as INTEGERS
        // Do NOT convert them - they're already in the correct format
        // Only ensure they're integers (handle any floating point values from bad writes)
        const formattedAllocations = initialData.allocations.map((allocation, index) => {
          let amountInCents = allocation.amount || 0;
          
          console.log(`🔄 Allocation ${index + 1} original:`, {
            categoryName: allocation.categoryName,
            originalAmount: allocation.amount,
            amountType: typeof allocation.amount
          });
          
          // Allocations from database are ALREADY in centavos (cents) - ensure they're integers
          if (typeof amountInCents === 'number') {
            // Round to integer (handles any floating point values from bad writes)
            amountInCents = Math.round(amountInCents);
            // Ensure negative for expenses (allocations should match transaction sign)
            if (amountInCents > 0 && initialData.amount) {
              const transactionAmount = typeof initialData.amount === 'number' 
                ? initialData.amount 
                : parseFloat(initialData.amount) || 0;
              if (transactionAmount < 0) {
                amountInCents = -Math.abs(amountInCents);
              }
            }
            console.log(`  Rounded to integer centavos: ${amountInCents}`);
          } else if (typeof amountInCents === 'string' && amountInCents !== '') {
            // String value, parse and round to integer
            const numValue = parseFloat(amountInCents);
            if (!isNaN(numValue)) {
              amountInCents = Math.round(numValue);
              // Ensure negative for expenses
              if (amountInCents > 0 && initialData.amount) {
                const transactionAmount = typeof initialData.amount === 'number' 
                  ? initialData.amount 
                  : parseFloat(initialData.amount) || 0;
                if (transactionAmount < 0) {
                  amountInCents = -Math.abs(amountInCents);
                }
              }
              console.log(`  Parsed and rounded to integer centavos: ${amountInCents}`);
            } else {
              amountInCents = 0;
              console.log(`  Invalid amount string: "${amountInCents}", defaulting to 0`);
            }
          }
          
          console.log(`  Final allocation ${index + 1}: ${allocation.categoryName || 'No category'} = ${amountInCents} centavos (integer)`);
          
          return {
            ...allocation,
            amount: amountInCents // Already in centavos, ensure integer
          };
        });
        console.log('🔄 Formatted allocations (centavos):', formattedAllocations);
        setSplitAllocations(formattedAllocations);
      }
      
      // Load existing documents if editing a transaction with ID
      if (initialData.transactionId && clientId) {
        const loadExistingDocuments = async () => {
          try {
            console.log('📄 Loading existing documents for transaction:', initialData.transactionId);
            const response = await getTransactionDocuments(clientId, initialData.transactionId);
            console.log('📄 Loaded documents response:', response);
            
            // Handle different response formats from API
            let documents = [];
            if (Array.isArray(response)) {
              documents = response;
            } else if (response?.documents && Array.isArray(response.documents)) {
              documents = response.documents;
            } else if (response?.data && Array.isArray(response.data)) {
              documents = response.data;
            } else if (response?.success && Array.isArray(response.data)) {
              documents = response.data;
            }
            
            console.log('📄 Extracted documents array:', documents);
            setExistingDocuments(documents);
          } catch (error) {
            console.error('❌ Error loading existing documents:', error);
            setExistingDocuments([]);
          }
        };
        loadExistingDocuments();
      } else {
        setExistingDocuments([]);
      }
    } else {
      // Clear existing documents when not editing
      setExistingDocuments([]);
    }
  }, [initialData, clientId]);

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
                <h2 className="entry-title">{initialData ? 'Edit Expense' : 'Add Expense'}</h2>
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
            <h2 className="entry-title">{initialData ? 'Edit Expense' : 'Add Expense'}</h2>
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
              {/* First Row: Date, Amount, and Vendor (Issue #135: Vendor before Category for auto-population) */}
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

                {/* Vendor - moved before Category for auto-population (Issue #135) */}
                <div className="form-group">
                  <label htmlFor="vendor" className="form-label">Vendor</label>
                  <select
                    id="vendor"
                    value={formData.vendorId}
                    onChange={(e) => handleVendorChange(e.target.value)}
                    className={fieldErrors.vendorId ? 'error' : ''}
                    required
                  >
                    <option value="">Select vendor</option>
                    {clientData.vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                        {vendor.category && ` (${vendor.category})`}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.vendor && <span className="field-error">{fieldErrors.vendor}</span>}
                </div>
              </div>

              {/* Split Allocations Display */}
              {splitAllocations.length > 0 && (
                <div className="form-section split-allocations-section">
                  <h3 className="section-title">Split Allocations</h3>
                  <div className="split-allocations-display">
                    <table className="split-allocations-table">
                      <thead>
                        <tr>
                          <th style={{textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5', width: '30%'}}>Category</th>
                          <th style={{textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5', width: '50%'}}>Notes</th>
                          <th style={{textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5', width: '20%'}}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {splitAllocations.map((allocation, index) => (
                          <tr key={index} style={{backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9'}}>
                            <td style={{textAlign: 'left', padding: '8px', border: '1px solid #e0e0e0', width: '30%'}}>{allocation.categoryName}</td>
                            <td style={{textAlign: 'left', padding: '8px', border: '1px solid #e0e0e0', width: '50%'}}>{allocation.notes || '-'}</td>
                            <td style={{textAlign: 'right', padding: '8px', border: '1px solid #e0e0e0', width: '20%'}}>${databaseFieldMappings.centsToDollars(allocation.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="split-total" style={{textAlign: 'right', marginTop: '8px', fontWeight: 'bold', padding: '8px', backgroundColor: '#f0f0f0', border: '1px solid #ddd'}}>
                      Total: ${databaseFieldMappings.centsToDollars(splitAllocations.reduce((sum, alloc) => sum + alloc.amount, 0))}
                    </div>
                  </div>
                </div>
              )}

              {/* Second Row: Category, Payment Method, Account */}
              <div className="form-row triple">
                {/* Category - moved after Vendor for auto-population (Issue #135) */}
                <div className="form-group">
                  <label htmlFor="category" className="form-label">Category</label>
                  {splitAllocations.length > 0 ? (
                    <div className="split-category-display">
                      <input
                        type="text"
                        value="-Split-"
                        disabled
                        className="split-category-input"
                        title="Transaction is split across multiple categories"
                      />
                    </div>
                  ) : (
                    <select
                      id="category"
                      value={formData.categoryId}
                      onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                      className={fieldErrors.categoryId ? 'error' : ''}
                      required
                    >
                      <option value="">Select category</option>
                      {clientData.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="paymentMethod" className="form-label">Payment Method</label>
                  <select
                    id="paymentMethod"
                    value={formData.paymentMethodId}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentMethodId: e.target.value }))}
                    className={fieldErrors.paymentMethodId ? 'error' : ''}
                    required
                  >
                    <option value="">Select method</option>
                    {clientData.paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.paymentMethod && <span className="field-error">{fieldErrors.paymentMethod}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="account" className="form-label">Account</label>
                  <select
                    id="account"
                    value={formData.accountId}
                    onChange={(e) => {
                      const newAccountId = e.target.value;
                      setFormData(prev => ({ ...prev, accountId: newAccountId }));
                      // Auto-check bank fees for bank accounts (type !== 'cash')
                      const selectedAccount = clientData.accounts.find(a => a.id === newAccountId);
                      const isBankAccount = selectedAccount && selectedAccount.type !== 'cash';
                      setAddBankFees(isBankAccount);
                    }}
                    className={fieldErrors.accountId ? 'error' : ''}
                    required
                  >
                    <option value="">Select account</option>
                    {clientData.accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.account && <span className="field-error">{fieldErrors.account}</span>}
                  
                  {/* Bank Fees Checkbox - auto-checked for bank accounts */}
                  <div className="bank-fees-checkbox" style={{ marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={addBankFees}
                        onChange={(e) => setAddBankFees(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Add Bank Fees (+$5.80)</span>
                    </label>
                    {addBankFees && formData.amount && (
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px', paddingLeft: '22px' }}>
                        Total: ${(parseFloat(formData.amount) + 5.80).toFixed(2)} (Commission: $5.00 + IVA: $0.80)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Third Row: Unit (Optional) - Only show if multiple units available */}
              {clientData.units.length > 1 && (
                <div className="form-row single">
                  <div className="form-group">
                    <label htmlFor="unit" className="form-label">Unit (Optional)</label>
                    <select
                      id="unit"
                      value={formData.unitId}
                      onChange={(e) => setFormData(prev => ({ ...prev, unitId: e.target.value }))}
                    >
                      <option value="">No specific unit</option>
                      {clientData.units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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
                
                {/* Existing Documents Display */}
                {existingDocuments && existingDocuments.length > 0 && (
                  <div className="existing-documents" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Attached Documents:</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                      {existingDocuments.map((doc) => (
                        <div 
                          key={doc.id} 
                          style={{ 
                            border: '1px solid #ddd', 
                            borderRadius: '4px', 
                            padding: '0.5rem', 
                            backgroundColor: 'white',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: doc.downloadURL ? 'pointer' : 'default'
                          }}
                          onClick={() => {
                            if (doc.downloadURL) {
                              window.open(doc.downloadURL, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          title={doc.downloadURL ? 'Click to open document' : 'Document (no download URL available)'}
                        >
                          {/* Document Thumbnail */}
                          {doc.downloadURL && (doc.mimeType?.startsWith('image/') || doc.mimeType?.includes('image')) ? (
                            <img 
                              src={doc.downloadURL} 
                              alt={doc.filename || doc.originalName || 'Document'} 
                              style={{ 
                                width: '100%', 
                                maxWidth: '120px', 
                                height: 'auto', 
                                maxHeight: '120px', 
                                objectFit: 'contain',
                                marginBottom: '0.5rem',
                                borderRadius: '4px',
                                pointerEvents: 'none' // Prevent image click from bubbling
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '100px',
                              height: '100px',
                              backgroundColor: '#e0e0e0',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px',
                              marginBottom: '0.5rem'
                            }}>
                              {doc.mimeType?.includes('pdf') ? (
                                <FontAwesomeIcon icon={faFilePdf} style={{ fontSize: '2rem', color: '#dc3545' }} />
                              ) : (
                                <FontAwesomeIcon icon={faFile} style={{ fontSize: '2rem', color: '#999' }} />
                              )}
                              <span style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.25rem' }}>
                                {doc.mimeType?.includes('pdf') ? 'PDF' : 'File'}
                              </span>
                            </div>
                          )}
                          
                          {/* Document ID */}
                          <div style={{ 
                            fontSize: '0.7rem', 
                            color: '#666', 
                            wordBreak: 'break-all',
                            textAlign: 'center',
                            marginTop: '0.25rem'
                          }}>
                            <strong>ID:</strong> {doc.id}
                          </div>
                          
                          {/* Document Name */}
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: '#333', 
                            marginTop: '0.25rem',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%'
                          }} title={doc.filename || doc.originalName || doc.id}>
                            {doc.filename || doc.originalName || doc.id}
                          </div>
                          
                          {/* Document Size (if available) */}
                          {doc.size && (
                            <div style={{ fontSize: '0.65rem', color: '#999', marginTop: '0.25rem' }}>
                              {(doc.size / 1024).toFixed(1)} KB
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
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
                
                {/* Split button - show for both new transactions and edits */}
                <button 
                  type="button"
                  onClick={handleSplitTransaction}
                  className={`btn-split ${isSplitButtonEnabled() ? 'enabled' : 'disabled'}`}
                  disabled={submitting || !isSplitButtonEnabled()}
                  title={splitAllocations.length > 0 ? "Edit split allocations" : "Split transaction across multiple categories"}
                >
                  {splitAllocations.length > 0 ? 'Edit Split' : 'Split'}
                </button>
                
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="loading-spinner small"></span>
                      {initialData ? 'Updating...' : 'Submitting...'}
                    </>
                  ) : (
                    initialData ? 'Update Expense' : 'Submit Expense'
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
      
      {/* Split Entry Modal */}
      <SplitEntryModal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        onSave={handleSplitSave}
        transactionData={{
          date: formData.date,
          vendorId: formData.vendorId,
          vendorName: clientData.vendors.find(v => v.id === formData.vendorId)?.name || '',
          // Convert to cents and make negative for expenses (expenses are always negative)
          amount: -Math.abs(databaseFieldMappings.dollarsToCents(formData.amount || 0)),
          accountId: formData.accountId,
          accountType: clientData.accounts.find(a => a.id === formData.accountId)?.name || '',
          paymentMethodId: formData.paymentMethodId,
          paymentMethod: clientData.paymentMethods.find(p => p.id === formData.paymentMethodId)?.name || '',
          unitId: formData.unitId,
          unit: clientData.units.find(u => u.id === formData.unitId)?.name || '',
          notes: formData.notes
        }}
        existingAllocations={splitAllocations}
        categories={clientData.categories}
      />
    </div>
  );
};

export default UnifiedExpenseEntry;

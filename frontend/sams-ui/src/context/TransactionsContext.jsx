// src/context/TransactionsContext.jsx
import React, { createContext, useState, useContext } from 'react';
import { useClient } from './ClientContext';
import { createTransaction, updateTransaction, deleteTransaction } from '../api/transaction';
import ConfirmationDialog from '../components/ConfirmationDialog';
import { databaseFieldMappings } from '../utils/databaseFieldMappings';

const TransactionsContext = createContext();

export const TransactionsProvider = ({ children }) => {
  const { selectedClient } = useClient();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSplitEntryModal, setShowSplitEntryModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [balanceUpdateTrigger, setBalanceUpdateTrigger] = useState(0);
  
  // Use localStorage to persist the filter selection, but default to currentMonth
  const [currentFilter, setCurrentFilter] = useState(() => {
    const savedFilter = localStorage.getItem('transactionFilter');
    return savedFilter || 'currentMonth';
  });
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [transactionCount, setTransactionCount] = useState(0);
  
  const handleFilterClick = () => setShowFilterModal(true);
  
  const handleFilterSelected = (filter) => {
    setShowFilterModal(false);
    
    if (filter) {
      // Save filter to localStorage for persistence
      localStorage.setItem('transactionFilter', filter);
      setCurrentFilter(filter);
      // The actual filtering will be done in TransactionsView
    }
  };

  const updateFilteredTransactions = (transactions) => {
    setFilteredTransactions(transactions);
    setTransactionCount(transactions.length);
  };

  // Trigger balance recalculation
  const triggerBalanceUpdate = () => {
    setBalanceUpdateTrigger(prev => prev + 1);
  };

  // Helper function to detect split transactions
  const isSplitTransaction = (transaction) => {
    return transaction && 
           transaction.categoryName === "-Split-" && 
           transaction.allocations && 
           Array.isArray(transaction.allocations) && 
           transaction.allocations.length > 0;
  };
  
  // Select a transaction for editing or viewing details
  const selectTransaction = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const getFilterLabel = () => {
    const filterLabels = {
      'all': 'All Transactions',
      'yearToDate': 'Year to Date',
      'previousYear': 'Previous Year',
      'currentMonth': 'Current Month',
      'previousMonth': 'Previous Month',
      'previous3Months': 'Previous 3 Months'
    };
    
    return filterLabels[currentFilter] || 'All Transactions';
  };
  
  // Initialize transactions with an empty array if not set yet
  if (filteredTransactions === null) {
    setFilteredTransactions([]);
  }
  
  // Initialize transactionCount with 0 if not set yet
  if (transactionCount === null) {
    setTransactionCount(0);
  };

  // Add a new transaction
  const addTransaction = async (transactionData) => {
    console.log('TransactionsContext.addTransaction called with data:', transactionData);
    console.log('Current selectedClient:', selectedClient);
    
    // Store clientId in local variable for reliability
    let clientId = null;
    
    if (selectedClient && selectedClient.id) {
      console.log('Using client ID from selectedClient.id:', selectedClient.id);
      clientId = selectedClient.id;
    } else if (selectedClient && typeof selectedClient === 'string') {
      // In case the selectedClient is just a string ID
      console.log('selectedClient is a string, using directly:', selectedClient);
      clientId = selectedClient;
    } else {
      // No client selected - this is a security issue, fail the operation
      console.error('No client selected - cannot add transaction');
      console.error('selectedClient object:', selectedClient ? JSON.stringify(selectedClient) : 'null');
      setError('No client selected. Please select a client first.');
      return null;
    }
    
    console.log('Client ID to be used:', clientId);
    
    if (!clientId) {
      console.error('No client ID available - cannot add transaction');
      setError('No client selected. Please select a client first.');
      return null;
    }
    
    // Set a global variable for debugging purposes
    window.lastClientIdUsed = clientId;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Use the local clientId variable we defined earlier
      console.log(`Calling API createTransaction for client ${clientId}`);
      const transactionId = await createTransaction(clientId, transactionData);
      console.log(`Transaction created with ID: ${transactionId}`);
      
      if (!transactionId) {
        throw new Error('Failed to create transaction - no ID returned');
      }
      
      // Add the new transaction to the list with proper formatting
      const newTransaction = {
        id: transactionId,
        ...transactionData,
        // Add display fields for UI
        displayAmount: databaseFieldMappings.formatCurrency(
          databaseFieldMappings.dollarsToCents(transactionData.amount)
        ),
        displayDate: databaseFieldMappings.formatTimestamp(transactionData.date)
      };
      
      setFilteredTransactions(prev => [newTransaction, ...prev]);
      setTransactionCount(prev => prev + 1);
      setShowExpenseModal(false);
      console.log('Transaction added successfully, modal closed');
      
      // If it's an HOA transaction, clear the HOA cache
      const isHOATransaction = transactionData.category === 'HOA Dues' || 
                              transactionData.metadata?.type === 'hoa_dues';
      if (isHOATransaction) {
        console.log('🧹 Clearing HOA cache after adding HOA transaction');
        const hoaPattern = `hoa_`;
        Object.keys(sessionStorage)
          .filter(key => key.includes(hoaPattern))
          .forEach(key => {
            sessionStorage.removeItem(key);
            console.log(`✅ Cleared HOA cache: ${key}`);
          });
      }
      
      // Trigger balance update immediately after successful transaction addition
      triggerBalanceUpdate();
      
      // Return the new transaction ID for further actions if needed
      return transactionId;
    } catch (err) {
      console.error('Failed to add transaction:', err);
      setError(err.message || 'Failed to add transaction');
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Edit an existing transaction
  const editTransaction = async (transactionId, transactionData) => {
    // Store clientId in local variable for reliability
    let clientId = null;
    
    if (selectedClient && selectedClient.id) {
      clientId = selectedClient.id;
    } else if (selectedClient && typeof selectedClient === 'string') {
      // In case the selectedClient is just a string ID
      clientId = selectedClient;
    } else {
      // No client selected - this is a security issue, fail the operation
      console.error('No client selected - cannot edit transaction');
      setError('No client selected. Please select a client first.');
      return null;
    }
    
    console.log('editTransaction - Client ID to be used:', clientId);
    
    if (!clientId || !transactionId) {
      console.error('Missing client or transaction ID');
      console.error('Client ID:', clientId);
      console.error('Transaction ID:', transactionId);
      setError('Missing client or transaction ID');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await updateTransaction(clientId, transactionId, transactionData);
      
      // Update the transaction in the list with proper formatting
      setFilteredTransactions(prev => 
        prev.map(txn => 
          txn.id === transactionId 
            ? { 
                ...txn, 
                ...transactionData,
                // Update display fields
                displayAmount: databaseFieldMappings.formatCurrency(
                  databaseFieldMappings.dollarsToCents(transactionData.amount)
                ),
                displayDate: databaseFieldMappings.formatTimestamp(transactionData.date)
              } 
            : txn
        )
      );
      
      setSelectedTransaction(null);
      setShowExpenseModal(false);
      
      // If it's an HOA transaction, clear the HOA cache
      const isHOATransaction = transactionData.category === 'HOA Dues' || 
                              transactionData.metadata?.type === 'hoa_dues';
      if (isHOATransaction) {
        console.log('🧹 Clearing HOA cache after editing HOA transaction');
        const hoaPattern = `hoa_`;
        Object.keys(sessionStorage)
          .filter(key => key.includes(hoaPattern))
          .forEach(key => {
            sessionStorage.removeItem(key);
            console.log(`✅ Cleared HOA cache: ${key}`);
          });
      }
      
      // Trigger balance update immediately after successful transaction edit
      triggerBalanceUpdate();
      
      return true;
    } catch (err) {
      console.error('Failed to update transaction:', err);
      setError(err.message || 'Failed to update transaction');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete a transaction
  const removeTransaction = async (transactionId) => {
    // Store clientId in local variable for reliability
    const clientId = selectedClient ? selectedClient.id : null;
    console.log('removeTransaction - Client ID extracted:', clientId);
    
    if (!clientId || !transactionId) {
      console.error('Missing client or transaction ID');
      console.error('Client ID:', clientId);
      console.error('Transaction ID:', transactionId);
      setError('Missing client or transaction ID');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if this is an HOA transaction before deletion
      const transactionToDelete = filteredTransactions.find(txn => txn.id === transactionId);
      const isHOATransaction = transactionToDelete && (
        transactionToDelete.category === 'HOA Dues' || 
        transactionToDelete.metadata?.type === 'hoa_dues'
      );
      
      // 🗑️ CREDIT BALANCE DEBUG: Add detailed frontend transaction removal logging
      console.log('🗑️ DELETE: Frontend transaction removal:', {
        transactionId,
        clientId,
        isHOATransaction,
        transactionData: transactionToDelete ? {
          category: transactionToDelete.category,
          amount: transactionToDelete.amount,
          metadata: transactionToDelete.metadata,
          unitId: transactionToDelete.metadata?.unitId || transactionToDelete.metadata?.id,
          year: transactionToDelete.metadata?.year
        } : null,
        willClearHOACache: isHOATransaction
      });
      
      // Use the local clientId variable we defined earlier
      await deleteTransaction(clientId, transactionId);
      
      // If it was an HOA transaction, clear the HOA cache
      if (isHOATransaction) {
        console.log('🧹 CLEARING: HOA cache after deleting HOA transaction');
        
        // Get all cache keys before clearing
        const allCacheKeys = Object.keys(sessionStorage);
        const hoaPattern = `hoa_`;
        const hoaCacheKeys = allCacheKeys.filter(key => key.includes(hoaPattern));
        
        console.log('🧹 CACHE: HOA cache analysis:', {
          totalCacheKeys: allCacheKeys.length,
          hoaCacheKeysFound: hoaCacheKeys.length,
          hoaCacheKeys: hoaCacheKeys,
          unitId: transactionToDelete.metadata?.unitId || transactionToDelete.metadata?.id,
          year: transactionToDelete.metadata?.year
        });
        
        // Clear HOA-specific cache entries
        hoaCacheKeys.forEach(key => {
          sessionStorage.removeItem(key);
          console.log(`✅ Cleared HOA cache: ${key}`);
        });
        
        console.log('🧹 CACHE: HOA cache clearing completed');
      }
      
      // Remove the transaction from the list
      setFilteredTransactions(prev => {
        const updatedTransactions = prev.filter(txn => txn.id !== transactionId);
        console.log(`Removed transaction ${transactionId}, ${prev.length} -> ${updatedTransactions.length} items`);
        return updatedTransactions;
      });
      
      // Update the count as well
      setTransactionCount(prev => prev - 1);
      
      // Clear selection
      setSelectedTransaction(null);
      
      // Trigger balance update immediately after successful transaction deletion
      triggerBalanceUpdate();
      
      // Trigger a UI refresh
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 100);
      
      return true;
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      setError(err.message || 'Failed to delete transaction');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (actionType) => {
    try {
      console.log(`TransactionsContext.handleAction called with: ${actionType}`);
      
      switch (actionType) {
        case 'filter':
          setShowFilterModal(true);
          break;
        case 'add':
          setSelectedTransaction(null); // Clear any selected transaction
          setShowExpenseModal(true);    // Open the modal for adding
          break;
        case 'edit':
          if (selectedTransaction) {
            // Check if this is a split transaction
            if (isSplitTransaction(selectedTransaction)) {
              console.log('Opening split transaction for editing:', selectedTransaction);
              setShowSplitEntryModal(true);  // Open split modal for editing
            } else {
              console.log('Opening regular transaction for editing:', selectedTransaction);
              setShowExpenseModal(true);  // Open regular modal for editing
            }
          } else {
            alert('Please select a transaction to edit');
          }
          break;
        case 'delete':
          if (selectedTransaction) {
            setShowDeleteConfirmation(true);
          } else {
            alert('Please select a transaction to delete');
          }
          break;
        case 'clear':
          console.log('Clearing selection and closing all modals');
          setSelectedTransaction(null);
          setShowExpenseModal(false);   // Close regular expense modal
          setShowSplitEntryModal(false); // Close split entry modal
          break;
        case 'print':
          console.log('Print clicked');
          break;
        case 'reconcile':
          console.log('Reconcile Accounts clicked');
          break;
        case 'adjust':
          console.log('Bank Adjustments clicked');
          break;
        default:
          console.log(`Unknown action: ${actionType}`);
      }
    } catch (error) {
      console.error(`Error in handleAction(${actionType}):`, error);
    }
  };

  const value = {
    showFilterModal,
    showExpenseModal,
    showSplitEntryModal,
    handleFilterClick,
    handleFilterSelected,
    setShowFilterModal,
    setShowExpenseModal,
    setShowSplitEntryModal,
    handleAction,
    currentFilter,
    getFilterLabel,
    filteredTransactions,
    updateFilteredTransactions,
    transactionCount,
    selectedTransaction,
    selectTransaction,
    addTransaction,
    editTransaction,
    removeTransaction,
    isLoading,
    isRefreshing,
    setIsRefreshing,
    error,
    balanceUpdateTrigger,
    triggerBalanceUpdate,
    isSplitTransaction
  };
  
  return (
    <TransactionsContext.Provider value={value}>
      {children}
      
      {/* Confirmation Dialog for Delete Action */}
      <ConfirmationDialog
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={() => {
          if (selectedTransaction && selectedTransaction.id) {
            removeTransaction(selectedTransaction.id);
            setShowDeleteConfirmation(false);
          }
        }}
        title="Delete Transaction"
        message={(() => {
          if (!selectedTransaction) return "Are you sure you want to delete this transaction? This action cannot be undone.";
          
          // Check if this is an HOA transaction
          const isHOATransaction = selectedTransaction.category === 'HOA Dues' || 
                                  selectedTransaction.metadata?.type === 'hoa_dues';
          
          if (isHOATransaction) {
            const unitId = selectedTransaction.unitId || selectedTransaction.metadata?.unitId || selectedTransaction.unit;
            return `Are you sure you want to delete this HOA Dues transaction? This will adjust the dues and credit balances for Unit ${unitId || 'N/A'}. This action cannot be undone.`;
          }
          
          return "Are you sure you want to delete this transaction? This action cannot be undone.";
        })()}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmButtonClass="danger"
      />
    </TransactionsContext.Provider>
  );
};

export const useTransactionsContext = () => {
  const context = useContext(TransactionsContext);
  if (!context) {
    throw new Error('useTransactionsContext must be used within a TransactionsProvider');
  }
  return context;
};
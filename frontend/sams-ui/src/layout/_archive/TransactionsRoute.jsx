// src/components/TransactionsRoute.jsx
import React, { useEffect, useState } from 'react';
import { useTransactionsContext } from '../context/TransactionsContext';
import { useClient } from '../context/ClientContext';
import { useAuth } from '../context/AuthContext';
import { canAccessExpenseEntry } from '../utils/userRoles';
import TransactionTable from './TransactionTable';
import FilterSwitchModal from './FilterSwitchModal';
import UnifiedExpenseEntry from './UnifiedExpenseEntry';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { getDb } from '../firebaseClient';
import './TransactionsRoute.css';

const TransactionsRoute = () => {
  const { 
    showFilterModal,
    showExpenseModal,
    setShowFilterModal,
    setShowExpenseModal,
    // handleFilterClick, // Not needed here
    handleFilterSelected,
    handleAction,
    currentFilter,
    getFilterLabel,
    updateFilteredTransactions,
    selectedTransaction,
    selectTransaction,
    addTransaction,
    editTransaction,
    removeTransaction
  } = useTransactionsContext();
  
  const { selectedClient } = useClient();
  const { samsUser } = useAuth(); // Get SAMS user with role information
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  
  // Load transactions based on filter
  useEffect(() => {
    const fetchTransactions = async () => {
      if (!selectedClient?.id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const db = getDb();
        const transactionsRef = collection(db, `clients/${selectedClient.id}/transactions`);
        const q = query(transactionsRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        
        const txList = [];
        snapshot.forEach((doc) => {
          txList.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        setTransactions(txList);
        
        // Apply filtering
        const filtered = applyFilter(txList, currentFilter);
        updateFilteredTransactions(filtered);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setError(err.message || 'Error fetching transactions');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransactions();
  }, [selectedClient?.id, currentFilter, updateFilteredTransactions]);

  // Filter transaction by date range
  const applyFilter = (transactions, filter) => {
    if (!transactions.length) return [];
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (filter) {
      case 'all': {
        return transactions;
      }
        
      case 'yearToDate': {
        const startOfYear = new Date(currentYear, 0, 1);
        return transactions.filter(tx => 
          tx.date?.toDate?.() >= startOfYear
        );
      }
        
      case 'previousYear': {
        const startOfPrevYear = new Date(currentYear - 1, 0, 1);
        const endOfPrevYear = new Date(currentYear - 1, 11, 31, 23, 59, 59);
        return transactions.filter(tx => {
          const txDate = tx.date?.toDate?.();
          return txDate >= startOfPrevYear && txDate <= endOfPrevYear;
        });
      }
        
      case 'currentMonth': {
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        return transactions.filter(tx => 
          tx.date?.toDate?.() >= startOfMonth
        );
      }
        
      case 'previousMonth': {
        const startOfPrevMonth = new Date(currentYear, currentMonth - 1, 1);
        const endOfPrevMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
        return transactions.filter(tx => {
          const txDate = tx.date?.toDate?.();
          return txDate >= startOfPrevMonth && txDate <= endOfPrevMonth;
        });
      }
        
      case 'previous3Months': {
        const startOf3Months = new Date();
        startOf3Months.setMonth(currentMonth - 3);
        startOf3Months.setDate(1);
        return transactions.filter(tx => 
          tx.date?.toDate?.() >= startOf3Months
        );
      }
        
      default:
        return transactions;
    }
  };
  
  // Handle transaction submission from ExpenseEntryModal
  const handleTransactionSubmit = async (formData) => {
    console.log('💼 TransactionsRoute.handleTransactionSubmit called with data:', formData);
    console.log('Current selectedTransaction:', selectedTransaction);
    console.log('Current client:', selectedClient);
    
    if (!selectedClient?.id) {
      console.error('No client selected in TransactionsRoute.handleTransactionSubmit');
      throw new Error('No client selected - cannot save transaction');
    }
    
    try {
      let result;
      if (selectedTransaction) {
        // Edit existing transaction
        console.log(`🖊️ Editing transaction ${selectedTransaction.id} for client ${selectedClient.id}`);
        result = await editTransaction(selectedTransaction.id, formData);
        console.log('Edit transaction result:', result);
      } else {
        // Add new transaction
        console.log(`➕ Adding new transaction for client ${selectedClient.id}`);
        result = await addTransaction(formData);
        console.log('Add transaction result:', result);
      }
      
      // Refresh the transactions list
      console.log('Refreshing transaction list');
      const refreshed = applyFilter(transactions, currentFilter);
      updateFilteredTransactions(refreshed);
      
      console.log('Transaction operation completed, closing modal');
      // Close the modal after submission
      setShowExpenseModal(false);
    } catch (error) {
      console.error('❌ Error in handleTransactionSubmit:', error);
      alert(`Error saving transaction: ${error.message || 'Unknown error'}`);
    }
  };
  
  return (
    <div className="transactions-container">
      <div className="transactions-header">
        <h2>Transactions - {getFilterLabel()}</h2>
        <div className="actions">
          <button onClick={() => handleAction('filter')}>Filter</button>
          {canAccessExpenseEntry(samsUser, selectedClient?.id) ? (
            <button onClick={() => handleAction('add')} disabled={!selectedClient?.id}>Add Expense</button>
          ) : (
            <button disabled title="Admin access required">Add Expense</button>
          )}
          <button onClick={() => handleAction('edit')} disabled={!selectedTransaction}>Edit</button>
          <button onClick={() => handleAction('delete')} disabled={!selectedTransaction}>Delete</button>
          <button onClick={() => handleAction('clear')}>Clear Selection</button>
        </div>
      </div>
      
      {loading ? (
        <div className="loading">Loading transactions...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <TransactionTable 
          transactions={transactions} 
          selectedId={selectedTransaction?.id}
          onSelectTransaction={selectTransaction}
        />
      )}
      
      {showFilterModal && (
        <FilterSwitchModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onFilterSelected={handleFilterSelected}
          selectedFilter={currentFilter}
        />
      )}
      
      {showExpenseModal && selectedClient?.id && (
        <UnifiedExpenseEntry
          mode="modal"
          isOpen={showExpenseModal}
          onClose={() => {
            console.log('UnifiedExpenseEntry onClose called');
            setShowExpenseModal(false);
            selectTransaction(null); // Clear selected transaction
          }}
          onSubmit={async (data) => {
            console.log('TransactionsRoute: UnifiedExpenseEntry onSubmit with data:', data);
            console.log('TransactionsRoute: Current client:', selectedClient);
            await handleTransactionSubmit(data);
          }}
          clientId={selectedClient.id}
          initialData={selectedTransaction}
        />
      )}
    </div>
  );
};

export default TransactionsRoute;
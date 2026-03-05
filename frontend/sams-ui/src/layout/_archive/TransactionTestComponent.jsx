// src/components/TransactionTestComponent.jsx
import React, { useState, useEffect } from 'react';
import { useTransactionsContext } from '../context/TransactionsContext';
import { useClient } from '../context/ClientContext';
import { Timestamp } from 'firebase/firestore';

/**
 * Test component for verifying transaction CRUD operations
 */
const TransactionTestComponent = () => {
  const { 
    addTransaction, 
    editTransaction, 
    removeTransaction,
    filteredTransactions,
    updateFilteredTransactions,
    currentFilter,
    selectedTransaction,
    selectTransaction
  } = useTransactionsContext();
  
  const { selectedClient } = useClient();
  const [testTransactionId, setTestTransactionId] = useState(null);
  const [status, setStatus] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  // Add a log message with timestamp
  const addLog = (message, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, timestamp, isError }]);
  };

  // Create a test transaction
  const createTestTransaction = async () => {
    if (!selectedClient?.id) {
      addLog('No client selected!', true);
      return false;
    }

    try {
      setStatus('Creating test transaction...');
      addLog('Creating test transaction...');
      
      const testData = {
        date: Timestamp.fromDate(new Date()),
        vendor: 'Test Vendor',
        category: 'Test Category',
        notes: 'Test transaction created by UI test',
        unit: 'Test Unit',
        amount: -100.00, // Negative for expense
        accountType: 'Bank',
      };
      
      const txnId = await addTransaction(testData);
      
      if (txnId) {
        setTestTransactionId(txnId);
        addLog(`Created test transaction with ID: ${txnId}`);
        
        // Find and select the transaction
        const txn = filteredTransactions.find(t => t.id === txnId);
        if (txn) {
          selectTransaction(txn);
          addLog('Selected the new transaction');
        }
        
        return true;
      } else {
        addLog('Failed to create transaction - no ID returned', true);
        return false;
      }
    } catch (error) {
      addLog(`Error creating transaction: ${error.message}`, true);
      return false;
    }
  };

  // Update the test transaction
  const updateTestTransaction = async () => {
    if (!testTransactionId) {
      addLog('No test transaction ID available!', true);
      return false;
    }
    
    try {
      setStatus('Updating test transaction...');
      addLog(`Updating transaction: ${testTransactionId}`);
      
      const updateData = {
        vendor: 'Updated Test Vendor',
        notes: 'This transaction was updated by the test',
        amount: -150.00, // Changed amount
      };
      
      const success = await editTransaction(testTransactionId, updateData);
      
      if (success) {
        addLog('Transaction updated successfully');
        return true;
      } else {
        addLog('Failed to update transaction', true);
        return false;
      }
    } catch (error) {
      addLog(`Error updating transaction: ${error.message}`, true);
      return false;
    }
  };

  // Delete the test transaction
  const deleteTestTransaction = async () => {
    if (!testTransactionId) {
      addLog('No test transaction ID available!', true);
      return false;
    }
    
    try {
      setStatus('Deleting test transaction...');
      addLog(`Deleting transaction: ${testTransactionId}`);
      
      const success = await removeTransaction(testTransactionId);
      
      if (success) {
        addLog('Transaction deleted successfully');
        setTestTransactionId(null);
        return true;
      } else {
        addLog('Failed to delete transaction', true);
        return false;
      }
    } catch (error) {
      addLog(`Error deleting transaction: ${error.message}`, true);
      return false;
    }
  };

  // Run the full test sequence
  const runTest = async () => {
    setIsRunning(true);
    setLogs([]);
    addLog('Starting transaction test sequence...');
    
    try {
      // Step 1: Create a transaction
      const created = await createTestTransaction();
      if (!created) {
        throw new Error('Failed to create test transaction');
      }
      
      // Wait a moment to ensure transaction is processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Update the transaction
      const updated = await updateTestTransaction();
      if (!updated) {
        throw new Error('Failed to update test transaction');
      }
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Delete the transaction
      const deleted = await deleteTestTransaction();
      if (!deleted) {
        throw new Error('Failed to delete test transaction');
      }
      
      setStatus('✅ Test completed successfully!');
      addLog('Test sequence completed successfully!');
    } catch (error) {
      setStatus(`❌ Test failed: ${error.message}`);
      addLog(`Test failed: ${error.message}`, true);
    } finally {
      setIsRunning(false);
    }
  };

  // Auto-run test when component loads if autorun param is in URL
  useEffect(() => {
    if (selectedClient && window.location.search.includes('autorun') && !isRunning) {
      const timer = setTimeout(() => {
        runTest();
      }, 1000); // Wait a second before running to allow UI to render
      return () => clearTimeout(timer);
    }
  }, [selectedClient]);
  
  return (
    <div className="transaction-test" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Transaction Management Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={runTest} 
          disabled={isRunning || !selectedClient}
          style={{ 
            padding: '10px 15px',
            backgroundColor: isRunning ? '#ccc' : '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? 'Running Test...' : 'Run Test'}
        </button>
        
        <a 
          href="/test?autorun=true" 
          style={{ 
            marginLeft: '10px',
            padding: '10px 15px',
            backgroundColor: '#34a853',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            textDecoration: 'none',
            display: 'inline-block'
          }}
        >
          Auto-Run Test
        </a>
        
        {!selectedClient && (
          <p style={{ color: 'red' }}>Please select a client first</p>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Status: {status || 'Ready'}</h3>
        {testTransactionId && (
          <p>Test Transaction ID: {testTransactionId}</p>
        )}
      </div>
      
      <div className="test-logs" style={{ 
        maxHeight: '400px', 
        overflowY: 'auto', 
        border: '1px solid #ccc',
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px'
      }}>
        <h3>Test Logs</h3>
        {logs.length === 0 ? (
          <p>No logs yet. Run the test to see the results.</p>
        ) : (
          <ul style={{ padding: '0 0 0 20px' }}>
            {logs.map((log, index) => (
              <li key={index} style={{ 
                marginBottom: '8px',
                color: log.isError ? 'red' : 'inherit'
              }}>
                <span style={{ color: '#666', fontSize: '0.85em' }}>
                  [{log.timestamp}]
                </span>
                {' '}
                {log.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TransactionTestComponent;

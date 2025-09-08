import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import TransactionTable from '../components/TransactionTable';
import TransactionDetailModal from '../components/TransactionDetailModal';
import AdvancedFilterModal from '../components/AdvancedFilterModal';
import DigitalReceipt from '../components/DigitalReceipt';
import NotificationModal from '../components/NotificationModal';
import { useNotification } from '../hooks/useNotification';
import { getUnits } from '../api/units';
import { fetchTransactions } from '../utils/fetchTransactions';
import { getClientAccountBalances, clearAccountsCache } from '../utils/clientAccounts';
import { recalculateClientBalances } from '../utils/balanceRecalculation';
import FilterSwitchModal from '../components/FilterSwitchModal';
import { useClient } from '../context/ClientContext';
import { useTransactionsContext } from '../context/TransactionsContext';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useExchangeRates } from '../hooks/useExchangeRates';
import ActivityActionBar from '../components/common/ActivityActionBar';
import UnifiedExpenseEntry from '../components/UnifiedExpenseEntry';
import ExpenseSuccessModal from '../components/ExpenseSuccessModal';
import TransactionConfirmationModal from '../components/TransactionConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getTransactionById } from '../api/hoaDuesService';
import { generateTransactionReceipt } from '../utils/receiptUtils';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  faPlus,
  faEdit,
  faFilter,
  faPrint,
  faCheckDouble,
  faTrash
} from '@fortawesome/free-solid-svg-icons';
import '../layout/ActionBar.css';
import './TransactionsDetail.css';

function TransactionsView() {
  const [allTransactions, setAllTransactions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [startingBalance, setStartingBalance] = useState({ cashBalance: 0, bankBalance: 0 });
  const [noBalanceFound, setNoBalanceFound] = useState(false);
  const [loadingTransaction, setLoadingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState(null);
  const [transactionToFind, setTransactionToFind] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTransaction, setDetailTransaction] = useState(null);
  const [isRecalculatingBalance, setIsRecalculatingBalance] = useState(false);
  
  // Exchange rate checking hook
  const { checkAndUpdateRates } = useExchangeRates();
  
  // New filtering states from context
  const {
    globalSearchTerm,
    currentDateRange,
    advancedFilters,
    handleAdvancedFiltersApply
  } = useTransactionFilters();
  
  // Notification system for email status
  const { 
    notification, 
    closeNotification, 
    showError, 
    showEmailSuccess
  } = useNotification();
  
  // Local state for modals
  const [showAdvancedFilterModal, setShowAdvancedFilterModal] = useState(false);
  const [showDigitalReceipt, setShowDigitalReceipt] = useState(false);
  const [receiptTransactionData, setReceiptTransactionData] = useState(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [units, setUnits] = useState([]);
  
  // Confirmation modal state (sophisticated modal with document previews)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [documentFiles, setDocumentFiles] = useState([]); // Store actual file objects
  
  // Success modal state (survives balance recalculation remounts)
  const [showExpenseSuccessModal, setShowExpenseSuccessModal] = useState(false);
  const [expenseSuccessData, setExpenseSuccessData] = useState(null);
  
  const tableContainerRef = useRef(null);
  const balanceBarRef = useRef(null);
  const { selectedClient } = useClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    showFilterModal,
    showExpenseModal,
    handleFilterSelected, 
    handleAction,
    currentFilter,
    updateFilteredTransactions,
    selectedTransaction,
    selectTransaction,
    addTransaction,
    editTransaction,
    isRefreshing,
    setIsRefreshing,
    balanceUpdateTrigger
  } = useTransactionsContext();

  // Reference to store if we've already calculated the balance and for which client
  const balanceCalculation = useRef({
    calculated: false,
    clientId: null,
    lastRefreshTimestamp: 0
  });

  // Track if we've already highlighted a transaction to avoid infinite highlight loops
  const hasHighlighted = useRef({});

  // Modal handlers
  const handleOpenAdvancedFilter = useCallback(() => {
    setShowAdvancedFilterModal(true);
  }, []);

  const handleCloseAdvancedFilter = useCallback(() => {
    setShowAdvancedFilterModal(false);
  }, []);

  // Handler for generating digital receipts
  const handleGenerateReceipt = useCallback(async () => {
    if (!selectedTransaction || !selectedTransaction.unit) {
      showError('Please select a transaction with a Unit ID to generate a receipt');
      return;
    }

    try {
      setIsGeneratingReceipt(true);
      
      // Use the centralized receipt utility
      const receiptGenerated = await generateTransactionReceipt(selectedTransaction, {
        setReceiptTransactionData,
        setShowDigitalReceipt,
        showError,
        selectedClient,
        units
      });
      
      if (!receiptGenerated) {
        console.warn('Receipt generation failed');
      }
      
    } catch (error) {
      console.error('Error generating receipt:', error);
      showError('Error generating receipt: ' + error.message);
    } finally {
      setIsGeneratingReceipt(false);
    }
  }, [selectedTransaction, selectedClient, units, setReceiptTransactionData, setShowDigitalReceipt, showError]);

  // Apply date filters based on the current filter
  const getFilterDates = (filterType) => {
    const now = new Date();
    const startDate = new Date();
    const endDate = new Date();
    
    switch (filterType) {
      case 'yearToDate':
        startDate.setMonth(0, 1); // January 1st of current year
        break;
      case 'previousYear':
        startDate.setFullYear(now.getFullYear() - 1, 0, 1); // January 1st of previous year
        endDate.setFullYear(now.getFullYear() - 1, 11, 31); // December 31st of previous year
        break;
      case 'currentMonth':
        startDate.setDate(1); // First day of current month
        break;
      case 'previousMonth':
        startDate.setMonth(now.getMonth() - 1, 1); // First day of previous month
        endDate.setMonth(now.getMonth(), 0); // Last day of previous month
        break;
      case 'previous3Months':
        startDate.setMonth(now.getMonth() - 3); // 3 months ago
        break;
      case 'today':
        startDate.setHours(0, 0, 0, 0); // Start of today
        endDate.setHours(23, 59, 59, 999); // End of today
        break;
      case 'yesterday':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0); // Start of yesterday
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999); // End of yesterday
        break;
      case 'thisWeek': {
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        startDate.setDate(now.getDate() - dayOfWeek); // Start of this week (Sunday)
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() + (6 - dayOfWeek)); // End of this week (Saturday)
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'lastWeek': {
        const dayOfWeek = now.getDay();
        startDate.setDate(now.getDate() - dayOfWeek - 7); // Start of last week
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - dayOfWeek - 1); // End of last week
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'all':
      default:
        startDate.setFullYear(now.getFullYear() - 20); // Go back 20 years
        endDate.setFullYear(now.getFullYear() + 5); // Go forward 5 years to catch any future dates
        break;
    }
    
    return { startDate, endDate };
  };

  // Apply the comprehensive filtering system to transactions and sort by date
  const filteredTransactions = useMemo(() => {
    if (!allTransactions.length) return [];
    
    // Start with all transactions
    let filtered = [...allTransactions];
    
    // Apply legacy filter first (for backward compatibility with existing filter system)
    if (currentFilter && currentFilter !== 'all') {
      const { startDate, endDate } = getFilterDates(currentFilter);
      filtered = filtered.filter(txn => {
        const txnDate = txn.date?.toDate?.() || new Date(txn.date);
        return txnDate >= startDate && txnDate <= endDate;
      });
    }
    
    // Apply new date range filter (from DateRangeDropdown)
    if (currentDateRange && currentDateRange !== 'all' && currentDateRange !== currentFilter) {
      const { startDate, endDate } = getFilterDates(currentDateRange);
      filtered = filtered.filter(txn => {
        const txnDate = txn.date?.toDate?.() || new Date(txn.date);
        return txnDate >= startDate && txnDate <= endDate;
      });
    }
    
    // Apply global search
    if (globalSearchTerm) {
      const lowerSearchTerm = globalSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(transaction => {
        const searchableFields = [
          transaction.vendor,
          transaction.category,
          transaction.unit,
          transaction.account,
          transaction.notes,
          transaction.description,
          transaction.date,
          transaction.amount?.toString()
        ];
        
        return searchableFields.some(field => 
          field && field.toString().toLowerCase().includes(lowerSearchTerm)
        );
      });
    }
    
    // Apply advanced filters
    if (Object.keys(advancedFilters).length > 0) {
      filtered = filtered.filter(transaction => {
        // Vendor filter
        if (advancedFilters.vendor && transaction.vendor !== advancedFilters.vendor) {
          return false;
        }
        
        // Category filter
        if (advancedFilters.category && transaction.category !== advancedFilters.category) {
          return false;
        }
        
        // Unit filter
        if (advancedFilters.unit && transaction.unit !== advancedFilters.unit) {
          return false;
        }
        
        // Account filter
        if (advancedFilters.account && transaction.account !== advancedFilters.account) {
          return false;
        }
        
        // Amount range filter
        const amount = parseFloat(transaction.amount) || 0;
        if (advancedFilters.minAmount && amount < parseFloat(advancedFilters.minAmount)) {
          return false;
        }
        if (advancedFilters.maxAmount && amount > parseFloat(advancedFilters.maxAmount)) {
          return false;
        }
        
        // Date range filter
        if (advancedFilters.startDate || advancedFilters.endDate) {
          const txDate = new Date(transaction.date?.toDate?.() || transaction.date);
          if (advancedFilters.startDate && txDate < new Date(advancedFilters.startDate)) {
            return false;
          }
          if (advancedFilters.endDate && txDate > new Date(advancedFilters.endDate + 'T23:59:59')) {
            return false;
          }
        }
        
        // Description contains filter
        if (advancedFilters.description) {
          const description = transaction.description || '';
          if (!description.toLowerCase().includes(advancedFilters.description.toLowerCase())) {
            return false;
          }
        }
        
        // Notes contains filter
        if (advancedFilters.notes) {
          const notes = transaction.notes || '';
          if (!notes.toLowerCase().includes(advancedFilters.notes.toLowerCase())) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    // Sort by date (ascending order - oldest first)
    return filtered.sort((a, b) => {
      const dateA = a.date?.toDate?.() || new Date(a.date);
      const dateB = b.date?.toDate?.() || new Date(b.date);
      return dateA - dateB;
    });
  }, [allTransactions, currentFilter, globalSearchTerm, currentDateRange, advancedFilters]);

  // Helper function to clear all highlighted rows
  const clearAllHighlights = useCallback(() => {
    document.querySelectorAll('.highlight-row').forEach(el => {
      el.classList.remove('highlight-row');
    });
  }, []);

  // Scroll to the transaction with the specified ID
  const scrollToTransaction = useCallback((transactionId) => {
    if (!transactionId) return;
    
    console.log(`Attempting to scroll to transaction: ${transactionId}`);
    
    // Check if the transaction is in our current list
    const transactionExists = filteredTransactions.some(tx => tx.id === transactionId);
    console.log(`Transaction ${transactionId} exists in filtered list: ${transactionExists}`);
    
    // Always reset highlighting history for this transaction to ensure it highlights again
    if (hasHighlighted.current) {
      console.log(`Resetting highlight history for transaction ${transactionId}`);
      delete hasHighlighted.current[transactionId];
    }
    
    // More robust scrolling function with better retries and fallbacks
    const attemptScroll = (attempts = 0) => {
      if (attempts >= 10) {  // Increased max attempts
        console.log(`Failed to find transaction ${transactionId} after ${attempts} attempts`);
        return; // Give up after several attempts
      }
      
      // Debugging element existence
      const allRows = document.querySelectorAll('[id^="txn-row-"]');
      console.log(`Found ${allRows.length} transaction rows in DOM (attempt ${attempts + 1})`);
      
      // Find element by ID
      const element = document.getElementById(`txn-row-${transactionId}`);
      console.log(`Element for transaction ${transactionId}: ${element ? 'Found' : 'Not found'} (attempt ${attempts + 1})`);
      
      if (element && tableContainerRef.current) {
        // Clear any existing highlights first to ensure clean state
        clearAllHighlights();
        
        // First ensure the table container is fully scrolled to show the element
        const containerRect = tableContainerRef.current.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        
        // Calculate if element is currently visible in viewport
        const isVisible = (
          elementRect.top >= containerRect.top &&
          elementRect.bottom <= containerRect.bottom
        );
        
        console.log(`Transaction ${transactionId} visibility check: ${isVisible ? 'Visible' : 'Not visible in viewport'}`);
        
        // Scroll the element into view with smooth behavior
        console.log(`Scrolling to transaction ${transactionId}`);
        
        // Force scroll positioning to ensure element is visible
        try {
          // Try modern scrollIntoView first
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          // Fallback to manual scrolling if needed
          if (!isVisible) {
            const scrollOffset = elementRect.top + 
              tableContainerRef.current.scrollTop - 
              containerRect.top - 
              (containerRect.height / 2) + 
              (elementRect.height / 2);
              
            tableContainerRef.current.scrollTo({
              top: scrollOffset,
              behavior: 'smooth'
            });
          }
        } catch (e) {
          console.error('Error during scroll:', e);
          // Basic fallback if all else fails
          tableContainerRef.current.scrollTop = element.offsetTop - (tableContainerRef.current.clientHeight / 2);
        }
        
        // Add the highlight class
        element.classList.add('highlight-row');
        console.log(`Added highlight class to transaction ${transactionId}`);
        
        // Mark transaction as highlighted to prevent repeated highlighting
        hasHighlighted.current[transactionId] = true;
        
        // Remove highlight after animation is complete
        setTimeout(() => {
          if (element && element.classList.contains('highlight-row')) {
            element.classList.remove('highlight-row');
          }
        }, 3000); // Extended highlight duration for better visibility
        
        // Double-check highlight visibility after scrolling completes
        setTimeout(() => {
          const stillVisible = document.getElementById(`txn-row-${transactionId}`);
          if (stillVisible && !isElementVisibleInContainer(stillVisible, tableContainerRef.current)) {
            console.log('Element still not visible after scroll, attempting final scroll adjustment');
            stillVisible.scrollIntoView({
              behavior: 'auto',  // Switch to instant scroll as last resort
              block: 'center'
            });
          }
        }, 500); // Check after scroll animation likely completed
      } else {
        console.log(`Could not find element to scroll to: ${transactionId}, retrying in 300ms`);
        // Try again after a delay, with increasing timeouts
        setTimeout(() => attemptScroll(attempts + 1), Math.min(300 * (attempts + 1), 1000));
      }
    };
    
    // Helper function to check if an element is fully visible in container
    const isElementVisibleInContainer = (element, container) => {
      if (!element || !container) return false;
      
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      return (
        elementRect.top >= containerRect.top &&
        elementRect.bottom <= containerRect.bottom
      );
    };
    
    // Start the first attempt with a longer initial delay to ensure DOM is ready
    setTimeout(() => attemptScroll(0), 300);
    
  }, [filteredTransactions, hasHighlighted, tableContainerRef, clearAllHighlights]);

  // Helper function to recalculate balances after transactions are modified
  const recalculateBalances = async (forceClearCache = false) => {
    const clientId = selectedClient?.id;
    if (!clientId) {
      console.error('No client selected - cannot recalculate balances');
      return;
    }
    console.log(`Recalculating balance for ${clientId} after transaction change`);
    
    // Clear the accounts cache to force fresh data
    if (forceClearCache) {
      console.log('Forcing balance refresh from database');
      clearAccountsCache(clientId);
    }
    
    try {
      setIsRecalculatingBalance(true);
      
      // For transaction changes, we need to actually recalculate balances
      // from the year-end snapshot, not just read current balances
      const recalculatedData = await recalculateClientBalances(clientId, '2024');
      
      // Update the display with the newly calculated balances
      setStartingBalance({ 
        cashBalance: recalculatedData.cashBalance, 
        bankBalance: recalculatedData.bankBalance 
      });
      setBalance(recalculatedData.totalBalance);
      setNoBalanceFound(false);
      
      // Clear the accounts cache so next fetch gets the updated data
      clearAccountsCache(clientId);
      
      // Update balance calculation tracking
      balanceCalculation.current = {
        calculated: true,
        clientId: clientId,
        lastRefreshTimestamp: Date.now()
      };
      
      console.log(`✅ Balance recalculation after transaction change complete! Processed ${recalculatedData.processedTransactions} transactions`);
      
    } catch (error) {
      console.error('Error recalculating balances after transaction change:', error);
      setNoBalanceFound(true);
    } finally {
      setIsRecalculatingBalance(false);
    }
  };

  // Load a single transaction by ID
  const loadSingleTransaction = async (transactionId) => {
    if (!selectedClient?.id || !transactionId) {
      console.log('Cannot load transaction - missing client or transaction ID', {
        clientId: selectedClient?.id,
        transactionId
      });
      return;
    }
    
    console.log(`Loading transaction ${transactionId} for client ${selectedClient.id}`);
    setLoadingTransaction(true);
    setTransactionError(null);
    
    try {
      const transaction = await getTransactionById(selectedClient.id, transactionId);
      console.log('Transaction lookup completed:', transaction ? 'Found' : 'Not found');
      
      if (!transaction) {
        // Handle case where transaction was not found (API returned null)
        setTransactionError(`Transaction not found. It may have been deleted.`);
        setTimeout(() => setTransactionError(null), 5000); // Clear after 5 seconds
        
        // Clear transaction to find to prevent infinite loop
        setTransactionToFind(null);
        
        // Ensure URL is clean (no transaction ID parameter)
        if (navigate) {
          navigate('/transactions', { replace: true });
        }
      } else {
        // Clear any existing error messages since we found the transaction
        setTransactionError(null);
        
        // Check if we already have this transaction in our list
        const existingTx = allTransactions.find(tx => tx.id === transactionId);
        if (existingTx) {
          console.log(`Transaction ${transactionId} found in current transaction list`);
          
          // Clear any existing highlights
          clearAllHighlights();
          
          // Reset highlight state for this specific transaction
          if (hasHighlighted.current) {
            delete hasHighlighted.current[transactionId];
          }
          
          // First select the transaction
          selectTransaction(existingTx);
          
          // Use a staggered approach to ensure the transaction is scrolled to
          // First try after a short delay
          setTimeout(() => {
            scrollToTransaction(transactionId);
            
            // Then try again after DOM has definitely updated
            setTimeout(() => {
              // Double-check if scroll was successful
              const element = document.getElementById(`txn-row-${transactionId}`);
              if (element) {
                const container = tableContainerRef.current;
                if (container) {
                  const containerRect = container.getBoundingClientRect();
                  const elementRect = element.getBoundingClientRect();
                  
                  // Check if element is visible in viewport
                  const isVisible = (
                    elementRect.top >= containerRect.top &&
                    elementRect.bottom <= containerRect.bottom
                  );
                  
                  if (!isVisible) {
                    console.log('Element still not visible after initial scroll, trying one more time');
                    scrollToTransaction(transactionId);
                  }
                }
              }
            }, 800); // Wait for first scroll attempt to complete
          }, 300); // Initial delay for DOM update
        } else {
          console.log(`Transaction ${transactionId} not found in current list, expanding filter and trying data load`);
          // If the transaction is found but not in our current list, 
          // expand filter to 'all' and set transactionToFind
          if (currentFilter !== 'all') {
            console.log('Setting filter to "all" to search for transaction');
            handleFilterSelected('all');
            
            // After changing the filter, we need to wait for the transactions to reload
            // before attempting to find and highlight the transaction
            console.log('Setting up transaction to find after filter change');
            
            // Set the transaction to find regardless of filter
            // May need a second attempt even with 'all' filter if transaction is very recent
            setTransactionToFind(transactionId);
          } else {
            // Even with 'all' filter, we might need to wait for data to load
            setTransactionToFind(transactionId);
            
            // Force a refresh if it might help
            console.log('Transaction not in current data with "all" filter, trying a refresh');
            setIsRefreshing(true);
          }
        }
      }
    } catch (error) {
      console.error('Error loading transaction:', error);
      setTransactionError(`Failed to load transaction details: ${error.message || 'Unknown error'}`);
      
      // Clear transaction to find to prevent infinite loop in case of error
      setTransactionToFind(null);
    } finally {
      setLoadingTransaction(false);
    }
  };

  // Update the filtered transactions in the context whenever they change
  useEffect(() => {
    updateFilteredTransactions(filteredTransactions);
    // Clear highlights whenever the filtered transactions change
    clearAllHighlights();
  }, [filteredTransactions, updateFilteredTransactions, clearAllHighlights]);
  
  // Calculate needed padding based on balance bar height
  useEffect(() => {
    let resizeObserver;
    
    const measureAndSetPadding = () => {
      // We're now using a fixed padding, so this dynamic adjustment is no longer needed
      if (tableContainerRef.current) {
        // Make sure the inline style doesn't override our fixed value
        tableContainerRef.current.style.paddingBottom = '65px';
      }
    };
    
    // Initial measurement
    measureAndSetPadding();
    
    // Use resize observer for more accurate measurements when the balance bar changes size
    if (balanceBarRef.current) {
      resizeObserver = new ResizeObserver(() => {
        measureAndSetPadding();
      });
      resizeObserver.observe(balanceBarRef.current);
    }
    
    // Also listen for window resize events
    window.addEventListener('resize', measureAndSetPadding);
    
    // Cleanup
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', measureAndSetPadding);
    };
  }, []);

  // Data fetching effect - separated into two parts: data loading and transaction finding
  useEffect(() => {
    let isMounted = true;
    
    async function loadData() {
      const clientId = selectedClient?.id;
      if (!clientId) {
        console.error('No client selected - cannot load transaction data');
        return;
      }
      const { startDate, endDate } = getFilterDates(currentFilter); // Use current filter
      
      // Always fetch filtered transactions based on the current filter
      console.log(`Fetching transactions for filter: ${currentFilter}`);
      console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      const txnList = await fetchTransactions({ clientId, startDate, endDate });
      
      // Debug: Log transaction dates to see what we're getting
      console.log(`Loaded ${txnList.length} transactions with current filter`);
      if (txnList.length > 0) {
        const dates = txnList.map(t => {
          const date = t.date?.toDate?.() || new Date(t.date);
          return date.getFullYear();
        });
        const uniqueYears = [...new Set(dates)].sort();
        console.log('Transaction years found:', uniqueYears);
        
        // Check specifically for 2024 transactions
        const transactions2024 = txnList.filter(t => {
          const date = t.date?.toDate?.() || new Date(t.date);
          return date.getFullYear() === 2024;
        });
        console.log(`Found ${transactions2024.length} transactions from 2024`);
      }
      
      // Only update state if component is still mounted
      if (!isMounted) return;
      
      // Set the transactions in state
      console.log(`Loaded ${txnList.length} transactions with current filter`);
      setAllTransactions(txnList);
      
      // Check exchange rates when transactions are loaded
      console.log('🔄 Transactions loaded - checking exchange rates');
      checkAndUpdateRates();
      
      // Calculate balance only when needed:
      // 1. First time calculation
      // 2. Client has changed
      // 3. Explicit refresh triggered
      const currentClientId = clientId || 'unknown';
      const shouldCalculateBalance = 
        !balanceCalculation.current.calculated || 
        balanceCalculation.current.clientId !== currentClientId ||
        isRefreshing;
        
      if (shouldCalculateBalance) {
        console.log(`Calculating balance for client: ${currentClientId} (refresh=${isRefreshing})`);
        
        // Get account balances directly from the client document
        // This is the new approach - read balances from client.accounts array
        const accountsData = await getClientAccountBalances(clientId, isRefreshing);
        
        // Only show warning if we couldn't get account data
        const shouldShowWarning = !accountsData;
        console.log(`Account balances for ${clientId}:`, accountsData);
        setNoBalanceFound(shouldShowWarning);
        
        if (accountsData) {
          // With the new account balance system, we don't need to calculate deltas
          // All balances are current in the client document
          const cashBalanceTotal = accountsData.cashBalance || 0;
          const bankBalanceTotal = accountsData.bankBalance || 0;
          const totalBalance = cashBalanceTotal + bankBalanceTotal;

          setStartingBalance({ cashBalance: cashBalanceTotal, bankBalance: bankBalanceTotal });
          setBalance(totalBalance);
        } else {
          // No account data found, show zeros
          setStartingBalance({ cashBalance: 0, bankBalance: 0 });
          setBalance(0);
        }
        
        // Update our balance calculation tracking
        balanceCalculation.current = {
          calculated: true,
          clientId: currentClientId,
          lastRefreshTimestamp: Date.now()
        };
        console.log(`Balance calculation complete for client: ${currentClientId}`);
      }
      
      if (isRefreshing) {
        setIsRefreshing(false);
      }
    }

    // Execute data loading
    loadData();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
      console.log('Data fetching effect cleanup - component unmounted');
    };
  }, [selectedClient, currentFilter, isRefreshing, setIsRefreshing, checkAndUpdateRates]);
  
  // Separate effect for handling transaction finding, to avoid causing balance calculation loops
  useEffect(() => {
    // Skip this effect if there's no transaction to find
    if (!transactionToFind) return;
    
    // To track repeated attempts
    const attemptRef = { count: 0 };
    
    async function findTransactionInData() {
      console.log(`Looking for transaction: ${transactionToFind} (attempt ${attemptRef.count + 1})`);
      
      // Use the current set of transactions
      const foundTxn = allTransactions.find(tx => tx.id === transactionToFind);
      
      if (foundTxn) {
        console.log('Found transaction in loaded data, highlighting it');
        
        // Clear any existing highlights first
        clearAllHighlights();
        
        // Reset highlight tracking for this specific transaction
        if (hasHighlighted.current) {
          delete hasHighlighted.current[transactionToFind]; 
        }
        
        // Store the ID temporarily to know which one to scroll to
        const idToScrollTo = transactionToFind;
        
        // Clear the transactionToFind FIRST to prevent infinite loops
        setTransactionToFind(null);
        
        // Select the transaction
        selectTransaction(foundTxn);
        
        // Now scroll to it (using the stored ID) with a staged approach
        // First attempt with short delay
        setTimeout(() => {
          scrollToTransaction(idToScrollTo);
          
          // Second attempt after more time
          setTimeout(() => {
            // Double check if element is now in the DOM and scroll again if needed
            const element = document.getElementById(`txn-row-${idToScrollTo}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 500);
        }, 300); // Longer initial delay to ensure DOM is fully updated
        
      } else {
        // If max attempts reached, give up
        if (attemptRef.count >= 3) {
          console.log(`Failed to find transaction ${transactionToFind} after ${attemptRef.count} attempts`);
          setTransactionError(`Transaction ${transactionToFind} not found in the loaded data.`);
          setTimeout(() => setTransactionError(null), 5000);
          
          // Clear transactionToFind to break the loop
          setTransactionToFind(null);
          
          // Clean up the URL
          if (navigate) {
            navigate('/transactions', { replace: true });
          }
          return;
        }
        
        // If not found in current filter, expand filter to 'all' and try again
        if (currentFilter !== 'all') {
          console.log('Transaction not found in current filter, expanding to all transactions');
          handleFilterSelected('all');
          attemptRef.count++; // Track this attempt
          
          // Try again later after filter change has processed
          setTimeout(findTransactionInData, 500);
        } else {
          // We're already on 'all' filter, so try a refresh or wait longer
          console.log(`Transaction ${transactionToFind} not found with 'all' filter, trying refresh`);
          attemptRef.count++; // Track this attempt
          
          if (attemptRef.count === 1) {
            // On first 'all' filter attempt, try refreshing
            setIsRefreshing(true);
            setTimeout(findTransactionInData, 1000); // Try again after refresh
          } else {
            // On subsequent attempts, just try again after waiting
            setTimeout(findTransactionInData, 500);
          }
        }
      }
    }
    
    findTransactionInData();
  }, [transactionToFind, allTransactions, currentFilter, clearAllHighlights, selectTransaction, 
      handleFilterSelected, navigate, scrollToTransaction, setIsRefreshing]);

  // Check for transaction ID in URL query parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const txnId = queryParams.get('id');
    
    // Reset highlight tracking when client changes or URL changes to ensure
    // we can highlight the same transaction again if needed
    hasHighlighted.current = {};
    
    if (txnId) {
      loadSingleTransaction(txnId);
    } else {
      setTransactionToFind(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, selectedClient?.id]);

  // Effect to recalculate balance when triggered by context
  useEffect(() => {
    // Skip on initial render (when balanceUpdateTrigger is 0)
    if (balanceUpdateTrigger === 0) return;
    
    console.log('Balance update triggered by transaction operation');
    
    // Force immediate balance recalculation with cache clear
    recalculateBalances(true);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceUpdateTrigger]); // Trigger when balance update is requested

  // Fetch units data for receipt generation
  useEffect(() => {
    const fetchUnitsData = async () => {
      if (selectedClient?.id) {
        try {
          const unitsResponse = await getUnits(selectedClient.id);
          if (unitsResponse.success && (unitsResponse.units || unitsResponse.data)) {
            setUnits(unitsResponse.units || unitsResponse.data);
          }
        } catch (error) {
          console.warn('Could not fetch units data for receipt generation:', error);
        }
      }
    };
    
    fetchUnitsData();
  }, [selectedClient?.id]);

  // Confirmation modal handlers
  const handleConfirmationCancel = () => {
    console.log('❌ User cancelled transaction confirmation');
    setShowConfirmationModal(false);
    setConfirmationData(null);
    setUploadedDocuments([]);
    // Keep expense modal open for user to edit
  };

  const handleConfirmationConfirm = () => {
    console.log('✅ User acknowledged transaction confirmation - closing modal and returning to transactions');
    
    // Since transaction is already saved, just close the modal and clear everything
    setShowConfirmationModal(false);
    
    // Clear confirmation data
    setConfirmationData(null);
    setUploadedDocuments([]);
    
    // Close all modals and return to transaction list
    handleAction('clear');
  };

  // Success modal handlers
  const handleExpenseSuccessAddAnother = () => {
    console.log('💡 User chose "Add Another Expense"');
    setShowExpenseSuccessModal(false);
    setExpenseSuccessData(null);
    // Keep the expense modal open - don't call handleAction('clear')
  };

  const handleExpenseSuccessDone = () => {
    console.log('✅ User chose "Done" - closing modals');
    setShowExpenseSuccessModal(false);
    setExpenseSuccessData(null);
    // Close all modals
    handleAction('clear');
  };

  return (
    <div className="view-container">
      <ActivityActionBar>
        <button className="action-item" onClick={() => handleAction('add')}>
          <FontAwesomeIcon icon={faPlus} />
          <span>Add Expense</span>
        </button>
        <button 
          className={`action-item ${!selectedTransaction ? 'disabled' : ''}`} 
          onClick={() => handleAction('edit')}
          disabled={!selectedTransaction}
        >
          <FontAwesomeIcon icon={faEdit} />
          <span>Edit Entry</span>
        </button>
        <button 
          className={`action-item ${!selectedTransaction ? 'disabled' : ''}`}
          onClick={() => handleAction('delete')}
          disabled={!selectedTransaction}
        >
          <FontAwesomeIcon icon={faTrash} />
          <span>Delete Entry</span>
        </button>
        <button className="action-item" onClick={handleOpenAdvancedFilter}>
          <FontAwesomeIcon icon={faFilter} />
          <span>Filter</span>
        </button>
        <button className="action-item" onClick={() => handleAction('print')}>
          <FontAwesomeIcon icon={faPrint} />
          <span>Print</span>
        </button>
        <button className="action-item" onClick={() => handleAction('reconcile')}>
          <FontAwesomeIcon icon={faCheckDouble} />
          <span>Reconcile Accounts</span>
        </button>
        <button 
          className={`action-item ${!selectedTransaction || !selectedTransaction.unit ? 'disabled' : ''}`}
          onClick={handleGenerateReceipt}
          disabled={!selectedTransaction || !selectedTransaction.unit || isGeneratingReceipt}
          title={!selectedTransaction ? 'Select a transaction' : !selectedTransaction.unit ? 'Transaction must have a Unit ID' : 'Generate digital receipt'}
        >
          <FontAwesomeIcon icon={faPrint} />
          <span>{isGeneratingReceipt ? 'Preparing...' : 'Send Receipt via Email'}</span>
        </button>
      </ActivityActionBar>
      
      {noBalanceFound && (
        <div className="balance-warning">
          <strong>Warning:</strong> No balance snapshot found. Balance calculations may be inaccurate.
        </div>
      )}
      
      {loadingTransaction && (
        <div className="loading-indicator">Loading transaction...</div>
      )}
      
      {transactionError && (
        <div className="transaction-notification-bar">
          {transactionError}
        </div>
      )}
        
      <div
        className="transaction-table-container" 
        ref={tableContainerRef}
        style={{ 
          paddingBottom: "65px", /* Increased from 50px to give more room for balance bar */
          maxHeight: 'calc(100vh - 183px)', /* Adjusted for 28px status bar (was 180px for 25px status bar) */
          overflow: 'auto'
        }}
      >
        <TransactionTable 
          transactions={filteredTransactions} 
          selectedId={selectedTransaction?.id}
          clientId={selectedClient?.id}
          onSelectTransaction={(tx) => {
            clearAllHighlights(); 
            selectTransaction(tx);
          }}
          onDoubleClickTransaction={(tx) => {
            setDetailTransaction(tx);
            setShowDetailModal(true);
          }}
        />
      </div>
        
      <div 
        className="balance-bar sticky-footer clickable" 
        ref={balanceBarRef}
        onClick={async () => {
          const clientId = selectedClient?.id;
          if (!clientId) {
            console.error('No client selected - cannot recalculate balance');
            return;
          }
          console.log('Balance bar clicked, starting full balance recalculation from year-end snapshot');
          
          // Set visual feedback that recalculation is happening
          setIsRecalculatingBalance(true);
          setNoBalanceFound(true);
          
          try {
            // Perform full balance recalculation from year-end snapshot
            console.log(`Recalculating balances for ${clientId} from 2024 year-end snapshot...`);
            const recalculatedData = await recalculateClientBalances(clientId, '2024');
            
            // Update the display with the newly calculated balances
            setStartingBalance({ 
              cashBalance: recalculatedData.cashBalance, 
              bankBalance: recalculatedData.bankBalance 
            });
            setBalance(recalculatedData.totalBalance);
            setNoBalanceFound(false);
            
            // Clear the accounts cache so next fetch gets the updated data
            clearAccountsCache(clientId);
            
            // Update balance calculation tracking
            balanceCalculation.current = {
              calculated: true,
              clientId: clientId,
              lastRefreshTimestamp: Date.now()
            };
            
            console.log(`✅ Balance recalculation complete! Processed ${recalculatedData.processedTransactions} transactions`);
            console.log(`💰 New Total: $${recalculatedData.totalBalance.toLocaleString('en-US')}`);
            
          } catch (error) {
            console.error('❌ Error during balance recalculation:', error);
            setNoBalanceFound(true);
            alert(`Error recalculating balances: ${error.message}`);
          } finally {
            setIsRecalculatingBalance(false);
          }
        }}
        title="Click to recalculate balances from year-end snapshot and update master record"
        style={{ 
          opacity: isRecalculatingBalance ? 0.7 : 1,
          cursor: isRecalculatingBalance ? 'wait' : 'pointer'
        }}
      >
        {isRecalculatingBalance ? (
          <>
            🔄 Recalculating balances from year-end snapshot...
            <div className="refresh-hint">⏳</div>
          </>
        ) : (
          <>
            🏦 Cash: ${Math.round(startingBalance?.cashBalance || 0).toLocaleString('en-US')}
            &nbsp;&nbsp;
            🏛️ Bank: ${Math.round(startingBalance?.bankBalance || 0).toLocaleString('en-US')}
            &nbsp;&nbsp;
            💰 Total: ${Math.round(balance || 0).toLocaleString('en-US')}
            <div className="refresh-hint">↻</div>
          </>
        )}
      </div>
      
      {showFilterModal && (
        <FilterSwitchModal
          onClose={() => handleFilterSelected(null)}
          onFilterSelected={handleFilterSelected}
          selectedFilter={currentFilter}
        />
      )}

      {showExpenseModal && (
        <UnifiedExpenseEntry
          mode="modal"
          isOpen={showExpenseModal}
          onClose={() => {
            console.log('UnifiedExpenseEntry onClose in TransactionsView');
            try {
              // Make sure we're accessing the function from TransactionsContext
              handleAction('clear'); // This should handle clearing selection and closing the modal
            } catch (error) {
              console.error('Error in UnifiedExpenseEntry onClose handler:', error);
            }
          }}
          onSubmit={async (data) => {
            console.log('TransactionsView: ExpenseModal onSubmit with data:', data);
            
            try {
              const clientId = selectedClient?.id;
              if (!clientId) {
                throw new Error('No client selected - cannot add transaction');
              }
              
              // Clean the data - remove File objects before passing to save functions
              const cleanData = { ...data };
              if (cleanData.documents) {
                // Remove the File objects - the save functions handle uploads separately
                delete cleanData.documents;
              }
              
              // Use the existing working transaction save system (don't touch uploads!)
              let savedTransaction;
              if (selectedTransaction) {
                savedTransaction = await editTransaction(selectedTransaction.id, cleanData);
              } else {
                savedTransaction = await addTransaction(cleanData);
              }
              
              // Set refresh to update the transaction list
              setIsRefreshing(true);
              
              console.log('✅ Transaction saved successfully, showing sophisticated confirmation modal');
              
              // AFTER successful save, show sophisticated confirmation modal with real transaction data
              setConfirmationData({
                date: data.date,
                amount: data.amount,
                vendor: data.vendor,
                category: data.category,
                account: data.account,
                accountType: data.account,
                paymentMethod: data.paymentMethod,
                notes: data.notes,
                type: 'expense',
                clientId: clientId,
                transactionId: savedTransaction?.id || 'saved',
                saved: true // Flag to show this is post-save
              });
              
              // Handle document previews for sophisticated modal
              if (data.documents && data.documents.length > 0) {
                setUploadedDocuments(data.documents.map(doc => ({
                  name: doc.name,
                  size: doc.size,
                  type: doc.type,
                  uploaded: true // Documents are already uploaded and linked
                })));
              } else {
                setUploadedDocuments([]);
              }
              
              // Show sophisticated confirmation modal AFTER saving
              setShowConfirmationModal(true);
              
            } catch (error) {
              console.error('❌ Failed to save transaction:', error);
              alert(`Error saving transaction: ${error.message || 'Unknown error'}`);
            }
          }}
          initialData={selectedTransaction}
        />
      )}

      {showDetailModal && (
        <TransactionDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          transaction={detailTransaction}
          clientId={selectedClient?.id}
        />
      )}

      {showAdvancedFilterModal && (
        <AdvancedFilterModal
          isOpen={showAdvancedFilterModal}
          onClose={handleCloseAdvancedFilter}
          onApplyFilters={handleAdvancedFiltersApply}
          currentFilters={advancedFilters}
          transactions={allTransactions}
        />
      )}

      {showDigitalReceipt && receiptTransactionData && (
        <div className="modal-overlay" onClick={() => setShowDigitalReceipt(false)}>
          <div className="modal-content digital-receipt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Digital Receipt</h2>
              <button className="close-button" onClick={() => setShowDigitalReceipt(false)}>×</button>
            </div>
            <DigitalReceipt 
              transactionData={receiptTransactionData}
              clientData={{
                id: selectedClient?.id,
                name: selectedClient?.name || 'Client Name Not Available',
                logoUrl: selectedClient?.logoUrl || '/sandyland-logo.png'
              }}
              showPreview={true}
              onImageGenerated={(blob) => {
                console.log('Receipt image generated:', blob);
              }}
              onEmailSent={(result) => {
                console.log('Email sent successfully:', result);
                setShowDigitalReceipt(false);
              }}
              // Pass notification handlers down to override internal ones
              onEmailSuccess={showEmailSuccess}
              onEmailError={showError}
            />
          </div>
        </div>
      )}

      {/* Sophisticated Transaction Confirmation Modal - shows AFTER saving with real transaction data */}
      {showConfirmationModal && confirmationData && (
        <TransactionConfirmationModal
          isOpen={showConfirmationModal}
          onClose={handleConfirmationCancel}
          onConfirm={handleConfirmationConfirm}
          transactionData={confirmationData}
          uploadedDocuments={uploadedDocuments}
        />
      )}

      {/* Expense Success Modal - shows AFTER saving */}
      {showExpenseSuccessModal && expenseSuccessData && (
        <ExpenseSuccessModal
          isOpen={showExpenseSuccessModal}
          transactionData={expenseSuccessData}
          onAddAnother={handleExpenseSuccessAddAnother}
          onDone={handleExpenseSuccessDone}
        />
      )}

      {/* Global Notification Modal - renders at root level to avoid z-index issues */}
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        details={notification.details}
      />

    </div>
  );
}

export default TransactionsView;

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import TransactionTable from '../components/TransactionTable';
import TransactionDetailModal from '../components/TransactionDetailModal';
import AdvancedFilterModal from '../components/AdvancedFilterModal';
import DigitalReceipt from '../components/DigitalReceipt';
import NotificationModal from '../components/NotificationModal';
import { useNotification } from '../hooks/useNotification';
import { getUnits } from '../api/units';
import { getCategories } from '../api/categories';
import { getVendors } from '../api/vendors';
import { clientAPI } from '../api/client';
import { fetchTransactions } from '../utils/fetchTransactions';
import { getClientAccountBalances, clearAccountsCache } from '../utils/clientAccounts';
import { recalculateClientBalances } from '../utils/balanceRecalculation';
import { getDateRangeForFilter } from '../utils/timezone';
import { getFiscalYear } from '../utils/fiscalYearUtils';
import FilterSwitchModal from '../components/FilterSwitchModal';
import { useClient } from '../context/ClientContext';
import { useTransactionsContext } from '../context/TransactionsContext';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { useExchangeRates } from '../hooks/useExchangeRates';
import ActivityActionBar from '../components/common/ActivityActionBar';
import UnifiedExpenseEntry from '../components/UnifiedExpenseEntry';
import ExpenseSuccessModal from '../components/ExpenseSuccessModal';
import TransactionConfirmationModal from '../components/TransactionConfirmationModal';
import SplitEntryModal from '../components/transactions/SplitEntryModal';
import { LoadingSpinner } from '../components/common';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getTransactionById } from '../api/hoaDuesService';
import { generateTransactionReceipt } from '../utils/receiptUtils';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
import { isSuperAdmin } from '../utils/userRoles';

function TransactionsView() {
  const { samsUser } = useAuth(); // Get user for role checking
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
    handleAdvancedFiltersApply,
    handleDateRangeSelect
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
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  
  // State for ALL transactions (unfiltered) - used by Advanced Filter
  const [allTransactionsUnfiltered, setAllTransactionsUnfiltered] = useState([]);
  
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
    showSplitEntryModal,
    setShowSplitEntryModal,
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
    balanceUpdateTrigger,
    isSplitTransaction
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
    const transactionUnit = selectedTransaction?.unitId || selectedTransaction?.unit;
    if (!selectedTransaction || !transactionUnit) {
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

  // Apply date filters based on the current filter - now using Mexico City timezone
  const getFilterDates = (filterType) => {
    console.log(`🕐 [TIMEZONE FIX] Getting filter dates for: ${filterType}`);
    
    // Pass client config to timezone utility for fiscal year support
    const dateRange = getDateRangeForFilter(filterType, selectedClient);
    
    // Handle different return formats from the timezone utility
    let startDate, endDate;
    if (dateRange.startUTC && dateRange.endUTC) {
      // For 'today' and 'yesterday' which return { startUTC, endUTC }
      startDate = dateRange.startUTC;
      endDate = dateRange.endUTC;
    } else {
      // For other filters which return { startDate, endDate }
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    }
    
    console.log(`🕐 [TIMEZONE FIX] Filter ${filterType} date range:`, {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      startLocal: startDate.toLocaleString(),
      endLocal: endDate.toLocaleString()
    });
    
    return { startDate, endDate };
  };

  // Apply the comprehensive filtering system to transactions and sort by date
  const filteredTransactions = useMemo(() => {
    // Check if advanced filters are active
    const hasAdvancedFilters = Object.keys(advancedFilters).length > 0;
    
    // If advanced filters are active, start with ALL unfiltered transactions
    // Otherwise, use the date-filtered transactions
    const transactionsToFilter = hasAdvancedFilters && allTransactionsUnfiltered.length > 0 
      ? allTransactionsUnfiltered 
      : allTransactions;
    
    if (!transactionsToFilter.length) return [];
    
    // Start with appropriate transaction set
    let filtered = [...transactionsToFilter];
    
    console.log(`🔧 [FILTER FIX] Starting filter with ${filtered.length} transactions`);
    console.log(`🔧 [FILTER FIX] Advanced filters active:`, hasAdvancedFilters);
    console.log(`🔧 [FILTER FIX] Using ${hasAdvancedFilters ? 'ALL unfiltered' : 'date-filtered'} transactions`);
    console.log(`🔧 [FILTER FIX] Current filter:`, currentFilter);
    console.log(`🔧 [FILTER FIX] Current date range:`, currentDateRange);
    
    if (hasAdvancedFilters) {
      // ADVANCED FILTERS MODE: Override quick filters completely
      console.log(`🔧 [FILTER FIX] Applying advanced filters (overriding quick filters)`);
      
      filtered = filtered.filter(transaction => {
        // Vendor filter (case-insensitive, supports arrays)
        if (advancedFilters.vendor && advancedFilters.vendor.length > 0) {
          const vendorMatches = advancedFilters.vendor.some(selectedVendor => 
            transaction.vendorName?.toLowerCase() === selectedVendor?.toLowerCase()
          );
          if (!vendorMatches) {
            return false;
          }
        }
        
        // Category filter (case-insensitive, supports arrays)
        if (advancedFilters.category && advancedFilters.category.length > 0) {
          const categoryMatches = advancedFilters.category.some(selectedCategory => 
            transaction.categoryName?.toLowerCase() === selectedCategory?.toLowerCase()
          );
          if (!categoryMatches) {
            return false;
          }
        }
        
        // Unit filter (supports arrays)
        if (advancedFilters.unit && advancedFilters.unit.length > 0) {
          const txUnit = transaction.unitId || transaction.unit;
          const unitMatches = advancedFilters.unit.some(selectedUnit => 
            txUnit === selectedUnit
          );
          if (!unitMatches) {
            return false;
          }
        }
        
        // Account filter (case-insensitive, supports arrays)
        if (advancedFilters.account && advancedFilters.account.length > 0) {
          const accountMatches = advancedFilters.account.some(selectedAccount => 
            transaction.accountName?.toLowerCase() === selectedAccount?.toLowerCase()
          );
          if (!accountMatches) {
            return false;
          }
        }
        
        // Amount range filter
        const amount = parseFloat(transaction.amount) || 0;
        if (advancedFilters.minAmount && amount < parseFloat(advancedFilters.minAmount)) {
          return false;
        }
        if (advancedFilters.maxAmount && amount > parseFloat(advancedFilters.maxAmount)) {
          return false;
        }
        
        // Date range filter (using Mexico timezone for advanced filters too)
        if (advancedFilters.startDate || advancedFilters.endDate) {
          // Handle formatted date from API (has timestamp field)
          const txDate = transaction.date?.timestamp ? 
            (transaction.date.timestamp._seconds ? new Date(transaction.date.timestamp._seconds * 1000) : new Date(transaction.date.timestamp)) :
            new Date(transaction.date?.iso || transaction.date);
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
      
      console.log(`🔧 [FILTER FIX] Advanced filters result: ${filtered.length} transactions`);
      
    } else {
      // QUICK FILTERS MODE: Apply quick/date range filters
      console.log(`🔧 [FILTER FIX] Applying quick filters (no advanced filters active)`);
      
      // Apply legacy filter first (for backward compatibility with existing filter system)
      if (currentFilter && currentFilter !== 'all') {
        const { startDate, endDate } = getFilterDates(currentFilter);
        filtered = filtered.filter(txn => {
          // Handle formatted date from API (has timestamp field)
          const txnDate = txn.date?.timestamp ? 
            (txn.date.timestamp._seconds ? new Date(txn.date.timestamp._seconds * 1000) : new Date(txn.date.timestamp)) :
            new Date(txn.date?.iso || txn.date);
          return txnDate >= startDate && txnDate <= endDate;
        });
        console.log(`🔧 [FILTER FIX] Quick filter '${currentFilter}' result: ${filtered.length} transactions`);
      }
      
      // Apply new date range filter (from DateRangeDropdown)
      if (currentDateRange && currentDateRange !== 'all' && currentDateRange !== currentFilter) {
        const { startDate, endDate } = getFilterDates(currentDateRange);
        filtered = filtered.filter(txn => {
          // Handle formatted date from API (has timestamp field)
          const txnDate = txn.date?.timestamp ? 
            (txn.date.timestamp._seconds ? new Date(txn.date.timestamp._seconds * 1000) : new Date(txn.date.timestamp)) :
            new Date(txn.date?.iso || txn.date);
          return txnDate >= startDate && txnDate <= endDate;
        });
        console.log(`🔧 [FILTER FIX] Date range filter '${currentDateRange}' result: ${filtered.length} transactions`);
      }
    }
    
    // Apply global search (always applied regardless of filter mode)
    if (globalSearchTerm) {
      const lowerSearchTerm = globalSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(transaction => {
        const txUnit = transaction.unitId || transaction.unit;
        const searchableFields = [
          transaction.vendorName,
          transaction.categoryName,
          txUnit,
          transaction.accountName,
          transaction.notes,
          transaction.description,
          transaction.date,
          transaction.amount?.toString()
        ];
        
        return searchableFields.some(field => 
          field && field.toString().toLowerCase().includes(lowerSearchTerm)
        );
      });
      console.log(`🔧 [FILTER FIX] Global search '${globalSearchTerm}' result: ${filtered.length} transactions`);
    }
    
    // Sort by transaction ID which contains datetime (ascending order - oldest first, most recent at bottom)
    // Transaction IDs are in format: YYYYMMDD_HHMMSS_xxx
    return filtered.sort((a, b) => {
      const idA = a.id || '';
      const idB = b.id || '';
      
      // Extract date parts from transaction IDs
      // Format: YYYYMMDD_HHMMSS_xxx
      const datePartA = idA.substring(0, 15); // Gets YYYYMMDD_HHMMSS
      const datePartB = idB.substring(0, 15);
      
      // Debug logging for same-day transactions
      if (idA.substring(0, 8) === idB.substring(0, 8)) {
        console.debug(`📅 Same-day transactions sorted by time: ${idA} vs ${idB}`);
      }
      
      // String comparison works because format is YYYYMMDD_HHMMSS
      return datePartA.localeCompare(datePartB);
    });
  }, [allTransactions, allTransactionsUnfiltered, currentFilter, globalSearchTerm, currentDateRange, advancedFilters]);

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
      
      // Determine the correct year for balance recalculation
      const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
      const currentDate = new Date();
      const yearForSnapshot = getFiscalYear(currentDate, fiscalYearStartMonth) - 1; // Previous fiscal year
      
      // For transaction changes, we need to actually recalculate balances
      // from the year-end snapshot, not just read current balances
      const recalculatedData = await recalculateClientBalances(clientId, yearForSnapshot.toString());
      
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
    
    console.log(`Loading transaction ${transactionId} for client ${selectedClient.id}, current filter: "${currentFilter}"`);
    setLoadingTransaction(true);
    setTransactionError(null);
    
    try {
      // Step 1: Check if transaction exists in current filtered results
      const existingTx = allTransactions.find(tx => tx.id === transactionId);
      if (existingTx) {
        console.log(`Transaction ${transactionId} found in current filtered view`);
        
        // Clear any existing highlights and select the transaction
        clearAllHighlights();
        if (hasHighlighted.current) {
          delete hasHighlighted.current[transactionId]; 
        }
        selectTransaction(existingTx);
        setTransactionError(null);
        
        // Scroll to the transaction
        setTimeout(() => {
          scrollToTransaction(transactionId);
        }, 300);
        
        return; // Found in current filter, we're done
      }
      
      // Step 2: Not in current filter, check if it exists at all (ignoring filters)
      console.log(`Transaction ${transactionId} not in current filter, checking if it exists in database`);
      const transaction = await getTransactionById(selectedClient.id, transactionId);
      
      if (!transaction) {
        // Step 3a: Transaction doesn't exist at all
        console.log('Transaction not found in database - may have been deleted');
        setTransactionError(`Transaction not found. It may have been deleted.`);
        setTimeout(() => setTransactionError(null), 5000);
        
        // Clean up URL
        if (navigate) {
          navigate('/transactions', { replace: true });
        }
      } else {
        // Step 3b: Transaction exists but not in current filter - expand to "All Time"
        console.log(`Transaction found in database but not in current filter - expanding to "All Time"`);
        setTransactionError(null);
        
        // Reset to "All Time" to show the transaction
        handleDateRangeSelect({ value: 'all' });
        
        // Set up to find and highlight the transaction after filter change
        setTransactionToFind(transactionId);
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
          // Handle formatted date from API
          const date = t.date?.timestamp ? 
            (t.date.timestamp._seconds ? new Date(t.date.timestamp._seconds * 1000) : new Date(t.date.timestamp)) :
            new Date(t.date?.iso || t.date);
          return date.getFullYear();
        });
        const uniqueYears = [...new Set(dates)].sort();
        console.log('Transaction years found:', uniqueYears);
        
        // Check specifically for 2024 transactions
        const transactions2024 = txnList.filter(t => {
          // Handle formatted date from API
          const date = t.date?.timestamp ? 
            (t.date.timestamp._seconds ? new Date(t.date.timestamp._seconds * 1000) : new Date(t.date.timestamp)) :
            new Date(t.date?.iso || t.date);
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
  
  // Effect for handling transaction finding after filter change
  useEffect(() => {
    // Skip this effect if there's no transaction to find
    if (!transactionToFind) return;
    
    console.log(`Looking for transaction: ${transactionToFind} in loaded data`);
    
    // Find the transaction in the current loaded data
    const foundTxn = allTransactions.find(tx => tx.id === transactionToFind);
    
    if (foundTxn) {
      console.log('Found transaction in loaded data, highlighting it');
      
      // Clear any existing highlights first
      clearAllHighlights();
      
      // Reset highlight tracking for this specific transaction
      if (hasHighlighted.current) {
        delete hasHighlighted.current[transactionToFind]; 
      }
      
      // Store the ID before clearing transactionToFind
      const idToScrollTo = transactionToFind;
      
      // Clear transactionToFind first to prevent loops
      setTransactionToFind(null);
      
      // Select the transaction
      selectTransaction(foundTxn);
      
      // Scroll to it with a delay
      setTimeout(() => {
        scrollToTransaction(idToScrollTo);
      }, 300);
    }
    // If not found, wait for the next data load (from the filter change)
  }, [transactionToFind, allTransactions, clearAllHighlights, selectTransaction, scrollToTransaction]);

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

  // Fetch categories data for advanced filters
  useEffect(() => {
    const fetchCategoriesData = async () => {
      if (selectedClient?.id) {
        try {
          const categoriesResponse = await getCategories(selectedClient.id);
          if (categoriesResponse.success && categoriesResponse.data) {
            setCategories(categoriesResponse.data);
          }
        } catch (error) {
          console.warn('Could not fetch categories data for filters:', error);
        }
      }
    };

    fetchCategoriesData();
  }, [selectedClient?.id]);

  // Fetch vendors data for advanced filters
  useEffect(() => {
    const fetchVendorsData = async () => {
      if (selectedClient?.id) {
        try {
          const vendorsResponse = await getVendors(selectedClient.id);
          if (vendorsResponse.success && vendorsResponse.data) {
            setVendors(vendorsResponse.data);
          }
        } catch (error) {
          console.warn('Could not fetch vendors data for filters:', error);
        }
      }
    };

    fetchVendorsData();
  }, [selectedClient?.id]);

  // Fetch accounts data for advanced filters
  useEffect(() => {
    console.log('🏦 TransactionsView - useEffect triggered, selectedClient:', selectedClient);
    const fetchAccountsData = async () => {
      if (selectedClient?.id) {
        try {
          console.log('🏦 TransactionsView - Fetching accounts for client:', selectedClient.id);
          const accountsResponse = await clientAPI.getAccounts(selectedClient.id);
          console.log('🏦 TransactionsView - Accounts response:', accountsResponse);
          
          // Handle different response formats
          let accountsData;
          if (accountsResponse.success && accountsResponse.data) {
            // Format: {success: true, data: [...]}
            accountsData = accountsResponse.data;
          } else if (Array.isArray(accountsResponse)) {
            // Format: [{...}, {...}] (direct array)
            accountsData = accountsResponse;
          } else if (accountsResponse.data) {
            // Format: {data: [...]} (no success field)
            accountsData = accountsResponse.data;
          } else {
            accountsData = [];
          }
          
          console.log('🏦 TransactionsView - Setting accounts:', accountsData);
          setAccounts(accountsData);
        } catch (error) {
          console.error('🏦 TransactionsView - Error fetching accounts:', error);
          // Set empty array on error - no fallback accounts
          setAccounts([]);
        }
      } else {
        console.log('🏦 TransactionsView - No client selected, not fetching accounts');
      }
    };

    fetchAccountsData();
  }, [selectedClient?.id]);

  // Fetch ALL transactions when Advanced Filter modal is opened
  useEffect(() => {
    const fetchAllTransactions = async () => {
      if (showAdvancedFilterModal && selectedClient?.id && allTransactionsUnfiltered.length === 0) {
        try {
          console.log('🔍 Fetching ALL transactions for Advanced Filter...');
          // Fetch with very wide date range to get ALL transactions
          const allTxns = await fetchTransactions({ 
            clientId: selectedClient.id,
            startDate: new Date('2020-01-01'), // Start from 2020
            endDate: new Date('2099-12-31')   // End in far future
          });
          console.log(`✅ Loaded ${allTxns.length} total transactions for Advanced Filter`);
          setAllTransactionsUnfiltered(allTxns);
        } catch (error) {
          console.error('Error fetching all transactions for filter:', error);
        }
      }
    };
    
    fetchAllTransactions();
  }, [showAdvancedFilterModal, selectedClient?.id, allTransactionsUnfiltered.length]);

  // Clear unfiltered transactions when client changes
  useEffect(() => {
    setAllTransactionsUnfiltered([]);
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
        {/* Only SuperAdmin can add transactions */}
        {isSuperAdmin(samsUser) && (
          <button className="action-item" onClick={() => handleAction('add')}>
            <FontAwesomeIcon icon={faPlus} />
            <span>Add Expense</span>
          </button>
        )}
        
        {/* Only SuperAdmin can edit transactions */}
        {isSuperAdmin(samsUser) && (
          <button 
            className={`action-item ${!selectedTransaction ? 'disabled' : ''}`} 
            onClick={() => handleAction('edit')}
            disabled={!selectedTransaction}
          >
            <FontAwesomeIcon icon={faEdit} />
            <span>Edit Entry</span>
          </button>
        )}
        
        {/* Only SuperAdmin can delete transactions */}
        {isSuperAdmin(samsUser) && (
          <button 
            className={`action-item ${!selectedTransaction ? 'disabled' : ''}`}
            onClick={() => handleAction('delete')}
            disabled={!selectedTransaction}
          >
            <FontAwesomeIcon icon={faTrash} />
            <span>Delete Entry</span>
          </button>
        )}
        <button 
          className={`action-item ${Object.keys(advancedFilters).length > 0 ? 'filtered-active' : ''}`} 
          onClick={handleOpenAdvancedFilter}
          title={Object.keys(advancedFilters).length > 0 ? `Advanced filters active (${filteredTransactions.length} results)` : 'Open advanced filters'}
        >
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
          {isGeneratingReceipt ? (
            <LoadingSpinner variant="logo" size="small" color="white" show={true} />
          ) : (
            <FontAwesomeIcon icon={faPrint} />
          )}
          <span>{isGeneratingReceipt ? 'Preparing...' : 'Send Receipt via Email'}</span>
        </button>
      </ActivityActionBar>
      
      {noBalanceFound && (
        <div className="balance-warning">
          <strong>Warning:</strong> No balance snapshot found. Balance calculations may be inaccurate.
        </div>
      )}
      
      {loadingTransaction && (
        <LoadingSpinner variant="logo" message="Loading transaction..." size="small" />
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
            // Determine the correct year for balance recalculation
            const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
            const currentDate = new Date();
            const yearForSnapshot = getFiscalYear(currentDate, fiscalYearStartMonth) - 1; // Previous fiscal year
            
            // Perform full balance recalculation from year-end snapshot
            console.log(`Recalculating balances for ${clientId} from ${yearForSnapshot} year-end snapshot...`);
            const recalculatedData = await recalculateClientBalances(clientId, yearForSnapshot.toString());
            
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LoadingSpinner variant="logo" size="small" color="white" show={true} />
            <span>Recalculating balances from year-end snapshot...</span>
          </div>
        ) : (
          <>
            🏦 Cash: ${Math.round((startingBalance?.cashBalance || 0) / 100).toLocaleString('en-US')}
            &nbsp;&nbsp;
            🏛️ Bank: ${Math.round((startingBalance?.bankBalance || 0) / 100).toLocaleString('en-US')}
            &nbsp;&nbsp;
            💰 Total: ${Math.round((balance || 0) / 100).toLocaleString('en-US')}
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
          initialData={selectedTransaction ? (() => {
            // Robust field extraction handling multiple data structure possibilities
            const extractField = (obj, fieldNames) => {
              for (const fieldName of fieldNames) {
                if (obj[fieldName]) return obj[fieldName];
                // Handle nested fields like vendor.stringValue
                if (obj[fieldName]?.stringValue) return obj[fieldName].stringValue;
                if (obj[fieldName]?.value) return obj[fieldName].value;
              }
              return '';
            };
            
            const extractDate = (dateField) => {
              if (!dateField) return '';
              // Handle formatted date from API
              if (dateField.iso) return dateField.iso.split('T')[0];
              if (dateField.timestamp?._seconds) return new Date(dateField.timestamp._seconds * 1000).toISOString().split('T')[0];
              if (dateField.toDate) return dateField.toDate().toISOString().split('T')[0];
              if (dateField.timestampValue) return new Date(dateField.timestampValue).toISOString().split('T')[0];
              if (dateField._seconds) return new Date(dateField._seconds * 1000).toISOString().split('T')[0];
              return new Date(dateField).toISOString().split('T')[0];
            };
            
            const extractAmount = (amountField) => {
              if (!amountField && amountField !== 0) return '';
              if (amountField.integerValue !== undefined) return Math.abs(amountField.integerValue / 100);
              return Math.abs((amountField || 0) / 100);
            };
            
            return {
              date: extractDate(selectedTransaction.date),
              amount: extractAmount(selectedTransaction.amount),
              vendor: extractField(selectedTransaction, ['vendorName']), // Use vendorName only
              category: extractField(selectedTransaction, ['categoryName']), // Use categoryName only
              account: extractField(selectedTransaction, ['accountName']), // Use accountName only
              paymentMethod: extractField(selectedTransaction, ['paymentMethod']),
              unit: extractField(selectedTransaction, ['unitId']), // Use unitId only
              notes: extractField(selectedTransaction, ['notes'])
            };
          })() : null}
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
              
              // Use the atomic workflow for file uploads (same as UnifiedExpenseEntry direct mode)
              let savedTransaction;
              let transactionId;
              if (selectedTransaction) {
                // For editing, use the existing edit function
                savedTransaction = await editTransaction(selectedTransaction.id, data);
                transactionId = selectedTransaction.id; // Use the existing transaction ID
              } else {
                // For new transactions, implement atomic workflow
                console.log('🔄 Implementing atomic upload workflow for new transaction');
                
                // Step 1: Upload documents if any are selected
                let uploadedDocuments = [];
                if (data.documents && data.documents.length > 0) {
                  console.log('📤 Uploading documents first...');
                  const { uploadDocumentsForTransaction } = await import('../api/documents');
                  
                  // Extract file objects from the documents array
                  const filesToUpload = data.documents.map(doc => doc.file);
                  
                  uploadedDocuments = await uploadDocumentsForTransaction(
                    clientId, 
                    filesToUpload, 
                    'receipt', 
                    'expense_receipt'
                  );
                  console.log('✅ Documents uploaded:', uploadedDocuments.map(d => d.id));
                }

                // Step 2: Create transaction with document references (no File objects)
                // EXPLICIT FIELD MAPPING: Needed to handle undefined values properly
                const cleanTransactionData = {
                  date: data.date,
                  amount: data.amount,
                  // Include ID fields (primary data) with null fallbacks to prevent undefined
                  categoryId: data.categoryId || null,
                  vendorId: data.vendorId || null,
                  paymentMethodId: data.paymentMethodId || null,
                  accountId: data.accountId || null,
                  unitId: data.unitId || null,
                  // Include other required fields
                  notes: data.notes || '',
                  accountType: data.accountType || 'bank',
                  type: data.type,
                  clientId: data.clientId,
                  enteredBy: data.enteredBy,
                  // Include allocations for split transactions
                  ...(data.allocations && { allocations: data.allocations }),
                  documents: uploadedDocuments.map(doc => doc.id), // Replace File objects with document IDs
                };

                console.log('📄 Creating transaction with clean data:', cleanTransactionData);
                transactionId = await addTransaction(cleanTransactionData);
                
                // Step 3: Link documents to transaction bidirectionally
                if (uploadedDocuments.length > 0) {
                  console.log('🔗 Linking documents to transaction...');
                  const { linkDocumentsToTransaction } = await import('../api/documents');
                  await linkDocumentsToTransaction(
                    clientId, 
                    uploadedDocuments.map(d => d.id), 
                    transactionId
                  );
                  console.log('✅ Documents linked to transaction');
                }
                
                savedTransaction = { id: transactionId, ...cleanTransactionData };
                console.log('✅ Atomic expense submission complete');
              }
              
              // Set refresh to update the transaction list
              setIsRefreshing(true);
              
              console.log('✅ Transaction saved successfully, fetching real transaction data for confirmation modal');
              
              // Fetch the saved transaction to get formatted dates
              let formattedTransaction = null;
              try {
                formattedTransaction = await getTransactionById(clientId, transactionId);
                console.log('✅ Fetched formatted transaction with proper dates');
              } catch (error) {
                console.warn('Could not fetch formatted transaction, using input data', error);
              }
              
              // AFTER successful save, show sophisticated confirmation modal with real transaction data
              setConfirmationData({
                date: formattedTransaction?.date || data.date, // Use formatted date if available
                amount: data.amount,
                vendor: data.vendorName,
                category: data.categoryName,
                account: data.accountName,
                accountType: data.accountType,
                paymentMethod: data.paymentMethod,
                notes: data.notes,
                type: 'expense',
                clientId: clientId,
                transactionId: transactionId,
                saved: true // Flag to show this is post-save
              });
              
              // Get real document data after successful save
              if (data.documents && data.documents.length > 0 && transactionId) {
                try {
                  // Import the getTransactionDocuments function
                  const { getTransactionDocuments } = await import('../api/documents');
                  
                  console.log('📄 Fetching real document data for transaction:', transactionId);
                  const realDocuments = await getTransactionDocuments(clientId, transactionId);
                  
                  console.log('📄 Retrieved real documents:', realDocuments);
                  setUploadedDocuments(realDocuments.map(doc => ({
                    id: doc.id,
                    name: doc.filename || doc.originalName,
                    size: doc.size,
                    type: doc.mimeType,
                    downloadURL: doc.downloadURL, // Real URL for DocumentViewer
                    uploaded: true
                  })));
                } catch (docError) {
                  console.warn('Could not fetch real document data, using basic info:', docError);
                  // Fallback to basic document info
                  setUploadedDocuments(data.documents.map(doc => ({
                    name: doc.name,
                    size: doc.size,
                    type: doc.type,
                    uploaded: true
                  })));
                }
              } else {
                setUploadedDocuments([]);
              }
              
              // Show sophisticated confirmation modal AFTER saving
              setShowConfirmationModal(true);
              
            } catch (error) {
              console.error('❌ Failed to save transaction:', error);
              
              // Enhanced error handling for validation failures
              if (error.isValidationError && error.validationErrors) {
                const errorMessages = Array.isArray(error.validationErrors) 
                  ? error.validationErrors 
                  : [error.validationErrors];
                
                const formattedErrors = errorMessages.map(err => `• ${err}`).join('\n');
                alert(`Transaction Validation Failed:\n\n${formattedErrors}\n\nPlease check your data and try again.`);
              } else if (error.message && error.message.includes('validation failed')) {
                // Handle validation errors that come as strings
                alert(`Validation Error:\n\n${error.message}\n\nPlease check your data and try again.`);
              } else {
                // Generic error fallback
                alert(`Error saving transaction:\n\n${error.message || 'Unknown error occurred. Please try again.'}`);
              }
            }
          }}
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
          transactions={allTransactionsUnfiltered}
          units={units}
          categories={categories}
          vendors={vendors}
          accounts={accounts}
        />
      )}
      
      {/* Debug accounts data when modal is open */}
      {showAdvancedFilterModal && console.log('🏦 TransactionsView - Passing accounts to modal:', accounts)}

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

      {/* Split Entry Modal - for editing split transactions */}
      {showSplitEntryModal && selectedTransaction && (
        <SplitEntryModal
          isOpen={showSplitEntryModal}
          onClose={() => setShowSplitEntryModal(false)}
          onSave={async (allocations) => {
            try {
              // Convert transaction data for split modal format
              const transactionData = {
                date: selectedTransaction.date?.display || selectedTransaction.date,
                vendorName: selectedTransaction.vendorName || selectedTransaction.vendor,
                amount: selectedTransaction.amount,
                accountType: selectedTransaction.accountType || selectedTransaction.accountName,
                paymentMethod: selectedTransaction.paymentMethod,
                notes: selectedTransaction.notes,
                allocations: allocations
              };
              
              console.log('Saving split transaction edit:', transactionData);
              
              // Update the transaction using editTransaction from context
              const result = await editTransaction(selectedTransaction.id, transactionData);
              
              if (result) {
                console.log('✅ Split transaction updated successfully');
                setShowSplitEntryModal(false);
                
                // Show success notification
                showSuccess('Split Transaction Updated', 
                  `Updated transaction for ${transactionData.vendorName} with ${allocations.length} allocations`);
                
                // Refresh the transaction list
                setIsRefreshing(true);
              } else {
                throw new Error('Failed to update split transaction');
              }
            } catch (error) {
              console.error('❌ Error updating split transaction:', error);
              showError('Update Failed', `Failed to update split transaction: ${error.message}`);
            }
          }}
          transactionData={selectedTransaction ? {
            date: selectedTransaction.date?.display || selectedTransaction.date,
            vendorName: selectedTransaction.vendorName || selectedTransaction.vendor,
            amount: selectedTransaction.amount,
            accountType: selectedTransaction.accountType || selectedTransaction.accountName,
            paymentMethod: selectedTransaction.paymentMethod,
            notes: selectedTransaction.notes
          } : null}
          existingAllocations={selectedTransaction?.allocations || []}
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

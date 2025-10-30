import React, { useState, useEffect } from 'react';
import { useHOADues } from '../context/HOADuesContext';
import { useClient } from '../context/ClientContext';
import { 
  formatAsMXN, 
  getMonthName, 
  generateMonthsDescription
} from '../utils/hoaDuesUtils';
import { formatUnitIdWithOwnerAndDues, sortUnitsByUnitId } from '../utils/unitUtils';
import { recordDuesPayment as apiRecordDuesPayment } from '../api/hoaDuesService';
import { generateHOADuesReceipt } from '../utils/receiptUtils';
import hoaDuesAPI from '../api/hoaDuesAPI';
import { getPaymentMethods } from '../api/paymentMethods';
import { getAuthInstance } from '../firebaseClient';
import DigitalReceipt from '../components/DigitalReceipt';
import NotificationModal from './NotificationModal';
import { useNotification } from '../hooks/useNotification';
import { getMexicoDateString, getMexicoDate } from '../utils/timezone';
import { useTransactionsContext } from '../context/TransactionsContext';
import { getFiscalYear } from '../utils/fiscalYearUtils';
import './DuesPaymentModal.css';

function DuesPaymentModal({ isOpen, onClose, unitId, monthIndex }) {
  const { selectedClient } = useClient();
  const {
    units,
    duesData,
    refreshData,
    selectedYear
  } = useHOADues();

  // Always use current fiscal year for credit balance operations
  // Credit balances should be "live" regardless of which year is being viewed
  const currentFiscalYear = getFiscalYear(getMexicoDate(), selectedClient?.configuration?.fiscalYearStartMonth || 7);

  // State for current fiscal year credit balance (separate from selected year)
  const [currentYearCreditBalance, setCurrentYearCreditBalance] = useState(0);
  const [currentYearCreditHistory, setCurrentYearCreditHistory] = useState([]);

  // Fetch current fiscal year credit balance when modal opens or unit changes
  useEffect(() => {
    if (isOpen && selectedClient && unitId && currentFiscalYear) {
      fetchCurrentYearCreditBalance();
    }
  }, [isOpen, selectedClient, unitId, currentFiscalYear]);

  const fetchCurrentYearCreditBalance = async () => {
    try {
      const { getAuthInstance } = await import('../firebaseClient');
      const { config } = await import('../config');
      const token = await getAuthInstance().currentUser.getIdToken();

      const response = await fetch(`${config.api.baseUrl}/hoadues/${selectedClient.id}/unit/${unitId}/${currentFiscalYear}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentYearCreditBalance(data.creditBalance || 0);
        setCurrentYearCreditHistory(data.creditBalanceHistory || []);
      } else {
        console.warn(`Failed to fetch current year credit balance for unit ${unitId}, year ${currentFiscalYear}`);
        setCurrentYearCreditBalance(0);
        setCurrentYearCreditHistory([]);
      }
    } catch (error) {
      console.error('Error fetching current year credit balance:', error);
      setCurrentYearCreditBalance(0);
      setCurrentYearCreditHistory([]);
    }
  };
  
  // Access transaction context for balance updates
  const { triggerBalanceUpdate } = useTransactionsContext();
  
  // Digital Receipt integration state
  const [showDigitalReceipt, setShowDigitalReceipt] = useState(false);
  const [receiptTransactionData, setReceiptTransactionData] = useState(null);
  
  // Add logging for state changes
  React.useEffect(() => {
    console.log('🧾 [MODAL STATE] showDigitalReceipt changed to:', showDigitalReceipt);
  }, [showDigitalReceipt]);
  
  React.useEffect(() => {
    console.log('🧾 [MODAL STATE] receiptTransactionData changed:', receiptTransactionData ? { id: receiptTransactionData.id, unitId: receiptTransactionData.unitId } : null);
  }, [receiptTransactionData]);
  
  // Notification system for Digital Receipt and success messages
  const { 
    notification, 
    closeNotification, 
    showError, 
    showSuccess,
    showEmailSuccess
  } = useNotification();
  
  const [selectedUnitId, setSelectedUnitId] = useState(unitId || '');
  const [unit, setUnit] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getMexicoDateString()); // Use Mexico timezone
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [checkNumber, setCheckNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Preview API state
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  
  // Client data for dynamic payment methods and accounts
  const [clientPaymentMethods, setClientPaymentMethods] = useState([]);
  const [clientAccounts, setClientAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  
  // Convert string amount to number
  const amountNumber = parseFloat(amount) || 0;
  
  // Preview Payment Fetch Function
  const fetchPreview = async (paymentAmount) => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      setPreview(null);
      return;
    }
    
    if (!selectedUnitId || !selectedClient?.id || !selectedYear) {
      console.warn('⚠️ Missing required data for preview:', { selectedUnitId, clientId: selectedClient?.id, selectedYear });
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);

    try {
      console.log('💰 [Preview API] Fetching payment preview:', {
        clientId: selectedClient.id,
        unitId: selectedUnitId,
        paymentAmount: parseFloat(paymentAmount),
        payOnDate: paymentDate,
        year: selectedYear
      });

      const response = await hoaDuesAPI.previewPayment(
        selectedClient.id,
        {
          unitId: selectedUnitId,
          paymentAmount: parseFloat(paymentAmount),
          payOnDate: paymentDate,
          year: selectedYear
        }
      );

      console.log('✅ [Preview API Response]:', response);
      // Extract data from response wrapper
      const previewData = response.data || response;
      setPreview(previewData);
    } catch (error) {
      console.error('❌ [Preview API Error]:', error);
      setPreviewError(error.message || 'Failed to load payment preview');
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };
  
  // Update selectedUnitId when unitId prop changes
  useEffect(() => {
    setSelectedUnitId(unitId || '');
  }, [unitId]);
  
  // Update unit when selectedUnitId changes
  useEffect(() => {
    if (units && selectedUnitId) {
      const foundUnit = units.find(u => u.unitId === selectedUnitId);
      setUnit(foundUnit);
    } else {
      setUnit(null);
    }
  }, [units, selectedUnitId]);
  
  // Load client payment methods dynamically from database
  useEffect(() => {
    const loadPaymentMethods = async () => {
      if (selectedClient?.id) {
        try {
          setLoadingPaymentMethods(true);
          console.log('🔄 Loading payment methods from database for client:', selectedClient.id);
          
          // Get auth token
          const auth = getAuthInstance();
          const token = await auth.currentUser?.getIdToken();
          
          // Fetch payment methods from API
          const response = await getPaymentMethods(selectedClient.id, token);
          const paymentMethodsData = response.data || [];
          
          // Extract method names and sort
          const methodNames = paymentMethodsData
            .filter(method => method.status === 'active') // Only active methods
            .map(method => method.name)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
          
          console.log('✅ Loaded payment methods from database:', methodNames);
          
          if (methodNames.length > 0) {
            setClientPaymentMethods(methodNames);
            // Auto-select first payment method
            setPaymentMethod(methodNames[0].toLowerCase().replace(/\s+/g, '_'));
          } else {
            console.warn('⚠️ No active payment methods found in database');
            setClientPaymentMethods([]);
          }
          
        } catch (error) {
          console.error('❌ Error loading payment methods from database:', error);
          setClientPaymentMethods([]);
          // Don't set an error that would block the modal - just log it
          console.warn('Payment methods could not be loaded - modal will show empty dropdown');
        } finally {
          setLoadingPaymentMethods(false);
        }
      }
    };
    
    // Load accounts from client data (keep existing logic for accounts)
    const loadAccounts = () => {
      if (selectedClient) {
        const rawAccounts = selectedClient.accounts || [];
        const processedAccounts = rawAccounts
          .map(item => typeof item === 'string' ? item : item.name || item.id || String(item))
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        
        // Fallback for accounts if empty
        const finalAccounts = processedAccounts.length > 0 
          ? processedAccounts 
          : ['Bank', 'Cash'];
        
        setClientAccounts(finalAccounts);
        
        // Auto-select first account
        if (finalAccounts.length > 0) {
          setSelectedAccount(finalAccounts[0]);
        }
      }
    };
    
    loadPaymentMethods();
    loadAccounts();
  }, [selectedClient]);
  
  // Handle unit dropdown change
  const handleUnitChange = (e) => {
    setSelectedUnitId(e.target.value);
    // Reset preview when changing unit
    setPreview(null);
  };
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setPaymentDate(getMexicoDateString()); // Use Mexico timezone
      setNotes('');
      setCheckNumber('');
      setError(null);
      setPreview(null);
      setPreviewError(null);
      // Payment method and account will be set by the client data loading effect
    }
  }, [isOpen]);
  
  // Debounced preview fetch when amount or payment date changes
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setPreview(null);
      return;
    }

    // Debounce: Wait 500ms after user stops typing
    const timeoutId = setTimeout(() => {
      fetchPreview(amount);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [amount, selectedUnitId, paymentDate, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Digital Receipt handlers
  const handleDigitalReceiptClose = async () => {
    console.log('🧾 [RECEIPT DEBUG] Closing digital receipt...');
    setShowDigitalReceipt(false);
    setReceiptTransactionData(null);
    
    // Now trigger the data refresh that was deferred
    setLoading(true);
    
    try {
      await refreshData();
      // Also refresh current year credit balance after data refresh
      await fetchCurrentYearCreditBalance();
    } catch (error) {
      console.error('Error refreshing data after receipt closure:', error);
    } finally {
      setLoading(false);
      // Now close the payment modal since receipt is closed
      console.log('🧾 [RECEIPT DEBUG] Closing payment modal after receipt closure');
      onClose();
    }
  };
  
  const handleEmailSent = async (result) => {
    console.log('Receipt email sent successfully:', result);
    // Close the Digital Receipt modal
    setShowDigitalReceipt(false);
    setReceiptTransactionData(null);
    
    // Trigger data refresh after email is sent
    setLoading(true);
    
    try {
      await refreshData();
      // Also refresh current year credit balance after data refresh
      await fetchCurrentYearCreditBalance();
    } catch (error) {
      console.error('Error refreshing data after email sent:', error);
    } finally {
      setLoading(false);
      // Close the payment modal
      onClose();
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Improved logic at the beginning of the handleSubmit function to validate all required fields
    if (!selectedUnitId) {
      setError('Please select a unit');
      return;
    }
    
    if (!selectedClient?.id) {
      setError('No client selected');
      return;
    }
    
    if (!selectedYear) {
      setError('Year is not specified');
      return;
    }
    
    if (!amountNumber || amountNumber <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }
    
    if (!paymentDate) {
      setError('Please select a payment date');
      return;
    }
    
    if (clientPaymentMethods.length === 0) {
      setError('No payment methods are configured for this client. Please contact an administrator.');
      return;
    }
    
    if (!paymentMethod) {
      setError('Please select a payment method');
      return;
    }
    
    if (paymentMethod === 'check' && !checkNumber) {
      setError('Please enter a check number');
      return;
    }
    
    if (!preview) {
      setError('Please wait for payment preview to load');
      return;
    }
    
    if (loadingPreview) {
      setError('Payment preview is still loading, please wait');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create a detailed description for the transaction
      const generateTransactionDescription = () => {
        if (!preview.monthsAffected || preview.monthsAffected.length === 0) {
          return `Credit balance for Unit ${selectedUnitId}`;
        } else {
          const monthNames = preview.monthsAffected.map(m => m.month || `Month ${m.monthIndex + 1}`).join(', ');
          return `HOA Dues payment for Unit ${selectedUnitId} - ${monthNames}`;
        }
      };
      
      // Create payment record with details - ensure all required fields are properly set
      // Send date string directly - backend handles timezone conversion (matches UnifiedExpenseEntry pattern)
      const paymentDetails = {
        date: paymentDate, // Send date string directly
        amount: amountNumber,
        method: paymentMethod,
        checkNumber: paymentMethod === 'check' ? checkNumber : null,
        notes: notes,
        description: generateTransactionDescription(),
        scheduledAmount: duesData[selectedUnitId]?.scheduledAmount || unit?.duesAmount || 0,
        creditBalanceAdded: preview.overpayment || 0,
        newCreditBalance: preview.newCreditBalance, // Send the new calculated credit balance
        creditUsed: preview.creditUsed || 0, // Amount of credit used
        creditRepairAmount: 0 // Backend handles credit repair
      };
      
      // Handle case where no full months can be paid (add directly to credit)
      if (!preview.monthsAffected || preview.monthsAffected.length === 0) {
        try {
          // Use the API instead of direct function call for consistency
          // Note: Credit balance operations use current fiscal year, but payment is recorded for selected year
          await apiRecordDuesPayment(
            selectedClient.id,
            selectedUnitId,
            currentFiscalYear, // Use current fiscal year for credit balance operations
            paymentDetails,
            [] // Empty distribution since all goes to credit
          );
          
          // Show success notification for credit addition
          showSuccess(
            'Credit Added Successfully!',
            `${formatAsMXN(amountNumber)} has been added to the credit balance for Unit ${selectedUnitId}.`,
            [
              { label: 'Unit', value: `Unit ${selectedUnitId}` },
              { label: 'Amount', value: formatAsMXN(amountNumber) },
              { label: 'Payment Method', value: clientPaymentMethods.find(m => m.toLowerCase().replace(/\s+/g, '_') === paymentMethod) || paymentMethod },
              { label: 'Date', value: new Date(paymentDate).toLocaleDateString() }
            ]
          );
          
          // Refresh data and current year credit balance, then close the modal
          await refreshData();
          await fetchCurrentYearCreditBalance();
          setTimeout(() => onClose(), 800); // Close modal quickly to show notification
        } catch (error) {
          console.error('Error adding to credit balance:', error);
          setError(`Failed to add credit: ${error.message || 'Unknown error'}`);
          setLoading(false);
        }
        return;
      }
      
      // Use preview data to build distribution for API call
      console.log("Building payment distribution from preview data...");
      const monthlyAmount = duesData[selectedUnitId]?.scheduledAmount || unit?.duesAmount || 0;
      
      const distribution = preview.monthsAffected.map(monthData => {
        // monthIndex is 0-11, but payments array uses 1-12
        const monthForPayments = monthData.monthIndex + 1;
        
        // Find existing payment for this month
        const existingPayment = duesData[selectedUnitId]?.payments?.find(p => p.month === monthForPayments) || {
          month: monthForPayments,
          paid: 0
        };
        
        const existingPaidAmount = Number(existingPayment.paid || 0);
        const newAmount = existingPaidAmount + monthData.totalPaid;
        
        console.log(`Month ${monthData.month} (${monthForPayments}): Existing $${existingPaidAmount} + Payment $${monthData.totalPaid} = New $${newAmount}`);
        
        return {
          month: monthForPayments,
          existingAmount: existingPaidAmount,
          newAmount: newAmount,
          amountToAdd: monthData.totalPaid
        };
      });

      // Double check distribution data integrity
      console.log('Generated distribution data:', JSON.stringify(distribution));

      try {
        // Using the API to create both the transaction and update dues records
        if (!selectedClient?.id) {
          throw new Error('No client selected');
        }

        // Enhanced debugging for date handling specifically
        console.log('Recording payment with details:', {
          clientId: selectedClient.id,
          unitId: selectedUnitId,
          year: selectedYear,
          paymentData: {
            ...paymentDetails,
            date: paymentDetails.date,
            dateISO: paymentDetails.date instanceof Date ? paymentDetails.date.toISOString() : 'Not a Date object',
            dateObject: typeof paymentDetails.date,
            dateValid: paymentDetails.date instanceof Date
          },
          distribution,
          distributionLength: distribution.length
        });

        // Ensure all parameters are correctly formatted and present 
        console.log('About to call API with:', {
          clientId: selectedClient.id,
          unitId: selectedUnitId,
          year: selectedYear,
          paymentDetails,
          distribution
        });
        
        // Make API call to create transaction and update dues records
        // Note: Credit balance operations use current fiscal year, but payment is recorded for selected year
        const result = await apiRecordDuesPayment(
          selectedClient.id,
          selectedUnitId,
          currentFiscalYear, // Use current fiscal year for credit balance operations
          paymentDetails,
          distribution
        );

        // Success notification to the user - helps provide visual feedback
        if (result?.success) {
          
          // HOA payment creates a regular transaction, so trigger standard balance update
          triggerBalanceUpdate();
          
          // Refresh current year credit balance data after successful payment
          await fetchCurrentYearCreditBalance();

          // DON'T refresh selected year data yet - wait until after receipt is closed to avoid state conflicts
          console.log('🧾 [RECEIPT DEBUG] Skipping immediate selected year data refresh to prevent state conflicts');
          
          // Generate Digital Receipt using the utility function
          console.log('🧾 [RECEIPT DEBUG] About to generate receipt for transaction:', result.transactionId);
          console.log('🧾 [RECEIPT DEBUG] Selected client data:', selectedClient);
          console.log('🧾 [RECEIPT DEBUG] Receipt generation context:', {
            transactionId: result.transactionId,
            clientId: selectedClient?.id,
            unitsCount: units?.length || 0,
            hasSetReceiptData: typeof setReceiptTransactionData === 'function',
            hasSetShowReceipt: typeof setShowDigitalReceipt === 'function',
            hasShowError: typeof showError === 'function'
          });
          
          const receiptGenerated = await generateHOADuesReceipt(result.transactionId, {
            setReceiptTransactionData,
            setShowDigitalReceipt,
            showError,
            selectedClient,
            units
          });
          
          console.log('🧾 [RECEIPT DEBUG] Receipt generation result:', receiptGenerated);
          
          // If Digital Receipt was successfully generated, don't close payment modal yet
          // Let the receipt render first, then it will handle closing the payment modal
          if (receiptGenerated) {
            console.log('🧾 [RECEIPT DEBUG] Receipt generated successfully, keeping payment modal open for receipt to render');
            return; // Exit early, don't refresh data yet - receipt will handle modal closing
          }
          
          // Only execute the code below if receipt was NOT generated
          console.warn('Receipt generation failed, but payment was successful');
          // Show notification since receipt generation failed
          showSuccess(
            'Payment Recorded Successfully!',
            `HOA Dues payment of ${formatAsMXN(amountNumber)} has been recorded for Unit ${selectedUnitId}.`,
            [
              { label: 'Unit', value: `Unit ${selectedUnitId}` },
              { label: 'Amount', value: formatAsMXN(amountNumber) },
              { label: 'Payment Method', value: clientPaymentMethods.find(m => m.toLowerCase().replace(/\s+/g, '_') === paymentMethod) || paymentMethod },
              { label: 'Date', value: new Date(paymentDate).toLocaleDateString() }
            ]
          );
        }

        // Refresh data with multiple attempts to ensure we catch the latest data
        // Only reached if Digital Receipt is not showing
        setLoading(true);
        
        // Close modal quickly to show success notification (only if NO receipt was generated)
        if (result?.success) {
          setTimeout(() => {
            onClose();
          }, 800); // Close modal quickly to let user see success notification
        }
        
        // First attempt at refresh after a short delay
        setTimeout(async () => {
          try {
            console.log('First refresh attempt...');
            await refreshData();
            await fetchCurrentYearCreditBalance();
            console.log('First refresh completed');
            
            // Second refresh after another delay to catch any cached data issues
            setTimeout(async () => {
              try {
                console.log('Second refresh attempt...');
                await refreshData();
                await fetchCurrentYearCreditBalance();
                console.log('Second refresh completed - data should now be fully updated');
              } catch (secondRefreshError) {
                console.error('Error in second refresh:', secondRefreshError);
              } finally {
                setLoading(false);
              }
            }, 1500);
          } catch (firstRefreshError) {
            console.error('Error in first refresh:', firstRefreshError);
            setLoading(false);
          }
        }, 1000);
      } catch (apiError) {
        console.error('API error while recording payment:', apiError);
        
        // Try to get more details if this is a response error
        if (apiError.response) {
          try {
            const errorBody = await apiError.response.json();
            console.error('Error response body:', errorBody);
            setError(`Server error: ${errorBody.error || 'Unknown error'}`);
          } catch (e) {
            console.error('Could not parse error response:', e);
            setError(`API error: ${apiError.message || 'Unknown error'}`);
          }
        } else {
          setError(`API error: ${apiError.message || 'Unknown error'}`);
        }
        throw apiError;
      }
      
      // We no longer need this part because it's handled in the previous code block
      // The API call handles the credit balance update
    } catch (error) {
      console.error('Error saving payment:', error);
      
      // Provide more specific error messages based on error types
      if (error.message && error.message.includes('Cannot connect to backend server')) {
        setError('Cannot connect to the server. Please check if the server is running and try again.');
      } else if (error.status === 400) {
        setError(`Bad request: ${error.message || 'Please check your input data.'}`);
      } else if (error.status === 500) {
        setError(`Server error: ${error.message || 'The server encountered an error processing your request.'}`);
      } else {
        setError(`Failed to save payment: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-backdrop">
      <div className="dues-payment-modal">
        <div className="modal-header">
          <h2>Payment for {unit ? `Unit ${unit.unitId}` : 'HOA Dues'} {monthIndex && unit ? `- ${getMonthName(monthIndex)}` : ''}</h2>
          <button type="button" className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="unit-inline">
              <label>Unit: </label>{selectedUnitId === '' ? (
                <select 
                  className="unit-selector" 
                  value={selectedUnitId} 
                  onChange={handleUnitChange}
                  required
                >
                  <option value="">-- Select a Unit --</option>
                  {sortUnitsByUnitId(units).map(unit => {
                    const formattedOption = formatUnitIdWithOwnerAndDues(unit);
                    return (
                      <option key={unit.unitId} value={unit.unitId}>
                        {formattedOption}
                      </option>
                    );
                  })}
                </select>
              ) : (
                formatUnitIdWithOwnerAndDues(unit)
              )}
            </div>
            
            {/* Row 1: Payment Amount and Payment Date */}
            <div className="form-row">
              <div className="form-col">
                <div className="form-group">
                  <label htmlFor="paymentAmount">Payment Amount:</label>
                  <div className="input-group">
                    <span className="currency-symbol">$</span>
                    <input
                      id="paymentAmount"
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      step="0.01"
                      min="0"
                      required
                      autoFocus
                    />
                  </div>
                </div>
              </div>
              <div className="form-col">
                <div className="form-group">
                  <label htmlFor="paymentDate">Payment Date:</label>
                  <input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            
            {/* Row 2: Payment Method and Account */}
            <div className="form-row">
              <div className="form-col">
                <div className="form-group">
                  <label htmlFor="paymentMethod">Payment Method:</label>
                  {loadingPaymentMethods ? (
                    <select disabled>
                      <option>Loading...</option>
                    </select>
                  ) : (
                    <select
                      id="paymentMethod"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      required
                    >
                      {clientPaymentMethods.length > 0 ? (
                        clientPaymentMethods.map(method => {
                          const value = method.toLowerCase().replace(/\s+/g, '_');
                          return (
                            <option key={value} value={value}>
                              {method}
                            </option>
                          );
                        })
                      ) : (
                        <option value="">No payment methods available</option>
                      )}
                    </select>
                  )}
                </div>
              </div>
              <div className="form-col">
                <div className="form-group">
                  <label htmlFor="accountToCredit">Account to Credit:</label>
                  <select
                    id="accountToCredit"
                    value={selectedAccount}
                    onChange={e => setSelectedAccount(e.target.value)}
                    required
                  >
                    {clientAccounts.map(account => (
                      <option key={account} value={account}>
                        {account}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            {paymentMethod === 'check' && (
              <div className="form-group">
                <label htmlFor="checkNumber">Check Number:</label>
                <input
                  id="checkNumber"
                  type="text"
                  value={checkNumber}
                  onChange={e => setCheckNumber(e.target.value)}
                  required
                />
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="notes">Notes:</label>
              <textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            
            {unit && (
              <>
                <div className="payment-summary">
                  <h3>Payment Summary</h3>
                  <p><strong>Monthly Due Amount:</strong> {formatAsMXN(duesData[selectedUnitId]?.scheduledAmount || unit.duesAmount || 0)}</p>
                  <p><strong>Current Credit Balance:</strong> {formatAsMXN(currentYearCreditBalance || 0)}</p>
                </div>
                
                <div className="payment-distribution">
                  <h3>Payment Preview</h3>
                  
                  {loadingPreview && (
                    <div className="preview-loading">
                      <p>⏳ Loading payment preview...</p>
                    </div>
                  )}
                  
                  {previewError && (
                    <div className="preview-error" style={{color: '#d9534f', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '4px'}}>
                      <p>❌ Error loading preview: {previewError}</p>
                    </div>
                  )}
                  
                  {preview && !loadingPreview ? (
                    <>
                      <div className="distribution-summary">
                        <p><strong>Payment Amount:</strong> {formatAsMXN(amountNumber)}</p>
                        <p><strong>Current Credit Balance:</strong> {formatAsMXN(preview.currentCreditBalance || 0)}</p>
                        {preview.monthsAffected && preview.monthsAffected.filter(m => m.totalPaid > 0).length > 0 ? (
                          <p><strong>Months Being Paid:</strong> {preview.monthsAffected.filter(m => m.totalPaid > 0).length} month{preview.monthsAffected.filter(m => m.totalPaid > 0).length !== 1 ? 's' : ''}</p>
                        ) : (
                          <p><strong>Months Being Paid:</strong> <span style={{color: '#d9534f'}}>No months will be paid (amount goes to credit)</span></p>
                        )}
                      </div>
                      
                      {preview.monthsAffected && preview.monthsAffected.length > 0 && (
                        <div className="distribution-table">
                          <h4>Bill Payments:</h4>
                          <table>
                            <thead>
                              <tr>
                                <th>Month</th>
                                <th>Dues</th>
                                <th>Penalties</th>
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.monthsAffected
                                .filter(m => m.totalPaid > 0)  // Only show months that received payment
                                .map((monthData, idx) => {
                                // monthData.month is a number (1-12 calendar month)
                                // We need to convert it to a fiscal month name
                                // monthData.monthIndex is the fiscal month index (0-11)
                                const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 7;
                                const fiscalMonthIndex = monthData.monthIndex; // 0-11
                                const calendarMonth = ((fiscalMonthIndex + fiscalYearStartMonth - 1) % 12) + 1;
                                const monthName = getMonthName(calendarMonth);
                                
                                return (
                                  <tr key={idx}>
                                    <td>{monthName}</td>
                                    <td>{formatAsMXN(monthData.basePaid || 0)}</td>
                                    <td className={monthData.penaltyPaid > 0 ? 'penalty-highlight' : ''}>
                                      {formatAsMXN(monthData.penaltyPaid || 0)}
                                    </td>
                                    <td><strong>{formatAsMXN(monthData.totalPaid || 0)}</strong></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan="3"><strong>Total Applied to Bills:</strong></td>
                                <td><strong>{formatAsMXN(preview.totalApplied || 0)}</strong></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                      
                      <div className="credit-balance-info">
                        {preview.creditUsed > 0 && (
                          <p style={{color: '#0066cc'}}>
                            <strong>💳 Credit Used:</strong> {formatAsMXN(preview.creditUsed)}
                          </p>
                        )}
                        
                        {preview.overpayment > 0 && (
                          <p style={{color: '#28a745'}}>
                            <strong>➕ Overpayment (New Credit):</strong> {formatAsMXN(preview.overpayment)}
                            <br />
                            <span className="credit-explanation" style={{fontSize: '0.9em', color: '#666'}}>
                              This amount will be added to credit balance
                            </span>
                          </p>
                        )}
                        
                        <p><strong>New Credit Balance:</strong> {formatAsMXN(preview.newCreditBalance || 0)}</p>
                        {preview.newCreditBalance > 0 && (
                          <p className="credit-explanation" style={{fontSize: '0.9em', color: '#666'}}>
                            This credit will be automatically applied to future payments.
                          </p>
                        )}
                      </div>
                    </>
                  ) : !loadingPreview && !previewError && (
                    <p>Enter an amount to see the payment preview</p>
                  )}
                </div>
              </>
            )}
            
            {error && (
              <div className="error-message">
                <span>{error}</span>
                <button 
                  type="button" 
                  onClick={() => setError(null)} 
                  className="error-close"
                  title="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}
            
            <div className="modal-footer">
              <button
                type="button"
                onClick={onClose}
                className="cancel-button"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={loading || !preview || loadingPreview}
              >
                {loading ? 'Processing...' : 'Save Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Digital Receipt Modal */}
      {showDigitalReceipt && receiptTransactionData && (
        <div className="modal-backdrop" style={{ zIndex: 2000 }}>
          <div className="dues-payment-modal" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>Recibo de Pago / Payment Receipt</h2>
              <button type="button" className="close-button" onClick={handleDigitalReceiptClose}>×</button>
            </div>
            <div className="modal-body">
              {console.log('🧾 [MODAL RENDER] Rendering DigitalReceipt component with:', {
                hasTransactionData: !!receiptTransactionData,
                transactionId: receiptTransactionData?.id
              })}
              <DigitalReceipt 
                transactionData={receiptTransactionData}
                clientData={selectedClient}
                onEmailSent={handleEmailSent}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Debug info for receipt state */}
      {console.log('🧾 [MODAL RENDER] Receipt render check:', {
        showDigitalReceipt,
        hasReceiptData: !!receiptTransactionData,
        willRender: showDigitalReceipt && receiptTransactionData
      })}
      
      {/* Notification system for success messages */}
      {notification && notification.title && notification.message && (
        <NotificationModal 
          isOpen={!!notification}
          type={notification.type}
          title={notification.title}
          message={notification.message}
          details={notification.details}
          onClose={closeNotification}
        />
      )}
    </div>
  );
}

export default DuesPaymentModal;
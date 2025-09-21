import React, { useState, useEffect } from 'react';
import { useHOADues } from '../context/HOADuesContext';
import { useClient } from '../context/ClientContext';
import { 
  calculatePayments, 
  formatAsMXN, 
  getMonthName, 
  generateMonthsDescription
} from '../utils/hoaDuesUtils';
import { formatUnitIdWithOwnerAndDues, sortUnitsByUnitId } from '../utils/unitUtils';
import { recordDuesPayment as apiRecordDuesPayment } from '../api/hoaDuesService';
import { generateHOADuesReceipt } from '../utils/receiptUtils';
import { getPaymentMethods } from '../api/paymentMethods';
import { getAuthInstance } from '../firebaseClient';
import DigitalReceipt from './DigitalReceipt';
import NotificationModal from './NotificationModal';
import { useNotification } from '../hooks/useNotification';
import { getMexicoDateString } from '../utils/timezone';
import { useTransactionsContext } from '../context/TransactionsContext';
import { databaseFieldMappings } from '../utils/databaseFieldMappings';
import debug from '../utils/debug';
import './DuesPaymentModal.css';

function DuesPaymentModal({ isOpen, onClose, unitId, monthIndex }) {
  
  const { selectedClient } = useClient();
  const { 
    units, 
    duesData, 
    refreshData,
    selectedYear
  } = useHOADues();
  
  // Access transaction context for balance updates
  const { triggerBalanceUpdate } = useTransactionsContext();
  
  // Digital Receipt integration state
  const [showDigitalReceipt, setShowDigitalReceipt] = useState(false);
  const [receiptTransactionData, setReceiptTransactionData] = useState(null);
  
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
  const [calculationResult, setCalculationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Client data for dynamic payment methods and accounts
  const [clientPaymentMethods, setClientPaymentMethods] = useState([]);
  const [clientAccounts, setClientAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  
  // Convert string amount to number
  const amountNumber = parseFloat(amount) || 0;
  
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
          debug.log('🔄 Loading payment methods from database for client:', selectedClient.id);
          
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
          
          debug.log('✅ Loaded payment methods from database:', methodNames);
          
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
          // Show user-friendly error - but don't overwrite existing errors
          if (!error) {
            setError('Failed to load payment methods. Please refresh the page.');
          }
          setClientPaymentMethods([]);
        } finally {
          setLoadingPaymentMethods(false);
        }
      }
    };
    
    // Load accounts from client data (keep existing logic for accounts)
    const loadAccounts = () => {
      if (selectedClient) {
        const rawAccounts = selectedClient.accounts || [];
        // Process accounts - only include those with proper structure
        const processedAccounts = rawAccounts
          .map((item) => {
            // Only accept properly structured account objects
            if (item && typeof item === 'object' && item.id && item.name && item.type) {
              return {
                id: item.id,
                name: item.name,
                type: item.type
              };
            }
            // Log warning for improperly structured accounts
            console.warn('Account missing required fields (id, name, type):', item);
            return null;
          })
          .filter(item => item !== null)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        
        setClientAccounts(processedAccounts);
        
        // Auto-select first account if available
        if (processedAccounts.length > 0) {
          setSelectedAccount(processedAccounts[0]);
        } else {
          setSelectedAccount(null);
          // Set error if no valid accounts
          setError('No valid accounts configured. Accounts must have id, name, and type fields.');
        }
      }
    };
    
    loadPaymentMethods();
    loadAccounts();
  }, [selectedClient]);
  
  // Handle unit dropdown change
  const handleUnitChange = (e) => {
    setSelectedUnitId(e.target.value);
    // Reset calculation result when changing unit
    setCalculationResult(null);
  };
  
  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setPaymentDate(getMexicoDateString()); // Use Mexico timezone
      setNotes('');
      setCheckNumber('');
      setCalculationResult(null);
      setError(null);
      // Payment method and account will be set by the client data loading effect
    }
  }, [isOpen]);
  
  // Calculate the first unpaid month
  const getFirstUnpaidMonth = () => {
    if (!selectedUnitId || !duesData[selectedUnitId]?.payments) {
      return monthIndex || 1;
    }
    
    if (monthIndex) {
      return monthIndex; // Use specified month if provided
    }

    const payments = duesData[selectedUnitId].payments || [];
    const monthlyAmount = duesData[selectedUnitId]?.scheduledAmount || unit?.duesAmount || 0;
    
    // Sort payments by month to ensure we check them in order
    const sortedPayments = [...payments].sort((a, b) => a.month - b.month);
    
    // Find the first month that's not fully paid
    for (let i = 0; i < sortedPayments.length; i++) {
      const payment = sortedPayments[i];
      // Check if payment is missing or less than the full monthly amount
      if (!payment.paid || Number(payment.paid) < monthlyAmount) {
        debug.log(`Found first unpaid month: ${payment.month}`);
        return payment.month;
      }
    }
    
    // If we've reached here, all current months are paid, 
    // so we need to determine the next month to pay
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // Convert from 0-based to 1-based
    const currentYear = currentDate.getFullYear();
    
    if (currentYear > selectedYear) {
      return 1; // If we're viewing a past year, default to January
    } else if (currentYear === selectedYear) {
      return currentMonth; // If we're viewing current year, default to current month
    } else {
      return 1; // If we're viewing a future year, default to January
    }
  };
  
  // Generate credit usage or overpayment message
  const getCreditMessage = () => {
    if (!calculationResult) return '';
    
    const { amtOverpayment } = calculationResult;
    
    if (amtOverpayment < 0) {
      return `Used ${formatAsMXN(Math.abs(amtOverpayment))} from credit balance`;
    } else if (amtOverpayment > 0) {
      return `Added ${formatAsMXN(amtOverpayment)} to credit balance`;
    } else {
      return 'No credit was used or added';
    }
  };

  // Debugging function to test our month calculation
  const testMonthCalculation = () => {
    if (!selectedUnitId || !duesData[selectedUnitId]) return;
    
    const payments = duesData[selectedUnitId].payments || [];
    const monthlyAmount = duesData[selectedUnitId]?.scheduledAmount || unit?.duesAmount || 0;
    
    debug.group('DEBUG: Payment Status by Month', () => {
      for (let i = 1; i <= 12; i++) {
        const payment = payments.find(p => p.month === i);
        const status = !payment ? 'No payment record' : 
                      !payment.paid ? 'Unpaid' :
                      Number(payment.paid) < monthlyAmount ? 'Partial payment' : 'Fully paid';
        
        debug.log(`Month ${i}: ${status} - ${payment ? `Amount: ${payment.paid}` : 'No data'}`);
      }
      
      const firstUnpaidMonth = getFirstUnpaidMonth();
      debug.log(`First unpaid month calculated as: ${firstUnpaidMonth}`);
    });
  };

  // Calculate payment distribution
  const calculateDistribution = () => {
    // Get unit directly from units array to avoid race condition
    const currentUnit = units?.find(u => u.unitId === selectedUnitId);
    if (!currentUnit || !amountNumber) {
      setCalculationResult(null);
      return;
    }
    
    // Handle case where duesData might not exist for this unit yet
    const unitDuesData = duesData[selectedUnitId] || {
      creditBalance: 0,
      scheduledAmount: currentUnit.duesAmount || 0,
      payments: Array(12).fill().map((_, i) => ({
        month: i + 1,
        paid: 0,
        date: null
      }))
    };
    
    const currentCredit = unitDuesData.creditBalance || 0;
    const monthlyAmount = unitDuesData.scheduledAmount || currentUnit.duesAmount || 0;
    const firstUnpaidMonth = getFirstUnpaidMonth();
    
    // STEP 1: Handle credit balance repair if negative
    let remainingAmount = amountNumber;
    let creditRepairAmount = 0;
    let creditBalanceAfterRepair = currentCredit;
    
    if (currentCredit < 0) {
      creditRepairAmount = Math.min(Math.abs(currentCredit), remainingAmount);
      creditBalanceAfterRepair = currentCredit + creditRepairAmount;
      remainingAmount -= creditRepairAmount;
      
      debug.log(`🔧 Credit repair needed: ${creditRepairAmount} to fix negative balance of ${currentCredit}`);
      debug.log(`Credit balance after repair: ${creditBalanceAfterRepair}, Remaining for dues: ${remainingAmount}`);
    }
    
    // Debug log to verify calculation
    debug.group('Payment Distribution Calculation', () => {
      debug.log(`Unit: ${selectedUnitId}, Monthly Amount: ${monthlyAmount}, Payment: ${amountNumber}`);
      debug.log(`Original Credit Balance: ${currentCredit}, After Repair: ${creditBalanceAfterRepair}`);
      debug.log(`Credit Repair Amount: ${creditRepairAmount}, Remaining for Dues: ${remainingAmount}`);
    });
    
    // Run the test calculation
    testMonthCalculation();
    
    // STEP 2: Use remaining amount for monthly dues calculation
    const result = calculatePayments(remainingAmount, monthlyAmount, creditBalanceAfterRepair);
    
    debug.log('Calculation result:', result);
    
    // Figure out which months will actually be paid
    // This simulates the payment distribution logic
    const monthsThatWillBePaid = [];
    let currentMonthIndex = firstUnpaidMonth;
    let paymentsRemaining = result.monthlyPayments.length;
    
    // Find months that need payment (not fully paid)
    while (paymentsRemaining > 0) {
      // Calculate actual month (1-12) considering wrapping to next year
      const actualMonth = ((currentMonthIndex - 1) % 12) + 1;
      
      // Find existing payment for this month
      const existingPayment = duesData[selectedUnitId]?.payments?.find(p => p.month === actualMonth);
      const existingPaidAmount = Number(existingPayment?.paid || 0);
      
      // If this month isn't fully paid, add it to our list
      if (existingPaidAmount < monthlyAmount) {
        monthsThatWillBePaid.push(actualMonth);
        paymentsRemaining--;
      }
      
      // Move to next month
      currentMonthIndex++;
    }
    
    // Sort the months in ascending order
    monthsThatWillBePaid.sort((a, b) => a - b);
    
    debug.log("Months that will be paid:", monthsThatWillBePaid);
    
    // Calculate the description based on the actual months that will be paid
    const fiscalYearStartMonth = selectedClient?.configuration?.fiscalYearStartMonth || 1;
    const monthsDescription = monthsThatWillBePaid.length > 0 
      ? generateMonthsDescription(monthsThatWillBePaid[0], monthsThatWillBePaid.length, selectedYear, fiscalYearStartMonth)
      : '';
    
    // Add additional info for display including credit repair
    setCalculationResult({
      ...result,
      startMonth: firstUnpaidMonth,
      monthlyAmount,
      totalPaid: result.monthlyPayments.reduce((sum, val) => sum + val, 0),
      monthsDescription: monthsDescription,
      actualMonthsToPayIndexes: monthsThatWillBePaid,
      // Credit repair information
      creditRepairAmount,
      creditBalanceAfterRepair,
      originalCreditBalance: currentCredit,
      remainingAmountForDues: remainingAmount
    });
    
    debug.structured('Final calculation result', {
      startMonth: firstUnpaidMonth,
      monthCount: result.monthlyPayments.length,
      description: generateMonthsDescription(
        firstUnpaidMonth,
        result.monthlyPayments.length,
        selectedYear,
        fiscalYearStartMonth
      )
    });
  };

  // Run calculation when amount changes
  useEffect(() => {
    calculateDistribution();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountNumber, unit, duesData, selectedUnitId, monthIndex, selectedYear]);
  
  // Digital Receipt handlers
  const handleDigitalReceiptClose = async () => {
    setShowDigitalReceipt(false);
    setReceiptTransactionData(null);
    
    // Now trigger the data refresh that was deferred
    setLoading(true);
    
    try {
      await refreshData();
    } catch (error) {
      console.error('Error refreshing data after receipt closure:', error);
    } finally {
      setLoading(false);
      // Close the payment modal after data refresh
      onClose();
    }
  };
  
  const handleEmailSent = async (result) => {
    debug.log('Receipt email sent successfully:', result);
    // Close the Digital Receipt modal
    setShowDigitalReceipt(false);
    setReceiptTransactionData(null);
    
    // Trigger data refresh after email is sent
    setLoading(true);
    
    try {
      await refreshData();
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
    
    if (!calculationResult) {
      setError('Failed to calculate payment distribution');
      return;
    }
    
    // Validate account selection
    if (!selectedAccount || !selectedAccount.id || !selectedAccount.type) {
      setError('Please select a valid account. Account must have id and type.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create a detailed description for the transaction
      const generateTransactionDescription = () => {
        if (calculationResult.monthlyPayments.length === 0) {
          return `Credit balance for Unit ${selectedUnitId}`;
        } else {
          return `HOA Dues payment for Unit ${selectedUnitId} - ${calculationResult.monthsDescription}`;
        }
      };    // Create payment record with details - ensure all required fields are properly set
    // Validate date format (should be YYYY-MM-DD)
    if (!paymentDate || !paymentDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setError('Invalid payment date format');
      setLoading(false);
      return;
    }
    
    const paymentDetails = {
      date: paymentDate, // Send as YYYY-MM-DD string for backend to handle
      amount: amountNumber, // Amount in dollars - backend expects dollars
      method: paymentMethod,
      accountId: selectedAccount?.id || null, // Add account ID
      accountType: selectedAccount?.type || null, // Add account type
      checkNumber: paymentMethod === 'check' ? checkNumber : null,
      notes: notes,
      description: generateTransactionDescription(),
      scheduledAmount: duesData[selectedUnitId]?.scheduledAmount || unit?.duesAmount || 0,
      creditBalanceAdded: calculationResult.amtOverpayment > 0 ? calculationResult.amtOverpayment : 0,
      newCreditBalance: calculationResult.remainingCredit, // Send the new calculated credit balance
      creditUsed: calculationResult.amtOverpayment < 0 ? Math.abs(calculationResult.amtOverpayment) : 0, // Amount of credit used
      creditRepairAmount: calculationResult.creditRepairAmount || 0 // Amount used to repair negative credit balance
    };
    
    // Debug log to verify all required fields are included
    console.log('HOA Payment Data being sent:', {
      accountId: paymentDetails.accountId,
      accountType: paymentDetails.accountType,
      method: paymentDetails.method,
      amount: paymentDetails.amount,
      date: paymentDetails.date
    });
    
    // Handle case where no full months can be paid (add directly to credit)
    if (calculationResult.monthlyPayments.length === 0) {
      try {
        // Use the API instead of direct function call for consistency
        await apiRecordDuesPayment(
          selectedClient.id,
          selectedUnitId,
          selectedYear,
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
            { label: 'Date', value: paymentDate } // Date is already in YYYY-MM-DD format
          ]
        );
        
        // Refresh data and close the modal
        await refreshData();
        setTimeout(() => onClose(), 800); // Close modal quickly to show notification
      } catch (error) {
        console.error('Error adding to credit balance:', error);
        setError(`Failed to add credit: ${error.message || 'Unknown error'}`);
        setLoading(false);
      }
      return;
    }
    
    // Find months that need payment, starting from the first unpaid month
    debug.log("Finding months that need payment...");
    const monthlyAmount = calculationResult.monthlyAmount;
    const monthsNeeded = calculationResult.monthlyPayments.length;
    let monthsToUpdate = [];
    let currentMonthIndex = calculationResult.startMonth;
    let paymentsRemaining = monthsNeeded;
    
    debug.log(`Starting with month ${currentMonthIndex}, need to allocate ${paymentsRemaining} payments`);
    
    while (paymentsRemaining > 0) {
      // Calculate actual month (1-12) considering wrapping to next year
      const actualMonth = ((currentMonthIndex - 1) % 12) + 1;
      
      // Find existing payment for this month or create placeholder
      const existingPayment = duesData[selectedUnitId]?.payments?.find(p => p.month === actualMonth) || {
        month: actualMonth,
        paid: 0
      };
      
      const existingPaidAmount = Number(existingPayment.paid || 0);
      
      debug.log(`Checking month ${actualMonth}: Existing paid=${existingPaidAmount}, Monthly amount=${monthlyAmount}`);
      
      // If this month isn't fully paid, add it to our update list
      if (existingPaidAmount < monthlyAmount) {
        debug.log(`Month ${actualMonth} needs payment (${existingPaidAmount} < ${monthlyAmount})`);
        monthsToUpdate.push({
          month: actualMonth,
          existingAmount: existingPaidAmount,
          newAmount: monthlyAmount,  // Always pay the full monthly amount
          amountToAdd: monthlyAmount - existingPaidAmount // Amount to add to existing payment
        });
        
        paymentsRemaining--;
      } else {
        debug.log(`Month ${actualMonth} already fully paid, skipping`);
      }
      
      // Move to next month
      currentMonthIndex++;
    }
    
    debug.log(`Will update ${monthsToUpdate.length} months:`, monthsToUpdate);

    // Create the payment distribution data for the API
    const distribution = monthsToUpdate.map(monthData => ({
      month: monthData.month,
      existingAmount: monthData.existingAmount,
      newAmount: monthData.newAmount,
      amountToAdd: monthData.amountToAdd
    }));

    // Double check distribution data integrity
    debug.structured('Generated distribution data', distribution);

    try {
      // Using the API to create both the transaction and update dues records
      if (!selectedClient?.id) {
        throw new Error('No client selected');
      }

      // Enhanced debugging for date handling specifically
      debug.structured('Recording payment', {
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
      debug.structured('API call parameters', {
        clientId: selectedClient.id,
        unitId: selectedUnitId,
        year: selectedYear,
        paymentDetails,
        distribution
      });
      
      // Make API call to create transaction and update dues records
      const result = await apiRecordDuesPayment(
        selectedClient.id,
        selectedUnitId,
        selectedYear,
        paymentDetails,
        distribution
      );

      // Success notification to the user - helps provide visual feedback
      if (result?.success) {
        
        // HOA payment creates a regular transaction, so trigger standard balance update
        triggerBalanceUpdate();
        
        // Generate Digital Receipt using the utility function
        const receiptGenerated = await generateHOADuesReceipt(result.transactionId, {
          setReceiptTransactionData,
          setShowDigitalReceipt,
          showError,
          selectedClient,
          units
        });
        
        if (!receiptGenerated) {
          console.warn('Receipt generation failed, but payment was successful');
          // Only show notification if receipt generation failed
          showSuccess(
            'Payment Recorded Successfully!',
            `HOA Dues payment of ${formatAsMXN(amountNumber)} has been recorded for Unit ${selectedUnitId}.`,
            [
              { label: 'Unit', value: `Unit ${selectedUnitId}` },
              { label: 'Amount', value: formatAsMXN(amountNumber) },
              { label: 'Payment Method', value: clientPaymentMethods.find(m => m.toLowerCase().replace(/\s+/g, '_') === paymentMethod) || paymentMethod },
              { label: 'Date', value: paymentDate } // Date is already in YYYY-MM-DD format
            ]
          );
        }

        // If Digital Receipt was successfully generated, don't refresh data immediately
        // Let the user interact with the receipt first
        if (receiptGenerated) {
          // Don't close the modal - the receipt is displayed within it
          // Just return early to prevent data refresh
          return; // Exit early, don't refresh data yet
        }
      }

      // Refresh data with multiple attempts to ensure we catch the latest data
      // Only if Digital Receipt is not showing
      setLoading(true);
      
      // Close modal quickly to show success notification
      if (result?.success) {
        setTimeout(() => {
          onClose();
        }, 800); // Close modal quickly to let user see success notification
      }
      
      // First attempt at refresh after a short delay
      setTimeout(async () => {
        try {
          debug.log('First refresh attempt...');
          await refreshData();
          debug.log('First refresh completed');
          
          // Second refresh after another delay to catch any cached data issues
          setTimeout(async () => {
            try {
              debug.log('Second refresh attempt...');
              await refreshData();
              debug.log('Second refresh completed - data should now be fully updated');
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
      {/* Show receipt modal if receipt is ready, otherwise show payment form */}
      {showDigitalReceipt && receiptTransactionData ? (
        <div className="modal-content digital-receipt-modal">
          <div className="modal-header">
            <h2>Payment Receipt</h2>
            <button className="close-button" onClick={handleDigitalReceiptClose}>×</button>
          </div>
          <DigitalReceipt 
            transactionData={receiptTransactionData}
            clientData={{
              id: selectedClient?.id,
              name: selectedClient?.basicInfo?.fullName || 'Client Name Not Available',
              logoUrl: selectedClient?.branding?.logoUrl || '/sandyland-logo.png'
            }}
            showPreview={true}
            onImageGenerated={(blob) => {
              debug.log('HOA Dues receipt image generated:', blob);
            }}
            onEmailSent={handleEmailSent}
            // Pass notification handlers to display at parent level
            onEmailSuccess={showEmailSuccess}
            onEmailError={showError}
          />
        </div>
      ) : (
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
            
            {/* Row 2: Payment Method and Account to Credit */}
            <div className="form-row">
              <div className="form-col">
                <div className="form-group">
                  <label htmlFor="paymentMethod">Payment Method:</label>
                  <select
                    id="paymentMethod"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    required
                    disabled={loadingPaymentMethods}
                  >
                    {loadingPaymentMethods ? (
                      <option value="">Loading payment methods...</option>
                    ) : clientPaymentMethods.length === 0 ? (
                      <option value="">No payment methods configured</option>
                    ) : (
                      clientPaymentMethods.map(method => {
                        const value = method.toLowerCase().replace(/\s+/g, '_');
                        return (
                          <option key={value} value={value}>
                            {method}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              </div>
              <div className="form-col">
                <div className="form-group">
                  <label htmlFor="accountToCredit">Account to Credit:</label>
                  <select
                    id="accountToCredit"
                    value={selectedAccount?.id || ''}
                    onChange={e => {
                      const account = clientAccounts.find(acc => acc.id === e.target.value);
                      setSelectedAccount(account);
                    }}
                    required
                  >
                    {clientAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
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
            
            <div className="payment-distribution">
              <h3>Payment Distribution</h3>
              
              {calculationResult ? (
                <>
                  <div className="distribution-summary">
                    <p><strong>Monthly Due Amount:</strong> {formatAsMXN(calculationResult.monthlyAmount)}</p>
                    <p><strong>Payment Amount:</strong> {formatAsMXN(amountNumber)}</p>
                    
                    {/* Show original credit balance with negative indicator */}
                    <p>
                      <strong>Current Credit Balance:</strong> 
                      <span style={{ color: calculationResult.originalCreditBalance < 0 ? '#d9534f' : 'inherit' }}>
                        {formatAsMXN(calculationResult.originalCreditBalance)}
                        {calculationResult.originalCreditBalance < 0 && ' (NEGATIVE - Requires Repair)'}
                      </span>
                    </p>
                    
                    {/* Show credit repair section if applicable */}
                    {calculationResult.creditRepairAmount > 0 && (
                      <div className="credit-repair-section" style={{ 
                        backgroundColor: '#fff3cd', 
                        border: '1px solid #ffeaa7', 
                        padding: '12px', 
                        borderRadius: '6px',
                        margin: '12px 0',
                        borderLeft: '4px solid #f39c12'
                      }}>
                        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#8b5d00' }}>
                          🔧 Credit Balance Repair Required
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '14px' }}>
                          • <strong>{formatAsMXN(calculationResult.creditRepairAmount)}</strong> will be used to repair negative credit balance
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '14px' }}>
                          • Credit balance after repair: <strong>{formatAsMXN(calculationResult.creditBalanceAfterRepair)}</strong>
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '14px' }}>
                          • Remaining amount for dues: <strong>{formatAsMXN(calculationResult.remainingAmountForDues)}</strong>
                        </p>
                      </div>
                    )}
                    {duesData[selectedUnitId]?.creditBalanceHistory && duesData[selectedUnitId].creditBalanceHistory.length > 0 && (
                      <details className="credit-balance-history">
                        <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#007bff', marginTop: '8px' }}>
                          View Credit Balance History ({duesData[selectedUnitId].creditBalanceHistory.length} entries)
                        </summary>
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '10px', 
                          backgroundColor: '#f8f9fa', 
                          border: '1px solid #dee2e6', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}>
                          {(() => {
                            // Generate display string from credit balance history array
                            const history = duesData[selectedUnitId].creditBalanceHistory;
                            if (!history || history.length === 0) return '';
                            
                            let display = '';
                            history.forEach((entry, index) => {
                              const dateStr = entry.timestamp?.displayFull || entry.timestamp?.display || entry.timestamp || 'Unknown Date';
                              const typeLabel = entry.type.replace(/_/g, ' ').toUpperCase();
                              
                              if (index > 0) display += '\n';
                              display += `${typeLabel}: ${entry.amount} on ${dateStr}`;
                              if (entry.description) display += ` ${entry.description}`;
                              if (entry.transactionId && !entry.transactionId.includes('_reversal')) {
                                display += ` (Transaction: ${entry.transactionId})`;
                              }
                              if (entry.notes) display += ` - ${entry.notes}`;
                            });
                            
                            return display;
                          })()}
                        </div>
                      </details>
                    )}
                    {calculationResult.monthlyPayments.length > 0 ? (
                      <p><strong>Months Covered:</strong> {calculationResult.monthsDescription || 'None'}</p>
                    ) : (
                      <p><strong>Months Covered:</strong> <span style={{color: '#d9534f'}}>No full months can be paid with this amount</span></p>
                    )}
                    <p><strong>Total Months:</strong> {calculationResult.monthlyPayments.length}</p>
                  </div>
                  
                  {calculationResult.monthlyPayments.length > 0 && (
                    <div className="distribution-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Month</th>
                            <th>Amount Applied</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(calculationResult.actualMonthsToPayIndexes || []).map((monthIndex, i) => {
                            return (
                              <tr key={`month-${monthIndex}`}>
                                <td>{getMonthName(monthIndex)} {selectedYear}</td>
                                <td>{formatAsMXN(calculationResult.monthlyPayments[i])}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td><strong>Total Applied</strong></td>
                            <td><strong>{formatAsMXN(calculationResult.totalPaid)}</strong></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  
                  <div className="leftover-amount">
                    <p><strong>Credit Activity:</strong> {getCreditMessage()}</p>
                    <p><strong>Credit Balance After Payment:</strong> {formatAsMXN(calculationResult.remainingCredit)}</p>
                    {calculationResult.remainingCredit > 0 && (
                      <p className="credit-explanation">
                        This credit will be automatically applied to future payments.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p>Enter an amount to see the distribution</p>
              )}
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="modal-footer">
              <button
                type="button"
                className="cancel-button"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}
      
      {/* Global Notification Modal for email status */}
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

export default DuesPaymentModal;

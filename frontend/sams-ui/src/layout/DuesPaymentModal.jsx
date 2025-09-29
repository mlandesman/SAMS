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
import DigitalReceipt from '../components/DigitalReceipt';
import NotificationModal from './NotificationModal';
import { useNotification } from '../hooks/useNotification';
import { getMexicoDateString } from '../utils/timezone';
import { useTransactionsContext } from '../context/TransactionsContext';
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
  const [calculationResult, setCalculationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Client data for dynamic payment methods and accounts
  const [clientPaymentMethods, setClientPaymentMethods] = useState([]);
  const [clientAccounts, setClientAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
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
        console.log(`Found first unpaid month: ${payment.month}`);
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
    
    console.log('---- DEBUG: Payment Status by Month ----');
    for (let i = 1; i <= 12; i++) {
      const payment = payments.find(p => p.month === i);
      const status = !payment ? 'No payment record' : 
                    !payment.paid ? 'Unpaid' :
                    Number(payment.paid) < monthlyAmount ? 'Partial payment' : 'Fully paid';
      
      console.log(`Month ${i}: ${status} - ${payment ? `Amount: ${payment.paid}` : 'No data'}`);
    }
    
    const firstUnpaidMonth = getFirstUnpaidMonth();
    console.log(`First unpaid month calculated as: ${firstUnpaidMonth}`);
  };

  // Calculate payment distribution
  const calculateDistribution = () => {
    if (!unit || !amountNumber) {
      setCalculationResult(null);
      return;
    }
    
    // Handle case where duesData might not exist for this unit yet
    const unitDuesData = duesData[selectedUnitId] || {
      creditBalance: 0,
      scheduledAmount: unit.duesAmount || 0,
      payments: Array(12).fill().map((_, i) => ({
        month: i + 1,
        paid: 0,
        date: null
      }))
    };
    
    const currentCredit = unitDuesData.creditBalance || 0;
    const monthlyAmount = unitDuesData.scheduledAmount || unit.duesAmount || 0;
    const firstUnpaidMonth = getFirstUnpaidMonth();
    
    // STEP 1: Handle credit balance repair if negative
    let remainingAmount = amountNumber;
    let creditRepairAmount = 0;
    let creditBalanceAfterRepair = currentCredit;
    
    if (currentCredit < 0) {
      creditRepairAmount = Math.min(Math.abs(currentCredit), remainingAmount);
      creditBalanceAfterRepair = currentCredit + creditRepairAmount;
      remainingAmount -= creditRepairAmount;
      
      console.log(`🔧 Credit repair needed: ${creditRepairAmount} to fix negative balance of ${currentCredit}`);
      console.log(`Credit balance after repair: ${creditBalanceAfterRepair}, Remaining for dues: ${remainingAmount}`);
    }
    
    // Debug log to verify calculation
    console.log('---- Payment Distribution Calculation ----');
    console.log(`Unit: ${selectedUnitId}, Monthly Amount: ${monthlyAmount}, Payment: ${amountNumber}`);
    console.log(`Original Credit Balance: ${currentCredit}, After Repair: ${creditBalanceAfterRepair}`);
    console.log(`Credit Repair Amount: ${creditRepairAmount}, Remaining for Dues: ${remainingAmount}`);
    
    // Run the test calculation
    testMonthCalculation();
    
    // STEP 2: Use remaining amount for monthly dues calculation
    const result = calculatePayments(remainingAmount, monthlyAmount, creditBalanceAfterRepair);
    
    console.log('Calculation result:', result);
    
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
    
    console.log("Months that will be paid:", monthsThatWillBePaid);
    
    // Calculate the description based on the actual months that will be paid
    const monthsDescription = monthsThatWillBePaid.length > 0 
      ? generateMonthsDescription(monthsThatWillBePaid[0], monthsThatWillBePaid.length, selectedYear)
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
    
    console.log('Final calculation result with months:', {
      startMonth: firstUnpaidMonth,
      monthCount: result.monthlyPayments.length,
      description: generateMonthsDescription(
        firstUnpaidMonth,
        result.monthlyPayments.length,
        selectedYear
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
    console.log('🧾 [RECEIPT DEBUG] Closing digital receipt...');
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
      };
      
      // Create payment record with details - ensure all required fields are properly set
      // Use getMexicoDateTime to properly handle date string without timezone shift
      const dateObj = getMexicoDateTime(paymentDate);
      
      // Validate date object
      if (isNaN(dateObj.getTime())) {
        setError('Invalid payment date format');
        setLoading(false);
        return;
      }
      
      const paymentDetails = {
        date: dateObj, // Use the validated Date object
        amount: amountNumber,
        method: paymentMethod,
        checkNumber: paymentMethod === 'check' ? checkNumber : null,
        notes: notes,
        description: generateTransactionDescription(),
        scheduledAmount: duesData[selectedUnitId]?.scheduledAmount || unit?.duesAmount || 0,
        creditBalanceAdded: calculationResult.amtOverpayment > 0 ? calculationResult.amtOverpayment : 0,
        newCreditBalance: calculationResult.remainingCredit, // Send the new calculated credit balance
        creditUsed: calculationResult.amtOverpayment < 0 ? Math.abs(calculationResult.amtOverpayment) : 0, // Amount of credit used
        creditRepairAmount: calculationResult.creditRepairAmount || 0 // Amount used to repair negative credit balance
      };
      
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
              { label: 'Date', value: new Date(paymentDate).toLocaleDateString() }
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
      console.log("Finding months that need payment...");
      const monthlyAmount = calculationResult.monthlyAmount;
      const monthsNeeded = calculationResult.monthlyPayments.length;
      let monthsToUpdate = [];
      let currentMonthIndex = calculationResult.startMonth;
      let paymentsRemaining = monthsNeeded;
      
      console.log(`Starting with month ${currentMonthIndex}, need to allocate ${paymentsRemaining} payments`);
      
      while (paymentsRemaining > 0) {
        // Calculate actual month (1-12) considering wrapping to next year
        const actualMonth = ((currentMonthIndex - 1) % 12) + 1;
        
        // Find existing payment for this month or create placeholder
        const existingPayment = duesData[selectedUnitId]?.payments?.find(p => p.month === actualMonth) || {
          month: actualMonth,
          paid: 0
        };
        
        const existingPaidAmount = Number(existingPayment.paid || 0);
        
        console.log(`Checking month ${actualMonth}: Existing paid=${existingPaidAmount}, Monthly amount=${monthlyAmount}`);
        
        // If this month isn't fully paid, add it to our update list
        if (existingPaidAmount < monthlyAmount) {
          console.log(`Month ${actualMonth} needs payment (${existingPaidAmount} < ${monthlyAmount})`);
          monthsToUpdate.push({
            month: actualMonth,
            existingAmount: existingPaidAmount,
            newAmount: monthlyAmount,  // Always pay the full monthly amount
            amountToAdd: monthlyAmount - existingPaidAmount // Amount to add to existing payment
          });
          
          paymentsRemaining--;
        } else {
          console.log(`Month ${actualMonth} already fully paid, skipping`);
        }
        
        // Move to next month
        currentMonthIndex++;
      }
      
      console.log(`Will update ${monthsToUpdate.length} months:`, monthsToUpdate);

      // Create the payment distribution data for the API
      const distribution = monthsToUpdate.map(monthData => ({
        month: monthData.month,
        existingAmount: monthData.existingAmount,
        newAmount: monthData.newAmount,
        amountToAdd: monthData.amountToAdd
      }));

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
          
          // DON'T refresh data yet - wait until after receipt is closed to avoid state conflicts
          console.log('🧾 [RECEIPT DEBUG] Skipping immediate data refresh to prevent state conflicts');
          
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
            console.log('First refresh completed');
            
            // Second refresh after another delay to catch any cached data issues
            setTimeout(async () => {
              try {
                console.log('Second refresh attempt...');
                await refreshData();
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
                  <p><strong>Current Credit Balance:</strong> {formatAsMXN(duesData[selectedUnitId]?.creditBalance || 0)}</p>
                </div>
                
                <div className="payment-distribution">
                  <h3>Payment Distribution</h3>
                  
                  {calculationResult ? (
                    <>
                      <div className="distribution-summary">
                        <p><strong>Monthly Due Amount:</strong> {formatAsMXN(calculationResult.monthlyAmount)}</p>
                        <p><strong>Payment Amount:</strong> {formatAsMXN(amountNumber)}</p>
                        <p><strong>Current Credit Balance:</strong> {formatAsMXN(duesData[selectedUnitId]?.creditBalance || 0)}</p>
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
                                  <tr key={monthIndex}>
                                    <td>{getMonthName(monthIndex)}</td>
                                    <td>{formatAsMXN(calculationResult.monthlyPayments[i] || 0)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                      <div className="credit-balance-info">
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
                disabled={loading || !calculationResult}
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
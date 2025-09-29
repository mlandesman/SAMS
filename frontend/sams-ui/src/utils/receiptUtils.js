/**
 * Receipt Generation Utilities
 * 
 * Provides a centralized way to generate and display Digital Receipts
 * for any transaction in the system. Handles all data fetching, validation,
 * and modal display logic.
 */

import { getTransactionById } from '../api/hoaDuesService';
import { getOwnerInfo } from './unitUtils';
import { numberToSpanishWords } from './numberToWords';

/**
 * Generate and display a Digital Receipt for a given transaction ID
 * 
 * @param {string} transactionId - The transaction ID to generate receipt for
 * @param {Object} options - Configuration options
 * @param {Function} options.setReceiptTransactionData - State setter for receipt data
 * @param {Function} options.setShowDigitalReceipt - State setter for modal visibility
 * @param {Function} options.showError - Error notification function
 * @param {Object} options.selectedClient - Current client context
 * @param {Array} options.units - Units data for owner lookup
 * 
 * @returns {Promise<boolean>} - Success status
 */
export const generateReceipt = async (transactionId, options) => {
  console.log('🧾 [RECEIPT UTILS] generateReceipt called with:', { transactionId, optionsKeys: Object.keys(options || {}) });
  
  const {
    setReceiptTransactionData,
    setShowDigitalReceipt,
    showError,
    selectedClient,
    units
  } = options;

  try {
    console.log('🧾 [RECEIPT UTILS] Starting receipt generation validation...');
    
    // Validate required options
    if (!setReceiptTransactionData || !setShowDigitalReceipt) {
      console.error('🧾 [RECEIPT UTILS] Missing required modal state setters');
      throw new Error('Missing required modal state setters');
    }

    if (!selectedClient?.id) {
      console.error('🧾 [RECEIPT UTILS] No client selected');
      throw new Error('No client selected');
    }
    
    console.log('🧾 [RECEIPT UTILS] Validation passed, fetching transaction...');

    // 1. Fetch the transaction data with retry logic for database consistency
    let transaction = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!transaction && retryCount < maxRetries) {
      try {
        console.log(`🧾 [RECEIPT UTILS] Fetch attempt ${retryCount + 1}/${maxRetries} for transaction ${transactionId}`);
        transaction = await getTransactionById(selectedClient.id, transactionId);
        if (transaction) {
          console.log('🧾 [RECEIPT UTILS] Transaction fetched successfully:', { id: transaction.id, amount: transaction.amount });
          break;
        } else {
          console.log('🧾 [RECEIPT UTILS] Transaction returned null/undefined');
        }
      } catch (error) {
        console.warn(`🧾 [RECEIPT UTILS] Transaction fetch attempt ${retryCount + 1} failed:`, error);
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`🧾 [RECEIPT UTILS] Transaction not found, retrying in ${retryCount * 500}ms... (attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 500)); // Progressive delay
      }
    }
    
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found after ${maxRetries} attempts`);
    }

    // 2. Validate that transaction has a unit ID (required for receipts)
    // Check both possible property names: 'unitId' and 'unit'
    const unitId = transaction.unitId || transaction.unit;
    if (!unitId || unitId.trim() === '') {
      throw new Error('Transaction does not have a unit ID - cannot generate receipt');
    }

    // 3. Get unit and owner information
    let ownerInfo = { name: 'Unit Owner', emails: [], phone: '' };
    
    if (units && units.length > 0) {
      const unitData = units.find(unit => unit.unitId === unitId);
      if (unitData) {
        const rawOwnerInfo = getOwnerInfo(unitData);
        
        // Convert to the format expected by DigitalReceipt
        ownerInfo = {
          name: `${rawOwnerInfo.firstName} ${rawOwnerInfo.lastName}`.trim() || 'Unit Owner',
          emails: rawOwnerInfo.email ? [rawOwnerInfo.email] : [],
          phone: '' // Phone not available in current data structure
        };
      }
    }

    // 4. Prepare receipt data in the format expected by DigitalReceipt component
    // Format the date properly - use backend-provided display format or format object
    let formattedDate;
    const rawDate = transaction.transactionDate || transaction.date;
    
    if (rawDate) {
      // Check if date has .display property from backend DateService
      if (rawDate.display) {
        // Use the display format provided by backend
        formattedDate = rawDate.display;
      } else if (rawDate.month && rawDate.day && rawDate.year) {
        // Use month/day/year from date object
        formattedDate = `${rawDate.month} ${rawDate.day}, ${rawDate.year}`;
      } else if (typeof rawDate === 'string') {
        // For string dates, parse and format in Cancun timezone to avoid shifts
        try {
          const dateObj = new Date(rawDate + 'T12:00:00'); // Noon to avoid timezone issues
          formattedDate = dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Cancun'
          });
        } catch {
          formattedDate = rawDate; // Use raw string as fallback
        }
      } else {
        // Fallback to raw date
        console.warn('Unknown date format, using raw value:', rawDate);
        formattedDate = String(rawDate);
      }
    } else {
      // No date provided, use current date in Cancun timezone
      formattedDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Cancun'
      });
    }

    const receiptData = {
      // Core transaction data
      id: transaction.id,
      unitId: unitId,  // Match what DigitalReceipt expects
      amount: transaction.amount / 100,  // Convert cents to dollars for display
      date: formattedDate, // Use the formatted date string
      
      // Payment details
      paymentMethod: transaction.paymentMethod || 'Unknown',
      checkNumber: transaction.checkNumber || null,
      notes: transaction.notes || '',
      description: transaction.description || transaction.category || 'Payment',
      category: transaction.category || 'HOA Dues',
      
      // Receipt formatting
      type: transaction.type || 'income',
      receiptNumber: `${selectedClient.id}-${transaction.id}`,
      receivedFrom: ownerInfo.name,
      
      // Amount in words (Spanish) - Convert centavos to pesos first
      amountInWords: numberToSpanishWords(Math.abs(transaction.amount) / 100),
      
      // Owner information
      ownerName: ownerInfo.name,
      ownerEmails: ownerInfo.emails,
      ownerPhone: ownerInfo.phone,
      
      // Additional metadata
      clientId: selectedClient.id,
      generatedAt: new Date().toISOString() // Convert to string
    };

    // 5. Validate critical receipt data
    if (!receiptData.amount || receiptData.amount <= 0) {
      throw new Error('Invalid transaction amount');
    }

    if (!receiptData.unitId) {
      throw new Error('Missing unit number');
    }

    // 6. Set the receipt data and show the modal
    console.log('🧾 [RECEIPT UTILS] Setting receipt data and showing modal...');
    console.log('🧾 [RECEIPT UTILS] Receipt data:', { 
      id: receiptData.id, 
      unitId: receiptData.unitId, 
      amount: receiptData.amount,
      receiptNumber: receiptData.receiptNumber 
    });
    
    console.log('🧾 [RECEIPT UTILS] Calling setReceiptTransactionData...');
    setReceiptTransactionData(receiptData);
    
    console.log('🧾 [RECEIPT UTILS] Calling setShowDigitalReceipt(true)...');
    setShowDigitalReceipt(true);
    
    console.log('🧾 [RECEIPT UTILS] Receipt generation completed successfully');
    return true;

  } catch (error) {
    console.error('🧾 [RECEIPT UTILS] Error generating receipt:', error);
    console.error('🧾 [RECEIPT UTILS] Error stack:', error.stack);
    
    // Show user-friendly error message
    const errorMessage = error.message || 'Failed to generate receipt';
    
    console.log('🧾 [RECEIPT UTILS] Showing error to user:', errorMessage);
    
    if (showError) {
      showError(errorMessage);
    } else {
      // Fallback error display
      alert(`Error: ${errorMessage}`);
    }
    
    console.log('🧾 [RECEIPT UTILS] Returning false from generateReceipt');
    return false;
  }
};

/**
 * Validate if a transaction is eligible for receipt generation
 * 
 * @param {Object} transaction - Transaction object to validate
 * @returns {Object} - { isValid: boolean, reason: string }
 */
export const validateReceiptEligibility = (transaction) => {
  if (!transaction) {
    return { isValid: false, reason: 'No transaction provided' };
  }

  // Check both possible property names: 'unitId' and 'unit'
  const unitId = transaction.unitId || transaction.unit;
  if (!unitId || unitId.trim() === '') {
    return { isValid: false, reason: 'Transaction does not have a unit ID' };
  }

  if (!transaction.amount || transaction.amount <= 0) {
    return { isValid: false, reason: 'Invalid transaction amount' };
  }

  if (transaction.type === 'expense') {
    return { isValid: false, reason: 'Receipts are only available for income transactions' };
  }

  return { isValid: true, reason: 'Transaction is eligible for receipt generation' };
};

/**
 * Quick receipt generation for HOA Dues (simplified interface)
 * 
 * @param {string} transactionId - Transaction ID
 * @param {Object} context - Required context objects
 * @returns {Promise<boolean>} - Success status
 */
export const generateHOADuesReceipt = async (transactionId, context) => {
  return generateReceipt(transactionId, {
    setReceiptTransactionData: context.setReceiptTransactionData,
    setShowDigitalReceipt: context.setShowDigitalReceipt,
    showError: context.showError,
    selectedClient: context.selectedClient,
    units: context.units
  });
};

/**
 * Quick receipt generation for Transactions View (simplified interface)
 * 
 * @param {Object} transaction - Full transaction object
 * @param {Object} context - Required context objects  
 * @returns {Promise<boolean>} - Success status
 */
export const generateTransactionReceipt = async (transaction, context) => {
  // Validate eligibility first
  const eligibility = validateReceiptEligibility(transaction);
  if (!eligibility.isValid) {
    if (context.showError) {
      context.showError(eligibility.reason);
    }
    return false;
  }

  return generateReceipt(transaction.id, {
    setReceiptTransactionData: context.setReceiptTransactionData,
    setShowDigitalReceipt: context.setShowDigitalReceipt,
    showError: context.showError,
    selectedClient: context.selectedClient,
    units: context.units
  });
};

// src/controllers/hoaDuesController.js
import { getDb } from '../firebase.js';
import { writeAuditLog } from '../utils/auditLogger.js';
import { createTransaction } from './transactionsController.js';
import { randomUUID } from 'crypto';
import { databaseFieldMappings } from '../utils/databaseFieldMappings.js';
import { 
  calculateDuesStatus, 
  calculatePaymentDistribution, 
  validatePayment,
  getYearSummary 
} from '../utils/hoaCalculations.js';
// DateService removed - using Mexico timezone utilities instead
import { getMexicoDate, getMexicoDateString } from '../utils/timezone.js';
import admin from 'firebase-admin';

const { dollarsToCents, centsToDollars, convertToTimestamp, convertFromTimestamp } = databaseFieldMappings;

// Helper to format date fields consistently for API responses
function formatDateField(dateValue) {
  if (!dateValue) return null;
  
  try {
    // Handle Firestore timestamp
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate().toISOString().split('T')[0];
    }
    
    // Handle Date object - extract YYYY-MM-DD part and create date at noon Mexico time
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0];
    }
    
    // Handle string dates
    if (typeof dateValue === 'string') {
      // Extract YYYY-MM-DD part if it's an ISO string
      if (dateValue.includes('T')) {
        return dateValue.split('T')[0];
      }
      return dateValue;
    }
    
    return dateValue;
  } catch (error) {
    console.error('Error formatting date field:', error);
    return null;
  }
}

// Initialize db as a properly awaited promise
let dbInstance;

// Month names for generating human-readable allocation names
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Get month name from month number (1-12)
 */
function getMonthName(month) {
  return MONTH_NAMES[month - 1] || `Month ${month}`;
}

/**
 * Create HOA allocations from distribution data
 * @param {Array} distribution - Payment distribution array
 * @param {string} unitId - Unit identifier
 * @param {number} year - Payment year
 * @param {object} paymentData - Payment data containing credit info
 * @returns {Array} Array of allocation objects
 */
function createHOAAllocations(distribution, unitId, year, paymentData) {
  const allocations = [];
  
  // Add HOA Dues allocations for each month
  if (distribution && distribution.length > 0) {
    distribution.forEach((item, index) => {
      allocations.push({
        id: `alloc_${String(index + 1).padStart(3, '0')}`, // alloc_001, alloc_002, etc.
        type: "hoa_month",
        targetId: `month_${item.month}_${year}`,
        targetName: `${getMonthName(item.month)} ${year}`,
        amount: item.amountToAdd,
        percentage: null, // Will be calculated in allocationSummary if needed
        categoryName: "HOA Dues", // Required for split transaction validation
        categoryId: "hoa_dues", // Optional but recommended for consistency
        data: {
          unitId: unitId,
          month: item.month,
          year: year
        },
        metadata: {
          processingStrategy: "hoa_dues",
          cleanupRequired: true,
          auditRequired: true,
          createdAt: new Date().toISOString()
        }
      });
    });
  }
  
  // Add Credit Balance allocation for overpayments (positive) or usage (negative)
  if (paymentData && paymentData.creditBalanceAdded && paymentData.creditBalanceAdded > 0) {
    // Overpayment: Credit balance is ADDED (positive allocation)
    allocations.push({
      id: `alloc_${String(allocations.length + 1).padStart(3, '0')}`,
      type: "account_credit",
      targetId: `credit_${unitId}_${year}`,
      targetName: `Account Credit - Unit ${unitId}`,
      amount: paymentData.creditBalanceAdded,
      percentage: null,
      categoryName: "Account Credit", // Required for split transaction validation
      categoryId: "account-credit", // As specified by user
      data: {
        unitId: unitId,
        year: year,
        creditType: "overpayment"
      },
      metadata: {
        processingStrategy: "account_credit",
        cleanupRequired: true,
        auditRequired: true,
        createdAt: new Date().toISOString()
      }
    });
  } else if (paymentData && paymentData.creditUsed && paymentData.creditUsed > 0) {
    // Underpayment: Credit balance is USED (negative allocation)
    allocations.push({
      id: `alloc_${String(allocations.length + 1).padStart(3, '0')}`,
      type: "account_credit",
      targetId: `credit_${unitId}_${year}`,
      targetName: `Account Credit - Unit ${unitId}`,
      amount: -paymentData.creditUsed, // Negative amount for credit usage
      percentage: null,
      categoryName: "Account Credit", // Required for split transaction validation
      categoryId: "account-credit", // As specified by user
      data: {
        unitId: unitId,
        year: year,
        creditType: "usage"
      },
      metadata: {
        processingStrategy: "account_credit",
        cleanupRequired: true,
        auditRequired: true,
        createdAt: new Date().toISOString()
      }
    });
  }
  
  return allocations;
}

/**
 * Create allocation summary for transaction
 * @param {Array} distribution - Payment distribution array
 * @param {number} totalAmountCents - Total transaction amount in cents
 * @returns {Object} Allocation summary object
 */
function createAllocationSummary(distribution, totalAmountCents) {
  if (!distribution || distribution.length === 0) {
    return {
      totalAllocated: 0,
      allocationCount: 0,
      allocationType: null,
      hasMultipleTypes: false
    };
  }
  
  const totalAllocated = distribution.reduce((sum, item) => sum + item.amountToAdd, 0);
  
  // Debug logging to understand the units mismatch
  console.log('🔍 [ALLOCATION DEBUG] Units comparison:', {
    totalAmountCents,
    totalAllocated,
    distributionItems: distribution.map(item => ({ 
      month: item.month, 
      amountToAdd: item.amountToAdd 
    })),
    difference: totalAmountCents - totalAllocated
  });
  
  return {
    totalAllocated: totalAllocated,
    allocationCount: distribution.length,
    allocationType: "hoa_month",
    hasMultipleTypes: false,
    // Verify allocation integrity
    integrityCheck: {
      expectedTotal: totalAmountCents,
      actualTotal: totalAllocated,
      isValid: Math.abs(totalAmountCents - totalAllocated) < 100 // Allow 1 peso tolerance for debugging
    }
  };
}

/**
 * Initialize a year document with 12-month payment array
 * @param {string} clientId - ID of the client
 * @param {string} unitId - ID of the unit
 * @param {number} year - Year to initialize
 * @returns {object} The initialized HOA dues document
 */
async function initializeYearDocument(clientId, unitId, year) {
  try {
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // Create 12-element payment array (Jan-Dec)
    const payments = Array(12).fill(null).map(() => ({
      paid: false,
      amount: 0,
      date: null,
      reference: null
    }));
    
    const monthlyDue = 250; // Should come from config
    const hoaDuesDoc = {
      year,
      unitId,
      payments,
      creditBalance: 0,
      creditBalanceHistory: [],
      totalDue: dollarsToCents(monthlyDue * 12),
      totalPaid: 0,
      // Only updated timestamp - creation metadata in audit log
      updated: convertToTimestamp(new Date())
    };
    
    // Document ID is the year
    const docRef = dbInstance.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    await docRef.set(hoaDuesDoc);
    
    console.log(`Initialized HOA dues document for unit ${unitId}, year ${year}`);
    
    return hoaDuesDoc;
  } catch (error) {
    console.error('Error initializing year document:', error);
    throw error;
  }
}

/**
 * Record an HOA dues payment and link it to a transaction
 * 
 * @param {string} clientId - ID of the client
 * @param {string} unitId - ID of the unit making payment
 * @param {number} year - Year for the payment
 * @param {object} paymentData - Payment data containing amount, date, etc.
 * @param {Array} distribution - How payment should be distributed across months
 * @returns {object} Result containing status and payment details
 */
async function recordDuesPayment(clientId, unitId, year, paymentData, distribution) {
  try {
    // Log full payment data for debugging
    console.log('Processing payment data in controller:', {
      clientId,
      unitId,
      year,
      paymentData: {
        ...paymentData,
        date: paymentData.date,
        dateType: typeof paymentData.date,
        amount: paymentData.amount,
        amountType: typeof paymentData.amount,
      },
      distribution
    });
    
    // Validate required fields with better error messages
    if (!clientId) {
      throw new Error('Missing clientId for dues payment');
    }
    if (!unitId) {
      throw new Error('Missing unitId for dues payment');
    }
    if (!year) {
      throw new Error('Missing year for dues payment');
    }
    if (!paymentData.amount && paymentData.amount !== 0) {
      throw new Error('Missing amount in paymentData');
    }
    if (!paymentData.date) {
      throw new Error('Missing date in paymentData');
    }
    
    // Create a more detailed description for the transaction
    const description = paymentData.description || `HOA Dues payment for Unit ${unitId}`;
    
    // First, create a transaction record
    // Enhanced date handling with Mexico timezone utilities for proper timezone support
    console.log('Payment date received by backend:', paymentData.date, 'Type:', typeof paymentData.date);
    // Import Mexico timezone utilities
    const { getMexicoDate, getMexicoDateString } = await import('../utils/timezone.js');
    let paymentDate;
    let paymentTimestamp;
    
    try {
      // Determine type and convert appropriately using Mexico timezone utilities
      if (!paymentData.date) {
        console.log('No date provided, using current Mexico date');
        paymentDate = getMexicoDate();
        paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
      } else if (paymentData.date instanceof Date) {
        console.log('Date is already a Date object');
        paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentData.date);
        paymentDate = paymentData.date;
      } else if (typeof paymentData.date === 'string') {
        console.log('Date is a string, parsing with Mexico timezone handling');
        // Extract date part from ISO string if present (YYYY-MM-DD)
        const dateOnly = paymentData.date.split('T')[0];
        console.log('Extracted date part:', dateOnly);
        
        // Create date at noon Mexico time to avoid timezone boundary issues
        // This matches the frontend getMexicoDateTime function approach
        paymentDate = new Date(dateOnly + 'T12:00:00');
        paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
      } else if (paymentData.date && typeof paymentData.date.toDate === 'function') {
        console.log('Date is a Firestore Timestamp');
        paymentTimestamp = paymentData.date;
        paymentDate = paymentData.date.toDate();
      } else if (typeof paymentData.date === 'object') {
        console.log('Date is an object, attempting to extract date information');
        // Attempt to extract timestamp if available
        if ('seconds' in paymentData.date && 'nanoseconds' in paymentData.date) {
          paymentTimestamp = new admin.firestore.Timestamp(paymentData.date.seconds, paymentData.date.nanoseconds || 0);
          paymentDate = paymentTimestamp.toDate();
        } else {
          // Final fallback - use current Mexico date
          console.error('Could not parse date object, using current Mexico date');
          paymentDate = getMexicoDate();
          paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
        }
      } else {
        // Final fallback
        console.error('Unrecognized date format, using current Mexico date');
        paymentDate = getMexicoDate();
        paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
      }
      
      console.log('Payment date after conversion:', paymentDate, 'Valid:', !isNaN(paymentDate.getTime()));
      
      // Final validation - if date is still invalid, use current Mexico date
      if (isNaN(paymentDate.getTime())) {
        console.error('Date is invalid after conversion, using current Mexico date');
        paymentDate = getMexicoDate();
        paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
      }
    } catch (dateError) {
      console.error('Error converting date:', dateError);
      paymentDate = getMexicoDate();
      paymentTimestamp = admin.firestore.Timestamp.fromDate(paymentDate);
    }
    
    // Format notes to match the existing schema format
    // Combine description, checkNumber, and notes into a single notes field
    let formattedNotes = description;
    
    // Add check number if available
    if (paymentData.method === 'check' && paymentData.checkNumber) {
      formattedNotes += ` - Check #${paymentData.checkNumber}`;
    }
    
    // Add user-provided notes if available
    if (paymentData.notes) {
      formattedNotes += ` - ${paymentData.notes}`;
    }
    
    // Add payment breakdown in format: "$X Dues + $Y credit" (matches old system)
    if (paymentData.creditUsed && paymentData.creditUsed > 0) {
      // When using existing credit: show dues paid + credit used
      const duesAmount = paymentData.amount || 0;
      const creditUsed = Math.round(paymentData.creditUsed);
      formattedNotes += ` - $${Math.round(duesAmount)} Dues + $${creditUsed} credit`;
    } else if (paymentData.creditBalanceAdded && paymentData.creditBalanceAdded > 0) {
      // When overpaying: show dues paid + credit added
      const duesAmount = (paymentData.amount || 0) - (paymentData.creditBalanceAdded || 0);
      const creditAdded = Math.round(paymentData.creditBalanceAdded);
      formattedNotes += ` - $${Math.round(duesAmount)} Dues + $${creditAdded} credit`;
    }
    
    // Debug: Log the payment date being used
    console.log(`🗓️ [HOA PAYMENT DEBUG] Creating transaction with date:`, {
      paymentDate: paymentDate.toISOString(),
      year: paymentDate.getFullYear(),
      month: paymentDate.getMonth() + 1,
      day: paymentDate.getDate(),
      originalDate: paymentData.date,
      targetYear: year
    });
    
    // Create transaction data with standardized field names
    const transactionData = {
      date: paymentDate.toISOString().split('T')[0], // Convert Date to string format YYYY-MM-DD
      amount: paymentData.amount,
      categoryId: 'hoa_dues',
      categoryName: 'HOA Dues',
      type: 'income',
      // Payment method is the ID, we'll look up the type from the payment method document
      // For now, use a simple mapping based on common patterns
      accountType: paymentData.accountType || 'bank', // Default to bank, frontend should pass this
      accountId: paymentData.accountId || paymentData.accountToCredit || 'bank-001', // Use standard account IDs
      paymentMethodId: paymentData.method || null,  // This is the payment method document ID
      notes: formattedNotes, // Consolidated notes field with all information
      unitId: unitId, // Use the new field name
      vendorId: 'deposit',
      vendorName: 'Deposit',
      reference: `DUES-${unitId}-${year}`,
      
      // Enhanced allocation pattern - generalized for future split transactions
      allocations: createHOAAllocations(distribution, unitId, year, paymentData),
      allocationSummary: createAllocationSummary(distribution, dollarsToCents(paymentData.amount)),
      
      // Maintain backward compatibility - preserve original duesDistribution
      duesDistribution: distribution.map(item => ({
        unitId,
        month: item.month,
        amount: item.amountToAdd,
        year
      })),
      
      // NOTE: Credit balance data is stored only in HOA dues documents, not here
      // This prevents data duplication and synchronization issues
      
      // Add metadata to enable bidirectional navigation
      metadata: {
        type: 'hoa_dues',
        unitId,
        year,
        months: distribution.map(item => item.month)
      }
    };
    
    // Store the checkNumber as an internal field if provided
    if (paymentData.method === 'check' && paymentData.checkNumber) {
      transactionData.checkNumber = paymentData.checkNumber;
    }
    
    // Create the transaction
    const transactionId = await createTransaction(clientId, transactionData);
    
    if (!transactionId) {
      throw new Error('Failed to create transaction record');
    }
    
    console.log(`Created transaction ${transactionId} for HOA Dues payment`);
    
    // Now update the unit's dues record
    // Get the database instance if not already initialized
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // Create document reference using new structure
    const duesRef = dbInstance.collection('clients').doc(clientId)
                      .collection('units').doc(unitId).collection('dues').doc(year.toString());
    const duesDoc = await duesRef.get();
    
    let duesData;
    
    if (duesDoc.exists) {
      duesData = duesDoc.data();
      console.log('Found existing dues record:', duesData);
    } else {
      console.log('No existing dues record found, initializing new record');
      // Initialize with 12-element payment array
      const initialDoc = await initializeYearDocument(clientId, unitId, year);
      duesData = initialDoc;
    }
    
    // Ensure payments is always a 12-element array - but PRESERVE existing data
    if (!Array.isArray(duesData.payments)) {
      console.log('⚠️ payments is not an array, initializing');
      duesData.payments = Array(12).fill(null).map(() => ({
        paid: false,
        amount: 0,
        date: null,
        reference: null
      }));
    } else if (duesData.payments.length < 12) {
      console.log(`⚠️ payments array has ${duesData.payments.length} elements, padding to 12`);
      // Pad the array to 12 elements without losing existing data
      while (duesData.payments.length < 12) {
        duesData.payments.push({
          paid: false,
          amount: 0,
          date: null,
          reference: null
        });
      }
    } else if (duesData.payments.length > 12) {
      console.log(`⚠️ payments array has ${duesData.payments.length} elements, truncating to 12`);
      // Truncate to 12 elements
      duesData.payments = duesData.payments.slice(0, 12);
    }
    
    console.log('Processing distribution:', distribution);
    console.log('Current payments array before update:', duesData.payments);      // Handle case where distribution is empty (credit-only payment)
    if (!distribution || distribution.length === 0) {
      console.log(`No distribution provided - this appears to be a credit-only payment of ${paymentData.amount}`);
      
      // Add credit to the balance (convert to cents)
      const creditToAdd = dollarsToCents(paymentData.amount || 0);
      console.log(`Adding ${centsToDollars(creditToAdd)} to credit balance`);
      duesData.creditBalance = (duesData.creditBalance || 0) + creditToAdd;
      
      // Add a payment note about the credit
      const paymentNote = `Added ${creditToAdd} to credit balance (Transaction ID: ${transactionId})`;
      
      // Add a note to transaction metadata
      console.log(`Adding note to transaction: ${paymentNote}`);
    }
    
    // Update payments array with distributed payments
    console.log(`Processing ${distribution.length} distribution items`);
    
    if (distribution.length === 0) {
      console.log('No distribution items to process - this may be a credit-only payment');
    }
    
    for (const item of distribution) {
      console.log(`Processing payment for month ${item.month}:`, item);
      
      // Convert month to 0-based index (month 1 = index 0)
      const monthIndex = item.month - 1;
      
      if (monthIndex < 0 || monthIndex > 11) {
        console.error(`Invalid month ${item.month}, skipping`);
        continue;
      }
      
      // Create a payment note without the redundant prefix, just include user notes and transaction ID
      const paymentNote = paymentData.notes 
        ? `${paymentData.notes} (Transaction ID: ${transactionId})`
        : `Payment recorded in Transaction ID: ${transactionId}`;
      
      // Use timestamp conversion utility
      const paymentTimestamp = convertToTimestamp(paymentDate);
      
      // Calculate new paid amount - handle different distribution formats
      // Frontend sends amounts in dollars, so we need to convert to cents
      const currentAmount = duesData.payments[monthIndex].amount || 0;
      const amountInCents = item.newAmount !== undefined 
        ? dollarsToCents(item.newAmount)  // newAmount is in dollars from frontend
        : currentAmount + dollarsToCents(item.amountToAdd || 0);  // amountToAdd is also in dollars
          
      console.log(`Updating month ${item.month} (index ${monthIndex}): ${centsToDollars(amountInCents)} dollars`);
      
      // Update the specific month in the 12-element array - PRESERVE existing data
      duesData.payments[monthIndex] = {
        ...duesData.payments[monthIndex], // Preserve any existing fields
        paid: amountInCents > 0,
        amount: amountInCents,
        date: paymentTimestamp,
        reference: transactionId,
        notes: paymentNote  // Store payment notes for tooltip display
      };
    }
    
    // Update credit balance based on the calculation from frontend
    const originalCreditBalance = duesData.creditBalance || 0;
    const currentDateTime = new Date().toString();
    
    // Initialize creditBalanceHistory as array if it doesn't exist
    if (!duesData.creditBalanceHistory) {
      duesData.creditBalanceHistory = [];
      // If there's an existing credit balance, add a starting entry
      if (originalCreditBalance !== 0) {
        duesData.creditBalanceHistory.push({
          id: randomUUID(),
          timestamp: convertToTimestamp(new Date()),
          transactionId: null,
          type: 'starting_balance',
          amount: originalCreditBalance,
          description: 'Initial credit balance',
          balanceBefore: 0,
          balanceAfter: originalCreditBalance,
          notes: 'System initialization'
        });
      }
    }
    
    if (paymentData.newCreditBalance !== undefined) {
      console.log(`Setting credit balance from ${centsToDollars(originalCreditBalance)} to calculated amount: ${paymentData.newCreditBalance}`);
      duesData.creditBalance = dollarsToCents(paymentData.newCreditBalance);
      
      // Add credit repair entry if negative balance was fixed
      if (paymentData.creditRepairAmount && paymentData.creditRepairAmount > 0) {
        console.log(`Credit repair amount: ${paymentData.creditRepairAmount}`);
        duesData.creditBalanceHistory.push({
          id: randomUUID(),
          timestamp: convertToTimestamp(new Date()),
          transactionId: transactionId,
          type: 'credit_repair',
          amount: paymentData.creditRepairAmount,
          description: 'to fix negative balance',
          balanceBefore: originalCreditBalance,
          balanceAfter: originalCreditBalance + paymentData.creditRepairAmount,
          notes: `${paymentData.method || 'Payment'} repair`
        });
      }
      
      // Add credit usage entry
      if (paymentData.creditUsed && paymentData.creditUsed > 0) {
        console.log(`Credit used in this payment: ${paymentData.creditUsed}`);
        const balanceAfterUse = paymentData.newCreditBalance - (paymentData.creditBalanceAdded || 0);
        duesData.creditBalanceHistory.push({
          id: randomUUID(),
          timestamp: convertToTimestamp(new Date()),
          transactionId: transactionId,
          type: 'credit_used',
          amount: paymentData.creditUsed,
          description: `from ${paymentData.method || 'Payment'}`,
          balanceBefore: balanceAfterUse + paymentData.creditUsed,
          balanceAfter: balanceAfterUse,
          notes: paymentData.notes || ''
        });
      }
      
      // Add credit addition entry
      if (paymentData.creditBalanceAdded && paymentData.creditBalanceAdded > 0) {
        duesData.creditBalanceHistory.push({
          id: randomUUID(),
          timestamp: convertToTimestamp(new Date()),
          transactionId: transactionId,
          type: 'credit_added',
          amount: paymentData.creditBalanceAdded,
          description: 'from Overpayment',
          balanceBefore: paymentData.newCreditBalance - paymentData.creditBalanceAdded,
          balanceAfter: paymentData.newCreditBalance,
          notes: paymentData.notes || ''
        });
      }
      
    } else if (paymentData.creditBalanceAdded) {
      // Fallback to old logic for backward compatibility
      console.log(`Adding to credit balance (legacy): ${paymentData.creditBalanceAdded}`);
      duesData.creditBalance = (duesData.creditBalance || 0) + paymentData.creditBalanceAdded;
      
      // Add entry for legacy credit addition
      duesData.creditBalanceHistory.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        transactionId: transactionId,
        type: 'credit_added',
        amount: paymentData.creditBalanceAdded,
        description: 'from Legacy payment',
        balanceBefore: duesData.creditBalance - paymentData.creditBalanceAdded,
        balanceAfter: duesData.creditBalance,
        notes: 'Legacy compatibility'
      });
    }
    
    console.log(`Credit balance updated: ${originalCreditBalance} → ${duesData.creditBalance}`);
    
    // Debug the data before saving - more detailed logging
    console.log('Attempting to save dues data:', {
      path: `clients/${clientId}/units/${unitId}/dues/${year}`,
      duesData: {
        creditBalance: duesData.creditBalance,
        scheduledAmount: duesData.scheduledAmount,
        paymentsCount: duesData.payments.length,
        payments: duesData.payments.map(p => ({
          month: p.month,
          paid: p.paid,
          date: p.date,
          notes: p.notes?.substring(0, 30) + (p.notes?.length > 30 ? '...' : '')
        }))
      }
    });
    
    try {
      // Get the exact Firestore path for debugging
      const firestorePath = `clients/${clientId}/units/${unitId}/dues/${year.toString()}`;
      console.log(`🔍 Attempting to update Firestore document at path: ${firestorePath}`);
      
      // Log the duesRef details
      console.log('Document reference details:', {
        path: duesRef.path,
        parent: duesRef.parent.path,
        id: duesRef.id
      });
      
      // Debug the current state of duesData before cleaning
      console.log('Current duesData structure before cleaning:', {
        creditBalance: duesData.creditBalance,
        scheduledAmount: duesData.scheduledAmount,
        paymentsCount: duesData.payments?.length || 0,
        paymentsArray: Array.isArray(duesData.payments),
        firstPayment: duesData.payments && duesData.payments.length > 0 ? duesData.payments[0] : null
      });
      
      // Calculate totalPaid from the 12-element payment array
      const totalPaid = duesData.payments.reduce((sum, payment) => 
        sum + (payment.amount || 0), 0
      );
      
      // SURGICAL UPDATE: Only update specific fields that changed
      const updates = {
        // Update calculated fields
        totalPaid: totalPaid,
        creditBalance: Number(duesData.creditBalance) || 0,
        
        // Update the payment array
        payments: duesData.payments, // Already updated with new payment data
        
        // Update credit balance history
        creditBalanceHistory: Array.isArray(duesData.creditBalanceHistory) ? [...duesData.creditBalanceHistory] : [],
        
        // Update timestamp
        updated: convertToTimestamp(new Date())
      };
      
      // IMPORTANT: We do NOT include these fields in updates:
      // - scheduledAmount (static configuration)
      // - duesAmount (static configuration)
      // - unitId (static identifier)
      // - year (static identifier)
      // - totalDue (static configuration)
      
      // Log the update for debugging
      console.log('Surgical update fields:', {
        creditBalance: updates.creditBalance,
        totalPaid: updates.totalPaid,
        paymentsCount: updates.payments.length,
        updatedFields: Object.keys(updates)
      });
      
      // Use update() instead of set() for surgical updates
      const db = await getDb();
      try {
        console.log(`🔄 Attempting surgical update for document: ${firestorePath}`);
        
        // Use update() to only modify specific fields
        await duesRef.update(updates);
        console.log(`✅ Surgical update completed successfully for document: ${firestorePath}`);
      } catch (updateError) {
        console.error(`❌ Update failed:`, updateError);
        
        // If document doesn't exist, we need to create it with full structure
        if (updateError.code === 'not-found' || updateError.message?.includes('No document to update')) {
          console.log(`Document doesn't exist, initializing new document`);
          
          // Initialize with full structure including static fields
          const newDuesDoc = {
            year: year,
            unitId: unitId,
            creditBalance: updates.creditBalance,
            totalDue: duesData.totalDue || dollarsToCents(250 * 12), // Annual dues in cents
            totalPaid: updates.totalPaid,
            payments: updates.payments,
            creditBalanceHistory: updates.creditBalanceHistory,
            updated: updates.updated,
            // Preserve scheduledAmount if it exists in duesData
            ...(duesData.scheduledAmount !== undefined && { scheduledAmount: duesData.scheduledAmount })
          };
          
          await duesRef.set(newDuesDoc);
          console.log(`✅ Created new document with full structure`);
        } else {
          throw new Error(`Failed to update dues data: ${updateError.message}`);
        }
      }
      
      // Double-check that the data was saved by reading it back
      const verifyDoc = await duesRef.get();
      if (verifyDoc.exists) {
        const savedData = verifyDoc.data();
        console.log(`✅ Verified dues record for Unit ${unitId} Year ${year}:`, {
          savedCreditBalance: savedData.creditBalance,
          savedPaymentsCount: savedData.payments?.length || 0,
          path: firestorePath,
          documentId: verifyDoc.id
        });
        
        // Check if the payment count matches what we expected
        if (savedData.payments?.length !== updates.payments?.length) {
          console.warn(`⚠️ Warning: Saved payments count (${savedData.payments?.length}) doesn't match expected count (${updates.payments?.length})`);
          
          // Try to update just the payments array as a fallback
          console.log(`🔄 Attempting to fix payments array with surgical update...`);
          await duesRef.update({ payments: updates.payments });
          console.log(`✅ Payments array update completed`);
          
          // Final verification after payments update
          const finalCheck = await duesRef.get();
          if (finalCheck.exists) {
            const finalData = finalCheck.data();
            if (finalData.payments?.length !== updates.payments?.length) {
              console.error(`❌ Still couldn't correct the payments array length after update!`);
            } else {
              console.log(`✅ Successfully fixed payments array with update`);
            }
          }
        }
      } else {
        console.error(`❌ Verification failed: Could not read back dues record for Unit ${unitId} Year ${year}`);
        console.log(`🔄 Document doesn't exist, attempting to create it with full data...`);
        
        // Create full document structure for new document
        const newDuesDoc = {
          year: year,
          unitId: unitId,
          creditBalance: updates.creditBalance,
          totalDue: duesData.totalDue || dollarsToCents(250 * 12), // Annual dues in cents
          totalPaid: updates.totalPaid,
          payments: updates.payments,
          creditBalanceHistory: updates.creditBalanceHistory,
          updated: updates.updated,
          // Preserve scheduledAmount if it exists in duesData
          ...(duesData.scheduledAmount !== undefined && { scheduledAmount: duesData.scheduledAmount })
        };
        
        // Try a direct write without merge as last resort
        await duesRef.set(newDuesDoc);
        console.log(`✅ Created new document at ${firestorePath}`);
      }
      
      // Final verification
      const finalVerify = await duesRef.get();
      console.log(`🔍 Final verification - Document exists: ${finalVerify.exists}, Payment count: ${finalVerify.exists ? finalVerify.data().payments?.length : 'N/A'}`);
    } catch (saveError) {
      console.error('❌ Error saving dues data:', saveError);
      console.error('Error details:', saveError);
      throw new Error(`Failed to save dues data: ${saveError.message}`);
    }
    
    // Log the action
    await writeAuditLog({
      module: 'hoadues',
      action: 'payment',
      parentPath: `clients/${clientId}/units/${unitId}/dues`,
      docId: `${year}`,
      friendlyName: `Unit ${unitId} Dues Payment`,
      notes: `Recorded payment of ${paymentData.amount} for year ${year}`,
      metadata: {
        unitId,
        amount: paymentData.amount,
        transactionId
      }
    });
    
    return {
      success: true,
      transactionId,
      duesData
    };
  } catch (error) {
    console.error('❌ Error recording dues payment:', error);
    throw error;
  }
}

/**
 * Get dues data for a unit for a specific year
 * 
 * @param {string} clientId - ID of the client
 * @param {string} unitId - ID of the unit 
 * @param {number} year - Year to fetch dues data for
 * @returns {object} Dues data for the specified year
 */
async function getUnitDuesData(clientId, unitId, year) {
  try {
    console.log(`🔍 Getting dues data for client ${clientId}, unit ${unitId}, year ${year}`);
    
    // Get the database instance if not already initialized
    if (!dbInstance) {
      console.log('Getting new database instance...');
      dbInstance = await getDb();
    }
    
    // Create document reference using new structure
    const firestorePath = `clients/${clientId}/units/${unitId}/dues/${year.toString()}`;
    console.log(`🔍 Fetching document from path: ${firestorePath}`);
    
    const duesRef = dbInstance.collection('clients').doc(clientId)
                      .collection('units').doc(unitId).collection('dues').doc(year.toString());
    
    console.log('Document reference created:', {
      path: duesRef.path,
      parent: duesRef.parent.path,
      id: duesRef.id
    });
    
    const duesDoc = await duesRef.get();
    
    console.log(`Document exists: ${duesDoc.exists}`);
    
    if (duesDoc.exists) {
      const data = duesDoc.data();
      console.log(`✅ Found dues data with ${data.payments?.length || 0} payments and credit balance ${centsToDollars(data.creditBalance || 0)}`);
      
      // Convert amounts from cents to dollars for API response
      const apiData = {
        ...data,
        creditBalance: centsToDollars(data.creditBalance || 0),
        scheduledAmount: centsToDollars(data.scheduledAmount || 0),
        totalDue: centsToDollars(data.totalDue || 0),
        totalPaid: centsToDollars(data.totalPaid || 0),
        payments: data.payments.map((payment, index) => ({
          ...payment,
          month: index + 1, // Add month field (1-based)
          amount: payment.amount ? centsToDollars(payment.amount) : 0,
          date: formatDateField(payment.date),
          transactionId: payment.reference || null  // Map reference to transactionId for frontend display
        })),
        creditBalanceHistory: data.creditBalanceHistory ? data.creditBalanceHistory.map(entry => ({
          ...entry,
          timestamp: formatDateField(entry.timestamp),
          amount: typeof entry.amount === 'number' ? entry.amount : 0
        })) : [],
        created: formatDateField(data.created),
        updated: data.updated ? convertFromTimestamp(data.updated) : null
      };
      
      return apiData;
    } else {
      console.log(`ℹ️ No dues data found for this unit/year combination`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching dues data for unit ${unitId}:`, error);
    console.error('Full error details:', error);
    throw error;
  }
}

/**
 * Get all dues data for a client for a specific year
 * 
 * @param {string} clientId - ID of the client
 * @param {number} year - Year to fetch dues data for
 * @returns {object} Object with unitId keys and dues data values
 */
async function getAllDuesDataForYear(clientId, year) {
  try {
    // Get the database instance if not already initialized
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // First get all units
    const unitsRef = dbInstance.collection('clients').doc(clientId).collection('units');
    const unitsSnapshot = await unitsRef.get();
    
    const duesData = {};
    
    // For each unit, get their dues data for the specified year
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      
      try {
        // Get dues document for this unit and year
        const duesRef = dbInstance.collection('clients').doc(clientId)
                          .collection('units').doc(unitId)
                          .collection('dues').doc(year.toString());
        const duesDoc = await duesRef.get();
        
        if (duesDoc.exists) {
          const data = duesDoc.data();
          
          // Convert amounts from cents to dollars for API response
          duesData[unitId] = {
            ...data,
            creditBalance: centsToDollars(data.creditBalance || 0),
            scheduledAmount: centsToDollars(data.scheduledAmount || 0),
            totalDue: centsToDollars(data.totalDue || 0),
            totalPaid: centsToDollars(data.totalPaid || 0),
            payments: data.payments.map((payment, index) => ({
              ...payment,
              month: index + 1, // Add month field (1-based)
              amount: payment.amount ? centsToDollars(payment.amount) : 0,
              date: formatDateField(payment.date)
            })),
            creditBalanceHistory: data.creditBalanceHistory ? data.creditBalanceHistory.map(entry => ({
              ...entry,
              timestamp: formatDateField(entry.timestamp),
              amount: typeof entry.amount === 'number' ? entry.amount : 0
            })) : [],
            created: formatDateField(data.created),
            updated: formatDateField(data.updated)
          };
        } else {
          // For units without dues data, include empty structure
          duesData[unitId] = {
            year: year,
            unitId: unitId,
            creditBalance: 0,
            totalDue: 3000, // $250 * 12 months
            totalPaid: 0,
            payments: Array(12).fill(null).map((_, index) => ({
              month: index + 1, // Add month field (1-based)
              paid: false,
              amount: 0,
              date: null,
              reference: null
            })),
            creditBalanceHistory: []
          };
        }
      } catch (unitError) {
        console.error(`Error fetching dues for unit ${unitId}:`, unitError);
        // Still include empty structure for this unit
        duesData[unitId] = {
          year: year,
          unitId: unitId,
          creditBalance: 0,
          totalDue: 3000, // $250 * 12 months
          totalPaid: 0,
          payments: Array(12).fill(null).map((_, index) => ({
            month: index + 1, // Add month field (1-based)
            paid: false,
            amount: 0,
            date: null,
            reference: null
          })),
          creditBalanceHistory: []
        };
      }
    }
    
    return duesData;
  } catch (error) {
    console.error(`❌ Error fetching all dues data for year ${year}:`, error);
    throw error;
  }
}

/**
 * Update credit balance for a unit
 * 
 * @param {string} clientId - ID of the client
 * @param {string} unitId - ID of the unit
 * @param {number} year - Year for which to update credit balance
 * @param {number} newCreditBalance - New credit balance value
 * @param {string} notes - User notes explaining the change
 * @returns {boolean} Success status
 */
async function updateCreditBalance(clientId, unitId, year, newCreditBalance, notes) {
  try {
    // Get the database instance if not already initialized
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // Create document reference using new structure
    const duesRef = dbInstance.collection('clients').doc(clientId)
                      .collection('units').doc(unitId).collection('dues').doc(year.toString());
    const duesDoc = await duesRef.get();
    
    let duesData;
    
    // If document doesn't exist, we need to initialize it first
    if (!duesDoc.exists) {
      await initializeYearDocument(clientId, unitId, year);
      // Re-fetch the document
      const newDoc = await duesRef.get();
      duesData = newDoc.data();
    } else {
      duesData = duesDoc.data();
    }
    
    // Update credit balance (convert from dollars to cents)
    const originalBalance = duesData.creditBalance || 0;
    const newBalanceInCents = dollarsToCents(newCreditBalance);
    
    // Prepare credit balance history entry
    const historyEntry = {
      id: randomUUID(),
      timestamp: convertToTimestamp(new Date()),
      transactionId: null,
      type: 'manual_adjustment',
      amount: newBalanceInCents - originalBalance,
      description: 'Manual credit balance update',
      balanceBefore: originalBalance,
      balanceAfter: newBalanceInCents,
      notes: notes || 'Updated via API'
    };
    
    // Prepare the existing history array
    const creditBalanceHistory = Array.isArray(duesData.creditBalanceHistory) 
      ? [...duesData.creditBalanceHistory, historyEntry]
      : [historyEntry];
    
    // SURGICAL UPDATE: Only update specific fields
    const updates = {
      creditBalance: newBalanceInCents,
      creditBalanceHistory: creditBalanceHistory,
      updated: convertToTimestamp(new Date())
    };
    
    // Use update() for surgical updates
    await duesRef.update(updates);
    
    // Log the action
    await writeAuditLog({
      module: 'hoadues',
      action: 'update',
      parentPath: `clients/${clientId}/units/${unitId}/dues`,
      docId: `${year}`,
      friendlyName: `Unit ${unitId} Credit Balance Update`,
      notes: notes || `Updated credit balance to ${newCreditBalance} for year ${year}`,
      metadata: {
        unitId,
        newCreditBalance,
        previousCreditBalance: duesDoc.exists ? duesDoc.data().creditBalance : 0
      }
    });
    
    return true;
  } catch (error) {
    console.error(`❌ Error updating credit balance for unit ${unitId}:`, error);
    throw error;
  }
}

/**
 * Get credit balance for any module (Water Bills, Special Billings, etc.)
 * GET /api/hoa/:clientId/units/:unitId/credit-balance/:year
 */
async function getCreditBalanceForModule(req, res) {
  try {
    const { clientId, unitId, year } = req.params;
    const { module = 'unknown' } = req.query; // Track which module is requesting
    
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // Get HOA dues document (where credit balance lives)
    const duesRef = dbInstance.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    const duesDoc = await duesRef.get();
    
    if (!duesDoc.exists) {
      // Initialize if doesn't exist (common for new units)
      const newDoc = await initializeYearDocument(clientId, unitId, parseInt(year));
      return res.json({
        success: true,
        creditBalance: 0,
        creditBalanceHistory: [],
        initialized: true
      });
    }
    
    const data = duesDoc.data();
    
    // Log cross-module access for audit
    console.log(`📊 Credit balance accessed by ${module} module: Unit ${unitId}, Year ${year}, Balance: ${centsToDollars(data.creditBalance || 0)}`);
    
    res.json({
      success: true,
      creditBalance: centsToDollars(data.creditBalance || 0), // Return in dollars
      creditBalanceHistory: data.creditBalanceHistory || [],
      lastUpdated: formatDateField(data.updated)
    });
    
  } catch (error) {
    console.error('Error getting credit balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update credit balance from any module (Water Bills, Special Billings, etc.)
 * PUT /api/hoa/:clientId/units/:unitId/credit-balance/:year
 */
async function updateCreditBalanceFromModule(req, res) {
  try {
    const { clientId, unitId, year } = req.params;
    const { 
      newBalance, 
      changeAmount, 
      changeType, 
      description, 
      transactionId,
      module = 'unknown'
    } = req.body;
    
    if (!dbInstance) {
      dbInstance = await getDb();
    }
    
    // Get current dues document
    const duesRef = dbInstance.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    const duesDoc = await duesRef.get();
    let duesData;
    
    if (!duesDoc.exists) {
      // Initialize if doesn't exist
      duesData = await initializeYearDocument(clientId, unitId, parseInt(year));
    } else {
      duesData = duesDoc.data();
    }
    
    // Update credit balance
    const originalBalance = duesData.creditBalance || 0;
    const newBalanceInCents = dollarsToCents(newBalance);
    
    // Create history entry with module tracking
    const historyEntry = {
      timestamp: convertToTimestamp(new Date()),
      type: changeType, // 'water_payment_applied', 'water_overpayment', etc.
      amount: changeAmount,
      balanceBefore: centsToDollars(originalBalance),
      balanceAfter: newBalance,
      description: description,
      module: module, // Track which module made the change
      transactionId: transactionId || null
    };
    
    // Update document
    const updates = {
      creditBalance: newBalanceInCents,
      creditBalanceHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
      updated: convertToTimestamp(new Date())
    };
    
    await duesRef.update(updates);
    
    // Log cross-module credit update
    console.log(`💰 Credit balance updated by ${module}: Unit ${unitId}, ${centsToDollars(originalBalance)} → ${newBalance}`);
    
    res.json({
      success: true,
      previousBalance: centsToDollars(originalBalance),
      newBalance: newBalance,
      changeAmount: changeAmount,
      historyEntry: {
        ...historyEntry,
        timestamp: formatDateField(historyEntry.timestamp)
      }
    });
    
  } catch (error) {
    console.error('Error updating credit balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export {
  initializeYearDocument,
  recordDuesPayment,
  getUnitDuesData,
  getAllDuesDataForYear,
  updateCreditBalance,
  getCreditBalanceForModule,
  updateCreditBalanceFromModule
};

/**
 * Statement Data Service
 * 
 * Extracted from queryDuesPayments.js prototype
 * Returns comprehensive data object instead of console logging
 * 
 * This service uses API calls (like the prototype) via axios
 */

import axios from 'axios';
import { getNow } from '../../shared/services/DateService.js';
import { getFiscalYear, getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';

/**
 * Format centavos to pesos
 */
function centavosToPesos(centavos) {
  if (!centavos || isNaN(centavos)) return 0;
  return centavos / 100;
}

/**
 * Parse date from various formats
 */
function parseDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') {
    return new Date(dateValue);
  } else if (dateValue.toDate && typeof dateValue.toDate === 'function') {
    return dateValue.toDate();
  } else if (dateValue instanceof Date) {
    return dateValue;
  } else if (dateValue.iso) {
    return new Date(dateValue.iso);
  }
  return new Date(dateValue);
}

/**
 * Fetch transaction data by ID
 */
async function fetchTransaction(api, clientId, transactionId) {
  try {
    const response = await api.get(`/clients/${clientId}/transactions/${transactionId}`);
    return response.data || null;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    return null;
  }
}

/**
 * Filter HOA allocations from transaction allocations array
 */
function filterHOAAllocations(allocations) {
  if (!Array.isArray(allocations)) return [];
  
  return allocations.filter(alloc => {
    const categoryId = alloc.categoryId || '';
    const type = alloc.type || '';
    
    return categoryId === 'hoa-dues' || 
           type === 'hoa-month' || 
           type === 'hoa_month' ||
           categoryId.includes('hoa');
  });
}

/**
 * Filter water-related allocations from transaction allocations array
 */
function filterWaterAllocations(allocations) {
  if (!Array.isArray(allocations)) return [];
  
  return allocations.filter(alloc => {
    const categoryId = alloc.categoryId || '';
    const type = alloc.type || '';
    const categoryName = (alloc.categoryName || '').toLowerCase();
    const targetName = (alloc.targetName || '').toLowerCase();
    const targetId = (alloc.targetId || '').toLowerCase();
    
    return categoryId === 'water-consumption' ||
           categoryId === 'water-consumption-bill' ||
           categoryId === 'water-penalties' ||
           categoryId === 'water' ||
           type === 'water_bill' ||
           type === 'water-bill' ||
           type === 'water_consumption' ||
           type === 'water_penalty' ||
           type === 'water-consumption' ||
           type === 'water' ||
           categoryName.includes('water') ||
           targetName.includes('water') ||
           targetId.includes('water');
  });
}

/**
 * Filter credit-related allocations from transaction allocations array
 */
function filterCreditAllocations(allocations) {
  if (!Array.isArray(allocations)) return [];
  
  return allocations.filter(alloc => {
    const categoryId = alloc.categoryId || '';
    const type = alloc.type || '';
    const categoryName = (alloc.categoryName || '').toLowerCase();
    
    return type === 'credit_used' ||
           type === 'credit-used' ||
           type === 'credit_balance' ||
           type === 'credit-balance' ||
           categoryId === 'credit-balance' ||
           categoryName.includes('credit');
  });
}

/**
 * Create chronological transaction list with running balance
 * COPIED EXACTLY FROM PROTOTYPE (lines 129-401)
 */
function createChronologicalTransactionList(
  payments, 
  transactionMap, 
  scheduledAmount, 
  duesFrequency, 
  fiscalYearStartMonth, 
  fiscalYear, 
  waterBills = [], 
  hoaPenalties = [], 
  waterPenalties = []
) {
  const transactions = [];
  
  // Helper to parse due date
  const parseDueDate = (dueDateValue) => {
    if (!dueDateValue) return null;
    return parseDate(dueDateValue);
  };
  
  // Add water bill charges
  for (const bill of waterBills) {
    const dueDate = parseDueDate(bill.dueDate);
    // Include bills with amounts > 0, even if dueDate is missing (use month start date as fallback)
    if (bill.totalAmount > 0) {
      let billDate = dueDate;
      if (!billDate || isNaN(billDate.getTime())) {
        // Fallback: use calendar year and month from bill data
        const calendarYear = bill.calendarYear || (bill.year ? bill.year - 1 : fiscalYear - 1);
        const calendarMonth = bill.calendarMonth !== undefined ? bill.calendarMonth : ((fiscalYearStartMonth - 1) + (bill.fiscalMonth || 0)) % 12;
        billDate = new Date(calendarYear, calendarMonth, 1);
      }
      
      if (billDate && !isNaN(billDate.getTime())) {
        // For quarterly bills, show quarter name
        const quarterName = bill.fiscalQuarter ? `Q${bill.fiscalQuarter}` : '';
        const monthName = billDate.toLocaleString('en-US', { month: 'short' });
        const displayYear = billDate.getFullYear();
        const description = quarterName 
          ? `Water Bill ${quarterName} ${displayYear}` 
          : `Water Bill ${monthName} ${displayYear}`;
        
        transactions.push({
          type: 'charge',
          category: 'water',
          date: billDate,
          description: description,
          amount: bill.totalAmount, // In pesos (already converted by API)
          charge: bill.totalAmount,
          payment: 0,
          billId: bill.billId,
          consumption: bill.consumption,
          penaltyAmount: bill.penaltyAmount || 0
        });
      }
    }
  }
  
  // Extract charges from payments array
  if (duesFrequency === 'quarterly') {
    // Group months into quarters
    const quarters = [
      { months: [1, 2, 3], name: 'Q1' },
      { months: [4, 5, 6], name: 'Q2' },
      { months: [7, 8, 9], name: 'Q3' },
      { months: [10, 11, 12], name: 'Q4' }
    ];
    
    for (const quarter of quarters) {
      // Find due date from any month in the quarter
      let quarterDueDate = null;
      let quarterAmount = 0;
      const quarterPayments = [];
      
      for (const monthNum of quarter.months) {
        const payment = payments.find(p => p.month === monthNum);
        if (payment) {
          quarterPayments.push(payment);
          if (!quarterDueDate && payment.dueDate) {
            quarterDueDate = parseDueDate(payment.dueDate);
          }
          // Sum amounts for the quarter
          quarterAmount += payment.amount || 0;
        }
      }
      
      // If no dueDate found, calculate it
      if (!quarterDueDate) {
        const fiscalMonthIndex = (quarter.months[0] - 1);
        const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
        const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
        quarterDueDate = new Date(calendarYear, calendarMonth, 1);
      }
      
      // Calculate quarter charge amount (scheduledAmount × 3 for quarterly)
      const quarterChargeAmount = scheduledAmount * 3;
      
      if (quarterDueDate && !isNaN(quarterDueDate.getTime())) {
        transactions.push({
          type: 'charge',
          date: quarterDueDate,
          description: `HOA Dues ${quarter.name}`,
          amount: quarterChargeAmount,
          charge: quarterChargeAmount,
          payment: 0,
          month: quarter.months[0], // Use first month for reference
          quarter: quarter.name
        });
      }
      
      // Extract payments for this quarter (only one payment per transaction)
      const quarterTransactionIds = new Set();
      for (const payment of quarterPayments) {
        if (payment.paid && payment.amount > 0) {
          const txnId = payment.transactionId || payment.reference;
          if (txnId && txnId !== '-' && !quarterTransactionIds.has(txnId)) {
            quarterTransactionIds.add(txnId);
            
            const paymentDate = parseDate(payment.date);
            const transaction = transactionMap.get(txnId);
            
            if (paymentDate && !isNaN(paymentDate.getTime())) {
              // Get total payment amount from transaction if available
              // For quarterly, use the full transaction amount (covers all 3 months)
              let paymentAmount = payment.amount || 0;
              if (transaction) {
                // Use transaction amount (in centavos) converted to pesos
                paymentAmount = centavosToPesos(transaction.amount || 0);
              }
              
              transactions.push({
                type: 'payment',
                date: paymentDate,
                description: `Payment ${quarter.name}`,
                amount: -paymentAmount, // Negative for payment
                charge: 0,
                payment: paymentAmount,
                transactionId: txnId,
                month: quarter.months[0], // Use first month for reference
                quarter: quarter.name
              });
            }
          }
        }
      }
    }
  } else {
    // Monthly billing: each month is a separate charge
    const monthlyTransactionIds = new Set(); // Track transactions to avoid duplicates
    
    for (const payment of payments) {
      if (!payment.month) continue;
      
      // Add charge for this month
      const dueDate = parseDueDate(payment.dueDate);
      if (dueDate && !isNaN(dueDate.getTime())) {
        transactions.push({
          type: 'charge',
          date: dueDate,
          description: `HOA Dues Month ${payment.month}`,
          amount: scheduledAmount,
          charge: scheduledAmount,
          payment: 0,
          month: payment.month
        });
      }
      
      // Add payment if paid (only once per transaction ID)
      // Check if payment exists (amount > 0 or paid flag or has transactionId)
      const hasPayment = (payment.paid || payment.amount > 0 || payment.transactionId || payment.reference);
      if (hasPayment) {
        const txnId = payment.transactionId || payment.reference;
        if (txnId && txnId !== '-' && !monthlyTransactionIds.has(txnId)) {
          monthlyTransactionIds.add(txnId);
          
          const paymentDate = parseDate(payment.date);
          const transaction = transactionMap.get(txnId);
          
          // If no payment date in payment record, try transaction date
          const effectiveDate = paymentDate && !isNaN(paymentDate.getTime()) 
            ? paymentDate 
            : (transaction?.date ? parseDate(transaction.date) : null);
          
          if (effectiveDate && !isNaN(effectiveDate.getTime())) {
            // Get total payment amount from transaction if available
            // For monthly, if transaction covers multiple months, use full transaction amount
            let paymentAmount = payment.amount || 0;
            if (transaction) {
              // Use transaction amount (in centavos) converted to pesos
              paymentAmount = centavosToPesos(transaction.amount || 0);
            }
            
            // Determine which months this payment covers
            const paymentMonths = payments
              .filter(p => (p.transactionId || p.reference) === txnId && p.paid)
              .map(p => p.month)
              .sort((a, b) => a - b);
            
            const monthDescription = paymentMonths.length === 1
              ? `Payment Month ${payment.month}`
              : `Payment Months ${paymentMonths[0]}-${paymentMonths[paymentMonths.length - 1]}`;
            
            transactions.push({
              type: 'payment',
              date: effectiveDate,
              description: monthDescription,
              amount: -paymentAmount, // Negative for payment
              charge: 0,
              payment: paymentAmount,
              transactionId: txnId,
              month: paymentMonths[0] // Use first month for reference
            });
          }
        }
      }
    }
  }
  
  // Extract water payments from transactions
  // Track water transaction IDs to avoid duplicates
  const waterTransactionIds = new Set();
  
  for (const [txnId, transaction] of transactionMap.entries()) {
    const allocations = transaction.allocations || [];
    const waterAllocations = filterWaterAllocations(allocations);
    
    if (waterAllocations.length > 0 && !waterTransactionIds.has(txnId)) {
      waterTransactionIds.add(txnId);
      
      const paymentDate = parseDate(transaction.date);
      if (paymentDate && !isNaN(paymentDate.getTime())) {
        // Sum all water allocations for this transaction
        const totalWaterAmount = waterAllocations.reduce((sum, alloc) => {
          return sum + centavosToPesos(alloc.amount || 0);
        }, 0);
        
        if (totalWaterAmount > 0) {
          // Check if this transaction also has HOA allocations
          const hoaAllocations = filterHOAAllocations(transaction.allocations || []);
          const isCombinedPayment = hoaAllocations.length > 0;
          
          transactions.push({
            type: 'payment',
            category: isCombinedPayment ? 'combined' : 'water',
            date: paymentDate,
            description: isCombinedPayment ? `Payment (HOA+Water)` : `Water Payment`,
            amount: -totalWaterAmount, // Negative for payment
            charge: 0,
            payment: totalWaterAmount,
            transactionId: txnId
          });
        }
      }
    }
  }
  
  // Add penalty charges (passed in from caller)
  transactions.push(...hoaPenalties);
  transactions.push(...waterPenalties);
  
  // Sort chronologically by date
  transactions.sort((a, b) => {
    const dateA = a.date.getTime();
    const dateB = b.date.getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    // If same date, charges come before payments, penalties come after regular charges
    if (a.type === 'penalty' && b.type !== 'penalty') return 1;
    if (a.type !== 'penalty' && b.type === 'penalty') return -1;
    if (a.type === 'charge' && b.type === 'payment') return -1;
    if (a.type === 'payment' && b.type === 'charge') return 1;
    return 0;
  });
  
  // Calculate running balance
  let runningBalance = 0;
  transactions.forEach(txn => {
    runningBalance += txn.amount; // amount is positive for charges, negative for payments
    txn.balance = runningBalance;
  });
  
  return transactions;
}

/**
 * Fetch water bills for a unit for a specific year
 * COPIED FROM PROTOTYPE (lines 412-492)
 */
async function fetchWaterBills(api, clientId, unitId, year, fiscalYearStartMonth = 7) {
  try {
    // Fetch quarterly bills for the year
    const response = await api.get(`/water/clients/${clientId}/bills/quarterly/${year}`);
    
    if (!response.data || !response.data.success || !response.data.data || !Array.isArray(response.data.data)) {
      return [];
    }
    
    const quarterlyBills = response.data.data;
    const unitBills = [];
    
    // Extract bills for this specific unit from each quarterly bill
    for (const quarterlyBill of quarterlyBills) {
      if (quarterlyBill.bills && quarterlyBill.bills.units && quarterlyBill.bills.units[unitId]) {
        const unitBill = quarterlyBill.bills.units[unitId];
        // Construct billId from fiscalYear and fiscalQuarter (API doesn't return _billId)
        const fiscalYear = quarterlyBill.fiscalYear || year;
        const fiscalQuarter = quarterlyBill.fiscalQuarter || 1;
        const billId = quarterlyBill._billId || quarterlyBill.billId || `${fiscalYear}-Q${fiscalQuarter}`;
        
        // Calculate total amount (amounts are already in pesos from API)
        const billAmount = unitBill.currentCharge || unitBill.waterCharge || 0;
        const penaltyAmount = unitBill.penaltyAmount || 0;
        const unpaidAmount = unitBill.unpaidAmount || unitBill.displayDue || 0;
        const totalAmount = unitBill.totalAmount || (unpaidAmount > 0 ? unpaidAmount : (billAmount + penaltyAmount));
        
        // Skip if no bill amount
        if (!unitBill || (totalAmount === 0 && billAmount === 0)) {
          continue;
        }
        
        // Get quarter number (1-4) and calculate calendar dates
        const dueDate = quarterlyBill.dueDate || quarterlyBill.billDate;
        
        // Calculate calendar month for quarter start
        const quarterStartMonth = ((fiscalQuarter - 1) * 3);
        const calendarMonth = ((fiscalYearStartMonth - 1) + quarterStartMonth) % 12;
        const calendarYear = year - 1 + Math.floor(((fiscalYearStartMonth - 1) + quarterStartMonth) / 12);
        
        unitBills.push({
          billId,
          year: quarterlyBill.fiscalYear || year,
          month: calendarMonth + 1, // Convert to 1-12 for display (first month of quarter)
          fiscalQuarter: fiscalQuarter,
          fiscalMonth: quarterStartMonth, // First month of quarter
          calendarYear: calendarYear,
          calendarMonth: calendarMonth,
          dueDate: dueDate,
          currentCharge: billAmount, // In pesos (already converted)
          penaltyAmount: penaltyAmount, // In pesos
          totalAmount: totalAmount, // In pesos
          paidAmount: unitBill.paidAmount || 0, // In pesos
          status: unitBill.status || 'unpaid',
          consumption: unitBill.totalConsumption || unitBill.consumption || 0,
          billNotes: unitBill.billNotes || `Water Bill Q${fiscalQuarter} ${year}`,
          payments: unitBill.payments || [],
          transactionId: unitBill.transactionId || (unitBill.payments && unitBill.payments.length > 0 ? unitBill.payments[unitBill.payments.length - 1].transactionId : null)
        });
      }
    }
    
    return unitBills;
  } catch (error) {
    if (error.response?.status === 404) {
      return [];
    }
    return [];
  }
}

/**
 * Fetch credit balance for a unit
 * COPIED FROM PROTOTYPE (lines 577-604)
 */
async function fetchCreditBalance(api, clientId, unitId) {
  try {
    // Try the credit API endpoint: /credit/:clientId/:unitId
    const response = await api.get(`/credit/${clientId}/${unitId}`);
    return response.data || null;
  } catch (error) {
    if (error.response?.status === 404) {
      // Unit has no credit balance - return zero balance
      return {
        clientId,
        unitId,
        creditBalance: 0,
        creditBalanceDisplay: '$0.00',
        lastUpdated: null
      };
    }
    // Return zero balance on error (graceful degradation)
    return {
      clientId,
      unitId,
      creditBalance: 0,
      creditBalanceDisplay: '$0.00',
      lastUpdated: null
    };
  }
}

/**
 * Query dues payments and return comprehensive data object
 * EXTRACTED FROM PROTOTYPE (lines 612-1227)
 * Modified to return data object instead of console logging
 * 
 * @param {Object} api - API client (axios instance with baseURL)
 * @param {string} clientId - Client ID (e.g., 'AVII', 'MTC')
 * @param {string} unitId - Unit ID (e.g., '101', '1A')
 * @param {number} fiscalYear - Fiscal year (optional, defaults to current fiscal year)
 * @returns {Promise<Object>} Comprehensive data object
 */
export async function queryDuesPaymentsData(api, clientId, unitId, fiscalYear = null) {
  try {
    // Step 1: Get client configuration
    const clientResponse = await api.get(`/clients/${clientId}`);
    
    if (!clientResponse.data) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    const clientData = clientResponse.data;
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    const duesFrequency = clientData.feeStructure?.duesFrequency || 
                         clientData.configuration?.feeStructure?.duesFrequency ||
                         clientData.configuration?.duesFrequency ||
                         'monthly';
    
    // Step 2: Determine fiscal year
    const now = getNow();
    const currentFiscalYear = fiscalYear || getFiscalYear(now, fiscalYearStartMonth);
    const fiscalYearBounds = getFiscalYearBounds(currentFiscalYear, fiscalYearStartMonth);
    
    // Step 3: Query HOA dues for the year
    const duesResponse = await api.get(`/hoadues/${clientId}/year/${currentFiscalYear}`);
    
    if (!duesResponse.data || !duesResponse.data[unitId]) {
      throw new Error(`No dues data found for unit ${unitId} in fiscal year ${currentFiscalYear}`);
    }
    
    const duesData = duesResponse.data[unitId];
    const payments = duesData.payments || [];
    const today = now;
    const todayTime = today.getTime();
    
    // Create payment map first
    const paymentMap = new Map();
    payments.forEach(payment => {
      if (payment.month) {
        paymentMap.set(payment.month, payment);
      }
    });
    
    // Step 4: Fetch transactions
    // Collect unique transaction IDs from paymentMap
    const transactionIds = new Set();
    for (let month = 1; month <= 12; month++) {
      const payment = paymentMap.get(month);
      if (payment) {
        const txnId = payment.transactionId || payment.reference;
        if (txnId && txnId !== '-' && typeof txnId === 'string') {
          transactionIds.add(txnId);
        }
        
        // Also extract transaction IDs from payment notes (for unified payments)
        if (payment.notes) {
          let notesStr = '';
          if (typeof payment.notes === 'string') {
            notesStr = payment.notes;
          } else if (typeof payment.notes === 'object' && payment.notes.notes) {
            notesStr = payment.notes.notes;
          } else if (typeof payment.notes === 'object') {
            notesStr = JSON.stringify(payment.notes);
          } else {
            notesStr = String(payment.notes);
          }
          
          // Match transaction IDs in format: TxnID: YYYY-MM-DD_HHMMSS_NNN
          const txnIdMatches = notesStr.matchAll(/TxnID:\s*(\d{4}-\d{2}-\d{2}_\d{6}_\d+)/gi);
          for (const match of txnIdMatches) {
            if (match[1]) {
              transactionIds.add(match[1]);
            }
          }
        }
      }
    }
    
    // Fetch all transactions
    const transactions = new Map();
    for (const txnId of transactionIds) {
      const transaction = await fetchTransaction(api, clientId, txnId);
      if (transaction) {
        transactions.set(txnId, transaction);
      }
    }
    
    const transactionMap = transactions;
    
    // Step 5: Fetch water bills
    const waterBills = await fetchWaterBills(api, clientId, unitId, currentFiscalYear, fiscalYearStartMonth);
    
    // Step 6: Also fetch transactions from water bill payments
    for (const bill of waterBills) {
      if (bill.payments && Array.isArray(bill.payments)) {
        for (const payment of bill.payments) {
          const txnId = payment.transactionId;
          if (txnId && txnId !== '-' && typeof txnId === 'string' && !transactionMap.has(txnId)) {
            const transaction = await fetchTransaction(api, clientId, txnId);
            if (transaction) {
              transactionMap.set(txnId, transaction);
            }
          }
        }
      }
      // Also check transactionId at bill level
      if (bill.transactionId && bill.transactionId !== '-' && typeof bill.transactionId === 'string' && !transactionMap.has(bill.transactionId)) {
        const transaction = await fetchTransaction(api, clientId, bill.transactionId);
        if (transaction) {
          transactionMap.set(bill.transactionId, transaction);
        }
      }
    }
    
    // Step 7: Get all unpaid bills with penalties using unified preview API
    const scheduledAmount = duesData.scheduledAmount || 0;
    
    let hoaPenalties = [];
    let waterPenalties = [];
    try {
      const payOnDateStr = today.toISOString().split('T')[0];
      const unifiedPreviewResponse = await api.post(`/payments/unified/preview`, {
        clientId,
        unitId,
        amount: null, // Use null to get all bills with credit = 0 (TD-019 enhancement)
        paymentDate: payOnDateStr
      });
      
      if (unifiedPreviewResponse.data?.success && unifiedPreviewResponse.data.preview) {
        const preview = unifiedPreviewResponse.data.preview;
        
        // Extract HOA penalties from billsPaid
        const hoaBillsPaid = preview.hoa?.billsPaid || [];
        for (const bill of hoaBillsPaid) {
          if (bill.totalPenaltyDue && bill.totalPenaltyDue > 0) {
            const billPeriod = bill.billPeriod || '';
            const cleanPeriod = billPeriod.replace('hoa:', '');
            let dueDate = null;
            
            if (cleanPeriod.includes('-Q')) {
              const [yearStr, quarterStr] = cleanPeriod.split('-Q');
              const fiscalYear = parseInt(yearStr);
              const quarter = parseInt(quarterStr);
              const fiscalMonthIndex = (quarter - 1) * 3;
              const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
              const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
              dueDate = new Date(calendarYear, calendarMonth, 1);
            } else if (cleanPeriod.includes('-')) {
              const [yearStr, monthStr] = cleanPeriod.split('-');
              const fiscalYear = parseInt(yearStr);
              const fiscalMonthIndex = parseInt(monthStr);
              const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
              const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
              dueDate = new Date(calendarYear, calendarMonth, 1);
            }
            
            if (dueDate && !isNaN(dueDate.getTime())) {
              const penaltyDate = new Date(dueDate);
              penaltyDate.setMonth(penaltyDate.getMonth() + 1);
              penaltyDate.setDate(1);
              
              let description = 'HOA Penalty';
              if (cleanPeriod.includes('-Q')) {
                const quarter = cleanPeriod.split('-Q')[1];
                description += ` - Q${quarter} ${dueDate.getFullYear()}`;
              } else {
                const monthName = dueDate.toLocaleString('en-US', { month: 'short' });
                description += ` - ${monthName} ${dueDate.getFullYear()}`;
              }
              
              hoaPenalties.push({
                type: 'penalty',
                category: 'hoa',
                date: penaltyDate,
                description: description,
                amount: bill.totalPenaltyDue,
                charge: bill.totalPenaltyDue,
                payment: 0,
                billId: cleanPeriod,
                baseAmount: bill.totalBaseDue || 0
              });
            }
          }
        }
        
        // Extract water penalties from billsPaid
        const waterBillsPaid = preview.water?.billsPaid || [];
        for (const bill of waterBillsPaid) {
          if (bill.totalPenaltyDue && bill.totalPenaltyDue > 0) {
            const billPeriod = bill.billPeriod || '';
            const cleanPeriod = billPeriod.replace('water:', '');
            let dueDate = null;
            
            if (cleanPeriod.includes('-Q')) {
              const [yearStr, quarterStr] = cleanPeriod.split('-Q');
              const fiscalYear = parseInt(yearStr);
              const quarter = parseInt(quarterStr);
              const fiscalMonthIndex = (quarter - 1) * 3;
              const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
              const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
              dueDate = new Date(calendarYear, calendarMonth, 1);
            }
            
            if (dueDate && !isNaN(dueDate.getTime())) {
              const penaltyDate = new Date(dueDate);
              penaltyDate.setMonth(penaltyDate.getMonth() + 1);
              penaltyDate.setDate(1);
              
              const quarter = cleanPeriod.includes('-Q') ? cleanPeriod.split('-Q')[1] : '';
              const description = `Water Penalty - Q${quarter} ${dueDate.getFullYear()}`;
              
              waterPenalties.push({
                type: 'penalty',
                category: 'water',
                date: penaltyDate,
                description: description,
                amount: bill.totalPenaltyDue,
                charge: bill.totalPenaltyDue,
                payment: 0,
                billId: cleanPeriod,
                baseAmount: bill.totalBaseDue || 0
              });
            }
          }
        }
      }
    } catch (error) {
      // Silently handle errors - penalties will be empty arrays
    }
    
    // Step 8: Create chronological transaction list
    const chronologicalTransactions = createChronologicalTransactionList(
      payments,
      transactionMap,
      scheduledAmount,
      duesFrequency,
      fiscalYearStartMonth,
      currentFiscalYear,
      waterBills,
      hoaPenalties,
      waterPenalties
    );
    
    // Step 9: Fetch credit balance
    const creditBalanceData = await fetchCreditBalance(api, clientId, unitId);
    
    // Step 10: Calculate summary
    const calculatedTotalDue = scheduledAmount * 12;
    const totalDue = calculatedTotalDue;
    const totalPaid = duesData.totalPaid || 0;
    const totalOutstanding = totalDue - totalPaid;
    const finalBalance = chronologicalTransactions.length > 0 
      ? chronologicalTransactions[chronologicalTransactions.length - 1].balance 
      : 0;
    
    // Step 11: Extract credit allocations
    const creditAllocations = [];
    for (const [txnId, transaction] of transactionMap.entries()) {
      const creditAllocs = filterCreditAllocations(transaction.allocations || []);
      if (creditAllocs.length > 0) {
        creditAllocations.push({
          transactionId: txnId,
          transaction: transaction,
          allocations: creditAllocs
        });
      }
    }
    
    // Build comprehensive return object
    return {
      // Raw data
      clientConfig: {
        clientId,
        unitId,
        fiscalYearStartMonth,
        duesFrequency,
        fiscalYear: currentFiscalYear,
        fiscalYearBounds
      },
      hoaDuesRaw: duesData,
      waterBillsRaw: waterBills,
      transactions: Array.from(transactionMap.values()),
      creditBalance: creditBalanceData,
      creditAllocations: creditAllocations,
      
      // Processed data
      chronologicalTransactions: chronologicalTransactions,
      
      // Calculated summaries
      summary: {
        totalDue: totalDue,
        totalPaid: totalPaid,
        totalOutstanding: totalOutstanding,
        finalBalance: finalBalance,
        scheduledAmount: scheduledAmount,
        transactionCount: chronologicalTransactions.length
      }
    };
    
  } catch (error) {
    throw error;
  }
}


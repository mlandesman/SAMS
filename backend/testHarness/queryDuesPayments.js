/**
 * Query HOA Dues Payments Test Harness
 * 
 * This script queries HOA Dues payments for a specific unit and displays payment data
 * in a simple table format using the HOA Dues API endpoints.
 * 
 * Usage: node backend/testHarness/queryDuesPayments.js <clientId> <unitId>
 * Example: node backend/testHarness/queryDuesPayments.js AVII 101
 */

import { testHarness } from '../testing/testHarness.js';
import { getFiscalYear, getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { getNow } from '../../shared/services/DateService.js';
import { getDb } from '../firebase.js';

/**
 * Format pesos amount with commas
 * @param {number} amount - Amount in pesos
 * @returns {string} Formatted amount
 */
function formatPesos(amount) {
  if (!amount || isNaN(amount)) return '0.00';
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format centavos to pesos
 * @param {number} centavos - Amount in centavos
 * @returns {number} Amount in pesos
 */
function centavosToPesos(centavos) {
  if (!centavos || isNaN(centavos)) return 0;
  return centavos / 100;
}

/**
 * Fetch transaction data by ID
 * @param {Object} api - API client from test harness
 * @param {string} clientId - Client ID
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object|null>} Transaction data or null if not found
 */
async function fetchTransaction(api, clientId, transactionId) {
  try {
    const response = await api.get(`/clients/${clientId}/transactions/${transactionId}`);
    return response.data || null;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`  ⚠️ Transaction ${transactionId} not found`);
      return null;
    }
    console.error(`  ❌ Error fetching transaction ${transactionId}:`, error.message);
    return null;
  }
}

/**
 * Filter HOA allocations from transaction allocations array
 * @param {Array} allocations - All allocations array
 * @returns {Array} HOA-related allocations only
 */
function filterHOAAllocations(allocations) {
  if (!Array.isArray(allocations)) return [];
  
  return allocations.filter(alloc => {
    // Filter for HOA-related allocations
    const categoryId = alloc.categoryId || '';
    const type = alloc.type || '';
    
    return categoryId === 'hoa-dues' || 
           type === 'hoa-month' || 
           type === 'hoa_month' ||
           categoryId.includes('hoa');
  });
}

/**
 * Filter credit-related allocations from transaction allocations array
 * @param {Array} allocations - All allocations array
 * @returns {Array} Credit-related allocations only
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
 * Parse date from various formats
 * @param {*} dateValue - Date value (string, Date, Firestore Timestamp, etc.)
 * @returns {Date|null} Parsed date or null
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
 * Create chronological transaction list from charges and payments
 * @param {Array} payments - Payments array from dues data
 * @param {Map} transactionMap - Map of transactionId -> transaction
 * @param {number} scheduledAmount - Monthly scheduled amount
 * @param {string} duesFrequency - 'monthly' or 'quarterly'
 * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
 * @param {number} fiscalYear - Current fiscal year
 * @returns {Array} Chronological list of transactions with running balance
 */
function createChronologicalTransactionList(payments, transactionMap, scheduledAmount, duesFrequency, fiscalYearStartMonth, fiscalYear, waterBills = []) {
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
  
  // Sort chronologically by date
  transactions.sort((a, b) => {
    const dateA = a.date.getTime();
    const dateB = b.date.getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    // If same date, charges come before payments
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
 * @param {Object} api - API client from test harness
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} year - Fiscal year
 * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
 * @returns {Promise<Array>} Array of water bills for the unit
 */
async function fetchWaterBills(api, clientId, unitId, year, fiscalYearStartMonth = 7) {
  try {
    // Fetch quarterly bills for the year
    // API returns: { success: true, data: [quarterly bills] }
    // Each bill has structure: { _billId: "2026-Q1", bills: { units: { "101": {...} } }, dueDate, ... }
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
        
        // Get quarter number (1-4) and calculate calendar dates (fiscalQuarter already declared above)
        const dueDate = quarterlyBill.dueDate || quarterlyBill.billDate;
        
        // Calculate calendar month for quarter start
        // Q1 = months 0,1,2 (Jul,Aug,Sep) -> calendar month 7 (July)
        // Q2 = months 3,4,5 (Oct,Nov,Dec) -> calendar month 10 (October)
        // Q3 = months 6,7,8 (Jan,Feb,Mar) -> calendar month 1 (January)
        // Q4 = months 9,10,11 (Apr,May,Jun) -> calendar month 4 (April)
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
      console.log(`  ⚠️ No water bills found for ${clientId}/${unitId} year ${year}`);
      return [];
    }
    console.error(`  ⚠️ Error fetching water bills:`, error.message);
    if (error.response?.data) {
      console.error(`  Error details:`, JSON.stringify(error.response.data, null, 2));
    }
    return [];
  }
}

/**
 * Filter water-related allocations from transaction allocations array
 * @param {Array} allocations - All allocations array
 * @returns {Array} Water-related allocations only
 */
function filterWaterAllocations(allocations) {
  if (!Array.isArray(allocations)) return [];
  
  return allocations.filter(alloc => {
    const categoryId = alloc.categoryId || '';
    const type = alloc.type || '';
    const categoryName = (alloc.categoryName || '').toLowerCase();
    const targetName = (alloc.targetName || '').toLowerCase();
    const targetId = (alloc.targetId || '').toLowerCase();
    
    // Check multiple fields for water-related allocations
    // Unified payments use: type: 'water_consumption', categoryId: 'water-consumption'
    // Water payments service uses: type: 'water_bill', categoryId: 'water-consumption'
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
 * Fetch credit balance for a unit
 * @param {Object} api - API client from test harness
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @returns {Promise<Object|null>} Credit balance data or null if error
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
    console.error(`  ⚠️ Error fetching credit balance:`, error.message);
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
 * Query HOA Dues payments for a unit using API endpoints
 * @param {Object} api - API client from test harness
 * @param {string} clientId - Client ID (e.g., 'AVII', 'MTC')
 * @param {string} unitId - Unit ID (e.g., '101', '1A')
 */
async function queryDuesPayments(api, clientId, unitId) {
  try {
    // Step 1: Get client configuration
    console.log(`\n🔍 Fetching client configuration for ${clientId}...`);
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
    
    console.log(`📅 Fiscal Year Start Month: ${fiscalYearStartMonth}`);
    console.log(`📅 Payment Frequency: ${duesFrequency}`);
    
    // Step 2: Determine current fiscal year using fiscal year utilities
    const now = getNow();
    const currentFiscalYear = getFiscalYear(now, fiscalYearStartMonth);
    const fiscalYearBounds = getFiscalYearBounds(currentFiscalYear, fiscalYearStartMonth);
    
    console.log(`📅 Current Fiscal Year: ${currentFiscalYear}`);
    console.log(`📅 Fiscal Year Period: ${fiscalYearBounds.startDate.toISOString().split('T')[0]} to ${fiscalYearBounds.endDate.toISOString().split('T')[0]}`);
    
    // Step 3: Query HOA dues for the year
    console.log(`\n🔍 Fetching HOA dues for fiscal year ${currentFiscalYear}...`);
    const duesResponse = await api.get(`/hoadues/${clientId}/year/${currentFiscalYear}`);
    
    if (!duesResponse.data || !duesResponse.data[unitId]) {
      console.log(`\n⚠️ No dues data found for unit ${unitId} in fiscal year ${currentFiscalYear}`);
      return;
    }
    
    const duesData = duesResponse.data[unitId];
    console.log(`\n✅ Found dues data for unit ${unitId}`);
    
    // Step 4: Display payments in table format
    const payments = duesData.payments || [];
    // Use Cancun timezone for today's date comparison
    const today = now;
    const todayStr = now.toISOString().split('T')[0];
    const todayTime = today.getTime();
    
    // Create payment map first
    const paymentMap = new Map();
    payments.forEach(payment => {
      if (payment.month) {
        paymentMap.set(payment.month, payment);
      }
    });
    
    // Step 4.5: Fetch transactions BEFORE displaying table
    console.log(`\n🔍 Fetching transaction details...`);
    
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
        // Notes format: "TxnID: 2025-11-07_090159_622" or notes object with .notes property
        if (payment.notes) {
          let notesStr = '';
          if (typeof payment.notes === 'string') {
            notesStr = payment.notes;
          } else if (typeof payment.notes === 'object' && payment.notes.notes) {
            notesStr = payment.notes.notes;
          } else if (typeof payment.notes === 'object') {
            // Try to find notes in nested object
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
    
    // Debug: Log extracted transaction IDs
    if (transactionIds.size > 0) {
      console.log(`  Extracted transaction IDs: ${Array.from(transactionIds).join(', ')}`);
    }
    
    console.log(`Found ${transactionIds.size} unique transaction(s) to fetch`);
    
    // Fetch all transactions
    const transactions = new Map();
    for (const txnId of transactionIds) {
      console.log(`  Fetching transaction: ${txnId}`);
      const transaction = await fetchTransaction(api, clientId, txnId);
      if (transaction) {
        transactions.set(txnId, transaction);
      }
    }
    
    // Create a map of transactionId -> transaction for quick lookup
    const transactionMap = transactions;
    
    // Step 4: Display payments in table format with transaction details
    console.log(`\nQuerying HOA Dues for ${clientId} unit ${unitId}, Fiscal Year ${currentFiscalYear}`);
    console.log(`Filter: Due Date <= ${todayStr} (America/Cancun)`);
    console.log(`Total payments found: ${payments.length}`);
    console.log(`\nMonth | Paid  | Date       | Due Date  | Amount    | Transaction ID`);
    console.log(`------|-------|------------|-----------|-----------|----------------`);
    
    // Show all months 1-12, but filter by dueDate <= today
    // For quarterly billing: if quarter's due date has passed, show ALL months in that quarter
    let hasPayments = false;
    const displayedTransactions = new Set(); // Track which transactions we've already shown
    
    // Helper function to parse dueDate
    const parseDueDate = (dueDateValue) => {
      if (!dueDateValue) return null;
      if (typeof dueDateValue === 'string') {
        return new Date(dueDateValue);
      } else if (dueDateValue.toDate && typeof dueDateValue.toDate === 'function') {
        return dueDateValue.toDate();
      } else {
        return new Date(dueDateValue);
      }
    };
    
    // For quarterly billing, group months by quarter and check quarter due date
    if (duesFrequency === 'quarterly') {
      // Quarters: Q1 (months 1-3), Q2 (months 4-6), Q3 (months 7-9), Q4 (months 10-12)
      const quarters = [
        { months: [1, 2, 3], name: 'Q1' },
        { months: [4, 5, 6], name: 'Q2' },
        { months: [7, 8, 9], name: 'Q3' },
        { months: [10, 11, 12], name: 'Q4' }
      ];
      
      for (const quarter of quarters) {
        // Get the due date from any month in the quarter (they all share the same due date)
        // Check all months in case some don't have dueDate set
        let quarterDueDate = null;
        for (const monthNum of quarter.months) {
          const monthPayment = paymentMap.get(monthNum);
          if (monthPayment?.dueDate) {
            quarterDueDate = parseDueDate(monthPayment.dueDate);
            break; // Found it, use this one
          }
        }
        
        // If no dueDate found in payment data, calculate it from fiscal year
        // This handles unpaid quarters that don't have dueDate set yet
        if (!quarterDueDate) {
          // Calculate quarter due date using fiscal year utilities
          // Q1 = months 1-3 (fiscal months 0-2), Q2 = months 4-6 (fiscal months 3-5), etc.
          const fiscalMonthIndex = (quarter.months[0] - 1); // Convert to 0-based fiscal month
          const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
          const calendarYear = currentFiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
          
          // Create date for 1st of the calendar month
          quarterDueDate = new Date(calendarYear, calendarMonth, 1);
        }
        
        // Check if quarter's due date has passed
        const quarterIsDue = quarterDueDate && !isNaN(quarterDueDate.getTime()) && quarterDueDate.getTime() <= todayTime;
        
        // Show all months in this quarter if the quarter is due
        if (quarterIsDue) {
          for (const month of quarter.months) {
            const payment = paymentMap.get(month);
            hasPayments = true;
            
            const monthStr = String(month).padEnd(5);
            const paid = payment?.paid ? 'true ' : 'false';
            
            // Handle payment date
            let dateStr = '-         ';
            if (payment?.date) {
              if (typeof payment.date === 'object' && payment.date.iso) {
                dateStr = payment.date.iso.split('T')[0];
              } else if (typeof payment.date === 'string') {
                dateStr = payment.date.split('T')[0];
              } else {
                const dateObj = payment.date.toDate ? payment.date.toDate() : new Date(payment.date);
                dateStr = dateObj.toISOString().split('T')[0];
              }
            }
            
            // Handle dueDate - show the raw value
            let dueDateStr = '-         ';
            if (payment?.dueDate) {
              const dueDate = parseDueDate(payment.dueDate);
              if (dueDate && !isNaN(dueDate.getTime())) {
                dueDateStr = dueDate.toISOString().split('T')[0];
              }
            } else if (quarterDueDate) {
              // If this month doesn't have dueDate but quarter does, use quarter's due date
              dueDateStr = quarterDueDate.toISOString().split('T')[0];
            }
            
            const amount = formatPesos(payment?.amount || 0).padStart(9);
            // Get full transaction ID for display (truncate only for table formatting)
            const fullTxnId = payment?.transactionId || payment?.reference || '-';
            const transactionId = fullTxnId.length > 20 ? fullTxnId.substring(0, 17) + '...' : fullTxnId.padEnd(20);
            
            console.log(`${monthStr} | ${paid} | ${dateStr} | ${dueDateStr} | ${amount} | ${transactionId}`);
            
            // Show transaction details if this is the first month of a transaction group
            // For quarterly: show on first month of quarter; for monthly: show on each month
            const transaction = transactionMap.get(fullTxnId);
            if (transaction && fullTxnId !== '-' && !displayedTransactions.has(fullTxnId)) {
              // For quarterly, only show on first month of quarter; for monthly, show on each month
              const shouldShow = duesFrequency === 'monthly' || month === quarter.months[0];
              
              if (shouldShow) {
                displayedTransactions.add(fullTxnId);
                const hoaAllocations = filterHOAAllocations(transaction.allocations || []);
                if (hoaAllocations.length > 0) {
                  const txnAmount = formatPesos(centavosToPesos(transaction.amount || 0));
                  const txnMethod = transaction.paymentMethod || transaction.method || 'N/A';
                  console.log(`      └─ Transaction: ${fullTxnId} | Total: $${txnAmount} MXN | Method: ${txnMethod}`);
                  
                  // Show allocation breakdown
                  hoaAllocations.forEach(alloc => {
                    const allocAmount = formatPesos(centavosToPesos(alloc.amount || 0));
                    const targetName = alloc.targetName || alloc.targetId || 'Unknown';
                    console.log(`         • ${targetName}: $${allocAmount} MXN`);
                  });
                }
              }
            }
          }
        }
      }
    } else {
      // Monthly billing: check each month's due date individually
      for (let month = 1; month <= 12; month++) {
        const payment = paymentMap.get(month);
        
        // Filter: Show payments where dueDate <= today
        let shouldShow = true;
        if (payment?.dueDate) {
          const dueDate = parseDueDate(payment.dueDate);
          
          // Only show if dueDate is valid and <= today
          if (!dueDate || isNaN(dueDate.getTime()) || dueDate.getTime() > todayTime) {
            shouldShow = false;
          }
        } else if (!payment?.paid) {
          // Unpaid payments without dueDate are filtered out
          shouldShow = false;
        }
        // Paid payments without dueDate still show (they've been paid)
        
        if (!shouldShow) continue;
        
        hasPayments = true;
        
        const monthStr = String(month).padEnd(5);
        const paid = payment?.paid ? 'true ' : 'false';
        
        // Handle payment date
        let dateStr = '-         ';
        if (payment?.date) {
          if (typeof payment.date === 'object' && payment.date.iso) {
            dateStr = payment.date.iso.split('T')[0];
          } else if (typeof payment.date === 'string') {
            dateStr = payment.date.split('T')[0];
          } else {
            const dateObj = payment.date.toDate ? payment.date.toDate() : new Date(payment.date);
            dateStr = dateObj.toISOString().split('T')[0];
          }
        }
        
        // Handle dueDate - show the raw value
        let dueDateStr = '-         ';
        if (payment?.dueDate) {
          const dueDate = parseDueDate(payment.dueDate);
          if (dueDate && !isNaN(dueDate.getTime())) {
            dueDateStr = dueDate.toISOString().split('T')[0];
          }
        }
        
        const amount = formatPesos(payment?.amount || 0).padStart(9);
        // Get full transaction ID for display (truncate only for table formatting)
        const fullTxnId = payment?.transactionId || payment?.reference || '-';
        const transactionId = fullTxnId.length > 20 ? fullTxnId.substring(0, 17) + '...' : fullTxnId.padEnd(20);
        
        console.log(`${monthStr} | ${paid} | ${dateStr} | ${dueDateStr} | ${amount} | ${transactionId}`);
        
        // Show transaction details for monthly billing (each month gets its own transaction)
        const transaction = transactionMap.get(fullTxnId);
        if (transaction && fullTxnId !== '-' && !displayedTransactions.has(fullTxnId)) {
          displayedTransactions.add(fullTxnId);
          const hoaAllocations = filterHOAAllocations(transaction.allocations || []);
          if (hoaAllocations.length > 0) {
            const txnAmount = formatPesos(centavosToPesos(transaction.amount || 0));
            const txnMethod = transaction.paymentMethod || transaction.method || 'N/A';
            console.log(`      └─ Transaction: ${fullTxnId} | Total: $${txnAmount} MXN | Method: ${txnMethod}`);
            
            // Show allocation breakdown
            hoaAllocations.forEach(alloc => {
              const allocAmount = formatPesos(centavosToPesos(alloc.amount || 0));
              const targetName = alloc.targetName || alloc.targetId || 'Unknown';
              console.log(`         • ${targetName}: $${allocAmount} MXN`);
            });
          }
        }
      }
    }
    
    if (!hasPayments) {
      console.log(`No payments found with due date <= today`);
    }
    
    // Step 5.4: Fetch water bills
    console.log(`\n🔍 Fetching water bills for fiscal year ${currentFiscalYear}...`);
    const waterBills = await fetchWaterBills(api, clientId, unitId, currentFiscalYear, fiscalYearStartMonth);
    console.log(`Found ${waterBills.length} water bill(s)`);
    
    // Step 4.6: Also fetch transactions from water bill payments
    console.log(`\n🔍 Fetching transactions from water bill payments...`);
    for (const bill of waterBills) {
      if (bill.payments && Array.isArray(bill.payments)) {
        for (const payment of bill.payments) {
          const txnId = payment.transactionId;
          if (txnId && txnId !== '-' && typeof txnId === 'string' && !transactionMap.has(txnId)) {
            console.log(`  Fetching water payment transaction: ${txnId}`);
            const transaction = await fetchTransaction(api, clientId, txnId);
            if (transaction) {
              transactionMap.set(txnId, transaction);
            }
          }
        }
      }
      // Also check transactionId at bill level
      if (bill.transactionId && bill.transactionId !== '-' && typeof bill.transactionId === 'string' && !transactionMap.has(bill.transactionId)) {
        console.log(`  Fetching water bill transaction: ${bill.transactionId}`);
        const transaction = await fetchTransaction(api, clientId, bill.transactionId);
        if (transaction) {
          transactionMap.set(bill.transactionId, transaction);
        }
      }
    }
    console.log(`Total transactions in map: ${transactionMap.size}`);
    
    // Step 5.5: Create and display chronological transaction list with running balance
    console.log(`\n📋 Chronological Transaction List with Running Balance:`);
    console.log(`═══════════════════════════════════════════════════════════════════════════════`);
    
    const scheduledAmount = duesData.scheduledAmount || 0;
    const chronologicalTransactions = createChronologicalTransactionList(
      payments,
      transactionMap,
      scheduledAmount,
      duesFrequency,
      fiscalYearStartMonth,
      currentFiscalYear,
      waterBills
    );
    
    if (chronologicalTransactions.length === 0) {
      console.log(`No transactions found`);
    } else {
      console.log(`Date       | Description           | Charge      | Payment     | Balance`);
      console.log(`-----------|-----------------------|-------------|-------------|-------------`);
      
      let openingBalance = 0;
      console.log(`           | Opening Balance       |             |             | ${formatPesos(openingBalance).padStart(11)}`);
      
      chronologicalTransactions.forEach(txn => {
        const dateStr = txn.date.toISOString().split('T')[0];
        const description = txn.description.padEnd(21);
        const charge = txn.charge > 0 ? formatPesos(txn.charge).padStart(11) : ' '.repeat(11);
        const payment = txn.payment > 0 ? formatPesos(txn.payment).padStart(11) : ' '.repeat(11);
        const balance = formatPesos(txn.balance).padStart(11);
        
        console.log(`${dateStr} | ${description} | ${charge} | ${payment} | ${balance}`);
      });
      
      // Verify final balance matches outstanding
      const finalBalance = chronologicalTransactions.length > 0 
        ? chronologicalTransactions[chronologicalTransactions.length - 1].balance 
        : 0;
      console.log(`\nFinal Running Balance: $${formatPesos(finalBalance)} MXN`);
    }
    
    // Step 6: Fetch credit balance
    console.log(`\n🔍 Fetching credit balance...`);
    const creditBalanceData = await fetchCreditBalance(api, clientId, unitId);
    
    // Summary
    // Calculate totalDue from scheduledAmount × 12 (totalDue field is unreliable/stale)
    const calculatedTotalDue = scheduledAmount * 12;
    const totalDue = calculatedTotalDue; // Use calculated value instead of stored totalDue
    const totalPaid = duesData.totalPaid || 0;
    // Calculate outstanding for full fiscal year: TotalDue - TotalPaid
    const totalOutstanding = totalDue - totalPaid;
    
    console.log(`\n📊 Summary:`);
    console.log(`Total Due: $${formatPesos(totalDue)} MXN (calculated: ${formatPesos(scheduledAmount)} × 12)`);
    console.log(`Total Paid: $${formatPesos(totalPaid)} MXN`);
    console.log(`Outstanding: $${formatPesos(totalOutstanding)} MXN`);
    
    // Credit Balance
    if (creditBalanceData) {
      const creditBalance = creditBalanceData.creditBalance || 0;
      const lastUpdated = creditBalanceData.lastUpdated;
      
      console.log(`\n💰 Credit Balance: $${formatPesos(creditBalance)} MXN`);
      if (lastUpdated) {
        let lastUpdatedStr = 'N/A';
        if (typeof lastUpdated === 'string') {
          lastUpdatedStr = lastUpdated.split('T')[0];
        } else if (lastUpdated.toDate && typeof lastUpdated.toDate === 'function') {
          lastUpdatedStr = lastUpdated.toDate().toISOString().split('T')[0];
        } else if (lastUpdated.timestamp) {
          const dateObj = lastUpdated.timestamp.toDate ? lastUpdated.timestamp.toDate() : new Date(lastUpdated.timestamp);
          lastUpdatedStr = dateObj.toISOString().split('T')[0];
        }
        console.log(`   Last Updated: ${lastUpdatedStr}`);
      }
    } else {
      console.log(`\n💰 Credit Balance: $0.00 MXN`);
    }
    
    // Show credit-related allocations from transactions
    let hasCreditAllocations = false;
    const creditAllocationsByTransaction = new Map();
    
    for (const [txnId, transaction] of transactionMap.entries()) {
      const creditAllocations = filterCreditAllocations(transaction.allocations || []);
      if (creditAllocations.length > 0) {
        hasCreditAllocations = true;
        creditAllocationsByTransaction.set(txnId, {
          transaction,
          allocations: creditAllocations
        });
      }
    }
    
    if (hasCreditAllocations) {
      console.log(`\n💳 Credit-Related Allocations:`);
      for (const [txnId, { transaction, allocations }] of creditAllocationsByTransaction.entries()) {
        const txnDate = transaction.date?.iso ? transaction.date.iso.split('T')[0] : 
                        (transaction.date ? (typeof transaction.date === 'string' ? transaction.date.split('T')[0] : 'N/A') : 'N/A');
        console.log(`   Transaction ${txnId} (${txnDate}):`);
        allocations.forEach(alloc => {
          const allocAmount = formatPesos(centavosToPesos(alloc.amount || 0));
          const allocType = alloc.type || 'credit';
          const allocNote = alloc.note || alloc.description || 'Credit allocation';
          console.log(`      • ${allocType}: $${allocAmount} MXN - ${allocNote}`);
        });
      }
    }
    
    // Transaction details are now shown inline with the table above
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('Usage: node backend/testHarness/queryDuesPayments.js <clientId> <unitId>');
    console.log('Example: node backend/testHarness/queryDuesPayments.js AVII 101');
    process.exit(1);
  }
  
  const [clientId, unitId] = args;
  
  // Run the test using the test harness
  await testHarness.runTest({
    name: `Query HOA Dues Payments for ${clientId} unit ${unitId}`,
    async test({ api }) {
      console.log(`🏢 Client: ${clientId}`);
      console.log(`🏠 Unit: ${unitId}`);
      
      await queryDuesPayments(api, clientId, unitId);
      
      return { 
        passed: true,
        message: 'Query completed successfully'
      };
    }
  });
  
  // Show summary
  testHarness.showSummary();
  
  // Clean exit
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
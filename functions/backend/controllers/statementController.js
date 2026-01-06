/**
 * Statement Controller - Extracted from queryDuesPayments.js test harness
 * Returns complete raw data structure for Statement of Account reports
 */

import axios from 'axios';
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
 * @param {Object} api - API client
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
      return null;
    }
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
function createChronologicalTransactionList(payments, transactionMap, scheduledAmount, duesFrequency, fiscalYearStartMonth, fiscalYear, waterBills = [], hoaPenalties = [], waterPenalties = []) {
  const transactions = [];
  
  // Helper to parse due date
  const parseDueDate = (dueDateValue) => {
    if (!dueDateValue) return null;
    return parseDate(dueDateValue);
  };
  
  // Add water bill charges
  for (const bill of waterBills) {
    const dueDate = parseDueDate(bill.dueDate);
    if (bill.totalAmount > 0) {
      let billDate = dueDate;
      if (!billDate || isNaN(billDate.getTime())) {
        const calendarYear = bill.calendarYear || (bill.year ? bill.year - 1 : fiscalYear - 1);
        const calendarMonth = bill.calendarMonth !== undefined ? bill.calendarMonth : ((fiscalYearStartMonth - 1) + (bill.fiscalMonth || 0)) % 12;
        billDate = new Date(calendarYear, calendarMonth, 1);
      }
      
      if (billDate && !isNaN(billDate.getTime())) {
        const quarterName = bill.fiscalQuarter ? `Q${bill.fiscalQuarter}` : '';
        const monthName = billDate.toLocaleString('en-US', { month: 'short' });
        // Use fiscal year from bill.year, not calendar year from billDate
        const displayYear = bill.year || fiscalYear;
        const description = quarterName 
          ? `Water Bill ${quarterName} ${displayYear}` 
          : `Water Bill ${monthName} ${displayYear}`;
        
        transactions.push({
          type: 'charge',
          category: 'water',
          date: billDate,
          description: description,
          amount: bill.totalAmount,
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
    const quarters = [
      { months: [1, 2, 3], name: 'Q1' },
      { months: [4, 5, 6], name: 'Q2' },
      { months: [7, 8, 9], name: 'Q3' },
      { months: [10, 11, 12], name: 'Q4' }
    ];
    
    for (const quarter of quarters) {
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
          quarterAmount += payment.amount || 0;
        }
      }
      
      if (!quarterDueDate) {
        const fiscalMonthIndex = (quarter.months[0] - 1);
        const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
        const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
        quarterDueDate = new Date(calendarYear, calendarMonth, 1);
      }
      
      const quarterChargeAmount = scheduledAmount * 3;
      
      if (quarterDueDate && !isNaN(quarterDueDate.getTime())) {
        transactions.push({
          type: 'charge',
          date: quarterDueDate,
          description: `HOA Dues ${quarter.name}`,
          amount: quarterChargeAmount,
          charge: quarterChargeAmount,
          payment: 0,
          month: quarter.months[0],
          quarter: quarter.name
        });
      }
      
      const quarterTransactionIds = new Set();
      for (const payment of quarterPayments) {
        if (payment.paid) {
          const txnId = payment.transactionId || payment.reference;
          if (txnId && txnId !== '-' && !quarterTransactionIds.has(txnId)) {
            quarterTransactionIds.add(txnId);
            
            const paymentDate = parseDate(payment.date);
            const transaction = transactionMap.get(txnId);
            
            if (paymentDate && !isNaN(paymentDate.getTime())) {
              let paymentAmount = payment.amount || 0;
              if (transaction) {
                paymentAmount = centavosToPesos(transaction.amount || 0);
              }
              
              transactions.push({
                type: 'payment',
                date: paymentDate,
                description: `Payment ${quarter.name}`,
                amount: -paymentAmount,
                charge: 0,
                payment: paymentAmount,
                transactionId: txnId,
                month: quarter.months[0],
                quarter: quarter.name
              });
            }
          }
        }
      }
    }
  } else {
    const monthlyTransactionIds = new Set();
    
    for (const payment of payments) {
      if (!payment.month) continue;
      
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
      
      const hasPayment = (payment.paid || payment.amount > 0 || payment.transactionId || payment.reference);
      if (hasPayment) {
        const txnId = payment.transactionId || payment.reference;
        if (txnId && txnId !== '-' && !monthlyTransactionIds.has(txnId)) {
          monthlyTransactionIds.add(txnId);
          
          const paymentDate = parseDate(payment.date);
          const transaction = transactionMap.get(txnId);
          
          const effectiveDate = paymentDate && !isNaN(paymentDate.getTime()) 
            ? paymentDate 
            : (transaction?.date ? parseDate(transaction.date) : null);
          
          if (effectiveDate && !isNaN(effectiveDate.getTime())) {
            let paymentAmount = payment.amount || 0;
            if (transaction) {
              paymentAmount = centavosToPesos(transaction.amount || 0);
            }
            
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
              amount: -paymentAmount,
              charge: 0,
              payment: paymentAmount,
              transactionId: txnId,
              month: paymentMonths[0]
            });
          }
        }
      }
    }
  }
  
  const waterTransactionIds = new Set();
  
  for (const [txnId, transaction] of transactionMap.entries()) {
    const allocations = transaction.allocations || [];
    const waterAllocations = filterWaterAllocations(allocations);
    
    if (waterAllocations.length > 0 && !waterTransactionIds.has(txnId)) {
      waterTransactionIds.add(txnId);
      
      const paymentDate = parseDate(transaction.date);
      if (paymentDate && !isNaN(paymentDate.getTime())) {
        const totalWaterAmount = waterAllocations.reduce((sum, alloc) => {
          return sum + centavosToPesos(alloc.amount || 0);
        }, 0);
        
        if (totalWaterAmount > 0) {
          const hoaAllocations = filterHOAAllocations(transaction.allocations || []);
          const isCombinedPayment = hoaAllocations.length > 0;
          
          transactions.push({
            type: 'payment',
            category: isCombinedPayment ? 'combined' : 'water',
            date: paymentDate,
            description: isCombinedPayment ? `Payment (HOA+Water)` : `Water Payment`,
            amount: -totalWaterAmount,
            charge: 0,
            payment: totalWaterAmount,
            transactionId: txnId
          });
        }
      }
    }
  }
  
  transactions.push(...hoaPenalties);
  transactions.push(...waterPenalties);
  
  transactions.sort((a, b) => {
    const dateA = a.date.getTime();
    const dateB = b.date.getTime();
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    if (a.type === 'penalty' && b.type !== 'penalty') return 1;
    if (a.type !== 'penalty' && b.type === 'penalty') return -1;
    if (a.type === 'charge' && b.type === 'payment') return -1;
    if (a.type === 'payment' && b.type === 'charge') return 1;
    return 0;
  });
  
  let runningBalance = 0;
  transactions.forEach(txn => {
    runningBalance += txn.amount;
    txn.balance = runningBalance;
  });
  
  return transactions;
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
 * Fetch water bills for a unit for a specific year
 * @param {Object} api - API client
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} year - Fiscal year
 * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
 * @returns {Promise<Array>} Array of water bills for the unit
 */
async function fetchWaterBills(api, clientId, unitId, year, fiscalYearStartMonth = 7) {
  try {
    const response = await api.get(`/water/clients/${clientId}/bills/quarterly/${year}`);
    
    if (!response.data || !response.data.success || !response.data.data || !Array.isArray(response.data.data)) {
      return [];
    }
    
    const quarterlyBills = response.data.data;
    const unitBills = [];
    
    for (const quarterlyBill of quarterlyBills) {
      if (quarterlyBill.bills && quarterlyBill.bills.units && quarterlyBill.bills.units[unitId]) {
        const unitBill = quarterlyBill.bills.units[unitId];
        const fiscalYear = quarterlyBill.fiscalYear || year;
        const fiscalQuarter = quarterlyBill.fiscalQuarter || 1;
        const billId = quarterlyBill._billId || quarterlyBill.billId || `${fiscalYear}-Q${fiscalQuarter}`;
        
        const billAmount = unitBill.currentCharge || unitBill.waterCharge || 0;
        const penaltyAmount = unitBill.penaltyAmount || 0;
        const unpaidAmount = unitBill.unpaidAmount || unitBill.displayDue || 0;
        const totalAmount = unitBill.totalAmount || (unpaidAmount > 0 ? unpaidAmount : (billAmount + penaltyAmount));
        
        if (!unitBill || (totalAmount === 0 && billAmount === 0)) {
          continue;
        }
        
        const dueDate = quarterlyBill.dueDate || quarterlyBill.billDate;
        const quarterStartMonth = ((fiscalQuarter - 1) * 3);
        const calendarMonth = ((fiscalYearStartMonth - 1) + quarterStartMonth) % 12;
        const calendarYear = year - 1 + Math.floor(((fiscalYearStartMonth - 1) + quarterStartMonth) / 12);
        
        unitBills.push({
          billId,
          year: quarterlyBill.fiscalYear || year,
          month: calendarMonth + 1,
          fiscalQuarter: fiscalQuarter,
          fiscalMonth: quarterStartMonth,
          calendarYear: calendarYear,
          calendarMonth: calendarMonth,
          dueDate: dueDate,
          currentCharge: billAmount,
          penaltyAmount: penaltyAmount,
          totalAmount: totalAmount,
          paidAmount: unitBill.paidAmount || 0,
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
 * @param {Object} api - API client
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @returns {Promise<Object|null>} Credit balance data or null if error
 */
async function fetchCreditBalance(api, clientId, unitId) {
  try {
    const response = await api.get(`/credit/${clientId}/${unitId}`);
    return response.data || null;
  } catch (error) {
    if (error.response?.status === 404) {
      return {
        clientId,
        unitId,
        creditBalance: 0,
        creditBalanceDisplay: '$0.00',
        lastUpdated: null
      };
    }
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
 * Fetch billing configuration for a client
 * @param {string} clientId - Client ID
 * @param {string} moduleType - 'hoa' or 'water'
 * @returns {Promise<Object>} Billing configuration
 */
async function getBillingConfig(clientId, moduleType = 'hoa') {
  const db = await getDb();
  const configDocName = moduleType === 'water' ? 'waterBills' : 'hoaDues';
  
  try {
    const configDoc = await db
      .collection('clients')
      .doc(clientId)
      .collection('config')
      .doc(configDocName)
      .get();
    
    if (!configDoc.exists) {
      return {
        penaltyRate: 0.10,
        penaltyDays: 10,
      };
    }
    
    const config = configDoc.data();
    return {
      penaltyRate: config.penaltyRate ?? 0.10,
      penaltyDays: config.penaltyDays ?? 10,
      ...config
    };
  } catch (error) {
    return {
      penaltyRate: 0.10,
      penaltyDays: 10
    };
  }
}

/**
 * Query HOA Dues payments for a unit using API endpoints
 * Returns complete data structure instead of console logging
 * @param {Object} api - API client
 * @param {string} clientId - Client ID (e.g., 'AVII', 'MTC')
 * @param {string} unitId - Unit ID (e.g., '101', '1A')
 * @param {number} fiscalYear - Fiscal year (optional, defaults to current)
 * @returns {Promise<Object>} Complete data structure
 */
async function queryDuesPayments(api, clientId, unitId, fiscalYear = null) {
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
    return {
      clientId,
      unitId,
      fiscalYear: currentFiscalYear,
      fiscalYearBounds,
      hoaDues: null,
      waterBills: [],
      creditBalance: null,
      chronologicalList: [],
      runningBalances: [],
      summary: {
        totalDue: 0,
        totalPaid: 0,
        outstanding: 0
      }
    };
  }
  
  const duesData = duesResponse.data[unitId];
  const payments = duesData.payments || [];
  
  // Step 4: Fetch transactions
  const transactionIds = new Set();
  for (let month = 1; month <= 12; month++) {
    const payment = payments.find(p => p.month === month);
    if (payment) {
      const txnId = payment.transactionId || payment.reference;
      if (txnId && txnId !== '-' && typeof txnId === 'string') {
        transactionIds.add(txnId);
      }
      
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
        
        const txnIdMatches = notesStr.matchAll(/TxnID:\s*(\d{4}-\d{2}-\d{2}_\d{6}_\d+)/gi);
        for (const match of txnIdMatches) {
          if (match[1]) {
            transactionIds.add(match[1]);
          }
        }
      }
    }
  }
  
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
  
  // Step 6: Fetch transactions from water bill payments
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
    if (bill.transactionId && bill.transactionId !== '-' && typeof bill.transactionId === 'string' && !transactionMap.has(bill.transactionId)) {
      const transaction = await fetchTransaction(api, clientId, bill.transactionId);
      if (transaction) {
        transactionMap.set(bill.transactionId, transaction);
      }
    }
  }
  
  // Step 7: Get penalties using unified preview API
  let hoaPenalties = [];
  let waterPenalties = [];
  try {
    const scheduledAmount = duesData.scheduledAmount || 0;
    const payOnDateStr = now.toISOString().split('T')[0];
    const unifiedPreviewResponse = await api.post(`/payments/unified/preview`, {
      clientId,
      unitId,
      amount: null,
      paymentDate: payOnDateStr
    });
    
    if (unifiedPreviewResponse.data?.success && unifiedPreviewResponse.data.preview) {
      const preview = unifiedPreviewResponse.data.preview;
      
      const hoaBillsPaid = preview.hoa?.billsPaid || [];
      for (const bill of hoaBillsPaid) {
        if (bill.totalPenaltyDue && bill.totalPenaltyDue > 0) {
          const billPeriod = bill.billPeriod || '';
          const cleanPeriod = billPeriod.replace('hoa:', '');
          let dueDate = null;
          let penaltyFiscalYear = null;
          
          if (cleanPeriod.includes('-Q')) {
            const [yearStr, quarterStr] = cleanPeriod.split('-Q');
            penaltyFiscalYear = parseInt(yearStr);
            const quarter = parseInt(quarterStr);
            const fiscalMonthIndex = (quarter - 1) * 3;
            const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
            const calendarYear = penaltyFiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
            dueDate = new Date(calendarYear, calendarMonth, 1);
          } else if (cleanPeriod.includes('-')) {
            const [yearStr, monthStr] = cleanPeriod.split('-');
            penaltyFiscalYear = parseInt(yearStr);
            const fiscalMonthIndex = parseInt(monthStr);
            const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
            const calendarYear = penaltyFiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
            dueDate = new Date(calendarYear, calendarMonth, 1);
          }
          
          if (dueDate && !isNaN(dueDate.getTime())) {
            const penaltyDate = new Date(dueDate);
            penaltyDate.setMonth(penaltyDate.getMonth() + 1);
            penaltyDate.setDate(1);
            
            let description = 'HOA Penalty';
            if (cleanPeriod.includes('-Q')) {
              const quarter = cleanPeriod.split('-Q')[1];
              // Use fiscal year from billPeriod, not calendar year from dueDate
              description += ` - Q${quarter} ${penaltyFiscalYear}`;
            } else {
              const monthName = dueDate.toLocaleString('en-US', { month: 'short' });
              // Use fiscal year from billPeriod, not calendar year from dueDate
              description += ` - ${monthName} ${penaltyFiscalYear}`;
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
      
      const waterBillsPaid = preview.water?.billsPaid || [];
      for (const bill of waterBillsPaid) {
        if (bill.totalPenaltyDue && bill.totalPenaltyDue > 0) {
          const billPeriod = bill.billPeriod || '';
          const cleanPeriod = billPeriod.replace('water:', '');
          let dueDate = null;
          let penaltyFiscalYear = null;
          
          if (cleanPeriod.includes('-Q')) {
            const [yearStr, quarterStr] = cleanPeriod.split('-Q');
            penaltyFiscalYear = parseInt(yearStr);
            const quarter = parseInt(quarterStr);
            const fiscalMonthIndex = (quarter - 1) * 3;
            const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
            const calendarYear = penaltyFiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
            dueDate = new Date(calendarYear, calendarMonth, 1);
          }
          
          if (dueDate && !isNaN(dueDate.getTime())) {
            const penaltyDate = new Date(dueDate);
            penaltyDate.setMonth(penaltyDate.getMonth() + 1);
            penaltyDate.setDate(1);
            
            const quarter = cleanPeriod.includes('-Q') ? cleanPeriod.split('-Q')[1] : '';
            // Use fiscal year from billPeriod, not calendar year from dueDate
            const description = `Water Penalty - Q${quarter} ${penaltyFiscalYear}`;
            
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
    // Graceful degradation - continue without penalties
  }
  
  // Step 8: Create chronological transaction list
  const scheduledAmount = duesData.scheduledAmount || 0;
  const chronologicalList = createChronologicalTransactionList(
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
  
  return {
    clientId,
    unitId,
    fiscalYear: currentFiscalYear,
    fiscalYearBounds,
    hoaDues: {
      scheduledAmount,
      totalPaid,
      payments,
      duesFrequency,
      fiscalYearStartMonth
    },
    waterBills,
    creditBalance: creditBalanceData,
    chronologicalList,
    runningBalances: chronologicalList.map(txn => ({
      date: txn.date,
      balance: txn.balance
    })),
    summary: {
      totalDue,
      totalPaid,
      outstanding: totalOutstanding,
      creditBalance: creditBalanceData?.creditBalance || 0
    },
    penalties: {
      hoa: hoaPenalties,
      water: waterPenalties
    },
    transactions: Array.from(transactionMap.values())
  };
}

/**
 * Create API client for calling backend endpoints
 * Used internally by queryDuesPayments function
 */
function createApiClient(baseURL = 'http://localhost:5001', authToken = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers
  });
  
  return client;
}

export default { queryDuesPayments, createApiClient };

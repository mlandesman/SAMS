/**
 * StatementDataCollector Service
 * 
 * Direct port of validated prototype (queryDuesPayments.js)
 * Uses controller functions directly instead of HTTP calls
 * 
 * This is the SOURCE OF TRUTH for Statement of Account data collection.
 */

import { getNow } from '../../shared/services/DateService.js';
import { getFiscalYear, getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { centavosToPesos } from '../utils/currencyUtils.js';
import { getDb } from '../firebase.js';
import { getAllDuesDataForYear } from '../controllers/hoaDuesController.js';
import { getTransaction, queryTransactions } from '../controllers/transactionsController.js';
import { getCreditBalance } from '../../shared/services/CreditBalanceService.js';
import { UnifiedPaymentWrapper } from './unifiedPaymentWrapper.js';
import waterBillsService from './waterBillsService.js';
import { hasActivity } from '../utils/clientFeatures.js';

const unifiedPaymentWrapper = new UnifiedPaymentWrapper();

/**
 * Parse date from various formats (copied from prototype)
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
 * Filter HOA allocations (copied from prototype)
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
 * Filter water allocations (copied from prototype)
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
 * Convert fiscal month number to calendar month name and year
 * @param {number} fiscalMonth - Month number (0-11 within fiscal year)
 * @param {number} fiscalYearStartMonth - Month the fiscal year starts (1-12, e.g., 7 for July)
 * @param {number} fiscalYear - The fiscal year (e.g., 2026)
 * @returns {string} - "January 2026" format
 */
function getCalendarMonthName(fiscalMonth, fiscalYearStartMonth, fiscalYear) {
  // fiscalMonth is 0-indexed within the fiscal year
  // fiscalYearStartMonth is 1-indexed (1=Jan, 7=Jul, etc.)
  
  // Calculate actual calendar month (0-indexed for Date)
  const calendarMonth = (fiscalYearStartMonth - 1 + fiscalMonth) % 12;
  
  // Calculate actual calendar year
  // If we wrap past December, we're in the next calendar year
  const monthsFromStart = fiscalYearStartMonth - 1 + fiscalMonth;
  const calendarYear = fiscalYear + Math.floor(monthsFromStart / 12) - (fiscalYearStartMonth > 1 ? 1 : 0);
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return `${monthNames[calendarMonth]} ${calendarYear}`;
}

/**
 * Create chronological transaction list with running balance
 * COPIED EXACTLY FROM PROTOTYPE (lines 129-401)
 * DO NOT MODIFY - This is the validated logic
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
  
  // Add water bill charges
  for (const bill of waterBills) {
    const dueDate = parseDate(bill.dueDate);
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
        const displayYear = billDate.getFullYear();
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
  
  // Extract HOA charges and payments
  // Track processed transactions across ALL quarters to prevent duplicates
  const processedTransactionIds = new Set();
  
  if (duesFrequency === 'quarterly') {
    const quarters = [
      { months: [1, 2, 3], name: 'Q1' },
      { months: [4, 5, 6], name: 'Q2' },
      { months: [7, 8, 9], name: 'Q3' },
      { months: [10, 11, 12], name: 'Q4' }
    ];
    
    for (const quarter of quarters) {
      let quarterDueDate = null;
      const quarterPayments = [];
      
      for (const monthNum of quarter.months) {
        const payment = payments.find(p => p.month === monthNum);
        if (payment) {
          quarterPayments.push(payment);
          if (!quarterDueDate && payment.dueDate) {
            quarterDueDate = parseDate(payment.dueDate);
          }
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
          category: 'hoa',
          date: quarterDueDate,
          description: `HOA Dues ${quarter.name}`,
          amount: quarterChargeAmount,
          charge: quarterChargeAmount,
          payment: 0,
          month: quarter.months[0],
          quarter: quarter.name
        });
      }
      
      // Extract payments for this quarter - but only create entry if not already processed
      for (const payment of quarterPayments) {
        if (payment.paid) {
          const txnId = payment.transactionId || payment.reference;
          
          // Skip if no valid transaction ID or already processed globally
          if (!txnId || txnId === '-' || processedTransactionIds.has(txnId)) {
            continue;
          }
          
          processedTransactionIds.add(txnId);
          
          const paymentDate = parseDate(payment.date);
          const transaction = transactionMap.get(txnId);
          
          if (paymentDate && !isNaN(paymentDate.getTime())) {
            let paymentAmount = payment.amount || 0;
            let description = 'Payment';
            
            if (transaction) {
              // NOTE: Do NOT override paymentAmount with transaction.amount
              // payment.amount is the full amount applied to the bill (cash + credit)
              // transaction.amount is only the cash deposit portion
              // We still use transaction for building descriptions below
              
              // Build description from allocations
              const allocations = transaction.allocations || [];
              const hoaQuarters = [...new Set(allocations
                .filter(a => a.type === 'hoa_month' || a.type === 'hoa-month')
                .map(a => a.targetName))];
              const waterBills = [...new Set(allocations
                .filter(a => a.type === 'water_consumption' || a.type === 'water-consumption' || 
                            a.type === 'water_bill' || a.type === 'water-bill' ||
                            (a.categoryId && a.categoryId.includes('water')))
                .map(a => {
                  // Extract quarter from targetName like "Water Bill 2026-Q1"
                  const match = a.targetName?.match(/Q\d/);
                  return match ? match[0] : (a.targetName || 'Bill');
                }))];
              
              const parts = [];
              if (hoaQuarters.length > 0) {
                parts.push(`HOA ${hoaQuarters.join(', ')}`);
              }
              if (waterBills.length > 0) {
                parts.push(`Water ${waterBills.join(', ')}`);
              }
              
              if (parts.length > 0) {
                description = `Payment - ${parts.join('; ')}`;
              }
            }
            
            transactions.push({
              type: 'payment',
              category: 'hoa',
              date: paymentDate,
              description: description,
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
  } else {
    // Monthly billing - generate charges for all 12 months
    for (let fiscalMonth = 1; fiscalMonth <= 12; fiscalMonth++) {
      const payment = payments.find(p => p.month === fiscalMonth);
      
      // Calculate due date - use payment.dueDate if available, otherwise calculate
      let dueDate;
      if (payment?.dueDate) {
        dueDate = parseDate(payment.dueDate);
      }
      
      // Fallback: calculate due date from fiscal month (same pattern as getCalendarMonthName)
      if (!dueDate || isNaN(dueDate.getTime())) {
        const fiscalMonthIndex = fiscalMonth - 1; // Convert to 0-indexed
        const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
        const monthsFromStart = fiscalYearStartMonth - 1 + fiscalMonthIndex;
        const calendarYear = fiscalYear + Math.floor(monthsFromStart / 12) - (fiscalYearStartMonth > 1 ? 1 : 0);
        dueDate = new Date(calendarYear, calendarMonth, 1);
      }
      
      // Always generate the charge
      if (dueDate && !isNaN(dueDate.getTime())) {
        transactions.push({
          type: 'charge',
          category: 'hoa',
          date: dueDate,
          description: `HOA Dues ${getCalendarMonthName(fiscalMonth - 1, fiscalYearStartMonth, fiscalYear)}`,
          amount: scheduledAmount,
          charge: scheduledAmount,
          payment: 0,
          month: fiscalMonth
        });
      }
      
      // Process payment if exists (keep existing payment processing logic)
      if (payment) {
        const hasPayment = (payment.paid || payment.amount > 0 || payment.transactionId || payment.reference);
        if (hasPayment) {
          const txnId = payment.transactionId || payment.reference;
          
          // Skip if no valid transaction ID or already processed globally
          if (!txnId || txnId === '-' || processedTransactionIds.has(txnId)) {
            continue;
          }
          
          processedTransactionIds.add(txnId);
          
          const paymentDate = parseDate(payment.date);
          const transaction = transactionMap.get(txnId);
          
          const effectiveDate = paymentDate && !isNaN(paymentDate.getTime()) 
            ? paymentDate 
            : (transaction?.date ? parseDate(transaction.date) : null);
          
          if (effectiveDate && !isNaN(effectiveDate.getTime())) {
            let paymentAmount = payment.amount || 0;
            let description = 'Payment';
            
            if (transaction) {
              // NOTE: Do NOT override paymentAmount with transaction.amount
              // payment.amount is the full amount applied to the bill (cash + credit)
              // transaction.amount is only the cash deposit portion
              // We still use transaction for building descriptions below
              
              // Build description from allocations
              const allocations = transaction.allocations || [];
              const hoaMonths = [...new Set(allocations
                .filter(a => a.type === 'hoa_month' || a.type === 'hoa-month')
                .map(a => a.targetName))];
              const waterBills = [...new Set(allocations
                .filter(a => a.type === 'water_consumption' || a.type === 'water-consumption' || 
                            a.type === 'water_bill' || a.type === 'water-bill' ||
                            (a.categoryId && a.categoryId.includes('water')))
                .map(a => {
                  const match = a.targetName?.match(/Q\d/);
                  return match ? match[0] : (a.targetName || 'Bill');
                }))];
              
              const parts = [];
              if (hoaMonths.length > 0) {
                parts.push(`HOA ${hoaMonths.join(', ')}`);
              }
              if (waterBills.length > 0) {
                parts.push(`Water ${waterBills.join(', ')}`);
              }
              
              if (parts.length > 0) {
                description = `Payment - ${parts.join('; ')}`;
              } else {
                // Fallback to month-based description
                const paymentMonths = payments
                  .filter(p => (p.transactionId || p.reference) === txnId && p.paid)
                  .map(p => p.month)
                  .sort((a, b) => a - b);
                
                description = paymentMonths.length === 1
                  ? `Payment Month ${payment.month}`
                  : `Payment Months ${paymentMonths[0]}-${paymentMonths[paymentMonths.length - 1]}`;
              }
            }
            
            transactions.push({
              type: 'payment',
              category: 'hoa',
              date: effectiveDate,
              description: description,
              amount: -paymentAmount,
              charge: 0,
              payment: paymentAmount,
              transactionId: txnId,
              month: payment.month
            });
          }
        }
      }
    }
  }

  
  // Extract water payments from transactions
  // Only process transactions that weren't already handled in the HOA section
  // FIX #111: Filter by allocation target year to handle cross-fiscal-year payments
  const waterTransactionIds = new Set();
  
  for (const [txnId, transaction] of transactionMap.entries()) {
    // Skip if already processed in HOA section (prevents duplicate entries for combined payments)
    if (processedTransactionIds.has(txnId)) {
      continue;
    }
    
    const allocations = transaction.allocations || [];
    const waterAllocations = filterWaterAllocations(allocations);
    
    // FIX #111: Filter water allocations to only include those targeting this fiscal year
    // This handles cross-year prepayments where transaction date differs from target year
    const relevantWaterAllocations = waterAllocations.filter(alloc => {
      const targetYear = alloc.data?.year;
      // Include if: targets this fiscal year, OR no target year specified
      return !targetYear || targetYear === fiscalYear;
    });
    
    if (relevantWaterAllocations.length > 0 && !waterTransactionIds.has(txnId)) {
      waterTransactionIds.add(txnId);
      processedTransactionIds.add(txnId); // Mark as globally processed
      
      const paymentDate = parseDate(transaction.date);
      if (paymentDate && !isNaN(paymentDate.getTime())) {
        const totalWaterAmount = relevantWaterAllocations.reduce((sum, alloc) => {
          return sum + centavosToPesos(alloc.amount || 0);
        }, 0);
        
        if (totalWaterAmount > 0) {
          // Build descriptive label for pure water payments (deduplicate quarter names)
          const waterBillNames = [...new Set(relevantWaterAllocations.map(a => {
            const match = a.targetName?.match(/Q\d/);
            return match ? match[0] : (a.targetName || 'Bill');
          }))];
          const description = `Water Payment - ${waterBillNames.join(', ')}`;
          
          transactions.push({
            type: 'payment',
            category: 'water',
            date: paymentDate,
            description: description,
            amount: -totalWaterAmount,
            charge: 0,
            payment: totalWaterAmount,
            transactionId: txnId
          });
        }
      }
    }
  }
  
  // Add penalties
  transactions.push(...hoaPenalties);
  transactions.push(...waterPenalties);
  
  // Sort chronologically
  transactions.sort((a, b) => {
    const dateA = a.date.getTime();
    const dateB = b.date.getTime();
    if (dateA !== dateB) return dateA - dateB;
    
    if (a.type === 'penalty' && b.type !== 'penalty') return 1;
    if (a.type !== 'penalty' && b.type === 'penalty') return -1;
    if (a.type === 'charge' && b.type === 'payment') return -1;
    if (a.type === 'payment' && b.type === 'charge') return 1;
    return 0;
  });
  
  // Calculate running balance
  let runningBalance = 0;
  transactions.forEach(txn => {
    runningBalance += txn.amount;
    txn.balance = runningBalance;
  });
  
  return transactions;
}


/**
 * Fetch water bills for a unit (using API endpoint)
 * @param {Object} api - API client
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID
 * @param {number} year - Fiscal year
 * @param {number} fiscalYearStartMonth - Fiscal year start month (default: 7)
 * @returns {Promise<Array>} Array of water bill objects
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
 * Generate Statement of Account
 * PORTED FROM PROTOTYPE queryDuesPayments() function
 * Uses controller functions directly instead of HTTP calls
 * 
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID  
 * @param {number} fiscalYear - Fiscal year to generate statement for
 * @param {Date} asOfDate - Optional date to calculate as of (defaults to now)
 * @returns {Promise<Object>} Complete statement data
 */
export async function generateStatement(api, clientId, unitId, fiscalYear, asOfDate = null) {
  try {
    const effectiveDate = asOfDate || getNow();
    
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
    
    const fiscalYearBounds = getFiscalYearBounds(fiscalYear, fiscalYearStartMonth);
    
    // Step 2: Query HOA dues for the year (using API endpoint)
    const duesResponse = await api.get(`/hoadues/${clientId}/year/${fiscalYear}`);
    
    if (!duesResponse.data || !duesResponse.data[unitId]) {
      throw new Error(`No dues data found for unit ${unitId} in fiscal year ${fiscalYear}`);
    }
    
    const duesData = duesResponse.data[unitId];
    const payments = duesData.payments || [];
    const scheduledAmount = duesData.scheduledAmount || 0;
    
    // Step 3: Fetch transactions
    const transactionIds = new Set();
    
    for (const payment of payments) {
      if (!payment) continue;
      
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
    
    // Step 4: Fetch water bills (only if client has water bills project)
    // Issue #60/#161: Check if client has water service via activities menu
    const db = await getDb();
    const hasWaterBillsProject = await hasActivity(db, clientId, 'WaterBills');
    const waterBills = hasWaterBillsProject
      ? await fetchWaterBills(api, clientId, unitId, fiscalYear, fiscalYearStartMonth)
      : [];
    
    // Step 5: Fetch transactions from water bills
    for (const bill of waterBills) {
      if (bill.payments && Array.isArray(bill.payments)) {
        for (const payment of bill.payments) {
          if (payment.transactionId && payment.transactionId !== '-') {
            transactionIds.add(payment.transactionId);
          }
        }
      }
      if (bill.transactionId && bill.transactionId !== '-') {
        transactionIds.add(bill.transactionId);
      }
    }
    
    // Step 5.5: Find "Orphaned" transactions (not linked in Dues/Water but belong to unit)
    // FIX #111: Remove date filter to catch cross-fiscal-year prepayments (e.g., Oct 2024 payment for 2025 dues)
    // Query ALL transactions for this unit, then filter by allocation target year
    try {
      const allUnitTxns = await queryTransactions(clientId, {});
      
      const unitTxns = allUnitTxns.filter(t => {
        // Check exact match or prefix match (e.g. "PH4D" matches "PH4D (Landesman)")
        const tUnitId = t.unitId || '';
        const metaUnitId = t.metadata?.unitId;
        const allocUnitIds = (t.allocations || []).map(a => a.data?.unitId || a.metadata?.unitId).filter(Boolean);
        
        return tUnitId === unitId || 
               tUnitId.startsWith(unitId + ' ') || 
               tUnitId.startsWith(unitId + '(') ||
               metaUnitId === unitId ||
               allocUnitIds.includes(unitId);
      });
      
      // Filter transactions to only include those with allocations targeting this fiscal year
      // This handles cross-year prepayments: transaction date may be in year X, 
      // but allocation.data.year targets year Y
      for (const txn of unitTxns) {
        if (txn.id) {
          const allocations = txn.allocations || [];
          const hasRelevantAllocation = allocations.some(alloc => {
            const targetYear = alloc.data?.year;
            // Include if: targets this fiscal year, OR no target year specified (credit entries, etc.)
            return !targetYear || targetYear === fiscalYear;
          });
          
          if (hasRelevantAllocation) {
            transactionIds.add(txn.id);
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching orphaned transactions: ${err.message}`);
    }

    // Fetch all transactions (using controller function directly)
    const transactions = new Map();
    for (const txnId of transactionIds) {
      const transaction = await getTransaction(clientId, txnId);
      if (transaction) {
        transactions.set(txnId, transaction);
      }
    }
    
    // Step 6: Fetch penalties using unified preview
    let hoaPenalties = [];
    let waterPenalties = [];
    
    try {
      const payOnDateStr = effectiveDate.toISOString().split('T')[0];
      // Use a very large amount to get all bills with penalties
      // This matches the controller's approach for null amount (line 224)
      const preview = await unifiedPaymentWrapper.previewUnifiedPayment(
        clientId,
        unitId,
        999999999, // Large amount in pesos to get all bills
        payOnDateStr,
        true // zeroAmountRequest flag
      );
      
      if (preview && preview.hoa && preview.hoa.billsPaid) {
        // Extract HOA penalties
        const hoaBillsPaid = preview.hoa.billsPaid || [];
        for (const bill of hoaBillsPaid) {
          if (bill.totalPenaltyDue && bill.totalPenaltyDue > 0) {
            const billPeriod = (bill.billPeriod || '').replace('hoa:', '');
            let dueDate = null;
            
            if (billPeriod.includes('-Q')) {
              const [yearStr, quarterStr] = billPeriod.split('-Q');
              const billFiscalYear = parseInt(yearStr);
              const quarter = parseInt(quarterStr);
              const fiscalMonthIndex = (quarter - 1) * 3;
              const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
              const calendarYear = billFiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
              dueDate = new Date(calendarYear, calendarMonth, 1);
            } else if (billPeriod.includes('-')) {
              const [yearStr, monthStr] = billPeriod.split('-');
              const billFiscalYear = parseInt(yearStr);
              const fiscalMonthIndex = parseInt(monthStr);
              const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
              const calendarYear = billFiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
              dueDate = new Date(calendarYear, calendarMonth, 1);
            }
            
            if (dueDate && !isNaN(dueDate.getTime())) {
              const penaltyDate = new Date(dueDate);
              penaltyDate.setMonth(penaltyDate.getMonth() + 1);
              penaltyDate.setDate(1);
              
              let description = 'HOA Penalty';
            if (billPeriod.includes('-Q')) {
              let quarter = parseInt(billPeriod.split('-Q')[1]);
              if (quarter === 0) quarter = 4; // Handle Q0 as previous year's Q4
              description += ` - Q${quarter} ${dueDate.getFullYear()}`;
            } else {
                const monthName = dueDate.toLocaleString('en-US', { month: 'short' });
                description += ` - ${monthName} ${dueDate.getFullYear()}`;
              }
              
              hoaPenalties.push({
                type: 'penalty',
                category: 'hoa',
                date: penaltyDate,
                description,
                amount: bill.totalPenaltyDue,
                charge: bill.totalPenaltyDue,
                payment: 0,
                billId: billPeriod,
                baseAmount: bill.totalBaseDue || 0
              });
            }
          }
        }
      }
      
      if (preview && preview.water && preview.water.billsPaid) {
        // Extract water penalties
        const waterBillsPaid = preview.water.billsPaid || [];
        for (const bill of waterBillsPaid) {
          if (bill.totalPenaltyDue && bill.totalPenaltyDue > 0) {
            const billPeriod = (bill.billPeriod || '').replace('water:', '');
            let dueDate = null;
            
            if (billPeriod.includes('-Q')) {
              const [yearStr, quarterStr] = billPeriod.split('-Q');
              const billFiscalYear = parseInt(yearStr);
              const quarter = parseInt(quarterStr);
              const fiscalMonthIndex = (quarter - 1) * 3;
              const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
              const calendarYear = billFiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
              dueDate = new Date(calendarYear, calendarMonth, 1);
            }
            
            if (dueDate && !isNaN(dueDate.getTime())) {
              const penaltyDate = new Date(dueDate);
              penaltyDate.setMonth(penaltyDate.getMonth() + 1);
              penaltyDate.setDate(1);
              
              let quarter = billPeriod.includes('-Q') ? parseInt(billPeriod.split('-Q')[1]) : '';
              if (quarter === 0) quarter = 4; // Handle Q0 as previous year's Q4
              const description = `Water Penalty - Q${quarter} ${dueDate.getFullYear()}`;
              
              waterPenalties.push({
                type: 'penalty',
                category: 'water',
                date: penaltyDate,
                description,
                amount: bill.totalPenaltyDue,
                charge: bill.totalPenaltyDue,
                payment: 0,
                billId: billPeriod,
                baseAmount: bill.totalBaseDue || 0
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching penalties:`, error.message);
    }
    
    // Step 7: Fetch credit balance
    const creditBalanceData = await getCreditBalance(clientId, unitId);
    
    // Step 8: Create chronological transaction list
    const chronologicalTransactions = createChronologicalTransactionList(
      payments,
      transactions,
      scheduledAmount,
      duesFrequency,
      fiscalYearStartMonth,
      fiscalYear,
      waterBills,
      hoaPenalties,
      waterPenalties
    );
    
    // Step 9: Calculate summary
    const totalDue = scheduledAmount * 12;
    const totalPaid = duesData.totalPaid || 0;
    const totalOutstanding = totalDue - totalPaid;
    
    const finalBalance = chronologicalTransactions.length > 0 
      ? chronologicalTransactions[chronologicalTransactions.length - 1].balance 
      : 0;
    
    return {
      clientId,
      unitId,
      fiscalYear,
      asOfDate: effectiveDate,
      fiscalYearStartMonth,
      fiscalYearBounds,
      duesFrequency,
      scheduledAmount,
      totalDue,
      totalPaid,
      totalOutstanding,
      creditBalance: creditBalanceData?.creditBalance || 0,
      creditBalanceDisplay: `$${(creditBalanceData?.creditBalance || 0).toFixed(2)}`,
      transactions: chronologicalTransactions,
      finalBalance,
      summary: {
        totalDue,
        totalPaid,
        totalOutstanding,
        finalBalance,
        creditBalance: creditBalanceData?.creditBalance || 0
      }
    };
    
  } catch (error) {
    console.error('[StatementDataCollector] Error:', error.message);
    throw error;
  }
}

export default { generateStatement };

/**
 * DataAggregator - Utility service for collecting and merging data from multiple sources
 * Handles HOA Dues, Water Bills, and Transactions data collection
 */

import { getDb } from '../firebase.js';
import { getNow } from './DateService.js';
import { createDate as createCancunDate, parseDate as parseCancunDate } from '../../shared/services/DateService.js';
import { DateTime } from 'luxon';
import waterBillsService from './waterBillsService.js';
import { centavosToPesos } from '../utils/currencyUtils.js';
import { 
  getFiscalYear, 
  getFiscalYearBounds,
  fiscalToCalendarMonth,
  calendarToFiscalMonth
} from '../utils/fiscalYearUtils.js';
import { calculatePenaltyForBill, calculateMonthsOverdue } from '../../shared/services/PenaltyRecalculationService.js';

export class DataAggregator {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize Firestore database connection
   * @private
   */
  async _initializeDb() {
    if (!this.db) {
      this.db = await getDb();
    }
  }

  /**
   * Collect HOA Dues data for a unit within date range
   * Handles both monthly and quarterly billing frequencies with fiscal year support
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Date} startDate - Start date of range (calendar date)
   * @param {Date} endDate - End date of range (calendar date)
   * @param {string} duesFrequency - 'monthly' or 'quarterly'
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12, default 1)
   * @param {object} hoaConfig - HOA billing config (optional, will be loaded if not provided)
   * @returns {Promise<Array>} Array of HOA Dues transactions
   */
  async collectHoaDuesData(clientId, unitId, startDate, endDate, duesFrequency, fiscalYearStartMonth = 1, hoaConfig = null) {
    await this._initializeDb();
    
    // Load HOA config if not provided - REQUIRED for penalty calculations
    if (!hoaConfig || typeof hoaConfig !== 'object') {
      const configDoc = await this.db.collection('clients').doc(clientId)
        .collection('config').doc('hoaDues').get();
      
      if (!configDoc.exists) {
        throw new Error(`HOA Dues configuration not found for client ${clientId}. Cannot calculate penalties without configuration. Please create config document at clients/${clientId}/config/hoaDues`);
      }
      
      hoaConfig = configDoc.data();
      
      // Validate that config was loaded
      if (!hoaConfig || typeof hoaConfig !== 'object') {
        throw new Error(`HOA Dues configuration document exists but is empty for client ${clientId}. Cannot calculate penalties without configuration.`);
      }
      
      // Validate required penalty fields - fail fast if missing
      if (hoaConfig.penaltyRate === undefined || hoaConfig.penaltyRate === null) {
        throw new Error(`HOA Dues configuration incomplete for client ${clientId}. Missing required field: penaltyRate. Cannot calculate penalties without this value.`);
      }
      
      if (hoaConfig.penaltyDays === undefined || hoaConfig.penaltyDays === null) {
        throw new Error(`HOA Dues configuration incomplete for client ${clientId}. Missing required field: penaltyDays. Cannot calculate penalties without this value.`);
      }
    } else {
      // Validate provided config
      if (hoaConfig.penaltyRate === undefined || hoaConfig.penaltyRate === null) {
        throw new Error(`HOA Dues configuration incomplete for client ${clientId}. Missing required field: penaltyRate. Cannot calculate penalties without this value.`);
      }
      
      if (hoaConfig.penaltyDays === undefined || hoaConfig.penaltyDays === null) {
        throw new Error(`HOA Dues configuration incomplete for client ${clientId}. Missing required field: penaltyDays. Cannot calculate penalties without this value.`);
      }
    }
    
    // Convert calendar date range to fiscal year periods
    const startFiscalYear = getFiscalYear(startDate, fiscalYearStartMonth);
    const endFiscalYear = getFiscalYear(endDate, fiscalYearStartMonth);
    
    // Collect all fiscal years in range
    const fiscalYears = [];
    for (let fy = startFiscalYear; fy <= endFiscalYear; fy++) {
      fiscalYears.push(fy);
    }
    
    const transactions = [];
    const currentDate = getNow();
    
    for (const fiscalYear of fiscalYears) {
      // Get fiscal year bounds to determine which calendar year document to query
      const { startDate: fyStartDate, endDate: fyEndDate } = getFiscalYearBounds(fiscalYear, fiscalYearStartMonth);
      
      // Determine which calendar year document contains this fiscal year
      // For fiscal years starting mid-year, the document year is the fiscal year
      // (e.g., FY 2026 starting July = document year 2026)
      const documentYear = fiscalYear;
      const duesRef = this.db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').doc(documentYear.toString());
      
      const duesSnap = await duesRef.get();
      
      if (!duesSnap.exists) {
        continue;
      }
      
      const duesData = duesSnap.data();
      const scheduledAmount = duesData.scheduledAmount || 0;
      const payments = duesData.payments || [];
      
      if (duesFrequency === 'quarterly') {
        // For quarterly billing, payments are stored as months (0-11) in the payments array
        // Group payments by quarter based on common due dates (Q1=months 1-3, Q2=months 4-6, Q3=months 7-9, Q4=months 10-12)
        // This is the standard storage structure - there is no separate quarters array
        // The code groups months together based on their common due dates
        const quartersMap = new Map(); // Map quarter number (1-4) to quarter data
        
        // Process all 12 fiscal months
        for (let fiscalMonth = 1; fiscalMonth <= 12; fiscalMonth++) {
          const paymentIndex = fiscalMonth - 1;
          const payment = payments[paymentIndex];
          
          // Get quarter number for this fiscal month (Q1=months 1-3, Q2=months 4-6, Q3=months 7-9, Q4=months 10-12)
          const quarter = this._getQuarterFromMonth(fiscalMonth);
          
          if (!quartersMap.has(quarter)) {
            // Calculate due date for this quarter's start month
            const quarterStartFiscalMonth = ((quarter - 1) * 3) + 1; // Q1=1, Q2=4, Q3=7, Q4=10
            const calendarMonth = fiscalToCalendarMonth(quarterStartFiscalMonth, fiscalYearStartMonth);
            
            let calendarYear;
            if (fiscalYearStartMonth === 1) {
              calendarYear = fiscalYear;
            } else {
              calendarYear = quarterStartFiscalMonth <= 6 ? fiscalYear - 1 : fiscalYear;
            }
            
            const calculatedDueDate = this._createDate(calendarYear, calendarMonth - 1, 1);
            
            quartersMap.set(quarter, {
              quarter: quarter,
              dueDate: calculatedDueDate,
              amount: scheduledAmount * 3, // Quarterly amount (3 months)
              payments: []
            });
          }
          
          // Add payment to quarter (even if null, we track the month)
          if (payment) {
            quartersMap.get(quarter).payments.push({
              ...payment,
              fiscalMonth: fiscalMonth
            });
          }
        }
        
        // Convert to transaction format
        quartersMap.forEach((quarterData) => {
          const dueDate = quarterData.dueDate;
          
          // Normalize dates for comparison to avoid timezone/time component issues
          const normalizedDueDate = this._normalizeDateForComparison(dueDate);
          const normalizedStartDate = this._normalizeDateForComparison(startDate);
          const normalizedEndDate = this._normalizeDateForComparison(endDate);
          
          // Check if this quarter falls within the requested date range
          if (normalizedDueDate >= normalizedStartDate && normalizedDueDate <= normalizedEndDate) {
            const totalPaid = quarterData.payments.reduce((sum, p) => sum + (p.amount || p.paid || 0), 0);
            const balance = quarterData.amount - totalPaid;
            const isPaid = totalPaid > 0;
            
            // Get payment info for transactionId, method, notes
            const firstPayment = quarterData.payments[0];
            
            // If paid, use stored penalty amount from payments (allows for waivers)
            // If unpaid, calculate dynamically as of current date
            let penalty;
            if (isPaid) {
              // Sum stored penalties from all payments in this quarter
              penalty = quarterData.payments.reduce((sum, p) => sum + (p.penaltyPaid || p.penalty || 0), 0);
            } else {
              // Calculate penalty dynamically as of current date
              penalty = this._calculatePenaltyAsOfDate(
                quarterData.amount,
                dueDate,
                currentDate,
                hoaConfig
              );
            }
            
            transactions.push({
              date: dueDate,
              description: `Maintenance Fee Q${quarterData.quarter} ${fiscalYear}`,
              invoiceReceipt: firstPayment?.reference || firstPayment?.transactionId || 'N/A',
              transactionId: firstPayment?.transactionId || null,
              method: firstPayment?.method || null,
              notes: firstPayment?.notes || null,
              amount: centavosToPesos(quarterData.amount),
              penalty: centavosToPesos(penalty),
              payments: centavosToPesos(totalPaid),
              // Balance will be calculated by calculateRunningBalance() - don't set it here
              category: 'HOA Dues',
              quarter: quarterData.quarter,
              year: fiscalYear
            });
          }
        });
      } else {
        // Monthly billing - iterate through fiscal months (1-12)
        for (let fiscalMonth = 1; fiscalMonth <= 12; fiscalMonth++) {
          // Payments array is indexed by fiscal month (0-11)
          const paymentIndex = fiscalMonth - 1;
          const payment = payments[paymentIndex];
          
          // Convert fiscal month to calendar month for due date calculation
          const calendarMonth = fiscalToCalendarMonth(fiscalMonth, fiscalYearStartMonth);
          
          // Calculate calendar year for this fiscal month
          let calendarYear;
          if (fiscalYearStartMonth === 1) {
            calendarYear = fiscalYear;
          } else {
            // For fiscal months 1-6 (e.g., Jul-Dec), use previous calendar year
            // For fiscal months 7-12 (e.g., Jan-Jun), use same calendar year as fiscal year
            calendarYear = fiscalMonth <= 6 ? fiscalYear - 1 : fiscalYear;
          }
          
          // Use payment dueDate if available, otherwise calculate from fiscal month
          const dueDate = payment?.dueDate 
            ? this._parseDate(payment.dueDate) 
            : this._createDate(calendarYear, calendarMonth - 1, 1); // calendarMonth is 1-based, Date constructor expects 0-based
          
          // Check if this month falls within the requested date range
          if (dueDate >= startDate && dueDate <= endDate) {
            const paid = payment?.amount || payment?.paid || 0;
            const balance = scheduledAmount - paid;
            const isPaid = paid > 0;
            
            const monthName = this._getMonthName(calendarMonth);
            
            // If paid, use stored penalty amount from payment (allows for waivers)
            // If unpaid, calculate dynamically as of current date
            let penalty;
            if (isPaid) {
              // Use stored penalty from payment document (may be 0 if waived)
              penalty = payment?.penaltyPaid || payment?.penalty || 0;
            } else {
              // Calculate penalty dynamically as of current date
              penalty = this._calculatePenaltyAsOfDate(
                scheduledAmount,
                dueDate,
                currentDate,
                hoaConfig
              );
            }
            
            transactions.push({
              date: dueDate,
              description: `Maintenance Fee ${monthName} ${fiscalYear}`,
              invoiceReceipt: payment?.transactionId || payment?.reference || 'N/A',
              transactionId: payment?.transactionId || null,
              method: payment?.method || null,
              notes: payment?.notes || null,
              amount: centavosToPesos(scheduledAmount),
              penalty: centavosToPesos(penalty),
              payments: centavosToPesos(paid),
              // Balance will be calculated by calculateRunningBalance() - don't set it here
              category: 'HOA Dues',
              month: fiscalMonth, // Store fiscal month
              year: fiscalYear
            });
          }
        }
      }
    }
    
    return transactions;
  }

  /**
   * Collect Water Bills data for a unit within date range
   * Handles both monthly and quarterly billing periods with fiscal year support
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Date} startDate - Start date of range (calendar date)
   * @param {Date} endDate - End date of range (calendar date)
   * @param {string} billingPeriod - 'monthly' or 'quarterly'
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12, default 1)
   * @returns {Promise<Array>} Array of Water Bills transactions
   */
  async collectWaterBillsData(clientId, unitId, startDate, endDate, billingPeriod, fiscalYearStartMonth = 1) {
    await this._initializeDb();
    
    // Convert calendar date range to fiscal year periods
    const startFiscalYear = getFiscalYear(startDate, fiscalYearStartMonth);
    const endFiscalYear = getFiscalYear(endDate, fiscalYearStartMonth);
    
    const transactions = [];
    
    if (billingPeriod === 'quarterly') {
      // Use quarterly bills API endpoint - it expects fiscal year
      for (let fiscalYear = startFiscalYear; fiscalYear <= endFiscalYear; fiscalYear++) {
        const quarterlyBills = await waterBillsService.getQuarterlyBillsForYear(clientId, fiscalYear);
        
        quarterlyBills.forEach(bill => {
          if (!bill.bills?.units?.[unitId]) return;
          
          const unitBill = bill.bills.units[unitId];
          
          // Parse due date from bill (should already be in correct format from waterBillsService)
          const dueDate = bill.dueDate ? this._parseDate(bill.dueDate) : null;
          
          // If no dueDate, calculate from quarter info
          let calculatedDueDate = dueDate;
          if (!calculatedDueDate && bill.quarter) {
            // Extract quarter number from bill (Q1-Q4)
            const quarterNum = parseInt(bill.quarter.replace('Q', '')) || 1;
            const quarterStartFiscalMonth = ((quarterNum - 1) * 3) + 1; // 1, 4, 7, 10
            const calendarMonth = fiscalToCalendarMonth(quarterStartFiscalMonth, fiscalYearStartMonth);
            
            // Calculate calendar year for this fiscal month
            let calendarYear;
            if (fiscalYearStartMonth === 1) {
              calendarYear = fiscalYear;
            } else {
              calendarYear = quarterStartFiscalMonth <= 6 ? fiscalYear - 1 : fiscalYear;
            }
            
            calculatedDueDate = this._createDate(calendarYear, calendarMonth - 1, 1);
          }
          
          if (calculatedDueDate && calculatedDueDate >= startDate && calculatedDueDate <= endDate) {
            const charge = unitBill.currentCharge || 0;
            const paid = unitBill.paidAmount || 0;
            
            // Use stored penaltyAmount from document
            // For paid bills: This represents what was charged at payment time (allows for waivers)
            // For unpaid bills: This is already calculated and stored by waterBillsService
            const penalty = unitBill.penaltyAmount || 0;
            
            const balance = charge + penalty - paid;
            
            // Get payment info from lastPayment if available
            const lastPayment = unitBill.lastPayment || {};
            
            // Consumption can be stored as 'consumption' or 'totalConsumption' (for quarterly bills)
            const consumption = unitBill.consumption || unitBill.totalConsumption || null;
            
            transactions.push({
              date: calculatedDueDate,
              description: bill._billId || `Water Consumption Q${bill.quarter || '?'} ${fiscalYear}`,
              invoiceReceipt: lastPayment.reference || bill._billId || 'N/A',
              transactionId: lastPayment.transactionId || null,
              method: lastPayment.paymentMethod || null,
              notes: unitBill.billNotes || null,
              amount: centavosToPesos(charge),
              penalty: centavosToPesos(penalty),
              payments: centavosToPesos(paid),
              // Balance will be calculated by calculateRunningBalance() - don't set it here
              category: 'Water Bills',
              quarter: bill._billId || bill.quarter,
              year: fiscalYear,
              consumption: consumption
            });
          }
        });
      }
    } else {
      // Monthly billing - fetch monthly bills
      // Monthly bills are stored by calendar month (YYYY-MM format)
      // Need to query all calendar months that fall within the date range
      const calendarStartYear = startDate.getFullYear();
      const calendarEndYear = endDate.getFullYear();
      
      for (let calendarYear = calendarStartYear; calendarYear <= calendarEndYear; calendarYear++) {
        // Determine which months to query for this calendar year
        const startMonth = (calendarYear === calendarStartYear) ? startDate.getMonth() + 1 : 1;
        const endMonth = (calendarYear === calendarEndYear) ? endDate.getMonth() + 1 : 12;
        
        for (let calendarMonth = startMonth; calendarMonth <= endMonth; calendarMonth++) {
          const monthKey = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
          const billRef = this.db.collection('clients').doc(clientId)
            .collection('projects').doc('waterBills')
            .collection('bills').doc(monthKey);
          
          const billSnap = await billRef.get();
          
          if (!billSnap.exists) continue;
          
          const billData = billSnap.data();
          if (!billData.bills?.units?.[unitId]) continue;
          
          const unitBill = billData.bills.units[unitId];
          const dueDate = billData.dueDate ? this._parseDate(billData.dueDate) : this._createDate(calendarYear, calendarMonth - 1, 1);
          
          // Check if this month falls within the requested date range
          if (dueDate >= startDate && dueDate <= endDate) {
            const charge = unitBill.currentCharge || 0;
            const paid = unitBill.paidAmount || 0;
            
            // Use stored penaltyAmount from document
            // For paid bills: This represents what was charged at payment time (allows for waivers)
            // For unpaid bills: This is already calculated and stored by waterBillsService
            const penalty = unitBill.penaltyAmount || 0;
            
            const balance = charge + penalty - paid;
            
            // Convert calendar month to fiscal month for display
            const fiscalMonth = calendarToFiscalMonth(calendarMonth, fiscalYearStartMonth);
            const fiscalYearForMonth = getFiscalYear(dueDate, fiscalYearStartMonth);
            
            // Get payment info from lastPayment if available
            const lastPayment = unitBill.lastPayment || {};
            
            transactions.push({
              date: dueDate,
              description: `Water Consumption ${this._getMonthName(calendarMonth)} ${calendarYear}`,
              invoiceReceipt: lastPayment.reference || monthKey,
              transactionId: lastPayment.transactionId || null,
              method: lastPayment.paymentMethod || null,
              notes: unitBill.billNotes || null,
              amount: centavosToPesos(charge),
              penalty: centavosToPesos(penalty),
              payments: centavosToPesos(paid),
              // Balance will be calculated by calculateRunningBalance() - don't set it here
              category: 'Water Bills',
              month: fiscalMonth, // Store fiscal month
              year: fiscalYearForMonth, // Store fiscal year
              consumption: unitBill.consumption || null
            });
          }
        }
      }
    }
    
    return transactions;
  }

  /**
   * Collect transactions for a unit within date range
   * Includes split allocations (penalties as separate line items)
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Date} startDate - Start date of range
   * @param {Date} endDate - End date of range
   * @returns {Promise<Array>} Array of transaction records
   */
  async collectTransactions(clientId, unitId, startDate, endDate) {
    await this._initializeDb();
    
    // Query transactions by unitId
    let transactionsSnapshot = await this.db.collection('clients').doc(clientId)
      .collection('transactions')
      .where('unitId', '==', unitId)
      .get();
    
    // Also check legacy 'unit' field
    if (transactionsSnapshot.size === 0) {
      transactionsSnapshot = await this.db.collection('clients').doc(clientId)
        .collection('transactions')
        .where('unit', '==', unitId)
        .get();
    }
    
    const transactions = [];
    
    transactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const txDate = data.date?.toDate?.() || this._parseDate(data.date);
      
      if (txDate < startDate || txDate > endDate) {
        return;
      }
      
      // If transaction has allocations, create separate line items
      if (data.allocations && Array.isArray(data.allocations) && data.allocations.length > 0) {
        data.allocations.forEach(allocation => {
          transactions.push({
            id: doc.id,
            date: txDate,
            description: allocation.description || data.description || '',
            invoiceReceipt: data.reference || 'N/A',
            transactionId: doc.id,
            method: data.paymentMethodId || data.accountType || null,
            notes: data.notes || null,
            amount: centavosToPesos(Math.abs(allocation.amount)),
            penalty: allocation.category === 'penalty' ? centavosToPesos(Math.abs(allocation.amount)) : 0,
            payments: allocation.amount < 0 ? centavosToPesos(Math.abs(allocation.amount)) : 0,
            balance: 0, // Calculated later
            category: allocation.category || data.category || '',
            type: allocation.amount < 0 ? 'payment' : 'charge'
          });
        });
      } else {
        // Single transaction without allocations
        transactions.push({
          id: doc.id,
          date: txDate,
          description: data.description || data.notes || '',
          invoiceReceipt: data.reference || 'N/A',
          transactionId: doc.id,
          method: data.paymentMethodId || data.accountType || null,
          notes: data.notes || null,
          amount: centavosToPesos(Math.abs(data.amount || 0)),
          penalty: 0,
          payments: data.amount < 0 ? centavosToPesos(Math.abs(data.amount)) : 0,
          balance: 0, // Calculated later
          category: data.category || '',
          type: data.amount < 0 ? 'payment' : 'charge'
        });
      }
    });
    
    return transactions;
  }

  /**
   * Merge transaction lists and sort chronologically
   * @param {Array} hoaDues - HOA Dues transactions
   * @param {Array} waterBills - Water Bills transactions
   * @param {Array} transactions - General transactions
   * @returns {Array} Merged and sorted transactions
   */
  mergeTransactionLists(hoaDues, waterBills, transactions) {
    const merged = [...hoaDues, ...waterBills, ...transactions];
    
    // Sort by date (oldest first)
    merged.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      
      // If dates are equal, maintain order: HOA Dues, Water Bills, then other transactions
      if (dateA.getTime() === dateB.getTime()) {
        const categoryOrder = { 'HOA Dues': 1, 'Water Bills': 2 };
        const orderA = categoryOrder[a.category] || 3;
        const orderB = categoryOrder[b.category] || 3;
        return orderA - orderB;
      }
      
      return dateA - dateB;
    });
    
    // Debug logging: Log first 10 transactions to verify sorting
    console.log(`[MERGE TRANSACTIONS] Merged ${merged.length} transactions. First 10:`);
    merged.slice(0, 10).forEach((tx, idx) => {
      console.log(`  ${idx}: ${tx.date.toISOString().split('T')[0]} | ${tx.category} | Amount: ${tx.amount} | Payments: ${tx.payments} | ${tx.description || ''}`);
    });
    
    return merged;
  }

  /**
   * Calculate section subtotals for HOA Dues or Water Bills
   * @param {Array} transactions - Transactions array
   * @param {string} section - 'HOA Dues' or 'Water Bills'
   * @returns {Object} Subtotals object
   */
  calculateSectionSubtotals(transactions, section) {
    const sectionTransactions = transactions.filter(tx => tx.category === section);
    
    const subtotal = sectionTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const penaltySubtotal = sectionTransactions.reduce((sum, tx) => sum + tx.penalty, 0);
    const paymentsSubtotal = sectionTransactions.reduce((sum, tx) => sum + tx.payments, 0);
    
    // Calculate running balance, but cap at 0 (no negative balances)
    // Overpayments are reflected in the credit balance, not as negative section balances
    const calculatedBalance = subtotal + penaltySubtotal - paymentsSubtotal;
    const runningBalance = Math.max(0, calculatedBalance); // Cap at 0, no negatives
    
    return {
      subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimals
      penaltySubtotal: Math.round(penaltySubtotal * 100) / 100,
      paymentsSubtotal: Math.round(paymentsSubtotal * 100) / 100,
      runningBalance: Math.round(runningBalance * 100) / 100
    };
  }

  /**
   * Calculate penalty for a bill as of a specific date
   * @param {number} baseAmount - Base amount in centavos
   * @param {Date} dueDate - Due date
   * @param {Date} asOfDate - Calculate penalty as of this date
   * @param {object} config - Billing config with penaltyRate and penaltyDays
   * @returns {number} Penalty amount in centavos
   * @private
   */
  _calculatePenaltyAsOfDate(baseAmount, dueDate, asOfDate, config) {
    if (!baseAmount || baseAmount <= 0) return 0;
    
    // Validate config - fail fast if missing required financial values
    if (!config || typeof config !== 'object') {
      throw new Error('Penalty calculation requires billing configuration. Config is missing or invalid.');
    }
    
    if (config.penaltyRate === undefined || config.penaltyRate === null) {
      throw new Error('Penalty calculation requires penaltyRate in billing configuration. Cannot use default values for financial calculations.');
    }
    
    if (config.penaltyDays === undefined || config.penaltyDays === null) {
      throw new Error('Penalty calculation requires penaltyDays in billing configuration. Cannot use default values for financial calculations.');
    }
    
    // Early return if penalty rate is 0 (no penalties)
    if (config.penaltyRate === 0) {
      return 0;
    }
    
    // Use config as-is - no defaults for financial values
    const penaltyConfig = {
      penaltyRate: config.penaltyRate,
      penaltyDays: config.penaltyDays,
      compoundingEnabled: config.compoundingEnabled !== undefined ? config.compoundingEnabled : true
    };
    
    try {
      const monthsOverdue = calculateMonthsOverdue(dueDate, asOfDate, penaltyConfig.penaltyDays);
      if (monthsOverdue <= 0) return 0;
      
      // calculatePenaltyForBill expects a bill object and config
      // Create a minimal bill object for the calculation
      const bill = {
        currentCharge: baseAmount,
        paidAmount: 0,
        penaltyAmount: 0,
        dueDate: dueDate,
        lastPenaltyUpdate: null
      };
      
      const penaltyResult = calculatePenaltyForBill({
        bill: bill,
        asOfDate: asOfDate,
        config: penaltyConfig
      });
      
      return penaltyResult.penaltyAmount || 0;
    } catch (error) {
      // Re-throw validation errors, but catch calculation errors
      if (error.message.includes('Missing required field') || error.message.includes('configuration incomplete') || error.message.includes('Configuration missing')) {
        throw error;
      }
      console.error(`Error calculating penalty:`, error);
      throw new Error(`Penalty calculation failed: ${error.message}`);
    }
  }

  /**
   * Get quarter number from month (1-12)
   * @private
   */
  _getQuarterFromMonth(month) {
    if (!month || month < 1 || month > 12) return 1;
    return Math.ceil(month / 3);
  }

  /**
   * Get quarter number from due date (converts calendar month to fiscal month first)
   * @private
   */
  _getQuarterFromDueDate(dueDateStr, fiscalYearStartMonth = 1) {
    const dueDate = this._parseDate(dueDateStr);
    if (!dueDate) return 1;
    const calendarMonth = dueDate.getMonth() + 1; // JavaScript months are 0-based
    const fiscalMonth = calendarToFiscalMonth(calendarMonth, fiscalYearStartMonth);
    return this._getQuarterFromMonth(fiscalMonth);
  }

  /**
   * Get month name from number
   * @private
   */
  _getMonthName(month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || '';
  }

  /**
   * Parse date string or Date object
   * @private
   */
  _parseDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;
    if (typeof dateInput === 'string') {
      const parsed = new Date(dateInput);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (dateInput.toDate && typeof dateInput.toDate === 'function') {
      return dateInput.toDate();
    }
    return null;
  }

  /**
   * Create a Date object for a specific date (year, month, day)
   * Uses Cancun timezone-aware date creation via DateService
   * @param {number} year - Year
   * @param {number} month - Month (0-11, JavaScript convention)
   * @param {number} day - Day (1-31)
   * @returns {Date} JavaScript Date object in Cancun timezone
   * @private
   */
  _createDate(year, month, day) {
    // createCancunDate expects month as 1-12, but we receive 0-11 (JavaScript convention)
    // Convert to 1-based month for Cancun timezone-aware date creation
    return createCancunDate(year, month + 1, day);
  }
  
  /**
   * Normalize a date to midnight Cancun time for date range comparisons
   * This ensures dates are compared at the day level, not including time components
   * Uses Cancun timezone-aware date creation via Luxon
   * @private
   */
  _normalizeDateForComparison(date) {
    if (!date) return null;
    // Parse date using Cancun timezone-aware parser if it's a string
    const d = date instanceof Date ? date : parseCancunDate(date);
    if (!d) return null;
    // Convert to Luxon DateTime in Cancun timezone to extract date components correctly
    const dt = DateTime.fromJSDate(d).setZone('America/Cancun');
    // Extract year, month, day as they appear in Cancun timezone and recreate at midnight Cancun time
    // This ensures consistent day-level comparisons regardless of time components
    return createCancunDate(dt.year, dt.month, dt.day);
  }
}


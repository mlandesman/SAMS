/**
 * StatementService - Statement of Account data aggregation service
 * Extends ReportEngine to aggregate HOA Dues, Water Bills, and Transactions
 */

import { ReportEngine } from './ReportEngine.js';
import { DataAggregator } from './DataAggregator.js';
import StatementDataCollector from './statementDataCollector.js';
import { getNow } from './DateService.js';
import { createDate as createCancunDate, parseDate as parseCancunDate } from '../../shared/services/DateService.js';
import { DateTime } from 'luxon';
import { getDb } from '../firebase.js';
import { centavosToPesos } from '../utils/currencyUtils.js';
import { 
  getFiscalYear, 
  getFiscalYearBounds, 
  validateFiscalYearConfig 
} from '../utils/fiscalYearUtils.js';
import { getCreditBalance } from '../../shared/services/CreditBalanceService.js';
import { getFirstOwnerName } from '../utils/unitContactUtils.js';

export class StatementService extends ReportEngine {
  constructor(clientId) {
    super(clientId, 'statement');
    this.dataAggregator = new DataAggregator();
    this.statementDataCollector = new StatementDataCollector();
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
   * Get client billing configuration including fiscal year settings
   * Checks both config subcollection and client document for backward compatibility
   * Returns format compatible with StatementDataCollector.getClientConfig()
   * @private
   */
  async _getBillingConfig() {
    await this._initializeDb();
    
    // Use StatementDataCollector to get client config (reuses its fast-fail validation)
    // This ensures consistency and avoids duplicate code
    const clientConfig = await this.statementDataCollector.getClientConfig(this.clientId);
    
    // Get Water Bills billing period (not in clientConfig from collector)
    const waterConfigRef = this.db.collection('clients').doc(this.clientId)
      .collection('config').doc('waterBills');
    const waterConfigSnap = await waterConfigRef.get();
    
    const billingPeriod = waterConfigSnap.exists
      ? (waterConfigSnap.data().billingPeriod || 'monthly')
      : 'monthly';
    
    return {
      duesFrequency: clientConfig.duesFrequency,
      billingPeriod,
      fiscalYearStartMonth: clientConfig.fiscalYearStartMonth,
      language: clientConfig.language || 'en-US',
      // Return full clientConfig for use with StatementDataCollector methods
      clientConfig
    };
  }

  /**
   * Get unit information
   * @private
   */
  async _getUnitInfo(unitId) {
    await this._initializeDb();
    
    const unitDoc = await this.db.collection('clients').doc(this.clientId)
      .collection('units').doc(unitId).get();
    
    if (!unitDoc.exists) {
      throw new Error(`Unit not found: ${unitId}`);
    }
    
    const unitData = unitDoc.data();
    
    return {
      unitId: unitId,
      unitNumber: unitData.unitNumber || unitId,
      ownerName: getFirstOwnerName(unitData.owners) || 'N/A'
    };
  }

  /**
   * Main method to aggregate complete statement data
   * @param {string} unitId - Unit ID
   * @param {string} userId - User ID (for language preference)
   * @param {Object} dateRange - { start: Date, end: Date }
   * @param {Object} options - { includeWaterBills: boolean, includeHoaDues: boolean }
   * @returns {Promise<Object>} Complete statement data structure
   */
  async aggregateStatementData(unitId, userId, dateRange, options = {}) {
    const {
      includeWaterBills = true,
      includeHoaDues = true
    } = options;
    
    // Get billing configuration (includes clientConfig for StatementDataCollector)
    const config = await this._getBillingConfig();
    const clientConfig = config.clientConfig;
    
    // Get unit info
    const unitInfo = await this._getUnitInfo(unitId);
    
    // Get user profile for language preference
    const userProfile = await this.getUserProfile(userId);
    
    // Get client info
    const clientInfo = await this.getClientInfo();
    
    // Get HOA and Water billing configs for penalty calculation - REQUIRED, fail fast if missing
    const hoaConfigDoc = await this.db.collection('clients').doc(this.clientId)
      .collection('config').doc('hoaDues').get();
    
    if (!hoaConfigDoc.exists) {
      throw new Error(`HOA Dues configuration not found for client ${this.clientId}. Cannot generate statements without configuration. Please create config document at clients/${this.clientId}/config/hoaDues`);
    }
    
    const hoaConfig = hoaConfigDoc.data();
    
    // Validate required penalty fields - fail fast if missing
    if (hoaConfig.penaltyRate === undefined || hoaConfig.penaltyRate === null) {
      throw new Error(`HOA Dues configuration incomplete for client ${this.clientId}. Missing required field: penaltyRate. Cannot calculate penalties without this value.`);
    }
    
    if (hoaConfig.penaltyDays === undefined || hoaConfig.penaltyDays === null) {
      throw new Error(`HOA Dues configuration incomplete for client ${this.clientId}. Missing required field: penaltyDays. Cannot calculate penalties without this value.`);
    }
    
    // Get Water billing config only if water bills are included
    // Match original test harness: try to load config, but don't fail if it doesn't exist
    // collectPenalties will handle missing water config gracefully
    let waterConfig = null;
    if (includeWaterBills) {
      try {
        const waterConfigDoc = await this.db.collection('clients').doc(this.clientId)
          .collection('config').doc('waterBills').get();
        
        if (waterConfigDoc.exists) {
          waterConfig = waterConfigDoc.data();
          
          // Only validate if config exists
          if (waterConfig.penaltyDays === undefined || waterConfig.penaltyDays === null) {
            throw new Error(`Water Bills configuration incomplete for client ${this.clientId}. Missing required field: penaltyDays.`);
          }
        }
        // If config doesn't exist, waterConfig remains null - collectPenalties will skip water penalties
      } catch (error) {
        // If error loading config, log but don't fail - allow statement generation without water penalties
        console.warn(`Could not load water billing config for ${this.clientId}:`, error.message);
        waterConfig = null;
      }
    }
    
    // Determine fiscal year(s) from dateRange
    const startFiscalYear = getFiscalYear(dateRange.start, config.fiscalYearStartMonth);
    const endFiscalYear = getFiscalYear(dateRange.end, config.fiscalYearStartMonth);
    
    // Collect data using StatementDataCollector for fiscal year-based collection
    // This uses the validated patterns from the test harness
    const fiscalYearBounds = getFiscalYearBounds(endFiscalYear, config.fiscalYearStartMonth);
    const asOfDate = dateRange.end <= fiscalYearBounds.endDate ? dateRange.end : fiscalYearBounds.endDate;
    
    // Collect data for the fiscal year(s) in the date range
    console.log(`[StatementService] aggregateStatementData: ${this.clientId}/${unitId}, includeHoaDues: ${includeHoaDues}, includeWaterBills: ${includeWaterBills}, fiscalYear: ${endFiscalYear}`);
    
    const hoaDuesData = includeHoaDues
      ? await this.statementDataCollector.collectHOADues(this.clientId, unitId, endFiscalYear, clientConfig)
      : null;
    
    const waterBillsData = includeWaterBills
      ? await this.statementDataCollector.collectWaterBills(this.clientId, unitId, endFiscalYear, clientConfig)
      : [];
    
    // Collect penalties using unified preview API
    const { hoaPenalties, waterPenalties } = await this.statementDataCollector.collectPenalties(
      this.clientId,
      unitId,
      endFiscalYear,
      asOfDate,
      clientConfig,
      hoaConfig,
      waterConfig
    );
    
    // Transform collector data into chronological transaction list format
    // This matches the test harness output structure
    const hoaDuesTransactions = includeHoaDues && hoaDuesData
      ? await this._transformCollectorDataToTransactions(hoaDuesData, waterBillsData, hoaPenalties, waterPenalties, config)
      : [];
    
    const waterBillsTransactions = includeWaterBills
      ? await this._transformWaterBillsToTransactions(waterBillsData, waterPenalties, config)
      : [];
    
    const generalTransactions = await this.aggregateTransactions(unitId, dateRange);
    
    // Merge and sort all transactions
    const allTransactions = this.dataAggregator.mergeTransactionLists(
      hoaDuesTransactions,
      waterBillsTransactions,
      generalTransactions
    );
    
    // CRITICAL: Filter to be backwards-looking (Statement of Account requirement)
    // Only include bills/transactions with due dates <= TODAY (not future bills)
    // This filtering is Statement of Account-specific - other reports can use unfiltered data
    const today = getNow();
    const filteredTransactions = this._filterBackwardsLooking(allTransactions, today);
    
    // Calculate running balances
    const transactionsWithBalances = this.calculateRunningBalance(filteredTransactions);
    
    // Load credit balance using StatementDataCollector (matches test harness pattern)
    let creditBalanceData;
    try {
      const creditData = await this.statementDataCollector.collectCreditBalance(this.clientId, unitId);
      creditBalanceData = {
        creditBalance: creditData.creditBalance,
        creditBalanceHistory: []
      };
    } catch (error) {
      console.error(`Error loading credit balance for ${this.clientId}/${unitId}:`, error);
      creditBalanceData = { creditBalance: 0, creditBalanceHistory: [] };
    }
    
    // Separate transactions by category
    const hoaDuesFiltered = transactionsWithBalances.filter(tx => tx.category === 'HOA Dues');
    const waterBillsFiltered = transactionsWithBalances.filter(tx => tx.category === 'Water Bills');
    
    // Calculate section subtotals
    const hoaDuesSubtotals = this.dataAggregator.calculateSectionSubtotals(
      transactionsWithBalances,
      'HOA Dues'
    );
    
    const waterBillsSubtotals = this.dataAggregator.calculateSectionSubtotals(
      transactionsWithBalances,
      'Water Bills'
    );
    
    // Calculate summary statistics (pass credit balance from Firestore)
    const summary = this._calculateSummary(transactionsWithBalances, creditBalanceData.creditBalance);
    
    // Generate unique report ID
    const reportId = `statement_${this.clientId}_${unitId}_${Date.now()}`;
    
    return {
      success: true,
      reportId: reportId,
      data: {
        unit: unitInfo,
        statementPeriod: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString()
        },
        language: userProfile.preferredLanguage || 'english',
        hoaDues: {
          transactions: hoaDuesFiltered,
          subtotal: hoaDuesSubtotals.subtotal,
          penaltySubtotal: hoaDuesSubtotals.penaltySubtotal,
          runningBalance: hoaDuesSubtotals.runningBalance
        },
        waterBills: {
          transactions: waterBillsFiltered,
          subtotal: waterBillsSubtotals.subtotal,
          penaltySubtotal: waterBillsSubtotals.penaltySubtotal,
          runningBalance: waterBillsSubtotals.runningBalance
        },
        summary: summary
      },
      generatedAt: getNow().toISOString()
    };
  }

  /**
   * Aggregate HOA Dues data for a unit
   * @param {string} unitId - Unit ID
   * @param {Object} dateRange - { start: Date, end: Date }
   * @param {string} duesFrequency - 'monthly' or 'quarterly'
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
   * @returns {Promise<Array>} HOA Dues transactions
   */
  async aggregateHoaDuesData(unitId, dateRange, duesFrequency, fiscalYearStartMonth = 1, hoaConfig = null) {
    return await this.dataAggregator.collectHoaDuesData(
      this.clientId,
      unitId,
      dateRange.start,
      dateRange.end,
      duesFrequency,
      fiscalYearStartMonth,
      hoaConfig
    );
  }

  /**
   * Aggregate Water Bills data for a unit
   * @param {string} unitId - Unit ID
   * @param {Object} dateRange - { start: Date, end: Date }
   * @param {string} billingPeriod - 'monthly' or 'quarterly'
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
   * @returns {Promise<Array>} Water Bills transactions
   */
  async aggregateWaterBillsData(unitId, dateRange, billingPeriod, fiscalYearStartMonth = 1) {
    return await this.dataAggregator.collectWaterBillsData(
      this.clientId,
      unitId,
      dateRange.start,
      dateRange.end,
      billingPeriod,
      fiscalYearStartMonth
    );
  }

  /**
   * Aggregate transactions for a unit
   * @param {string} unitId - Unit ID
   * @param {Object} dateRange - { start: Date, end: Date }
   * @returns {Promise<Array>} Transaction records
   */
  async aggregateTransactions(unitId, dateRange) {
    return await this.dataAggregator.collectTransactions(
      this.clientId,
      unitId,
      dateRange.start,
      dateRange.end
    );
  }

  /**
   * Calculate running balance for transaction list
   * @param {Array} transactions - Transactions array
   * @returns {Array} Transactions with running balances
   */
  calculateRunningBalance(transactions) {
    let runningBalance = 0;
    
    return transactions.map((tx, index) => {
      // Store balance before this transaction for debugging
      const balanceBefore = runningBalance;
      
      // Add charges, subtract payments
      runningBalance += tx.amount;
      runningBalance += tx.penalty;
      runningBalance -= tx.payments;
      
      // Debug logging for first few transactions and any with unexpected balances
      if (index < 5 || Math.abs(runningBalance) > 100000) {
        console.log(`[BALANCE CALC] ${index}: ${tx.category} ${tx.description || ''}`, {
          date: tx.date,
          amount: tx.amount,
          penalty: tx.penalty,
          payments: tx.payments,
          balanceBefore: balanceBefore,
          balanceAfter: runningBalance
        });
      }
      
      return {
        ...tx,
        balance: Math.round(runningBalance * 100) / 100 // Round to 2 decimals
      };
    });
  }

  /**
   * Filter transactions to be strictly backwards-looking (Statement of Account requirement)
   * Only includes bills/transactions with due dates <= cutoff date (typically TODAY)
   * Excludes future-dated bills that aren't due yet
   * @param {Array} transactions - Array of transaction objects
   * @param {Date} cutoffDate - Cutoff date (typically TODAY) - only transactions <= this date
   * @returns {Array} Filtered transactions (backwards-looking only)
   * @private
   */
  _filterBackwardsLooking(transactions, cutoffDate) {
    // Normalize cutoff date to midnight Cancun time for consistent comparison
    const normalizedCutoffDate = this._normalizeDateForComparison(cutoffDate);
    
    return transactions.filter(tx => {
      // Normalize transaction date (due date for bills) for comparison
      const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
      const normalizedTxDate = this._normalizeDateForComparison(txDate);
      
      // Only include transactions/bills on or before cutoff date (exclude future bills)
      return normalizedTxDate <= normalizedCutoffDate;
    });
  }

  /**
   * Normalize date for comparison (extract date components in Cancun timezone)
   * Reuses logic from DataAggregator for consistency
   * @param {Date|string} date - Date to normalize
   * @returns {Date|null} Normalized date at midnight Cancun time
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

  /**
   * Calculate summary statistics
   * @param {Array} transactions - Array of transactions with balances
   * @param {number} creditBalanceFromFirestore - Credit balance loaded from Firestore (in pesos)
   * @private
   */
  _calculateSummary(transactions, creditBalanceFromFirestore = 0) {
    const currentDate = getNow();
    
    // Get final balance from last transaction (if any)
    const finalBalance = transactions.length > 0 
      ? (transactions[transactions.length - 1].balance || 0)
      : 0;
    
    const paidItems = { count: 0, total: 0 };
    const pastDueItems = { count: 0, total: 0, penaltyTotal: 0 };
    const comingDueItems = { count: 0, total: 0 };
    
    // Track unique bills to avoid double-counting
    const processedBills = new Set();
    
    transactions.forEach(tx => {
      // Determine item status
      // Only count charges, not payments (payments have type === 'payment')
      if (tx.type === 'payment' && tx.payments > 0) {
        paidItems.count++;
        paidItems.total += tx.payments;
      } else if (!tx.type || tx.type !== 'payment') {
        // This is a charge (HOA Dues or Water Bills)
        const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
        const txBalance = tx.balance || 0;
        
        // Create unique key for this bill to avoid double-counting
        const billKey = `${tx.category}_${tx.date}_${tx.description}`;
        
        if (txDate < currentDate && txBalance > 0 && !processedBills.has(billKey)) {
          pastDueItems.count++;
          pastDueItems.total += tx.amount;
          pastDueItems.penaltyTotal += tx.penalty || 0;
          processedBills.add(billKey);
        } else if (txDate >= currentDate && txBalance > 0 && !processedBills.has(billKey)) {
          comingDueItems.count++;
          comingDueItems.total += tx.amount;
          processedBills.add(billKey);
        }
      }
    });
    
    return {
      totalBalance: Math.round(finalBalance * 100) / 100,
      creditBalance: Math.round(creditBalanceFromFirestore * 100) / 100,
      paidItems: {
        count: paidItems.count,
        total: Math.round(paidItems.total * 100) / 100
      },
      pastDueItems: {
        count: pastDueItems.count,
        total: Math.round(pastDueItems.total * 100) / 100,
        penaltyTotal: Math.round(pastDueItems.penaltyTotal * 100) / 100
      },
      comingDueItems: {
        count: comingDueItems.count,
        total: Math.round(comingDueItems.total * 100) / 100
      }
    };
  }

  /**
   * Transform StatementDataCollector output to transaction format
   * Converts collector's raw data structures into chronological transaction list
   * Matches the test harness createChronologicalTransactionList pattern
   * @private
   */
  async _transformCollectorDataToTransactions(hoaDuesData, waterBillsData, hoaPenalties, waterPenalties, config) {
    const transactions = [];
    const transactionMap = new Map();
    
    // Build transaction map from collector's transactions
    // Filter out null/undefined transactions and those without transactionId
    for (const txn of hoaDuesData.transactions || []) {
      if (txn && txn.transactionId) {
        transactionMap.set(txn.transactionId, txn);
      }
    }
    
    // Add HOA charges and payments (similar to test harness pattern)
    // Filter out null/undefined payments to match original test harness pattern
    const payments = (hoaDuesData.payments || []).filter(p => p != null);
    const scheduledAmount = hoaDuesData.scheduledAmount || 0;
    const duesFrequency = config.duesFrequency;
    
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
        
        for (const monthNum of quarter.months) {
          const payment = payments.find(p => p && p.month === monthNum);
          if (payment && payment.dueDate) {
            const dueDate = payment.dueDate?.toDate ? payment.dueDate.toDate() : parseCancunDate(payment.dueDate);
            if (!quarterDueDate && !isNaN(dueDate.getTime())) {
              quarterDueDate = dueDate;
            }
            quarterAmount += payment.amount || 0;
          }
        }
        
        // If no dueDate found in payment data, calculate it from fiscal year
        // This handles unpaid quarters that don't have dueDate set yet
        if (!quarterDueDate) {
          const fiscalYear = hoaDuesData.fiscalYear;
          const fiscalYearStartMonth = config.fiscalYearStartMonth || 7;
          // Calculate quarter due date using fiscal year utilities
          // Q1 = months 1-3 (fiscal months 0-2), Q2 = months 4-6 (fiscal months 3-5), etc.
          const fiscalMonthIndex = (quarter.months[0] - 1); // Convert to 0-based fiscal month
          const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
          const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
          
          // Create date for 1st of the calendar month
          quarterDueDate = new Date(calendarYear, calendarMonth, 1);
        }
        
        // Calculate quarter charge amount
        const quarterChargeAmount = scheduledAmount * 3;
        
        if (quarterDueDate && !isNaN(quarterDueDate.getTime())) {
          transactions.push({
            type: 'charge',
            date: quarterDueDate,
            description: `HOA Dues ${quarter.name}`,
            amount: quarterChargeAmount,
            penalty: 0,
            payments: 0,
            category: 'HOA Dues',
            categoryId: 'hoa-dues'
          });
        }
        
        // Add payments for this quarter
        const quarterTransactionIds = new Set();
        for (const monthNum of quarter.months) {
          const payment = payments.find(p => p && p.month === monthNum);
          if (payment && payment.paid && payment.amount > 0) {
            const txnId = payment.transactionId || payment.reference;
            if (txnId && txnId !== '-' && !quarterTransactionIds.has(txnId)) {
              quarterTransactionIds.add(txnId);
              const transaction = transactionMap.get(txnId);
              const paymentDate = payment.date?.toDate ? payment.date.toDate() : parseCancunDate(payment.date);
              
              if (paymentDate && !isNaN(paymentDate.getTime())) {
                const paymentAmount = transaction 
                  ? centavosToPesos(transaction.amount || 0)
                  : (payment.amount || 0);
                
                transactions.push({
                  type: 'payment',
                  date: paymentDate,
                  description: `Payment ${quarter.name}`,
                  amount: 0,
                  penalty: 0,
                  payments: paymentAmount,
                  category: 'HOA Dues',
                  categoryId: 'hoa-dues',
                  transactionId: txnId
                });
              }
            }
          }
        }
      }
    } else {
      // Monthly billing
      const monthlyTransactionIds = new Set();
      
      for (const payment of payments) {
        // Skip null/undefined payments
        if (!payment || !payment.month) continue;
        
        // Add charge
        let dueDate = null;
        if (payment.dueDate) {
          dueDate = payment.dueDate?.toDate ? payment.dueDate.toDate() : parseCancunDate(payment.dueDate);
        }
        
        // If no dueDate found in payment data, calculate it from fiscal year
        // This handles unpaid months that don't have dueDate set yet
        if (!dueDate || isNaN(dueDate.getTime())) {
          const fiscalYear = hoaDuesData.fiscalYear;
          const fiscalYearStartMonth = config.fiscalYearStartMonth || 7;
          // Calculate month due date using fiscal year utilities
          const fiscalMonthIndex = payment.month - 1; // Convert to 0-based fiscal month
          const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
          const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
          
          // Create date for 1st of the calendar month
          dueDate = new Date(calendarYear, calendarMonth, 1);
        }
        
        if (dueDate && !isNaN(dueDate.getTime())) {
          transactions.push({
            type: 'charge',
            date: dueDate,
            description: `HOA Dues Month ${payment.month}`,
            amount: scheduledAmount,
            penalty: 0,
            payments: 0,
            category: 'HOA Dues',
            categoryId: 'hoa-dues',
            month: payment.month
          });
        }
        
        // Add payment
        if (payment.paid || payment.amount > 0) {
          const txnId = payment.transactionId || payment.reference;
          if (txnId && txnId !== '-' && !monthlyTransactionIds.has(txnId)) {
            monthlyTransactionIds.add(txnId);
            const transaction = transactionMap.get(txnId);
            const paymentDate = payment.date?.toDate ? payment.date.toDate() : new Date(payment.date);
            
            if (paymentDate && !isNaN(paymentDate.getTime())) {
              const paymentAmount = transaction 
                ? centavosToPesos(transaction.amount || 0)
                : (payment.amount || 0);
              
              transactions.push({
                type: 'payment',
                date: paymentDate,
                description: `Payment Month ${payment.month}`,
                amount: 0,
                penalty: 0,
                payments: paymentAmount,
                category: 'HOA Dues',
                categoryId: 'hoa-dues',
                transactionId: txnId,
                month: payment.month
              });
            }
          }
        }
      }
    }
    
    // NOTE: Water bills are NOT added here - they are handled separately by _transformWaterBillsToTransactions
    // to avoid duplication. Water bills are merged later in aggregateStatementData.
    
    // Add penalties (filter out null/undefined penalties to match original test harness pattern)
    transactions.push(...(hoaPenalties || []).filter(p => p != null).map(p => ({
      ...p,
      category: 'HOA Dues',
      categoryId: 'hoa-penalties',
      payments: 0
    })));
    
    transactions.push(...(waterPenalties || []).filter(p => p != null).map(p => ({
      ...p,
      category: 'Water Bills',
      categoryId: 'water-penalties',
      payments: 0
    })));
    
    // Sort chronologically
    transactions.sort((a, b) => {
      const dateA = a.date.getTime();
      const dateB = b.date.getTime();
      if (dateA !== dateB) return dateA - dateB;
      // Charges before payments, penalties after regular charges
      if (a.type === 'penalty' && b.type !== 'penalty') return 1;
      if (a.type !== 'penalty' && b.type === 'penalty') return -1;
      if (a.type === 'charge' && b.type === 'payment') return -1;
      if (a.type === 'payment' && b.type === 'charge') return 1;
      return 0;
    });
    
    return transactions;
  }

  /**
   * Transform water bills data to transaction format
   * @private
   */
  async _transformWaterBillsToTransactions(waterBillsData, waterPenalties, config) {
    const transactions = [];
    const processedBillIds = new Set(); // Track processed bills to prevent duplicates
    
    for (const bill of (waterBillsData || []).filter(b => b != null)) {
      if (!bill.billId) {
        console.warn(`[StatementService] Water bill missing billId, skipping:`, bill);
        continue;
      }
      
      // Skip if this bill was already processed (deduplication)
      if (processedBillIds.has(bill.billId)) {
        console.warn(`[StatementService] Duplicate water bill detected (billId: ${bill.billId}), skipping duplicate`);
        continue;
      }
      
      if (bill.totalAmount > 0) {
        const dueDate = bill.dueDate?.toDate ? bill.dueDate.toDate() : parseCancunDate(bill.dueDate);
        if (dueDate && !isNaN(dueDate.getTime())) {
          const quarterName = bill.fiscalQuarter ? `Q${bill.fiscalQuarter}` : '';
          const monthName = dueDate.toLocaleString(config.language || 'en-US', { month: 'short' });
          const description = quarterName 
            ? `Water Bill ${quarterName} ${bill.year}` 
            : `Water Bill ${monthName} ${bill.year}`;
          
          transactions.push({
            type: 'charge',
            category: 'Water Bills',
            categoryId: 'water-consumption',
            date: dueDate,
            description: description,
            amount: bill.totalAmount,
            penalty: bill.penaltyAmount || 0,
            payments: bill.paidAmount || 0,
            billId: bill.billId,
            consumption: bill.consumption
          });
          
          // Mark this bill as processed
          processedBillIds.add(bill.billId);
        }
      }
    }
    
    // Add water penalties
    transactions.push(...waterPenalties.map(p => ({
      ...p,
      category: 'Water Bills',
      categoryId: 'water-penalties',
      payments: 0
    })));
    
    return transactions;
  }

  /**
   * Generate plain text statement
   * @param {string} unitId - Unit ID
   * @param {string} userId - User ID
   * @param {Object} dateRange - { start: Date, end: Date }
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Plain text statement
   */
  async generatePlainTextStatement(unitId, userId, dateRange, options = {}) {
    // 1. Aggregate statement data (reuses existing method with backwards-looking filtering)
    const statementData = await this.aggregateStatementData(unitId, userId, dateRange, options);
    
    // 2. Get user profile (for language) - already fetched in aggregateStatementData, but need full object
    const userProfile = await this.getUserProfile(userId);
    
    // 3. Get client info (for banking details) - already fetched in aggregateStatementData, but need full object
    const clientInfo = await this.getClientInfo();
    
    // 4. Use unit info from statementData (already fetched in aggregateStatementData)
    const unitInfo = statementData.data.unit;
    
    // 5. Generate plain text
    const { StatementTextGenerator } = await import('./StatementTextGenerator.js');
    const generator = new StatementTextGenerator();
    
    return generator.generatePlainText(statementData, userProfile, clientInfo, unitInfo);
  }
}


/**
 * StatementService - Statement of Account data aggregation service
 * Extends ReportEngine to aggregate HOA Dues, Water Bills, and Transactions
 */

import { ReportEngine } from './ReportEngine.js';
import { DataAggregator } from './DataAggregator.js';
import { getNow } from './DateService.js';
import { getDb } from '../firebase.js';
import { centavosToPesos } from '../utils/currencyUtils.js';
import { 
  getFiscalYear, 
  getFiscalYearBounds, 
  validateFiscalYearConfig 
} from '../utils/fiscalYearUtils.js';
import { getCreditBalance } from '../../shared/services/CreditBalanceService.js';

export class StatementService extends ReportEngine {
  constructor(clientId) {
    super(clientId, 'statement');
    this.dataAggregator = new DataAggregator();
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
   * @private
   */
  async _getBillingConfig() {
    await this._initializeDb();
    
    // Get client document for fiscal year config
    const clientDoc = await this.db.collection('clients').doc(this.clientId).get();
    let clientData = {};
    if (clientDoc.exists) {
      clientData = clientDoc.data();
    }
    
    // Get fiscal year start month (defaults to 1 for calendar year)
    const fiscalYearStartMonth = validateFiscalYearConfig({
      configuration: {
        fiscalYearStartMonth: clientData.configuration?.fiscalYearStartMonth || 1
      }
    });
    
    // Check HOA Dues config subcollection first
    const hoaConfigRef = this.db.collection('clients').doc(this.clientId)
      .collection('config').doc('hoaDues');
    const hoaConfigSnap = await hoaConfigRef.get();
    
    let duesFrequency = 'monthly';
    if (hoaConfigSnap.exists) {
      const hoaConfigData = hoaConfigSnap.data();
      duesFrequency = hoaConfigData.duesFrequency || 
                     clientData.feeStructure?.duesFrequency ||
                     clientData.configuration?.feeStructure?.duesFrequency ||
                     clientData.configuration?.duesFrequency ||
                     'monthly';
    } else {
      // Fallback to client document (backward compatibility)
      duesFrequency = clientData.feeStructure?.duesFrequency ||
                     clientData.configuration?.feeStructure?.duesFrequency ||
                     clientData.configuration?.duesFrequency ||
                     'monthly';
    }
    
    // Check Water Bills config subcollection
    const waterConfigRef = this.db.collection('clients').doc(this.clientId)
      .collection('config').doc('waterBills');
    const waterConfigSnap = await waterConfigRef.get();
    
    const billingPeriod = waterConfigSnap.exists
      ? (waterConfigSnap.data().billingPeriod || 'monthly')
      : 'monthly';
    
    return {
      duesFrequency,
      billingPeriod,
      fiscalYearStartMonth
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
      ownerName: unitData.owners?.[0] || 'N/A'
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
    
    // Get billing configuration
    const config = await this._getBillingConfig();
    
    // Get unit info
    const unitInfo = await this._getUnitInfo(unitId);
    
    // Get user profile for language preference
    const userProfile = await this.getUserProfile(userId);
    
    // Get client info
    const clientInfo = await this.getClientInfo();
    
    // Get HOA config for penalty calculation - REQUIRED, fail fast if missing
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
    
    // Collect data from all sources (pass fiscal year config and HOA config)
    const hoaDuesTransactions = includeHoaDues
      ? await this.aggregateHoaDuesData(unitId, dateRange, config.duesFrequency, config.fiscalYearStartMonth, hoaConfig)
      : [];
    
    const waterBillsTransactions = includeWaterBills
      ? await this.aggregateWaterBillsData(unitId, dateRange, config.billingPeriod, config.fiscalYearStartMonth)
      : [];
    
    const generalTransactions = await this.aggregateTransactions(unitId, dateRange);
    
    // Merge and sort all transactions
    const allTransactions = this.dataAggregator.mergeTransactionLists(
      hoaDuesTransactions,
      waterBillsTransactions,
      generalTransactions
    );
    
    // Calculate running balances
    const transactionsWithBalances = this.calculateRunningBalance(allTransactions);
    
    // Load credit balance from Firestore
    let creditBalanceData;
    try {
      creditBalanceData = await getCreditBalance(this.clientId, unitId);
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
}


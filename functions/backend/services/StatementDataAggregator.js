/**
 * StatementDataAggregator - Transaction-driven data collection for Statement of Account
 * 
 * This service collects Statement of Account data using a transaction-driven approach:
 * 1. Collects paid items from transaction allocations (source of truth)
 * 2. Collects unpaid items from module queries (reconciled against allocations)
 * 3. Returns structured data ready for statement generation
 * 
 * Architecture:
 * - Primary: Query transactions for unit + fiscal period, expand allocations[]
 * - Secondary: Query modules ONLY to find bills without matching allocations
 * - Reconciliation: Use allocation reference map to identify paid vs unpaid
 */

import { getDb } from '../firebase.js';
import { getNow } from './DateService.js';
import { createDate as createCancunDate, parseDate as parseCancunDate } from '../../shared/services/DateService.js';
import { DateTime } from 'luxon';
import { centavosToPesos } from '../utils/currencyUtils.js';
import { 
  getFiscalYear, 
  getFiscalYearBounds,
  fiscalToCalendarMonth,
  calendarToFiscalMonth
} from '../utils/fiscalYearUtils.js';
import { calculatePenaltyForBill, calculateMonthsOverdue } from '../../shared/services/PenaltyRecalculationService.js';
import waterBillsService from './waterBillsService.js';

export class StatementDataAggregator {
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
   * Parse date from various formats (Firestore Timestamp, Date, string)
   * @private
   */
  _parseDate(date) {
    if (!date) return null;
    
    if (date && typeof date.toDate === 'function') {
      // Firestore Timestamp
      return date.toDate();
    } else if (date instanceof Date) {
      return date;
    } else if (typeof date === 'string') {
      return parseCancunDate(date);
    }
    
    return null;
  }

  /**
   * Normalize date for comparison (set to start of day in Cancun timezone)
   * @private
   */
  _normalizeDateForComparison(date) {
    if (!date) return null;
    
    const dt = DateTime.fromJSDate(date).setZone('America/Cancun');
    return dt.startOf('day').toJSDate();
  }

  /**
   * Main aggregation method that orchestrates paid and unpaid item collection
   * 
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Object} dateRange - Statement period (backwards-looking)
   * @param {Date} dateRange.start - Start date
   * @param {Date} dateRange.end - End date (statement end date)
   * @param {Object} billingConfig - Billing configuration
   * @param {string} billingConfig.duesFrequency - 'monthly' | 'quarterly'
   * @param {string} billingConfig.billingPeriod - 'monthly' | 'quarterly'
   * @param {number} billingConfig.fiscalYearStartMonth - Fiscal year start month (1-12)
   * @returns {Promise<Object>} Statement data with paidItems, unpaidItems, and summary
   */
  async collectStatementData(clientId, unitId, dateRange, billingConfig) {
    // 1. Collect paid items from transactions (expand allocations)
    const paidItems = await this._collectPaidItemsFromTransactions(
      clientId, 
      unitId, 
      dateRange,
      billingConfig
    );
    
    // 2. Build reference map of paid bills (for reconciliation)
    const paidItemReferences = this._buildAllocationReferenceMap(paidItems);
    
    // 3. Collect unpaid items from modules (reconciled against paid references)
    const unpaidItems = await this._collectUnpaidItemsFromModules(
      clientId,
      unitId,
      dateRange,
      billingConfig,
      paidItemReferences
    );
    
    // 4. Calculate summary statistics
    const summary = {
      totalPaid: paidItems.reduce((sum, item) => sum + (item.payment || 0), 0),
      totalUnpaid: unpaidItems.reduce((sum, item) => sum + item.amount, 0),
      paidItemCount: paidItems.length,
      unpaidItemCount: unpaidItems.length
    };
    
    return { paidItems, unpaidItems, summary };
  }

  /**
   * Query transactions and expand allocations[] into statement line items
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Object} dateRange - Statement period
   * @param {Object} billingConfig - Billing configuration
   * @returns {Promise<Array>} Array of paid statement line items (from allocations)
   */
  async _collectPaidItemsFromTransactions(clientId, unitId, dateRange, billingConfig) {
    await this._initializeDb();
    
    // Normalize end date for comparison (backwards-looking filter)
    const statementEndDate = this._normalizeDateForComparison(dateRange.end);
    
    const transactionsRef = this.db.collection('clients').doc(clientId)
      .collection('transactions');
    
    const transactionDocsMap = new Map();
    const addDocsFromSnapshot = (snapshot) => {
      if (!snapshot || !snapshot.docs) {
        return;
      }
      snapshot.docs.forEach(doc => transactionDocsMap.set(doc.id, doc));
    };
    
    // Exact unitId match
    const exactUnitSnapshot = await transactionsRef.where('unitId', '==', unitId).get();
    addDocsFromSnapshot(exactUnitSnapshot);
    
    // UnitId prefix matches (handles "101 (Zerbarini)" style strings)
    try {
      const prefixSnapshot = await transactionsRef
        .orderBy('unitId')
        .startAt(unitId)
        .endAt(`${unitId}\uf8ff`)
        .get();
      addDocsFromSnapshot(prefixSnapshot);
    } catch (error) {
      console.warn(`[StatementDataAggregator] Prefix unitId query failed for ${clientId}/${unitId}: ${error.message}`);
    }
    
    // Legacy 'unit' field match
    const legacySnapshot = await transactionsRef.where('unit', '==', unitId).get();
    addDocsFromSnapshot(legacySnapshot);
    
    let transactionDocs = Array.from(transactionDocsMap.values());
    
    // Final fallback: scan collection for "unitId starts with `${unitId} `"
    if (transactionDocs.length === 0) {
      const allTransactions = await transactionsRef.get();
      const matchingDocs = allTransactions.docs.filter(doc => {
        const tx = doc.data();
        const txUnitId = tx.unitId || tx.unit;
        if (!txUnitId) {
          return false;
        }
        const txUnitIdStr = txUnitId.toString();
        return txUnitIdStr === unitId || txUnitIdStr.startsWith(`${unitId} `);
      });
      matchingDocs.forEach(doc => transactionDocsMap.set(doc.id, doc));
      transactionDocs = Array.from(transactionDocsMap.values());
    }
    
    const paidItems = [];
    
    transactionDocs.forEach(doc => {
      const transaction = doc.data();
      transaction.__docId = doc.id;
      const txDate = this._parseDate(transaction.date);
      
      if (!txDate) {
        return; // Skip transactions without valid dates
      }
      
      // CRITICAL: Backwards-looking filter - only transactions up to statement end date
      const normalizedTxDate = this._normalizeDateForComparison(txDate);
      if (normalizedTxDate > statementEndDate) {
        return; // Skip future transactions
      }
      
      // Expand allocations into statement line items
      if (transaction.allocations && Array.isArray(transaction.allocations) && transaction.allocations.length > 0) {
        transaction.allocations.forEach(allocation => {
          // Only include allocations for HOA Dues and Water Bills (skip credit-only)
          // Note: System uses both "hoa_dues" (underscore) and "hoa-dues" (hyphen)
          if (allocation.categoryId === 'hoa-dues' || 
              allocation.categoryId === 'hoa_dues' ||
              allocation.categoryId === 'hoa-penalties' ||
              allocation.categoryId === 'hoa_penalties' ||
              allocation.categoryId === 'water-consumption' || 
              allocation.categoryId === 'water-penalties') {
            
            const lineItem = this._expandAllocationToLineItem(
              transaction,
              allocation,
              dateRange,
              billingConfig
            );
            
            if (lineItem) {
              paidItems.push(lineItem);
            }
          }
        });
      }
    });
    
    return this._groupQuarterlyHoaPaidItems(paidItems, billingConfig);
  }

  /**
   * Convert single allocation into statement line item format
   * 
   * @private
   * @param {Object} transaction - Transaction document
   * @param {Object} allocation - Allocation object from transaction
   * @param {Object} dateRange - Statement period
   * @param {Object} billingConfig - Billing configuration
   * @returns {Object|null} StatementLineItem object or null (if filtered out)
   */
  _expandAllocationToLineItem(transaction, allocation, dateRange, billingConfig) {
    // Extract allocation amount (ALWAYS convert from centavos to pesos)
    // All amounts in Firestore are stored as integers in centavos
    const allocationAmount = Math.abs(allocation.amount || 0);
    const amountInPesos = centavosToPesos(allocationAmount);
    
    // Transaction date (actual payment date)
    const txDate = this._parseDate(transaction.date);
    if (!txDate) {
      return null;
    }
    
    // Extract bill reference from allocation.data
    let billReference = null;
    const allocationData = allocation.data || {};
    
    // Normalize categoryId - system uses both underscore and hyphen variants
    const normalizedCategoryId = (() => {
      if (allocation.categoryId === 'hoa_dues' || allocation.categoryId === 'hoa-dues') {
        return 'hoa-dues';
      }
      if (allocation.categoryId === 'hoa_penalties' || allocation.categoryId === 'hoa-penalties') {
        return 'hoa-penalties';
      }
      return allocation.categoryId;
    })();
    const isHoaCategory = normalizedCategoryId === 'hoa-dues' || normalizedCategoryId === 'hoa-penalties';
    
    if (isHoaCategory) {
      // HOA Dues: Build reference from month/quarter/year
      if (allocationData.quarter !== undefined) {
        const quarter = allocationData.quarter + 1; // Convert 0-3 to 1-4
        billReference = `Q${quarter}_${allocationData.year}`;
      } else if (allocationData.month !== undefined) {
        const fiscalMonth = allocationData.month + 1; // Convert 0-11 to 1-12
        
        // For quarterly billing, convert months to quarters
        // Q1 = months 1-3, Q2 = months 4-6, Q3 = months 7-9, Q4 = months 10-12
        const duesFrequency = billingConfig?.duesFrequency || 'monthly';
        if (duesFrequency === 'quarterly') {
          const quarter = Math.ceil(fiscalMonth / 3); // Q1=1, Q2=2, Q3=3, Q4=4
          billReference = `Q${quarter}_${allocationData.year}`;
        } else {
          // Monthly billing: use month format
          billReference = `${allocationData.year}-${String(fiscalMonth).padStart(2, '0')}`;
        }
      }
    } else if (allocation.categoryId === 'water-consumption' || allocation.categoryId === 'water-penalties') {
      // Water Bills: Use billPeriod or billId
      billReference = allocationData.billPeriod || allocationData.billId || null;
    }
    
    // Build description from allocation.targetName or allocation.data
    let description = allocation.targetName || '';
    if (!description && isHoaCategory) {
      if (allocationData.quarter !== undefined) {
        description = normalizedCategoryId === 'hoa-penalties'
          ? `HOA Penalty Q${allocationData.quarter + 1} ${allocationData.year}`
          : `Maintenance Fee Q${allocationData.quarter + 1} ${allocationData.year}`;
      } else if (allocationData.month !== undefined) {
        // Convert fiscal month (0-11) to fiscal month (1-12) for utility function
        const fiscalMonth1Based = allocationData.month + 1;
        const fiscalYearStartMonth = billingConfig?.fiscalYearStartMonth || 1;
        const calendarMonth = fiscalToCalendarMonth(fiscalMonth1Based, fiscalYearStartMonth);
        
        // Calculate calendar year from fiscal year and month
        const fiscalYear = allocationData.year || getNow().getFullYear();
        const { startDate } = getFiscalYearBounds(fiscalYear, fiscalYearStartMonth);
        const calendarYear = startDate.getFullYear();
        
        // Adjust year if month wraps to next calendar year
        let finalYear = calendarYear;
        if (calendarMonth < fiscalYearStartMonth) {
          finalYear = calendarYear + 1;
        }
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        description = normalizedCategoryId === 'hoa-penalties'
          ? `HOA Penalty ${monthNames[calendarMonth - 1]} ${finalYear}`
          : `Maintenance Fee ${monthNames[calendarMonth - 1]} ${finalYear}`;
      }
    } else if (!description && (allocation.categoryId === 'water-consumption' || allocation.categoryId === 'water-penalties')) {
      if (allocation.categoryId === 'water-penalties') {
        description = `Penalty Water Consumption ${billReference || ''}`;
      } else {
        description = `Water Consumption ${billReference || ''}`;
      }
    }
    
    // Determine penalty amount
    let penalty = 0;
    if (normalizedCategoryId === 'water-penalties' || normalizedCategoryId === 'hoa-penalties') {
      penalty = amountInPesos;
    }
    
    // Extract due date if available (from allocation.data)
    let dueDate = null;
    if (allocationData.dueDate) {
      dueDate = this._parseDate(allocationData.dueDate);
    }
    
    // Build statement line item
    const lineItem = {
      // Identification
      transactionId: transaction.transactionId || transaction.id || transaction.__docId || '',
      billReference: billReference,
      
      // Date Information
      date: txDate,
      dueDate: dueDate,
      
      // Description
      description: description,
      
      // Amounts (in pesos)
      amount: normalizedCategoryId === 'water-penalties' || normalizedCategoryId === 'hoa-penalties' ? 0 : amountInPesos, // Base charge (0 for penalty-only items)
      penalty: penalty,
      payment: amountInPesos, // Payment amount (same as amount for paid items)
      
      // Category
      category: normalizedCategoryId === 'hoa-dues' || normalizedCategoryId === 'hoa-penalties' ? 'HOA Dues' : 'Water Bills',
      categoryId: normalizedCategoryId, // Use normalized categoryId for consistency
      
      // Invoice/Receipt
      invoiceReceipt: transaction.reference || 'N/A',
      
      // Payment Method
      method: transaction.paymentMethodId || transaction.accountType || null,
      
      // Notes
      notes: transaction.notes || null,
      
      // Status
      type: 'payment',
      isPaid: true,
      
      // Allocation metadata (for reference mapping)
      allocationData: {
        unitId: allocationData.unitId || allocation.unitId || transaction.unitId || transaction.unit || null,
        month: allocationData.month,
        quarter: allocationData.quarter,
        year: allocationData.year,
        billId: allocationData.billId,
        billPeriod: allocationData.billPeriod
      },
      // Store billingConfig for reference map building
      billingConfig: billingConfig
    };
    
    return lineItem;
  }

  /**
   * Group HOA monthly allocations into quarterly line items when billing is quarterly
   * @param {Array} paidItems
   * @param {Object} billingConfig
   * @returns {Array}
   * @private
   */
  _groupQuarterlyHoaPaidItems(paidItems, billingConfig) {
    if (!paidItems || paidItems.length === 0) {
      return paidItems;
    }

    const duesFrequency = billingConfig?.duesFrequency || 'monthly';
    if (duesFrequency !== 'quarterly') {
      return paidItems;
    }

    const nonGroupedItems = [];
    const groupedMap = new Map();

    paidItems.forEach((item, index) => {
      if (item.categoryId !== 'hoa-dues') {
        nonGroupedItems.push({ item, index });
        return;
      }

      const quarterInfo = this._deriveQuarterInfo(item.allocationData);
      if (!quarterInfo) {
        nonGroupedItems.push({ item, index });
        return;
      }

      const groupingKeyParts = [
        item.transactionId || item.invoiceReceipt || 'unknown',
        quarterInfo.year,
        quarterInfo.quarter
      ];
      const groupKey = groupingKeyParts.join('::');

      if (!groupedMap.has(groupKey)) {
        const baseAllocationData = {
          ...(item.allocationData || {}),
          quarter: quarterInfo.quarter - 1,
          year: quarterInfo.year
        };
        delete baseAllocationData.month;

        groupedMap.set(groupKey, {
          ...item,
          billReference: `Q${quarterInfo.quarter}_${quarterInfo.year}`,
          description: `Maintenance Fee Q${quarterInfo.quarter} ${quarterInfo.year}`,
          amount: 0,
          penalty: 0,
          payment: 0,
          allocationData: baseAllocationData,
          __originalIndex: index
        });
      }

      const groupedItem = groupedMap.get(groupKey);
      groupedItem.amount += item.amount || 0;
      groupedItem.payment += item.payment || 0;
      groupedItem.penalty += item.penalty || 0;

      if (typeof item.allocationData?.month === 'number') {
        groupedItem.allocationData.months = groupedItem.allocationData.months || [];
        groupedItem.allocationData.months.push(item.allocationData.month);
      }
    });

    const groupedItems = Array.from(groupedMap.values());

    const orderedItems = [
      ...nonGroupedItems,
      ...groupedItems.map(item => ({ item, index: item.__originalIndex }))
    ].sort((a, b) => a.index - b.index)
      .map(({ item }) => {
        if (item.__originalIndex !== undefined) {
          delete item.__originalIndex;
        }
        return item;
      });

    return orderedItems;
  }

  /**
   * Derive fiscal quarter information from allocation metadata
   * @param {Object} allocationData
   * @returns {{year: number, quarter: number}|null}
   * @private
   */
  _deriveQuarterInfo(allocationData) {
    if (!allocationData || typeof allocationData.year !== 'number') {
      return null;
    }

    if (typeof allocationData.quarter === 'number') {
      return {
        year: allocationData.year,
        quarter: allocationData.quarter + 1
      };
    }

    if (typeof allocationData.month === 'number') {
      const fiscalMonth = allocationData.month + 1; // 1-12
      const quarter = Math.ceil(fiscalMonth / 3);
      return {
        year: allocationData.year,
        quarter
      };
    }

    return null;
  }

  /**
   * Create fast lookup map of paid bill references for reconciliation
   * 
   * @private
   * @param {Array} paidItems - Array of paid statement line items
   * @returns {Set} Set of bill reference strings
   */
  _buildAllocationReferenceMap(paidItems) {
    const referenceMap = new Set();
    
    paidItems.forEach(item => {
      const { allocationData, categoryId, billReference } = item;
      
      if (categoryId === 'hoa-dues') {
        // HOA Dues reference - match format used by unpaid items
        const unitId = allocationData?.unitId;
        const year = allocationData?.year;
        if (!unitId || typeof year !== 'number') {
          return;
        }

        if (typeof allocationData.quarter === 'number') {
          const quarter = allocationData.quarter + 1; // Convert 0-3 to 1-4
          const ref = `hoa_${unitId}_${year}_Q${quarter}`;
          referenceMap.add(ref);
        } else if (typeof allocationData.month === 'number') {
          const fiscalMonth = allocationData.month + 1; // Convert 0-11 to 1-12
          const ref = `hoa_${unitId}_${year}_${fiscalMonth}`;
          referenceMap.add(ref);
        }
      } else if (categoryId === 'water-consumption' || categoryId === 'water-penalties') {
        // Water Bills reference
        const unitId = allocationData?.unitId;
        const billPeriod = allocationData?.billPeriod || allocationData?.billId;
        if (unitId && billPeriod) {
          const ref = `water_${unitId}_${billPeriod}`;
          referenceMap.add(ref);
        }
      }
    });
    
    return referenceMap;
  }

  /**
   * Query HOA Dues and Water Bills modules to find unpaid bills (no matching allocations)
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Object} dateRange - Statement period
   * @param {Object} billingConfig - Billing configuration
   * @param {Set} paidItemReferences - Set of paid bill references for reconciliation
   * @returns {Promise<Array>} Array of unpaid statement line items
   */
  async _collectUnpaidItemsFromModules(clientId, unitId, dateRange, billingConfig, paidItemReferences) {
    const unpaidItems = [];
    
    // Normalize statement end date for comparison
    const statementEndDate = this._normalizeDateForComparison(dateRange.end);
    
    // Collect unpaid HOA Dues
    const unpaidHoaDues = await this._collectUnpaidHoaDues(
      clientId,
      unitId,
      dateRange,
      billingConfig,
      paidItemReferences,
      statementEndDate
    );
    unpaidItems.push(...unpaidHoaDues);
    
    // Collect unpaid Water Bills
    const unpaidWaterBills = await this._collectUnpaidWaterBills(
      clientId,
      unitId,
      dateRange,
      billingConfig,
      paidItemReferences,
      statementEndDate
    );
    unpaidItems.push(...unpaidWaterBills);
    
    return unpaidItems;
  }

  /**
   * Collect unpaid HOA Dues items
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Object} dateRange - Statement period
   * @param {Object} billingConfig - Billing configuration
   * @param {Set} paidItemReferences - Set of paid bill references
   * @param {Date} statementEndDate - Normalized statement end date
   * @returns {Promise<Array>} Array of unpaid HOA Dues line items
   */
  async _collectUnpaidHoaDues(clientId, unitId, dateRange, billingConfig, paidItemReferences, statementEndDate) {
    await this._initializeDb();
    
    const unpaidItems = [];
    const duesFrequency = billingConfig.duesFrequency || 'monthly';
    const fiscalYearStartMonth = billingConfig.fiscalYearStartMonth || 1;
    
    // Convert date range to fiscal years
    const startFiscalYear = getFiscalYear(dateRange.start, fiscalYearStartMonth);
    const endFiscalYear = getFiscalYear(dateRange.end, fiscalYearStartMonth);
    
    // Collect all fiscal years in range
    const fiscalYears = [];
    for (let fy = startFiscalYear; fy <= endFiscalYear; fy++) {
      fiscalYears.push(fy);
    }
    
    // Load HOA config for penalty calculations
    let hoaConfig = null;
    try {
      const configDoc = await this.db.collection('clients').doc(clientId)
        .collection('config').doc('hoaDues').get();
      
      if (configDoc.exists) {
        hoaConfig = configDoc.data();
      }
    } catch (error) {
      console.warn(`Warning: Could not load HOA config for client ${clientId}:`, error.message);
    }
    
    for (const fiscalYear of fiscalYears) {
      // Query HOA Dues document for fiscal year
      const duesRef = this.db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').doc(fiscalYear.toString());
      
      const duesDoc = await duesRef.get();
      
      if (!duesDoc.exists) {
        continue; // No dues data for this year
      }
      
      const unitData = duesDoc.data();
      const scheduledAmount = unitData.scheduledAmount || 0;
      const scheduledAmountPesos = centavosToPesos(scheduledAmount);
      
      // Process payments array (matches HOADuesView.jsx getPaymentStatus logic)
      if (duesFrequency === 'monthly') {
        // Monthly billing: payments array has 12 entries (0-11 for fiscal months 1-12)
        for (let fiscalMonth = 1; fiscalMonth <= 12; fiscalMonth++) {
          const paymentIndex = fiscalMonth - 1; // Convert 1-12 to 0-11
          const payment = unitData.payments?.[paymentIndex];
          
          // Check payment status (matches frontend logic)
          let isUnpaid = false;
          if (!payment || payment.paid === undefined) {
            isUnpaid = true;
          } else if (!payment.paid || payment.amount === 0) {
            isUnpaid = true;
          } else if (payment.amount < scheduledAmount) {
            isUnpaid = true; // Partial payment - treat as unpaid
          }
          
            if (isUnpaid) {
              // Calculate due date for this fiscal month
              const dueDate = this._calculateDueDateForFiscalMonth(
                fiscalMonth,
                fiscalYear,
                fiscalYearStartMonth,
                duesFrequency,
                hoaConfig
              );
              
              // Build reference for reconciliation
              const ref = `hoa_${unitId}_${fiscalYear}_${fiscalMonth}`;
              
              // Check if reference exists in paidItemReferences
              // Include all unpaid bills in the fiscal year period (don't filter by due date)
              // The due date is only used for penalty calculation, not for filtering
              if (!paidItemReferences.has(ref) && dueDate) {
                // Calculate penalty dynamically
                const baseAmount = scheduledAmountPesos;
                const penalty = this._calculatePenaltyForUnpaidBill(
                  baseAmount,
                  dueDate,
                  statementEndDate,
                  hoaConfig
                );
                
                // Build description
                const calendarMonth = fiscalToCalendarMonth(fiscalMonth, fiscalYearStartMonth);
                const { startDate } = getFiscalYearBounds(fiscalYear, fiscalYearStartMonth);
                let calendarYear = startDate.getFullYear();
                if (calendarMonth < fiscalYearStartMonth) {
                  calendarYear = calendarYear + 1;
                }
                
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const description = `Maintenance Fee ${monthNames[calendarMonth - 1]} ${calendarYear}`;
              
              unpaidItems.push({
                transactionId: null,
                billReference: `${fiscalYear}-${String(fiscalMonth).padStart(2, '0')}`,
                date: null,
                dueDate: dueDate,
                description: description,
                amount: baseAmount,
                penalty: penalty,
                payment: 0,
                category: 'HOA Dues',
                categoryId: 'hoa-dues',
                invoiceReceipt: 'N/A',
                method: null,
                notes: null,
                type: 'charge',
                isPaid: false,
                allocationData: {
                  month: fiscalMonth - 1, // Convert 1-12 to 0-11
                  year: fiscalYear
                }
              });
            }
          }
        }
      } else if (duesFrequency === 'quarterly') {
        // Quarterly billing: Check quarters array or group payments by quarter
        if (unitData.quarters && Array.isArray(unitData.quarters)) {
          // Use quarters array structure (Phase 5)
          unitData.quarters.forEach((quarter, index) => {
            const quarterNum = index + 1; // 1-4
            const quarterAmountCentavos = scheduledAmount * 3;
            const quarterAmount = centavosToPesos(quarterAmountCentavos);
            
            // Check if quarter is unpaid
            const quarterPayment = quarter.payments?.[0]; // First payment in quarter
            let isUnpaid = false;
            
            if (!quarterPayment || quarterPayment.paid === undefined) {
              isUnpaid = true;
            } else if (!quarterPayment.paid || quarterPayment.amount === 0) {
              isUnpaid = true;
            } else if (quarterPayment.amount < quarterAmount) {
              isUnpaid = true; // Partial payment
            }
            
            if (isUnpaid) {
              // Calculate due date for this quarter
              const fiscalMonth = (quarterNum - 1) * 3; // Q1=0, Q2=3, Q3=6, Q4=9
              const dueDate = this._calculateDueDateForFiscalMonth(
                fiscalMonth + 1, // Convert to 1-based
                fiscalYear,
                fiscalYearStartMonth,
                duesFrequency,
                hoaConfig
              );
              
              // Build reference for reconciliation
              const ref = `hoa_${unitId}_${fiscalYear}_Q${quarterNum}`;
              
              // Check if reference exists in paidItemReferences
              if (!paidItemReferences.has(ref) && dueDate && dueDate <= statementEndDate) {
                // Calculate penalty dynamically
                const penalty = this._calculatePenaltyForUnpaidBill(
                  quarterAmount,
                  dueDate,
                  statementEndDate,
                  hoaConfig
                );
                
                // Build description
                const description = `Maintenance Fee Q${quarterNum} ${fiscalYear}`;
                
                unpaidItems.push({
                  transactionId: null,
                  billReference: `Q${quarterNum}_${fiscalYear}`,
                  date: null,
                  dueDate: dueDate,
                  description: description,
                  amount: quarterAmount,
                  penalty: penalty,
                  payment: 0,
                  category: 'HOA Dues',
                  categoryId: 'hoa-dues',
                  invoiceReceipt: 'N/A',
                  method: null,
                  notes: null,
                  type: 'charge',
                  isPaid: false,
                  allocationData: {
                    quarter: quarterNum - 1, // Convert 1-4 to 0-3
                    year: fiscalYear
                  }
                });
              }
            }
          });
        } else {
          // Fallback: Group payments by dueDate (legacy format)
          // This is more complex - would need to group payments by quarter
          // For now, skip legacy format (can be enhanced later if needed)
          console.warn(`Legacy quarterly format detected for unit ${unitId}, fiscal year ${fiscalYear}. Skipping unpaid detection.`);
        }
      }
    }
    
    return unpaidItems;
  }

  /**
   * Collect unpaid Water Bills items
   * 
   * @private
   * @param {string} clientId - Client ID
   * @param {string} unitId - Unit ID
   * @param {Object} dateRange - Statement period
   * @param {Object} billingConfig - Billing configuration
   * @param {Set} paidItemReferences - Set of paid bill references
   * @param {Date} statementEndDate - Normalized statement end date
   * @returns {Promise<Array>} Array of unpaid Water Bills line items
   */
  async _collectUnpaidWaterBills(clientId, unitId, dateRange, billingConfig, paidItemReferences, statementEndDate) {
    await this._initializeDb();
    
    const unpaidItems = [];
    const billingPeriod = billingConfig.billingPeriod || 'monthly';
    const fiscalYearStartMonth = billingConfig.fiscalYearStartMonth || 1;
    
    // Convert date range to fiscal years
    const startFiscalYear = getFiscalYear(dateRange.start, fiscalYearStartMonth);
    const endFiscalYear = getFiscalYear(dateRange.end, fiscalYearStartMonth);
    
    // Collect all fiscal years in range
    const fiscalYears = [];
    for (let fy = startFiscalYear; fy <= endFiscalYear; fy++) {
      fiscalYears.push(fy);
    }
    
    // Load water bills config for penalty calculations
    let waterConfig = null;
    try {
      waterConfig = await waterBillsService.getBillingConfig(clientId);
    } catch (error) {
      console.warn(`Warning: Could not load water bills config for client ${clientId}:`, error.message);
    }
    
    if (billingPeriod === 'quarterly') {
      // Quarterly billing: Use waterBillsService.getQuarterlyBillsForYear()
      for (const fiscalYear of fiscalYears) {
        try {
          const quarterlyBills = await waterBillsService.getQuarterlyBillsForYear(clientId, fiscalYear);
          
          // Find bills for this unit
          const unitBills = quarterlyBills.filter(bill => {
            // Check if bill has this unit
            return bill.bills?.units?.[unitId] || bill.units?.[unitId];
          });
          
          for (const bill of unitBills) {
            const unitBill = bill.bills?.units?.[unitId] || bill.units?.[unitId];
            if (!unitBill) continue;
            
            // Check bill status: paidAmount < currentCharge (unpaid)
            const currentCharge = unitBill.currentCharge || 0;
            const paidAmount = unitBill.paidAmount || 0;
            
            if (paidAmount < currentCharge) {
              // Build reference for reconciliation
              const billPeriod = bill.id || bill.billId || null;
              const ref = `water_${unitId}_${billPeriod}`;
              
              // Check if reference exists in paidItemReferences
              if (!paidItemReferences.has(ref)) {
                // Get due date
                let dueDate = null;
                if (unitBill.dueDate) {
                  dueDate = this._parseDate(unitBill.dueDate);
                } else if (bill.metadata?.dueDate) {
                  dueDate = this._parseDate(bill.metadata.dueDate);
                }
                
                // Only include if dueDate <= statementEndDate
                if (dueDate && dueDate <= statementEndDate) {
                  // Calculate penalty dynamically
                  const baseAmount = currentCharge;
                  const penalty = this._calculatePenaltyForUnpaidBill(
                    baseAmount,
                    dueDate,
                    statementEndDate,
                    waterConfig
                  );
                  
                  // Build description
                  const description = `Water Consumption ${billPeriod}`;
                  
                  unpaidItems.push({
                    transactionId: null,
                    billReference: billPeriod,
                    date: null,
                    dueDate: dueDate,
                    description: description,
                    amount: baseAmount,
                    penalty: penalty,
                    payment: 0,
                    category: 'Water Bills',
                    categoryId: 'water-consumption',
                    invoiceReceipt: 'N/A',
                    method: null,
                    notes: null,
                    type: 'charge',
                    isPaid: false,
                    allocationData: {
                      billId: billPeriod,
                      billPeriod: billPeriod
                    }
                  });
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Warning: Could not load quarterly bills for client ${clientId}, fiscal year ${fiscalYear}:`, error.message);
        }
      }
    } else {
      // Monthly billing: Query monthly bills
      for (const fiscalYear of fiscalYears) {
        // Get fiscal year bounds to determine which calendar months to query
        const { startDate: fyStartDate, endDate: fyEndDate } = getFiscalYearBounds(fiscalYear, fiscalYearStartMonth);
        
        // Query monthly bills for each month in fiscal year
        for (let fiscalMonth = 0; fiscalMonth < 12; fiscalMonth++) {
          const monthStr = String(fiscalMonth).padStart(2, '0');
          const billId = `${fiscalYear}-${monthStr}`;
          
          try {
            const billDoc = await this.db.collection('clients').doc(clientId)
              .collection('projects').doc('waterBills')
              .collection('bills').doc(billId)
              .get();
            
            if (!billDoc.exists) {
              continue; // No bill for this month
            }
            
            const billData = billDoc.data();
            const unitBill = billData.bills?.units?.[unitId];
            
            if (!unitBill) {
              continue; // No bill for this unit
            }
            
            // Check bill status: paidAmount < currentCharge (unpaid)
            const currentCharge = unitBill.currentCharge || 0;
            const paidAmount = unitBill.paidAmount || 0;
            
            if (paidAmount < currentCharge) {
              // Build reference for reconciliation
              const ref = `water_${unitId}_${billId}`;
              
              // Check if reference exists in paidItemReferences
              if (!paidItemReferences.has(ref)) {
                // Get due date
                let dueDate = null;
                if (unitBill.dueDate) {
                  dueDate = this._parseDate(unitBill.dueDate);
                } else if (billData.metadata?.dueDate) {
                  dueDate = this._parseDate(billData.metadata.dueDate);
                }
                
                // Only include if dueDate <= statementEndDate
                if (dueDate && dueDate <= statementEndDate) {
                  // Calculate penalty dynamically
                  const baseAmount = currentCharge;
                  const penalty = this._calculatePenaltyForUnpaidBill(
                    baseAmount,
                    dueDate,
                    statementEndDate,
                    waterConfig
                  );
                  
                  // Build description
                  const monthNames = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
                  const description = `Water Consumption ${monthNames[fiscalMonth]} ${fiscalYear}`;
                  
                  unpaidItems.push({
                    transactionId: null,
                    billReference: billId,
                    date: null,
                    dueDate: dueDate,
                    description: description,
                    amount: baseAmount,
                    penalty: penalty,
                    payment: 0,
                    category: 'Water Bills',
                    categoryId: 'water-consumption',
                    invoiceReceipt: 'N/A',
                    method: null,
                    notes: null,
                    type: 'charge',
                    isPaid: false,
                    allocationData: {
                      billId: billId,
                      billPeriod: billId
                    }
                  });
                }
              }
            }
          } catch (error) {
            console.warn(`Warning: Could not load monthly bill ${billId} for client ${clientId}:`, error.message);
          }
        }
      }
    }
    
    return unpaidItems;
  }

  /**
   * Calculate due date for a fiscal month
   * 
   * @private
   * @param {number} fiscalMonth - Fiscal month (1-12)
   * @param {number} fiscalYear - Fiscal year
   * @param {number} fiscalYearStartMonth - Fiscal year start month (1-12)
   * @param {string} duesFrequency - 'monthly' | 'quarterly'
   * @param {Object} config - HOA config (optional)
   * @returns {Date|null} Due date or null
   */
  _calculateDueDateForFiscalMonth(fiscalMonth, fiscalYear, fiscalYearStartMonth, duesFrequency, config) {
    try {
      // Convert fiscal month (1-12) to calendar month (1-12)
      const calendarMonth = fiscalToCalendarMonth(fiscalMonth, fiscalYearStartMonth);
      
      // Calculate calendar year from fiscal year bounds
      const { startDate } = getFiscalYearBounds(fiscalYear, fiscalYearStartMonth);
      let calendarYear = startDate.getFullYear();
      
      // Adjust year if month wraps to next calendar year
      if (calendarMonth < fiscalYearStartMonth) {
        calendarYear = calendarYear + 1;
      }
      
      // Default due date: 1st of the month
      let dueDate = createCancunDate(calendarYear, calendarMonth, 1);
      
      // Add grace period if configured
      const gracePeriodDays = config?.penaltyDays || 10;
      if (gracePeriodDays > 0) {
        const dt = DateTime.fromJSDate(dueDate).setZone('America/Cancun');
        dueDate = dt.plus({ days: gracePeriodDays }).toJSDate();
      }
      
      return dueDate;
    } catch (error) {
      console.warn(`Warning: Could not calculate due date for fiscal month ${fiscalMonth}, fiscal year ${fiscalYear}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate penalty for an unpaid bill dynamically
   * 
   * @private
   * @param {number} baseAmount - Base charge amount (in pesos)
   * @param {Date} dueDate - Due date
   * @param {Date} asOfDate - Date to calculate penalty as of (statement end date)
   * @param {Object} config - Billing configuration (optional)
   * @returns {number} Penalty amount (in pesos)
   */
  _calculatePenaltyForUnpaidBill(baseAmount, dueDate, asOfDate, config) {
    if (!dueDate || !asOfDate || !config) {
      return 0; // No penalty if missing data
    }
    
    try {
      // Convert base amount to centavos for penalty calculation
      const baseAmountCentavos = Math.round(baseAmount * 100);
      
      // Create bill object for penalty calculation
      const bill = {
        currentCharge: baseAmountCentavos,
        paidAmount: 0, // Unpaid bill
        dueDate: dueDate
      };
      
      // Calculate penalty using PenaltyRecalculationService (takes object with bill, asOfDate, config)
      const result = calculatePenaltyForBill({
        bill: bill,
        asOfDate: asOfDate,
        config: config
      });
      
      // Extract penalty amount from result (in centavos)
      const penaltyCentavos = result.penaltyAmount || 0;
      
      // Convert back to pesos
      return centavosToPesos(penaltyCentavos);
    } catch (error) {
      console.warn(`Warning: Could not calculate penalty for bill:`, error.message);
      return 0;
    }
  }
}

export default StatementDataAggregator;


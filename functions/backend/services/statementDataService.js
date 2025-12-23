/**
 * Statement Data Service
 * 
 * Extracted from queryDuesPayments.js prototype
 * Returns comprehensive data object with all bills, payments, and penalties
 * for HOA dues, water bills, and other project-related charges
 * 
 * This service uses API calls (like the prototype) via axios
 */

import axios from 'axios';
import { getNow, parseDate as parseDateFromService } from '../../shared/services/DateService.js';
import { getFiscalYear, getFiscalYearBounds, validateFiscalYearConfig } from '../utils/fiscalYearUtils.js';
import { getDb } from '../firebase.js';
import { getOwnerNames, getManagerNames } from '../utils/unitContactUtils.js';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

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
           categoryId === 'consumo-de-agua' ||
           categoryId === 'lavado-de-autos' ||
           categoryId === 'lavado-de-barcos' ||
           type === 'water_bill' ||
           type === 'water-bill' ||
           type === 'water_consumption' ||
           type === 'water_penalty' ||
           type === 'water-consumption' ||
           type === 'water' ||
           categoryName.includes('water') ||
           categoryName.includes('agua') ||
           categoryName.includes('consumo') ||
           categoryName.includes('lavado') ||
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
 * Filter penalty-related allocations from transaction allocations array
 */
function filterPenaltyAllocations(allocations) {
  if (!Array.isArray(allocations)) return [];
  
  return allocations.filter(alloc => {
    const categoryId = alloc.categoryId || '';
    const type = alloc.type || '';
    const categoryName = (alloc.categoryName || '').toLowerCase();
    
    return categoryId === 'hoa-penalties' ||
           categoryId === 'water-penalties' ||
           categoryId === 'cargo-por-pago-atrasado' ||
           type === 'hoa_penalty' ||
           type === 'hoa-penalty' ||
           type === 'water_penalty' ||
           type === 'water-penalty' ||
           categoryName.includes('penalty') ||
           categoryName.includes('cargo') ||
           categoryName.includes('atrasado');
  });
}

/**
 * Calculate category breakdown from transaction
 * For single-purpose transactions: uses transaction.categoryId/categoryName directly
 * For split transactions (categoryId === "-split-"): uses allocations array
 * Falls back to description-based categorization if categoryId/categoryName not available
 * @param {Object} transaction - Transaction object with categoryId, categoryName, amount, allocations, and description
 * @returns {Object} Category breakdown: { 'HOA Dues': amount, 'Water Consumption': amount, ... }
 */
function calculateCategoryBreakdown(transaction) {
  const breakdown = {
    'HOA Dues': 0,
    'HOA Penalties': 0,
    'Water Consumption': 0,
    'Water Penalties': 0,
    'Credit Balance': 0,
    'Other': 0
  };
  
  if (!transaction) {
    return breakdown;
  }
  
  const categoryId = (transaction.categoryId || '').toLowerCase();
  const categoryName = (transaction.categoryName || '').toLowerCase();
  const transactionAmount = centavosToPesos(Math.abs(transaction.amount || 0));
  
  // Determine if this is a split transaction: has allocations array with data
  // Split transactions have allocations that break down the payment into categories
  const hasAllocations = transaction.allocations && Array.isArray(transaction.allocations) && transaction.allocations.length > 0;
  
  if (hasAllocations) {
    // Split transaction: use allocations array (each allocation has its own categoryId/categoryName)
    for (const alloc of transaction.allocations) {
      const allocAmount = centavosToPesos(alloc.amount || 0);
      if (allocAmount === 0) continue;
      
      const allocCategoryId = alloc.categoryId || '';
      const allocCategoryName = alloc.categoryName || '';
      const allocType = alloc.type || '';
      
      // Categorize allocation using its own categoryId/categoryName
      categorizeAmount(breakdown, allocAmount, allocCategoryId, allocCategoryName, allocType);
    }
  } else {
    // Single-purpose transaction: use transaction's categoryId/categoryName directly
    categorizeAmount(breakdown, transactionAmount, categoryId, categoryName, '');
  }
  
  // Remove zero categories
  Object.keys(breakdown).forEach(key => {
    if (breakdown[key] === 0) delete breakdown[key];
  });
  
  return breakdown;
}

/**
 * Helper function to categorize an amount into the breakdown object
 * Uses categoryId, categoryName, and type fields only (no description parsing)
 * @param {Object} breakdown - Breakdown object to update
 * @param {number} amount - Amount to categorize (in pesos)
 * @param {string} categoryId - Category ID (e.g., "hoa-dues", "water-consumption")
 * @param {string} categoryName - Category name (e.g., "HOA Dues", "Water Consumption")
 * @param {string} type - Allocation type (optional, e.g., "hoa-month", "water_consumption")
 */
function categorizeAmount(breakdown, amount, categoryId, categoryName, type) {
  if (amount === 0) return;
  
  const catId = (categoryId || '').toLowerCase();
  const catName = (categoryName || '').toLowerCase();
  const allocType = (type || '').toLowerCase();
  
  // NOTE: credit_used/credit-used means credit was applied to pay bills, NOT a credit addition
  // Only count actual credit additions as Credit Balance, not credit usage
  const isCreditUsed = allocType === 'credit_used' || allocType === 'credit-used';
  
  // Check for credit first (Account Credit)
  if (!isCreditUsed && (catId.includes('credit') || allocType.includes('credit') || catName.includes('credit'))) {
    breakdown['Credit Balance'] += amount;
  }
  // Check for HOA Penalties (must check before general HOA)
  else if (catId.includes('hoa-penalties') || catId.includes('hoa_penalties') || 
           allocType.includes('hoa-penalties') || allocType.includes('hoa_penalties') ||
           catName === 'hoa penalties' || catName.includes('hoa penalties')) {
    breakdown['HOA Penalties'] += amount;
  }
  // Check for Water Penalties (must check before general Water)
  else if (catId.includes('water-penalties') || catId.includes('water_penalties') ||
           allocType.includes('water-penalties') || allocType.includes('water_penalties') ||
           catName === 'water penalties' || catName.includes('water penalties')) {
    breakdown['Water Penalties'] += amount;
  }
  // Check for HOA Dues (general HOA)
  // Match on categoryId, categoryName, or type (e.g., "hoa-dues", "HOA Dues", "hoa-month")
  else if (catId.includes('hoa') || catId.includes('dues') || catId.includes('maintenance') ||
           allocType.includes('hoa_month') || allocType.includes('hoa-month') ||
           catName === 'hoa dues' || catName.includes('hoa dues') || 
           (catName.includes('maintenance') && !catName.includes('penalties'))) {
    breakdown['HOA Dues'] += amount;
  }
  // Check for Water Consumption (general Water, excluding penalties)
  else if (catId.includes('water') || catId.includes('consumo') || catId.includes('lavado') || 
           allocType.includes('water_consumption') || allocType.includes('water-consumption') || allocType.includes('water_bill') ||
           catName === 'water consumption' || catName.includes('water consumption') ||
           catName.includes('agua') || catName.includes('lavado')) {
    breakdown['Water Consumption'] += amount;
  }
  else {
    breakdown['Other'] += amount;
  }
}

/**
 * Determine primary category from breakdown
 * Returns the category with the highest amount, or 'other' if all zero
 * @param {Object} breakdown - Category breakdown object
 * @returns {string} Primary category name (lowercase, spaces replaced with underscores)
 */
function getPrimaryCategory(breakdown) {
  let maxAmount = 0;
  let primaryCategory = 'other';
  
  for (const [category, amount] of Object.entries(breakdown)) {
    if (amount > maxAmount) {
      maxAmount = amount;
      primaryCategory = category.toLowerCase().replace(/\s+/g, '_');
    }
  }
  
  return primaryCategory;
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
  fiscalYearBounds,
  waterBills = [], 
  hoaPenalties = [], 
  waterPenalties = [],
  openingBalance = 0,
  creditAdjustments = []
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
        // Use fiscal year from bill (stored as 'year' field) if available, otherwise use calendar year of bill date
        const displayYear = bill.year || bill.fiscalYear || billDate.getFullYear();
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
          balance: 0, // Will be set later when calculating running balance
          billId: bill.billId,
          billRef: {
            billId: bill.billId,
            fiscalYear: bill.fiscalYear,
            fiscalQuarter: bill.fiscalQuarter,
            dueDate: bill.dueDate,
            totalAmount: bill.totalAmount,
            consumption: bill.consumption,
            penaltyAmount: bill.penaltyAmount || 0
          },
          consumption: bill.consumption,
          penaltyAmount: bill.penaltyAmount || 0
        });
      }
    }
  }
  
  // Extract charges from payments array
  // Track processed transactions across ALL quarters to prevent duplicates
  const processedTransactionIds = new Set();
  
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
          category: 'hoa',
          date: quarterDueDate,
          description: `HOA Dues ${quarter.name}`,
          amount: quarterChargeAmount,
          charge: quarterChargeAmount,
          payment: 0,
          balance: 0, // Will be set later when calculating running balance
          month: quarter.months[0], // Use first month for reference
          quarter: quarter.name,
          chargeRef: {
            month: quarter.months[0],
            quarter: quarter.name,
            scheduledAmount: scheduledAmount,
            fiscalYear: fiscalYear
          }
        });
      }
      
      // Extract payments for this quarter - but only create entry if not already processed
      for (const payment of quarterPayments) {
        if (payment.paid && payment.amount > 0) {
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
              paymentAmount = centavosToPesos(transaction.amount || 0);
              
              // Build description from allocations
              const allocations = transaction.allocations || [];
              const hoaQuarters = [...new Set(allocations
                .filter(a => a.type === 'hoa_month' || a.type === 'hoa-month')
                .map(a => a.targetName))];
              const waterBills = [...new Set(allocations
                .filter(a => a.type === 'water_consumption' || a.type === 'water-consumption' || 
                            a.type === 'water_bill' || a.type === 'water-bill' ||
                            (a.categoryId && (a.categoryId.includes('water') || a.categoryId.includes('consumo') || a.categoryId.includes('lavado'))))
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
            
            // Calculate category breakdown from transaction (handles both single-purpose and split)
            const categoryBreakdown = transaction 
              ? calculateCategoryBreakdown(transaction)
              : {};
            const primaryCategory = transaction 
              ? getPrimaryCategory(categoryBreakdown)
              : 'other';
            
            transactions.push({
              type: 'payment',
              category: primaryCategory,
              date: paymentDate,
              description: description,
              amount: -paymentAmount,
              charge: 0,
              payment: paymentAmount,
              balance: 0, // Will be set later when calculating running balance
              transactionId: txnId,
              transactionRef: transaction ? {
                id: txnId,
                date: transaction.date,
                description: transaction.description,
                amount: transaction.amount,
                method: transaction.method,
                reference: transaction.reference,
                notes: transaction.notes,
                categoryId: transaction.categoryId || null,
                categoryName: transaction.categoryName || null
              } : null,
              allocations: transaction 
                ? (transaction.allocations || []).map(alloc => ({
                    categoryId: alloc.categoryId,
                    categoryName: alloc.categoryName,
                    type: alloc.type,
                    amount: centavosToPesos(alloc.amount || 0),
                    targetId: alloc.targetId,
                    targetName: alloc.targetName,
                    notes: alloc.notes
                  }))
                : [],
              categoryBreakdown: categoryBreakdown,
              month: quarter.months[0],
              quarter: quarter.name
            });
          }
        }
      }
    }
  } else {
    // Monthly billing - use global processedTransactionIds
    for (const payment of payments) {
      if (!payment.month) continue;
      
      // Add charge for this month
      let dueDate = parseDueDate(payment.dueDate);
      
      // Fallback: derive due date from fiscal configuration if missing
      if ((!dueDate || isNaN(dueDate.getTime())) && fiscalYearBounds?.startDate) {
        const fallbackDate = new Date(fiscalYearBounds.startDate);
        fallbackDate.setMonth(fallbackDate.getMonth() + (payment.month - 1));
        dueDate = fallbackDate;
      }
      
      if (dueDate && !isNaN(dueDate.getTime())) {
        transactions.push({
          type: 'charge',
          category: 'hoa',
          date: dueDate,
          description: `HOA Dues Month ${payment.month}`,
          amount: scheduledAmount,
          charge: scheduledAmount,
          payment: 0,
          balance: 0, // Will be set later when calculating running balance
          month: payment.month,
          chargeRef: {
            month: payment.month,
            scheduledAmount: scheduledAmount,
            fiscalYear: fiscalYear
          }
        });
      }
      
      // Add payment if paid (only once per transaction ID)
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
            paymentAmount = centavosToPesos(transaction.amount || 0);
            
            // Build description from allocations
            const allocations = transaction.allocations || [];
            const hoaMonths = [...new Set(allocations
              .filter(a => a.type === 'hoa_month' || a.type === 'hoa-month')
              .map(a => a.targetName))];
            const waterBills = [...new Set(allocations
              .filter(a => a.type === 'water_consumption' || a.type === 'water-consumption' || 
                          a.type === 'water_bill' || a.type === 'water-bill' ||
                          (a.categoryId && (a.categoryId.includes('water') || a.categoryId.includes('consumo') || a.categoryId.includes('lavado'))))
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
          
          // Calculate category breakdown from allocations
          const categoryBreakdown = transaction 
            ? calculateCategoryBreakdown(transaction)
            : {};
          const primaryCategory = transaction 
            ? getPrimaryCategory(categoryBreakdown)
            : 'other';
          
          transactions.push({
            type: 'payment',
            category: primaryCategory,
            date: effectiveDate,
            description: description,
            amount: -paymentAmount,
            charge: 0,
            payment: paymentAmount,
            balance: 0, // Will be set later when calculating running balance
            transactionId: txnId,
            transactionRef: transaction ? {
              id: txnId,
              date: transaction.date,
              description: transaction.description,
              amount: transaction.amount,
              method: transaction.method,
              reference: transaction.reference,
              notes: transaction.notes,
              categoryId: transaction.categoryId || null,
              categoryName: transaction.categoryName || null
            } : null,
            allocations: transaction 
              ? (transaction.allocations || []).map(alloc => ({
                  categoryId: alloc.categoryId,
                  categoryName: alloc.categoryName,
                  type: alloc.type,
                  amount: centavosToPesos(alloc.amount || 0),
                  targetId: alloc.targetId,
                  targetName: alloc.targetName,
                  notes: alloc.notes
                }))
              : [],
            categoryBreakdown: categoryBreakdown,
            month: payment.month
          });
        }
      }
    }
  }
  
  // Extract water payments from transactions
  // Only process transactions that weren't already handled in the HOA section
  const waterTransactionIds = new Set();
  
  for (const [txnId, transaction] of transactionMap.entries()) {
    // Skip if already processed in HOA section (prevents duplicate entries for combined payments)
    if (processedTransactionIds.has(txnId)) {
      continue;
    }
    
    const allocations = transaction.allocations || [];
    const waterAllocations = filterWaterAllocations(allocations);
    
    if (waterAllocations.length > 0 && !waterTransactionIds.has(txnId)) {
      waterTransactionIds.add(txnId);
      processedTransactionIds.add(txnId); // Mark as globally processed
      
      const paymentDate = parseDate(transaction.date);
      if (paymentDate && !isNaN(paymentDate.getTime())) {
        // Sum all water allocations for this transaction
        const totalWaterAmount = waterAllocations.reduce((sum, alloc) => {
          return sum + centavosToPesos(alloc.amount || 0);
        }, 0);
        
        if (totalWaterAmount > 0) {
          // Build descriptive label for pure water payments (deduplicate quarter names)
          const waterBillNames = [...new Set(waterAllocations.map(a => {
            const match = a.targetName?.match(/Q\d/);
            return match ? match[0] : (a.targetName || 'Bill');
          }))];
          const description = `Water Payment - ${waterBillNames.join(', ')}`;
          
          // Calculate category breakdown for water payments
          const categoryBreakdown = { 'Water Consumption': totalWaterAmount };
          
          transactions.push({
            type: 'payment',
            category: 'water',
            date: paymentDate,
            description: description,
            amount: -totalWaterAmount,
            charge: 0,
            payment: totalWaterAmount,
            balance: 0, // Will be set later when calculating running balance
            transactionId: txnId,
            transactionRef: {
              id: txnId,
              date: transaction.date,
              description: transaction.description,
              amount: transaction.amount,
              method: transaction.method,
              reference: transaction.reference,
              notes: transaction.notes,
              categoryId: transaction.categoryId || null,
              categoryName: transaction.categoryName || null
            },
            allocations: waterAllocations.map(alloc => ({
              categoryId: alloc.categoryId,
              categoryName: alloc.categoryName,
              type: alloc.type,
              amount: centavosToPesos(alloc.amount || 0),
              targetId: alloc.targetId,
              targetName: alloc.targetName,
              notes: alloc.notes
            })),
            categoryBreakdown: categoryBreakdown
          });
        }
      }
    }
  }
  
  // Extract water payments from transactions
  // ... (existing water loop) ...
  
  // Extract remaining "Orphaned" or General payments
  // This catches payments found in Step 6.5 that weren't processed as HOA or Water
  // EXCLUDE project/special assessment payments - they appear ONLY in Special Projects section
  for (const [txnId, transaction] of transactionMap.entries()) {
    if (processedTransactionIds.has(txnId)) continue;
    
    // Skip project/special assessment payments (Issue #80 fix)
    // These should ONLY appear in Special Projects section, NOT in Activity Report
    const categoryId = transaction.categoryId || '';
    if (categoryId.startsWith('projects-') || categoryId === 'special-assessments') {
      continue;
    }
    
    const paymentDate = parseDate(transaction.date);
    // Only process if valid date and appears to be a payment (positive amount in our system usually means income/payment)
    // However, verify logic: payments in this list are displayed with negative amount.
    // transaction.amount is in centavos.
    
    if (paymentDate && !isNaN(paymentDate.getTime())) {
      const amountPesos = centavosToPesos(transaction.amount || 0);
      
      // Skip zero amounts
      if (Math.abs(amountPesos) < 0.01) continue;
      
      // Determine if payment (income) or charge (expense)
      // Usually transactions fetched are payments. 
      // If amount > 0, it's a payment.
      
      if (amountPesos > 0) {
        processedTransactionIds.add(txnId);
        
        // Calculate category breakdown from allocations
        const categoryBreakdown = calculateCategoryBreakdown(transaction);
        const primaryCategory = getPrimaryCategory(categoryBreakdown);
        
        transactions.push({
          type: 'payment',
          category: primaryCategory, // Calculated from allocations
          date: paymentDate,
          description: transaction.description || transaction.notes || 'Payment',
          amount: -amountPesos, // Negative for credit/payment
          charge: 0,
          payment: amountPesos,
          balance: 0, // Will be set later when calculating running balance
          transactionId: txnId,
          transactionRef: {
            id: txnId,
            date: transaction.date,
            description: transaction.description,
            amount: transaction.amount,
            method: transaction.method,
            reference: transaction.reference,
            notes: transaction.notes
          },
          allocations: (transaction.allocations || []).map(alloc => ({
            categoryId: alloc.categoryId,
            categoryName: alloc.categoryName,
            type: alloc.type,
            amount: centavosToPesos(alloc.amount || 0), // Convert to pesos
            targetId: alloc.targetId,
            targetName: alloc.targetName,
            notes: alloc.notes
          })),
          categoryBreakdown: categoryBreakdown
        });
      }
    }
  }

  // Add penalty charges (passed in from caller)
  transactions.push(...hoaPenalties);
  transactions.push(...waterPenalties);
  
  // REMOVED: Credit adjustments should NOT appear as line items on Statement
  // Credit is a separate ledger - show in summary footer, not as transaction lines
  // transactions.push(...creditAdjustments);
  
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
  
  // Calculate running balance starting from opening balance
  let runningBalance = openingBalance;
  transactions.forEach(txn => {
    runningBalance += txn.amount; // amount is positive for charges, negative for payments
    txn.balance = runningBalance; // Allow balance to go negative (no Math.max(0, ...) clamping)
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
 * Get credit balance at a specific date from credit history
 * Uses the new architecture: calculates balance by summing history entries up to asOfDate
 * @param {Firestore} db - Firestore instance
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID  
 * @param {Date} asOfDate - Date to get balance as of
 * @returns {Promise<number>} Balance in pesos (negative = credit)
 */
async function getCreditBalanceAsOf(db, clientId, unitId, asOfDate) {
  try {
    // Fetch creditBalances document
    const creditBalancesRef = db.collection('clients').doc(clientId)
      .collection('units').doc('creditBalances');
    const creditBalancesDoc = await creditBalancesRef.get();
    
    if (!creditBalancesDoc.exists) {
      return 0; // No credit balance document = no credit
    }
    
    const creditBalancesData = creditBalancesDoc.data();
    const unitCreditData = creditBalancesData[unitId];
    
    if (!unitCreditData || !unitCreditData.history || !Array.isArray(unitCreditData.history)) {
      return 0; // No history = no credit
    }
    
    const history = unitCreditData.history;
    const asOfTimestamp = asOfDate.getTime() / 1000; // Convert to seconds
    
    // Calculate balance by summing all history entries up to asOfDate
    // This matches the new architectural pattern: calculate from history, don't read stale fields
    let balanceInCentavos = 0;
    for (const entry of history) {
      let entryTimestamp = null;
      
      // Handle Firestore Timestamp format
      if (entry.timestamp && entry.timestamp._seconds !== undefined) {
        entryTimestamp = entry.timestamp._seconds;
      } else if (entry.timestamp && typeof entry.timestamp.toDate === 'function') {
        entryTimestamp = entry.timestamp.toDate().getTime() / 1000;
      } else if (entry.timestamp instanceof Date) {
        entryTimestamp = entry.timestamp.getTime() / 1000;
      } else if (typeof entry.timestamp === 'string') {
        // Handle ISO string timestamps
        entryTimestamp = new Date(entry.timestamp).getTime() / 1000;
      } else if (typeof entry.timestamp === 'number') {
        entryTimestamp = entry.timestamp;
      }
      
      // Only include entries up to asOfDate
      if (entryTimestamp !== null && entryTimestamp <= asOfTimestamp) {
        const amount = typeof entry.amount === 'number' ? entry.amount : 0;
        balanceInCentavos += amount;
      } else if (entryTimestamp !== null && entryTimestamp > asOfTimestamp) {
        // History is sorted chronologically, so we can break once we pass the date
        break;
      }
    }
    
    // Convert from centavos to pesos
    const balanceInPesos = centavosToPesos(balanceInCentavos);
    
    // Credit balance is always positive (represents available credit)
    // For running balance: credit reduces what's owed, so it should be negative
    // Negate positive credit balance for running balance (credit reduces debt)
    return -1 * balanceInPesos;
  } catch (error) {
    console.warn(`Warning: Could not fetch credit balance for ${clientId}/${unitId} as of ${asOfDate.toISOString()}:`, error.message);
    return 0; // Graceful degradation - return 0 on error
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
 * Get comprehensive consolidated unit data (raw data layer)
 * Includes all bills, payments, penalties for HOA dues, water bills, and other charges
 * EXTRACTED FROM PROTOTYPE (lines 612-1227)
 * Modified to return data object instead of console logging
 * 
 * This is the raw data gathering layer - returns comprehensive "kitchen sink" object
 * Use getStatementData() for presentation-ready optimized structure
 * 
 * @param {Object} api - API client (axios instance with baseURL)
 * @param {string} clientId - Client ID (e.g., 'AVII', 'MTC')
 * @param {string} unitId - Unit ID (e.g., '101', '1A')
 * @param {number} fiscalYear - Fiscal year (optional, defaults to current fiscal year)
 * @param {boolean} excludeFutureBills - Whether to exclude bills/charges with future dates (default: false)
 * @returns {Promise<Object>} Comprehensive raw data object
 */
export async function getConsolidatedUnitData(api, clientId, unitId, fiscalYear = null, excludeFutureBills = false) {
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
    
    // Step 3: Query HOA dues for the specific unit and year (more efficient than fetching all units)
    const duesResponse = await api.get(`/hoadues/${clientId}/unit/${unitId}/${currentFiscalYear}`);
    
    if (!duesResponse.data) {
      throw new Error(`No dues data found for unit ${unitId} in fiscal year ${currentFiscalYear}`);
    }
    
    // Unit endpoint returns amounts in centavos, convert to pesos for consistency
    const rawDuesData = duesResponse.data;
    const duesData = {
      ...rawDuesData,
      scheduledAmount: centavosToPesos(rawDuesData.scheduledAmount || 0),
      totalPaid: centavosToPesos(rawDuesData.totalPaid || 0),
      creditBalance: centavosToPesos(rawDuesData.creditBalance || 0),
      payments: (rawDuesData.payments || []).map(payment => ({
        ...payment,
        amount: centavosToPesos(payment.amount || 0)
      }))
    };
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

    // Step 6.5: Fetch "Orphaned" transactions (not linked in Dues/Water but belong to unit)
    // This catches general payments or unallocated transactions
    try {
      // Use query endpoint to find transactions by unit and date range
      const queryResponse = await api.get(`/clients/${clientId}/transactions`, {
        params: {
          startDate: fiscalYearBounds.startDate,
          endDate: fiscalYearBounds.endDate,
          unitId: unitId
        }
      });
      
      const unitTxns = queryResponse.data || [];
      
      for (const txn of unitTxns) {
        if (txn.id && !transactionMap.has(txn.id)) {
          // If query returns full transaction objects, use them directly
          // Otherwise fetch details
          if (txn.allocations) {
             transactionMap.set(txn.id, txn);
          } else {
             const fullTxn = await fetchTransaction(api, clientId, txn.id);
             if (fullTxn) {
                transactionMap.set(txn.id, fullTxn);
             }
          }
        }
      }
    } catch (error) {
      console.warn('Warning: Could not fetch orphaned transactions:', error.message);
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
                let quarter = parseInt(cleanPeriod.split('-Q')[1]);
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
                description: description,
                amount: bill.totalPenaltyDue,
                charge: bill.totalPenaltyDue,
                payment: 0,
                balance: 0, // Will be set later when calculating running balance
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
              // Water bills are in arrears, due at start of next quarter
              // e.g., Q1 (Jul-Sep) is due Oct 1
              // So base date for penalty calculation is start of NEXT quarter
              const fiscalMonthIndex = (quarter) * 3;
              const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
              const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
              dueDate = new Date(calendarYear, calendarMonth, 1);
            }
            
            if (dueDate && !isNaN(dueDate.getTime())) {
              const penaltyDate = new Date(dueDate);
              penaltyDate.setMonth(penaltyDate.getMonth() + 1);
              penaltyDate.setDate(1);
              
              const quarter = cleanPeriod.includes('-Q') ? parseInt(cleanPeriod.split('-Q')[1]) : '';
              const displayQuarter = quarter === 0 ? 4 : quarter;
              const description = `Water Penalty - Q${displayQuarter} ${dueDate.getFullYear()}`;
              
              waterPenalties.push({
                type: 'penalty',
                category: 'water',
                date: penaltyDate,
                description: description,
                amount: bill.totalPenaltyDue,
                charge: bill.totalPenaltyDue,
                payment: 0,
                balance: 0, // Will be set later when calculating running balance
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
    
    // Step 7.1: Add stored HOA penalties from dues document (for paid historical penalties)
    // These are imported from Sheets as "Cargo por mantenimiento atrasado"
    if (duesData.penalties && Array.isArray(duesData.penalties.entries)) {
      for (const entry of duesData.penalties.entries) {
        // Convert entry date from Firestore timestamp
        let penaltyDate = entry.date;
        if (entry.date?._seconds) {
          penaltyDate = new Date(entry.date._seconds * 1000);
        } else if (typeof entry.date === 'string') {
          penaltyDate = new Date(entry.date);
        }
        
        // Convert amount from centavos to pesos
        const penaltyAmount = centavosToPesos(entry.amount || 0);
        if (penaltyAmount <= 0) continue;
        
        // Check for duplicate (same date and amount already from unified preview)
        const key = `hoa-${penaltyDate.getTime()}-${penaltyAmount}`;
        const existingKey = hoaPenalties.find(p => 
          Math.abs(p.date.getTime() - penaltyDate.getTime()) < 86400000 && // Within 1 day
          Math.abs(p.amount - penaltyAmount) < 0.01 // Same amount (floating point tolerance)
        );
        
        if (!existingKey) {
          const description = entry.notes || `HOA Late Fee - ${penaltyDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

          hoaPenalties.push({
            type: 'penalty',
            category: 'hoa',
            date: penaltyDate,
            description: description,
            amount: penaltyAmount,
            charge: penaltyAmount,
            payment: 0, // Payment will be recorded separately via actual payment transactions
            balance: 0, // Will be set later when calculating running balance
            isPaid: entry.isPaid || false,
            source: 'stored',
            penaltyRef: {
              date: entry.date,
              amount: entry.amount, // in centavos
              isPaid: entry.isPaid,
              notes: entry.notes,
              source: 'imported'
            }
          });
        }
      }
    }
    
    // Step 7.5: Extract historical (paid) penalties from transaction allocations
    // This supplements the unpaid penalties from unified preview API
    // We need to include penalties that were already paid to show complete history
    
    // Create Set of existing penalty keys from unified preview API to avoid duplicates
    const existingPenaltyKeys = new Set();
    hoaPenalties.forEach(penalty => {
      const key = `hoa-${penalty.date.getTime()}-${penalty.amount}`;
      existingPenaltyKeys.add(key);
    });
    waterPenalties.forEach(penalty => {
      const key = `water-${penalty.date.getTime()}-${penalty.amount}`;
      existingPenaltyKeys.add(key);
    });
    
    const processedPenaltyKeys = new Set(); // Track to avoid duplicates within allocations
    
    for (const [txnId, transaction] of transactionMap.entries()) {
      const allocations = transaction.allocations || [];
      const penaltyAllocations = filterPenaltyAllocations(allocations);
      
      for (const alloc of penaltyAllocations) {
        // Skip if amount is 0 or negative (shouldn't happen, but safety check)
        const penaltyAmount = centavosToPesos(alloc.amount || 0);
        if (penaltyAmount <= 0) continue;
        
        // Extract penalty metadata from allocation
        const allocData = alloc.data || {};
        const categoryId = alloc.categoryId || '';
        const isHOA = categoryId === 'hoa-penalties' || categoryId.includes('hoa');
        const isWater = categoryId === 'water-penalties' || categoryId.includes('water') || categoryId.includes('consumo') || categoryId.includes('lavado');
        
        if (!isHOA && !isWater) continue;
        
        // Calculate penalty date from allocation data
        let penaltyDate = null;
        let description = '';
        
        if (isHOA) {
          // HOA penalties: use quarter/month/year from allocation data
          const quarter = allocData.quarter;
          const month = allocData.month;
          const year = allocData.year || currentFiscalYear;
          const billPeriod = allocData.billPeriod || '';
          
          if (quarter !== undefined) {
            // Quarterly billing
            // Handle Q0 -> Q4 correction for description
            const displayQuarter = quarter === 0 ? 4 : quarter;
            
            const fiscalMonthIndex = (quarter === 0 ? 3 : quarter - 1) * 3; // Q0 maps to last quarter of previous cycle? No, usually Q0 implies initialization.
            // Let's stick to safe math: if quarter is 0, we assume it's Q4 of previous year.
            // But fiscalMonthIndex calculation: (0-1)*3 = -3.
            
            const calcQuarter = quarter === 0 ? 0 : quarter - 1; // Use 0 for Q1 (0-1 = -1?) 
            // Wait, quarter 1 -> index 0. quarter 0 -> index -1?
            // If quarter=1, (1-1)*3 = 0.
            // If quarter=0, (0-1)*3 = -3.
            
            const fIdx = (quarter === 0) ? -3 : (quarter - 1) * 3;
            
            const calendarMonth = ((fiscalYearStartMonth - 1) + fIdx) % 12;
            const calendarYear = year - 1 + Math.floor(((fiscalYearStartMonth - 1) + fIdx) / 12);
            
            const dueDate = new Date(calendarYear, calendarMonth, 1);
            penaltyDate = new Date(dueDate);
            penaltyDate.setMonth(penaltyDate.getMonth() + 1);
            penaltyDate.setDate(1);
            description = `HOA Penalty - Q${displayQuarter} ${dueDate.getFullYear()}`;
          } else if (month !== undefined) {
            // Monthly billing
            const calendarMonth = ((fiscalYearStartMonth - 1) + (month - 1)) % 12;
            const calendarYear = year - 1 + Math.floor(((fiscalYearStartMonth - 1) + (month - 1)) / 12);
            const dueDate = new Date(calendarYear, calendarMonth, 1);
            penaltyDate = new Date(dueDate);
            penaltyDate.setMonth(penaltyDate.getMonth() + 1);
            penaltyDate.setDate(1);
            const monthName = dueDate.toLocaleString('en-US', { month: 'short' });
            description = `HOA Penalty - ${monthName} ${dueDate.getFullYear()}`;
          } else if (billPeriod) {
            // Fallback to billPeriod parsing (same logic as unified preview)
            const cleanPeriod = billPeriod.replace('hoa:', '');
            if (cleanPeriod.includes('-Q')) {
              const [yearStr, quarterStr] = cleanPeriod.split('-Q');
              const fiscalYear = parseInt(yearStr);
              const quarter = parseInt(quarterStr);
              const fiscalMonthIndex = (quarter - 1) * 3;
              const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
              const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
              const dueDate = new Date(calendarYear, calendarMonth, 1);
              penaltyDate = new Date(dueDate);
              penaltyDate.setMonth(penaltyDate.getMonth() + 1);
              penaltyDate.setDate(1);
              description = `HOA Penalty - Q${quarter} ${dueDate.getFullYear()}`;
            }
          }
          
          if (penaltyDate && !isNaN(penaltyDate.getTime())) {
            // Create unique key to prevent duplicates
            const penaltyKey = `hoa-${penaltyDate.getTime()}-${penaltyAmount}`;
            // Skip if already exists in unified preview penalties or already processed
            if (!existingPenaltyKeys.has(penaltyKey) && !processedPenaltyKeys.has(penaltyKey)) {
              processedPenaltyKeys.add(penaltyKey);
              hoaPenalties.push({
                type: 'penalty',
                category: 'hoa',
                date: penaltyDate,
                description: description,
                amount: penaltyAmount,
                charge: penaltyAmount,
                payment: 0,
                billId: allocData.billId || allocData.billPeriod || '',
                baseAmount: 0
              });
            }
          }
        } else if (isWater) {
          // Water penalties: use quarter/year from allocation data
          const quarter = allocData.quarter;
          const year = allocData.year || currentFiscalYear;
          const billPeriod = allocData.billPeriod || '';
          
          if (quarter !== undefined) {
            // Water bills are in arrears, due at start of next quarter
            // e.g., Q1 (Jul-Sep) is due Oct 1
            // So base date for penalty calculation is start of NEXT quarter
            const fiscalMonthIndex = quarter * 3;
            const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
            const calendarYear = year - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
            const dueDate = new Date(calendarYear, calendarMonth, 1);
            penaltyDate = new Date(dueDate);
            penaltyDate.setMonth(penaltyDate.getMonth() + 1);
            penaltyDate.setDate(1);
            description = `Water Penalty - Q${quarter} ${dueDate.getFullYear()}`;
          } else if (billPeriod) {
            // Fallback to billPeriod parsing
            const cleanPeriod = billPeriod.replace('water:', '');
            if (cleanPeriod.includes('-Q')) {
              const [yearStr, quarterStr] = cleanPeriod.split('-Q');
              const fiscalYear = parseInt(yearStr);
              const quarter = parseInt(quarterStr);
              const fiscalMonthIndex = quarter * 3;
              const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
              const calendarYear = fiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
              const dueDate = new Date(calendarYear, calendarMonth, 1);
              penaltyDate = new Date(dueDate);
              penaltyDate.setMonth(penaltyDate.getMonth() + 1);
              penaltyDate.setDate(1);
              description = `Water Penalty - Q${quarter} ${dueDate.getFullYear()}`;
            }
          }
          
          if (penaltyDate && !isNaN(penaltyDate.getTime())) {
            // Create unique key to prevent duplicates
            const penaltyKey = `water-${penaltyDate.getTime()}-${penaltyAmount}`;
            // Skip if already exists in unified preview penalties or already processed
            if (!existingPenaltyKeys.has(penaltyKey) && !processedPenaltyKeys.has(penaltyKey)) {
              processedPenaltyKeys.add(penaltyKey);
              waterPenalties.push({
                type: 'penalty',
                category: 'water',
                date: penaltyDate,
                description: description,
                amount: penaltyAmount,
                charge: penaltyAmount,
                payment: 0,
                balance: 0, // Will be set later when calculating running balance
                billId: allocData.billId || allocData.billPeriod || '',
                baseAmount: 0
              });
            }
          }
        }
      }
    }
    
    // Step 7.6: Extract water penalties from water bill documents (for paid historical penalties)
    // These penalties are stored in the bill document's penaltyAmount field
    // We need to extract them as separate penalty charges for the Allocation Summary
    for (const bill of waterBills) {
      const penaltyAmount = bill.penaltyAmount || 0;
      if (penaltyAmount > 0) {
        // Calculate penalty date (typically 1 month after bill due date)
        let penaltyDate = null;
        const dueDate = bill.dueDate ? parseDate(bill.dueDate) : null;
        if (dueDate && !isNaN(dueDate.getTime())) {
          penaltyDate = new Date(dueDate);
          penaltyDate.setMonth(penaltyDate.getMonth() + 1);
          penaltyDate.setDate(1);
        } else if (bill.fiscalQuarter) {
          // Fallback: calculate from fiscal quarter
          const fiscalMonthIndex = bill.fiscalQuarter * 3;
          const calendarMonth = ((fiscalYearStartMonth - 1) + fiscalMonthIndex) % 12;
          const calendarYear = currentFiscalYear - 1 + Math.floor(((fiscalYearStartMonth - 1) + fiscalMonthIndex) / 12);
          penaltyDate = new Date(calendarYear, calendarMonth, 1);
        }
        
        if (penaltyDate && !isNaN(penaltyDate.getTime())) {
          // Check if this penalty already exists (from unified preview or allocations)
          const existingPenalty = waterPenalties.find(p => 
            Math.abs(p.date.getTime() - penaltyDate.getTime()) < 86400000 && // Within 1 day
            Math.abs(p.amount - penaltyAmount) < 0.01 // Same amount (floating point tolerance)
          );
          
          if (!existingPenalty) {
            const quarterName = bill.fiscalQuarter ? `Q${bill.fiscalQuarter}` : '';
            const description = quarterName 
              ? `Water Penalty - ${quarterName} ${bill.fiscalYear || currentFiscalYear}`
              : `Water Penalty - ${penaltyDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
            
            waterPenalties.push({
              type: 'penalty',
              category: 'water',
              date: penaltyDate,
              description: description,
              amount: penaltyAmount,
              charge: penaltyAmount,
              payment: 0, // Payment will be recorded separately via actual payment transactions
              balance: 0, // Will be set later when calculating running balance
              billId: bill.billId,
              baseAmount: bill.currentCharge || 0,
              source: 'bill_document'
            });
          }
        }
      }
    }
    
    // Step 7.9: Get opening balance from credit history at fiscal year start
    const db = await getDb();
    const openingBalance = await getCreditBalanceAsOf(db, clientId, unitId, fiscalYearBounds.startDate);
    
    // Step 7.10: Fetch credit history entries for manual credit adjustments
    // These are credit changes not associated with money transactions
    const creditAdjustments = [];
    try {
      const creditBalancesRef = db.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      const creditBalancesDoc = await creditBalancesRef.get();
      
      if (creditBalancesDoc.exists) {
        const creditBalancesData = creditBalancesDoc.data();
        const unitCreditData = creditBalancesData[unitId];
        
        if (unitCreditData && unitCreditData.history && Array.isArray(unitCreditData.history)) {
          const fyStartTimestamp = fiscalYearBounds.startDate.getTime() / 1000;
          const fyEndTimestamp = fiscalYearBounds.endDate.getTime() / 1000;
          
          // Get all credit history entries within fiscal year (excluding starting_balance)
          for (const entry of unitCreditData.history) {
            let entryTimestamp = null;
            let entryDate = null;
            
            // Handle different timestamp formats
            if (entry.timestamp && entry.timestamp._seconds !== undefined) {
              // Firestore Timestamp with _seconds
              entryTimestamp = entry.timestamp._seconds;
              entryDate = new Date(entryTimestamp * 1000);
            } else if (entry.timestamp && typeof entry.timestamp.toDate === 'function') {
              // Firestore Timestamp object
              entryDate = entry.timestamp.toDate();
              entryTimestamp = entryDate.getTime() / 1000;
            } else if (entry.timestamp instanceof Date) {
              // JavaScript Date object
              entryDate = entry.timestamp;
              entryTimestamp = entryDate.getTime() / 1000;
            } else if (typeof entry.timestamp === 'string') {
              // ISO string timestamp (new architecture format)
              // Extract date part (YYYY-MM-DD) to avoid timezone conversion issues with time components
              const isoStr = entry.timestamp;
              const datePart = isoStr.split('T')[0]; // Extract YYYY-MM-DD part
              
              // Use DateService.parseDate which handles Cancun timezone correctly
              // Parse just the date part to ensure we get the correct date regardless of time component
              entryDate = parseDateFromService(datePart);
              if (entryDate && !isNaN(entryDate.getTime())) {
                entryTimestamp = entryDate.getTime() / 1000;
              } else {
                // Fallback to full ISO string if datePart extraction fails
                entryDate = parseDateFromService(entry.timestamp);
                if (entryDate && !isNaN(entryDate.getTime())) {
                  entryTimestamp = entryDate.getTime() / 1000;
                }
              }
            } else if (typeof entry.timestamp === 'number') {
              // Unix timestamp in seconds
              entryTimestamp = entry.timestamp;
              entryDate = new Date(entryTimestamp * 1000);
            }
            
            // Skip if we couldn't parse the timestamp
            if (!entryTimestamp || !entryDate || isNaN(entryDate.getTime())) {
              continue;
            }
            
            // Skip if outside fiscal year or is starting_balance (already handled as opening balance)
            if (entryTimestamp < fyStartTimestamp || entryTimestamp > fyEndTimestamp) {
              continue;
            }
            
            if (entry.type === 'starting_balance') {
              continue; // Already handled as opening balance
            }
            
            // ONLY include credit entries explicitly marked as manual admin adjustments
            // All other credit entries (from payments, migrations, etc.) are already reflected in:
            // - Payment transaction amounts (deposits include overpayments)
            // - Opening balance calculation (sums all history up to fiscal year start)
            // Including non-manual entries causes double-counting
            if (entry.source !== 'manual') {
              continue; // Skip ALL non-manual entries - only show admin adjustments
            }
            
            // Use amount field as single source of truth (new architecture)
            // amount is in centavos: positive = credit added, negative = credit used
            const entryAmountCentavos = typeof entry.amount === 'number' ? entry.amount : 0;
            const entryAmountPesos = centavosToPesos(entryAmountCentavos);
            
            // For running balance: credit reduces debt
            // credit_added (positive amount) = negative in running balance (reduces debt)
            // credit_used (negative amount) = positive in running balance (increases debt)
            const adjustmentAmount = -entryAmountPesos; // Negate because credit reduces debt
            
            // For credit adjustments:
            // credit_added = negative amount (reduces debt) = show as payment (negative in running balance)
            // credit_used = positive amount (increases debt) = show as charge (positive in running balance)
            const isCreditAdded = entry.type === 'credit_added';
            
            // Build description - include transaction reference if available
            let description = entry.note || entry.description || `Credit ${entry.type === 'credit_added' ? 'Added' : 'Used'}`;
            if (entry.transactionId) {
              description += ` (Transaction ${entry.transactionId})`;
            }
            
            creditAdjustments.push({
              type: 'credit_adjustment',
              category: 'credit',
              date: entryDate,
              description: description,
              amount: adjustmentAmount, // Negative for credit_added, positive for credit_used
              charge: isCreditAdded ? 0 : Math.abs(adjustmentAmount), // credit_used shows as charge
              payment: isCreditAdded ? Math.abs(adjustmentAmount) : 0, // credit_added shows as payment
              balance: 0, // Will be set later when calculating running balance
              transactionId: entry.transactionId || null, // Include transactionId for reference
              creditAdjustmentRef: {
                id: entry.id,
                type: entry.type,
                amount: entry.amount,
                note: entry.note,
                description: entry.description,
                source: entry.source
              }
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not fetch credit adjustments for ${clientId}/${unitId}:`, error.message);
    }
    
    // Step 8: Create chronological transaction list
    // NOTE: Special Assessments (projectsData) are NOT included in chronologicalTransactions
    // They only appear in Allocation Summary currently
    // TODO/FUTURE: Add Special Assessment charges/payments to chronologicalTransactions when Projects feature is complete
    let chronologicalTransactions = createChronologicalTransactionList(
      payments,
      transactionMap,
      scheduledAmount,
      duesFrequency,
      fiscalYearStartMonth,
      currentFiscalYear,
      fiscalYearBounds,
      waterBills,
      hoaPenalties,
      waterPenalties,
      openingBalance,
      creditAdjustments
    );
    
    // Filter future CHARGES if requested (but always include payments - they're real activity)
    // Payments should always show even if the bill hasn't been sent yet
    // CRITICAL: Include HOA bills within 15-day buffer (matching preview logic)
    const cutoffDate = getNow();
    // Include transactions for the current day
    cutoffDate.setHours(23, 59, 59, 999);
    
    // 15-day buffer for HOA bills (allows Statement of Account to show upcoming bills)
    const HOA_BUFFER_DAYS = 15;
    
    console.log(`   📅 [STATEMENT FILTER] Filtering transactions. excludeFutureBills=${excludeFutureBills}, cutoffDate=${cutoffDate.toISOString().split('T')[0]}, total transactions before filter: ${chronologicalTransactions.length}`);
    
    if (excludeFutureBills) {
      chronologicalTransactions = chronologicalTransactions.filter(txn => {
        // Always include payments (real activity)
        if (txn.type === 'payment' || txn.payment > 0) {
          return true;
        }
        // Always include credit adjustments (real activity)
        if (txn.type === 'credit_adjustment') {
          return true;
        }
        
        // For HOA charges: include if within 15-day buffer (even if future)
        if (txn.type === 'charge' && txn.category === 'hoa') {
          // Parse transaction date (handle both Date objects and strings)
          const txnDate = txn.date instanceof Date ? txn.date : new Date(txn.date);
          if (isNaN(txnDate.getTime())) {
            // Invalid date - exclude it
            console.log(`   ⚠️  [STATEMENT FILTER] Invalid date for HOA charge: ${txn.description}, date: ${txn.date}`);
            return false;
          }
          
          // Calculate buffer date (15 days before due date)
          const bufferDate = new Date(txnDate);
          bufferDate.setDate(bufferDate.getDate() - HOA_BUFFER_DAYS);
          
          // Include if current date is at or past the buffer start date
          const isWithinBuffer = cutoffDate >= bufferDate;
          
          // Debug logging for Q3 specifically
          if (txn.description && txn.description.includes('Q3')) {
            console.log(`   🔍 [STATEMENT FILTER] Q3 HOA charge check:`);
            console.log(`      Description: ${txn.description}`);
            console.log(`      Due Date: ${txnDate.toISOString().split('T')[0]}`);
            console.log(`      Buffer Date (due - 15 days): ${bufferDate.toISOString().split('T')[0]}`);
            console.log(`      Cutoff Date: ${cutoffDate.toISOString().split('T')[0]}`);
            console.log(`      Is Within Buffer: ${isWithinBuffer} (cutoffDate >= bufferDate)`);
            console.log(`      Days until due: ${Math.ceil((txnDate - cutoffDate) / (1000 * 60 * 60 * 24))}`);
          }
          
          return isWithinBuffer;
        }
        
        // Filter out other future charges/bills/penalties
        return txn.date <= cutoffDate;
      });
    } else {
      // Even when excludeFutureBills=false, apply 15-day buffer to HOA bills for consistency
      // This ensures Q3/Q4 don't show too early, but do show within the buffer period
      const beforeFilter = chronologicalTransactions.length;
      const filteredOut = [];
      const filteredIn = [];
      
      chronologicalTransactions = chronologicalTransactions.filter(txn => {
        // For HOA charges: apply 15-day buffer (don't show too early)
        if (txn.type === 'charge' && txn.category === 'hoa') {
          const txnDate = txn.date instanceof Date ? txn.date : new Date(txn.date);
          if (isNaN(txnDate.getTime())) {
            console.log(`   ⚠️  [STATEMENT FILTER] Invalid date for HOA charge: ${txn.description}, date: ${txn.date}`);
            filteredOut.push({ desc: txn.description, reason: 'invalid_date' });
            return false;
          }
          
          const bufferDate = new Date(txnDate);
          bufferDate.setDate(bufferDate.getDate() - HOA_BUFFER_DAYS);
          
          // Only show if within buffer period (don't show Q4 when it's too far away)
          const isWithinBuffer = cutoffDate >= bufferDate;
          
          // Debug logging for Q3 specifically
          if (txn.description && txn.description.includes('Q3')) {
            console.log(`   🔍 [STATEMENT FILTER] Q3 HOA charge check (excludeFutureBills=false):`);
            console.log(`      Description: ${txn.description}`);
            console.log(`      Due Date: ${txnDate.toISOString().split('T')[0]}`);
            console.log(`      Buffer Date (due - 15 days): ${bufferDate.toISOString().split('T')[0]}`);
            console.log(`      Cutoff Date: ${cutoffDate.toISOString().split('T')[0]}`);
            console.log(`      Is Within Buffer: ${isWithinBuffer} (cutoffDate >= bufferDate)`);
            console.log(`      Days until due: ${Math.ceil((txnDate - cutoffDate) / (1000 * 60 * 60 * 24))}`);
            console.log(`      ⚠️  RETURNING: ${isWithinBuffer}`);
          }
          
          if (isWithinBuffer) {
            filteredIn.push({ desc: txn.description, date: txnDate.toISOString().split('T')[0] });
          } else {
            filteredOut.push({ desc: txn.description, date: txnDate.toISOString().split('T')[0], reason: 'outside_buffer' });
          }
          
          return isWithinBuffer;
        }
        
        // All other transactions pass through unchanged
        filteredIn.push({ desc: txn.description || txn.type, date: txn.date instanceof Date ? txn.date.toISOString().split('T')[0] : String(txn.date) });
        return true;
      });
      
      console.log(`   📊 [STATEMENT FILTER] Filtered ${beforeFilter} → ${chronologicalTransactions.length} transactions`);
      console.log(`      ✅ Included: ${filteredIn.length} transactions`);
      console.log(`      ❌ Excluded: ${filteredOut.length} transactions`);
      if (filteredOut.length > 0) {
        console.log(`      Excluded items:`, filteredOut.map(f => `${f.desc} (${f.date}) - ${f.reason}`).join(', '));
      }
      const q3Included = filteredIn.find(f => f.desc && f.desc.includes('Q3'));
      const q3Excluded = filteredOut.find(f => f.desc && f.desc.includes('Q3'));
      if (q3Included) {
        console.log(`      ✅ Q3 INCLUDED: ${q3Included.desc} (${q3Included.date})`);
      }
      if (q3Excluded) {
        console.log(`      ❌ Q3 EXCLUDED: ${q3Excluded.desc} (${q3Excluded.date}) - ${q3Excluded.reason}`);
      }
      
      console.log(`   📊 [STATEMENT FILTER] After filtering (excludeFutureBills=false): ${chronologicalTransactions.length} transactions remain`);
    }
    
    // Step 9: Fetch credit balance
    const creditBalanceData = await fetchCreditBalance(api, clientId, unitId);
    
    // Step 10: Calculate summary
    const calculatedTotalDue = scheduledAmount * 12;
    const totalDue = calculatedTotalDue;
    const totalPaid = duesData.totalPaid || 0;
    
    // Determine final balance from the last transaction
    let finalBalance = chronologicalTransactions.length > 0 
      ? chronologicalTransactions[chronologicalTransactions.length - 1].balance 
      : openingBalance;
    
    // Tick and Tie: If final balance is negative (credit), it should match the credit balance
    // The credit balance is the source of truth for credit amounts
    const currentCreditBalance = creditBalanceData.creditBalance || 0;
    const expectedFinalBalance = -currentCreditBalance; // Negate because credit reduces debt
    
    // Reconcile: If final balance is negative (indicating credit), use credit balance as source of truth
    // This ensures the statement "ticks and ties" correctly
    // Exception: If there's both credit AND positive balance due (not enough credit to cover all charges),
    // we use the calculated balance (which will be positive or less negative than credit balance)
    if (finalBalance < 0 && finalBalance <= expectedFinalBalance) {
      // Final balance is negative and matches or is more negative than credit balance
      // This means we have credit, and it should match the credit balance exactly
      // Use credit balance as source of truth to ensure reconciliation
      finalBalance = expectedFinalBalance;
    } else if (finalBalance < 0 && Math.abs(finalBalance - expectedFinalBalance) > 0.01) {
      // There's a discrepancy - log warning
      // This can happen if there are unbilled items or timing differences
      console.warn(`Balance reconciliation check for ${clientId}/${unitId}: ` +
        `Final balance (${finalBalance.toFixed(2)}) doesn't match credit balance (${expectedFinalBalance.toFixed(2)}). ` +
        `Difference: ${Math.abs(finalBalance - expectedFinalBalance).toFixed(2)}. ` +
        `This may be due to unbilled items or timing differences.`);
    }

    // If filtering future bills, totalOutstanding should reflect current reality (finalBalance)
    // Otherwise use the annual calculation
    const totalOutstanding = excludeFutureBills ? finalBalance : (totalDue - totalPaid);
    
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
        openingBalance: openingBalance,
        scheduledAmount: scheduledAmount,
        transactionCount: chronologicalTransactions.length
      }
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * Get projects/special assessments for a unit during fiscal year
 * @param {Object} api - API client (not used but kept for consistency)
 * @param {string} clientId - Client ID
 * @param {string} unitId - Unit ID  
 * @param {Object} fiscalYearBounds - { startDate, endDate }
 * @returns {Array} Projects with unit's collections
 * 
 * TODO/FUTURE ENHANCEMENT: Projects feature screens/code are not built yet
 * Currently Special Assessments only appear in Allocation Summary, NOT in Account Activity
 * When Projects feature is complete, need to:
 * 1. Add Special Assessment charges to chronologicalTransactions (Account Activity)
 * 2. Link Special Assessment payments to transactions via allocations
 * 3. Support Special Assessment penalties if applicable
 */
async function getUnitProjectsForStatement(api, clientId, unitId, fiscalYearBounds) {
  const db = await getDb();
  const projectsRef = db.collection('clients').doc(clientId).collection('projects');
  const projectsSnapshot = await projectsRef.get();
  
  if (projectsSnapshot.empty) return [];
  
  const unitProjects = [];
  const fyStart = fiscalYearBounds.startDate;
  const fyEnd = fiscalYearBounds.endDate;
  
  for (const doc of projectsSnapshot.docs) {
    const project = doc.data();
    
    // Check if unit is exempt
    const unitAssessment = project.unitAssessments?.[unitId];
    if (unitAssessment?.exempt) continue;
    
    // Filter collections for this unit within fiscal year
    const unitCollections = (project.collections || []).filter(c => {
      if (c.unitId !== unitId) return false;
      
      // Parse collection date - handle Firestore Timestamp, Date, or string
      let collectionDate;
      if (c.date && typeof c.date.toDate === 'function') {
        // Firestore Timestamp
        collectionDate = c.date.toDate();
      } else if (c.date instanceof Date) {
        collectionDate = c.date;
      } else if (typeof c.date === 'string') {
        collectionDate = new Date(c.date);
      } else {
        return false; // Skip if date is invalid
      }
      
      // Check if collection is within fiscal year bounds
      return collectionDate >= fyStart && collectionDate <= fyEnd;
    });
    
    // Only include if unit has payments in this period
    if (unitCollections.length === 0) continue;
    
    // Sort collections by date
    unitCollections.sort((a, b) => {
      const dateA = a.date && typeof a.date.toDate === 'function' 
        ? a.date.toDate() 
        : a.date instanceof Date 
          ? a.date 
          : new Date(a.date);
      const dateB = b.date && typeof b.date.toDate === 'function' 
        ? b.date.toDate() 
        : b.date instanceof Date 
          ? b.date 
          : new Date(b.date);
      return dateA - dateB;
    });
    
    // Enrich collections with transaction notes/description
    // Enhancement: Fetch transaction details to get payment notes for display
    const enrichedCollections = await Promise.all(unitCollections.map(async (c) => {
      if (c.transactionId) {
        try {
          const txn = await fetchTransaction(api, clientId, c.transactionId);
          console.log(`[Projects] Fetched transaction ${c.transactionId}:`, {
            hasNotes: !!txn?.notes,
            hasDescription: !!txn?.description,
            notes: txn?.notes,
            description: txn?.description,
            allFields: txn ? Object.keys(txn) : []
          });
          return {
            ...c,
            notes: txn?.notes || txn?.description || c.notes || '',
            paymentMethod: txn?.method || null,
            reference: txn?.reference || null
          };
        } catch (error) {
          // If transaction fetch fails, return collection as-is
          console.log(`[Projects] Failed to fetch transaction ${c.transactionId}:`, error.message);
          return { ...c, notes: c.notes || '' };
        }
      }
      return { ...c, notes: c.notes || '' };
    }));
    
    // Calculate unit's totals
    const totalPaid = enrichedCollections.reduce((sum, c) => sum + (c.amount || 0), 0);
    const assessmentAmount = unitAssessment?.expectedAmount || 0;
    const balance = assessmentAmount - totalPaid;
    
    unitProjects.push({
      projectId: project.projectId,
      name: project.name,
      status: project.status,
      startDate: project.startDate,
      completionDate: project.completionDate,
      totalBudget: project.totalCost || 0,
      assessment: assessmentAmount,
      collections: enrichedCollections,
      totalPaid: totalPaid,
      balance: balance
    });
  }
  
  // Sort projects by start date
  unitProjects.sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
    const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
    return dateA - dateB;
  });
  
  return unitProjects;
}

/**
 * Get optimized statement data for a unit (presentation layer)
 * Transforms raw consolidated data into lightweight, presentation-ready structure
 * 
 * @param {Object} api - API client (axios instance with baseURL)
 * @param {string} clientId - Client ID (e.g., 'AVII', 'MTC')
 * @param {string} unitId - Unit ID (e.g., '101', '1A')
 * @param {number} fiscalYear - Fiscal year (optional, defaults to current fiscal year)
 * @param {boolean} excludeFutureBills - Whether to exclude bills/charges with future dates (default: false)
 * @returns {Promise<Object>} Optimized statement data object ready for rendering
 */
export async function getStatementData(api, clientId, unitId, fiscalYear = null, excludeFutureBills = false) {
  // Get raw consolidated data
  const rawData = await getConsolidatedUnitData(api, clientId, unitId, fiscalYear, excludeFutureBills);
  
  // Query projects for this unit during fiscal year
  const projectsData = await getUnitProjectsForStatement(
    api, 
    clientId, 
    unitId, 
    rawData.clientConfig.fiscalYearBounds
  );
  
  // Get client data for clientInfo
  const clientResponse = await api.get(`/clients/${clientId}`);
  const clientData = clientResponse.data || {};
  
  // Get account statements config (statement footer, etc.) from Firestore config subcollection
  let accountStatementsConfig = {};
  try {
    // Access Firestore directly for config subcollection (not available via API)
    const { getDb } = await import('../firebase.js');
    const db = await getDb();
    const configDoc = await db
      .collection('clients').doc(clientId)
      .collection('config').doc('accountStatements')
      .get();
    
    if (configDoc.exists) {
      accountStatementsConfig = configDoc.data();
    }
  } catch (error) {
    // Config document doesn't exist yet - that's okay, use empty config
    console.log(`ℹ️  No accountStatements config found for ${clientId}, using defaults`);
  }
  
  // Format address string
  const addressObj = clientData.contactInfo?.address || {};
  const addressParts = [
    addressObj.street,
    addressObj.city,
    addressObj.state,
    addressObj.postalCode
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : null;
  
  /**
   * Helper function to fetch user data by email using API endpoint
   * Returns enriched user data if found, null otherwise
   */
  const fetchUserByEmail = async (email) => {
    if (!email || typeof email !== 'string') return null;
    
    try {
      const userResponse = await api.get(`/auth/user/by-email/${encodeURIComponent(email)}`);
      
      if (userResponse.data?.success && userResponse.data?.data) {
        const userData = userResponse.data.data;
        return {
          email: userData.email,
          displayName: userData.displayName || userData.name || null,
          preferredCurrency: userData.profile?.preferredCurrency || null,
          preferredLanguage: userData.profile?.preferredLanguage || null,
          notifications: userData.notifications || {},
          role: userData.role || userData.globalRole || null
        };
      }
      
      return null;
    } catch (error) {
      // Handle 404 (user not found) gracefully - not an error
      if (error.response?.status === 404) {
        return null;
      }
      console.warn(`Warning: Could not fetch user data for email ${email}:`, error.message);
      return null;
    }
  };
  
  // Get unit data for owner info
  let owners = [];
  let emails = [];
  let managers = [];
  
  try {
    // Fetch units list and find the specific unit
    const unitsResponse = await api.get(`/clients/${clientId}/units`);
    if (unitsResponse.data && unitsResponse.data.data) {
      const units = unitsResponse.data.data;
      const unit = units.find(u => u.unitId === unitId || u._id === unitId);
      if (unit) {
        // Extract owners (normalized to array of strings for backward compatibility)
        owners = getOwnerNames(unit.owners);
        // Handle legacy single owner field
        if (owners.length === 0 && unit.owner) {
          owners = [typeof unit.owner === 'string' ? unit.owner : unit.owner.name || unit.owner];
        }
        
        // Extract email addresses (raw strings)
        let rawEmails = [];
        if (Array.isArray(unit.emails)) {
          rawEmails = unit.emails.filter(Boolean);
        } else if (unit.email) {
          rawEmails = [unit.email].filter(Boolean);
        }
        
        // Enrich emails with user profile data
        if (rawEmails.length > 0) {
          const emailPromises = rawEmails.map(async (email) => {
            const userData = await fetchUserByEmail(email);
            // Return enriched email object
            return {
              email: email,
              displayName: userData?.displayName || null,
              preferredCurrency: userData?.preferredCurrency || null,
              preferredLanguage: userData?.preferredLanguage || null,
              notifications: userData?.notifications || {},
              role: userData?.role || null
            };
          });
          emails = await Promise.all(emailPromises);
        }
        
        // Extract managers (normalized to array of strings for backward compatibility)
        managers = getManagerNames(unit.managers);
      }
    }
  } catch (error) {
    // Unit data not critical - continue with empty arrays
    console.warn(`Warning: Could not fetch unit data for ${clientId}/${unitId}:`, error.message);
  }
  
  // Format fiscal period string
  const fiscalYearBounds = rawData.clientConfig.fiscalYearBounds;
  const fiscalYearStartMonth = rawData.clientConfig.fiscalYearStartMonth;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const startDate = fiscalYearBounds.startDate;
  const endDate = fiscalYearBounds.endDate;
  const startMonthName = monthNames[startDate.getMonth()];
  const endMonthName = monthNames[endDate.getMonth()];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const periodCovered = `${startMonthName} ${startDate.getDate()}, ${startYear} - ${endMonthName} ${endDate.getDate()}, ${endYear}`;
  
  // Helper function to round to 2 decimal places
  const roundTo2Decimals = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 0;
    return Math.round(value * 100) / 100;
  };
  
  // Transform chronological transactions to lineItems
  const lineItems = rawData.chronologicalTransactions.map(txn => {
    const txnDate = txn.date instanceof Date ? txn.date : parseDate(txn.date);
    const dateStr = txnDate ? txnDate.toISOString().split('T')[0] : '';
    
    // Determine if future based on excludeFutureBills logic
    const now = getNow();
    const cutoffDate = new Date(now);
    cutoffDate.setHours(23, 59, 59, 999);
    // Determine if transaction is "future" for display purposes
    // CRITICAL: HOA charges within 15-day buffer should NOT be marked as future
    let isFuture = false;
    if (txnDate) {
      if (txn.type === 'charge' && txn.category === 'hoa') {
        // For HOA charges: only mark as future if outside 15-day buffer
        const HOA_BUFFER_DAYS = 15;
        const bufferDate = new Date(txnDate);
        bufferDate.setDate(bufferDate.getDate() - HOA_BUFFER_DAYS);
        // If within buffer period, it's not "future" for display purposes
        isFuture = cutoffDate < bufferDate; // Only future if cutoffDate is BEFORE buffer starts
      } else {
        // For other transactions: mark as future if date is after cutoff
        isFuture = txnDate > cutoffDate;
      }
    }
    
    return {
      date: dateStr,
      description: txn.description || '',
      charge: roundTo2Decimals(txn.charge || 0),
      payment: roundTo2Decimals(txn.payment || 0),
      balance: roundTo2Decimals(txn.balance || 0),
      type: txn.type || 'charge', // 'charge', 'payment', 'penalty'
      category: txn.category || null,
      transactionId: txn.transactionId || null,
      isFuture: isFuture,
      
      // Preserve all reference data for UI drill-down and reconciliation
      transactionRef: txn.transactionRef || null,
      allocations: txn.allocations || [],
      categoryBreakdown: txn.categoryBreakdown || {},
      billRef: txn.billRef || null,
      chargeRef: txn.chargeRef || null,
      penaltyRef: txn.penaltyRef || null
    };
  });
  
  // Transform credit allocations
  const creditAllocations = rawData.creditAllocations.map(alloc => {
    const transaction = alloc.transaction;
    const txnDate = transaction.date instanceof Date ? transaction.date : parseDate(transaction.date);
    const dateStr = txnDate ? txnDate.toISOString().split('T')[0] : '';
    
    // Sum all credit allocation amounts
    const totalAmount = alloc.allocations.reduce((sum, a) => {
      return sum + centavosToPesos(a.amount || 0);
    }, 0);
    
    return {
      date: dateStr,
      description: `Credit used for ${transaction.description || 'Payment'}`,
      amount: roundTo2Decimals(totalAmount)
    };
  });
  
  // Extract bank account info from feeStructure.bankDetails
  let bankAccountInfo = null;
  if (clientData.feeStructure?.bankDetails) {
    const bankDetails = clientData.feeStructure.bankDetails;
    bankAccountInfo = {
      accountName: bankDetails.accountName || null,
      bankName: bankDetails.bankName || null,
      accountNumber: bankDetails.cuenta || bankDetails.accountNumber || null,
      clabe: bankDetails.clabe || null,
      swiftCode: bankDetails.swiftCode || null,
      reference: bankDetails.reference || null
    };
  }
  
  // Handle logoUrl (convert empty string to null)
  const logoUrl = clientData.branding?.logoUrl;
  const normalizedLogoUrl = logoUrl && logoUrl.trim() !== '' ? logoUrl : null;
  
  // Calculate allocation summary by category using transaction allocations
  const categoryMap = new Map();
  
  // Process charges and penalties from line items
  for (const item of lineItems) {
    // Skip future items
    if (item.isFuture) continue;
    
    // Determine category from description or category field
    // Separate HOA Dues from HOA Penalties and Water Consumption from Water Penalties
    const desc = (item.description || '').toLowerCase();
    let categoryName = 'Other';
    
    // Check if this is a penalty first
    const isPenalty = item.type === 'penalty';
    
    // Use category field if available
    if (item.category) {
      const cat = (item.category || '').toLowerCase();
      
      if (isPenalty) {
        // Penalty categorization
        if (cat === 'hoa' || cat.includes('hoa') || (cat.includes('maintenance') && !cat.includes('dues'))) {
          categoryName = 'HOA Penalties';
        } else if (cat === 'water' || cat.includes('water')) {
          categoryName = 'Water Penalties';
        }
      } else {
        // Regular charge categorization
        if (cat === 'hoa' || cat.includes('hoa') || cat.includes('maintenance') || cat.includes('dues')) {
          categoryName = 'HOA Dues';
        } else if (cat === 'water' || cat.includes('water') || cat.includes('consumption')) {
          categoryName = 'Water Consumption';
        }
      }
    } else {
      // Fallback to description-based categorization
      if (isPenalty) {
        // Penalty categorization
        if (desc.includes('hoa') || (desc.includes('maintenance') && desc.includes('penalty'))) {
          categoryName = 'HOA Penalties';
        } else if (desc.includes('water') && desc.includes('penalty')) {
          categoryName = 'Water Penalties';
        } else if (desc.includes('penalty') && (desc.includes('hoa') || desc.includes('maintenance'))) {
          categoryName = 'HOA Penalties';
        }
      } else {
        // Regular charge categorization
        if (desc.includes('hoa') || desc.includes('maintenance') || desc.includes('dues') || desc.includes('mantenimiento')) {
          categoryName = 'HOA Dues';
        } else if (desc.includes('water') || desc.includes('agua') || desc.includes('consumption') || desc.includes('consumo')) {
          categoryName = 'Water Consumption';
        }
      }
    }
    
    // Get or create category entry
    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, { charges: 0, penalties: 0, paid: 0 });
    }
    const category = categoryMap.get(categoryName);
    
    // Aggregate charges and penalties
    if (item.type === 'penalty') {
      category.penalties += item.charge || 0;
    } else if (item.type === 'charge') {
      category.charges += item.charge || 0;
    }
  }
  
  // Process payments from categoryBreakdown (already calculated from allocations!)
  // This is much simpler since we preserved the breakdown when creating chronologicalTransactions
  for (const item of lineItems) {
    if (item.isFuture) continue;
    
    if (item.type === 'payment' && item.payment > 0) {
      if (item.categoryBreakdown && Object.keys(item.categoryBreakdown).length > 0) {
        // Use pre-calculated category breakdown from allocations
        for (const [categoryName, amount] of Object.entries(item.categoryBreakdown)) {
          if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, { charges: 0, penalties: 0, paid: 0 });
          }
          categoryMap.get(categoryName).paid += amount;
        }
      } else {
        // Fallback: Use category field or description to categorize payment
        // Note: Without allocations, we can't perfectly distinguish dues from penalties
        // This fallback should be rare if transactions have proper allocations
        const desc = (item.description || '').toLowerCase();
        let paymentCategory = 'Other';
        
        // Use category field if available (should match SAMS category names from Sheets)
        // Category field comes from getPrimaryCategory() which converts to lowercase with underscores
        // e.g., "HOA Penalties" → "hoa_penalties", "Water Consumption" → "water_consumption"
        if (item.category) {
          const cat = item.category.toLowerCase();
          // Check for penalties first (exact matches or includes)
          if (cat === 'hoa_penalties' || cat.includes('hoa') && cat.includes('penalties')) {
            paymentCategory = 'HOA Penalties';
          } else if (cat === 'water_penalties' || cat.includes('water') && cat.includes('penalties')) {
            paymentCategory = 'Water Penalties';
          }
          // Check for dues/consumption
          else if (cat === 'hoa' || cat === 'hoa_dues' || cat === 'hoa_maintenance' || 
                   (cat.includes('hoa') && !cat.includes('penalties'))) {
            paymentCategory = 'HOA Dues';
          } else if (cat === 'water' || cat === 'water_consumption' || 
                     (cat.includes('water') && !cat.includes('penalties'))) {
            paymentCategory = 'Water Consumption';
          } else if (cat.includes('credit')) {
            paymentCategory = 'Credit Balance';
          }
        } else if (desc.includes('credit') || desc.includes('saldo') || desc.includes('account credit')) {
          paymentCategory = 'Credit Balance';
        } else if (desc.includes('water') || desc.includes('agua') || desc.includes('consumption') || desc.includes('consumo') || 
                   desc.includes('bill') || desc.includes('q1') || desc.includes('q2') || desc.includes('q3') || desc.includes('q4')) {
          // Check for water-related payments (including quarterly bill references)
          paymentCategory = 'Water Consumption';
        } else if (desc.includes('hoa') || desc.includes('maintenance') || desc.includes('dues') || desc.includes('mantenimiento')) {
          paymentCategory = 'HOA Dues';
        } else {
          // If description doesn't clearly indicate category, check if payment has water-related allocations
          // This helps catch payments that might have been categorized incorrectly
          if (item.allocations && Array.isArray(item.allocations)) {
            const hasWaterAllocation = item.allocations.some(alloc => {
              const allocType = (alloc.type || '').toLowerCase();
              const allocCategoryId = (alloc.categoryId || '').toLowerCase();
              const allocCategoryName = (alloc.categoryName || '').toLowerCase();
              return allocType.includes('water') || allocCategoryId.includes('water') || 
                     allocCategoryName.includes('water') || allocCategoryName.includes('consumption');
            });
            if (hasWaterAllocation) {
              paymentCategory = 'Water Consumption';
            }
          }
        }
        
        if (!categoryMap.has(paymentCategory)) {
          categoryMap.set(paymentCategory, { charges: 0, penalties: 0, paid: 0 });
        }
        categoryMap.get(paymentCategory).paid += item.payment || 0;
      }
    }
  }
  
  // Add Special Assessments to allocation summary
  // TODO/FUTURE ENHANCEMENT: Currently Special Assessments only appear in Allocation Summary
  // They are NOT included in Account Activity (chronologicalTransactions/lineItems) yet
  // Future work needed:
  // 1. Add Special Assessment charges to chronologicalTransactions with proper dates
  // 2. Link Special Assessment payments to transactions via allocations
  // 3. Display Special Assessment charges and payments in Account Activity table
  // 4. Support Special Assessment penalties (if applicable)
  // Projects data exists (projectsData) but Projects screens/code are not built yet
  // This is a placeholder until full Projects feature is implemented
  if (projectsData.length > 0) {
    const totalProjectAssessments = projectsData.reduce((sum, p) => sum + centavosToPesos(p.assessment), 0);
    const totalProjectPaid = projectsData.reduce((sum, p) => sum + centavosToPesos(p.totalPaid), 0);
    
    categoryMap.set('Special Assessments', {
      charges: totalProjectAssessments,
      penalties: 0,
      paid: totalProjectPaid
    });
  }
  
  // Merge penalty categories into parent categories (HOA Penalties → HOA Dues, Water Penalties → Water Consumption)
  // This ensures penalties appear in the Penalties column of the parent row, not as separate rows
  if (categoryMap.has('HOA Penalties')) {
    const hoaPenalties = categoryMap.get('HOA Penalties');
    if (!categoryMap.has('HOA Dues')) {
      categoryMap.set('HOA Dues', { charges: 0, penalties: 0, paid: 0 });
    }
    const hoaDues = categoryMap.get('HOA Dues');
    hoaDues.penalties += hoaPenalties.penalties;
    hoaDues.paid += hoaPenalties.paid; // In case penalty payments exist
    categoryMap.delete('HOA Penalties');
  }
  
  if (categoryMap.has('Water Penalties')) {
    const waterPenalties = categoryMap.get('Water Penalties');
    if (!categoryMap.has('Water Consumption')) {
      categoryMap.set('Water Consumption', { charges: 0, penalties: 0, paid: 0 });
    }
    const waterConsumption = categoryMap.get('Water Consumption');
    waterConsumption.penalties += waterPenalties.penalties;
    waterConsumption.paid += waterPenalties.paid; // In case penalty payments exist
    categoryMap.delete('Water Penalties');
  }
  
  // Remove Credit Balance from Allocation Summary - it's not a charge category
  // Credit balance is already displayed above the Allocation Summary and comes from creditBalances document
  // The "Credit Balance" row here would show cumulative credit additions, not the actual available balance, which is confusing
  categoryMap.delete('Credit Balance');
  
  // Convert map to array, filter out zero categories, and calculate totals
  const categories = Array.from(categoryMap.entries())
    .filter(([name, data]) => {
      // Filter out categories with all zeros
      return data.charges !== 0 || data.penalties !== 0 || data.paid !== 0;
    })
    .map(([name, data]) => ({
      name: name,
      charges: roundTo2Decimals(data.charges),
      penalties: roundTo2Decimals(data.penalties),
      paid: roundTo2Decimals(data.paid)
    }));
  
  const allocationTotals = {
    charges: roundTo2Decimals(categories.reduce((sum, cat) => sum + cat.charges, 0)),
    penalties: roundTo2Decimals(categories.reduce((sum, cat) => sum + cat.penalties, 0)),
    paid: roundTo2Decimals(categories.reduce((sum, cat) => sum + cat.paid, 0))
  };
  
  // Build optimized return structure
  return {
    clientInfo: {
      clientId: clientId,
      name: clientData.basicInfo?.fullName || clientData.basicInfo?.displayName || clientId,
      logoUrl: normalizedLogoUrl,
      address: address,
      bankAccountInfo: bankAccountInfo,
      accountStatementsConfig: accountStatementsConfig,
      governance: {
        managementCompany: {
          name: clientData.governance?.managementCompany?.name || 'Sandyland Properties',
          email: clientData.governance?.managementCompany?.email || 'pm@sandyland.com.mx',
          phone: clientData.governance?.managementCompany?.phone || '+52 984 238 8224'
        }
      }
    },
    unitInfo: {
      unitId: unitId,
      owners: owners,
      emails: emails, // Array of enriched email objects with displayName, preferredCurrency, preferredLanguage, notifications, role
      managers: managers
    },
    statementInfo: {
      statementDate: getNow().toISOString().split('T')[0],
      fiscalYear: rawData.clientConfig.fiscalYear,
      periodCovered: periodCovered,
      generatedAt: getNow().toISOString()
    },
    summary: (() => {
      const closingBalance = roundTo2Decimals(rawData.summary.finalBalance);
      // Use getter function to calculate credit from history (never trust stale stored value)
      const creditBalance = roundTo2Decimals(getCreditBalance(rawData.creditBalance) / 100); // getter returns centavos
      const netAmountDue = roundTo2Decimals(Math.max(0, closingBalance - creditBalance));
      return {
        totalDue: roundTo2Decimals(rawData.summary.totalDue),
        totalPaid: roundTo2Decimals(rawData.summary.totalPaid),
        totalOutstanding: roundTo2Decimals(rawData.summary.totalOutstanding),
        openingBalance: roundTo2Decimals(rawData.summary.openingBalance || 0),
        closingBalance: closingBalance,
        creditBalance: creditBalance,
        netAmountDue: netAmountDue
      };
    })(),
    lineItems: lineItems,
    creditInfo: {
      // Use getter function to calculate credit from history (never trust stale stored value)
      currentBalance: roundTo2Decimals(getCreditBalance(rawData.creditBalance) / 100),
      allocations: creditAllocations
    },
    allocationSummary: {
      categories: categories,
      totals: allocationTotals
    },
    projectsData: {
      projects: projectsData,
      totalPaid: projectsData.reduce((sum, p) => sum + p.totalPaid, 0),
      hasProjects: projectsData.length > 0
    }
  };
}


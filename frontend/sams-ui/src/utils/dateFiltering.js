/**
 * Date filtering utilities for transactions
 */

import { databaseFieldMappings } from '../databaseFieldMappings';

/**
 * Get date range based on predefined range type
 * @param {string} rangeType - The type of date range (today, thisWeek, etc.)
 * @returns {Object} Object with startDate and endDate
 */
export const getDateRangeFromType = (rangeType) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (rangeType) {
    case 'today':
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
      
    case 'yesterday': {
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      return {
        startDate: yesterday,
        endDate: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    }
    
    case 'thisWeek': {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return { startDate: startOfWeek, endDate: endOfWeek };
    }
    
    case 'lastWeek': {
      const startOfLastWeek = new Date(today);
      startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
      endOfLastWeek.setHours(23, 59, 59, 999);
      return { startDate: startOfLastWeek, endDate: endOfLastWeek };
    }
    
    case 'thisMonth': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      return { startDate: startOfMonth, endDate: endOfMonth };
    }
    
    case 'lastMonth': {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      endOfLastMonth.setHours(23, 59, 59, 999);
      return { startDate: startOfLastMonth, endDate: endOfLastMonth };
    }
    
    case 'thisQuarter': {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1);
      const endOfQuarter = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
      endOfQuarter.setHours(23, 59, 59, 999);
      return { startDate: startOfQuarter, endDate: endOfQuarter };
    }
    
    case 'lastQuarter': {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const lastQuarterStartMonth = (currentQuarter - 1) * 3;
      const year = lastQuarterStartMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const startMonth = lastQuarterStartMonth < 0 ? 9 : lastQuarterStartMonth;
      
      const startOfLastQuarter = new Date(year, startMonth, 1);
      const endOfLastQuarter = new Date(year, startMonth + 3, 0);
      endOfLastQuarter.setHours(23, 59, 59, 999);
      return { startDate: startOfLastQuarter, endDate: endOfLastQuarter };
    }
    
    case 'thisYear': {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      endOfYear.setHours(23, 59, 59, 999);
      return { startDate: startOfYear, endDate: endOfYear };
    }
    
    case 'lastYear': {
      const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
      endOfLastYear.setHours(23, 59, 59, 999);
      return { startDate: startOfLastYear, endDate: endOfLastYear };
    }
    
    case 'last30days': {
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: thirtyDaysAgo, endDate: today };
    }
    
    case 'last90days': {
      const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { startDate: ninetyDaysAgo, endDate: today };
    }
    
    default:
      return null;
  }
};

/**
 * Check if a transaction date falls within a date range
 * @param {string|Object} transactionDate - The transaction date (string or Firestore timestamp)
 * @param {Date} startDate - Range start date
 * @param {Date} endDate - Range end date
 * @returns {boolean} True if the transaction is within the range
 */
export const isDateInRange = (transactionDate, startDate, endDate) => {
  if (!transactionDate || !startDate || !endDate) return true;
  
  // Use utility to handle different date formats
  const txDate = databaseFieldMappings.timestampToDate(transactionDate);
  if (!txDate) return false;
  
  return txDate >= startDate && txDate <= endDate;
};

/**
 * Filter transactions by date range
 * @param {Array} transactions - Array of transactions
 * @param {string} rangeType - The type of date range
 * @returns {Array} Filtered transactions
 */
export const filterTransactionsByDateRange = (transactions, rangeType) => {
  if (!rangeType || rangeType === 'all') return transactions;
  
  const dateRange = getDateRangeFromType(rangeType);
  if (!dateRange) return transactions;
  
  return transactions.filter(transaction => 
    isDateInRange(transaction.date || transaction.created, dateRange.startDate, dateRange.endDate)
  );
};

/**
 * Filter transactions by custom date range
 * @param {Array} transactions - Array of transactions
 * @param {string} startDateStr - Start date string (YYYY-MM-DD format)
 * @param {string} endDateStr - End date string (YYYY-MM-DD format)
 * @returns {Array} Filtered transactions
 */
export const filterTransactionsByCustomDateRange = (transactions, startDateStr, endDateStr) => {
  if (!startDateStr && !endDateStr) return transactions;
  
  const startDate = startDateStr ? new Date(startDateStr) : null;
  const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : null;
  
  return transactions.filter(transaction => {
    const txDate = databaseFieldMappings.timestampToDate(transaction.date || transaction.created);
    if (!txDate) return false;
    
    if (startDate && txDate < startDate) return false;
    if (endDate && txDate > endDate) return false;
    
    return true;
  });
};

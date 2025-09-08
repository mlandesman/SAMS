/**
 * Transaction filtering utilities
 */

/**
 * Perform global search across all transaction fields
 * @param {Array} transactions - Array of transactions
 * @param {string} searchTerm - The search term
 * @returns {Array} Filtered transactions
 */
export const globalSearchTransactions = (transactions, searchTerm) => {
  if (!searchTerm || !searchTerm.trim()) return transactions;
  
  const lowerSearchTerm = searchTerm.toLowerCase().trim();
  
  return transactions.filter(transaction => {
    // Search across all text fields
    const searchableFields = [
      transaction.vendor,
      transaction.category,
      transaction.unit,
      transaction.account,
      transaction.notes,
      transaction.description,
      transaction.date,
      transaction.amount?.toString()
    ];
    
    return searchableFields.some(field => 
      field && field.toString().toLowerCase().includes(lowerSearchTerm)
    );
  });
};

/**
 * Apply advanced filters to transactions
 * @param {Array} transactions - Array of transactions
 * @param {Object} filters - Filter object with various criteria
 * @returns {Array} Filtered transactions
 */
export const applyAdvancedFilters = (transactions, filters) => {
  if (!filters || Object.keys(filters).length === 0) return transactions;
  
  return transactions.filter(transaction => {
    // Vendor filter
    if (filters.vendor && transaction.vendor !== filters.vendor) {
      return false;
    }
    
    // Category filter
    if (filters.category && transaction.category !== filters.category) {
      return false;
    }
    
    // Unit filter
    if (filters.unit && transaction.unit !== filters.unit) {
      return false;
    }
    
    // Account filter
    if (filters.account && transaction.account !== filters.account) {
      return false;
    }
    
    // Amount range filter
    const amount = parseFloat(transaction.amount) || 0;
    if (filters.minAmount && amount < parseFloat(filters.minAmount)) {
      return false;
    }
    if (filters.maxAmount && amount > parseFloat(filters.maxAmount)) {
      return false;
    }
    
    // Date range filter
    if (filters.startDate || filters.endDate) {
      const txDate = new Date(transaction.date);
      if (filters.startDate && txDate < new Date(filters.startDate)) {
        return false;
      }
      if (filters.endDate && txDate > new Date(filters.endDate + 'T23:59:59')) {
        return false;
      }
    }
    
    // Description contains filter
    if (filters.description) {
      const description = transaction.description || '';
      if (!description.toLowerCase().includes(filters.description.toLowerCase())) {
        return false;
      }
    }
    
    // Notes contains filter
    if (filters.notes) {
      const notes = transaction.notes || '';
      if (!notes.toLowerCase().includes(filters.notes.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  });
};

/**
 * Combine all filtering methods
 * @param {Array} transactions - Original transactions array
 * @param {Object} options - Filtering options
 * @param {string} options.globalSearch - Global search term
 * @param {string} options.dateRange - Quick date range type
 * @param {Object} options.advancedFilters - Advanced filter criteria
 * @param {function} options.customDateFilter - Custom date filtering function
 * @returns {Array} Filtered transactions
 */
export const filterTransactions = (transactions, options = {}) => {
  let filtered = [...transactions];
  
  // Apply global search first
  if (options.globalSearch) {
    filtered = globalSearchTransactions(filtered, options.globalSearch);
  }
  
  // Apply quick date range filter
  if (options.dateRange && options.customDateFilter) {
    filtered = options.customDateFilter(filtered, options.dateRange);
  }
  
  // Apply advanced filters
  if (options.advancedFilters) {
    filtered = applyAdvancedFilters(filtered, options.advancedFilters);
  }
  
  return filtered;
};

/**
 * Get filter summary for display
 * @param {Object} options - Current filter options
 * @returns {Object} Summary of active filters
 */
export const getFilterSummary = (options = {}) => {
  const summary = {
    hasActiveFilters: false,
    count: 0,
    descriptions: []
  };
  
  if (options.globalSearch) {
    summary.hasActiveFilters = true;
    summary.count++;
    summary.descriptions.push(`Search: "${options.globalSearch}"`);
  }
  
  if (options.dateRange && options.dateRange !== 'all') {
    summary.hasActiveFilters = true;
    summary.count++;
    summary.descriptions.push(`Date: ${options.dateRange}`);
  }
  
  if (options.advancedFilters && Object.keys(options.advancedFilters).length > 0) {
    const advancedCount = Object.keys(options.advancedFilters).length;
    summary.hasActiveFilters = true;
    summary.count += advancedCount;
    summary.descriptions.push(`Advanced: ${advancedCount} filter${advancedCount > 1 ? 's' : ''}`);
  }
  
  return summary;
};

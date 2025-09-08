import React, { useState, useCallback } from 'react';
import { TransactionFiltersContext } from './TransactionFiltersContext';
import { useTransactionsContext } from './TransactionsContext';

const TransactionFiltersProvider = ({ children }) => {
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [currentDateRange, setCurrentDateRange] = useState('currentMonth');
  const [advancedFilters, setAdvancedFilters] = useState({});

  // Access the old system to keep them synchronized
  const { handleFilterSelected } = useTransactionsContext();

  const handleGlobalSearch = useCallback((searchTerm) => {
    setGlobalSearchTerm(searchTerm);
    console.log('Global search:', searchTerm);
  }, []);

  const handleClearGlobalSearch = useCallback(() => {
    setGlobalSearchTerm('');
    console.log('Global search cleared');
  }, []);

  const handleDateRangeSelect = useCallback((range) => {
    setCurrentDateRange(range.value);
    console.log('Date range selected:', range);
    
    // Also update the old system to trigger data refetch
    handleFilterSelected(range.value);
  }, [handleFilterSelected]);

  const handleAdvancedFiltersApply = useCallback((filters) => {
    setAdvancedFilters(filters);
    console.log('Advanced filters applied:', filters);
  }, []);

  const clearAllFilters = useCallback(() => {
    setGlobalSearchTerm('');
    setCurrentDateRange(null);
    setAdvancedFilters({});
    console.log('All filters cleared');
  }, []);

  const value = {
    // State
    globalSearchTerm,
    currentDateRange,
    advancedFilters,
    
    // Actions
    handleGlobalSearch,
    handleClearGlobalSearch,
    handleDateRangeSelect,
    handleAdvancedFiltersApply,
    clearAllFilters,
    
    // Computed properties
    hasActiveFilters: !!(globalSearchTerm || currentDateRange || Object.keys(advancedFilters).length > 0),
    isGlobalSearchActive: !!globalSearchTerm
  };

  return (
    <TransactionFiltersContext.Provider value={value}>
      {children}
    </TransactionFiltersContext.Provider>
  );
};

export default TransactionFiltersProvider;

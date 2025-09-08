import { useContext } from 'react';
import { TransactionFiltersContext } from '../context/TransactionFiltersContext.js';

export const useTransactionFilters = () => {
  const context = useContext(TransactionFiltersContext);
  if (!context) {
    throw new Error('useTransactionFilters must be used within a TransactionFiltersProvider');
  }
  return context;
};

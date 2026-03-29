import { useMemo } from 'react';

/**
 * Unique vendor / category / unit options from loaded transactions (owner + admin lists).
 */
export function useMobileTransactionFilterOptions(transactions) {
  const vendorOptions = useMemo(() => {
    const set = new Set();
    transactions.forEach((tx) => {
      const v = tx.vendorName || tx.description;
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    transactions.forEach((tx) => {
      if (tx.categoryName) set.add(tx.categoryName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const unitOptions = useMemo(() => {
    const set = new Set();
    transactions.forEach((tx) => {
      if (tx.unitId) set.add(String(tx.unitId));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  return { vendorOptions, categoryOptions, unitOptions };
}

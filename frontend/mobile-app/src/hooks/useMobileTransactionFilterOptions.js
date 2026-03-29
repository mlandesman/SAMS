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
      if (Array.isArray(tx.allocations)) {
        tx.allocations.forEach((a) => {
          if (a.categoryName) set.add(a.categoryName);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const unitOptions = useMemo(() => {
    const set = new Set();
    const add = (u) => {
      if (u != null && u !== '') set.add(String(u));
    };
    transactions.forEach((tx) => {
      add(tx.unitId);
      if (Array.isArray(tx.allocations)) {
        tx.allocations.forEach((a) => {
          add(a.data?.unitId || a.unitId || a.data?.unit);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  return { vendorOptions, categoryOptions, unitOptions };
}

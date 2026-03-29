import { formatTransactionDate } from './transactionDisplay.js';
import { formatPesosForDisplay, centavosToPesos } from '@shared/utils/currencyUtils.js';
import { transactionMatchesAdminDatePreset } from './transactionMobileDateRanges.js';

export function transactionMatchesSearch(tx, q) {
  const raw = (q || '').trim().toLowerCase();
  if (!raw) return true;
  const amount = centavosToPesos(tx.amount ?? 0);
  const amountStr = formatPesosForDisplay(Math.abs(amount)).toLowerCase();
  const hay = [
    tx.vendorName,
    tx.description,
    tx.categoryName,
    tx.notes,
    tx.unitId,
    tx.accountName,
    tx.date,
    formatTransactionDate(tx.date),
    String(tx.amount ?? ''),
    amountStr,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return hay.some((s) => s.includes(raw));
}

/** Owner list: client-side filters only (date window comes from API). */
export function filterMobileOwnerTransactions(transactions, filters) {
  const { typeFilter, searchText, vendorFilter, categoryFilter, unitFilter } = filters;
  return transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (!transactionMatchesSearch(tx, searchText)) return false;
    if (vendorFilter) {
      const v = tx.vendorName || tx.description || '';
      if (v !== vendorFilter) return false;
    }
    if (categoryFilter && (tx.categoryName || '') !== categoryFilter) return false;
    if (unitFilter && String(tx.unitId || '') !== unitFilter) return false;
    return true;
  });
}

/** Admin list: same as owner plus optional date preset within loaded year. */
export function filterMobileAdminTransactions(transactions, filters) {
  const {
    typeFilter,
    searchText,
    vendorFilter,
    categoryFilter,
    unitFilter,
    selectedYear,
    datePreset,
  } = filters;
  return transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (!transactionMatchesSearch(tx, searchText)) return false;
    if (vendorFilter) {
      const v = tx.vendorName || tx.description || '';
      if (v !== vendorFilter) return false;
    }
    if (categoryFilter && (tx.categoryName || '') !== categoryFilter) return false;
    if (unitFilter && String(tx.unitId || '') !== unitFilter) return false;
    if (!transactionMatchesAdminDatePreset(tx.date, selectedYear, datePreset)) return false;
    return true;
  });
}

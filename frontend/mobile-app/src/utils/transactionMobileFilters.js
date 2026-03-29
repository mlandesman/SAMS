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
    formatTransactionDate(tx.date),
    String(tx.amount ?? ''),
    amountStr,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
  return hay.some((s) => s.includes(raw));
}

/** Shared type / search / vendor / category / unit checks (owner + admin). */
export function transactionMatchesBaseMobileFilters(tx, filters) {
  const { typeFilter, searchText, vendorFilter, categoryFilter, unitFilter } = filters;
  if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
  if (!transactionMatchesSearch(tx, searchText)) return false;
  if (vendorFilter) {
    const v = tx.vendorName || tx.description || '';
    if (v !== vendorFilter) return false;
  }
  if (categoryFilter && (tx.categoryName || '') !== categoryFilter) return false;
  if (unitFilter && String(tx.unitId || '') !== unitFilter) return false;
  return true;
}

/** Owner list: client-side filters only (date window comes from API). */
export function filterMobileOwnerTransactions(transactions, filters) {
  return transactions.filter((tx) => transactionMatchesBaseMobileFilters(tx, filters));
}

/** Admin list: base filters plus optional date preset within loaded year. */
export function filterMobileAdminTransactions(transactions, filters) {
  const { selectedYear, datePreset } = filters;
  return transactions.filter((tx) => {
    if (!transactionMatchesBaseMobileFilters(tx, filters)) return false;
    return transactionMatchesAdminDatePreset(tx.date, selectedYear, datePreset);
  });
}

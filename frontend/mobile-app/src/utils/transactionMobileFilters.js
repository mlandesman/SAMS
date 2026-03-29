import { formatTransactionDate } from './transactionDisplay.js';
import { formatPesosForDisplay, centavosToPesos } from '@shared/utils/currencyUtils.js';
import { transactionMatchesAdminDatePreset } from './transactionMobileDateRanges.js';

/** Match desktop TransactionsView advanced filter (extract leading unit id from "106 (Eifler)" etc.). */
function extractUnitIdForFilter(value) {
  if (value == null || value === '') return null;
  const strValue = String(value).trim();
  const unitIdMatch = strValue.match(/^([^\s(]+)/);
  return unitIdMatch ? unitIdMatch[1].trim() : strValue;
}

/**
 * Category filter: transaction.categoryName OR any allocation categoryName/categoryId
 * (split txs show "-Split-" at top level; real categories live in allocations[]).
 */
function transactionCategoryMatchesFilter(tx, categoryFilter) {
  const cf = String(categoryFilter).toLowerCase().trim();
  const txName = (tx.categoryName || '').toString().toLowerCase().trim();
  if (txName === cf) return true;
  const allocs = tx.allocations;
  if (!Array.isArray(allocs) || allocs.length === 0) return false;
  return allocs.some((alloc) => {
    const name = (alloc.categoryName || '').toString().toLowerCase().trim();
    const id = alloc.categoryId != null ? String(alloc.categoryId).toLowerCase().trim() : '';
    return name === cf || id === cf;
  });
}

/**
 * Unit filter: transaction-level unit OR allocation unit (alloc.data.unitId, etc.) — desktop parity.
 */
function transactionUnitMatchesFilter(tx, unitFilter) {
  const filterNorm = extractUnitIdForFilter(unitFilter);
  if (filterNorm == null) return true;

  let txUnit = tx.unitId ?? tx.unitNumber;
  if (txUnit == null || txUnit === '') {
    const u = tx.unit;
    if (u != null && typeof u === 'object') {
      txUnit = u.unitId ?? u.id;
    } else {
      txUnit = u;
    }
  }

  const hasTxUnit = txUnit != null && txUnit !== '';
  const transactionUnitMatches = hasTxUnit && extractUnitIdForFilter(txUnit) === filterNorm;

  let allocationUnitMatches = false;
  const allocs = tx.allocations;
  if (Array.isArray(allocs) && allocs.length > 0) {
    allocationUnitMatches = allocs.some((alloc) => {
      const allocUnitId = alloc.data?.unitId || alloc.unitId || alloc.data?.unit;
      if (allocUnitId == null || allocUnitId === '') return false;
      return extractUnitIdForFilter(allocUnitId) === filterNorm;
    });
  }

  return transactionUnitMatches || allocationUnitMatches;
}

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
  ];
  if (Array.isArray(tx.allocations)) {
    tx.allocations.forEach((a) => {
      if (a.categoryName) hay.push(a.categoryName);
      if (a.notes) hay.push(a.notes);
      const u = a.data?.unitId || a.unitId || a.data?.unit;
      if (u) hay.push(u);
    });
  }
  return hay
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .some((s) => s.includes(raw));
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
  if (categoryFilter && !transactionCategoryMatchesFilter(tx, categoryFilter)) return false;
  if (unitFilter && !transactionUnitMatchesFilter(tx, unitFilter)) return false;
  return true;
}

/** Owner list: client-side filters only (date window comes from API). */
export function filterMobileOwnerTransactions(transactions, filters) {
  return transactions.filter((tx) => transactionMatchesBaseMobileFilters(tx, filters));
}

/** Admin list: base filters plus optional date preset within loaded fiscal year. */
export function filterMobileAdminTransactions(transactions, filters) {
  const { selectedYear, datePreset, fiscalYearStartMonth } = filters;
  return transactions.filter((tx) => {
    if (!transactionMatchesBaseMobileFilters(tx, filters)) return false;
    return transactionMatchesAdminDatePreset(
      tx.date,
      selectedYear,
      datePreset,
      fiscalYearStartMonth
    );
  });
}

import { formatTransactionDate } from './transactionDisplay.js';
import { formatPesosForDisplay, centavosToPesos } from '@shared/utils/currencyUtils.js';

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

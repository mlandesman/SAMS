/**
 * Group Scotia raw rows by reference number; BBVA is 1:1 passthrough.
 */

function parseAmount(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

/**
 * @param {object[]} bankRows — raw rows from Scotia parser (pesos, positive amounts)
 * @returns {object[]} normalized row objects (without Firestore ids)
 */
export function normalizeScotiabankRows(bankRows) {
  const byRef = new Map();

  for (const row of bankRows) {
    const ref = row.referenceNumber != null ? String(row.referenceNumber) : `__noref_${row.rowIndex}`;
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref).push(row);
  }

  const normalizedRows = [];

  for (const [, group] of byRef) {
    const sum = group.reduce((acc, r) => acc + parseAmount(r.amount), 0);
    let primary = group[0];
    for (const r of group) {
      if (parseAmount(r.amount) > parseAmount(primary.amount)) primary = r;
    }
    const firstByDate = [...group].sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];

    normalizedRows.push({
      date: firstByDate.date,
      amount: sum,
      type: primary.type,
      description: primary.description || '',
      sourceRowIds: group.map((r) => r.id),
      matchStatus: 'unmatched',
      matchedTransactionId: null
    });
  }

  return normalizedRows;
}

/**
 * @param {string} bankFormat
 * @param {object[]} bankRows
 */
export function normalizeRowsForSession(bankFormat, bankRows) {
  if (bankFormat === 'bbva') {
    return bankRows.map((row) => ({
      date: row.date,
      amount: parseAmount(row.amount),
      type: row.type,
      description: row.description || '',
      sourceRowIds: [row.id],
      matchStatus: 'unmatched',
      matchedTransactionId: null
    }));
  }
  return normalizeScotiabankRows(bankRows);
}

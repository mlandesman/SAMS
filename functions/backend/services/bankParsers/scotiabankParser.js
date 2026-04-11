/**
 * ScotiaBank CSV — two variants:
 * - Legacy: no header, 14 columns (CHQ…), date/ref/amount at indices 4–7.
 * - Movimientos export: row 1 metadata, row 2 Spanish header (Fecha, Referencia, …),
 *   data rows ~9 columns: date, ref, importe, CARGO|ABONO, saldo, transacción, leyenda1, leyenda2, consecutivo.
 * Reference number groups SPEI + IVA + fees (same as legacy).
 */
import csvParser from 'csv-parser';
import { Readable } from 'stream';

function rowToArray(row) {
  const keys = Object.keys(row)
    .filter((k) => /^\d+$/.test(String(k)))
    .map(Number)
    .sort((a, b) => a - b);
  return keys.map((i) => row[String(i)] ?? '');
}

function parseDate(isoSlash) {
  const s = String(isoSlash || '').trim();
  const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseAmount(raw) {
  const s = String(raw || '').replace(/,/g, '').trim();
  if (s === '') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Legacy 14-column row: first column CHQ (cheque account line). */
function isLegacyFormatRow(cols) {
  return cols.length >= 14 && String(cols[0] || '').trim().toUpperCase() === 'CHQ';
}

/**
 * Movimientos export: date YYYY/MM/DD, numeric reference, Importe, CARGO|ABONO.
 */
function isMovimientosFormatRow(cols) {
  if (cols.length < 6) return false;
  if (!parseDate(cols[0])) return false;
  const tipo = String(cols[3] || '').trim().toUpperCase();
  if (tipo !== 'CARGO' && tipo !== 'ABONO') return false;
  return true;
}

function isHeaderRow(cols) {
  return String(cols[0] || '').trim().toLowerCase() === 'fecha';
}

/**
 * @param {Buffer} fileBuffer
 * @returns {Promise<{ bankRows: object[], errors: string[] }>}
 */
export async function parseScotiabankCSV(fileBuffer) {
  const errors = [];
  const rawRows = [];

  await new Promise((resolve, reject) => {
    Readable.from(fileBuffer)
      .pipe(csvParser({ headers: false }))
      .on('data', (row) => rawRows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  const bankRows = [];
  let rowIndex = 0;

  for (const row of rawRows) {
    rowIndex += 1;
    const cols = rowToArray(row);

    if (cols.every((c) => String(c || '').trim() === '')) {
      continue;
    }
    if (isHeaderRow(cols)) {
      continue;
    }

    if (isMovimientosFormatRow(cols)) {
      const dateIso = parseDate(cols[0]);
      const referenceNumber = String(cols[1] || '').trim() || null;
      const amount = parseAmount(cols[2]);
      const typeRaw = String(cols[3] || '').trim().toUpperCase();
      const runningBalance = cols[4] !== '' && cols[4] != null ? parseAmount(cols[4]) : null;

      if (!dateIso) {
        errors.push(`Row ${rowIndex}: invalid date "${cols[0]}"`);
        continue;
      }
      if (!Number.isFinite(amount)) {
        errors.push(`Row ${rowIndex}: invalid amount "${cols[2]}"`);
        continue;
      }

      const id = `sc-${rowIndex}-${referenceNumber || 'noref'}`;
      bankRows.push({
        id,
        rowIndex,
        date: dateIso,
        amount,
        type: typeRaw,
        description: String(cols[5] || '').trim(),
        referenceNumber,
        runningBalance: Number.isFinite(runningBalance) ? runningBalance : null,
        originBank: String(cols[6] || '').trim() || null,
        detail: String(cols[7] || '').trim() || null,
        source: 'scotiabank_csv'
      });
      continue;
    }

    if (isLegacyFormatRow(cols)) {
      const dateIso = parseDate(cols[4]);
      const referenceNumber = String(cols[5] || '').trim() || null;
      const amount = parseAmount(cols[6]);
      const typeRaw = String(cols[7] || '').trim().toUpperCase();
      const runningBalance = cols[8] !== '' && cols[8] != null ? parseAmount(cols[8]) : null;

      if (!dateIso) {
        errors.push(`Row ${rowIndex}: invalid date "${cols[4]}"`);
        continue;
      }
      if (!Number.isFinite(amount)) {
        errors.push(`Row ${rowIndex}: invalid amount "${cols[6]}"`);
        continue;
      }
      if (typeRaw !== 'ABONO' && typeRaw !== 'CARGO') {
        errors.push(`Row ${rowIndex}: type must be ABONO or CARGO, got "${cols[7]}"`);
        continue;
      }

      const id = `sc-${rowIndex}-${referenceNumber || 'noref'}`;
      bankRows.push({
        id,
        rowIndex,
        date: dateIso,
        amount,
        type: typeRaw,
        description: String(cols[9] || '').trim(),
        referenceNumber,
        runningBalance: Number.isFinite(runningBalance) ? runningBalance : null,
        originBank: String(cols[10] || '').trim() || null,
        detail: String(cols[11] || '').trim() || null,
        source: 'scotiabank_csv'
      });
      continue;
    }

    // Metadata (account summary line) or unknown layout — skip without error
  }

  return { bankRows, errors };
}

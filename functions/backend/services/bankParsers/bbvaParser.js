/**
 * BBVA account movements XLSX — header row, flexible column detection.
 */
import ExcelJS from 'exceljs';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findColumnIndex(headerRow, candidates) {
  const values = headerRow.values || [];
  for (let c = 1; c < values.length; c++) {
    const cell = norm(values[c]);
    for (const cand of candidates) {
      if (cell.includes(norm(cand))) return c;
    }
  }
  return null;
}

/**
 * Pick one date column. BBVA may include **liquidación / LIQ** — we ignore it when a better column exists
 * (fecha operación, plain FECHA, etc.). Liquidación is only used if it is the only date-like header.
 */
function findTransactionDateColumnIndex(headerRow) {
  const values = headerRow.values || [];
  const scored = [];
  for (let c = 1; c < values.length; c++) {
    const cell = norm(values[c]);
    if (!cell) continue;
    const hasOper =
      /\boper\b/.test(cell) ||
      cell.includes('operacion') ||
      cell.includes('operación');
    const isLiqish =
      cell.includes('liquid') ||
      /\bliq\b/.test(cell) ||
      cell.includes('liquidacion') ||
      cell.includes('liquidación');
    const hasFecha = cell.includes('fecha');
    if (!hasFecha && !hasOper) continue;
    let priority;
    if (hasOper) priority = 0;
    else if (isLiqish) priority = 2;
    else priority = 1;
    scored.push({ c, priority });
  }
  if (scored.length === 0) return null;
  scored.sort((a, b) => a.priority - b.priority || a.c - b.c);
  return scored[0].c;
}

function cellToString(cell) {
  if (cell == null || cell === '') return '';
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'object' && cell.text) return String(cell.text);
  return String(cell);
}

function parseDateFromCell(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    /**
     * Excel date cells are date-only business values.
     * Use UTC parts to avoid local-timezone day shifts (e.g. 2026-01-09 becoming 2026-01-08).
     */
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = cellToString(val).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // BBVA México: cell text is DD/MM/YYYY (capture[1]=day, [2]=month) → ISO YYYY-MM-DD
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  return null;
}

/**
 * BBVA / manual sheet amounts: `12,600.00` (US), `13.200,00` (EU comma decimal),
 * or mistaken double-dot `13.200.00` (thousands + `.00` cents) — plain `Number()` fails on the last.
 */
function parseAmountNumber(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/\s/g, '').trim();
  if (s === '') return NaN;

  // US-style: commas as thousands, dot as decimal (e.g. 12,600.00)
  if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(s) && s.includes('.') && s.lastIndexOf('.') > s.lastIndexOf(',')) {
    return Number(s.replace(/,/g, ''));
  }

  // European-style: dots as thousands, comma as decimal (e.g. 13.200,00)
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) {
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }

  // Typo / mixed locale: 13.200.00 meaning 13,200.00 MXN
  const dotParts = s.split('.');
  if (dotParts.length >= 3 && /^\d{1,2}$/.test(dotParts[dotParts.length - 1])) {
    const dec = dotParts.pop();
    const intPart = dotParts.join('');
    const n = Number(`${intPart}.${dec}`);
    if (Number.isFinite(n)) return n;
  }

  return Number(s.replace(/,/g, ''));
}

/**
 * @param {Buffer} fileBuffer
 * @returns {Promise<{ bankRows: object[], errors: string[] }>}
 */
export async function parseBBVAXLSX(fileBuffer) {
  const errors = [];
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { bankRows: [], errors: ['No worksheet found in XLSX'] };
  }

  let headerRowNum = 1;
  let dateCol;
  let amountCol;
  let descCol;
  let cargoCol;
  let abonoCol;

  for (let r = 1; r <= Math.min(30, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    dateCol = findTransactionDateColumnIndex(row);
    amountCol =
      findColumnIndex(row, ['importe', 'monto', 'amount']) ||
      findColumnIndex(row, ['cargo', 'abono']);
    descCol = findColumnIndex(row, ['concepto', 'descripcion', 'descripción', 'detalle']);
    cargoCol = findColumnIndex(row, ['cargo']);
    abonoCol = findColumnIndex(row, ['abono', 'deposito', 'depósito', 'credito', 'crédito']);

    if (dateCol && (amountCol || (cargoCol && abonoCol))) {
      headerRowNum = r;
      break;
    }
  }

  if (!dateCol) {
    return {
      bankRows: [],
      errors: ['Could not find transaction date column in BBVA XLSX']
    };
  }

  const bankRows = [];

  for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const dateVal = row.getCell(dateCol).value;
    const dateIso = parseDateFromCell(dateVal);
    if (!dateIso) continue;

    let amountPesos = 0;
    let type = 'CARGO';

    if (cargoCol != null && abonoCol != null) {
      const cargo = parseAmountNumber(row.getCell(cargoCol).value);
      const abono = parseAmountNumber(row.getCell(abonoCol).value);
      const c = Number.isFinite(cargo) ? Math.abs(cargo) : 0;
      const a = Number.isFinite(abono) ? Math.abs(abono) : 0;
      if (a > c) {
        amountPesos = a;
        type = 'ABONO';
      } else if (c > 0) {
        amountPesos = c;
        type = 'CARGO';
      } else {
        errors.push(`Row ${r}: no cargo/abono amount`);
        continue;
      }
    } else if (amountCol != null) {
      const raw = row.getCell(amountCol).value;
      const n = parseAmountNumber(raw);
      if (!Number.isFinite(n) || n === 0) {
        continue;
      }
      amountPesos = Math.abs(n);
      type = n >= 0 ? 'ABONO' : 'CARGO';
    } else {
      errors.push('BBVA parse: missing amount columns');
      break;
    }

    const description = descCol != null ? cellToString(row.getCell(descCol).value) : '';

    const id = `bbva-${r}`;
    bankRows.push({
      id,
      rowIndex: r,
      date: dateIso,
      amount: amountPesos,
      type,
      description: description.trim(),
      referenceNumber: null,
      runningBalance: null,
      originBank: null,
      detail: null,
      source: 'bbva_xlsx'
    });
  }

  return { bankRows, errors };
}

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

function cellToString(cell) {
  if (cell == null || cell === '') return '';
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'object' && cell.text) return String(cell.text);
  return String(cell);
}

function parseDateFromCell(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
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

function parseAmountNumber(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/,/g, '').replace(/\s/g, '').trim();
  if (s === '') return NaN;
  return Number(s);
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
  let liqCol;
  let amountCol;
  let descCol;
  let cargoCol;
  let abonoCol;

  for (let r = 1; r <= Math.min(30, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    liqCol = findColumnIndex(row, ['liq', 'liquidacion', 'liquidación', 'fecha liq']);
    const operCol = findColumnIndex(row, ['oper', 'fecha oper']);
    amountCol =
      findColumnIndex(row, ['importe', 'monto', 'amount']) ||
      findColumnIndex(row, ['cargo', 'abono']);
    descCol = findColumnIndex(row, ['concepto', 'descripcion', 'descripción', 'detalle']);
    cargoCol = findColumnIndex(row, ['cargo']);
    abonoCol = findColumnIndex(row, ['abono', 'deposito', 'depósito', 'credito', 'crédito']);

    if (liqCol && (amountCol || (cargoCol && abonoCol))) {
      headerRowNum = r;
      break;
    }
  }

  if (!liqCol) {
    return {
      bankRows: [],
      errors: ['Could not find LIQ / settlement date column in BBVA XLSX']
    };
  }

  const bankRows = [];

  for (let r = headerRowNum + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const liqVal = row.getCell(liqCol).value;
    const dateIso = parseDateFromCell(liqVal);
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

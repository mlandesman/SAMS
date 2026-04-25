const FIXED_VALUE_TRANSLATIONS = {
  type: {
    income: { EN: 'Income', ES: 'Ingreso' },
    expense: { EN: 'Expense', ES: 'Gasto' },
    payment: { EN: 'Payment', ES: 'Pago' },
    deposit: { EN: 'Deposit', ES: 'Depósito' },
    withdrawal: { EN: 'Withdrawal', ES: 'Retiro' },
    transfer: { EN: 'Transfer', ES: 'Transferencia' },
  },
  status: {
    draft: { EN: 'Draft', ES: 'Borrador' },
    open: { EN: 'Open', ES: 'Abierto' },
    closed: { EN: 'Closed', ES: 'Cerrado' },
    archived: { EN: 'Archived', ES: 'Archivado' },
    approved: { EN: 'Approved', ES: 'Aprobado' },
    denied: { EN: 'Denied', ES: 'Denegado' },
    'in-progress': { EN: 'In Progress', ES: 'En Progreso' },
    pending: { EN: 'Pending', ES: 'Pendiente' },
    active: { EN: 'Active', ES: 'Activo' },
    completed: { EN: 'Completed', ES: 'Completado' },
    cancelled: { EN: 'Cancelled', ES: 'Cancelado' },
    rejected: { EN: 'Rejected', ES: 'Rechazado' },
    selected: { EN: 'Selected', ES: 'Seleccionado' },
    unbilled: { EN: 'Unbilled', ES: 'Sin Facturar' },
    unpaid: { EN: 'Unpaid', ES: 'Sin Pagar' },
  },
};

const DOMAIN_TEXT_TRANSLATIONS_ES = [
  ['HOA Penalty', 'Penalización de Mantenimiento'],
  ['HOA Dues', 'Cuotas de Mantenimiento'],
  ['Water Penalty', 'Penalización de Agua'],
  ['Water Bill', 'Factura de Agua'],
  ['Water Consumption', 'Consumo de Agua'],
  ['Special Assessments', 'Cuotas Especiales'],
  ['Opening Balance', 'Balance Inicial'],
  ['Payment -', 'Pago -'],
  ['Payment Months', 'Pago Meses'],
  ['Payment Month', 'Pago Mes'],
  ['Payment', 'Pago'],
  ['Deposit', 'Depósito'],
  ['Applied', 'Aplicado'],
  ['Maintenance', 'Mantenimiento'],
  ['Credit', 'Crédito'],
  ['Charge', 'Cargo'],
  ['Water', 'Agua'],
  ['HOA', 'Mantenimiento'],
  ['Dues', 'Cuotas'],
  ['Q4', 'T4'],
  ['Q3', 'T3'],
  ['Q2', 'T2'],
  ['Q1', 'T1'],
];

const ENGLISH_MONTH_REPLACEMENTS_ES = [
  ['January', 'Enero'],
  ['February', 'Febrero'],
  ['March', 'Marzo'],
  ['April', 'Abril'],
  ['May', 'Mayo'],
  ['June', 'Junio'],
  ['July', 'Julio'],
  ['August', 'Agosto'],
  ['September', 'Septiembre'],
  ['October', 'Octubre'],
  ['November', 'Noviembre'],
  ['December', 'Diciembre'],
  ['Jan', 'Ene'],
  ['Apr', 'Abr'],
  ['Aug', 'Ago'],
  ['Dec', 'Dic'],
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyLocalizedPhraseMap(value, replacements) {
  let nextValue = value;
  for (const [source, target] of replacements) {
    const pattern = new RegExp(escapeRegex(source), 'gi');
    nextValue = nextValue.replace(pattern, target);
  }
  return nextValue;
}

export function localizeFixedValue(domain, value, language) {
  if (value === null || value === undefined) {
    return value;
  }

  const normalizedDomain = String(domain || '').trim();
  const normalizedValue = String(value).trim();
  const valueKey = normalizedValue.toLowerCase();
  const lang = language === 'ES' ? 'ES' : 'EN';

  const translated = FIXED_VALUE_TRANSLATIONS[normalizedDomain]?.[valueKey]?.[lang];
  return translated || normalizedValue;
}

export function localizeDomainDisplayText(value, language) {
  const source = value == null ? '' : String(value);
  if (language !== 'ES' || !source) {
    return source;
  }

  const translated = applyLocalizedPhraseMap(source, DOMAIN_TEXT_TRANSLATIONS_ES);
  return applyLocalizedPhraseMap(translated, ENGLISH_MONTH_REPLACEMENTS_ES);
}


/**
 * Deterministic client-facing messages for credit history entries (EN + ES).
 *
 * @module shared/utils/creditUserMessage
 */

/** Patterns that indicate internal/audit phrasing unsuitable for owner-facing statements. */
const INTERNAL_NOTE_PATTERNS = [
  /\|\s*Amount:/i,
  /\|\s*New Balance:/i,
  /\|\s*Source:/i,
  /\|\s*Transaction:/i,
  /centavos/i,
  /\bPAY-[A-Z0-9-]+\b/i,
  /\(overpayment/i,
  /repair \+\$/i,
  /credit used \$/i,
  /\bTXN[-:]/i
];

/** Maximum length for notes considered concise enough for direct client display. */
const USER_FRIENDLY_MAX_LENGTH = 100;

/** @typedef {{ en: string, es: string }} BilingualMessage */

/**
 * Hand-crafted bilingual templates keyed by source/type.
 * English values unchanged from Task 1.1 (User-approved).
 */
const SOURCE_TYPE_MESSAGES = Object.freeze({
  unifiedPayment: {
    credit_added: { en: 'Credit added from overpayment', es: 'Crédito agregado por pago en exceso' },
    credit_used: { en: 'Credit applied to payment', es: 'Crédito aplicado al pago' },
    payment: { en: 'Credit applied to payment', es: 'Crédito aplicado al pago' },
    adjustment: { en: 'Credit adjustment', es: 'Ajuste de crédito' }
  },
  hoaDues: {
    credit_added: { en: 'Credit added from HOA dues payment', es: 'Crédito agregado por pago de cuotas de mantenimiento' },
    credit_used: { en: 'Credit applied to HOA dues', es: 'Crédito aplicado a cuotas de mantenimiento' },
    payment: { en: 'Credit applied to HOA dues', es: 'Crédito aplicado a cuotas de mantenimiento' },
    adjustment: { en: 'Credit adjustment', es: 'Ajuste de crédito' }
  },
  waterBills: {
    credit_added: { en: 'Credit added from water bill payment', es: 'Crédito agregado por pago de factura de agua' },
    credit_used: { en: 'Credit applied to water bills', es: 'Crédito aplicado a facturas de agua' },
    payment: { en: 'Credit applied to water bills', es: 'Crédito aplicado a facturas de agua' },
    adjustment: { en: 'Credit adjustment', es: 'Ajuste de crédito' }
  },
  admin: {
    credit_added: { en: 'Credit adjustment', es: 'Ajuste de crédito' },
    credit_used: { en: 'Credit adjustment', es: 'Ajuste de crédito' },
    adjustment: { en: 'Credit adjustment', es: 'Ajuste de crédito' }
  },
  reconciliation: {
    credit_added: { en: 'Reconciliation credit added', es: 'Crédito de conciliación agregado' },
    credit_used: { en: 'Reconciliation credit applied', es: 'Crédito de conciliación aplicado' },
    adjustment: { en: 'Reconciliation adjustment', es: 'Ajuste de conciliación' }
  },
  correction: {
    credit_added: { en: 'Credit correction', es: 'Corrección de crédito' },
    credit_used: { en: 'Credit correction', es: 'Corrección de crédito' },
    adjustment: { en: 'Credit correction', es: 'Corrección de crédito' }
  },
  running_balance_computation: {
    credit_added: { en: 'Balance reconciliation', es: 'Conciliación de saldo' },
    credit_used: { en: 'Balance reconciliation', es: 'Conciliación de saldo' },
    adjustment: { en: 'Balance reconciliation', es: 'Conciliación de saldo' }
  },
  year_end_rollover: {
    credit_added: { en: 'Year-end credit rollover', es: 'Traspaso de crédito de fin de año' },
    credit_used: { en: 'Year-end credit applied', es: 'Crédito de fin de año aplicado' },
    adjustment: { en: 'Year-end credit adjustment', es: 'Ajuste de crédito de fin de año' }
  },
  import: {
    credit_added: { en: 'Imported credit entry', es: 'Entrada de crédito importada' },
    credit_used: { en: 'Imported credit entry', es: 'Entrada de crédito importada' },
    adjustment: { en: 'Imported credit entry', es: 'Entrada de crédito importada' }
  },
  imported: {
    credit_added: { en: 'Imported credit entry', es: 'Entrada de crédito importada' },
    credit_used: { en: 'Imported credit entry', es: 'Entrada de crédito importada' },
    adjustment: { en: 'Imported credit entry', es: 'Entrada de crédito importada' }
  }
});

const DEFAULT_TYPE_MESSAGES = Object.freeze({
  credit_added: { en: 'Credit added to account', es: 'Crédito agregado a la cuenta' },
  credit_used: { en: 'Credit applied to charges', es: 'Crédito aplicado a cargos' },
  payment: { en: 'Credit applied to charges', es: 'Crédito aplicado a cargos' },
  adjustment: { en: 'Credit adjustment', es: 'Ajuste de crédito' },
  starting_balance: { en: 'Opening credit balance', es: 'Saldo a favor inicial' }
});

/** Flat EN → ES lookup for backfill deterministic matching of persisted userMessage strings. */
const EN_TO_ES_TEMPLATE_LOOKUP = (() => {
  const map = new Map();
  for (const messages of Object.values(SOURCE_TYPE_MESSAGES)) {
    for (const msg of Object.values(messages)) {
      map.set(msg.en, msg.es);
    }
  }
  for (const msg of Object.values(DEFAULT_TYPE_MESSAGES)) {
    map.set(msg.en, msg.es);
  }
  return map;
})();

/**
 * @param {string} [notes]
 * @returns {boolean}
 */
export function isNotesUserFriendly(notes) {
  if (!notes || typeof notes !== 'string') {
    return false;
  }

  const trimmed = notes.trim();
  if (!trimmed || trimmed.length > USER_FRIENDLY_MAX_LENGTH) {
    return false;
  }

  return !INTERNAL_NOTE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * @param {{ source?: string, type?: string }} params
 * @returns {BilingualMessage}
 */
export function getAutogeneratedUserMessageBilingual({ source, type }) {
  const normalizedSource = String(source || '').trim();
  const normalizedType = String(type || 'adjustment').trim();

  const sourceMessages = SOURCE_TYPE_MESSAGES[normalizedSource];
  if (sourceMessages) {
    return sourceMessages[normalizedType]
      || sourceMessages.adjustment
      || DEFAULT_TYPE_MESSAGES[normalizedType]
      || DEFAULT_TYPE_MESSAGES.adjustment;
  }

  return DEFAULT_TYPE_MESSAGES[normalizedType] || DEFAULT_TYPE_MESSAGES.adjustment;
}

/**
 * @param {{ source?: string, type?: string }} params
 * @returns {string}
 */
export function getAutogeneratedUserMessage({ source, type }) {
  return getAutogeneratedUserMessageBilingual({ source, type }).en;
}

/**
 * @param {{ source?: string, type?: string }} params
 * @returns {string}
 */
export function getAutogeneratedUserMessageEs({ source, type }) {
  return getAutogeneratedUserMessageBilingual({ source, type }).es;
}

/**
 * Deterministic ES for a known EN template string (backfill / legacy).
 * @param {string} englishText
 * @returns {string|null}
 */
export function lookupSpanishForEnglishTemplate(englishText) {
  const key = String(englishText || '').trim();
  if (!key) return null;
  return EN_TO_ES_TEMPLATE_LOOKUP.get(key) || null;
}

/**
 * @param {{ notes?: string, source?: string, type?: string, userMessage?: string, userMessage_es?: string }} params
 * @returns {{ userMessage: string, userMessage_es: string }}
 */
export function computeUserMessageForWrite({ notes, source, type, userMessage, userMessage_es }) {
  const hasExplicitEn = userMessage !== undefined && userMessage !== null;
  const hasExplicitEs = userMessage_es !== undefined && userMessage_es !== null;
  const explicitEn = hasExplicitEn ? String(userMessage).trim() : '';
  const explicitEs = hasExplicitEs ? String(userMessage_es).trim() : '';
  const bilingual = getAutogeneratedUserMessageBilingual({ source, type });

  if (hasExplicitEn || hasExplicitEs) {
    return {
      userMessage: hasExplicitEn ? (explicitEn || bilingual.en) : bilingual.en,
      userMessage_es: hasExplicitEs ? explicitEs : bilingual.es
    };
  }

  if (isNotesUserFriendly(notes)) {
    return {
      userMessage: notes.trim(),
      userMessage_es: lookupSpanishForEnglishTemplate(notes.trim()) || ''
    };
  }

  return {
    userMessage: bilingual.en,
    userMessage_es: bilingual.es
  };
}

/**
 * @param {{ userMessage?: string, userMessage_es?: string, notes?: string, source?: string, type?: string }} entry
 * @returns {string}
 */
export function resolveCreditUserMessage({ userMessage, userMessage_es, notes, source, type }) {
  if (userMessage && typeof userMessage === 'string' && userMessage.trim()) {
    return userMessage.trim();
  }

  if (isNotesUserFriendly(notes)) {
    return notes.trim();
  }

  return getAutogeneratedUserMessage({ source, type });
}

/**
 * @param {{ userMessage?: string, userMessage_es?: string, notes?: string, source?: string, type?: string }} entry
 * @returns {string}
 */
export function resolveCreditUserMessageEs({ userMessage, userMessage_es, notes, source, type }) {
  if (userMessage_es && typeof userMessage_es === 'string' && userMessage_es.trim()) {
    return userMessage_es.trim();
  }

  const resolvedEn = resolveCreditUserMessage({ userMessage, notes, source, type });
  const fromTemplate = lookupSpanishForEnglishTemplate(resolvedEn);
  if (fromTemplate) {
    return fromTemplate;
  }

  return getAutogeneratedUserMessageEs({ source, type });
}

/**
 * Pick locale-appropriate client message for statement rendering.
 * @param {{ userMessage?: string, userMessage_es?: string, notes?: string, source?: string, type?: string }} entry
 * @param {'english'|'spanish'|'es'|'en'} language
 * @returns {string}
 */
export function resolveCreditUserMessageForLocale(entry, language) {
  const isSpanish = language === 'spanish' || language === 'es';
  return isSpanish
    ? resolveCreditUserMessageEs(entry)
    : resolveCreditUserMessage(entry);
}

/** All bilingual templates (for tests). */
export function getAllCreditUserMessageTemplates() {
  const templates = [];
  for (const messages of Object.values(SOURCE_TYPE_MESSAGES)) {
    for (const msg of Object.values(messages)) {
      templates.push({ ...msg });
    }
  }
  for (const msg of Object.values(DEFAULT_TYPE_MESSAGES)) {
    templates.push({ ...msg });
  }
  return templates;
}

import { translateToSpanish } from '../controllers/translateController.js';

const MONTH_RULES = [
  [/\bJanuary\b/gi, 'Enero'],
  [/\bFebruary\b/gi, 'Febrero'],
  [/\bMarch\b/gi, 'Marzo'],
  [/\bApril\b/gi, 'Abril'],
  [/\bMay\b/gi, 'Mayo'],
  [/\bJune\b/gi, 'Junio'],
  [/\bJuly\b/gi, 'Julio'],
  [/\bAugust\b/gi, 'Agosto'],
  [/\bSeptember\b/gi, 'Septiembre'],
  [/\bOctober\b/gi, 'Octubre'],
  [/\bNovember\b/gi, 'Noviembre'],
  [/\bDecember\b/gi, 'Diciembre'],
];

const DETERMINISTIC_RULES = [
  [/\bMain expense\b/gi, 'Gasto principal'],
  [/\bBank transfer fee\b/gi, 'Tarifa de transferencia bancaria'],
  [/\bBank transfer IVA\b/gi, 'Transferencia Bancaria IVA'],
  [/\(includes transfer fees\)/gi, '(incluye gastos de transferencia)'],
  [/\bOpening Balance\b/gi, 'Balance Inicial'],
  [/\bWater Bill\b/gi, 'Factura de Agua'],
  [/\bWater Consumption\b/gi, 'Consumo de Agua'],
  [/\bPayment Months\b/gi, 'Pago Meses'],
  [/\bPayment Month\b/gi, 'Pago Mes'],
  [/\bPayment\b/gi, 'Pago'],
  [/\bDeposit\b/gi, 'Deposito'],
  [/\bApplied\b/gi, 'Aplicado'],
  [/\bCredit\b/gi, 'Credito'],
  [/\bCharge\b/gi, 'Cargo'],
  [/\bMaintenance\b/gi, 'Mantenimiento'],
  [/\bSpecial Assessments\b/gi, 'Cuotas Especiales'],
  [/\bWater\b/gi, 'Agua'],
  [/\bDues\b/gi, 'Cuotas'],
];

function normalizeForTranslation(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function applyCompactQuarterNotation(text) {
  return text
    .replace(/\bQuarter\s*([1-4])\b/gi, 'T$1')
    .replace(/\bQ([1-4])\b/g, 'T$1');
}

function applyRegexRules(text, rules) {
  return rules.reduce((nextText, [pattern, replacement]) => nextText.replace(pattern, replacement), text);
}

function preserveAllCapsTokenPhrases(text) {
  // Preserve ALL-CAPS domain tokens like HOA while localizing trailing terms.
  return text
    .replace(/\b([A-Z]{2,})\s+Dues\b/g, '$1 Cuotas')
    .replace(/\b([A-Z]{2,})\s+Penalty\b/g, '$1 Penalizacion');
}

export function deterministicTranslateNoteToSpanish(note) {
  const source = normalizeForTranslation(note);
  if (!source) {
    return { translatedText: '', resolved: false };
  }

  let translated = source;
  translated = preserveAllCapsTokenPhrases(translated);
  translated = applyRegexRules(translated, DETERMINISTIC_RULES);
  translated = applyCompactQuarterNotation(translated);
  translated = applyRegexRules(translated, MONTH_RULES);

  return {
    translatedText: translated,
    resolved: translated !== source,
  };
}

export async function translateNoteToSpanishDeterministicFirst(note) {
  const source = normalizeForTranslation(note);
  if (!source) {
    return '';
  }

  const deterministic = deterministicTranslateNoteToSpanish(source);
  if (deterministic.resolved) {
    return deterministic.translatedText;
  }

  const deepLResult = await translateToSpanish(source);
  if (deepLResult?.success && deepLResult.translatedText) {
    return normalizeForTranslation(deepLResult.translatedText);
  }

  return source;
}

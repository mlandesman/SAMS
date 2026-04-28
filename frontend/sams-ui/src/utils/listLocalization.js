const EMPTY_FALLBACK = '';

function normalizeLanguage(language) {
  return language === 'ES' ? 'ES' : 'EN';
}

function pickFirstNonEmptyValue(values = []) {
  for (const value of values) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function getItemValue(item, path) {
  if (!item || !path) return undefined;
  if (!path.includes('.')) {
    return item[path];
  }

  return path.split('.').reduce((current, segment) => {
    if (current == null) return undefined;
    return current[segment];
  }, item);
}

/**
 * Paired-language contract for desktop list CRUD read surfaces.
 * - Base fields are canonical values.
 * - Companion fields are additive Spanish variants used when ES + localization flag enabled.
 * - Fallback always returns readable source values (never blank-by-design).
 */
export const LIST_ENTITY_LANGUAGE_CONTRACT = {
  category: {
    name: { base: ['name'], companions: ['name_es', 'nameLocalized'] },
    description: { base: ['description'], companions: ['description_es', 'descriptionLocalized'] },
    type: { base: ['type'], companions: ['type_es'] },
  },
  unit: {
    unitName: { base: ['unitName', 'unitId'], companions: ['unitName_es', 'unitNameLocalized'] },
    address: { base: ['address'], companions: ['address_es', 'addressLocalized'] },
    propertyType: { base: ['propertyType', 'type'], companions: ['propertyType_es', 'type_es'] },
    status: { base: ['status'], companions: ['status_es', 'statusLocalized'] },
    notes: { base: ['notes'], companions: ['notes_es', 'notesLocalized'] },
  },
};

export function isSpanishCompanionMode(language, localizationEnabled) {
  return normalizeLanguage(language) === 'ES' && localizationEnabled === true;
}

export function resolveListEntityField(item, entity, field, options = {}) {
  const { language = 'EN', localizationEnabled = false, hardFallback = EMPTY_FALLBACK } = options;
  const resolvedLanguage = normalizeLanguage(language);
  const fieldContract = LIST_ENTITY_LANGUAGE_CONTRACT[entity]?.[field];

  if (!fieldContract) {
    return hardFallback;
  }

  const baseValue = pickFirstNonEmptyValue(fieldContract.base.map((key) => getItemValue(item, key)));
  const companionValue = pickFirstNonEmptyValue(
    fieldContract.companions.map((key) => getItemValue(item, key))
  );

  if (resolvedLanguage === 'ES' && localizationEnabled && companionValue) {
    return companionValue;
  }

  return baseValue || companionValue || hardFallback;
}

/**
 * Build write payload for list entities when editing in Spanish mode.
 * In ES + localization mode:
 * - write current field value to companion key
 * - preserve existing base key on edits when base source exists
 */
export function buildListEntityWritePayload(entity, draft, source = {}, options = {}) {
  const payload = { ...(draft || {}) };
  const companionMode = isSpanishCompanionMode(options.language, options.localizationEnabled);

  if (!companionMode) {
    return payload;
  }

  const contract = LIST_ENTITY_LANGUAGE_CONTRACT[entity] || {};

  Object.values(contract).forEach((fieldContract) => {
    const baseKey = fieldContract?.base?.[0];
    const companionKey = fieldContract?.companions?.[0];
    if (!baseKey || !companionKey) return;
    if (baseKey.includes('.') || companionKey.includes('.')) return;

    if (!Object.prototype.hasOwnProperty.call(payload, baseKey)) return;

    payload[companionKey] = payload[baseKey];

    const sourceBaseValue = source?.[baseKey];
    if (sourceBaseValue != null && String(sourceBaseValue).trim() !== '') {
      payload[baseKey] = sourceBaseValue;
    }
  });

  return payload;
}


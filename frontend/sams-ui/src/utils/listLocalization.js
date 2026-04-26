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
  vendor: {
    name: { base: ['name'], companions: ['name_es', 'nameLocalized'] },
    category: { base: ['category'], companions: ['category_es', 'categoryName_es', 'categoryLocalized'] },
    notes: { base: ['notes'], companions: ['notes_es', 'notesLocalized'] },
    address: { base: ['address', 'contact.address'], companions: ['address_es'] },
    contactPerson: { base: ['contactPerson', 'contact.contactPerson'], companions: ['contactPerson_es'] },
  },
  category: {
    name: { base: ['name'], companions: ['name_es', 'nameLocalized'] },
    description: { base: ['description'], companions: ['description_es', 'descriptionLocalized'] },
    type: { base: ['type'], companions: ['type_es'] },
  },
  method: {
    name: { base: ['name'], companions: ['name_es', 'nameLocalized'] },
    type: { base: ['type'], companions: ['type_es', 'typeLocalized'] },
    details: { base: ['details'], companions: ['details_es', 'detailsLocalized'] },
    description: { base: ['description'], companions: ['description_es', 'descriptionLocalized'] },
    institution: { base: ['institution'], companions: ['institution_es', 'institutionLocalized'] },
  },
  unit: {
    unitName: { base: ['unitName', 'unitId'], companions: ['unitName_es', 'unitNameLocalized'] },
    address: { base: ['address', 'unitId'], companions: ['address_es', 'addressLocalized'] },
    propertyType: { base: ['propertyType', 'type'], companions: ['propertyType_es', 'type_es'] },
    status: { base: ['status'], companions: ['status_es', 'statusLocalized'] },
    notes: { base: ['notes', 'unitId'], companions: ['notes_es', 'notesLocalized'] },
  },
};

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


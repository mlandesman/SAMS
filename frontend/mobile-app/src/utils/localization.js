export function getLanguageHeaders(preferredLanguageUi) {
  // Use query-based language signaling to avoid CORS preflight header allowlist issues.
  void preferredLanguageUi;
  return {};
}

export function getLanguageQuery(preferredLanguageUi) {
  return `lang=${preferredLanguageUi === 'ES' ? 'ES' : 'EN'}`;
}

function asDisplayText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim() ? value : '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function pickLocalized(localizedValue, sourceValue) {
  const localizedText = asDisplayText(localizedValue);
  if (localizedText) return localizedText;
  return asDisplayText(sourceValue);
}

export function resolveLocalizedField(record, fieldName) {
  if (!record || typeof record !== 'object') return '';
  return pickLocalized(record[`${fieldName}Localized`], record[fieldName]);
}

export function firstNonEmpty(values, fallback = '') {
  for (const value of values) {
    const normalized = asDisplayText(value);
    if (normalized) return normalized;
  }
  return asDisplayText(fallback);
}

export function formatLocalizedDateFallback(dateValue, preferredLanguageUi, options = {}) {
  if (!dateValue) return '';
  const locale = preferredLanguageUi === 'ES' ? 'es-MX' : 'en-US';
  const formatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  };

  let source = dateValue;
  if (typeof dateValue === 'object' && dateValue !== null) {
    source = dateValue.ISO_8601 || dateValue.date || dateValue.raw || null;
  }
  if (!source) return '';

  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(locale, formatOptions).format(parsed);
}


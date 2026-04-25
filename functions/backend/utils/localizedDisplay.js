function resolveLocale(language) {
  return language === 'ES' ? 'es-MX' : 'en-US';
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const parsed = value.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    if (value.iso) {
      const parsed = new Date(value.iso);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (value.ISO_8601) {
      const parsed = new Date(value.ISO_8601);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value.seconds === 'number') {
      const parsed = new Date(value.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value._seconds === 'number') {
      const parsed = new Date(value._seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  return null;
}

export function formatLocalizedDateDisplay(value, language, options = {}) {
  const parsedDate = toDate(value);
  if (!parsedDate) return '';

  const locale = resolveLocale(language);
  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...options,
  });
  return formatter.format(parsedDate);
}

export function formatLocalizedAmountDisplay(value, language, options = {}) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';

  const locale = resolveLocale(language);
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
  return formatter.format(numeric);
}

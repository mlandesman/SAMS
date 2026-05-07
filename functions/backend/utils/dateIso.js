function isIsoDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function toIsoDateOrNull(value, dateService) {
  if (!value) return null;

  if (typeof value === 'string') {
    const s = value.trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }

  if (!dateService || typeof dateService.formatForFrontend !== 'function') {
    return null;
  }

  try {
    const formatted = dateService.formatForFrontend(value);
    const iso = formatted?.ISO_8601 || null;
    return isIsoDateString(iso) ? iso : null;
  } catch {
    return null;
  }
}

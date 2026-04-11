/**
 * Shared labels for stored Statement of Account rows (mobile PWA) — #251
 */

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function languageSuffix(language) {
  return (language || 'english').toLowerCase() === 'spanish' ? 'ES' : 'EN';
}

export function formatStoredStatementLabel(s) {
  const lang = languageSuffix(s.language);
  const m = Number(s.calendarMonth);
  const monthName = MONTH_NAMES[m] || `Month ${s.calendarMonth}`;
  return `${monthName} ${s.calendarYear} (${lang})`;
}

/**
 * Deduplicate by calendar year + month + language; keep newest reportGenerated.
 */
export function buildStoredStatementOptions(statements) {
  const deduped = new Map();
  for (const s of statements || []) {
    const lang = languageSuffix(s.language);
    const key = `${s.calendarYear}-${s.calendarMonth}-${lang}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, s);
      continue;
    }
    const existingTime = existing.reportGenerated?._seconds || 0;
    const currentTime = s.reportGenerated?._seconds || 0;
    if (currentTime > existingTime) deduped.set(key, s);
  }
  return Array.from(deduped.values())
    .map((row) => ({ ...row, label: formatStoredStatementLabel(row) }))
    .sort((a, b) => {
      if (b.calendarYear !== a.calendarYear) return b.calendarYear - a.calendarYear;
      if (b.calendarMonth !== a.calendarMonth) return b.calendarMonth - a.calendarMonth;
      return languageSuffix(b.language).localeCompare(languageSuffix(a.language));
    });
}

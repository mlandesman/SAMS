/**
 * Shared labels for mobile stored Statement of Account rows (issue #251).
 * Firestore accountStatements: calendarMonth 1-12, calendarYear, language, storageUrl, etc.
 */

const MONTH_NAMES_EN = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function statementLanguageCode(statement) {
  if (!statement) return 'EN';
  const lang = (statement.language || 'english').toLowerCase();
  return lang === 'spanish' ? 'ES' : 'EN';
}

export function formatStoredStatementLabel(statement) {
  const langLabel = statementLanguageCode(statement);
  const m = statement?.calendarMonth;
  const monthNum = typeof m === 'number' ? m : parseInt(String(m ?? ''), 10);
  const monthName = (monthNum >= 1 && monthNum <= 12)
    ? MONTH_NAMES_EN[monthNum]
    : (m != null && m !== '' ? `Month ${m}` : 'Unknown month');
  const year = statement?.calendarYear ?? '';
  return `${monthName} ${year} (${langLabel})`.trim();
}

/**
 * Deduplicate by calendarYear + calendarMonth + language; keep newest reportGenerated.
 * Returns statements with .label for UI (e.g. "March 2026 (EN)").
 */
export function buildDedupedStoredStatementsForUi(storedStatements) {
  const list = Array.isArray(storedStatements) ? storedStatements : [];
  const deduped = new Map();
  for (const s of list) {
    const langLabel = statementLanguageCode(s);
    const key = `${s.calendarYear}-${s.calendarMonth}-${langLabel}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, s);
    } else {
      const existingTime = existing.reportGenerated?._seconds || 0;
      const currentTime = s.reportGenerated?._seconds || 0;
      if (currentTime > existingTime) {
        deduped.set(key, s);
      }
    }
  }
  return Array.from(deduped.values())
    .map((s) => ({ ...s, label: formatStoredStatementLabel(s) }))
    .sort((a, b) => {
      if ((b.calendarYear || 0) !== (a.calendarYear || 0)) {
        return (b.calendarYear || 0) - (a.calendarYear || 0);
      }
      if ((b.calendarMonth || 0) !== (a.calendarMonth || 0)) {
        return (b.calendarMonth || 0) - (a.calendarMonth || 0);
      }
      return statementLanguageCode(a).localeCompare(statementLanguageCode(b));
    });
}

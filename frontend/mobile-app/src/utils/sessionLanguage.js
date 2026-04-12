/**
 * Session UI language (EN | ES) vs statement PDF API (`english` | `spanish`).
 * Profile may later expose preferredLanguage; until then we default to EN.
 */

/** @returns {'EN'|'ES'} */
export function normalizeProfileLanguageToUi(raw) {
  if (raw == null || raw === '') return 'EN';
  const s = String(raw).trim().toLowerCase();
  if (s === 'es' || s === 'spanish' || s === 'esp' || s === 'es-mx' || s === 'es_mx') return 'ES';
  return 'EN';
}

/** @returns {'english'|'spanish'} */
export function uiLanguageToStatementApi(ui) {
  return ui === 'ES' ? 'spanish' : 'english';
}

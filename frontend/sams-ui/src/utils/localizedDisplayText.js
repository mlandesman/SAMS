export function readDisplayText(value) {
  if (value == null) return '';
  return String(value).trim();
}

export function pickLocalizedDisplayText(localizedValue, sourceValue, isSpanish) {
  if (isSpanish) {
    const localized = readDisplayText(localizedValue);
    if (localized) return localized;
  }
  return readDisplayText(sourceValue);
}

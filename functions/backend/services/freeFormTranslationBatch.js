import { translateToSpanish } from '../controllers/translateController.js';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function chunk(values, size) {
  const result = [];
  for (let i = 0; i < values.length; i += size) {
    result.push(values.slice(i, i + size));
  }
  return result;
}

export async function localizeFreeFormFields(records, fields, language, options = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const safeFields = Array.isArray(fields) ? fields : [];
  const batchSize = Number(options.batchSize) > 0 ? Number(options.batchSize) : 20;

  if (!safeRecords.length || !safeFields.length) {
    return { records: safeRecords, translatedCount: 0, failedCount: 0 };
  }

  if (language !== 'ES') {
    const passthrough = safeRecords.map((record) => {
      const next = { ...record };
      for (const field of safeFields) {
        const sourceValue = record?.[field];
        next[`${field}Localized`] = sourceValue ?? '';
      }
      return next;
    });
    return { records: passthrough, translatedCount: 0, failedCount: 0 };
  }

  const uniqueTexts = new Set();
  for (const record of safeRecords) {
    for (const field of safeFields) {
      const value = normalizeText(record?.[field]);
      if (value) uniqueTexts.add(value);
    }
  }

  const translationMap = new Map();
  let failedCount = 0;
  const uniqueList = [...uniqueTexts];

  for (const batch of chunk(uniqueList, batchSize)) {
    const results = await Promise.all(batch.map(async (text) => {
      try {
        const translated = await translateToSpanish(text);
        if (translated?.success && translated.translatedText) {
          return { text, translated: translated.translatedText };
        }
      } catch (error) {
        // Swallow and fall back to source below.
      }
      return { text, translated: text, failed: true };
    }));

    for (const result of results) {
      translationMap.set(result.text, result.translated);
      if (result.failed) failedCount += 1;
    }
  }

  const localizedRecords = safeRecords.map((record) => {
    const next = { ...record };
    for (const field of safeFields) {
      const sourceValue = record?.[field] ?? '';
      const normalized = normalizeText(sourceValue);
      next[`${field}Localized`] = normalized ? (translationMap.get(normalized) || sourceValue) : sourceValue;
    }
    return next;
  });

  return {
    records: localizedRecords,
    translatedCount: Math.max(0, translationMap.size - failedCount),
    failedCount,
  };
}

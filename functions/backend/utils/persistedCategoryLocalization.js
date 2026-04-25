import { getDb } from '../firebase.js';
import { logDebug, logWarn } from '../../shared/logger.js';

const EXACT_CATEGORY_TRANSLATIONS = new Map([
  ['hoa dues', 'Cuotas de Mantenimiento'],
  ['special assessments', 'Cuotas Especiales'],
  ['water consumption', 'Consumo de Agua'],
  ['water penalties', 'Penalizaciones de Agua'],
  ['maintenance', 'Mantenimiento'],
  ['utilities', 'Servicios'],
]);

const FRAGMENT_TRANSLATIONS = [
  ['utilities', 'Servicios'],
  ['water', 'Agua'],
  ['maintenance', 'Mantenimiento'],
  ['elevator', 'Elevador'],
  ['pool', 'Alberca'],
  ['garden', 'Jardín'],
  ['security', 'Seguridad'],
  ['electricity', 'Electricidad'],
  ['gas', 'Gas'],
  ['insurance', 'Seguro'],
  ['supplies', 'Suministros'],
  ['repairs', 'Reparaciones'],
  ['cleaning', 'Limpieza'],
  ['administration', 'Administración'],
  ['special assessments', 'Cuotas Especiales'],
  ['hoa dues', 'Cuotas de Mantenimiento'],
];

function normalizeText(value) {
  return String(value || '').trim();
}

function localizeCategoryNameForBackfill(categoryName) {
  const sourceName = normalizeText(categoryName);
  if (!sourceName) return '';

  const exact = EXACT_CATEGORY_TRANSLATIONS.get(sourceName.toLowerCase());
  if (exact) return exact;

  let localized = sourceName;
  for (const [source, target] of FRAGMENT_TRANSLATIONS) {
    localized = localized.replace(new RegExp(source, 'gi'), target);
  }
  return localized;
}

export function resolvePersistedCategoryName(category, language) {
  const sourceName = normalizeText(category?.name);
  if (language !== 'ES') {
    return sourceName;
  }

  const spanishName = normalizeText(category?.name_es);
  return spanishName || sourceName;
}

export async function backfillPersistedCategoryTranslations(clientId) {
  if (!clientId) {
    return { scanned: 0, updated: 0, skipped: 0 };
  }

  try {
    const db = await getDb();
    const snapshot = await db.collection(`clients/${clientId}/categories`).get();

    if (snapshot.empty) {
      return { scanned: 0, updated: 0, skipped: 0 };
    }

    const batch = db.batch();
    let scanned = 0;
    let updated = 0;
    let skipped = 0;

    snapshot.docs.forEach((doc) => {
      scanned += 1;
      const data = doc.data() || {};
      const existingSpanishName = normalizeText(data.name_es);
      if (existingSpanishName) {
        skipped += 1;
        return;
      }

      const localizedName = localizeCategoryNameForBackfill(data.name);
      if (!localizedName) {
        skipped += 1;
        return;
      }

      batch.update(doc.ref, {
        name_es: localizedName,
      });
      updated += 1;
    });

    if (updated > 0) {
      await batch.commit();
      logDebug(`[CATEGORY-LOCALIZATION] Backfilled ${updated} category name_es fields for client ${clientId}`);
    }

    return { scanned, updated, skipped };
  } catch (error) {
    logWarn(`[CATEGORY-LOCALIZATION] Backfill failed for client ${clientId}: ${error.message}`);
    return { scanned: 0, updated: 0, skipped: 0, error: error.message };
  }
}

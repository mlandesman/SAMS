import { getDb } from '../firebase.js';
import { backfillPersistedCategoryTranslations } from '../utils/persistedCategoryLocalization.js';

async function getCategoryNameEsStats(clientId) {
  const db = await getDb();
  const snapshot = await db.collection(`clients/${clientId}/categories`).get();
  const total = snapshot.size;
  const withNameEs = snapshot.docs.filter((doc) => {
    const value = doc.data()?.name_es;
    return typeof value === 'string' && value.trim().length > 0;
  }).length;

  return {
    total,
    withNameEs,
    missingNameEs: total - withNameEs,
  };
}

async function main() {
  const inputClients = process.argv.slice(2).map((value) => String(value || '').trim()).filter(Boolean);
  const clientIds = inputClients.length > 0 ? inputClients : ['AVII', 'MTC'];

  const summary = [];
  for (const clientId of clientIds) {
    const before = await getCategoryNameEsStats(clientId);
    const backfill = await backfillPersistedCategoryTranslations(clientId);
    const after = await getCategoryNameEsStats(clientId);

    summary.push({
      clientId,
      before,
      backfill,
      after,
    });
  }

  console.log(JSON.stringify({ clients: summary }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[backfillCategoryNameEs] Failed:', error);
    process.exit(1);
  });

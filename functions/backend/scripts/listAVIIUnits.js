import { getDb } from '../firebase.js';

async function listAVIIUnits() {
  const db = await getDb();
  const snapshot = await db.collection('clients/AVII/units').get();
  console.log('AVII Units:');
  snapshot.forEach(doc => {
    console.log(`  - ${doc.id}`);
  });
  process.exit(0);
}

listAVIIUnits().catch(console.error);

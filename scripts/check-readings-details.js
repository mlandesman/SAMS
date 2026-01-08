import { getDb } from '../functions/backend/firebase.js';

const db = await getDb();
const readingsRef = db.collection('clients').doc('AVII')
  .collection('projects').doc('waterBills')
  .collection('readings');

const docsToCheck = ['2026-05', '2026-04', '2026-03'];

console.log('Checking document details:\n');
for (const docId of docsToCheck) {
  const doc = await readingsRef.doc(docId).get();
  if (doc.exists) {
    const data = doc.data();
    const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : null;
    console.log(`${docId}:`);
    console.log(`  year: ${data.year}, month: ${data.month}`);
    console.log(`  timestamp: ${timestamp ? timestamp.toISOString() : 'none'}`);
    console.log(`  units: ${Object.keys(data.readings || {}).length}`);
    if (data._migration) {
      console.log(`  ⚠️ Already migrated from: ${data._migration.migratedFrom}`);
    }
    console.log('');
  } else {
    console.log(`${docId}: Does not exist\n`);
  }
}
process.exit(0);

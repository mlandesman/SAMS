// Delete August data so user can test Save Readings
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

async function deleteAugData() {
  const db = await getDb();
  const clientId = 'AVII';
  
  const readingsRef = db
    .collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('readings');
  
  // Delete August (month 1) data
  console.log('Deleting AUG-26 data (month 1)...');
  await readingsRef.doc('2026-01').delete();
  
  console.log('AUG-26 data deleted. User can now test Save Readings.');
  process.exit(0);
}

deleteAugData().catch(console.error);

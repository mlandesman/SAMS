// Move the 2027-01 data to 2026-01 where it belongs
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

async function moveData() {
  const db = await getDb();
  const clientId = 'AVII';
  
  const readingsRef = db
    .collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('readings');
  
  // Get the misplaced data
  const doc2027 = await readingsRef.doc('2027-01').get();
  
  if (doc2027.exists) {
    const data = doc2027.data();
    console.log('Found data in 2027-01:', data);
    
    // Move it to 2026-01
    console.log('Moving to 2026-01...');
    await readingsRef.doc('2026-01').set({
      ...data,
      year: 2026,  // Correct the year
      month: 1
    });
    
    // Delete the wrong document
    await readingsRef.doc('2027-01').delete();
    console.log('Moved data from 2027-01 to 2026-01 (AUG-26)');
  } else {
    console.log('No data found in 2027-01');
  }
  
  process.exit(0);
}

moveData().catch(console.error);

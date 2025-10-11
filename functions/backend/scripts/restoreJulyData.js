// Restore June 2025 readings to fiscal month 0 (JUL-26)
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

async function restoreJulyData() {
  const db = await getDb();
  const clientId = 'AVII';
  
  // June 2025 readings (should be FY 2026 month 0 - JUL-26 row)
  const juneReadings = {
    "101": 1767,
    "102": 26,
    "103": 842,
    "104": 1489,
    "105": 846,
    "106": 1351,
    "201": 1084,
    "202": 325,
    "203": 1619,
    "204": 1820,
    "commonArea": 1700
  };
  
  const readingsRef = db
    .collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('readings');
  
  // Restore June readings as month 0 (July in fiscal year)
  console.log('Restoring June 2025 readings to FY 2026 month 0 (JUL-26 row)...');
  await readingsRef.doc('2026-00').set({
    year: 2026,
    month: 0,
    readings: juneReadings,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log('Restored\! JUL-26 row now shows June 2025 readings.');
  process.exit(0);
}

restoreJulyData().catch(console.error);

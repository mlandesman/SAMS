// Fix water readings month offset
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

async function fixReadings() {
  const db = await getDb();
  const clientId = 'AVII';
  
  // June 2025 readings (should be FY 2026 month 0)
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
  
  // July 2025 readings (should be FY 2026 month 1)
  const julyReadings = {
    "101": 1774,
    "102": 30,
    "103": 850,
    "104": 1497,
    "105": 850,
    "106": 1362,
    "201": 1084,
    "202": 330,
    "203": 1653,
    "204": 1824,
    "commonArea": 1730
  };
  
  const readingsRef = db
    .collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('readings');
  
  // Save June readings as month 0 (July in fiscal year)
  console.log('Saving June 2025 readings as FY 2026 month 0 (JUL-26)...');
  await readingsRef.doc('2026-00').set({
    year: 2026,
    month: 0,
    readings: juneReadings,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  
  // Save July readings as month 1 (August in fiscal year)
  console.log('Saving July 2025 readings as FY 2026 month 1 (AUG-26)...');
  await readingsRef.doc('2026-01').set({
    year: 2026,
    month: 1,
    readings: julyReadings,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log('Fixed\! June readings now in JUL-26, July readings in AUG-26');
  process.exit(0);
}

fixReadings().catch(console.error);

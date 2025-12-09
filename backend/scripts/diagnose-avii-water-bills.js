/**
 * Diagnose AVII Water Bills
 * Checks for phantom bills with unrealistic consumption
 * 
 * Usage: node backend/scripts/diagnose-avii-water-bills.js
 */

import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

// Initialize Firebase Admin
const serviceAccountPath = new URL('../serviceAccountKey.json', import.meta.url);
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const CLIENT_ID = 'AVII';

async function diagnoseWaterBills() {
  console.log('🔍 AVII Water Bills Diagnostic');
  console.log('==============================\n');

  // Get all units
  const unitsSnapshot = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').get();
  
  const units = [];
  unitsSnapshot.forEach(doc => {
    if (doc.id !== 'creditBalances') {
      units.push(doc.id);
    }
  });
  
  console.log(`📋 Found ${units.length} units: ${units.join(', ')}\n`);

  // Check water bills for each unit
  for (const unitId of units.sort()) {
    console.log(`\n=== Unit ${unitId} ===`);
    
    const billsSnapshot = await db.collection('clients').doc(CLIENT_ID)
      .collection('units').doc(unitId)
      .collection('waterBills').get();
    
    if (billsSnapshot.empty) {
      console.log('   No water bills found');
      continue;
    }

    const bills = [];
    billsSnapshot.forEach(doc => {
      bills.push({ id: doc.id, ...doc.data() });
    });

    // Sort by bill ID (chronological)
    bills.sort((a, b) => a.id.localeCompare(b.id));

    console.log(`   Found ${bills.length} bills:`);
    
    for (const bill of bills) {
      const consumption = bill.consumption || 0;
      const amount = (bill.amount || 0) / 100; // Convert centavos to pesos
      const startReading = bill.startReading || 0;
      const endReading = bill.endReading || 0;
      const status = bill.status || 'unknown';
      
      // Flag suspicious bills (consumption > 100 m³ is very high for residential)
      const suspicious = consumption > 100 ? '🚨 SUSPICIOUS' : '';
      
      console.log(`   ${bill.id}: ${consumption} m³ (${startReading} → ${endReading}) = $${amount.toFixed(2)} [${status}] ${suspicious}`);
    }
  }

  // Also check the waterBills collection at client level (quarterly bills)
  console.log('\n\n=== Client-Level Water Bills (Quarterly) ===');
  
  const clientBillsSnapshot = await db.collection('clients').doc(CLIENT_ID)
    .collection('waterBills').get();
  
  if (clientBillsSnapshot.empty) {
    console.log('No client-level water bills found');
  } else {
    clientBillsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\nBill ID: ${doc.id}`);
      console.log(`  Status: ${data.status || 'unknown'}`);
      console.log(`  Bill Date: ${data.billDate?.toDate?.() || data.billDate || 'N/A'}`);
      
      if (data.units) {
        console.log(`  Units in bill:`);
        for (const [unitId, unitData] of Object.entries(data.units)) {
          const consumption = unitData.consumption || 0;
          const amount = (unitData.amount || 0) / 100;
          const suspicious = consumption > 100 ? '🚨 SUSPICIOUS' : '';
          console.log(`    ${unitId}: ${consumption} m³ = $${amount.toFixed(2)} ${suspicious}`);
        }
      }
    });
  }

  // Check water readings
  console.log('\n\n=== Water Readings ===');
  
  const readingsSnapshot = await db.collection('clients').doc(CLIENT_ID)
    .collection('waterReadings').get();
  
  if (readingsSnapshot.empty) {
    console.log('No water readings found');
  } else {
    const readings = [];
    readingsSnapshot.forEach(doc => {
      readings.push({ id: doc.id, ...doc.data() });
    });
    
    readings.sort((a, b) => a.id.localeCompare(b.id));
    
    console.log(`Found ${readings.length} reading documents:`);
    for (const reading of readings) {
      console.log(`\n  ${reading.id}:`);
      if (reading.readings) {
        const unitReadings = Object.entries(reading.readings)
          .sort(([a], [b]) => a.localeCompare(b));
        for (const [unitId, data] of unitReadings) {
          console.log(`    ${unitId}: ${data.reading || data.value || 'N/A'} m³`);
        }
      }
    }
  }

  console.log('\n\n✅ Diagnostic complete');
  process.exit(0);
}

diagnoseWaterBills().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

#!/usr/bin/env node

import { getDb } from '../firebase.js';

async function cleanupOldWaterData() {
  try {
    const db = await getDb();
    
    console.log('🔍 Checking and removing old water meter data...\n');
    
    // Get all AVII units
    const unitsRef = db.collection('clients').doc('AVII').collection('units');
    const snapshot = await unitsRef.get();
    
    let totalDeleted = 0;
    
    for (const unitDoc of snapshot.docs) {
      const unitId = unitDoc.id;
      const unitRef = unitsRef.doc(unitId);
      
      // Check for waterMeter subcollection
      const waterMeterRef = unitRef.collection('waterMeter');
      const waterMeterSnapshot = await waterMeterRef.get();
      
      if (!waterMeterSnapshot.empty) {
        console.log(`Unit ${unitId}:`);
        
        // Process each document in waterMeter collection
        for (const doc of waterMeterSnapshot.docs) {
          const docId = doc.id;
          console.log(`  - Found document: ${docId}`);
          
          // Check if this document has a readings subcollection
          const readingsRef = doc.ref.collection('readings');
          const readingsSnapshot = await readingsRef.get();
          
          if (!readingsSnapshot.empty) {
            console.log(`    - Has ${readingsSnapshot.size} readings`);
            // Delete all readings
            const batch = db.batch();
            readingsSnapshot.forEach(readingDoc => {
              batch.delete(readingDoc.ref);
            });
            await batch.commit();
            totalDeleted += readingsSnapshot.size;
          }
          
          // Delete the year document itself
          await doc.ref.delete();
          console.log(`    - Deleted document ${docId}`);
          totalDeleted++;
        }
      }
    }
    
    console.log('\n✅ Cleanup complete!');
    console.log(`Deleted ${totalDeleted} old waterMeter documents and readings`);
    console.log('\n📍 All water data is now at: /clients/AVII/projects/waterBills/{year}/data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
  process.exit(0);
}

cleanupOldWaterData();
#!/usr/bin/env node

import { getDb } from '../firebase.js';

async function removeOldWaterMeterData() {
  try {
    const db = await getDb();
    
    console.log('🧹 Removing old waterMeter data from AVII units...\n');
    
    // Get all AVII units
    const unitsRef = db.collection('clients').doc('AVII').collection('units');
    const snapshot = await unitsRef.get();
    
    let removedCount = 0;
    
    for (const doc of snapshot.docs) {
      const unitId = doc.id;
      
      // Check if waterMeter subcollection exists
      const waterMeterRef = unitsRef.doc(unitId).collection('waterMeter');
      
      // Get all documents in waterMeter subcollection
      const waterMeterSnapshot = await waterMeterRef.get();
      
      if (!waterMeterSnapshot.empty) {
        console.log(`Unit ${unitId}: Found ${waterMeterSnapshot.size} waterMeter documents`);
        
        // Delete all documents in the waterMeter subcollection
        const batch = db.batch();
        waterMeterSnapshot.forEach(doc => {
          batch.delete(doc.ref);
          console.log(`  - Deleting: ${doc.id}`);
        });
        await batch.commit();
        removedCount += waterMeterSnapshot.size;
      }
      
      // Also check for waterMeter field in the unit document itself
      const unitData = doc.data();
      if (unitData.waterMeter) {
        console.log(`Unit ${unitId}: Removing waterMeter field from unit document`);
        await unitsRef.doc(unitId).update({
          waterMeter: null
        });
      }
    }
    
    console.log('\n✅ Cleanup complete!');
    console.log(`Removed ${removedCount} old waterMeter documents`);
    console.log('\n📍 New water data location: /clients/AVII/projects/waterBills/{year}/data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

removeOldWaterMeterData();
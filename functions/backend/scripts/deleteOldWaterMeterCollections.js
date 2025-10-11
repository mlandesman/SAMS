#!/usr/bin/env node

import { getDb } from '../firebase.js';

async function deleteCollection(db, collectionRef) {
  const snapshot = await collectionRef.get();
  const batchSize = snapshot.size;
  
  if (batchSize === 0) {
    return 0;
  }

  // Delete documents in batches
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  return batchSize;
}

async function deleteOldWaterMeterData() {
  try {
    const db = await getDb();
    
    console.log('🗑️  Deleting old waterMeter collections from AVII units...\n');
    
    // Get all AVII units
    const unitsRef = db.collection('clients').doc('AVII').collection('units');
    const unitsSnapshot = await unitsRef.get();
    
    let totalDeleted = 0;
    
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      console.log(`\nProcessing unit ${unitId}:`);
      
      // Get the waterMeter collection reference
      const waterMeterRef = unitDoc.ref.collection('waterMeter');
      const waterMeterSnapshot = await waterMeterRef.get();
      
      if (waterMeterSnapshot.empty) {
        console.log('  No waterMeter collection found');
        continue;
      }
      
      console.log(`  Found ${waterMeterSnapshot.size} waterMeter documents`);
      
      // Process each year document (2025, 2026, etc.)
      for (const yearDoc of waterMeterSnapshot.docs) {
        const yearId = yearDoc.id;
        console.log(`  Processing year ${yearId}:`);
        
        // Delete readings subcollection first
        const readingsRef = yearDoc.ref.collection('readings');
        const readingsSnapshot = await readingsRef.get();
        
        if (!readingsSnapshot.empty) {
          console.log(`    Deleting ${readingsSnapshot.size} readings...`);
          const readingsDeleted = await deleteCollection(db, readingsRef);
          totalDeleted += readingsDeleted;
        }
        
        // Delete the year document itself
        await yearDoc.ref.delete();
        console.log(`    Deleted year document ${yearId}`);
        totalDeleted++;
      }
    }
    
    console.log('\n✅ Cleanup complete!');
    console.log(`Deleted ${totalDeleted} total documents`);
    console.log('\n📍 All water data is now exclusively at:');
    console.log('   /clients/AVII/projects/waterBills/{year}/data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
  process.exit(0);
}

deleteOldWaterMeterData();
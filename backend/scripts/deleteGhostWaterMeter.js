#!/usr/bin/env node

import { getDb } from '../firebase.js';

async function deleteGhostWaterMeterCollections() {
  try {
    const db = await getDb();
    
    console.log('🗑️  Deleting GHOST waterMeter collections and their readings...\n');
    
    // Get all AVII units
    const unitsRef = db.collection('clients').doc('AVII').collection('units');
    const unitsSnapshot = await unitsRef.get();
    
    let totalDeleted = 0;
    const years = ['2025', '2026'];
    
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      let unitHadData = false;
      
      for (const year of years) {
        // Direct path to readings subcollection
        const readingsRef = db
          .collection('clients').doc('AVII')
          .collection('units').doc(unitId)
          .collection('waterMeter').doc(year)
          .collection('readings');
        
        try {
          const readingsSnapshot = await readingsRef.get();
          
          if (!readingsSnapshot.empty) {
            if (!unitHadData) {
              console.log(`Unit ${unitId}:`);
              unitHadData = true;
            }
            
            console.log(`  Year ${year}: Found ${readingsSnapshot.size} readings documents`);
            
            // Delete all readings documents
            const batch = db.batch();
            readingsSnapshot.forEach(doc => {
              console.log(`    - Deleting reading: ${doc.id}`);
              batch.delete(doc.ref);
            });
            
            await batch.commit();
            totalDeleted += readingsSnapshot.size;
            console.log(`    ✅ Deleted ${readingsSnapshot.size} readings`);
          }
        } catch (error) {
          // Collection might not exist, that's OK
        }
        
        // Try to delete the year document itself (even if it doesn't exist as a document)
        const yearDocRef = db
          .collection('clients').doc('AVII')
          .collection('units').doc(unitId)
          .collection('waterMeter').doc(year);
        
        try {
          await yearDocRef.delete();
          // This will succeed even if document doesn't exist
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    console.log('\n✅ Ghost cleanup complete!');
    console.log(`Deleted ${totalDeleted} readings documents`);
    console.log('\n📍 All water data is now ONLY at:');
    console.log('   /clients/AVII/projects/waterBills/{year}/data');
    console.log('\n⚠️  Note: Empty waterMeter collections may still appear in Firebase Console');
    console.log('   but they contain no data and will not affect the application.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
  process.exit(0);
}

deleteGhostWaterMeterCollections();
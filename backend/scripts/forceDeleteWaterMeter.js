#!/usr/bin/env node

import { getDb } from '../firebase.js';

async function deleteAllInCollection(collectionRef) {
  const snapshot = await collectionRef.get();
  
  if (snapshot.empty) {
    return 0;
  }
  
  let count = 0;
  const batch = collectionRef.firestore.batch();
  
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
    count++;
  });
  
  await batch.commit();
  return count;
}

async function forceDeleteWaterMeter() {
  try {
    const db = await getDb();
    
    console.log('🗑️  FORCE DELETE old waterMeter collections...\n');
    
    // Get all AVII units
    const unitsRef = db.collection('clients').doc('AVII').collection('units');
    const unitsSnapshot = await unitsRef.get();
    
    let totalDeleted = 0;
    
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      
      // Use listCollections to find waterMeter
      const collections = await unitDoc.ref.listCollections();
      
      for (const collection of collections) {
        if (collection.id === 'waterMeter') {
          console.log(`Unit ${unitId}: Found waterMeter collection`);
          
          // Directly check for specific year documents we know exist
          const years = ['2025', '2026'];
          
          for (const year of years) {
            const yearDocRef = collection.doc(year);
            const yearDoc = await yearDocRef.get();
            
            if (yearDoc.exists) {
              console.log(`  - Found year document: ${year}`);
              
              // Check for readings subcollection
              const readingsRef = yearDocRef.collection('readings');
              const readingsSnapshot = await readingsRef.get();
              
              if (!readingsSnapshot.empty) {
                console.log(`    Found ${readingsSnapshot.size} readings`);
                // Delete all readings
                const batch = db.batch();
                readingsSnapshot.forEach(doc => {
                  batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`    Deleted ${readingsSnapshot.size} readings`);
                totalDeleted += readingsSnapshot.size;
              }
              
              // Delete the year document
              await yearDocRef.delete();
              console.log(`    Deleted year document ${year}`);
              totalDeleted++;
            }
          }
        }
      }
    }
    
    console.log('\n✅ Force cleanup complete!');
    console.log(`Deleted ${totalDeleted} total documents`);
    console.log('\n📍 Water data is now ONLY at:');
    console.log('   /clients/AVII/projects/waterBills/{year}/data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
  process.exit(0);
}

forceDeleteWaterMeter();
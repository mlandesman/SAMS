/**
 * Direct Unit Document Checker
 * 
 * Directly checks for the specific unit documents shown in the Firebase console
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

const CLIENT_ID = 'MTC';
const UNIT_IDS = ['1A', '1B', '1C', '2A', '2B', '2C', 'PH1A', 'PH2B', 'PH3C', 'PH4D'];

async function checkSpecificUnits() {
  console.log('🔍 Checking specific unit documents...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
    
    console.log('📊 Checking each unit individually...');
    
    for (const unitId of UNIT_IDS) {
      console.log(`\n📄 Checking unit: ${unitId}`);
      
      try {
        const unitDoc = await unitsRef.doc(unitId).get();
        
        if (unitDoc.exists) {
          console.log(`   👻 GHOST FOUND: Unit ${unitId} exists`);
          console.log(`   📄 Data:`, JSON.stringify(unitDoc.data(), null, 2));
          
          // Check for dues subcollection
          const duesRef = unitDoc.ref.collection('dues');
          const duesSnapshot = await duesRef.get();
          
          if (!duesSnapshot.empty) {
            console.log(`   📁 Dues subcollection: ${duesSnapshot.size} documents`);
            duesSnapshot.forEach(duesDoc => {
              console.log(`      📄 ${duesDoc.id}:`, JSON.stringify(duesDoc.data(), null, 2));
            });
          }
          
          // Delete this unit and its subcollections
          console.log(`   🗑️ Deleting unit ${unitId}...`);
          
          // Delete dues subcollection first
          if (!duesSnapshot.empty) {
            const batch = db.batch();
            duesSnapshot.forEach(duesDoc => {
              batch.delete(duesDoc.ref);
            });
            await batch.commit();
            console.log(`   ✅ Deleted ${duesSnapshot.size} dues documents`);
          }
          
          // Delete the unit document
          await unitDoc.ref.delete();
          console.log(`   ✅ Deleted unit ${unitId}`);
          
        } else {
          console.log(`   ✅ Unit ${unitId} not found`);
        }
      } catch (error) {
        console.error(`   ❌ Error checking unit ${unitId}:`, error);
      }
    }
    
    // Check for any remaining documents in units collection
    console.log('\n🔍 Checking for any other units...');
    const allUnitsSnapshot = await unitsRef.get();
    
    if (!allUnitsSnapshot.empty) {
      console.log(`👻 Found ${allUnitsSnapshot.size} additional unit documents:`);
      allUnitsSnapshot.forEach(doc => {
        console.log(`   📄 ${doc.id}`);
      });
      
      // Delete them
      const batch = db.batch();
      allUnitsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`✅ Deleted ${allUnitsSnapshot.size} additional units`);
    } else {
      console.log('✅ No additional units found');
    }
    
    // Check projects collection too
    console.log('\n🔍 Checking projects collection...');
    const projectsRef = db.collection('clients').doc(CLIENT_ID).collection('projects');
    const projectsSnapshot = await projectsRef.get();
    
    if (!projectsSnapshot.empty) {
      console.log(`👻 Found ${projectsSnapshot.size} project documents:`);
      projectsSnapshot.forEach(doc => {
        console.log(`   📄 ${doc.id}:`, JSON.stringify(doc.data(), null, 2));
      });
      
      // Delete them
      const batch = db.batch();
      projectsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`✅ Deleted ${projectsSnapshot.size} projects`);
    } else {
      console.log('✅ No projects found');
    }
    
    // Final verification - check if collections still exist
    console.log('\n🔍 Final verification...');
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const collections = await clientRef.listCollections();
    
    console.log(`📁 Collections still present: ${collections.length}`);
    collections.forEach(collection => {
      console.log(`   - ${collection.id}`);
    });
    
    // If collections are empty, they might auto-cleanup
    console.log('\n⏱️ Waiting for Firestore cleanup...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalCollections = await clientRef.listCollections();
    console.log(`📁 Final collections count: ${finalCollections.length}`);
    
  } catch (error) {
    console.error('❌ Direct unit check failed:', error);
  }
}

checkSpecificUnits()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
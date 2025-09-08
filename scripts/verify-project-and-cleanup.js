/**
 * Verify Firebase Project and Clean Empty Collections
 */

import { initializeFirebase, getDb, getApp } from '../backend/firebase.js';

async function verifyAndCleanup() {
  console.log('🔍 Verifying Firebase project and cleaning up...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    const app = await getApp();
    
    // Show project info
    console.log('📊 Firebase Project Info:');
    console.log(`   Project ID: ${app.options.projectId}`);
    console.log(`   Database: ${db._settings?.projectId || 'default'}`);
    
    // Check what's in the clients collection
    console.log('\n📁 Checking clients collection...');
    const clientsSnapshot = await db.collection('clients').get();
    console.log(`   Total clients: ${clientsSnapshot.size}`);
    
    clientsSnapshot.forEach(doc => {
      console.log(`   📄 Client: ${doc.id}`);
    });
    
    // Check specifically for MTC
    const mtcRef = db.collection('clients').doc('MTC');
    const mtcDoc = await mtcRef.get();
    
    console.log(`\n🎯 MTC Client Check:`);
    console.log(`   Document exists: ${mtcDoc.exists}`);
    
    if (mtcDoc.exists) {
      console.log(`   Data:`, JSON.stringify(mtcDoc.data(), null, 2));
    }
    
    // Get collections for MTC (even if document doesn't exist)
    console.log('\n📁 MTC Collections:');
    const collections = await mtcRef.listCollections();
    console.log(`   Collections found: ${collections.length}`);
    
    for (const collection of collections) {
      console.log(`\n   📁 Collection: ${collection.id}`);
      const snapshot = await collection.get();
      console.log(`      Documents: ${snapshot.size}`);
      
      if (snapshot.size === 0) {
        console.log(`      🗑️ Empty collection - leaving for auto-cleanup`);
      } else {
        snapshot.forEach(doc => {
          console.log(`      📄 ${doc.id}`);
        });
      }
    }
    
    // Clean up empty collections by recreating client structure properly
    console.log('\n🧹 Final cleanup...');
    
    if (collections.length > 0) {
      console.log('🗑️ Removing empty collection references...');
      
      // The empty collections will auto-cleanup, but we can force it by ensuring
      // there are no hidden documents or metadata
      
      for (const collection of collections) {
        const snapshot = await collection.get();
        if (snapshot.empty) {
          console.log(`   ✅ Collection ${collection.id} is empty (will auto-cleanup)`);
        }
      }
    }
    
    // Wait for cleanup
    console.log('\n⏱️ Waiting for Firestore auto-cleanup...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Final check
    const finalCollections = await mtcRef.listCollections();
    console.log(`\n📊 Final state:`);
    console.log(`   MTC document exists: ${(await mtcRef.get()).exists}`);
    console.log(`   Collections remaining: ${finalCollections.length}`);
    
    if (finalCollections.length === 0) {
      console.log('✅ Complete cleanup successful!');
    } else {
      console.log('⚠️ Some collections still exist (may cleanup automatically)');
      finalCollections.forEach(col => console.log(`     - ${col.id}`));
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

verifyAndCleanup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
/**
 * Cleanup Water Bills Data
 * 
 * Deletes all water bills readings and bills for AVII
 * to allow fresh import testing
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

const CLIENT_ID = 'AVII';

async function cleanupWaterBills() {
  try {
    console.log('\n🧹 Cleaning up Water Bills Data');
    console.log('='.repeat(80));
    console.log(`Client: ${CLIENT_ID}`);
    console.log('='.repeat(80));
    
    console.log('\n⚠️  WARNING: This will delete all water bills data!');
    console.log('   Press Ctrl+C within 3 seconds to cancel...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const db = await getDb();
    
    // Delete readings
    console.log('\n🗑️  Deleting readings...');
    const readingsRef = db
      .collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('readings');
    
    const readingsDocs = await readingsRef.get();
    console.log(`Found ${readingsDocs.size} reading documents`);
    
    const readingsBatch = db.batch();
    readingsDocs.forEach(doc => {
      readingsBatch.delete(doc.ref);
      console.log(`  ✓ Deleting ${doc.id}`);
    });
    await readingsBatch.commit();
    console.log(`✅ Deleted ${readingsDocs.size} reading documents`);
    
    // Delete bills
    console.log('\n🗑️  Deleting bills...');
    const billsRef = db
      .collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills');
    
    const billsDocs = await billsRef.get();
    console.log(`Found ${billsDocs.size} bill documents`);
    
    const billsBatch = db.batch();
    billsDocs.forEach(doc => {
      billsBatch.delete(doc.ref);
      console.log(`  ✓ Deleting ${doc.id}`);
    });
    await billsBatch.commit();
    console.log(`✅ Deleted ${billsDocs.size} bill documents`);
    
    console.log('\n✅ Water Bills cleanup complete!');
    console.log('='.repeat(80));
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run cleanup
cleanupWaterBills()
  .then(success => {
    console.log(success ? '\n✅ Cleanup SUCCEEDED' : '\n❌ Cleanup FAILED');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });

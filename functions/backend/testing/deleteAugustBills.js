import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

async function deleteAugustBills() {
  try {
    const db = await getDb();
    
    // Delete August 2025 bills (month 1 in fiscal year 2026)
    const billsRef = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-01');
    
    const doc = await billsRef.get();
    if (doc.exists) {
      await billsRef.delete();
      console.log('✅ Successfully deleted August 2025 bills (FY2026 Month 1)');
    } else {
      console.log('ℹ️ No August 2025 bills found to delete');
    }
    
    // Also clear the cache to ensure fresh data
    const cacheRef = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('cache').doc('year-2026');
    
    const cacheDoc = await cacheRef.get();
    if (cacheDoc.exists) {
      await cacheRef.delete();
      console.log('✅ Cleared year 2026 cache');
    } else {
      console.log('ℹ️ No cache found for year 2026');
    }
    
    console.log('\n🎉 Done! You can now regenerate August bills with penalties.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting bills:', error);
    process.exit(1);
  }
}

deleteAugustBills();
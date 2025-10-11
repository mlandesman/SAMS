import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { waterDataService } from '../services/waterDataService.js';

async function clearAugustData() {
  try {
    const db = await getDb();
    
    console.log('🔍 Checking and clearing August 2025 data...\n');
    
    // 1. Delete August bills document if it exists
    const billsRef = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-01');
    
    const billDoc = await billsRef.get();
    if (billDoc.exists) {
      await billsRef.delete();
      console.log('✅ Deleted August 2025 bills document');
    } else {
      console.log('ℹ️  No August bills document found');
    }
    
    // 2. Clear ALL cache documents for year 2026
    const cacheCollection = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('cache');
    
    const cacheSnapshot = await cacheCollection.get();
    if (!cacheSnapshot.empty) {
      const batch = db.batch();
      cacheSnapshot.docs.forEach(doc => {
        if (doc.id.includes('2026')) {
          batch.delete(doc.ref);
          console.log(`🗑️  Deleting cache document: ${doc.id}`);
        }
      });
      await batch.commit();
      console.log('✅ Cleared all 2026 cache documents');
    } else {
      console.log('ℹ️  No cache documents found');
    }
    
    // 3. Force invalidate the in-memory cache
    waterDataService.invalidate('AVII', 2026);
    console.log('✅ Invalidated in-memory cache for AVII year 2026');
    
    // 4. Update the aggregated data to remove bill amounts for August
    const monthsRef = db.collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('months');
    
    // Check for August 2025 data (FY 2026, month 1)
    const augustDoc = await monthsRef.doc('2026-01').get();
    if (augustDoc.exists) {
      const data = augustDoc.data();
      
      // Clear bill-related fields from units
      if (data.units) {
        const updatedUnits = {};
        for (const [unitId, unitData] of Object.entries(data.units)) {
          updatedUnits[unitId] = {
            ...unitData,
            billAmount: 0,
            baseAmount: 0,
            penaltyAmount: 0,
            previousBalance: 0,
            paidAmount: 0,
            unpaidAmount: 0,
            status: '',
            daysPastDue: 0
          };
        }
        
        await monthsRef.doc('2026-01').update({
          units: updatedUnits,
          'summary.totalBilled': 0,
          'summary.totalPaid': 0,
          'summary.totalUnpaid': 0
        });
        
        console.log('✅ Reset bill amounts in August aggregated data');
      }
    } else {
      console.log('ℹ️  No August aggregated data document found');
    }
    
    // 5. Final cache clear
    waterDataService.invalidate('AVII', 2026);
    
    console.log('\n🎉 Done! August data has been completely cleared.');
    console.log('📝 You should now be able to generate new August bills with penalties.');
    console.log('🔄 Please refresh the Water Bills page before generating.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing data:', error);
    process.exit(1);
  }
}

clearAugustData();
import { getDb } from '../firebase.js';

async function clearAggregatedData() {
  try {
    const db = await getDb();
    
    console.log('🗑️ Clearing aggregatedData document to force rebuild...\n');
    
    // Delete the aggregatedData document
    const aggregatedDataRef = db
      .collection('clients').doc('AVII')
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    const doc = await aggregatedDataRef.get();
    
    if (doc.exists) {
      await aggregatedDataRef.delete();
      console.log('✅ Deleted aggregatedData document');
      console.log('🔄 Next time you load Water Bills, it will rebuild and write the timestamp');
    } else {
      console.log('ℹ️ No aggregatedData document found - nothing to delete');
    }
    
    console.log('\n🎯 Now reload the Water Bills client to trigger rebuild and timestamp write');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing aggregatedData:', error);
    process.exit(1);
  }
}

clearAggregatedData();

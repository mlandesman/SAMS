/**
 * Find HOA Dues Data Location
 * Search for HOA dues data in the database
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

async function findHOADuesData() {
  try {
    await initializeFirebase();
    const db = await getDb();
    
    console.log('=== SEARCHING FOR HOA DUES DATA ===\n');
    
    // 1. Check collections under MTC client
    const mtcDoc = db.collection('clients').doc('MTC');
    const collections = await mtcDoc.listCollections();
    console.log('Collections under MTC client:');
    collections.forEach(col => console.log('  -', col.id));
    
    // 2. Check transactions for HOA dues payments
    const transactionsRef = db.collection('clients').doc('MTC').collection('transactions');
    const transSnapshot = await transactionsRef.where('category', '==', 'HOA Dues').limit(5).get();
    console.log(`\nHOA Dues transactions found: ${transSnapshot.size}`);
    
    if (!transSnapshot.empty) {
      const sampleTransaction = transSnapshot.docs[0].data();
      console.log('Sample HOA dues transaction:');
      console.log('- Amount:', sampleTransaction.amount);
      console.log('- Date:', sampleTransaction.date);
      console.log('- Unit ID:', sampleTransaction.unitId);
      console.log('- Notes:', sampleTransaction.notes?.substring(0, 100) + '...');
    }
    
    // 3. Check for any units with HOA dues data
    const unitsRef = db.collection('clients').doc('MTC').collection('units');
    const unitsSnapshot = await unitsRef.limit(3).get();
    console.log(`\nSample units found: ${unitsSnapshot.size}`);
    
    if (!unitsSnapshot.empty) {
      const sampleUnit = unitsSnapshot.docs[0];
      const unitData = sampleUnit.data();
      console.log(`Sample unit structure for ${sampleUnit.id}:`);
      console.log('- Monthly dues:', unitData.monthlyDues);
      console.log('- Owner:', unitData.owner);
      console.log('- Fields:', Object.keys(unitData));
    }
    
    // 4. Check if hoaDues collection exists but is empty
    const hoaDuesRef = db.collection('clients').doc('MTC').collection('hoaDues');
    const hoaDuesSnapshot = await hoaDuesRef.limit(1).get();
    console.log(`\nHOA Dues collection documents: ${hoaDuesSnapshot.size}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

findHOADuesData();
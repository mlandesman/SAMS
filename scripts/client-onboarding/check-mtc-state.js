import { initializeApp } from '../../backend/firebase.js';
import { DateService } from '../../backend/services/DateService.js';

async function checkCurrentState() {
  const db = await initializeApp();
  const dateService = new DateService({ timezone: 'America/Cancun' });
  
  console.log('\n=== Current Database State (MTC) ===');
  console.log('Environment:', process.env.FIRESTORE_ENV || 'dev');
  console.log('Current Time:', dateService.formatForFrontend(new Date()).displayFull);
  
  // Check transactions
  const transactionsSnapshot = await db.collection('transactions')
    .where('clientId', '==', 'MTC')
    .orderBy('date', 'desc')
    .limit(5)
    .get();
  
  console.log('\nMTC Transactions:', transactionsSnapshot.size, 'found');
  if (transactionsSnapshot.size > 0) {
    console.log('Sample transactions:');
    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${dateService.formatForFrontend(data.date).display} - ${data.description}`);
    });
  }
  
  // Check HOA dues
  const hoaDuesSnapshot = await db.collection('hoaDues')
    .where('clientId', '==', 'MTC')
    .orderBy('dueDate', 'desc')
    .limit(5)
    .get();
  
  console.log('\nMTC HOA Dues:', hoaDuesSnapshot.size, 'found');
  if (hoaDuesSnapshot.size > 0) {
    console.log('Sample HOA dues:');
    hoaDuesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${doc.id}: ${dateService.formatForFrontend(data.dueDate).display} - Unit ${data.unitNumber}`);
    });
  }
  
  // Check units
  const unitsSnapshot = await db.collection('units')
    .where('clientId', '==', 'MTC')
    .limit(5)
    .get();
  
  console.log('\nMTC Units:', unitsSnapshot.size, 'found');
  if (unitsSnapshot.size > 0) {
    console.log('Sample units:');
    unitsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - Unit ${data.unitNumber}: Balance ${data.balance || 0}`);
    });
  }
  
  // Count total documents
  const [transTotal, hoaTotal, unitsTotal] = await Promise.all([
    db.collection('transactions').where('clientId', '==', 'MTC').count().get(),
    db.collection('hoaDues').where('clientId', '==', 'MTC').count().get(),
    db.collection('units').where('clientId', '==', 'MTC').count().get()
  ]);
  
  console.log('\n=== Total Counts ===');
  console.log('Total MTC Transactions:', transTotal.data().count);
  console.log('Total MTC HOA Dues:', hoaTotal.data().count);
  console.log('Total MTC Units:', unitsTotal.data().count);
  
  process.exit(0);
}

checkCurrentState().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
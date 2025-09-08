import admin from 'firebase-admin';
import { readFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCreditBalanceHistory() {
  try {
    console.log('Checking for credit balance history in HOA dues documents...');
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      console.log(`\nChecking client: ${clientId}`);
      
      // Get all units for this client
      const unitsSnapshot = await db.collection('clients').doc(clientId).collection('units').get();
      
      for (const unitDoc of unitsSnapshot.docs) {
        const unitId = unitDoc.id;
        
        // Get all dues records for this unit
        const duesSnapshot = await db.collection('clients').doc(clientId)
          .collection('units').doc(unitId)
          .collection('dues').get();
        
        for (const duesDoc of duesSnapshot.docs) {
          const year = duesDoc.id;
          const data = duesDoc.data();
          
          if (data.creditBalanceHistory) {
            console.log(`  Unit ${unitId} (${year}): Has creditBalanceHistory with ${data.creditBalanceHistory.length} entries`);
            if (data.creditBalanceHistory.length > 0) {
              console.log(`    Sample entry:`, data.creditBalanceHistory[0]);
            }
          } else if (data.creditBalance && data.creditBalance !== 0) {
            console.log(`  Unit ${unitId} (${year}): Has creditBalance (${data.creditBalance}) but NO creditBalanceHistory`);
          }
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCreditBalanceHistory();
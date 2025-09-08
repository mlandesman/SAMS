import admin from 'firebase-admin';
import { readFileSync } from 'fs';
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

// Check if default app exists, if not create it
let app;
try {
  app = admin.app();
  console.log('Using existing Firebase app');
} catch (error) {
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Created new Firebase app');
}

const db = admin.firestore(app);

async function cleanDataArchitecture() {
  try {
    console.log('🧹 Implementing clean data architecture - Single Source of Truth\n');
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      console.log(`📋 Processing client: ${clientId}`);
      
      // Step 1: Remove ALL credit fields from ALL transactions (not just HOA)
      const transactionsSnapshot = await db.collection('clients').doc(clientId)
        .collection('transactions').get();
      
      console.log(`  Found ${transactionsSnapshot.size} total transactions`);
      
      let transactionsCleaned = 0;
      
      for (const txnDoc of transactionsSnapshot.docs) {
        const txnData = txnDoc.data();
        const txnId = txnDoc.id;
        
        // Check if this transaction has ANY credit balance fields
        const hasCreditFields = 
          txnData.creditBalanceAdded !== undefined ||
          txnData.creditUsed !== undefined ||
          txnData.newCreditBalance !== undefined;
        
        if (hasCreditFields) {
          console.log(`    🔄 Cleaning transaction ${txnId}`);
          
          // Remove credit fields completely
          const updateData = {
            creditBalanceAdded: admin.firestore.FieldValue.delete(),
            creditUsed: admin.firestore.FieldValue.delete(),
            newCreditBalance: admin.firestore.FieldValue.delete()
          };
          
          await txnDoc.ref.update(updateData);
          transactionsCleaned++;
        }
      }
      
      console.log(`  ✅ Cleaned ${transactionsCleaned} transactions\n`);
    }
    
    console.log('🎉 Clean architecture implemented!');
    console.log('\n📝 New Architecture:');
    console.log('✅ Transactions: Store ONLY transaction data (amount, date, method, notes)');
    console.log('✅ HOA Dues: Store ALL credit balance data and history');
    console.log('✅ Single Source of Truth: No duplicate data');
    console.log('✅ No Synchronization Issues: Credit data lives in one place');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Clean architecture implementation failed:', error);
    process.exit(1);
  }
}

cleanDataArchitecture();
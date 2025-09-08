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

async function removeDuplicateCreditData() {
  try {
    console.log('🧹 Starting cleanup of duplicate credit balance data...\n');
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      console.log(`📋 Processing client: ${clientId}`);
      
      // Get all HOA dues transactions for this client
      const transactionsSnapshot = await db.collection('clients').doc(clientId)
        .collection('transactions')
        .where('metadata.type', '==', 'hoa_dues')
        .get();
      
      console.log(`  Found ${transactionsSnapshot.size} HOA dues transactions`);
      
      let transactionsUpdated = 0;
      
      // Process each transaction to remove credit balance fields
      for (const txnDoc of transactionsSnapshot.docs) {
        const txnData = txnDoc.data();
        const txnId = txnDoc.id;
        
        // Check if this transaction has credit balance fields
        const hasCreditFields = 
          txnData.creditBalanceAdded !== undefined ||
          txnData.creditUsed !== undefined ||
          txnData.newCreditBalance !== undefined;
        
        if (hasCreditFields) {
          console.log(`    🔄 Cleaning transaction ${txnId}`);
          console.log(`      Removing: creditBalanceAdded=${txnData.creditBalanceAdded}, creditUsed=${txnData.creditUsed}, newCreditBalance=${txnData.newCreditBalance}`);
          
          // Create update object with field deletions
          const updateData = {
            creditBalanceAdded: admin.firestore.FieldValue.delete(),
            creditUsed: admin.firestore.FieldValue.delete(),
            newCreditBalance: admin.firestore.FieldValue.delete()
          };
          
          try {
            await txnDoc.ref.update(updateData);
            transactionsUpdated++;
            console.log(`      ✅ Cleaned transaction ${txnId}`);
          } catch (updateError) {
            console.error(`      ❌ Failed to clean transaction ${txnId}:`, updateError.message);
          }
        }
      }
      
      console.log(`  ✅ Updated ${transactionsUpdated} transactions for client ${clientId}\n`);
    }
    
    console.log('🎉 Cleanup completed successfully!');
    console.log('\n📝 Summary:');
    console.log('- Removed creditBalanceAdded, creditUsed, newCreditBalance from all HOA transactions');
    console.log('- Credit balance data now exists only in HOA dues documents');
    console.log('- Single source of truth established');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Verification function to check current state
async function verifyCreditDataState() {
  try {
    console.log('🔍 Verifying current credit data state...\n');
    
    const clientsSnapshot = await db.collection('clients').get();
    
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      console.log(`📋 Client: ${clientId}`);
      
      // Check transactions
      const transactionsSnapshot = await db.collection('clients').doc(clientId)
        .collection('transactions')
        .where('metadata.type', '==', 'hoa_dues')
        .get();
      
      let transactionsWithCreditFields = 0;
      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.creditBalanceAdded !== undefined || 
            data.creditUsed !== undefined || 
            data.newCreditBalance !== undefined) {
          transactionsWithCreditFields++;
        }
      });
      
      // Check dues documents
      const unitsSnapshot = await db.collection('clients').doc(clientId).collection('units').get();
      let duesWithCreditHistory = 0;
      let totalCreditHistoryEntries = 0;
      
      for (const unitDoc of unitsSnapshot.docs) {
        const duesSnapshot = await db.collection('clients').doc(clientId)
          .collection('units').doc(unitDoc.id)
          .collection('dues').get();
        
        duesSnapshot.forEach(duesDoc => {
          const data = duesDoc.data();
          if (data.creditBalanceHistory && data.creditBalanceHistory.length > 0) {
            duesWithCreditHistory++;
            totalCreditHistoryEntries += data.creditBalanceHistory.length;
          }
        });
      }
      
      console.log(`  Transactions: ${transactionsSnapshot.size} total, ${transactionsWithCreditFields} with credit fields`);
      console.log(`  Dues documents: ${duesWithCreditHistory} with credit history (${totalCreditHistoryEntries} total entries)`);
      
      if (transactionsWithCreditFields > 0) {
        console.log(`  ⚠️  ${transactionsWithCreditFields} transactions still have credit fields!`);
      } else {
        console.log(`  ✅ All transactions cleaned`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Check if we should run cleanup or verification
const command = process.argv[2];

if (command === 'verify') {
  verifyCreditDataState();
} else if (command === 'clean') {
  removeDuplicateCreditData();
} else {
  console.log('Usage:');
  console.log('  node removeDuplicateCreditData.js verify  - Check current state');
  console.log('  node removeDuplicateCreditData.js clean   - Remove duplicate data');
  process.exit(1);
}
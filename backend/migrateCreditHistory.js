import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { getNow } from './services/DateService.js';
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateCreditBalanceHistory() {
  try {
    console.log('Starting migration of credit balance history...');
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    
    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;
      console.log(`\nProcessing client: ${clientId}`);
      
      // Get all transactions for this client that have HOA dues metadata
      const transactionsSnapshot = await db.collection('clients').doc(clientId)
        .collection('transactions')
        .where('metadata.type', '==', 'hoa_dues')
        .get();
      
      console.log(`Found ${transactionsSnapshot.size} HOA dues transactions`);
      
      // Group transactions by unit and year for processing
      const transactionsByUnit = {};
      
      transactionsSnapshot.forEach(doc => {
        const data = doc.data();
        const unitId = data.metadata?.unitId;
        const year = data.metadata?.year;
        const transactionId = doc.id;
        
        if (unitId && year) {
          const key = `${unitId}-${year}`;
          if (!transactionsByUnit[key]) {
            transactionsByUnit[key] = [];
          }
          transactionsByUnit[key].push({
            id: transactionId,
            data: data,
            createdAt: data.createdAt
          });
        }
      });
      
      // Process each unit-year combination
      for (const [unitYearKey, transactions] of Object.entries(transactionsByUnit)) {
        const [unitId, year] = unitYearKey.split('-');
        console.log(`  Processing ${transactions.length} transactions for Unit ${unitId} (${year})`);
        
        // Sort transactions by creation date
        transactions.sort((a, b) => {
          const aTime = a.createdAt?._seconds || 0;
          const bTime = b.createdAt?._seconds || 0;
          return aTime - bTime;
        });
        
        // Get the current dues document
        const duesRef = db.collection('clients').doc(clientId)
          .collection('units').doc(unitId)
          .collection('dues').doc(year);
        
        const duesDoc = await duesRef.get();
        
        if (!duesDoc.exists) {
          console.log(`    No dues document found for Unit ${unitId} (${year})`);
          continue;
        }
        
        const duesData = duesDoc.data();
        
        // Check if creditBalanceHistory already exists and has entries
        if (duesData.creditBalanceHistory && duesData.creditBalanceHistory.length > 0) {
          console.log(`    Unit ${unitId} (${year}) already has credit balance history`);
          continue;
        }
        
        // Initialize credit balance history array
        const creditBalanceHistory = [];
        let runningBalance = 0;
        
        // Add starting balance entry if there was an initial credit balance
        if (duesData.creditBalance && duesData.creditBalance !== 0) {
          // For migration, we'll add a starting balance entry
          creditBalanceHistory.push({
            id: randomUUID(),
            timestamp: new Date('2025-01-01T00:00:00.000Z').toISOString(), // Start of year
            transactionId: null,
            type: 'starting_balance',
            amount: 0, // We don't know the starting amount
            description: 'Initial balance (migrated)',
            balanceBefore: 0,
            balanceAfter: 0,
            notes: 'Migration - historical data unavailable'
          });
        }
        
        // Process each transaction in chronological order
        for (const transaction of transactions) {
          const txnData = transaction.data;
          const transactionId = transaction.id;
          const timestamp = txnData.createdAt ? new Date(txnData.createdAt._seconds * 1000).toISOString() : getNow().toISOString();
          
          // Check for credit balance changes
          if (txnData.creditBalanceAdded && txnData.creditBalanceAdded > 0) {
            creditBalanceHistory.push({
              id: randomUUID(),
              timestamp: timestamp,
              transactionId: transactionId,
              type: 'credit_added',
              amount: txnData.creditBalanceAdded,
              description: 'from Overpayment (migrated)',
              balanceBefore: runningBalance,
              balanceAfter: runningBalance + txnData.creditBalanceAdded,
              notes: txnData.notes || 'Migrated transaction'
            });
            runningBalance += txnData.creditBalanceAdded;
          }
          
          if (txnData.creditUsed && txnData.creditUsed > 0) {
            creditBalanceHistory.push({
              id: randomUUID(),
              timestamp: timestamp,
              transactionId: transactionId,
              type: 'credit_used',
              amount: txnData.creditUsed,
              description: `from ${txnData.paymentMethod || 'Payment'} (migrated)`,
              balanceBefore: runningBalance,
              balanceAfter: runningBalance - txnData.creditUsed,
              notes: txnData.notes || 'Migrated transaction'
            });
            runningBalance -= txnData.creditUsed;
          }
        }
        
        // Only update if we have credit balance history to add
        if (creditBalanceHistory.length > 0) {
          try {
            await duesRef.update({
              creditBalanceHistory: creditBalanceHistory
            });
            console.log(`    ✅ Added ${creditBalanceHistory.length} credit balance history entries for Unit ${unitId} (${year})`);
            
            // Show the entries for debugging
            creditBalanceHistory.forEach(entry => {
              console.log(`      ${entry.type}: $${entry.amount} on ${new Date(entry.timestamp).toLocaleDateString()} (${entry.transactionId || 'N/A'})`);
            });
          } catch (updateError) {
            console.error(`    ❌ Failed to update Unit ${unitId} (${year}):`, updateError.message);
          }
        } else {
          console.log(`    No credit balance changes found for Unit ${unitId} (${year})`);
        }
      }
    }
    
    console.log('\n✅ Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateCreditBalanceHistory();
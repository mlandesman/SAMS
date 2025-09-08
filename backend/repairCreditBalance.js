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

async function repairCreditBalance(clientId, unitId, year) {
  try {
    console.log(`🔧 Repairing credit balance for ${clientId}/${unitId}/${year}`);
    
    const duesRef = db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(year.toString());
    
    const duesDoc = await duesRef.get();
    
    if (!duesDoc.exists) {
      console.log('❌ Dues document not found');
      return;
    }
    
    const data = duesDoc.data();
    const currentBalance = data.creditBalance || 0;
    const history = data.creditBalanceHistory || [];
    
    console.log(`📊 Current balance: ${currentBalance}`);
    console.log(`📜 History entries: ${history.length}`);
    
    // Calculate correct balance from history
    let calculatedBalance = 0;
    
    for (const entry of history) {
      console.log(`  Processing: ${entry.type} ${entry.amount} (${entry.description})`);
      
      if (entry.type === 'starting_balance') {
        calculatedBalance = entry.amount;
      } else if (entry.type === 'credit_added' || entry.type === 'credit_repair') {
        calculatedBalance += entry.amount;
      } else if (entry.type === 'credit_used') {
        calculatedBalance -= entry.amount;
      }
    }
    
    console.log(`🧮 Calculated balance from history: ${calculatedBalance}`);
    
    if (calculatedBalance !== currentBalance) {
      console.log(`⚠️  Balance mismatch! Updating ${currentBalance} → ${calculatedBalance}`);
      
      await duesRef.update({
        creditBalance: calculatedBalance
      });
      
      console.log('✅ Credit balance repaired');
    } else {
      console.log('✅ Credit balance is correct');
    }
    
  } catch (error) {
    console.error('❌ Error repairing credit balance:', error);
  }
}

// Repair PH4D
repairCreditBalance('MTC', 'PH4D', 2025).then(() => {
  console.log('🎉 Repair completed');
  process.exit(0);
});
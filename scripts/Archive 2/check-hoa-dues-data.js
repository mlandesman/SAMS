/**
 * Check HOA Dues Data Structure
 * Verifies the structure of payments in the HOA dues collection
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

async function checkHOADuesData() {
  try {
    await initializeFirebase();
    const db = await getDb();
    
    // Get a sample unit's HOA dues data
    const duesRef = db.collection('clients').doc('MTC').collection('hoaDues');
    const snapshot = await duesRef.limit(3).get();
    
    if (!snapshot.empty) {
      console.log('=== HOA DUES DATA STRUCTURE ANALYSIS ===\n');
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log(`Unit ID: ${doc.id}`);
        console.log(`Scheduled Amount: ${data.scheduledAmount}`);
        console.log(`Credit Balance: ${data.creditBalance}`);
        
        if (data.payments && data.payments.length > 0) {
          console.log(`Total payments: ${data.payments.length}`);
          
          // Check field presence across all payments
          let paymentsWithNotes = 0;
          let paymentsWithTransactionId = 0;
          
          data.payments.forEach(payment => {
            if (payment.notes) paymentsWithNotes++;
            if (payment.transactionId) paymentsWithTransactionId++;
          });
          
          console.log(`Payments with notes: ${paymentsWithNotes}/${data.payments.length}`);
          console.log(`Payments with transactionId: ${paymentsWithTransactionId}/${data.payments.length}`);
          
          // Show first payment structure
          console.log('First payment structure:');
          console.log(JSON.stringify(data.payments[0], null, 2));
          
          // Show sample notes if available
          if (paymentsWithNotes > 0) {
            const paymentWithNotes = data.payments.find(p => p.notes);
            console.log(`Sample notes: "${paymentWithNotes.notes.substring(0, 100)}..."`);
          }
          
          // Show sample transactionId if available
          if (paymentsWithTransactionId > 0) {
            const paymentWithTransactionId = data.payments.find(p => p.transactionId);
            console.log(`Sample transactionId: "${paymentWithTransactionId.transactionId}"`);
          }
        } else {
          console.log('No payments found');
        }
        
        console.log('\n' + '-'.repeat(50) + '\n');
      }
    } else {
      console.log('No HOA dues data found for MTC client');
    }
  } catch (error) {
    console.error('Error checking HOA dues data:', error);
  }
  
  process.exit(0);
}

checkHOADuesData();
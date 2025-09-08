#!/usr/bin/env node

/**
 * Check what's actually in Firestore
 */

import { getDb } from '../backend/firebase.js';

async function checkData() {
  console.log('🔍 CHECKING ACTUAL FIRESTORE DATA...\n');
  
  const db = await getDb();
  
  // Just check unit 1A for now
  const docPath = `clients/MTC/units/1A/dues/2025`;
  console.log(`📍 Checking: ${docPath}`);
  
  try {
    const docRef = db.doc(docPath);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log('  ❌ Document not found');
      return;
    }
    
    const data = doc.data();
    
    console.log('\nDocument data:');
    console.log('scheduledAmount:', data.scheduledAmount, `($${data.scheduledAmount/100})`);
    console.log('creditBalance:', data.creditBalance, `($${data.creditBalance/100})`);
    console.log('totalPaid:', data.totalPaid, `($${data.totalPaid/100})`);
    
    console.log('\nPayments array:');
    data.payments.forEach((payment, index) => {
      if (payment.paid || payment.amount > 0) {
        console.log(`Month ${index + 1}: paid=${payment.paid}, amount=${payment.amount} ($${payment.amount/100})`);
      }
    });
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  }
  
  console.log('\n✨ Done!');
  process.exit(0);
}

checkData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
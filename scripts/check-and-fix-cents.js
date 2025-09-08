#!/usr/bin/env node

/**
 * Check what's in Firestore and fix to proper CENTS values
 */

import { getDb } from '../backend/firebase.js';

async function checkAndFix() {
  console.log('🔍 Checking Firestore data and fixing to CENTS...\n');
  
  const db = await getDb();
  const unitId = '1A'; // Let's check 1A first
  
  const docRef = db.doc(`clients/MTC/units/${unitId}/dues/2025`);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    console.log('Document not found!');
    return;
  }
  
  const data = doc.data();
  console.log('Current data for 1A:');
  console.log('scheduledAmount:', data.scheduledAmount);
  console.log('First payment amount:', data.payments[0]?.amount);
  
  // If amounts are in dollars, multiply by 100 to get cents
  const needsFix = data.scheduledAmount < 10000; // If less than 10000, it's probably dollars
  
  if (needsFix) {
    console.log('\n⚠️  Data is in DOLLARS, converting to CENTS...\n');
    
    // Fix all units
    const fixes = {
      '1A': 4600,
      '1B': 4400,
      '1C': 4400,
      '2A': 4600,
      '2B': 4400,
      '2C': 4400,
      'PH1A': 5800,
      'PH2B': 5800,
      'PH3C': 5800,
      'PH4D': 5800
    };
    
    for (const [unitId, monthlyDollars] of Object.entries(fixes)) {
      const docRef = db.doc(`clients/MTC/units/${unitId}/dues/2025`);
      const doc = await docRef.get();
      
      if (!doc.exists) continue;
      
      const data = doc.data();
      console.log(`Fixing ${unitId}...`);
      
      // Fix scheduled amount
      const updates = {
        scheduledAmount: monthlyDollars * 100 // Convert to cents
      };
      
      // Fix payments array
      if (data.payments) {
        updates.payments = data.payments.map(payment => {
          if (payment.paid && payment.amount < 10000) {
            return {
              ...payment,
              amount: payment.amount * 100 // Convert to cents
            };
          }
          return payment;
        });
      }
      
      // Fix totalPaid if exists
      if (data.totalPaid && data.totalPaid < 100000) {
        updates.totalPaid = data.totalPaid * 100;
      }
      
      // Fix creditBalance if needed
      if (data.creditBalance && data.creditBalance < 10000) {
        updates.creditBalance = data.creditBalance * 100;
      }
      
      await docRef.update(updates);
      console.log(`✅ Fixed ${unitId}: scheduledAmount = ${updates.scheduledAmount} cents`);
    }
  } else {
    console.log('\n✅ Data appears to already be in CENTS');
  }
  
  console.log('\n✨ Done!');
  process.exit(0);
}

checkAndFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * FIX PAYMENT DATE FIELDS TO PROPER FIREBASE TIMESTAMPS
 */

import { getDb } from '../backend/firebase.js';
import { getAdmin } from '../backend/firebase.js';

async function fixPaymentDates() {
  console.log('🔧 FIXING PAYMENT DATE FIELDS TO TIMESTAMPS...\n');
  
  const db = await getDb();
  const admin = await getAdmin();
  
  const units = ['1A', '1B', '1C', '2A', '2B', '2C', 'PH1A', 'PH2B', 'PH3C', 'PH4D'];
  
  for (const unitId of units) {
    const docPath = `clients/MTC/units/${unitId}/dues/2025`;
    console.log(`📍 Fixing dates for: ${docPath}`);
    
    try {
      const docRef = db.doc(docPath);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.log('  ❌ Document not found');
        continue;
      }
      
      const data = doc.data();
      
      // Fix payments array dates
      if (data.payments && Array.isArray(data.payments)) {
        const fixedPayments = data.payments.map((payment, index) => {
          if (payment.paid && payment.date) {
            // Convert whatever is there to a proper Timestamp
            let timestamp;
            
            if (payment.date._seconds) {
              // Already a timestamp, keep it
              timestamp = payment.date;
            } else if (payment.date instanceof Date) {
              // Convert Date to Timestamp
              timestamp = admin.firestore.Timestamp.fromDate(payment.date);
            } else if (typeof payment.date === 'string') {
              // Convert string to Timestamp
              timestamp = admin.firestore.Timestamp.fromDate(new Date(payment.date));
            } else {
              // Default to first day of the month
              const month = index + 1;
              timestamp = admin.firestore.Timestamp.fromDate(
                new Date(`2025-${String(month).padStart(2,'0')}-01T12:00:00`)
              );
            }
            
            return {
              ...payment,
              date: timestamp
            };
          }
          return payment;
        });
        
        // Update the document with fixed dates
        await docRef.update({
          payments: fixedPayments,
          updated: admin.firestore.Timestamp.now()
        });
        
        console.log(`  ✅ Fixed payment dates`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✨ DONE FIXING DATES!');
  process.exit(0);
}

fixPaymentDates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * SIMPLE FIX FOR PAYMENT DATES - JUST USE PLAIN DATES
 */

import { getDb } from '../backend/firebase.js';

async function fixPaymentDates() {
  console.log('🔧 FIXING PAYMENT DATES...\n');
  
  const db = await getDb();
  
  const units = ['1A', '1B', '1C', '2A', '2B', '2C', 'PH1A', 'PH2B', 'PH3C', 'PH4D'];
  
  for (const unitId of units) {
    const docPath = `clients/MTC/units/${unitId}/dues/2025`;
    console.log(`📍 Fixing: ${docPath}`);
    
    try {
      const docRef = db.doc(docPath);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.log('  ❌ Document not found');
        continue;
      }
      
      const data = doc.data();
      
      // Fix payments array - use simple Date objects
      if (data.payments && Array.isArray(data.payments)) {
        const fixedPayments = data.payments.map((payment, index) => {
          if (payment.paid) {
            // Use first day of each month in 2025
            const month = index + 1;
            return {
              ...payment,
              date: new Date(`2025-${String(month).padStart(2,'0')}-01T12:00:00`)
            };
          }
          return {
            ...payment,
            date: null
          };
        });
        
        // Update with simple Date objects - Firebase will convert them
        await docRef.update({
          payments: fixedPayments,
          updated: new Date()
        });
        
        console.log(`  ✅ Fixed dates`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✨ DONE!');
  process.exit(0);
}

fixPaymentDates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
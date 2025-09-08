#!/usr/bin/env node

/**
 * Fix totalPaid calculation in HOA dues documents
 */

import { getDb } from '../backend/firebase.js';

async function fixTotalPaid() {
  console.log('🔧 FIXING totalPaid CALCULATIONS...\n');
  
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
      
      // Calculate totalPaid from payments array
      let totalPaid = 0;
      if (data.payments && Array.isArray(data.payments)) {
        data.payments.forEach(payment => {
          if (payment.amount && payment.amount > 0) {
            totalPaid += payment.amount;
          }
        });
      }
      
      console.log(`  Current totalPaid: ${data.totalPaid} cents`);
      console.log(`  Calculated totalPaid: ${totalPaid} cents`);
      
      // Update if different
      if (data.totalPaid !== totalPaid) {
        await docRef.update({
          totalPaid: totalPaid,
          updated: new Date()
        });
        console.log(`  ✅ Updated totalPaid to ${totalPaid} cents ($${totalPaid/100})`);
      } else {
        console.log(`  ✅ totalPaid already correct`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✨ DONE!');
  process.exit(0);
}

fixTotalPaid().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
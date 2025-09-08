#!/usr/bin/env node

/**
 * Fix payment arrays - set proper scheduled amounts for each month
 */

import { getDb } from '../backend/firebase.js';

const unitData = {
  '1A': { monthlyAmount: 460000, paid: [1,1,1,1,1,1,1,1,1,1,0,0] },
  '1B': { monthlyAmount: 440000, paid: [0,0,0,0,0,0,0,0,0,0,0,0] },
  '1C': { monthlyAmount: 440000, paid: [1,1,1,1,1,1,1,1,1,0,0,0] },
  '2A': { monthlyAmount: 460000, paid: [1,1,1,1,1,1,1,0,0,0,0,0] },
  '2B': { monthlyAmount: 440000, paid: [1,1,1,1,1,1,1,1,0,0,0,0] },
  '2C': { monthlyAmount: 440000, paid: [1,1,1,1,1,1,1,1,1,0,0,0] },
  'PH1A': { monthlyAmount: 580000, paid: [1,1,1,1,1,1,1,1,0,0,0,0] },
  'PH2B': { monthlyAmount: 580000, paid: [0,0,0,0,0,0,0,0,0,0,0,0] },
  'PH3C': { monthlyAmount: 580000, paid: [0,0,0,0,0,0,0,0,0,0,0,0] },
  'PH4D': { monthlyAmount: 580000, paid: [0,0,0,0,0,0,0,0,0,0,0,0] }
};

async function fixPaymentArrays() {
  console.log('🔧 Fixing HOA payment arrays...\n');
  
  const db = await getDb();
  const today = new Date();
  
  for (const [unitId, data] of Object.entries(unitData)) {
    const docPath = `clients/MTC/units/${unitId}/dues/2025`;
    console.log(`📍 Fixing: ${docPath}`);
    
    try {
      const docRef = db.doc(docPath);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.log('  ❌ Document not found');
        continue;
      }
      
      // Build proper payments array
      const payments = data.paid.map((isPaid, index) => {
        if (isPaid) {
          return {
            paid: true,
            amount: data.monthlyAmount,
            date: today,
            reference: `2025-${String(index + 1).padStart(2, '0')}-01_000000_000`
          };
        } else {
          return {
            paid: false,
            amount: 0,
            date: null,
            reference: null
          };
        }
      });
      
      // Update the document
      await docRef.update({
        payments: payments,
        scheduledAmount: data.monthlyAmount * 12
      });
      
      const paidCount = data.paid.filter(p => p === 1).length;
      console.log(`  ✅ Fixed: ${paidCount} paid months, monthly amount: ${data.monthlyAmount/100}`);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✨ Done!');
  process.exit(0);
}

fixPaymentArrays().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
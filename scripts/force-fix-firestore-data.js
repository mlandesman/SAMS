#!/usr/bin/env node

/**
 * FORCE FIX FIRESTORE DATA DIRECTLY
 * No validation, just write the correct data
 */

import { getDb } from '../backend/firebase.js';

const correctData = {
  '1A': { 
    monthlyAmount: 460000, // $4,600 in cents
    paid: [1,1,1,1,1,1,1,1,1,1,0,0],
    creditBalance: 43900
  },
  '1B': { 
    monthlyAmount: 440000, // $4,400 in cents
    paid: [0,0,0,0,0,0,0,0,0,0,0,0],
    creditBalance: 328600
  },
  '1C': { 
    monthlyAmount: 440000, // $4,400 in cents
    paid: [1,1,1,1,1,1,1,1,1,0,0,0],
    creditBalance: 60000
  },
  '2A': { 
    monthlyAmount: 460000, // $4,600 in cents
    paid: [1,1,1,1,1,1,1,0,0,0,0,0],
    creditBalance: 9400
  },
  '2B': { 
    monthlyAmount: 440000, // $4,400 in cents
    paid: [1,1,1,1,1,1,1,1,0,0,0,0],
    creditBalance: 0
  },
  '2C': { 
    monthlyAmount: 440000, // $4,400 in cents
    paid: [1,1,1,1,1,1,1,1,1,0,0,0],
    creditBalance: 0
  },
  'PH1A': { 
    monthlyAmount: 580000, // $5,800 in cents
    paid: [1,1,1,1,1,1,1,1,0,0,0,0],
    creditBalance: 0
  },
  'PH2B': { 
    monthlyAmount: 580000, // $5,800 in cents
    paid: [0,0,0,0,0,0,0,0,0,0,0,0],
    creditBalance: 40000
  },
  'PH3C': { 
    monthlyAmount: 580000, // $5,800 in cents
    paid: [0,0,0,0,0,0,0,0,0,0,0,0],
    creditBalance: 111044
  },
  'PH4D': { 
    monthlyAmount: 580000, // $5,800 in cents
    paid: [0,0,0,0,0,0,0,0,0,0,0,0],
    creditBalance: 40000
  }
};

async function forceFixData() {
  console.log('🔨 FORCE FIXING FIRESTORE DATA...\n');
  
  const db = await getDb();
  
  for (const [unitId, data] of Object.entries(correctData)) {
    const docPath = `clients/MTC/units/${unitId}/dues/2025`;
    console.log(`📍 Forcing data for: ${docPath}`);
    
    try {
      const docRef = db.doc(docPath);
      
      // Build the payments array with proper structure
      const payments = [];
      for (let i = 0; i < 12; i++) {
        if (data.paid[i] === 1) {
          payments.push({
            paid: true,
            amount: data.monthlyAmount,
            date: new Date(`2025-${String(i+1).padStart(2,'0')}-01T12:00:00`),
            reference: `manual-fix-${i+1}`
          });
        } else {
          payments.push({
            paid: false,
            amount: 0,
            date: null,
            reference: null
          });
        }
      }
      
      // FORCE SET the entire document structure
      await docRef.set({
        year: 2025,
        unitId: unitId,
        scheduledAmount: data.monthlyAmount,
        creditBalance: data.creditBalance,
        payments: payments,
        totalDue: 0,
        totalPaid: data.paid.filter(p => p === 1).length * data.monthlyAmount,
        updated: new Date()
      }, { merge: true });
      
      console.log(`  ✅ FORCED: ${data.paid.filter(p => p === 1).length} payments, monthly: $${data.monthlyAmount/100}`);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✨ FORCE FIX COMPLETE!');
  process.exit(0);
}

forceFixData().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
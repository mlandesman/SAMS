#!/usr/bin/env node

/**
 * Quick fix for HOA payment data - just get the scheduled amounts in place
 */

import { getDb } from '../backend/firebase.js';

const fixes = [
  { unitId: '1A', scheduledAmount: 460000 },  // $4,600
  { unitId: '1B', scheduledAmount: 440000 },  // $4,400
  { unitId: '1C', scheduledAmount: 440000 },  // $4,400
  { unitId: '2A', scheduledAmount: 460000 },  // $4,600
  { unitId: '2B', scheduledAmount: 440000 },  // $4,400
  { unitId: '2C', scheduledAmount: 440000 },  // $4,400
  { unitId: 'PH1A', scheduledAmount: 580000 }, // $5,800
  { unitId: 'PH2B', scheduledAmount: 580000 }, // $5,800
  { unitId: 'PH3C', scheduledAmount: 580000 }, // $5,800
  { unitId: 'PH4D', scheduledAmount: 580000 }, // $5,800
];

async function quickFix() {
  console.log('🔧 Quick fixing HOA payment data...\n');
  
  const db = await getDb();
  
  for (const fix of fixes) {
    const docPath = `clients/MTC/units/${fix.unitId}/dues/2025`;
    console.log(`📍 Fixing: ${docPath}`);
    
    try {
      const docRef = db.doc(docPath);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.log('  ❌ Document not found');
        continue;
      }
      
      // Just update the scheduled amount
      await docRef.update({
        scheduledAmount: fix.scheduledAmount
      });
      
      console.log(`  ✅ Set scheduledAmount to ${fix.scheduledAmount}`);
      
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✨ Done!');
  process.exit(0);
}

quickFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
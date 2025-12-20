#!/usr/bin/env node
/**
 * Manual Penalty Waiver Script
 * 
 * This script manually removes/waives a penalty from Unit 106's FY2026 HOA dues.
 * Use this for retroactive penalty waivers before the UI feature was available.
 * 
 * Usage:
 *   node scripts/waivePenalty2026.js
 */

import { getDb } from '../functions/backend/firebase.js';

async function waivePenalty() {
  console.log('🚫 Manual Penalty Waiver for Unit 106 FY2026\n');
  
  const clientId = 'AVII';
  const unitId = '106';
  const fiscalYear = '2026';
  
  try {
    // Get database instance
    const db = await getDb();
    
    // Get the current document
    const docRef = db.collection('clients').doc(clientId)
      .collection('units').doc(unitId)
      .collection('dues').doc(fiscalYear);
    
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.error(`❌ Document not found: ${clientId}/units/${unitId}/dues/${fiscalYear}`);
      process.exit(1);
    }
    
    const data = doc.data();
    
    console.log('📋 Current Penalty Data:');
    console.log(`   Total Amount: $${(data.penalties?.totalAmount || 0) / 100}`);
    console.log(`   Entries: ${data.penalties?.entries?.length || 0}`);
    
    if (data.penalties?.entries?.length > 0) {
      data.penalties.entries.forEach((entry, idx) => {
        console.log(`   Entry ${idx + 1}:`);
        console.log(`     Amount: $${entry.amount / 100}`);
        console.log(`     Notes: ${entry.notes}`);
        console.log(`     Is Paid: ${entry.isPaid}`);
      });
    }
    
    console.log('\n🔄 Applying Waiver (Option B: Keep audit trail)...');
    
    // Option B: Keep audit trail
    const waivedEntries = data.penalties.entries.map(entry => ({
      ...entry,
      originalAmount: entry.amount,
      amount: 0,
      waived: true,
      waiverReason: 'Property sale - retroactive waiver',
      waiverDate: new Date().toISOString(),
      notes: `${entry.notes} - WAIVED: Property sale`
    }));
    
    await docRef.update({
      'penalties.totalAmount': 0,
      'penalties.entries': waivedEntries,
      'updated': new Date().toISOString()
    });
    
    console.log('✅ Penalty waived successfully!\n');
    
    // Verify the update
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();
    
    console.log('📋 Updated Penalty Data:');
    console.log(`   Total Amount: $${(updatedData.penalties?.totalAmount || 0) / 100}`);
    console.log(`   Entries: ${updatedData.penalties?.entries?.length || 0}`);
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error waiving penalty:', error);
    process.exit(1);
  }
}

// Run the script
waivePenalty();


#!/usr/bin/env node
/**
 * Manual Penalty Waiver Script - PRODUCTION
 * 
 * This script manually removes/waives penalties from Unit 106's FY2026 HOA dues.
 * Use this for retroactive penalty waivers before the UI feature was available.
 * 
 * Usage:
 *   USE_ADC=true node scripts/waivePenalty2026Prod.js --dry-run
 *   USE_ADC=true node scripts/waivePenalty2026Prod.js --live
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PRODUCTION project ID
const PROJECT_ID = 'sams-sandyland-prod';

async function waivePenalty() {
  const isLive = process.argv.includes('--live');
  const isDryRun = !isLive;
  
  console.log('═'.repeat(60));
  console.log('  MANUAL PENALTY WAIVER - UNIT 106 FY2026');
  console.log('═'.repeat(60));
  console.log(`  Mode: ${isDryRun ? '🔵 DRY RUN (no changes)' : '🔴 LIVE (will update production)'}`);
  console.log(`  Project: ${PROJECT_ID}`);
  console.log('═'.repeat(60));
  console.log('');
  
  const clientId = 'AVII';
  const unitId = '106';
  const fiscalYear = '2026';
  
  try {
    // Initialize Firebase for production
    initializeApp({ 
      credential: applicationDefault(), 
      projectId: PROJECT_ID 
    });
    const db = getFirestore();
    
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
        console.log(`     Notes: ${entry.notes || 'N/A'}`);
        console.log(`     Is Paid: ${entry.isPaid || false}`);
        console.log(`     Waived: ${entry.waived || false}`);
      });
    } else {
      console.log('   No penalty entries found.');
    }
    
    if (!data.penalties?.entries?.length) {
      console.log('\n⚠️  No penalties to waive. Exiting.');
      process.exit(0);
    }
    
    console.log('\n🔄 Waiver Plan (keeping audit trail):');
    
    const waivedEntries = data.penalties.entries.map(entry => ({
      ...entry,
      originalAmount: entry.amount,
      amount: 0,
      waived: true,
      waiverReason: 'Property sale - retroactive waiver',
      waiverDate: new Date().toISOString(),
      notes: `${entry.notes || ''} - WAIVED: Property sale`
    }));
    
    waivedEntries.forEach((entry, idx) => {
      console.log(`   Entry ${idx + 1}:`);
      console.log(`     Original: $${entry.originalAmount / 100} → New: $0`);
      console.log(`     Reason: ${entry.waiverReason}`);
    });
    
    if (isDryRun) {
      console.log('\n💡 This is a DRY RUN. No changes were made.');
      console.log('   To apply to production, run with --live flag:');
      console.log('   USE_ADC=true node scripts/waivePenalty2026Prod.js --live\n');
      process.exit(0);
    }
    
    console.log('\n⚠️  WARNING: This will modify PRODUCTION data!');
    console.log('   Press Ctrl+C within 5 seconds to abort...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
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
    
    if (updatedData.penalties?.entries?.length > 0) {
      updatedData.penalties.entries.forEach((entry, idx) => {
        console.log(`   Entry ${idx + 1}: $${entry.amount / 100} (waived: ${entry.waived})`);
      });
    }
    
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error waiving penalty:', error);
    process.exit(1);
  }
}

// Run the script
waivePenalty();

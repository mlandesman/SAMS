#!/usr/bin/env node
/**
 * Fix AVII Starting Balance Timestamps
 * 
 * Updates all AVII units' starting_balance entries (history[0]) to have
 * a timestamp of June 30, 2025 23:59:59 EST (Unix: 1751345999).
 * 
 * This ensures the starting_balance entries are included in the opening
 * balance calculation for fiscal year 2026 (which starts July 1, 2025).
 * 
 * Usage:
 *   DRY RUN: node functions/backend/scripts/fix-avii-starting-balance-timestamps.js --prod
 *   LIVE:    node functions/backend/scripts/fix-avii-starting-balance-timestamps.js --live --prod
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';

const CLIENT_ID = 'AVII';
const CORRECT_TIMESTAMP_SECONDS = 1751345999; // June 30, 2025 23:59:59 EST
const CORRECT_TIMESTAMP_DATE = new Date('2025-06-30T23:59:59-05:00');

// Check for flags
const isLive = process.argv.includes('--live');
const useProduction = process.argv.includes('--prod');
const productionProjectId = 'sams-sandyland-prod';

async function initializeFirebase() {
  if (useProduction) {
    console.log(`🌍 Environment: PRODUCTION`);
    console.log(`🔥 Firebase Project: ${productionProjectId}`);
    console.log(`🔑 Using Application Default Credentials (ADC)\n`);
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
         !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: productionProjectId
      });
    }
    
    return admin.firestore();
  } else {
    const { getDb } = await import('../firebase.js');
    return await getDb();
  }
}

async function main() {
  console.log('🔧 Fix AVII Starting Balance Timestamps\n');
  console.log('='.repeat(80));
  console.log(`Client: ${CLIENT_ID}`);
  console.log(`Correct Timestamp: ${CORRECT_TIMESTAMP_DATE.toISOString()} (${CORRECT_TIMESTAMP_SECONDS} seconds)`);
  console.log(`Mode: ${isLive ? '🔴 LIVE' : '🟡 DRY RUN'}`);
  console.log('='.repeat(80));
  
  if (!isLive) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made');
    console.log('   Add --live flag to apply changes\n');
  }
  
  const db = await initializeFirebase();
  
  // Get creditBalances document for AVII
  const creditBalancesRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances');
  
  const creditDoc = await creditBalancesRef.get();
  
  if (!creditDoc.exists) {
    console.error(`❌ Credit balances document not found for ${CLIENT_ID}`);
    process.exit(1);
  }
  
  const creditData = creditDoc.data();
  const unitIds = Object.keys(creditData).filter(id => id !== 'metadata' && typeof creditData[id] === 'object');
  
  console.log(`\n📊 Found ${unitIds.length} unit(s) to check\n`);
  
  const updates = [];
  
  for (const unitId of unitIds.sort()) {
    const unitData = creditData[unitId];
    const history = unitData?.history || [];
    
    if (history.length === 0) {
      console.log(`⚠️  Unit ${unitId}: No history entries found`);
      continue;
    }
    
    const firstEntry = history[0];
    
    // Check if first entry is a starting_balance
    if (firstEntry.type !== 'starting_balance') {
      console.log(`⏭️  Unit ${unitId}: First entry is not starting_balance (type: ${firstEntry.type || 'undefined'})`);
      continue;
    }
    
    // Get current timestamp
    let currentTimestamp = null;
    let currentTimestampSeconds = null;
    
    if (firstEntry.timestamp) {
      if (firstEntry.timestamp._seconds !== undefined) {
        currentTimestampSeconds = firstEntry.timestamp._seconds;
        currentTimestamp = new Date(currentTimestampSeconds * 1000);
      } else if (typeof firstEntry.timestamp.toDate === 'function') {
        currentTimestamp = firstEntry.timestamp.toDate();
        currentTimestampSeconds = Math.floor(currentTimestamp.getTime() / 1000);
      } else if (firstEntry.timestamp instanceof Date) {
        currentTimestamp = firstEntry.timestamp;
        currentTimestampSeconds = Math.floor(currentTimestamp.getTime() / 1000);
      } else if (typeof firstEntry.timestamp === 'string') {
        currentTimestamp = new Date(firstEntry.timestamp);
        currentTimestampSeconds = Math.floor(currentTimestamp.getTime() / 1000);
      } else if (typeof firstEntry.timestamp === 'number') {
        currentTimestampSeconds = firstEntry.timestamp;
        currentTimestamp = new Date(currentTimestampSeconds * 1000);
      }
    }
    
    // Check if timestamp needs updating
    if (currentTimestampSeconds === CORRECT_TIMESTAMP_SECONDS) {
      console.log(`✅ Unit ${unitId}: Timestamp already correct (${currentTimestamp?.toISOString() || currentTimestampSeconds})`);
      continue;
    }
    
    const amount = firstEntry.amount || 0;
    const amountPesos = (amount / 100).toFixed(2);
    
    console.log(`📝 Unit ${unitId}:`);
    console.log(`   Current timestamp: ${currentTimestamp?.toISOString() || currentTimestampSeconds || 'none'}`);
    console.log(`   Amount: $${amountPesos}`);
    console.log(`   Will update to: ${CORRECT_TIMESTAMP_DATE.toISOString()} (${CORRECT_TIMESTAMP_SECONDS})`);
    
    updates.push({
      unitId,
      amount,
      currentTimestamp: currentTimestampSeconds,
      firstEntry
    });
  }
  
  if (updates.length === 0) {
    console.log(`\n✅ All units already have correct timestamps. No updates needed.`);
    return;
  }
  
  console.log(`\n📋 Summary: ${updates.length} unit(s) need timestamp updates`);
  
  if (isLive) {
    console.log(`\n🔴 APPLYING CHANGES...\n`);
    
    const batch = db.batch();
    
    // Create Firestore Timestamp object for the correct timestamp
    const correctTimestamp = admin.firestore.Timestamp.fromDate(CORRECT_TIMESTAMP_DATE);
    
    for (const update of updates) {
      // Update the timestamp in the history array
      const unitData = creditData[update.unitId];
      const updatedHistory = [...unitData.history];
      updatedHistory[0] = {
        ...update.firstEntry,
        timestamp: correctTimestamp
      };
      
      // Update the unit's history in the creditData object
      creditData[update.unitId] = {
        ...unitData,
        history: updatedHistory
      };
      
      console.log(`   ✅ Updated Unit ${update.unitId} timestamp`);
    }
    
    // Write all updates in a single batch
    batch.set(creditBalancesRef, creditData);
    await batch.commit();
    
    console.log(`\n✅ Successfully updated ${updates.length} unit(s)`);
  } else {
    console.log(`\n🟡 DRY RUN - Would update ${updates.length} unit(s):`);
    updates.forEach(update => {
      console.log(`   - Unit ${update.unitId}: ${update.currentTimestamp || 'none'} → ${CORRECT_TIMESTAMP_SECONDS}`);
    });
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('Fix complete.');
  console.log(`${'='.repeat(80)}\n`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


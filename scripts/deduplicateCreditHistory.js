#!/usr/bin/env node

/**
 * Deduplicate Credit History
 * 
 * This script removes duplicate entries from the creditBalances history.
 * Duplicates can occur when:
 * - The same transaction was recorded in multiple places
 * - Migration scripts ran multiple times
 * - Manual data entry created duplicates
 * 
 * The script identifies duplicates by:
 * 1. Matching transaction IDs (if present)
 * 2. Matching timestamp + amount + type (for entries without transaction IDs)
 * 
 * When duplicates are found, it keeps the most complete entry (one with most fields).
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use the same service account file as other working scripts
const serviceAccountPath = join(__dirname, '../sandyland-management-system-firebase-adminsdk-fbsvc-a06371f054.json');

console.log(`🔑 Using service account: ${serviceAccountPath}`);

if (!existsSync(serviceAccountPath)) {
  console.error(`❌ Service account file not found: ${serviceAccountPath}`);
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(serviceAccountPath, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Create a unique key for an entry to identify duplicates
 */
function getEntryKey(entry) {
  // If there's a transaction ID, use that as the primary key
  if (entry.transactionId) {
    return `txn:${entry.transactionId}`;
  }
  
  // Otherwise, create a composite key from timestamp, amount, and type
  let timestampKey = 'unknown';
  if (entry.timestamp) {
    if (entry.timestamp._seconds) {
      timestampKey = entry.timestamp._seconds.toString();
    } else if (entry.timestamp.seconds) {
      timestampKey = entry.timestamp.seconds.toString();
    } else if (typeof entry.timestamp === 'string') {
      timestampKey = new Date(entry.timestamp).getTime().toString();
    } else if (entry.timestamp.raw && entry.timestamp.raw._seconds) {
      timestampKey = entry.timestamp.raw._seconds.toString();
    }
  }
  
  const amount = entry.amount || 0;
  const type = entry.type || 'unknown';
  
  return `${timestampKey}:${amount}:${type}`;
}

/**
 * Score an entry based on how complete it is
 * Higher score = more complete
 */
function scoreEntry(entry) {
  let score = 0;
  
  if (entry.id) score += 1;
  if (entry.transactionId) score += 2;
  if (entry.description) score += 1;
  if (entry.notes) score += 1;
  if (entry.balanceBefore !== undefined) score += 1;
  if (entry.balanceAfter !== undefined) score += 1;
  if (entry.timestamp) {
    score += 1;
    // Bonus for formatted timestamps
    if (entry.timestamp.display || entry.timestamp.displayFull) score += 1;
  }
  
  return score;
}

/**
 * Deduplicate credit history for a single unit
 */
function deduplicateHistory(history) {
  if (!history || history.length === 0) {
    return { deduplicated: [], duplicatesRemoved: 0 };
  }
  
  const entryMap = new Map();
  let duplicatesRemoved = 0;
  
  // Group entries by their key
  for (const entry of history) {
    const key = getEntryKey(entry);
    
    if (!entryMap.has(key)) {
      entryMap.set(key, entry);
    } else {
      // We have a duplicate - keep the more complete one
      const existing = entryMap.get(key);
      const existingScore = scoreEntry(existing);
      const newScore = scoreEntry(entry);
      
      if (newScore > existingScore) {
        entryMap.set(key, entry);
      }
      
      duplicatesRemoved++;
    }
  }
  
  // Convert map back to array and sort by timestamp (oldest first)
  const deduplicated = Array.from(entryMap.values()).sort((a, b) => {
    const timeA = a.timestamp?._seconds || a.timestamp?.seconds || 0;
    const timeB = b.timestamp?._seconds || b.timestamp?.seconds || 0;
    return timeA - timeB;
  });
  
  return { deduplicated, duplicatesRemoved };
}

/**
 * Main deduplication function
 */
async function deduplicateCreditBalances(clientId, dryRun = true) {
  console.log(`\n🔄 Deduplicating credit history for client: ${clientId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE DEDUPLICATION'}\n`);
  
  try {
    // Get the centralized creditBalances document
    const creditBalancesRef = db.doc(`clients/${clientId}/units/creditBalances`);
    const creditBalancesDoc = await creditBalancesRef.get();
    
    if (!creditBalancesDoc.exists) {
      console.log('❌ No creditBalances document found for client:', clientId);
      return;
    }
    
    const creditBalancesData = creditBalancesDoc.data();
    const unitIds = Object.keys(creditBalancesData).filter(key => key !== 'lastChange');
    
    console.log(`Found ${unitIds.length} units to process\n`);
    
    let totalDuplicatesRemoved = 0;
    let unitsUpdated = 0;
    const updatedData = { ...creditBalancesData };
    
    // Process each unit
    for (const unitId of unitIds) {
      console.log(`📊 Processing unit ${unitId}...`);
      
      const unitData = creditBalancesData[unitId];
      const history = unitData.history || [];
      
      if (history.length === 0) {
        console.log(`  ℹ️  No history entries`);
        console.log('');
        continue;
      }
      
      // Deduplicate
      const { deduplicated, duplicatesRemoved } = deduplicateHistory(history);
      
      console.log(`  Before: ${history.length} entries`);
      console.log(`  After: ${deduplicated.length} entries`);
      console.log(`  Removed: ${duplicatesRemoved} duplicates`);
      
      if (duplicatesRemoved > 0) {
        totalDuplicatesRemoved += duplicatesRemoved;
        unitsUpdated++;
        
        // Update the unit data with deduplicated history
        updatedData[unitId] = {
          ...unitData,
          history: deduplicated
        };
      }
      
      console.log('');
    }
    
    // Summary
    console.log(`\n📋 Deduplication Summary:`);
    console.log(`  Units processed: ${unitIds.length}`);
    console.log(`  Units with duplicates: ${unitsUpdated}`);
    console.log(`  Total duplicates removed: ${totalDuplicatesRemoved}`);
    
    if (dryRun) {
      console.log(`\n✨ Dry run complete - no changes made`);
      console.log(`Run with --live to apply changes`);
    } else {
      // Apply updates
      console.log(`\n💾 Applying updates...`);
      await creditBalancesRef.set(updatedData);
      console.log(`✅ All updates applied successfully`);
    }
    
  } catch (error) {
    console.error('\n❌ Deduplication error:', error);
    throw error;
  }
}

// CLI Usage
const args = process.argv.slice(2);
const clientId = args[0];
const isLive = args.includes('--live');

if (!clientId) {
  console.log('Usage: node deduplicateCreditHistory.js <clientId> [--live]');
  console.log('Example: node deduplicateCreditHistory.js AVII');
  console.log('Example: node deduplicateCreditHistory.js AVII --live');
  console.log('\nOptions:');
  console.log('  --live    Execute deduplication (default is dry-run mode)');
  process.exit(1);
}

// Run deduplication
deduplicateCreditBalances(clientId, !isLive)
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });


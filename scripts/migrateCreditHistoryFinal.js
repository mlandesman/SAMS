#!/usr/bin/env node

/**
 * Final Credit History Migration Script
 * 
 * Purpose:
 * 1. Merge credit history from dues documents into creditBalances document
 * 2. Remove credit fields from dues documents (single source of truth)
 * 
 * The creditBalances document under /units/ should be the ONLY place
 * credit balance data is stored.
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

async function migrateCreditHistory(clientId, dryRun = true) {
  console.log(`\n🔄 Migrating credit history for client: ${clientId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}\n`);
  
  try {
    // Get all units
    const unitsSnapshot = await db
      .collection('clients').doc(clientId)
      .collection('units')
      .get();
    
    const unitIds = unitsSnapshot.docs
      .filter(doc => doc.id !== 'creditBalances')
      .map(doc => doc.id);
    
    console.log(`Found ${unitIds.length} units to process\n`);
    
    // Get existing creditBalances document
    const creditBalancesRef = db.collection('clients').doc(clientId)
      .collection('units').doc('creditBalances');
    const creditBalancesDoc = await creditBalancesRef.get();
    const creditBalances = creditBalancesDoc.exists ? creditBalancesDoc.data() : {};
    
    let updatedCreditBalances = { ...creditBalances };
    let unitsUpdated = 0;
    let historyEntriesMerged = 0;
    let duesDocumentsToClean = [];
    
    // Process each unit
    for (const unitId of unitIds) {
      console.log(`\n📊 Processing unit ${unitId}...`);
      
      // Get all dues documents for this unit
      const duesSnapshot = await db
        .collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues')
        .get();
      
      let allHistoryEntries = [];
      let latestCreditBalance = null;
      let latestYear = null;
      
      // Collect history from all dues documents
      for (const duesDoc of duesSnapshot.docs) {
        const year = duesDoc.id;
        const data = duesDoc.data();
        
        if (data.creditBalanceHistory && data.creditBalanceHistory.length > 0) {
          console.log(`  Found ${data.creditBalanceHistory.length} history entries in year ${year}`);
          allHistoryEntries.push(...data.creditBalanceHistory.map(entry => ({
            ...entry,
            sourceYear: year
          })));
          
          duesDocumentsToClean.push({
            unitId,
            year,
            path: duesDoc.ref.path
          });
        }
        
        // Track latest credit balance
        if (data.creditBalance !== undefined) {
          const yearNum = parseInt(year);
          if (!latestYear || yearNum > parseInt(latestYear)) {
            latestYear = year;
            latestCreditBalance = data.creditBalance;
          }
        }
      }
      
      if (allHistoryEntries.length === 0) {
        console.log(`  No credit history found in dues documents`);
        continue;
      }
      
      // Get existing data from creditBalances
      const existingData = updatedCreditBalances[unitId] || {
        creditBalance: 0,
        history: []
      };
      
      console.log(`  Existing creditBalances: ${existingData.history?.length || 0} entries`);
      console.log(`  Dues documents: ${allHistoryEntries.length} entries`);
      
      // Merge histories, avoiding duplicates
      const mergedHistory = [...existingData.history];
      const existingIds = new Set(mergedHistory.map(e => e.id));
      
      for (const entry of allHistoryEntries) {
        if (!existingIds.has(entry.id)) {
          mergedHistory.push(entry);
          historyEntriesMerged++;
        }
      }
      
      // Sort by timestamp
      mergedHistory.sort((a, b) => {
        const timeA = a.timestamp?._seconds || Date.parse(a.timestamp) / 1000 || 0;
        const timeB = b.timestamp?._seconds || Date.parse(b.timestamp) / 1000 || 0;
        return timeA - timeB;
      });
      
      // Update credit balance data
      updatedCreditBalances[unitId] = {
        creditBalance: latestCreditBalance || existingData.creditBalance || 0,
        lastChange: {
          year: latestYear || existingData.lastChange?.year || '2026',
          historyIndex: mergedHistory.length - 1,
          timestamp: new Date().toISOString()
        },
        history: mergedHistory
      };
      
      unitsUpdated++;
      console.log(`  ✅ Merged to ${mergedHistory.length} total entries`);
    }
    
    console.log(`\n📋 Migration Summary:`);
    console.log(`  Units updated: ${unitsUpdated}`);
    console.log(`  History entries merged: ${historyEntriesMerged}`);
    console.log(`  Dues documents to clean: ${duesDocumentsToClean.length}`);
    
    if (!dryRun) {
      // Save merged credit balances
      console.log(`\n💾 Saving merged credit balances...`);
      await creditBalancesRef.set(updatedCreditBalances, { merge: true });
      console.log(`✅ Credit balances updated`);
      
      // Clean dues documents
      console.log(`\n🧹 Cleaning dues documents...`);
      const batch = db.batch();
      let batchCount = 0;
      
      for (const doc of duesDocumentsToClean) {
        const duesRef = db.doc(doc.path);
        batch.update(duesRef, {
          creditBalance: admin.firestore.FieldValue.delete(),
          creditBalanceHistory: admin.firestore.FieldValue.delete()
        });
        
        batchCount++;
        
        // Firestore batch limit is 500
        if (batchCount >= 499) {
          await batch.commit();
          console.log(`  Cleaned ${batchCount} documents`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  Cleaned ${batchCount} documents`);
      }
      
      console.log(`✅ All dues documents cleaned`);
    }
    
    console.log(`\n✨ Migration ${dryRun ? 'preview' : 'complete'}!`);
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

// CLI Usage
const args = process.argv.slice(2);
const clientId = args[0];
const isLive = args.includes('--live');

if (!clientId) {
  console.log('Usage: node migrateCreditHistoryFinal.js <clientId> [--live]');
  console.log('Example: node migrateCreditHistoryFinal.js AVII');
  console.log('Example: node migrateCreditHistoryFinal.js AVII --live');
  console.log('\nOptions:');
  console.log('  --live    Execute migration (default is dry-run mode)');
  process.exit(1);
}

// Run migration
migrateCreditHistory(clientId, !isLive)
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });

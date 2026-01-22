#!/usr/bin/env node
/**
 * Migration Script: Standardize Credit History Types
 * 
 * This script updates creditBalances history entries to use consistent type names:
 * - Positive amounts → type: 'credit_added'
 * - Negative amounts → type: 'credit_used'
 * 
 * This replaces the legacy 'account_credit' type which used amount sign to indicate direction.
 * 
 * Usage:
 *   node scripts/migrate-credit-history-types.js              # Dry run (Dev)
 *   node scripts/migrate-credit-history-types.js --apply      # Apply changes (Dev)
 *   node scripts/migrate-credit-history-types.js --prod       # Dry run (Prod)
 *   node scripts/migrate-credit-history-types.js --prod --apply  # Apply changes (Prod)
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';

// Parse command line arguments
const useProduction = process.argv.includes('--prod');
const applyChanges = process.argv.includes('--apply');
const productionProjectId = 'sams-sandyland-prod';

async function initializeFirebase() {
  if (useProduction) {
    console.log(`🌍 Environment: PRODUCTION`);
    console.log(`🔥 Firebase Project: ${productionProjectId}`);
    console.log(`🔑 Using Application Default Credentials (ADC)`);
    console.log(`   Run 'gcloud auth application-default login' if not authenticated\n`);
    
    // Clear invalid GOOGLE_APPLICATION_CREDENTIALS
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
         !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
      console.log(`⚠️  Clearing invalid GOOGLE_APPLICATION_CREDENTIALS env var`);
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
    console.log(`🌍 Environment: DEVELOPMENT`);
    const { getDb } = await import('../functions/backend/firebase.js');
    return await getDb();
  }
}

async function migrateCreditHistoryTypes() {
  console.log('='.repeat(70));
  console.log('Credit History Type Migration');
  console.log('='.repeat(70));
  console.log(`Mode: ${applyChanges ? '⚠️  APPLY CHANGES' : '👀 DRY RUN (preview only)'}`);
  console.log('');
  
  const db = await initializeFirebase();
  
  // Get all clients
  const clientsSnap = await db.collection('clients').get();
  const clientIds = clientsSnap.docs.map(d => d.id);
  
  console.log(`Found ${clientIds.length} clients: ${clientIds.join(', ')}\n`);
  
  let totalUpdated = 0;
  let totalSkipped = 0;
  const changes = [];
  
  for (const clientId of clientIds) {
    console.log(`\n📁 Processing client: ${clientId}`);
    
    // Get creditBalances document
    const creditBalancesRef = db.collection('clients').doc(clientId)
      .collection('units').doc('creditBalances');
    const creditBalancesDoc = await creditBalancesRef.get();
    
    if (!creditBalancesDoc.exists) {
      console.log(`   ⏭️  No creditBalances document found`);
      continue;
    }
    
    const creditBalancesData = creditBalancesDoc.data();
    const unitIds = Object.keys(creditBalancesData);
    
    console.log(`   Found ${unitIds.length} units with credit data`);
    
    const updatedData = {};
    let clientChanges = 0;
    
    for (const unitId of unitIds) {
      const unitData = creditBalancesData[unitId];
      
      if (!unitData?.history || !Array.isArray(unitData.history)) {
        continue;
      }
      
      const updatedHistory = unitData.history.map(entry => {
        const oldType = entry.type;
        const amount = entry.amount || 0;
        
        // Skip if already using new type names
        if (oldType === 'credit_added' || oldType === 'credit_used' || oldType === 'starting_balance') {
          totalSkipped++;
          return entry;
        }
        
        // Determine new type based on amount sign
        let newType;
        if (oldType === 'account_credit' || oldType === 'account-credit' || !oldType) {
          newType = amount >= 0 ? 'credit_added' : 'credit_used';
        } else {
          // Unknown type - skip
          totalSkipped++;
          return entry;
        }
        
        if (oldType !== newType) {
          changes.push({
            clientId,
            unitId,
            oldType,
            newType,
            amount,
            notes: entry.notes?.substring(0, 50) || 'N/A'
          });
          clientChanges++;
          totalUpdated++;
        }
        
        return {
          ...entry,
          type: newType
        };
      });
      
      updatedData[unitId] = {
        ...unitData,
        history: updatedHistory
      };
    }
    
    if (clientChanges > 0) {
      console.log(`   📝 ${clientChanges} entries to update`);
      
      if (applyChanges) {
        await creditBalancesRef.set(updatedData, { merge: true });
        console.log(`   ✅ Changes applied`);
      }
    } else {
      console.log(`   ✅ All entries already using correct types`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total entries to update: ${totalUpdated}`);
  console.log(`Total entries skipped (already correct): ${totalSkipped}`);
  
  if (changes.length > 0) {
    console.log('\nChanges:');
    console.log('| Client | Unit | Old Type | New Type | Amount | Notes |');
    console.log('|--------|------|----------|----------|--------|-------|');
    changes.slice(0, 20).forEach(c => {
      const amt = (c.amount / 100).toFixed(2);
      console.log(`| ${c.clientId} | ${c.unitId} | ${c.oldType} | ${c.newType} | $${amt} | ${c.notes} |`);
    });
    if (changes.length > 20) {
      console.log(`... and ${changes.length - 20} more`);
    }
  }
  
  if (!applyChanges && totalUpdated > 0) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run with --apply to apply changes.');
  } else if (applyChanges && totalUpdated > 0) {
    console.log('\n✅ All changes have been applied.');
  }
  
  console.log('');
}

migrateCreditHistoryTypes()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

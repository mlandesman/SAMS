#!/usr/bin/env node
/**
 * Fix Unit vs UnitId Fields in Transactions
 * 
 * This script ensures all transactions have BOTH unit and unitId fields
 * to maintain compatibility while we transition to standardizing on unitId
 * 
 * Current situation:
 * - Old/migrated transactions have unitId field
 * - New HOA transactions have unit field
 * - Backend queries both, but we need consistency
 */

import { getDb, initializeFirebase } from '../backend/firebase.js';

// Initialize Firebase
console.log('🔥 Initializing Firebase Admin SDK...');
await initializeFirebase();
const db = await getDb();
console.log('✅ Firebase Admin SDK initialized');

async function fixUnitFields(clientId = 'MTC') {
  console.log(`\n🔧 Fixing unit/unitId fields for client ${clientId}...`);
  
  const stats = {
    total: 0,
    withOnlyUnit: 0,
    withOnlyUnitId: 0,
    withBoth: 0,
    withNeither: 0,
    updated: 0
  };
  
  try {
    // Get all transactions
    const txRef = db.collection(`clients/${clientId}/transactions`);
    const snapshot = await txRef.get();
    
    console.log(`📊 Found ${snapshot.size} transactions\n`);
    
    const batch = db.batch();
    let batchSize = 0;
    
    for (const doc of snapshot.docs) {
      stats.total++;
      const data = doc.data();
      const hasUnit = data.unit !== undefined && data.unit !== null;
      const hasUnitId = data.unitId !== undefined && data.unitId !== null;
      
      // Categorize the transaction
      if (hasUnit && hasUnitId) {
        stats.withBoth++;
      } else if (hasUnit && !hasUnitId) {
        stats.withOnlyUnit++;
        // Add unitId field with same value
        batch.update(doc.ref, {
          unitId: data.unit,
          unitFieldFixed: true,
          fixedAt: new Date()
        });
        batchSize++;
        console.log(`   ✅ Adding unitId="${data.unit}" to transaction ${doc.id}`);
      } else if (!hasUnit && hasUnitId) {
        stats.withOnlyUnitId++;
        // Add unit field with same value
        batch.update(doc.ref, {
          unit: data.unitId,
          unitFieldFixed: true,
          fixedAt: new Date()
        });
        batchSize++;
        console.log(`   ✅ Adding unit="${data.unitId}" to transaction ${doc.id}`);
      } else {
        stats.withNeither++;
        if (data.metadata?.originalUnit) {
          // Try to recover from metadata
          const unitValue = data.metadata.originalUnit;
          batch.update(doc.ref, {
            unit: unitValue,
            unitId: unitValue,
            unitFieldFixed: true,
            fixedAt: new Date()
          });
          batchSize++;
          console.log(`   ✅ Recovered unit="${unitValue}" from metadata for ${doc.id}`);
        }
      }
      
      // Commit batch every 400 operations
      if (batchSize >= 400) {
        await batch.commit();
        stats.updated += batchSize;
        console.log(`\n💾 Committed batch of ${batchSize} updates\n`);
        batchSize = 0;
      }
    }
    
    // Commit remaining updates
    if (batchSize > 0) {
      await batch.commit();
      stats.updated += batchSize;
      console.log(`\n💾 Committed final batch of ${batchSize} updates`);
    }
    
    // Print summary
    console.log('\n📊 Summary:');
    console.log('═'.repeat(40));
    console.log(`Total transactions:       ${stats.total}`);
    console.log(`With only 'unit':        ${stats.withOnlyUnit}`);
    console.log(`With only 'unitId':      ${stats.withOnlyUnitId}`);
    console.log(`With both fields:        ${stats.withBoth}`);
    console.log(`With neither field:      ${stats.withNeither}`);
    console.log('─'.repeat(40));
    console.log(`Transactions updated:     ${stats.updated}`);
    console.log('═'.repeat(40));
    
    return stats;
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const clientId = args[0] || 'MTC';
  
  if (args.includes('--help')) {
    console.log(`
Fix Unit/UnitId Fields Tool

Usage:
  node fix-unit-unitid-fields.js [clientId]
  
Arguments:
  clientId - Client ID (default: MTC)
  
This script ensures all transactions have BOTH unit and unitId fields
for compatibility during the transition period.

Example:
  node fix-unit-unitid-fields.js MTC
`);
    process.exit(0);
  }
  
  try {
    await fixUnitFields(clientId);
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

main();
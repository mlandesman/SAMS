/**
 * Migration Script: Remove totalDue field from HOA dues documents
 * 
 * This script removes the deprecated totalDue field from all HOA dues documents.
 * The totalDue field is unreliable and unused - total due should be calculated
 * from scheduledAmount × 12 instead.
 * 
 * Usage: node backend/scripts/removeTotalDueField.js [clientId]
 * - With clientId: Remove field for specific client
 * - Without: Interactive prompt for client selection
 * 
 * What it does:
 * - Removes totalDue field from all dues documents using FieldValue.delete()
 * - Safe to run multiple times (idempotent)
 * - Logs all changes for audit trail
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import readline from 'readline';

// Initialize Firebase Admin (using existing initialization from firebase.js)
let db;

/**
 * Remove totalDue field from HOA dues documents for a specific client
 */
async function removeTotalDueField(clientId) {
  console.log(`\n🔄 [MIGRATION] Starting totalDue field removal for client: ${clientId}`);
  
  try {
    // Get database instance
    if (!db) {
      db = await getDb();
    }
    
    // Get client document to verify it exists
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      console.error(`❌ Client ${clientId} not found`);
      return { success: false, error: 'Client not found' };
    }
    
    console.log(`   ✅ Client ${clientId} found`);
    
    // Get all units
    const unitsSnapshot = await db.collection('clients').doc(clientId)
      .collection('units').get();
    
    let totalUnits = 0;
    let totalDocs = 0;
    let totalUpdates = 0;
    let totalSkipped = 0;
    let errors = [];
    
    console.log(`   📦 Found ${unitsSnapshot.docs.length} unit documents`);
    
    for (const unitDoc of unitsSnapshot.docs) {
      const unitId = unitDoc.id;
      
      // Skip metadata docs
      if (unitId === 'creditBalances') continue;
      
      totalUnits++;
      
      // Get all dues documents for this unit
      const duesSnapshot = await db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('dues').get();
      
      console.log(`   🏠 Unit ${unitId}: ${duesSnapshot.docs.length} dues document(s)`);
      
      for (const duesDoc of duesSnapshot.docs) {
        const fiscalYear = duesDoc.id;
        const data = duesDoc.data();
        
        totalDocs++;
        
        // Check if totalDue field exists
        if (!('totalDue' in data)) {
          totalSkipped++;
          console.log(`   ⏭️  Skipped ${unitId}/${fiscalYear}: totalDue field not present`);
          continue;
        }
        
        // Remove the totalDue field
        try {
          await duesDoc.ref.update({
            totalDue: admin.firestore.FieldValue.delete()
          });
          totalUpdates++;
          console.log(`   ✅ Removed totalDue from ${unitId}/${fiscalYear}`);
        } catch (updateError) {
          console.error(`   ❌ Error removing totalDue from ${unitId}/${fiscalYear}:`, updateError.message);
          errors.push({ unitId, fiscalYear, error: updateError.message });
        }
      }
    }
    
    console.log(`\n✅ [MIGRATION] Complete for ${clientId}:`);
    console.log(`   📊 Units processed: ${totalUnits}`);
    console.log(`   📊 Dues documents processed: ${totalDocs}`);
    console.log(`   📊 Documents updated: ${totalUpdates}`);
    console.log(`   📊 Documents skipped (no totalDue): ${totalSkipped}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${errors.length}`);
      errors.forEach(err => {
        console.log(`   - ${err.unitId}/${err.fiscalYear}: ${err.error}`);
      });
    }
    
    return {
      success: true,
      clientId,
      unitsProcessed: totalUnits,
      documentsProcessed: totalDocs,
      documentsUpdated: totalUpdates,
      documentsSkipped: totalSkipped,
      errors: errors.length
    };
    
  } catch (error) {
    console.error(`❌ [MIGRATION] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Interactive client selection
 */
async function selectClient() {
  if (!db) {
    db = await getDb();
  }
  
  const clientsSnapshot = await db.collection('clients').get();
  const clients = clientsSnapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().basicInfo?.displayName || doc.id
  }));
  
  console.log('\n📋 Available clients:');
  clients.forEach((client, index) => {
    console.log(`   ${index + 1}. ${client.name} (${client.id})`);
  });
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\nSelect client number (or press Enter for all): ', (answer) => {
      rl.close();
      
      if (!answer || answer.trim() === '') {
        resolve(clients.map(c => c.id));
      } else {
        const index = parseInt(answer) - 1;
        if (index >= 0 && index < clients.length) {
          resolve([clients[index].id]);
        } else {
          console.error('Invalid selection');
          process.exit(1);
        }
      }
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 [MIGRATION] Remove totalDue Field from HOA Dues Documents');
  console.log('   This script removes the deprecated totalDue field\n');
  
  try {
    // Get client ID from command line or interactive selection
    let clientIds;
    
    if (process.argv[2]) {
      clientIds = [process.argv[2]];
      console.log(`📌 Processing specific client: ${clientIds[0]}\n`);
    } else {
      clientIds = await selectClient();
    }
    
    // Process each client
    const results = [];
    for (const clientId of clientIds) {
      const result = await removeTotalDueField(clientId);
      results.push(result);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`\n✅ Successful: ${successful.length} client(s)`);
    console.log(`❌ Failed: ${failed.length} client(s)`);
    
    if (successful.length > 0) {
      console.log('\nDetails:');
      successful.forEach(r => {
        console.log(`   ${r.clientId}: ${r.documentsUpdated}/${r.documentsProcessed} documents updated (${r.documentsSkipped} skipped)`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\nErrors:');
      failed.forEach(r => {
        console.log(`   ${r.clientId || 'Unknown'}: ${r.error}`);
      });
    }
    
    process.exit(failed.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ [MIGRATION] Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { removeTotalDueField };


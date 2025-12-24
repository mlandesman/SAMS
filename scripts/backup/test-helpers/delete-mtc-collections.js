#!/usr/bin/env node
/**
 * Delete MTC Collections (Testing Helper)
 * 
 * Safely deletes all MTC subcollections while preserving:
 * - MTC client document
 * - Users collection
 * - Other clients (AVII, etc.)
 * 
 * Usage:
 *   node scripts/backup/test-helpers/delete-mtc-collections.js
 *   node scripts/backup/test-helpers/delete-mtc-collections.js --dry-run
 */

import { initializeFirebase, getDb } from '../../../functions/backend/firebase.js';
import readline from 'readline';

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Prompt for confirmation
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Recursively delete all documents in a collection
 */
async function deleteCollection(collectionRef, db) {
  const snapshot = await collectionRef.get();
  const batch = db.batch();
  let count = 0;
  
  for (const doc of snapshot.docs) {
    // Delete subcollections recursively
    const subcollections = await doc.ref.listCollections();
    for (const subcol of subcollections) {
      await deleteCollection(subcol, db);
    }
    
    // Delete document
    batch.delete(doc.ref);
    count++;
    
    // Commit in batches of 500 (Firestore limit)
    if (count >= 500) {
      if (!DRY_RUN) {
        await batch.commit();
      }
      count = 0;
    }
  }
  
  if (count > 0 && !DRY_RUN) {
    await batch.commit();
  }
  
  return snapshot.size;
}

async function main() {
  console.log('🗑️  Delete MTC Collections (Testing Helper)');
  console.log('='.repeat(60));
  console.log('');
  
  if (DRY_RUN) {
    console.log('🧪 DRY RUN MODE - No changes will be made');
    console.log('');
  }
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const mtcRef = db.collection('clients').doc('MTC');
    const mtcDoc = await mtcRef.get();
    
    if (!mtcDoc.exists) {
      console.log('❌ MTC client document does not exist');
      process.exit(1);
    }
    
    console.log('📊 Current MTC State:');
    const collections = await mtcRef.listCollections();
    
    let totalDocs = 0;
    const collectionStats = [];
    
    for (const col of collections) {
      const snapshot = await col.get();
      let subDocCount = 0;
      
      // Count subcollection documents
      for (const doc of snapshot.docs) {
        const subcollections = await doc.ref.listCollections();
        for (const subcol of subcollections) {
          const subSnapshot = await subcol.get();
          subDocCount += subSnapshot.size;
        }
      }
      
      collectionStats.push({
        name: col.id,
        documents: snapshot.size,
        subdocuments: subDocCount
      });
      totalDocs += snapshot.size + subDocCount;
    }
    
    collectionStats.forEach(stat => {
      console.log(`   ${stat.name}: ${stat.documents} docs, ${stat.subdocuments} subdocs`);
    });
    console.log(`   Total: ${totalDocs} documents`);
    console.log('');
    
    if (totalDocs === 0) {
      console.log('✅ MTC collections are already empty');
      process.exit(0);
    }
    
    // Confirmation
    if (!DRY_RUN) {
      console.log('⚠️  WARNING: This will delete ALL MTC subcollections!');
      console.log('   - MTC client document will be preserved');
      console.log('   - Users collection will be preserved');
      console.log('   - Other clients (AVII, etc.) will be preserved');
      console.log('');
      
      const confirmed = await prompt('Type "yes" to continue: ');
      if (!confirmed) {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }
      console.log('');
    }
    
    // Delete collections
    console.log('🗑️  Deleting MTC collections...');
    let deletedCount = 0;
    
    for (const col of collections) {
      const stat = collectionStats.find(s => s.name === col.id);
      console.log(`   Deleting ${col.id} (${stat.documents} docs, ${stat.subdocuments} subdocs)...`);
      
      if (DRY_RUN) {
        console.log(`   [DRY RUN] Would delete ${col.id}`);
      } else {
        const count = await deleteCollection(col, db);
        deletedCount += count;
        console.log(`   ✅ Deleted ${col.id}`);
      }
    }
    
    console.log('');
    console.log('='.repeat(60));
    if (DRY_RUN) {
      console.log('🧪 DRY RUN COMPLETE - No changes made');
      console.log(`   Would delete: ${totalDocs} documents`);
    } else {
      console.log('✅ DELETION COMPLETE');
      console.log(`   Deleted: ${deletedCount} documents`);
      console.log('');
      console.log('💡 Next step: Restore from backup to test restore process');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();


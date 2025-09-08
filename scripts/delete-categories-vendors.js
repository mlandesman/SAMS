#!/usr/bin/env node

/**
 * Delete existing categories and vendors to reimport correctly
 */

import { initializeFirebase } from './utils/environment-config.js';
import { writeAuditLog } from './utils/audit-logger.js';

async function deleteAll() {
  const { db } = await initializeFirebase('dev');
  const clientId = 'MTC';
  
  console.log('🗑️ Deleting existing categories and vendors...\n');
  
  // Delete categories
  const categoriesSnap = await db.collection(`clients/${clientId}/categories`).get();
  console.log(`Found ${categoriesSnap.size} categories to delete`);
  
  for (const doc of categoriesSnap.docs) {
    await doc.ref.delete();
    await writeAuditLog(db, {
      action: 'DELETE',
      collection: `clients/${clientId}/categories`,
      documentId: doc.id,
      userId: 'cleanup-script',
      changes: { deleted: doc.data() }
    });
  }
  
  // Delete vendors
  const vendorsSnap = await db.collection(`clients/${clientId}/vendors`).get();
  console.log(`Found ${vendorsSnap.size} vendors to delete`);
  
  for (const doc of vendorsSnap.docs) {
    await doc.ref.delete();
    await writeAuditLog(db, {
      action: 'DELETE',
      collection: `clients/${clientId}/vendors`,
      documentId: doc.id,
      userId: 'cleanup-script',
      changes: { deleted: doc.data() }
    });
  }
  
  console.log('\n✅ Cleanup complete!');
}

deleteAll().catch(console.error);
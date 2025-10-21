#!/usr/bin/env node

/**
 * Delete All Water Bills Script
 * Deletes all existing water bill documents to start fresh
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('./backend/serviceAccountKey.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'sandyland-management-system'
});

const db = getFirestore();

async function deleteAllBills() {
  console.log('🗑️ Starting deletion of all water bills...');
  
  const clientId = 'AVII';
  const billsToDelete = [
    '2025-11',
    '2026-00', 
    '2026-02',
    '2026-03',
    'aggregatedData'
  ];
  
  let deletedCount = 0;
  
  for (const billId of billsToDelete) {
    try {
      const docRef = db
        .collection('clients')
        .doc(clientId)
        .collection('projects')
        .doc('waterBills')
        .collection('bills')
        .doc(billId);
      
      await docRef.delete();
      console.log(`✅ Deleted: ${billId}`);
      deletedCount++;
      
    } catch (error) {
      console.error(`❌ Failed to delete ${billId}:`, error.message);
    }
  }
  
  console.log(`\n🎉 Deletion complete! Deleted ${deletedCount} documents.`);
  console.log('📝 Next steps:');
  console.log('   1. Generate bills for the months you want');
  console.log('   2. Test the refresh button');
  console.log('   3. Verify Unit 101 shows correct data');
}

// Run the deletion
deleteAllBills()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

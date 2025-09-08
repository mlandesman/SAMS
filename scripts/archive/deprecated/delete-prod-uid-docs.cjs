#!/usr/bin/env node

/**
 * Delete old UID-based user documents in production
 */

const admin = require('firebase-admin');

// Old production document IDs to delete
const oldDocIds = [
  'G3ETiqv9oZb9B2O12nHrKT4DrB32',
  'H73garUarcH96TKUbU6T',
  'HRed3AMKlLMCBXseHT9m',
  'JKFQv7wDQdLuPACSglXq',
  'VocL2QUTivZQF17v6Vgp',
  'YHk0uE4Qha5XQrBss1Yw',
  'fjXv8gX1CYWBvOZ1CS27j96oRCT2',
  'm9PS0nsr1yEg4RszihFa',
  'o5eeIcS2ft3Yre4SeBMt',
  'oPf6iwBFq5hEeZcZEl2E',
  'sbWE3YlIThDiFLU2V8e3',
  'uoWjrUAt5hJL73am6jVR'
];

// Initialize Firebase Admin
function initializeFirebase() {
  const serviceAccount = require('../backend/sams-production-serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'sams-sandyland-prod'
  });
  console.log('🔧 Connected to PRODUCTION Firebase');
}

async function deleteOldDocs() {
  try {
    initializeFirebase();
    const db = admin.firestore();
    const usersRef = db.collection('users');
    
    console.log('\n🗑️  Deleting old UID-based documents...\n');
    
    let deleted = 0;
    const batch = db.batch();
    
    for (const docId of oldDocIds) {
      const docRef = usersRef.doc(docId);
      batch.delete(docRef);
      console.log(`  Queued for deletion: ${docId}`);
    }
    
    await batch.commit();
    deleted = oldDocIds.length;
    
    console.log(`\n✅ Deleted ${deleted} old documents\n`);
    
  } catch (error) {
    console.error('❌ Deletion failed:', error);
    process.exit(1);
  }
}

// Run the deletion
deleteOldDocs();
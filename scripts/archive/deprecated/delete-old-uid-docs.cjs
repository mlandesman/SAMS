#!/usr/bin/env node

/**
 * Delete old UID-based user documents after migration
 */

const admin = require('firebase-admin');

// Old document IDs to delete (from dev environment)
const oldDocIds = [
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
  'superadmin-backup-new',
  'uoWjrUAt5hJL73am6jVR'
];

// Initialize Firebase Admin
function initializeFirebase() {
  const env = process.env.NODE_ENV || 'development';
  
  if (env === 'development') {
    const serviceAccount = require('../backend/serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sandyland-management-system'
    });
    console.log('🔧 Connected to DEVELOPMENT Firebase');
  } else {
    console.error('This script is for development environment only');
    process.exit(1);
  }
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
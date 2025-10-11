#!/usr/bin/env node

/**
 * Cleanup Script: Remove base64URL encoded user documents
 * This removes the partially migrated documents from production
 */

const admin = require('firebase-admin');

// Base64URL encoded document IDs to remove
const base64DocIds = [
  'bWljaGFlbEBzYW5keWxhbmQuY29tLm14',
  'bGVla29wZWlrYTE5NTdAZ21haWwuY29t',
  'Z2x1Y2hvd3NAZ21haWwuY29t',
  'cGF0c3kuZmZleHByZXNzQGdtYWlsLmNvbQ',
  'cHlyb2ppbTE5NjFAZ21haWwuY29t',
  'bXNAbGFuZGVzbWFuLmNvbQ',
  'bWljaGFlbEBsYW5kZXNtYW4uY29t',
  'bWFuZG1nYXJjaWFAaG90bWFpbC5jby51aw',
  'cm9iZXJ0LnJvc2FuaWFAc2JjZ2xvYmFsLm5ldA',
  'Y2ZiZXN0ZnJpZW5kc0BnbWFpbC5jb20',
  'bWVpZmxlckBnbWFpbC5jb20',
  'bWljaGVsZWtpbm5vbjY3QGdtYWlsLmNvbQ'
];

// Initialize Firebase Admin
function initializeFirebase() {
  const env = process.env.NODE_ENV || 'production';
  
  if (env === 'production') {
    const serviceAccount = require('../backend/sams-production-serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sams-sandyland-prod'
    });
    console.log('🔧 Connected to PRODUCTION Firebase');
  } else {
    console.error('This script should only run in production mode');
    process.exit(1);
  }
}

async function cleanupBase64Docs() {
  try {
    initializeFirebase();
    const db = admin.firestore();
    const usersRef = db.collection('users');
    
    console.log('\n🧹 Starting cleanup of base64URL documents...\n');
    
    let deleted = 0;
    let notFound = 0;
    
    for (const docId of base64DocIds) {
      try {
        const doc = await usersRef.doc(docId).get();
        
        if (doc.exists) {
          await usersRef.doc(docId).delete();
          console.log(`✅ Deleted: ${docId}`);
          deleted++;
        } else {
          console.log(`⚠️  Not found: ${docId}`);
          notFound++;
        }
      } catch (error) {
        console.error(`❌ Error deleting ${docId}:`, error.message);
      }
    }
    
    console.log('\n📊 Cleanup Summary:');
    console.log(`  Deleted: ${deleted}`);
    console.log(`  Not found: ${notFound}`);
    console.log(`  Total processed: ${base64DocIds.length}`);
    
    console.log('\n✅ Production cleanup complete!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupBase64Docs();
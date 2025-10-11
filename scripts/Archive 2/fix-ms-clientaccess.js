#!/usr/bin/env node

/**
 * Check and fix ms@landesman.com clientAccess structure
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { sanitizeEmailForDocId } from '../backend/utils/emailDocId.js';

// Initialize Firebase
function initializeFirebase() {
  const serviceAccountPath = '../backend/serviceAccountKey.json';
  const serviceAccount = JSON.parse(readFileSync(new URL(serviceAccountPath, import.meta.url)));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sandyland-management-system'
    });
  }
}

async function checkClientAccess() {
  initializeFirebase();
  const db = admin.firestore();
  
  const email = 'ms@landesman.com';
  const emailDocId = sanitizeEmailForDocId(email);
  
  console.log('\n🔍 Checking clientAccess for:', email);
  
  const userDoc = await db.collection('users').doc(emailDocId).get();
  
  if (!userDoc.exists) {
    console.log('❌ User not found');
    return;
  }
  
  const userData = userDoc.data();
  console.log('\nCurrent clientAccess value:');
  console.log('Type:', typeof userData.clientAccess);
  console.log('Is Array:', Array.isArray(userData.clientAccess));
  console.log('Value:', JSON.stringify(userData.clientAccess, null, 2));
  
  // The backend logs show clientAccess: [ 'MTC' ] which is wrong
  // It should be an object like: { MTC: { role: 'unitOwner', ... } }
  
  if (Array.isArray(userData.clientAccess)) {
    console.log('\n⚠️  clientAccess is an array, but should be an object!');
    console.log('This is causing the authentication to fail.');
    
    // We need to check another user to see the correct structure
    console.log('\n📋 Checking michael@landesman.com for correct structure...');
    const michaelDocId = sanitizeEmailForDocId('michael@landesman.com');
    const michaelDoc = await db.collection('users').doc(michaelDocId).get();
    
    if (michaelDoc.exists) {
      const michaelData = michaelDoc.data();
      console.log('\nmichael@landesman.com clientAccess:');
      console.log('Type:', typeof michaelData.clientAccess);
      console.log('Value:', JSON.stringify(michaelData.clientAccess, null, 2));
    }
  }
}

checkClientAccess().catch(console.error);
#!/usr/bin/env node

/**
 * Check user access for ms@landesman.com
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

async function checkUserAccess() {
  initializeFirebase();
  const db = admin.firestore();
  
  const email = 'ms@landesman.com';
  const emailDocId = sanitizeEmailForDocId(email);
  
  console.log('\n🔍 Checking user access for:', email);
  console.log('Document ID:', emailDocId);
  
  // Check user document
  const userDoc = await db.collection('users').doc(emailDocId).get();
  
  if (!userDoc.exists) {
    console.log('❌ User document not found!');
    return;
  }
  
  const userData = userDoc.data();
  console.log('\n📋 User Data:');
  console.log(JSON.stringify(userData, null, 2));
  
  // Check specific fields
  console.log('\n🔐 Access Analysis:');
  console.log('Global Role:', userData.globalRole || 'NOT SET');
  console.log('Client Access:', userData.clientAccess || 'NOT SET');
  console.log('Is Active:', userData.isActive);
  console.log('Account State:', userData.accountState);
  
  // Check if user has MTC access
  if (userData.clientAccess && userData.clientAccess.MTC) {
    console.log('\n✅ User has MTC access:');
    console.log('MTC Role:', userData.clientAccess.MTC.role);
    console.log('MTC Permissions:', userData.clientAccess.MTC.permissions);
  } else {
    console.log('\n❌ User does NOT have MTC access configured');
  }
  
  // Check for any missing required fields
  console.log('\n⚠️  Missing Fields Check:');
  const requiredFields = ['email', 'globalRole', 'clientAccess', 'isActive'];
  const missingFields = requiredFields.filter(field => !userData[field]);
  
  if (missingFields.length > 0) {
    console.log('Missing fields:', missingFields);
  } else {
    console.log('All required fields present');
  }
}

checkUserAccess().catch(console.error);
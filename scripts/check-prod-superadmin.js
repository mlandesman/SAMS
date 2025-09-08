#!/usr/bin/env node

/**
 * Check SuperAdmin configuration in production
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { sanitizeEmailForDocId } from '../backend/utils/emailDocId.js';

// Initialize Firebase
function initializeFirebase() {
  const serviceAccountPath = '../backend/sams-production-serviceAccountKey.json';
  const serviceAccount = JSON.parse(readFileSync(new URL(serviceAccountPath, import.meta.url)));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sams-sandyland-prod'
    });
  }
}

async function checkSuperAdmin() {
  initializeFirebase();
  const db = admin.firestore();
  
  const email = 'michael@landesman.com';
  const emailDocId = sanitizeEmailForDocId(email);
  
  console.log('\n🔍 Checking SuperAdmin in production\n');
  console.log('Email:', email);
  console.log('Document ID:', emailDocId);
  
  const userDoc = await db.collection('users').doc(emailDocId).get();
  
  if (!userDoc.exists) {
    console.log('❌ User document not found!');
    return;
  }
  
  const userData = userDoc.data();
  
  console.log('\n📋 User Document Data:');
  console.log('globalRole:', userData.globalRole);
  console.log('email:', userData.email);
  console.log('name:', userData.name);
  console.log('isActive:', userData.isActive);
  console.log('accountState:', userData.accountState);
  
  // Check the exact casing
  console.log('\n🔍 Role Check:');
  console.log('Is globalRole === "superAdmin":', userData.globalRole === 'superAdmin');
  console.log('Is globalRole === "SuperAdmin":', userData.globalRole === 'SuperAdmin');
  
  // Check client access
  console.log('\n🏢 Client Access:');
  console.log('Has clientAccess:', !!userData.clientAccess);
  if (userData.clientAccess) {
    console.log('Client Access Keys:', Object.keys(userData.clientAccess));
    console.log('MTC Access:', userData.clientAccess.MTC);
  }
}

checkSuperAdmin().catch(console.error);
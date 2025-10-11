#!/usr/bin/env node

/**
 * Test email-based authentication
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { sanitizeEmailForDocId } from '../backend/utils/emailDocId.js';

// Initialize Firebase Admin
function initializeFirebase() {
  const serviceAccountPath = '../backend/serviceAccountKey.json';
  const serviceAccount = JSON.parse(readFileSync(new URL(serviceAccountPath, import.meta.url)));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'sandyland-management-system'
  });
  
  console.log('🔧 Connected to DEVELOPMENT Firebase');
}

// Test email document lookup
async function testEmailAuth() {
  try {
    initializeFirebase();
    const db = admin.firestore();
    
    // Test emails
    const testEmails = [
      'michael@landesman.com',
      'michael@sandyland.com.mx',
      'ms@landesman.com'
    ];
    
    console.log('\n📊 Testing email-based document lookups...\n');
    
    for (const email of testEmails) {
      const emailDocId = sanitizeEmailForDocId(email);
      console.log(`\nTesting: ${email}`);
      console.log(`Document ID: ${emailDocId}`);
      
      const userDoc = await db.collection('users').doc(emailDocId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('✅ Found user document');
        console.log(`  Name: ${userData.name}`);
        console.log(`  Role: ${userData.globalRole}`);
        console.log(`  Email: ${userData.email}`);
        console.log(`  UID: ${userData.uid || 'Not stored'}`);
      } else {
        console.log('❌ User document not found');
      }
    }
    
    // Test decoding
    console.log('\n📊 Testing base64URL decoding...\n');
    const testDocId = 'bWljaGFlbEBsYW5kZXNtYW4uY29t';
    const decoded = Buffer.from(testDocId + '='.repeat((4 - testDocId.length % 4) % 4), 'base64').toString('utf8');
    console.log(`Encoded: ${testDocId}`);
    console.log(`Decoded: ${decoded}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testEmailAuth();
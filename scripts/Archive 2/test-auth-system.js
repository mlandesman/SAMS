#!/usr/bin/env node

/**
 * Automated authentication system test
 * Tests the email-based document ID system end-to-end
 */

import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const API_BASE = 'http://localhost:5001/api';

// Test user credentials (you'll need to get tokens for these)
const TEST_USERS = [
  {
    email: 'michael@landesman.com',
    expectedRole: 'superAdmin',
    name: 'Michael Landesman'
  },
  {
    email: 'ms@landesman.com', 
    expectedRole: 'user',
    name: 'Michael Landesman'
  }
];

// Initialize Firebase Admin to get tokens
function initializeFirebase() {
  const serviceAccountPath = '../backend/serviceAccountKey.json';
  const serviceAccount = JSON.parse(readFileSync(new URL(serviceAccountPath, import.meta.url)));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sandyland-management-system'
    });
  }
  
  console.log('🔧 Connected to Firebase Admin');
}

// Test API endpoints
async function testAPI() {
  console.log('\n🧪 Testing Authentication System\n');
  console.log('=' * 50);

  // Test 1: Health check
  console.log('\n📍 Test 1: API Health Check');
  try {
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.text();
    console.log(`✅ API is ${healthData}`);
  } catch (error) {
    console.log(`❌ API health check failed: ${error.message}`);
    console.log('   Make sure the backend is running on port 5001');
    return;
  }

  // Test 2: Test unauthenticated access
  console.log('\n📍 Test 2: Unauthenticated Access');
  try {
    const response = await fetch(`${API_BASE}/user/profile`);
    if (response.status === 401) {
      console.log('✅ Correctly rejected unauthenticated request');
    } else {
      console.log(`❌ Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }

  // Test 3: Database lookup test
  console.log('\n📍 Test 3: Direct Database Lookup');
  initializeFirebase();
  const db = admin.firestore();
  
  for (const testUser of TEST_USERS) {
    console.log(`\n   Testing ${testUser.email}:`);
    
    // Check new email-based document
    const emailDocId = Buffer.from(testUser.email.toLowerCase())
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    const userDoc = await db.collection('users').doc(emailDocId).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log(`   ✅ Found by email ID: ${emailDocId}`);
      console.log(`      Role: ${userData.globalRole}`);
      console.log(`      Name: ${userData.name}`);
      
      // Verify expected data
      if (userData.globalRole === testUser.expectedRole) {
        console.log(`   ✅ Role matches expected: ${testUser.expectedRole}`);
      } else {
        console.log(`   ❌ Role mismatch! Expected: ${testUser.expectedRole}, Got: ${userData.globalRole}`);
      }
    } else {
      console.log(`   ❌ User not found by email ID: ${emailDocId}`);
    }
  }

  // Test 4: Check for any remaining UID-based documents
  console.log('\n📍 Test 4: Check for Unmigrated Documents');
  const allUsers = await db.collection('users').get();
  let uidBasedCount = 0;
  let emailBasedCount = 0;
  
  allUsers.forEach(doc => {
    const docId = doc.id;
    // Check if it looks like a Firebase UID (alphanumeric, 20-30 chars)
    if (/^[a-zA-Z0-9]{20,30}$/.test(docId)) {
      uidBasedCount++;
      console.log(`   ⚠️  Found UID-based document: ${docId}`);
    } else {
      emailBasedCount++;
    }
  });
  
  console.log(`\n   Summary: ${emailBasedCount} email-based, ${uidBasedCount} UID-based`);
  if (uidBasedCount === 0) {
    console.log('   ✅ All documents migrated to email-based IDs');
  } else {
    console.log('   ⚠️  Some documents still using UID-based IDs');
  }

  // Test 5: Performance test
  console.log('\n📍 Test 5: Lookup Performance');
  const testEmail = 'michael@landesman.com';
  const perfEmailDocId = Buffer.from(testEmail.toLowerCase())
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  const startTime = Date.now();
  await db.collection('users').doc(perfEmailDocId).get();
  const lookupTime = Date.now() - startTime;
  
  console.log(`   ✅ Email-based lookup took: ${lookupTime}ms`);
  
  console.log('\n' + '=' * 50);
  console.log('🏁 Automated tests complete!\n');
}

// Run tests
testAPI().catch(console.error);
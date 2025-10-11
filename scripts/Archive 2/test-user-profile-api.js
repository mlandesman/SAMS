#!/usr/bin/env node

/**
 * Test user profile API endpoint
 */

import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const API_BASE = 'http://localhost:5001/api';

// Initialize Firebase Admin to get a token
async function getAuthToken(email) {
  const serviceAccountPath = '../backend/serviceAccountKey.json';
  const serviceAccount = JSON.parse(readFileSync(new URL(serviceAccountPath, import.meta.url)));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'sandyland-management-system'
    });
  }
  
  // Note: In a real scenario, you'd get this from Firebase Auth
  // For testing, we'll simulate a token
  console.log('⚠️  Note: Real authentication requires Firebase Auth token');
  console.log('   This test shows what the API expects to receive');
  return null;
}

async function testUserProfile() {
  console.log('\n🔍 Testing User Profile API\n');
  
  // Test 1: Check API structure
  console.log('1. Testing API Response Structure:');
  console.log('   Expected flow:');
  console.log('   - Frontend calls GET /api/user/profile');
  console.log('   - Backend uses email from Firebase Auth token');
  console.log('   - Backend looks up user by email-based document ID');
  console.log('   - Returns user data with clientAccess');
  
  // Test 2: Check what frontend needs
  console.log('\n2. Frontend Requirements:');
  console.log('   The frontend expects:');
  console.log('   - user.globalRole (for general permissions)');
  console.log('   - user.clientAccess (object with client permissions)');
  console.log('   - user.clientAccess.MTC (for MTC-specific access)');
  console.log('   - user.isActive (to check if account is active)');
  
  // Test 3: Common issues
  console.log('\n3. Common Issues to Check:');
  console.log('   ❓ Is the frontend getting a 401 Unauthorized?');
  console.log('   ❓ Is the user profile API returning incomplete data?');
  console.log('   ❓ Is there a timing issue with authentication?');
  console.log('   ❓ Are there console errors about missing properties?');
  
  console.log('\n4. Debug Steps:');
  console.log('   1. Open browser DevTools Network tab');
  console.log('   2. Clear Network log');
  console.log('   3. Login as ms@landesman.com');
  console.log('   4. Look for /api/user/profile request');
  console.log('   5. Check the response data');
  console.log('   6. Verify it contains clientAccess.MTC');
  
  console.log('\n5. Backend Logs to Check:');
  console.log('   Look for these in the backend console:');
  console.log('   - "Looking up user document with ID: bXNAbGFuZGVzbWFuLmNvbQ"');
  console.log('   - "User data retrieved"');
  console.log('   - "Returning user profile with client access"');
}

testUserProfile().catch(console.error);
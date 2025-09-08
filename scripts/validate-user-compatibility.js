#!/usr/bin/env node

/**
 * Validate User Compatibility Script
 * 
 * This script checks if the application code will work correctly with the
 * standardized user structure by simulating common user operations.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../backend/serviceAccountKey.json'), 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = getFirestore(app);

/**
 * Test user access patterns used in the application
 */
function testUserAccess(userData) {
  console.log(`\n🧪 Testing access patterns for: ${userData.email}`);
  console.log('================================================');
  
  const tests = [];
  
  // Test 1: Basic user info access
  tests.push({
    name: 'Basic User Info',
    test: () => {
      const email = userData.email;
      const displayName = userData.displayName;
      const globalRole = userData.globalRole;
      
      return email && displayName && globalRole;
    },
    fields: ['email', 'displayName', 'globalRole']
  });
  
  // Test 2: Client access structure
  tests.push({
    name: 'Client Access Structure',
    test: () => {
      const clientAccess = userData.clientAccess;
      if (!clientAccess || !clientAccess.MTC) return false;
      
      const mtcAccess = clientAccess.MTC;
      return mtcAccess.role && typeof mtcAccess.role === 'string';
    },
    fields: ['clientAccess.MTC.role']
  });
  
  // Test 3: Unit assignments
  tests.push({
    name: 'Unit Assignments',
    test: () => {
      const mtcAccess = userData.clientAccess?.MTC;
      if (!mtcAccess) return false;
      
      // Check primary unit (optional)
      const hasPrimaryUnit = !mtcAccess.unitId || typeof mtcAccess.unitId === 'string';
      
      // Check unit assignments array (optional)
      const hasValidAssignments = !mtcAccess.unitAssignments || 
        (Array.isArray(mtcAccess.unitAssignments) && 
         mtcAccess.unitAssignments.every(a => a.unitId && a.role));
      
      return hasPrimaryUnit && hasValidAssignments;
    },
    fields: ['clientAccess.MTC.unitId', 'clientAccess.MTC.unitAssignments']
  });
  
  // Test 4: Profile structure (new)
  tests.push({
    name: 'Profile Structure',
    test: () => {
      const profile = userData.profile;
      if (!profile) return false;
      
      return profile.firstName && profile.lastName;
    },
    fields: ['profile.firstName', 'profile.lastName']
  });
  
  // Test 5: Audit fields
  tests.push({
    name: 'Audit Fields',
    test: () => {
      return userData.createdAt && userData.updatedAt;
    },
    fields: ['createdAt', 'updatedAt']
  });
  
  // Test 6: No legacy fields present
  tests.push({
    name: 'No Legacy Fields',
    test: () => {
      const legacyFields = ['role', 'clientId', 'unitId', 'isActive', 'accountState'];
      return !legacyFields.some(field => field in userData);
    },
    fields: ['Checking absence of: role, clientId, unitId, isActive, accountState']
  });
  
  // Run all tests
  console.log('\nRunning compatibility tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ name, test, fields }) => {
    try {
      const result = test();
      if (result) {
        console.log(`✅ ${name}`);
        console.log(`   Fields: ${fields.join(', ')}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        console.log(`   Missing/Invalid: ${fields.join(', ')}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} - Error: ${error.message}`);
      failed++;
    }
  });
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  return { passed, failed, total: tests.length };
}

/**
 * Simulate common user queries
 */
function simulateQueries(userData) {
  console.log('\n🔍 Simulating Common Queries');
  console.log('=============================\n');
  
  // Query 1: Get user's role for a client
  console.log('1️⃣ Get user role for MTC:');
  const userRole = userData.clientAccess?.MTC?.role || 'No access';
  console.log(`   Role: ${userRole}`);
  
  // Query 2: Get user's units
  console.log('\n2️⃣ Get user units:');
  const mtcAccess = userData.clientAccess?.MTC;
  if (mtcAccess) {
    console.log(`   Primary Unit: ${mtcAccess.unitId || 'None'}`);
    if (mtcAccess.unitAssignments && mtcAccess.unitAssignments.length > 0) {
      console.log('   Unit Assignments:');
      mtcAccess.unitAssignments.forEach(assignment => {
        console.log(`   - ${assignment.unitId}: ${assignment.role}`);
      });
    }
  }
  
  // Query 3: Check permissions
  console.log('\n3️⃣ Check admin permissions:');
  const isAdmin = userData.globalRole === 'superAdmin' || 
                  userData.globalRole === 'admin' ||
                  userData.clientAccess?.MTC?.role === 'administrator';
  console.log(`   Is Admin: ${isAdmin}`);
  
  // Query 4: Get display info
  console.log('\n4️⃣ Get display information:');
  console.log(`   Display Name: ${userData.displayName}`);
  console.log(`   Email: ${userData.email}`);
  if (userData.profile) {
    console.log(`   Full Name: ${userData.profile.firstName} ${userData.profile.lastName}`);
  }
}

/**
 * Main validation function
 */
async function validateUsers() {
  console.log('🔧 User Structure Compatibility Validator');
  console.log('=========================================\n');
  
  const userIds = [
    'YHk0uE4Qha5XQrBss1Yw',      // ms@landesman.com
    'fjXv8gX1CYWBvOZ1CS27j96oRCT2' // michael@landesman.com
  ];
  
  const results = [];
  
  for (const userId of userIds) {
    console.log(`\n📋 Validating user: ${userId}`);
    
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        console.log(`⚠️  User not found in database`);
        continue;
      }
      
      const userData = userDoc.data();
      
      // Run compatibility tests
      const testResults = testUserAccess(userData);
      results.push({
        userId,
        email: userData.email,
        ...testResults
      });
      
      // Simulate common queries
      simulateQueries(userData);
      
    } catch (error) {
      console.error(`❌ Error validating user ${userId}:`, error);
    }
  }
  
  // Summary
  console.log('\n\n📊 VALIDATION SUMMARY');
  console.log('====================\n');
  
  results.forEach(result => {
    const status = result.failed === 0 ? '✅ COMPATIBLE' : '❌ NEEDS CLEANING';
    console.log(`${result.email}: ${status} (${result.passed}/${result.total} tests passed)`);
  });
  
  console.log('\n💡 Recommendations:');
  const needsCleaning = results.some(r => r.failed > 0);
  
  if (needsCleaning) {
    console.log('1. Run clean-user-records.js to fix user structure');
    console.log('2. Test application functionality after cleaning');
    console.log('3. Update user creation to use standardized structure');
  } else {
    console.log('✅ All users are compatible with the standardized structure!');
    console.log('The application should work correctly with these users.');
  }
}

// Run validation
validateUsers().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
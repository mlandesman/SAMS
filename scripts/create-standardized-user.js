#!/usr/bin/env node

/**
 * Create Standardized User Script
 * 
 * This script demonstrates how to create new users with the correct field structure
 * according to FIELD_STANDARDS_FINAL_V2.md
 * 
 * Use this as a reference for user creation in the application.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSecureTempPassword } from '../functions/shared/utils/tempPassword.js';

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
const auth = getAuth(app);

/**
 * Create a standardized user structure
 * This is the template for all new users
 */
function createStandardizedUser(params) {
  const {
    uid,
    email,
    firstName,
    lastName,
    phone = '',
    preferredCurrency = 'MXN',
    rfc = '',
    globalRole = 'user',
    clientId = 'MTC',
    clientRole = 'viewer',
    primaryUnitId = null,
    unitAssignments = []
  } = params;
  
  // Build the standardized user object
  const userDoc = {
    // Core fields from Firebase Auth
    email: email,
    displayName: `${firstName} ${lastName}`.trim(),
    
    // Profile information
    profile: {
      firstName: firstName,
      lastName: lastName,
      phone: phone,
      preferredCurrency: preferredCurrency,
      rfc: rfc
    },
    
    // Global role (superAdmin, admin, user)
    globalRole: globalRole,
    
    // Client access structure
    clientAccess: {
      [clientId]: {
        role: clientRole, // administrator, unitOwner, unitManager, viewer
        ...(primaryUnitId && { unitId: primaryUnitId }), // Only add if provided
        ...(unitAssignments.length > 0 && { unitAssignments: unitAssignments })
      }
    },
    
    // Audit fields
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return userDoc;
}

/**
 * Example: Create a new unit owner
 */
async function createUnitOwnerExample() {
  console.log('\n📝 Example: Creating a Unit Owner');
  console.log('==================================\n');
  
  const newUserData = {
    email: 'juan.perez@example.com',
    password: 'TempPassword123!',
    firstName: 'Juan',
    lastName: 'Pérez',
    phone: '+521234567890',
    rfc: 'PEJJ800101ABC',
    globalRole: 'user',
    clientId: 'MTC',
    clientRole: 'unitOwner',
    primaryUnitId: '3A',
    unitAssignments: [
      {
        unitId: '3A',
        role: 'unitOwner',
        addedDate: new Date().toISOString(),
        addedBy: 'admin@example.com'
      },
      {
        unitId: '3B',
        role: 'unitManager',
        addedDate: new Date().toISOString(),
        addedBy: 'admin@example.com'
      }
    ]
  };
  
  try {
    // Step 1: Create Firebase Auth user
    console.log('1️⃣ Creating Firebase Auth user...');
    const authUser = await auth.createUser({
      email: newUserData.email,
      password: newUserData.password,
      displayName: `${newUserData.firstName} ${newUserData.lastName}`
    });
    console.log(`✅ Auth user created with UID: ${authUser.uid}`);
    
    // Step 2: Create Firestore user document
    console.log('\n2️⃣ Creating Firestore user document...');
    const userDoc = createStandardizedUser({
      uid: authUser.uid,
      ...newUserData
    });
    
    console.log('📄 User document structure:');
    console.log(JSON.stringify(userDoc, null, 2));
    
    // In a real scenario, you would save this to Firestore:
    // await db.collection('users').doc(authUser.uid).set(userDoc);
    
    console.log('\n✅ User creation example complete!');
    
  } catch (error) {
    console.error('❌ Error in example:', error);
  }
}

/**
 * Example: Create an administrator
 */
async function createAdminExample() {
  console.log('\n📝 Example: Creating an Administrator');
  console.log('=====================================\n');
  
  const adminData = {
    email: 'admin@mtc.com',
    password: 'SecureAdminPass123!',
    firstName: 'Maria',
    lastName: 'González',
    phone: '+521234567891',
    globalRole: 'admin',
    clientId: 'MTC',
    clientRole: 'administrator',
    // Admins typically don't have specific unit assignments
    primaryUnitId: null,
    unitAssignments: []
  };
  
  const adminDoc = createStandardizedUser(adminData);
  
  console.log('📄 Admin document structure:');
  console.log(JSON.stringify(adminDoc, null, 2));
}

/**
 * Template function for creating users in your application
 */
async function createUser(userData) {
  try {
    // 1. Validate input data
    if (!userData.email || !userData.firstName || !userData.lastName) {
      throw new Error('Email, firstName, and lastName are required');
    }
    
    // 2. Create Firebase Auth user
    const authUser = await auth.createUser({
      email: userData.email,
      password: userData.password || generateSecureTempPassword(),
      displayName: `${userData.firstName} ${userData.lastName}`
    });
    
    // 3. Create standardized Firestore document
    const userDoc = createStandardizedUser({
      uid: authUser.uid,
      ...userData
    });
    
    // 4. Save to Firestore
    await db.collection('users').doc(authUser.uid).set(userDoc);
    
    // 5. Return success
    return {
      success: true,
      uid: authUser.uid,
      email: userData.email
    };
    
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Show examples
console.log('🎯 Standardized User Creation Examples');
console.log('=====================================');
console.log('\nThis script demonstrates the correct user structure for SAMS.');
console.log('Use these examples as templates for user creation.\n');

// Run examples
await createUnitOwnerExample();
await createAdminExample();

console.log('\n📋 Key Points:');
console.log('1. Always include required fields: email, displayName, profile');
console.log('2. Use clientAccess structure for role assignments');
console.log('3. Include audit fields: createdAt, updatedAt');
console.log('4. Do NOT include legacy fields like: role, clientId, unitId at root level');
console.log('5. Use unitAssignments array for multiple unit access');

console.log('\n✅ Examples complete!');
process.exit(0);
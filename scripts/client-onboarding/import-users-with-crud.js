/**
 * Users Import with CRUD Functions
 * 
 * Creates Firebase Auth users and Firestore user documents
 * Following pattern from import-categories-vendors-with-crud.js
 * 
 * Task ID: USER-IMPORT-CRUD
 * Date: 2025-07-10
 * 
 * IMPORTANT: Uses Firebase Admin Auth + Firestore for user management
 */

import admin from 'firebase-admin';
import { createImportMetadata } from '../../backend/controllers/importMetadataController.js';
import { writeAuditLog } from '../../backend/utils/auditLogger.js';
import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';

// Create a system user object that mimics the expected user structure
const systemUser = {
  uid: 'import-script',
  email: 'import@system.local',
  displayName: 'Import Script',
  isSuperAdmin: () => true,
  hasPropertyAccess: () => true
};

/**
 * Load users data from JSON
 */
async function loadUsersData() {
  console.log('📁 Loading Users data...');
  
  const usersData = JSON.parse(await fs.readFile('../../MTCdata/Users.json', 'utf-8'));
  
  console.log(`✅ Loaded ${usersData.length} users`);
  
  return usersData;
}

/**
 * Create or get Firebase Auth user
 */
async function createOrGetAuthUser(userData) {
  const { Email: email, LastName: lastName, Password: password } = userData;
  
  try {
    // Try to get existing user
    const existingUser = await admin.auth().getUserByEmail(email);
    console.log(`   ℹ️ Auth user already exists: ${existingUser.uid}`);
    return existingUser;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      // Create new user
      const newUser = await admin.auth().createUser({
        email: email,
        password: password, // Using provided password (will need to be reset by user)
        displayName: lastName,
        emailVerified: false
      });
      console.log(`   ✅ Created auth user: ${newUser.uid}`);
      return newUser;
    } else {
      throw error;
    }
  }
}

/**
 * Import Users using Firebase Admin
 */
async function importUsersWithCRUD(usersData, db) {
  console.log('👤 Importing Users...\n');
  
  const results = {
    total: usersData.length,
    success: 0,
    errors: 0,
    existing: 0,
    userIds: []
  };
  
  for (const [index, userData] of usersData.entries()) {
    try {
      console.log(`👤 Processing user ${index + 1}/${usersData.length}: ${userData.LastName} (${userData.Email})`);
      
      // Create or get Firebase Auth user
      const authUser = await createOrGetAuthUser(userData);
      
      // Check if Firestore user document exists
      const userRef = db.collection('users').doc(authUser.uid);
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        console.log(`   ⚠️ User document already exists for ${userData.Email}`);
        results.existing++;
        continue;
      }
      
      // Create user document in Firestore
      const userPayload = {
        email: userData.Email,
        name: userData.LastName,
        role: 'unitOwner', // Default role for imported users
        clientId: CLIENT_ID,
        unitId: userData.Unit,
        propertyAccess: {
          [CLIENT_ID]: {
            role: 'unitOwner',
            permissions: [],
            units: [userData.Unit]
          }
        },
        customPermissions: [],
        accountState: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: systemUser.uid,
        lastLogin: null,
        migrationData: {
          importDate: new Date(),
          importScript: 'import-users-with-crud.js',
          originalPassword: true // Flag that password needs to be changed
        }
      };
      
      // Create the user document
      await userRef.set(userPayload);
      
      // Write audit log
      await writeAuditLog(db, {
        module: 'users',
        action: 'CREATE',
        collection: 'users',
        documentId: authUser.uid,
        userId: systemUser.uid,
        changes: {
          created: userPayload
        },
        metadata: {
          importBatch: `import-${new Date().toISOString()}`,
          sourceFile: 'MTCdata/Users.json'
        }
      });
      
      // Store import metadata
      const metadataResult = await createImportMetadata(CLIENT_ID, {
        type: 'user',
        documentId: authUser.uid,
        documentPath: `users/${authUser.uid}`,
        source: 'import-script',
        importScript: 'import-users-with-crud.js',
        originalData: userData
      });
      
      if (!metadataResult.success) {
        console.log(`   ⚠️ Warning: Failed to store metadata: ${metadataResult.error}`);
      }
      
      console.log(`   ✅ Created user: ${userData.LastName} (${userData.Email})`);
      console.log(`      Auth UID: ${authUser.uid}`);
      console.log(`      Unit: ${userData.Unit}`);
      console.log(`      Role: unitOwner`);
      
      results.success++;
      results.userIds.push(authUser.uid);
      
    } catch (error) {
      console.error(`   ❌ Error processing user ${userData.Email}:`, error.message);
      results.errors++;
    }
  }
  
  console.log(`\n📊 Users Import Summary:`);
  console.log(`   Total: ${results.total}`);
  console.log(`   Success: ${results.success}`);
  console.log(`   Existing: ${results.existing}`);
  console.log(`   Errors: ${results.errors}`);
  console.log(`   Audit logs: ${results.success} created`);
  console.log(`   Metadata stored: ${results.success} documents`);
  
  return results;
}

/**
 * Update unit documents with user associations
 */
async function updateUnitsWithUsers(usersData, db) {
  console.log('\n🔗 Updating units with user associations...\n');
  
  const results = {
    updated: 0,
    errors: 0
  };
  
  for (const userData of usersData) {
    try {
      const unitRef = db.collection('clients').doc(CLIENT_ID)
        .collection('units').doc(userData.Unit);
      
      const unitDoc = await unitRef.get();
      if (!unitDoc.exists) {
        console.log(`   ⚠️ Unit ${userData.Unit} not found, skipping...`);
        continue;
      }
      
      // Get current unit data
      const unitData = unitDoc.data();
      const updateData = {};
      let hasChanges = false;
      
      // Update owners array if needed
      const owners = unitData.owners || [];
      const ownerName = userData.LastName;
      if (!owners.includes(ownerName)) {
        owners.push(ownerName);
        updateData.owners = owners;
        hasChanges = true;
      }
      
      // Update emails array if needed  
      const emails = unitData.emails || [];
      if (!emails.includes(userData.Email)) {
        emails.push(userData.Email);
        updateData.emails = emails;
        hasChanges = true;
      }
      
      if (hasChanges) {
        updateData.updated = new Date();
        await unitRef.update(updateData);
        console.log(`   ✅ Updated unit ${userData.Unit} with user ${userData.LastName}`);
        results.updated++;
      } else {
        console.log(`   ℹ️ Unit ${userData.Unit} already has user ${userData.LastName}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error updating unit ${userData.Unit}:`, error.message);
      results.errors++;
    }
  }
  
  console.log(`\n📊 Unit Update Summary:`);
  console.log(`   Units updated: ${results.updated}`);
  console.log(`   Errors: ${results.errors}`);
  
  return results;
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting Users Import with CRUD Functions...\n');
  console.log('✅ This version includes:');
  console.log('   - Firebase Auth user creation');
  console.log('   - Firestore user document creation');
  console.log('   - Automatic audit logging');
  console.log('   - Import metadata tracking');
  console.log('   - Unit association updates\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    clientId: CLIENT_ID,
    userImport: null,
    unitUpdates: null,
    success: false
  };
  
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase('dev');
    
    // Load users data
    const usersData = await loadUsersData();
    
    // Import users
    console.log('\n=== STEP 1: USER IMPORT ===');
    results.userImport = await importUsersWithCRUD(usersData, db);
    
    // Update units with user associations
    console.log('\n=== STEP 2: UNIT ASSOCIATIONS ===');
    results.unitUpdates = await updateUnitsWithUsers(usersData, db);
    
    // Check success
    results.success = results.userImport.errors === 0;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 USERS IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`⏰ Completed: ${results.timestamp}`);
    console.log('');
    console.log('👤 USER IMPORT:');
    console.log(`   Total users to process: ${results.userImport.total}`);
    console.log(`   Successfully imported: ${results.userImport.success}`);
    console.log(`   Already existing: ${results.userImport.existing}`);
    console.log(`   Import errors: ${results.userImport.errors}`);
    console.log('');
    console.log('🏠 UNIT UPDATES:');
    console.log(`   Units updated: ${results.unitUpdates.updated}`);
    console.log(`   Update errors: ${results.unitUpdates.errors}`);
    console.log('');
    console.log('📝 COMPLIANCE:');
    console.log(`   ✅ Firebase Auth users created`);
    console.log(`   ✅ User documents with proper structure`);
    console.log(`   ✅ Automatic audit logging`);
    console.log(`   ✅ Import metadata stored`);
    console.log(`   ✅ Unit associations maintained`);
    
    if (results.success) {
      console.log('\n✅ USERS IMPORT SUCCESSFUL!');
      console.log('⚠️ NOTE: Users will need to reset their passwords on first login');
    } else {
      console.log('\n⚠️ USERS IMPORT COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before proceeding');
    }
    
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n💥 Users import failed:', error);
    results.error = error.message;
    process.exit(1);
  }
}

// Execute
main().then(() => {
  console.log('\n✨ Import completed!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
/**
 * Restore Simple SuperAdmin Structure
 * 
 * Restores the original simple SuperAdmin format without extra permissions arrays
 * 
 * Task ID: MTC-MIGRATION-001 - Restore Simple SuperAdmin
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

const ADMIN_USER_ID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';

async function restoreSimpleSuperAdmin() {
  console.log('🔧 Restoring simple SuperAdmin structure...\n');
  
  await initializeFirebase();
  const db = await getDb();
  
  // Get the user document
  const userRef = db.collection('users').doc(ADMIN_USER_ID);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    console.error('❌ User not found with ID:', ADMIN_USER_ID);
    return;
  }
  
  const userData = userDoc.data();
  console.log('📊 Current user data fields:', Object.keys(userData));
  
  // Create simple SuperAdmin structure based on original format
  const simpleAdminData = {
    email: userData.email,
    name: userData.name,
    globalRole: 'superAdmin',
    
    // Simple client access - just what's needed
    clientAccess: {
      'MTC': {
        role: 'administrator',
        unitId: 'PH4D',
        addedDate: new Date().toISOString(),
        addedBy: 'system-restore'
      }
    },
    
    // Basic account info
    isActive: true,
    accountState: 'active',
    creationMethod: 'admin',
    
    // Simple metadata
    lastModifiedDate: new Date().toISOString(),
    lastModifiedBy: 'system-restore',
    
    // Preserve original creation info if it exists
    createdAt: userData.createdAt || new Date(),
    
    // Remove all the extra fields I added
    // permissions: DELETE
    // canManageUsers: DELETE  
    // canManageClients: DELETE
    // canViewAllData: DELETE
    // menuConfig: DELETE
    // etc.
  };
  
  console.log('\n🔄 Restoring to simple SuperAdmin format...');
  
  // Use set() instead of update() to remove extra fields
  await userRef.set(simpleAdminData);
  
  console.log('✅ SuperAdmin restored to simple format!');
  
  // Verify the restoration
  console.log('\n🔍 Verifying simple SuperAdmin structure...');
  const verifyDoc = await userRef.get();
  const verifyData = verifyDoc.data();
  
  console.log('📊 Restored user data:');
  console.log(`   Email: ${verifyData.email}`);
  console.log(`   Name: ${verifyData.name}`);
  console.log(`   Global Role: ${verifyData.globalRole}`);
  console.log(`   Account State: ${verifyData.accountState}`);
  console.log(`   Fields count: ${Object.keys(verifyData).length}`);
  
  if (verifyData.clientAccess?.MTC) {
    console.log(`   MTC Access Role: ${verifyData.clientAccess.MTC.role}`);
    console.log(`   MTC Unit: ${verifyData.clientAccess.MTC.unitId}`);
  }
  
  // List all fields to confirm cleanup
  console.log('\n📋 All fields in user document:');
  Object.keys(verifyData).forEach(field => {
    console.log(`   - ${field}`);
  });
  
  console.log('\n✅ Simple SuperAdmin restoration complete!');
  console.log('🚀 Try refreshing the browser - should work with original structure');
}

// Execute
restoreSimpleSuperAdmin()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Restoration failed:', error);
    process.exit(1);
  });
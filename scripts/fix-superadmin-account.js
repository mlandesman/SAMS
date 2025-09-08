/**
 * Fix SuperAdmin Account
 * 
 * Restores SuperAdmin privileges to user account that was overwritten during import
 * 
 * Task ID: MTC-MIGRATION-001 - Fix SuperAdmin Account
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { writeAuditLog } from '../backend/utils/auditLogger.js';

const ADMIN_USER_ID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';

async function fixSuperAdminAccount() {
  console.log('🔧 Fixing SuperAdmin account...\n');
  
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
  console.log('📊 Current user data:');
  console.log(`   Email: ${userData.email}`);
  console.log(`   Name: ${userData.name}`);
  console.log(`   Global Role: ${userData.globalRole}`);
  console.log(`   Role: ${userData.role}`);
  console.log(`   Client Access: ${Object.keys(userData.clientAccess || {}).join(', ')}`);
  
  // Update to SuperAdmin while preserving MTC access
  const updatedData = {
    globalRole: 'superAdmin',
    role: 'superAdmin',
    clientAccess: {
      ...(userData.clientAccess || {}),
      // Ensure MTC access is preserved but with admin role
      'MTC': {
        role: 'administrator',
        unitId: userData.clientAccess?.MTC?.unitId || 'PH4D',
        permissions: ['all'],
        addedDate: userData.clientAccess?.MTC?.addedDate || new Date().toISOString(),
        addedBy: 'system-admin-fix'
      }
    },
    // Admin permissions
    permissions: ['all'],
    canManageUsers: true,
    canManageClients: true,
    canViewAllData: true,
    canModifySystemSettings: true,
    
    // Update metadata
    lastUpdated: new Date(),
    accountState: 'active',
    mustChangePassword: false,
    
    // Keep migration data but mark as admin-fixed
    migrationData: {
      ...(userData.migrationData || {}),
      adminFixed: true,
      adminFixedAt: new Date().toISOString(),
      originalRole: userData.role || 'unknown'
    }
  };
  
  console.log('\n🔄 Updating user to SuperAdmin...');
  
  await userRef.update(updatedData);
  
  console.log('✅ User updated successfully!');
  
  // Write audit log
  try {
    await writeAuditLog({
      module: 'users',
      action: 'admin_restore',
      entityType: 'user',
      entityId: ADMIN_USER_ID,
      friendlyName: `Restored SuperAdmin privileges for ${userData.email}`,
      metadata: {
        previousRole: userData.globalRole,
        newRole: 'superAdmin',
        reason: 'Migration overwrote admin account',
        restoredBy: 'system-admin-fix'
      }
    });
    console.log('✅ Audit log created');
  } catch (auditError) {
    console.log('⚠️ Audit log failed (but user update succeeded):', auditError.message);
  }
  
  // Verify the fix
  console.log('\n🔍 Verifying fix...');
  const verifyDoc = await userRef.get();
  const verifyData = verifyDoc.data();
  
  console.log('📊 Updated user data:');
  console.log(`   Email: ${verifyData.email}`);
  console.log(`   Name: ${verifyData.name}`);
  console.log(`   Global Role: ${verifyData.globalRole}`);
  console.log(`   Role: ${verifyData.role}`);
  console.log(`   Permissions: ${verifyData.permissions?.join(', ') || 'none'}`);
  console.log(`   Can Manage Users: ${verifyData.canManageUsers}`);
  console.log(`   Can Manage Clients: ${verifyData.canManageClients}`);
  console.log(`   Account State: ${verifyData.accountState}`);
  
  if (verifyData.clientAccess?.MTC) {
    console.log(`   MTC Access: ${verifyData.clientAccess.MTC.role}`);
    if (verifyData.clientAccess.MTC.unitId) {
      console.log(`   MTC Unit: ${verifyData.clientAccess.MTC.unitId}`);
    }
  }
  
  console.log('\n✅ SuperAdmin account restoration complete!');
  console.log('🚀 You should now be able to access the dashboard with full admin privileges');
}

// Execute
fixSuperAdminAccount()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });
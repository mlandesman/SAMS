/**
 * Fix SuperAdmin Permissions
 * 
 * Adds missing global permissions and client configurations for SuperAdmin
 * 
 * Task ID: MTC-MIGRATION-001 - Fix SuperAdmin Permissions
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

const ADMIN_USER_ID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';

async function fixSuperAdminPermissions() {
  console.log('🔧 Fixing SuperAdmin permissions and configurations...\n');
  
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
  console.log(`   Global Role: ${userData.globalRole}`);
  console.log(`   Permissions: ${userData.permissions?.join(', ') || 'none'}`);
  
  // Update with comprehensive SuperAdmin permissions
  const superAdminData = {
    globalRole: 'superAdmin',
    role: 'superAdmin',
    
    // Global permissions
    permissions: [
      'all',
      'dashboard.view',
      'dashboard.admin',
      'users.manage',
      'clients.manage',
      'system.admin',
      'financial.view',
      'financial.manage',
      'reports.view',
      'reports.generate'
    ],
    
    // Admin capabilities
    canManageUsers: true,
    canManageClients: true,
    canViewAllData: true,
    canModifySystemSettings: true,
    canAccessAllClients: true,
    
    // Client access with full admin rights
    clientAccess: {
      'MTC': {
        role: 'administrator',
        unitId: 'PH4D',
        permissions: [
          'all',
          'dashboard.view',
          'transactions.view',
          'transactions.manage',
          'units.view',
          'units.manage',
          'users.view',
          'users.manage',
          'reports.view',
          'reports.generate',
          'settings.manage'
        ],
        addedDate: new Date().toISOString(),
        addedBy: 'system-admin-fix'
      }
    },
    
    // Preferred client
    preferredClient: 'MTC',
    
    // Account state
    accountState: 'active',
    isActive: true,
    mustChangePassword: false,
    
    // Admin metadata
    lastUpdated: new Date(),
    adminLevel: 'super',
    systemAdmin: true,
    
    // Menu configurations (if needed by frontend)
    menuConfig: {
      showAllMenus: true,
      adminMenus: true,
      clientMenus: true
    }
  };
  
  console.log('\n🔄 Updating SuperAdmin permissions...');
  
  await userRef.update(superAdminData);
  
  console.log('✅ SuperAdmin permissions updated!');
  
  // Also ensure global admin configuration exists
  console.log('\n🌐 Checking global admin configuration...');
  
  const globalAdminsRef = db.collection('system').doc('admins');
  const globalAdminsDoc = await globalAdminsRef.get();
  
  let adminsList = [];
  if (globalAdminsDoc.exists) {
    adminsList = globalAdminsDoc.data().admins || [];
  }
  
  // Add this user to global admins if not already there
  if (!adminsList.includes(ADMIN_USER_ID)) {
    adminsList.push(ADMIN_USER_ID);
    
    await globalAdminsRef.set({
      admins: adminsList,
      lastUpdated: new Date(),
      updatedBy: 'system-admin-fix'
    }, { merge: true });
    
    console.log('✅ Added to global admins list');
  } else {
    console.log('✅ Already in global admins list');
  }
  
  // Verify the fix
  console.log('\n🔍 Verifying permissions fix...');
  const verifyDoc = await userRef.get();
  const verifyData = verifyDoc.data();
  
  console.log('📊 Updated SuperAdmin data:');
  console.log(`   Email: ${verifyData.email}`);
  console.log(`   Global Role: ${verifyData.globalRole}`);
  console.log(`   Permissions: ${verifyData.permissions?.length || 0} permissions`);
  console.log(`   Can Access All Clients: ${verifyData.canAccessAllClients}`);
  console.log(`   System Admin: ${verifyData.systemAdmin}`);
  console.log(`   Account State: ${verifyData.accountState}`);
  console.log(`   Preferred Client: ${verifyData.preferredClient}`);
  
  if (verifyData.clientAccess?.MTC) {
    console.log(`   MTC Permissions: ${verifyData.clientAccess.MTC.permissions?.length || 0} permissions`);
  }
  
  console.log('\n✅ SuperAdmin permissions fix complete!');
  console.log('🚀 Try refreshing the browser - you should now have full dashboard access');
}

// Execute
fixSuperAdminPermissions()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Permissions fix failed:', error);
    process.exit(1);
  });
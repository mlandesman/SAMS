/**
 * Fix User Role - Change 'administrator' to 'admin'
 * 
 * The sidebar expects role to be 'admin' not 'administrator'
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

async function fixUserRole() {
  console.log('🔧 Fixing user role from administrator to admin...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const ADMIN_UID = 'superadmin-backup-new';
    
    // Update the user role
    const userDocRef = db.collection('users').doc(ADMIN_UID);
    
    await userDocRef.update({
      'clientAccess.MTC.role': 'admin',  // Change from 'administrator' to 'admin'
      lastModifiedDate: new Date().toISOString(),
      lastModifiedBy: 'system-role-fix'
    });
    
    console.log('✅ Updated user role from administrator to admin');
    
    // Verify the fix
    const userDoc = await userDocRef.get();
    const userData = userDoc.data();
    
    console.log('\n📊 Updated user profile:');
    console.log(`   Email: ${userData.email}`);
    console.log(`   Global Role: ${userData.globalRole}`);
    console.log(`   MTC Role: ${userData.clientAccess?.MTC?.role}`);
    
    console.log('\n✅ Role fix complete! Try refreshing the browser.');
    
  } catch (error) {
    console.error('❌ Error fixing user role:', error);
    throw error;
  }
}

// Execute
fixUserRole()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
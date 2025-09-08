/**
 * Create SuperAdmin Firestore Profile
 * 
 * Creates the Firestore user profile for the new SuperAdmin account
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

async function createSuperAdminProfile() {
  console.log('🔧 Creating SuperAdmin Firestore profile...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const ADMIN_UID = 'superadmin-backup-new';
    const ADMIN_EMAIL = 'michael@sandyland.com.mx';
    
    // Create simple SuperAdmin profile (based on original format)
    const superAdminProfile = {
      email: ADMIN_EMAIL,
      name: 'Michael Landesman (Backup)',
      globalRole: 'superAdmin',
      
      // Basic account info
      isActive: true,
      accountState: 'active',
      creationMethod: 'admin-backup',
      
      // Simple client access
      clientAccess: {
        'MTC': {
          role: 'administrator',
          addedDate: new Date().toISOString(),
          addedBy: 'system-backup-admin'
        }
      },
      
      // Metadata
      createdAt: new Date(),
      lastModifiedDate: new Date().toISOString(),
      lastModifiedBy: 'system-backup-admin'
    };
    
    const userDocRef = db.collection('users').doc(ADMIN_UID);
    await userDocRef.set(superAdminProfile);
    
    console.log('✅ Created Firestore SuperAdmin profile');
    
    // Verify creation
    const verifyProfile = await userDocRef.get();
    const profileData = verifyProfile.data();
    
    console.log('\n📊 SuperAdmin profile created:');
    console.log(`   Email: ${profileData.email}`);
    console.log(`   Name: ${profileData.name}`);
    console.log(`   Global Role: ${profileData.globalRole}`);
    console.log(`   Account State: ${profileData.accountState}`);
    console.log(`   MTC Access: ${profileData.clientAccess?.MTC?.role || 'none'}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ SUPERADMIN ACCOUNT READY!');
    console.log('='.repeat(70));
    console.log('🔑 LOGIN CREDENTIALS:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: 123456password!`);
    console.log('\n🚀 You can now log in with these credentials!');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Error creating SuperAdmin profile:', error);
    throw error;
  }
}

// Execute
createSuperAdminProfile()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
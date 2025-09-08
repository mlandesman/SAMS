/**
 * Create New SuperAdmin User
 * 
 * Creates a fresh SuperAdmin account with Firebase Auth + Firestore profile
 * 
 * Task ID: MTC-MIGRATION-001 - Create New SuperAdmin
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import admin from 'firebase-admin';

const NEW_ADMIN = {
  uid: 'superadmin-michael-backup',
  email: 'michael@sandyland.com.mx',
  password: '123456password!',
  displayName: 'Michael Landesman (Backup)',
  emailVerified: true
};

async function createNewSuperAdmin() {
  console.log('🔧 Creating new SuperAdmin user...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    // Step 1: Create Firebase Auth user
    console.log('🔐 Creating Firebase Auth user...');
    
    let firebaseUser;
    try {
      // Check if user already exists
      firebaseUser = await admin.auth().getUserByEmail(NEW_ADMIN.email);
      console.log(`⚠️ Firebase Auth user already exists: ${NEW_ADMIN.email}`);
      console.log(`   UID: ${firebaseUser.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create the user
        firebaseUser = await admin.auth().createUser({
          uid: NEW_ADMIN.uid,
          email: NEW_ADMIN.email,
          displayName: NEW_ADMIN.displayName,
          password: NEW_ADMIN.password,
          emailVerified: NEW_ADMIN.emailVerified
        });
        console.log(`✅ Created Firebase Auth user: ${NEW_ADMIN.email}`);
        console.log(`   UID: ${firebaseUser.uid}`);
      } else {
        throw error;
      }
    }
    
    // Step 2: Create Firestore user profile
    console.log('\n📄 Creating Firestore user profile...');
    
    const userDocRef = db.collection('users').doc(firebaseUser.uid);
    
    // Check if profile already exists
    const existingProfile = await userDocRef.get();
    if (existingProfile.exists) {
      console.log('⚠️ Firestore profile already exists, updating...');
    }
    
    // Create simple SuperAdmin profile (based on original format)
    const superAdminProfile = {
      email: NEW_ADMIN.email,
      name: NEW_ADMIN.displayName,
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
    
    await userDocRef.set(superAdminProfile);
    console.log('✅ Created Firestore user profile');
    
    // Step 3: Verify creation
    console.log('\n🔍 Verifying new SuperAdmin account...');
    
    const verifyProfile = await userDocRef.get();
    const profileData = verifyProfile.data();
    
    console.log('📊 New SuperAdmin profile:');
    console.log(`   Email: ${profileData.email}`);
    console.log(`   Name: ${profileData.name}`);
    console.log(`   Global Role: ${profileData.globalRole}`);
    console.log(`   Account State: ${profileData.accountState}`);
    console.log(`   MTC Access: ${profileData.clientAccess?.MTC?.role || 'none'}`);
    console.log(`   Profile fields: ${Object.keys(profileData).length}`);
    
    // Step 4: Verify Firebase Auth
    const authUser = await admin.auth().getUser(firebaseUser.uid);
    console.log('\n🔐 Firebase Auth verification:');
    console.log(`   UID: ${authUser.uid}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Email Verified: ${authUser.emailVerified}`);
    console.log(`   Display Name: ${authUser.displayName}`);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ NEW SUPERADMIN ACCOUNT CREATED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log('🔑 LOGIN CREDENTIALS:');
    console.log(`   Email: ${NEW_ADMIN.email}`);
    console.log(`   Password: ${NEW_ADMIN.password}`);
    console.log('');
    console.log('🚀 You can now log in with these credentials!');
    console.log('   1. Go to the login page');
    console.log('   2. Use the email and password above');
    console.log('   3. You should have full SuperAdmin access');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Error creating SuperAdmin account:', error);
    
    // Cleanup on error
    if (error.code !== 'auth/email-already-exists') {
      try {
        console.log('🧹 Cleaning up on error...');
        await admin.auth().deleteUser(NEW_ADMIN.uid);
        await db.collection('users').doc(NEW_ADMIN.uid).delete();
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError);
      }
    }
    
    throw error;
  }
}

// Execute
createNewSuperAdmin()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
/**
 * Create Missing Firebase Auth User
 * 
 * Creates Firebase Auth account for users who have Firestore profiles but no auth
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import admin from 'firebase-admin';

async function createMissingFirebaseAuth() {
  console.log('🔧 Creating missing Firebase Auth user...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const USER_ID = 'YHk0uE4Qha5XQrBss1Yw';
    const EMAIL = 'ms@landesman.com';
    
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(USER_ID).get();
    if (!userDoc.exists) {
      console.log('❌ Firestore user not found');
      return;
    }
    
    const userData = userDoc.data();
    console.log('📄 Found Firestore user:', userData.email);
    
    // Use the original password from migration data if available
    const originalPassword = userData.migrationData?.originalPassword || '1234';
    console.log(`🔑 Using password: ${originalPassword}`);
    
    // Create Firebase Auth user
    try {
      const firebaseUser = await admin.auth().createUser({
        uid: USER_ID,
        email: EMAIL,
        displayName: userData.name,
        password: originalPassword,
        emailVerified: false  // User will need to verify or admin can set to true
      });
      
      console.log('✅ Created Firebase Auth user');
      console.log(`   UID: ${firebaseUser.uid}`);
      console.log(`   Email: ${firebaseUser.email}`);
      console.log(`   Display Name: ${firebaseUser.displayName}`);
      
      // Update Firestore to reflect auth creation
      await db.collection('users').doc(USER_ID).update({
        'migrationData.firebaseAuthCreated': new Date().toISOString(),
        lastModifiedDate: new Date().toISOString(),
        lastModifiedBy: 'system-auth-fix'
      });
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ USER AUTH FIXED!');
      console.log('='.repeat(60));
      console.log('🔑 LOGIN CREDENTIALS:');
      console.log(`   Email: ${EMAIL}`);
      console.log(`   Password: ${originalPassword}`);
      console.log('');
      console.log('⚠️ USER MUST CHANGE PASSWORD ON FIRST LOGIN');
      console.log('='.repeat(60));
      
    } catch (authError) {
      if (authError.code === 'auth/uid-already-exists') {
        console.log('⚠️ Firebase Auth user already exists with this UID');
        
        // Try to get existing user
        const existingUser = await admin.auth().getUser(USER_ID);
        console.log('✅ Found existing Firebase Auth user:');
        console.log(`   Email: ${existingUser.email}`);
        console.log(`   UID: ${existingUser.uid}`);
        
      } else if (authError.code === 'auth/email-already-exists') {
        console.log('⚠️ Firebase Auth user already exists with this email');
        
        // Try to get by email
        const existingUser = await admin.auth().getUserByEmail(EMAIL);
        console.log('✅ Found existing Firebase Auth user:');
        console.log(`   Email: ${existingUser.email}`);
        console.log(`   UID: ${existingUser.uid}`);
        
        if (existingUser.uid !== USER_ID) {
          console.log('❌ UID MISMATCH - Manual intervention required');
          console.log(`   Expected UID: ${USER_ID}`);
          console.log(`   Actual UID: ${existingUser.uid}`);
        }
      } else {
        throw authError;
      }
    }
    
  } catch (error) {
    console.error('❌ Error creating Firebase Auth user:', error);
    throw error;
  }
}

// Execute
createMissingFirebaseAuth()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
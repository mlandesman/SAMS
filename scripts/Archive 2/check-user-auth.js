/**
 * Check User Authentication Status
 * 
 * Checks both Firestore profile and Firebase Auth for ms@landesman.com
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import admin from 'firebase-admin';

async function checkUserAuth() {
  console.log('🔍 Checking user ms@landesman.com authentication...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const USER_ID = 'YHk0uE4Qha5XQrBss1Yw';
    const EMAIL = 'ms@landesman.com';
    
    // Check Firestore user profile
    console.log('📄 Checking Firestore user profile...');
    const userDoc = await db.collection('users').doc(USER_ID).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ Firestore user profile exists');
      console.log(`   Email: ${userData.email}`);
      console.log(`   Global Role: ${userData.globalRole}`);
      console.log(`   Account State: ${userData.accountState}`);
      console.log(`   Is Active: ${userData.isActive}`);
      console.log(`   Must Change Password: ${userData.mustChangePassword}`);
      console.log(`   Creation Method: ${userData.creationMethod}`);
    } else {
      console.log('❌ Firestore user profile not found');
      return;
    }
    
    // Check Firebase Auth by UID
    console.log('\n🔐 Checking Firebase Auth by UID...');
    try {
      const authUser = await admin.auth().getUser(USER_ID);
      console.log('✅ Firebase Auth user exists');
      console.log(`   UID: ${authUser.uid}`);
      console.log(`   Email: ${authUser.email}`);
      console.log(`   Email Verified: ${authUser.emailVerified}`);
      console.log(`   Disabled: ${authUser.disabled}`);
      console.log(`   Provider: ${authUser.providerData[0]?.providerId || 'password'}`);
    } catch (error) {
      console.log('❌ Firebase Auth user not found by UID');
      console.log(`   Error: ${error.message}`);
    }
    
    // Check Firebase Auth by email
    console.log('\n🔐 Checking Firebase Auth by email...');
    try {
      const authUserByEmail = await admin.auth().getUserByEmail(EMAIL);
      console.log('✅ Firebase Auth user found by email');
      console.log(`   UID: ${authUserByEmail.uid}`);
      console.log(`   Email: ${authUserByEmail.email}`);
      console.log(`   Email Verified: ${authUserByEmail.emailVerified}`);
      console.log(`   Disabled: ${authUserByEmail.disabled}`);
      
      if (authUserByEmail.uid !== USER_ID) {
        console.log('⚠️ UID MISMATCH!');
        console.log(`   Firestore UID: ${USER_ID}`);
        console.log(`   Firebase Auth UID: ${authUserByEmail.uid}`);
      }
    } catch (error) {
      console.log('❌ Firebase Auth user not found by email');
      console.log(`   Error: ${error.message}`);
      console.log('\n🔧 User likely needs to be created in Firebase Auth');
    }
    
  } catch (error) {
    console.error('❌ Error checking user auth:', error);
  }
}

// Execute
checkUserAuth()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
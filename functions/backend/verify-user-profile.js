/**
 * Verify User Profile Data
 * Check if michael@landesman.com has correct profile structure
 */

import { getDb } from './firebase.js';

async function verifyUserProfile() {
  try {
    const db = await getDb();
    
    // Find user by email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', 'michael@landesman.com').get();
    
    if (snapshot.empty) {
      console.log('❌ User not found');
      return;
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('📋 User Profile Verification:');
    console.log('===============================');
    console.log('Email:', userData.email);
    console.log('Name:', userData.name);
    console.log('Global Role:', userData.globalRole);
    console.log('Is Active:', userData.isActive);
    console.log('Client Access:', JSON.stringify(userData.clientAccess, null, 2));
    console.log('');
    
    // Verification checks
    console.log('🔍 Verification Results:');
    console.log('===============================');
    console.log('✅ GlobalRole is superAdmin:', userData.globalRole === 'superAdmin');
    console.log('✅ Account is Active:', userData.isActive === true);
    console.log('✅ Has Client Access:', !!userData.clientAccess);
    console.log('✅ Email matches:', userData.email === 'michael@landesman.com');
    
    // Check if all fixes are properly applied
    const allGood = userData.globalRole === 'superAdmin' && 
                   userData.isActive === true && 
                   userData.email === 'michael@landesman.com';
    
    console.log('');
    console.log(allGood ? '🎉 Profile is correctly configured!' : '❌ Profile needs fixes');
    
    return userData;
    
  } catch (error) {
    console.error('❌ Error verifying profile:', error);
  }
}

verifyUserProfile();
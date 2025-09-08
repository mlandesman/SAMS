/**
 * Fix SuperAdmin User Profile
 * Ensures michael@landesman.com has the correct globalRole
 */

import { getDb } from './firebase.js';

async function fixSuperAdminProfile() {
  try {
    const db = await getDb();
    
    // Find user by email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', 'michael@landesman.com').get();
    
    if (snapshot.empty) {
      console.log('❌ SuperAdmin user not found in database');
      return;
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('📋 Current user data:', JSON.stringify(userData, null, 2));
    
    // Update globalRole to superAdmin
    await userDoc.ref.update({
      globalRole: 'superAdmin',
      lastModifiedDate: new Date().toISOString(),
      lastModifiedBy: 'system-fix'
    });
    
    console.log('✅ SuperAdmin profile updated successfully');
    
    // Verify the update
    const updatedDoc = await userDoc.ref.get();
    const updatedData = updatedDoc.data();
    
    console.log('📋 Updated user data:', JSON.stringify(updatedData, null, 2));
    
  } catch (error) {
    console.error('❌ Error fixing SuperAdmin profile:', error);
  }
}

fixSuperAdminProfile();
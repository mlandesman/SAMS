/**
 * Fix Michael's Account Status and Settings
 */

import { getDb } from './firebase.js';

async function fixMichaelAccount() {
  try {
    const db = await getDb();
    
    // Find user by email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', 'michael@landesman.com').get();
    
    if (snapshot.empty) {
      console.log('❌ Michael\'s account not found');
      return;
    }
    
    const userDoc = snapshot.docs[0];
    console.log('📋 Current account status:', userDoc.data().isActive);
    
    // Update account to be active and fix all settings
    await userDoc.ref.update({
      isActive: true,
      globalRole: 'superAdmin',
      lastModifiedDate: new Date().toISOString(),
      lastModifiedBy: 'system-fix'
    });
    
    console.log('✅ Michael\'s account fixed:');
    console.log('   - Status: Active');
    console.log('   - Role: SuperAdmin');
    
    // Verify the update
    const updatedDoc = await userDoc.ref.get();
    const updatedData = updatedDoc.data();
    
    console.log('📋 Final account data:');
    console.log('   - Email:', updatedData.email);
    console.log('   - Active:', updatedData.isActive);
    console.log('   - Global Role:', updatedData.globalRole);
    console.log('   - Client Access:', Object.keys(updatedData.clientAccess || {}));
    
  } catch (error) {
    console.error('❌ Error fixing account:', error);
  }
}

fixMichaelAccount();
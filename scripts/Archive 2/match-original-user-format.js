/**
 * Update new SuperAdmin user to exactly match original working format
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';

async function matchOriginalUserFormat() {
  console.log('🔧 Updating new user to match original working format...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    const NEW_ADMIN_UID = 'superadmin-backup-new';
    
    // Get the original working user format
    const originalUserRef = db.collection('users').doc('fjXv8gX1CYWBvOZ1CS27j96oRCT2');
    const originalUserDoc = await originalUserRef.get();
    const originalData = originalUserDoc.data();
    
    console.log('📋 Original working user structure:');
    console.log(JSON.stringify(originalData, null, 2));
    
    // Update new user to match original format exactly
    const newUserRef = db.collection('users').doc(NEW_ADMIN_UID);
    
    const matchingProfile = {
      email: 'michael@sandyland.com.mx',
      name: 'Michael Landesman (Backup)',
      globalRole: 'superAdmin',
      
      // Match the original client access structure exactly
      clientAccess: {
        'MTC': {
          role: 'administrator',  // Same as original
          unitId: 'PH4D',        // Same as original
          addedDate: new Date().toISOString(),
          addedBy: 'system-backup-admin'
        }
      },
      
      // Match other fields from original
      isActive: true,
      accountState: 'active',
      creationMethod: 'admin-backup',
      
      // Metadata
      createdAt: new Date(),
      lastLogin: new Date(),  // Add lastLogin like original
      lastModifiedDate: new Date().toISOString(),
      lastModifiedBy: 'system-format-match'
    };
    
    await newUserRef.set(matchingProfile);
    
    console.log('\n✅ Updated new user to match original format');
    
    // Verify the update
    const verifyDoc = await newUserRef.get();
    const verifyData = verifyDoc.data();
    
    console.log('\n📊 New user profile (should match original):');
    console.log(JSON.stringify(verifyData, null, 2));
    
    console.log('\n✅ Format matching complete! Try refreshing the browser.');
    
  } catch (error) {
    console.error('❌ Error matching user format:', error);
    throw error;
  }
}

// Execute
matchOriginalUserFormat()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
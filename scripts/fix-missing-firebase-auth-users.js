/**
 * Fix Missing Firebase Auth Users
 * 
 * Creates Firebase Auth accounts for all users who have Firestore profiles but no auth
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import admin from 'firebase-admin';

async function fixMissingFirebaseAuthUsers() {
  console.log('🔧 Fixing missing Firebase Auth users...\n');
  
  try {
    await initializeFirebase();
    const db = await getDb();
    
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    console.log(`📋 Found ${usersSnapshot.size} users in Firestore`);
    
    let processed = 0;
    let created = 0;
    let alreadyExists = 0;
    let errors = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const email = userData.email;
      
      console.log(`\n👤 Processing user: ${email} (${userId})`);
      
      try {
        // Check if Firebase Auth user exists
        let firebaseUser;
        try {
          firebaseUser = await admin.auth().getUser(userId);
          console.log(`   ✅ Firebase Auth user already exists`);
          alreadyExists++;
        } catch (authError) {
          if (authError.code === 'auth/user-not-found') {
            // User doesn't exist in Firebase Auth - create it
            console.log(`   🔐 Creating missing Firebase Auth user...`);
            
            // Use original password from migration data if available
            const originalPassword = userData.migrationData?.originalPassword || '1234';
            const password = originalPassword.length >= 6 ? originalPassword : `${originalPassword}user`;
            
            try {
              firebaseUser = await admin.auth().createUser({
                uid: userId,  // Use the same UID from Firestore
                email: email,
                displayName: userData.name,
                password: password,
                emailVerified: false
              });
              
              console.log(`   ✅ Created Firebase Auth user with password: ${password}`);
              created++;
              
              // Update Firestore with auth creation info
              await userDoc.ref.update({
                'migrationData.firebaseAuthCreated': new Date().toISOString(),
                'migrationData.authPassword': password,
                lastModifiedDate: new Date().toISOString(),
                lastModifiedBy: 'system-auth-fix'
              });
              
            } catch (createError) {
              if (createError.code === 'auth/email-already-exists') {
                console.log(`   ⚠️ Email ${email} already exists with different UID`);
                
                // Get the existing user to see the UID mismatch
                const existingUser = await admin.auth().getUserByEmail(email);
                console.log(`   📝 Firestore UID: ${userId}`);
                console.log(`   📝 Firebase Auth UID: ${existingUser.uid}`);
                console.log(`   ❌ UID MISMATCH - Manual intervention required`);
                
                errors++;
              } else {
                throw createError;
              }
            }
          } else {
            throw authError;
          }
        }
        
        processed++;
        
      } catch (error) {
        console.error(`   ❌ Error processing user ${email}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 FIREBASE AUTH FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`👥 Total users processed: ${processed}`);
    console.log(`✅ Firebase Auth created: ${created}`);
    console.log(`📝 Already had auth: ${alreadyExists}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(60));
    
    if (created > 0) {
      console.log('\n🔑 NEW USER CREDENTIALS:');
      console.log('All users can now log in with their email and:');
      console.log('- Original password + "user" suffix (if original was <6 chars)');
      console.log('- Or their original password (if >=6 chars)');
      console.log('- Check migration logs for specific passwords');
    }
    
  } catch (error) {
    console.error('❌ Error fixing Firebase Auth users:', error);
    throw error;
  }
}

// Execute
fixMissingFirebaseAuthUsers()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
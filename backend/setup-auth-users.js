// Setup Firebase Auth users to match our Firestore users
import admin from 'firebase-admin';
import { getDb } from './firebase.js';

const setupAuthUsers = async () => {
  console.log('🔐 Setting up Firebase Auth users...');

  try {
    const db = await getDb();
    
    // Test user 1: Backup SuperAdmin
    const adminUser = {
      uid: 'superadmin-backup-new',
      email: 'michael@sandyland.com.mx',
      displayName: 'Michael Landesman (Backup)',
      password: '123456password!',
      emailVerified: true
    };

    // Test user 2: Unit Owner  
    const unitOwnerUser = {
      uid: 'unit-owner-test',
      email: 'owner@example.com',
      displayName: 'John Smith',
      password: 'TestPassword123!',
      emailVerified: true
    };

    // All missing users from migration
    const user1 = {
      uid: 'H73garUarcH96TKUbU6T',
      email: 'leekopeika1957@gmail.com',
      displayName: 'Lee Kopeika',
      password: '2120user',
      emailVerified: true
    };
    const user2 = {
      uid: 'HRed3AMKlLMCBXseHT9m',
      email: 'gluchows@gmail.com',
      displayName: 'Josh Gluchowski',
      password: '8698user',
      emailVerified: true
    };
    const user3 = {
      uid: 'JKFQv7wDQdLuPACSglXq',
      email: 'patsy.ffexpress@gmail.com',
      displayName: 'Patsy Fletcher',
      password: '8460user',
      emailVerified: true
    };
    const user4 = {
      uid: 'VocL2QUTivZQF17v6Vgp',
      email: 'pyrojim1961@gmail.com',
      displayName: 'Jim Harting',
      password: '0092user',
      emailVerified: true
    };
    const user5 = {
      uid: 'YHk0uE4Qha5XQrBss1Yw',
      email: 'ms@landesman.com',
      displayName: 'Michael Landesman',
      password: '0331ms',
      emailVerified: true
    };
    const user6 = {
      uid: 'm9PS0nsr1yEg4RszihFa',
      email: 'mandmgarcia@hotmail.co.uk',
      displayName: 'Malena Garcia Reyes',
      password: '6580user',
      emailVerified: true
    };
    const user7 = {
      uid: 'o5eeIcS2ft3Yre4SeBMt',
      email: 'robert.rosania@sbcglobal.net',
      displayName: 'Robert Rosania',
      password: '7740user',
      emailVerified: true
    };
    const user8 = {
      uid: 'oPf6iwBFq5hEeZcZEl2E',
      email: 'cfbestfriends@gmail.com',
      displayName: 'Cindy Friend',
      password: '0573user',
      emailVerified: true
    };
    const user9 = {
      uid: 'sbWE3YlIThDiFLU2V8e3',
      email: 'meifler@gmail.com',
      displayName: 'Mark Eifler',
      password: '7936user',
      emailVerified: true
    };
    const user10 = {
      uid: 'uoWjrUAt5hJL73am6jVR',
      email: 'michelekinnon67@gmail.com',
      displayName: 'Michele Kinnon',
      password: '9763user',
      emailVerified: true
    };

    const users = [adminUser, unitOwnerUser, user1, user2, user3, user4, user5, user6, user7, user8, user9, user10];

    for (const user of users) {
      try {
        // Check if user already exists
        let firebaseUser;
        try {
          firebaseUser = await admin.auth().getUser(user.uid);
          console.log(`✅ Firebase Auth user already exists: ${user.email}`);
          
          // Update password for existing user (especially ms@landesman.com)
          if (user.email === 'ms@landesman.com') {
            await admin.auth().updateUser(user.uid, {
              password: user.password
            });
            console.log(`🔑 Updated password for ${user.email} to: ${user.password}`);
          }
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            // Create the user
            firebaseUser = await admin.auth().createUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              password: user.password,
              emailVerified: user.emailVerified
            });
            console.log(`✅ Created Firebase Auth user: ${user.email}`);
          } else {
            throw error;
          }
        }

        // Verify Firestore user document exists
        const firestoreUser = await db.collection('users').doc(user.uid).get();
        if (firestoreUser.exists) {
          console.log(`✅ Firestore user document exists: ${user.email}`);
        } else {
          console.log(`❌ Firestore user document missing: ${user.email}`);
        }

      } catch (error) {
        console.error(`❌ Error setting up user ${user.email}:`, error);
      }
    }

    console.log('\n🎯 Authentication Setup Complete!');
    console.log('📋 Test these credentials in the PWA:');
    console.log('   Admin: michael@landesman.com / SamsTest123!');
    console.log('   Unit Owner: owner@example.com / TestPassword123!');

  } catch (error) {
    console.error('❌ Error setting up auth users:', error);
  }
};

setupAuthUsers();

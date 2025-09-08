#!/usr/bin/env node

/**
 * Simplified Users Import Test
 * Tests importing users with proper Firebase initialization
 */

import { initializeFirebase } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
import fs from 'fs/promises';

async function testUsersImport() {
  console.log('🧪 Testing Users Import...\n');
  
  try {
    // Initialize Firebase and get both db and admin
    const { db, admin } = await initializeFirebase('dev');
    console.log('✅ Firebase initialized successfully');
    
    // Load users data
    const usersData = JSON.parse(await fs.readFile('../MTCdata/Users.json', 'utf-8'));
    console.log(`📁 Loaded ${usersData.length} users from file`);
    
    // Test importing just the first user
    const testUser = usersData[0];
    console.log(`\n👤 Testing with user: ${testUser.LastName} (${testUser.Email})`);
    
    // Check if user already exists in Firebase Auth
    try {
      const existingUser = await admin.auth().getUserByEmail(testUser.Email);
      console.log(`✓ User already exists in Firebase Auth with UID: ${existingUser.uid}`);
      
      // Check Firestore document
      const userDoc = await db.collection('users').doc(existingUser.uid).get();
      if (userDoc.exists) {
        console.log('✓ User document exists in Firestore');
        console.log('  Current data:', JSON.stringify(userDoc.data(), null, 2));
      } else {
        console.log('⚠️ User exists in Auth but not in Firestore - creating document...');
        
        // Create Firestore document
        const userData = {
          email: testUser.Email,
          profile: {
            firstName: '',
            lastName: testUser.LastName || '',
            displayName: testUser.LastName || '',
            phone: null,
            avatarUrl: null
          },
          propertyAccess: {
            MTC: {
              units: testUser.Unit ? [testUser.Unit] : [],
              roles: ['owner'],
              permissions: ['view_own_transactions', 'pay_dues'],
              isPrimary: true,
              addedAt: getCurrentTimestamp(),
              addedBy: 'import-script'
            }
          },
          isSuperAdmin: false,
          notifications: {
            email: {
              transactional: true,
              marketing: false,
              reports: true,
              alerts: true
            },
            push: {
              enabled: false
            }
          },
          preferences: {
            language: 'en',
            timezone: 'America/Cancun',
            currency: 'USD'
          },
          metadata: {
            createdAt: getCurrentTimestamp(),
            createdBy: 'import-script',
            lastLogin: null,
            loginCount: 0,
            importBatch: new Date().toISOString()
          }
        };
        
        await db.collection('users').doc(existingUser.uid).set(userData);
        console.log('✅ Created user document in Firestore');
      }
      
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        console.log('❌ User does not exist in Firebase Auth');
        console.log('   Would need to create with temporary password');
      } else {
        throw authError;
      }
    }
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('- Firebase Admin SDK: ✅ Working');
    console.log('- Firebase Auth: ✅ Accessible');
    console.log('- Firestore: ✅ Connected');
    console.log('- Data Files: ✅ Readable');
    console.log('\n✨ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run the test
testUsersImport().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Test Production Connection - Read-Only Script
 * This script safely tests the connection to production Firebase without making any changes
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin for production
const serviceAccount = require('../backend/sams-production-serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'sams-sandyland-prod',
  storageBucket: 'sams-sandyland-prod.appspot.com'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function testProductionConnection() {
  console.log('🔍 Testing Production Connection...\n');
  console.log('Project ID:', serviceAccount.project_id);
  console.log('Environment: PRODUCTION\n');

  try {
    // Test 1: Check if we can read from Firestore
    console.log('📊 Test 1: Firestore Connection');
    console.log('================================');
    
    // List collections
    const collections = await db.listCollections();
    console.log(`✅ Found ${collections.length} collections:`);
    for (const collection of collections) {
      const snapshot = await collection.limit(1).get();
      console.log(`   - ${collection.id} (${snapshot.size} doc sample)`);
    }

    // Test 2: Check clients collection specifically
    console.log('\n👥 Test 2: Clients Collection');
    console.log('================================');
    const clientsSnapshot = await db.collection('clients').get();
    console.log(`✅ Found ${clientsSnapshot.size} clients:`);
    
    clientsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${doc.id}: ${data.name || data.displayName || 'Unnamed'}`);
    });

    // Test 3: Check users collection
    console.log('\n🔐 Test 3: Users Collection');
    console.log('================================');
    const usersSnapshot = await db.collection('users').get();
    console.log(`✅ Found ${usersSnapshot.size} users`);
    
    // Check for SuperAdmin
    let superAdminFound = false;
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.role === 'SuperAdmin') {
        superAdminFound = true;
        console.log(`   ✅ SuperAdmin found: ${data.email}`);
      }
    });
    
    if (!superAdminFound) {
      console.log('   ⚠️  No SuperAdmin user found in production!');
    }

    // Test 4: Check storage bucket
    console.log('\n📦 Test 4: Storage Bucket Connection');
    console.log('=====================================');
    try {
      const [files] = await bucket.getFiles({ maxResults: 5 });
      console.log(`✅ Storage bucket accessible. Sample files (max 5):`);
      files.forEach(file => {
        console.log(`   - ${file.name}`);
      });
    } catch (storageError) {
      console.log('❌ Storage bucket test failed:', storageError.message);
    }

    // Test 5: Check system collection (if exists)
    console.log('\n⚙️  Test 5: System Configuration');
    console.log('==================================');
    try {
      const systemDoc = await db.collection('system').doc('config').get();
      if (systemDoc.exists) {
        const config = systemDoc.data();
        console.log('✅ System config found:');
        console.log(`   - Maintenance Mode: ${config.maintenanceMode || false}`);
        console.log(`   - Version: ${config.version || 'Not set'}`);
      } else {
        console.log('ℹ️  No system config document found');
      }
    } catch (error) {
      console.log('ℹ️  System collection not accessible');
    }

    console.log('\n✅ All production connection tests completed successfully!');
    console.log('\n⚠️  IMPORTANT: This was a READ-ONLY test. No data was modified.');

  } catch (error) {
    console.error('\n❌ Production connection test failed!');
    console.error('Error:', error.message);
    console.error('\nPlease check:');
    console.error('1. Service account key file exists at: backend/sams-production-serviceAccountKey.json');
    console.error('2. Service account has proper permissions in production project');
    console.error('3. You have network connectivity');
    process.exit(1);
  }

  // Clean exit
  process.exit(0);
}

// Run the test
testProductionConnection();
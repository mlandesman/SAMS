#!/usr/bin/env node

/**
 * Fetch user data from DEV Firestore
 * Usage: node get-user-data-dev.js <uid>
 * 
 * This is a convenience script that always uses the dev environment.
 * For switching between prod/dev, use get-user-data-enhanced.js
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Get UID from command line
const uid = process.argv[2];

if (!uid || uid === '--help' || uid === '-h') {
  console.log('📋 SAMS User Data Fetcher (DEV ONLY)\n');
  console.log('Usage: node scripts/get-user-data-dev.js <uid>');
  console.log('       node scripts/get-user-data-dev.js <email>\n');
  console.log('Examples:');
  console.log('  node scripts/get-user-data-dev.js test-user-123');
  console.log('  node scripts/get-user-data-dev.js test@example.com\n');
  console.log('This will fetch user data from DEV Firestore and display:');
  console.log('  - Basic user info (email, name, phone)');
  console.log('  - SAMS profile and permissions');
  console.log('  - Client access and unit assignments');
  console.log('  - Save full JSON to a file');
  console.log('\n⚠️  NOTE: This script ONLY connects to DEV Firestore');
  console.log('For production data, use get-user-data.js or get-user-data-enhanced.js --prod');
  process.exit(0);
}

// Initialize Firebase Admin with DEV credentials
try {
  // Look for DEV service account key
  const possiblePaths = [
    path.join(__dirname, '../backend/serviceAccountKey.json'),
    path.join(__dirname, '../serviceAccountKey.json'),
    path.join(process.cwd(), 'serviceAccountKey.json'),
    path.join(__dirname, '../backend/sams-dev-serviceAccountKey.json'),
    path.join(process.cwd(), 'sams-dev-serviceAccountKey.json')
  ];

  let serviceAccount = null;
  let keyPath = null;

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      serviceAccount = require(filePath);
      keyPath = filePath;
      break;
    }
  }

  if (!serviceAccount) {
    console.error('❌ Could not find DEV service account key file');
    console.error('Searched in:', possiblePaths.join('\n  '));
    console.error('\nPlease ensure serviceAccountKey.json (dev) exists in the project root or backend directory');
    process.exit(1);
  }

  console.log(`\n🧪 DEV ENVIRONMENT`);
  console.log(`✅ Using service account key from: ${keyPath}`);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function fetchUserData(uid) {
  console.log(`\n🔍 Fetching user data for UID: ${uid}\n`);

  try {
    // Fetch from users collection
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      console.error(`❌ No user found with UID: ${uid}`);
      
      // Try to find by email if the UID might be an email
      if (uid.includes('@')) {
        console.log(`\n🔍 Searching by email instead...`);
        const querySnapshot = await db.collection('users')
          .where('email', '==', uid)
          .limit(1)
          .get();
        
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          console.log(`✅ Found user with email ${uid}, actual UID: ${doc.id}\n`);
          displayUserData(doc.id, doc.data());
          return;
        } else {
          console.log(`❌ No user found with email: ${uid}`);
          
          // In dev, also try to list some test users
          console.log('\n📋 Available test users in DEV:');
          const testUsers = await db.collection('users').limit(5).get();
          testUsers.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${doc.id}: ${data.email || 'No email'} (${data.displayName || 'No name'})`);
          });
        }
      }
      
      process.exit(1);
    }

    const userData = userDoc.data();
    displayUserData(uid, userData);

  } catch (error) {
    console.error('❌ Error fetching user data:', error.message);
    process.exit(1);
  }
}

function displayUserData(uid, userData) {
  console.log('═══════════════════════════════════════════════');
  console.log('USER DATA (DEV ENVIRONMENT)');
  console.log('═══════════════════════════════════════════════');
  console.log(`UID: ${uid}`);
  console.log(`Email: ${userData.email || 'Not set'}`);
  console.log(`Display Name: ${userData.displayName || 'Not set'}`);
  console.log(`Phone: ${userData.phoneNumber || 'Not set'}`);
  console.log(`Created: ${userData.createdAt ? new Date(userData.createdAt).toLocaleString() : 'Unknown'}`);
  
  // Check for samsProfile
  if (userData.samsProfile) {
    console.log('\n📋 SAMS Profile:');
    console.log(`  Active: ${userData.samsProfile.isActive || false}`);
    console.log(`  Roles: ${JSON.stringify(userData.samsProfile.roles || {})}`);
    
    if (userData.samsProfile.clientAccess) {
      console.log('\n🏢 Client Access:');
      Object.entries(userData.samsProfile.clientAccess).forEach(([clientId, access]) => {
        console.log(`\n  ${clientId}:`);
        console.log(`    Roles: ${JSON.stringify(access.roles || [])}`);
        console.log(`    Is Admin: ${access.isAdmin || false}`);
        console.log(`    Is Active: ${access.isActive || false}`);
        
        if (access.unitAssignments) {
          console.log(`    Unit Assignments:`);
          if (Array.isArray(access.unitAssignments)) {
            access.unitAssignments.forEach(unit => {
              console.log(`      - ${unit.unitId}: ${unit.role}`);
            });
          } else {
            Object.entries(access.unitAssignments).forEach(([unitId, assignment]) => {
              console.log(`      - ${unitId}: ${assignment.role || assignment}`);
            });
          }
        }
        
        // Show unitId for backward compatibility
        if (access.unitId) {
          console.log(`    Primary Unit ID: ${access.unitId}`);
        }
      });
    }
  } else {
    console.log('\n⚠️  No SAMS Profile found (might be using old structure)');
    
    // Check for old structure
    if (userData.clientAccess) {
      console.log('\n🏢 Client Access (old structure):');
      console.log(JSON.stringify(userData.clientAccess, null, 2));
    }
  }

  // Dev-specific debug info
  console.log('\n🔧 Debug Info:');
  console.log(`  Document Path: users/${uid}`);
  console.log(`  Has Custom Claims: ${userData.customClaims ? 'Yes' : 'No'}`);
  console.log(`  Last Updated: ${userData.lastUpdated || 'Unknown'}`);
  console.log(`  Test User: ${userData.isTestUser ? 'Yes' : 'No'}`);

  // Save to file
  const filename = `user_${uid.replace(/[^a-zA-Z0-9]/g, '_')}_dev_${Date.now()}.json`;
  const filepath = path.join(process.cwd(), filename);
  
  fs.writeFileSync(filepath, JSON.stringify({
    environment: 'dev',
    fetchedAt: new Date().toISOString(),
    uid,
    ...userData
  }, null, 2));
  
  console.log(`\n💾 Full data saved to: ${filename}`);
  console.log('\n═══════════════════════════════════════════════');
  
  // Exit cleanly
  process.exit(0);
}

// Run the fetch
fetchUserData(uid);
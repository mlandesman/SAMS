#!/usr/bin/env node

/**
 * Fetch user data from production Firestore
 * Usage: node get-user-data.js <uid>
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
  console.log('📋 SAMS User Data Fetcher\n');
  console.log('Usage: node scripts/get-user-data.js <uid>');
  console.log('       node scripts/get-user-data.js <email>\n');
  console.log('Examples:');
  console.log('  node scripts/get-user-data.js RXXdmbMQ6CPWJaOPiNBqCPSQbmB3');
  console.log('  node scripts/get-user-data.js ms@landesman.com\n');
  console.log('This will fetch user data from production Firestore and display:');
  console.log('  - Basic user info (email, name, phone)');
  console.log('  - SAMS profile and permissions');
  console.log('  - Client access and unit assignments');
  console.log('  - Save full JSON to a file');
  process.exit(0);
}

// Initialize Firebase Admin
try {
  // Look for service account key in a few places
  const possiblePaths = [
    path.join(__dirname, '../backend/sams-production-serviceAccountKey.json'), // Production key
    path.join(__dirname, '../backend/serviceAccountKey.json'),
    path.join(__dirname, '../serviceAccountKey.json'),
    path.join(__dirname, '../sams-production-serviceAccountKey.json'),
    path.join(process.cwd(), 'sams-production-serviceAccountKey.json')
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
    console.error('❌ Could not find service account key file');
    console.error('Searched in:', possiblePaths.join('\n  '));
    console.error('\nPlease ensure serviceAccountKey.json exists in the project root or backend directory');
    process.exit(1);
  }

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
        } else {
          console.log(`❌ No user found with email: ${uid}`);
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
  console.log('USER DATA');
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

  // Save to file
  const filename = `user_${uid.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
  const filepath = path.join(process.cwd(), filename);
  
  fs.writeFileSync(filepath, JSON.stringify({
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
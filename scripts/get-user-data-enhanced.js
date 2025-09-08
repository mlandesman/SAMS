#!/usr/bin/env node

/**
 * Fetch user data from Firestore (Production or Dev)
 * Usage: 
 *   node get-user-data-enhanced.js <uid>                    # Uses production by default
 *   node get-user-data-enhanced.js <uid> --dev              # Uses dev environment
 *   node get-user-data-enhanced.js <uid> --prod             # Explicitly uses production
 *   node get-user-data-enhanced.js <email> --dev            # Search by email in dev
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

// Parse command line arguments
const args = process.argv.slice(2);
const uid = args.find(arg => !arg.startsWith('--'));
const isDev = args.includes('--dev');
const isProd = args.includes('--prod');

// Determine environment
const environment = isDev ? 'dev' : 'prod';

if (!uid || uid === '--help' || uid === '-h') {
  console.log('📋 SAMS User Data Fetcher (Enhanced)\n');
  console.log('Usage: node scripts/get-user-data-enhanced.js <uid> [options]');
  console.log('       node scripts/get-user-data-enhanced.js <email> [options]\n');
  console.log('Options:');
  console.log('  --dev     Use development Firestore');
  console.log('  --prod    Use production Firestore (default)\n');
  console.log('Examples:');
  console.log('  node scripts/get-user-data-enhanced.js RXXdmbMQ6CPWJaOPiNBqCPSQbmB3');
  console.log('  node scripts/get-user-data-enhanced.js ms@landesman.com --dev');
  console.log('  node scripts/get-user-data-enhanced.js test@example.com --prod\n');
  console.log('This will fetch user data from Firestore and display:');
  console.log('  - Basic user info (email, name, phone)');
  console.log('  - SAMS profile and permissions');
  console.log('  - Client access and unit assignments');
  console.log('  - Save full JSON to a file');
  process.exit(0);
}

// Initialize Firebase Admin
try {
  // Service account key paths based on environment
  const serviceAccountPaths = {
    prod: [
      path.join(__dirname, '../backend/sams-production-serviceAccountKey.json'),
      path.join(__dirname, '../sams-production-serviceAccountKey.json'),
      path.join(process.cwd(), 'sams-production-serviceAccountKey.json')
    ],
    dev: [
      path.join(__dirname, '../backend/serviceAccountKey.json'),
      path.join(__dirname, '../serviceAccountKey.json'),
      path.join(process.cwd(), 'serviceAccountKey.json')
    ]
  };

  const possiblePaths = serviceAccountPaths[environment];
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
    console.error(`❌ Could not find ${environment} service account key file`);
    console.error('Searched in:', possiblePaths.join('\n  '));
    console.error(`\nPlease ensure the ${environment} serviceAccountKey.json exists`);
    process.exit(1);
  }

  console.log(`\n🌍 Environment: ${environment.toUpperCase()}`);
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
  console.log(`USER DATA (${environment.toUpperCase()} ENVIRONMENT)`);
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

  // Additional debug info for dev environment
  if (environment === 'dev') {
    console.log('\n🔧 Debug Info (Dev Only):');
    console.log(`  Document Path: users/${uid}`);
    console.log(`  Has Custom Claims: ${userData.customClaims ? 'Yes' : 'No'}`);
    console.log(`  Last Updated: ${userData.lastUpdated || 'Unknown'}`);
  }

  // Save to file
  const filename = `user_${uid.replace(/[^a-zA-Z0-9]/g, '_')}_${environment}_${Date.now()}.json`;
  const filepath = path.join(process.cwd(), filename);
  
  fs.writeFileSync(filepath, JSON.stringify({
    environment,
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
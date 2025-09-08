#!/usr/bin/env node

/**
 * Create Firebase Auth Users
 * 
 * Creates Firebase Auth users in Production for migration.
 * Generates temporary passwords and updates user mapping.
 * 
 * Usage:
 *   node create-firebase-users.js --client MTC
 */

import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    params[key] = value;
  }
  
  return params;
}

// Get latest migration directory for client
async function getLatestMigrationDir(clientId) {
  const latestLink = path.join(__dirname, 'migrations', `${clientId}-latest`);
  
  try {
    // Try to follow symlink
    const stats = await fs.lstat(latestLink);
    if (stats.isSymbolicLink()) {
      const target = await fs.readlink(latestLink);
      return target;
    }
  } catch (err) {
    // Symlink doesn't exist, find latest directory
  }
  
  // Find latest migration directory for this client
  const migrationsDir = path.join(__dirname, 'migrations');
  const entries = await fs.readdir(migrationsDir);
  
  const clientDirs = entries
    .filter(entry => entry.startsWith(`${clientId}-`) && !entry.endsWith('-latest'))
    .sort()
    .reverse();
  
  if (clientDirs.length === 0) {
    throw new Error(`No migration found for client ${clientId}. Run prepare-migration.js first.`);
  }
  
  return path.join(migrationsDir, clientDirs[0]);
}

// Generate a secure temporary password
function generateTempPassword() {
  // Generate a password that meets Firebase requirements:
  // - At least 6 characters
  // - Mix of letters, numbers, and special characters
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'A'; // uppercase
  password += 'a'; // lowercase
  password += '2'; // number
  password += '!'; // special
  
  // Add random characters to reach 12 characters total
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}


// Main function
async function main() {
  console.log('👥 Firebase User Creation Tool');
  console.log('==============================');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node create-firebase-users.js --client <CLIENT_ID>');
    console.error('Example: node create-firebase-users.js --client MTC');
    process.exit(1);
  }
  
  const { client: clientId } = params;
  
  try {
    // Get migration directory
    const migrationDir = await getLatestMigrationDir(clientId);
    console.log(`\n📁 Using migration: ${path.basename(migrationDir)}`);
    
    // Load export data to get users
    const exportPath = path.join(migrationDir, 'dev-export.json');
    const exportData = JSON.parse(await fs.readFile(exportPath, 'utf-8'));
    
    if (!exportData.users || exportData.users.length === 0) {
      console.log('\n✅ No users to create for this client');
      return;
    }
    
    console.log(`\n📊 Found ${exportData.users.length} users to process`);
    
    // Initialize Firebase Admin for Production
    process.env.FIRESTORE_ENV = 'prod';
    const { db, admin } = await initializeFirebase();
    const auth = admin.auth();
    
    // Process each user
    const userMappings = [];
    const createdUsers = [];
    const existingUsers = [];
    const failedUsers = [];
    
    for (const user of exportData.users) {
      const devUid = user.uid;
      const email = user.email;
      const displayName = user.displayName || user.name || '';
      
      console.log(`\n👤 Processing ${email}...`);
      
      try {
        // Check if user already exists
        let prodUser;
        try {
          prodUser = await auth.getUserByEmail(email);
          console.log(`   ℹ️  User already exists with UID: ${prodUser.uid}`);
          existingUsers.push(email);
        } catch (error) {
          // User doesn't exist, create them
          const tempPassword = generateTempPassword();
          
          const createRequest = {
            email: email,
            emailVerified: user.emailVerified || false,
            disabled: user.disabled || false
          };
          
          // Add optional fields if they exist
          if (displayName) createRequest.displayName = displayName;
          if (tempPassword) createRequest.password = tempPassword;
          if (user.phoneNumber) createRequest.phoneNumber = user.phoneNumber;
          if (user.photoURL) createRequest.photoURL = user.photoURL;
          
          prodUser = await auth.createUser(createRequest);
          console.log(`   ✓ Created user with UID: ${prodUser.uid}`);
          console.log(`   📧 Temporary password: ${tempPassword}`);
          
          createdUsers.push({
            email,
            uid: prodUser.uid,
            tempPassword
          });
        }
        
        // Add to mapping
        userMappings.push({
          email,
          displayName,
          devUid,
          prodUid: prodUser.uid,
          exists: true
        });
        
      } catch (error) {
        console.error(`   ❌ Failed: ${error.message}`);
        failedUsers.push({ email, error: error.message });
        
        // Still add to mapping but mark as not existing
        userMappings.push({
          email,
          displayName,
          devUid,
          prodUid: null,
          exists: false,
          error: error.message
        });
      }
    }
    
    // Save updated user mapping
    const mappingPath = path.join(migrationDir, 'user-mapping.json');
    const mappingData = {
      timestamp: new Date().toISOString(),
      clientId,
      users: userMappings
    };
    
    await fs.writeFile(mappingPath, JSON.stringify(mappingData, null, 2));
    console.log('\n✅ Updated user-mapping.json');
    
    // Save credentials if any users were created
    if (createdUsers.length > 0) {
      const credsPath = path.join(migrationDir, 'user-credentials.json');
      const credsData = {
        timestamp: new Date().toISOString(),
        warning: 'TEMPORARY PASSWORDS - Share securely and require password change on first login',
        users: createdUsers
      };
      
      await fs.writeFile(credsPath, JSON.stringify(credsData, null, 2));
      console.log('✅ Saved temporary credentials to user-credentials.json');
    }
    
    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 User Creation Summary');
    console.log('='.repeat(50));
    console.log(`✅ Created: ${createdUsers.length} users`);
    console.log(`ℹ️  Existing: ${existingUsers.length} users`);
    if (failedUsers.length > 0) {
      console.log(`❌ Failed: ${failedUsers.length} users`);
      failedUsers.forEach(f => console.log(`   - ${f.email}: ${f.error}`));
    }
    
    if (createdUsers.length > 0) {
      console.log('\n⚠️  IMPORTANT:');
      console.log('   1. Temporary passwords saved to user-credentials.json');
      console.log('   2. Share these passwords securely with users');
      console.log('   3. Users should change password on first login');
      console.log('   4. Delete user-credentials.json after sharing');
    }
    
    console.log('\n📋 Next step:');
    console.log(`   Run: node import-client.js --client ${clientId}`);
    
  } catch (error) {
    console.error('\n❌ User creation failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run
main();
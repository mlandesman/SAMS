#!/usr/bin/env node

/**
 * Prepare User Mapping
 * 
 * Creates a mapping between Dev users and their Production UIDs.
 * This script generates instructions for creating Firebase Auth users
 * and prepares the mapping file for migrate-users.js
 * 
 * Usage:
 *   node prepare-user-mapping.js --client AVII
 */

import { initializeFirebase } from './utils/environment-config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
    throw new Error(`No migration found for client ${clientId}. Run init-migration.js first.`);
  }
  
  return path.join(migrationsDir, clientDirs[0]);
}

// Update metadata
async function updateMetadata(migrationDir, updates) {
  const metadataPath = path.join(migrationDir, 'metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  
  // Deep merge updates
  if (updates.phases) {
    metadata.phases = { ...metadata.phases, ...updates.phases };
  }
  Object.assign(metadata, updates);
  
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  return metadata;
}

// Write log entry
async function writeLog(migrationDir, message, level = 'INFO') {
  const logPath = path.join(migrationDir, 'migration.log');
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level}] ${message}\n`;
  
  try {
    await fs.appendFile(logPath, logEntry);
  } catch (error) {
    await fs.writeFile(logPath, logEntry);
  }
}

// Check Production Firebase Auth for existing users
async function checkProdAuthUsers(admin, devUsers) {
  console.log('\n🔍 Checking Production Firebase Auth for existing users...');
  
  const userStatus = [];
  
  for (const devUser of devUsers) {
    try {
      // Try to get user by email in Production
      const authUser = await admin.auth().getUserByEmail(devUser.email);
      userStatus.push({
        email: devUser.email,
        devUid: devUser.uid,
        prodUid: authUser.uid,
        exists: true,
        displayName: authUser.displayName || devUser.displayName
      });
      console.log(`   ✓ Found: ${devUser.email} → ${authUser.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userStatus.push({
          email: devUser.email,
          devUid: devUser.uid,
          prodUid: null,
          exists: false,
          displayName: devUser.displayName
        });
        console.log(`   ⚠️  Not found: ${devUser.email} (needs creation)`);
      } else {
        throw error;
      }
    }
  }
  
  return userStatus;
}

// Main function
async function main() {
  console.log('👥 User Mapping Preparation Tool');
  console.log('================================');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client) {
    console.error('❌ Missing required parameters');
    console.error('Usage: node prepare-user-mapping.js --client <CLIENT_ID>');
    console.error('Example: node prepare-user-mapping.js --client AVII');
    process.exit(1);
  }
  
  const { client: clientId } = params;
  
  try {
    // Get migration directory
    const migrationDir = await getLatestMigrationDir(clientId);
    console.log(`\n📁 Using migration: ${path.basename(migrationDir)}`);
    
    // Load dev export
    const exportPath = path.join(migrationDir, 'dev-export.json');
    const exportData = JSON.parse(await fs.readFile(exportPath, 'utf-8'));
    
    if (!exportData.users || exportData.users.length === 0) {
      console.log('\n✅ No users to migrate for this client');
      
      // Save empty mapping
      const mappingPath = path.join(migrationDir, 'user-mapping.json');
      await fs.writeFile(mappingPath, JSON.stringify({
        clientId,
        timestamp: new Date().toISOString(),
        users: []
      }, null, 2));
      
      await writeLog(migrationDir, 'No users to migrate', 'INFO');
      
      console.log('\n📋 Next step:');
      console.log(`   Run: node purge-prod-client.js --client ${clientId}`);
      return;
    }
    
    // Log start
    await writeLog(migrationDir, 'User mapping phase started', 'INFO');
    await writeLog(migrationDir, `Processing ${exportData.users.length} users`, 'INFO');
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        userMapping: {
          status: 'in-progress',
          timestamp: new Date().toISOString()
        }
      }
    });
    
    // Initialize Firebase Admin for Production
    process.env.FIRESTORE_ENV = 'prod';
    const { admin } = await initializeFirebase();
    
    // Check which users exist in Production Auth
    const userStatus = await checkProdAuthUsers(admin, exportData.users);
    
    // Prepare mapping
    const mapping = {
      clientId,
      timestamp: new Date().toISOString(),
      users: userStatus
    };
    
    // Save mapping
    const mappingPath = path.join(migrationDir, 'user-mapping.json');
    await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2));
    console.log(`\n✅ Saved user mapping to ${path.basename(mappingPath)}`);
    
    // Generate instructions for creating missing users
    const usersToCreate = userStatus.filter(u => !u.exists);
    
    if (usersToCreate.length > 0) {
      console.log('\n' + '='.repeat(50));
      console.log('⚠️  ACTION REQUIRED: Create Firebase Auth Users');
      console.log('='.repeat(50));
      console.log('\nThe following users need to be created in Production Firebase Auth:');
      console.log('(Go to Firebase Console → Authentication → Users → Add User)\n');
      
      for (const user of usersToCreate) {
        console.log(`📧 Email: ${user.email}`);
        console.log(`   Display Name: ${user.displayName || '(not set)'}`);
        console.log(`   Original Dev UID: ${user.devUid}`);
        console.log('');
      }
      
      console.log('After creating these users in Firebase Auth:');
      console.log('1. Note down the UIDs assigned by Firebase');
      console.log('2. Update user-mapping.json with the Production UIDs');
      console.log('3. Continue with the migration\n');
      
      // Create a helper file with instructions
      const instructionsPath = path.join(migrationDir, 'create-users-instructions.txt');
      let instructions = 'FIREBASE AUTH USERS TO CREATE\n';
      instructions += '============================\n\n';
      instructions += 'Go to: Firebase Console → Authentication → Users → Add User\n\n';
      
      for (const user of usersToCreate) {
        instructions += `Email: ${user.email}\n`;
        instructions += `Display Name: ${user.displayName || '(leave blank)'}\n`;
        instructions += `Password: (generate a secure password)\n`;
        instructions += `Dev UID (for reference): ${user.devUid}\n`;
        instructions += '\n---\n\n';
      }
      
      instructions += 'AFTER CREATING USERS:\n';
      instructions += '1. Update user-mapping.json with the Production UIDs\n';
      instructions += '2. Run: node migrate-users.js --client ' + clientId + '\n';
      
      await fs.writeFile(instructionsPath, instructions);
      console.log(`📝 Instructions saved to: create-users-instructions.txt`);
    }
    
    // Log results
    await writeLog(migrationDir, `User mapping complete: ${userStatus.length} users processed`, 'INFO');
    await writeLog(migrationDir, `Users to create: ${usersToCreate.length}`, 'INFO');
    
    // Update metadata phase
    await updateMetadata(migrationDir, {
      phases: {
        userMapping: {
          status: usersToCreate.length > 0 ? 'pending-user-creation' : 'completed',
          timestamp: new Date().toISOString(),
          usersToCreate: usersToCreate.length
        }
      }
    });
    
    // Display summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 User Mapping Summary');
    console.log('='.repeat(50));
    console.log(`✅ Total users: ${userStatus.length}`);
    console.log(`✅ Existing in Prod: ${userStatus.filter(u => u.exists).length}`);
    console.log(`⚠️  Need creation: ${usersToCreate.length}`);
    
    console.log('\n📋 Next steps:');
    if (usersToCreate.length > 0) {
      console.log('   1. Create users in Firebase Auth (see instructions above)');
      console.log('   2. Update user-mapping.json with Production UIDs');
      console.log(`   3. Run: node migrate-users.js --client ${clientId}`);
    } else {
      console.log(`   Run: node purge-prod-client.js --client ${clientId}`);
    }
    
  } catch (error) {
    console.error('\n❌ User mapping failed:', error.message);
    console.error(error);
    
    // Try to log error
    try {
      const migrationDir = await getLatestMigrationDir(clientId);
      await writeLog(migrationDir, `User mapping failed: ${error.message}`, 'ERROR');
      
      await updateMetadata(migrationDir, {
        phases: {
          userMapping: {
            status: 'failed',
            timestamp: new Date().toISOString(),
            error: error.message
          }
        }
      });
    } catch (logError) {
      // Ignore logging errors
    }
    
    process.exit(1);
  }
}

// Run
main();
#!/usr/bin/env node

/**
 * Execute Migration
 * 
 * Runs the Production migration steps:
 * 1. Backup Production data
 * 2. Purge Production (if exists)
 * 3. Import to Production
 * 4. Verify migration
 * 
 * WARNING: This script WILL modify Production data!
 * 
 * Usage:
 *   node execute-migration.js --client AVII [--skip-backup] [--force]
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = { flags: [] };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        params[key] = args[i + 1];
        i++;
      } else {
        params.flags.push(key);
      }
    }
  }
  
  return params;
}

// Ask for confirmation
async function confirmMigration(clientId) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\n' + '⚠️ '.repeat(10));
    console.log('WARNING: PRODUCTION MIGRATION');
    console.log('⚠️ '.repeat(10));
    console.log(`\nYou are about to migrate client ${clientId} to PRODUCTION.`);
    console.log('This will:');
    console.log('  1. Backup existing Production data (if any)');
    console.log('  2. DELETE existing Production data (if any)');
    console.log('  3. Import new data to Production');
    console.log('  4. Verify the migration\n');
    
    rl.question(`Type "MIGRATE ${clientId}" to confirm: `, (answer) => {
      rl.close();
      resolve(answer === `MIGRATE ${clientId}`);
    });
  });
}

// Run a script with arguments
function runScript(scriptName, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: node ${scriptName} ${args.join(' ')}`);
    console.log('='.repeat(60));
    
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} failed with exit code ${code}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

// Check migration readiness
async function checkReadiness(clientId) {
  // Get migration directory
  const migrationsDir = path.join(__dirname, 'migrations');
  const entries = await fs.readdir(migrationsDir);
  // Use strict pattern matching to avoid AVII matching AVII-TEST
  const timestampPattern = new RegExp(`^${clientId}-\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{3}$`);
  const clientDirs = entries
    .filter(entry => timestampPattern.test(entry))
    .sort()
    .reverse();
  
  if (clientDirs.length === 0) {
    throw new Error(`No migration found for client ${clientId}. Run prepare-migration.js first.`);
  }
  
  const migrationDir = path.join(migrationsDir, clientDirs[0]);
  
  // Check required files exist
  const requiredFiles = ['dev-export.json', 'checksums.json', 'metadata.json'];
  for (const file of requiredFiles) {
    try {
      await fs.access(path.join(migrationDir, file));
    } catch (err) {
      throw new Error(`Missing required file: ${file}. Run prepare-migration.js first.`);
    }
  }
  
  // Check metadata status
  const metadata = JSON.parse(await fs.readFile(path.join(migrationDir, 'metadata.json'), 'utf-8'));
  
  if (!metadata.phases?.export?.status === 'completed') {
    throw new Error('Export not completed. Run prepare-migration.js first.');
  }
  
  // Check for pending user creation
  try {
    const mappingData = JSON.parse(await fs.readFile(path.join(migrationDir, 'user-mapping.json'), 'utf-8'));
    const pendingUsers = mappingData.users.filter(u => !u.exists && !u.prodUid);
    
    if (pendingUsers.length > 0) {
      console.log('\n⚠️  WARNING: Some users have not been created in Production Firebase Auth.');
      console.log('The following users will not have access until created:');
      pendingUsers.forEach(u => console.log(`  - ${u.email}`));
      console.log('\nYou can continue, but these users will need to be handled manually.');
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise((resolve) => {
        rl.question('\nContinue anyway? (yes/no): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        throw new Error('Migration cancelled. Please create users first.');
      }
    }
  } catch (err) {
    if (err.message && err.message.includes('cancelled')) {
      throw err;
    }
    // No user mapping file is okay
  }
  
  return migrationDir;
}

// Main function
async function main() {
  console.log('🚀 MIGRATION EXECUTION');
  console.log('======================');
  console.log('WARNING: This script WILL modify Production data!');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client) {
    console.error('\n❌ Missing required parameters');
    console.error('Usage: node execute-migration.js --client <CLIENT_ID> [--skip-backup] [--force]');
    console.error('Example: node execute-migration.js --client AVII');
    process.exit(1);
  }
  
  const { client: clientId } = params;
  const skipBackup = params.flags.includes('skip-backup');
  const force = params.flags.includes('force');
  
  console.log(`\n📋 Executing migration for client: ${clientId}`);
  
  try {
    // Check readiness
    console.log('\n🔍 Checking migration readiness...');
    const migrationDir = await checkReadiness(clientId);
    console.log('✅ Migration is ready');
    console.log(`📁 Using migration: ${path.basename(migrationDir)}`);
    
    // Confirm migration
    if (!force) {
      const confirmed = await confirmMigration(clientId);
      if (!confirmed) {
        console.log('\n❌ Migration cancelled');
        process.exit(0);
      }
    }
    
    console.log('\n🚀 Starting Production migration...');
    console.log('Steps to run:');
    console.log('  1. Backup Production data');
    console.log('  2. Purge Production (if exists)');
    console.log('  3. Import to Production');
    console.log('  4. Verify migration');
    
    // Step 1: Backup Production (unless skipped)
    if (!skipBackup) {
      console.log('\n\n💾 STEP 1: Backup Production');
      await runScript('backup-prod-client.js', ['--client', clientId]);
    } else {
      console.log('\n\n⚠️  STEP 1: Skipping backup (--skip-backup flag)');
    }
    
    // Step 2: Purge Production
    console.log('\n\n🗑️  STEP 2: Purge Production');
    const purgeArgs = ['--client', clientId];
    if (force) purgeArgs.push('--force');
    await runScript('purge-prod-client.js', purgeArgs);
    
    // Pause after purge to verify Console
    console.log('\n' + '='.repeat(60));
    console.log('⏸️  PURGE COMPLETE - VERIFY FIREBASE CONSOLE');
    console.log('='.repeat(60));
    console.log('\n📋 Please check Firebase Console to verify AVII is completely removed.');
    console.log('   Go to: Firestore Database → clients → AVII');
    console.log('   Verify: The document and all subcollections should be gone.\n');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise((resolve) => {
      rl.question('Press ENTER to continue with import...', () => {
        rl.close();
        resolve();
      });
    });
    
    // Step 3: Import to Production
    console.log('\n\n📥 STEP 3: Import to Production');
    await runScript('import-client.js', ['--client', clientId]);
    
    // Step 4: Verify migration
    console.log('\n\n✅ STEP 4: Verify Migration');
    await runScript('verify-migration.js', ['--client', clientId]);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 MIGRATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n✅ Client ${clientId} has been successfully migrated to Production!`);
    console.log('\n📋 Post-migration checklist:');
    console.log('   1. Test login with a user account');
    console.log('   2. Verify data appears correctly in the UI');
    console.log('   3. Check financial balances match expectations');
    console.log('   4. Test a few transactions if applicable');
    console.log('\n📁 Migration artifacts saved in:');
    console.log(`   ${migrationDir}`);
    
  } catch (error) {
    console.error('\n\n❌ MIGRATION FAILED');
    console.error('='.repeat(60));
    console.error(error.message);
    
    if (error.message.includes('failed with exit code')) {
      console.error('\n⚠️  The migration has partially completed.');
      console.error('Check the logs and consider:');
      console.error('  1. Reviewing the error in the failed step');
      console.error('  2. Restoring from backup if needed');
      console.error('  3. Running individual scripts to complete migration');
    }
    
    process.exit(1);
  }
}

// Run
main();
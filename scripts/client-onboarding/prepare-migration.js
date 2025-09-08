#!/usr/bin/env node

/**
 * Prepare Migration
 * 
 * Runs the preparation steps for migration:
 * 1. Initialize migration directory
 * 2. Analyze Dev data
 * 3. Export from Dev
 * 4. Prepare user mappings
 * 
 * This script does NOT touch Production data.
 * 
 * Usage:
 *   node prepare-migration.js --client AVII
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

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

// Main function
async function main() {
  console.log('🚀 MIGRATION PREPARATION');
  console.log('========================');
  console.log('This script will prepare your migration without touching Production.');
  
  // Parse arguments
  const params = parseArgs();
  
  if (!params.client) {
    console.error('\n❌ Missing required parameters');
    console.error('Usage: node prepare-migration.js --client <CLIENT_ID>');
    console.error('Example: node prepare-migration.js --client AVII');
    process.exit(1);
  }
  
  const { client: clientId } = params;
  
  console.log(`\n📋 Preparing migration for client: ${clientId}`);
  console.log('Steps to run:');
  console.log('  1. Initialize migration directory');
  console.log('  2. Analyze Dev data');
  console.log('  3. Export from Dev');
  console.log('  4. Prepare user mappings');
  console.log('  5. Create Firebase Auth users');
  
  try {
    // Step 1: Initialize migration
    console.log('\n\n🔧 STEP 1: Initialize Migration');
    await runScript('init-migration.js', ['--client', clientId, '--source', 'dev', '--target', 'prod']);
    
    // Step 2: Analyze Dev data
    console.log('\n\n🔍 STEP 2: Analyze Dev Data');
    await runScript('analyze-client-dynamic.js', ['--client', clientId, '--env', 'dev']);
    
    // Step 3: Export from Dev (complete with audit logs)
    console.log('\n\n📤 STEP 3: Export from Dev');
    await runScript('export-client-complete.js', ['--client', clientId]);
    
    // Step 4: Prepare user mappings
    console.log('\n\n👥 STEP 4: Prepare User Mappings');
    await runScript('prepare-user-mapping.js', ['--client', clientId]);
    
    // Step 5: Create Firebase users if needed
    console.log('\n\n🔐 STEP 5: Create Firebase Auth Users');
    await runScript('create-firebase-users.js', ['--client', clientId]);
    
    // Get migration directory for final summary
    const migrationsDir = path.join(__dirname, 'migrations');
    const entries = await fs.readdir(migrationsDir);
    // Filter to exact client (not AVII-TEST when looking for AVII)
    const clientDirs = entries
      .filter(entry => {
        // Must start with exact clientId followed by dash and timestamp
        const pattern = new RegExp(`^${clientId}-\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{3}$`);
        return pattern.test(entry);
      })
      .sort()
      .reverse();
    
    if (clientDirs.length > 0) {
      const migrationDir = path.join(migrationsDir, clientDirs[0]);
      
      // Check if user creation is needed
      const mappingPath = path.join(migrationDir, 'user-mapping.json');
      let needsUserCreation = false;
      
      try {
        const mappingData = JSON.parse(await fs.readFile(mappingPath, 'utf-8'));
        needsUserCreation = mappingData.users.some(u => !u.exists);
      } catch (err) {
        // No mapping file or no users
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ PREPARATION COMPLETE');
      console.log('='.repeat(60));
      console.log(`\n📁 Migration directory: ${clientDirs[0]}`);
      console.log('\n📊 Review the following files:');
      console.log('   - dev-export.json (exported data)');
      console.log('   - user-mapping.json (user mappings)');
      console.log('   - checksums.json (data integrity)');
      
      if (needsUserCreation) {
        console.log('\n⚠️  ACTION REQUIRED:');
        console.log('   Some users need to be created in Production Firebase Auth.');
        console.log('   See create-users-instructions.txt for details.');
        console.log('   After creating users, update user-mapping.json with Production UIDs.');
      }
      
      console.log('\n📋 Next step:');
      console.log(`   When ready, run: node execute-migration.js --client ${clientId}`);
      console.log('\n⚠️  The next script WILL modify Production data!');
    }
    
  } catch (error) {
    console.error('\n\n❌ PREPARATION FAILED');
    console.error('='.repeat(60));
    console.error(error.message);
    console.error('\nPlease fix the issue and try again.');
    process.exit(1);
  }
}

// Run
main();
#!/usr/bin/env node

/**
 * Interactive Client Onboarding Script
 * 
 * This script provides a complete client onboarding workflow:
 * 1. Interactive client ID selection/creation
 * 2. Optional database purge for existing clients
 * 3. Complete data import pipeline execution
 * 4. Verification and reporting
 * 
 * Usage: 
 *   node interactive-client-onboarding.js
 * 
 * Environment Selection:
 *   - Interactive: Script will prompt for environment selection
 *   - Pre-set: Set FIRESTORE_ENV=dev|staging|prod before running
 * 
 * Examples:
 *   node interactive-client-onboarding.js                    # Interactive mode
 *   FIRESTORE_ENV=dev node interactive-client-onboarding.js  # Development
 *   FIRESTORE_ENV=staging node interactive-client-onboarding.js  # Staging  
 *   FIRESTORE_ENV=prod node interactive-client-onboarding.js     # Production
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import readline from 'readline';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// Environment configuration
const AVAILABLE_ENVIRONMENTS = {
  dev: {
    name: 'Development',
    projectId: 'sandyland-management-system',
    description: 'Development environment for testing'
  },
  staging: {
    name: 'Staging', 
    projectId: 'sandyland-management-staging',
    description: 'Staging environment for pre-production testing'
  },
  prod: {
    name: 'Production',
    projectId: 'sandyland-management-system', 
    description: 'Production environment - LIVE DATA'
  }
};

let ENV = process.env.FIRESTORE_ENV || null;

// Define the import script execution order
const IMPORT_SCRIPTS = [
  {
    script: 'import-categories-vendors-with-crud.js',
    name: 'Categories & Vendors',
    description: 'Import categories and vendors with CRUD functions'
  },
  {
    script: 'import-users-with-audit.js',
    name: 'Users',
    description: 'Import users with Firebase Auth integration and audit logging'
  },
  {
    script: 'import-units-with-crud.js',
    name: 'Units',
    description: 'Import units with size data and CRUD functions'
  },
  {
    script: 'import-transactions-with-crud.js',
    name: 'Transactions',
    description: 'Import transactions with field structure validation'
  },
  {
    script: 'importHOADuesFixed.js',
    name: 'HOA Dues',
    description: 'Import HOA dues with transaction ID linking'
  }
];

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for input with a question
 */
function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Get list of existing clients from the database
 */
async function getExistingClients(db) {
  try {
    const clientsSnapshot = await db.collection('clients').get();
    return clientsSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));
  } catch (error) {
    console.warn('⚠️ Could not fetch existing clients:', error.message);
    return [];
  }
}

/**
 * Check if client data directory exists
 */
async function checkClientDataDirectory(clientId) {
  const dataDir = `../MTCdata`; // Assuming MTC data for now
  try {
    await fs.access(dataDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Interactive environment selection
 */
async function selectEnvironment(rl) {
  if (ENV) {
    // Environment already set via environment variable
    const envConfig = AVAILABLE_ENVIRONMENTS[ENV];
    if (!envConfig) {
      throw new Error(`Invalid environment: ${ENV}. Must be one of: ${Object.keys(AVAILABLE_ENVIRONMENTS).join(', ')}`);
    }
    console.log(`\n🌍 Environment set via FIRESTORE_ENV: ${envConfig.name} (${ENV})`);
    console.log(`📋 Project ID: ${envConfig.projectId}`);
    console.log(`📝 Description: ${envConfig.description}`);
    
    if (ENV === 'prod') {
      console.log('\n⚠️  WARNING: PRODUCTION ENVIRONMENT SELECTED');
      console.log('🔴 You are working with LIVE DATA');
      const confirm = await askQuestion(rl, '❓ Are you sure you want to proceed with PRODUCTION? (type "PRODUCTION" to confirm): ');
      if (confirm !== 'PRODUCTION') {
        throw new Error('Production access not confirmed. Exiting for safety.');
      }
    }
    
    return ENV;
  }
  
  console.log('\n🌍 ENVIRONMENT SELECTION');
  console.log('='.repeat(50));
  console.log('Select the target environment for client onboarding:');
  
  const envKeys = Object.keys(AVAILABLE_ENVIRONMENTS);
  envKeys.forEach((key, index) => {
    const env = AVAILABLE_ENVIRONMENTS[key];
    const warning = key === 'prod' ? ' ⚠️  LIVE DATA' : '';
    console.log(`   ${index + 1}. ${env.name} (${key}) - ${env.description}${warning}`);
  });
  
  const choice = await askQuestion(rl, '\nSelect environment (number): ');
  const choiceNum = parseInt(choice);
  
  if (choiceNum < 1 || choiceNum > envKeys.length) {
    throw new Error('Invalid environment selection');
  }
  
  const selectedEnv = envKeys[choiceNum - 1];
  const envConfig = AVAILABLE_ENVIRONMENTS[selectedEnv];
  
  console.log(`\n✅ Selected: ${envConfig.name} (${selectedEnv})`);
  console.log(`📋 Project ID: ${envConfig.projectId}`);
  
  // Extra confirmation for production
  if (selectedEnv === 'prod') {
    console.log('\n🔴 PRODUCTION ENVIRONMENT WARNING');
    console.log('You have selected the PRODUCTION environment.');
    console.log('This will affect LIVE DATA used by real users.');
    console.log('Data purging will permanently delete production records.');
    
    const confirm1 = await askQuestion(rl, '\n❓ Are you absolutely sure? (type "yes" to continue): ');
    if (confirm1.toLowerCase() !== 'yes') {
      throw new Error('Production access cancelled by user');
    }
    
    const confirm2 = await askQuestion(rl, '❓ Type "PRODUCTION" to confirm you understand the risks: ');
    if (confirm2 !== 'PRODUCTION') {
      throw new Error('Production confirmation failed. Exiting for safety.');
    }
    
    console.log('⚠️  Production access confirmed. Proceeding with EXTREME CAUTION...');
  }
  
  return selectedEnv;
}

/**
 * Interactive client selection/creation
 */
async function selectOrCreateClient(rl, db) {
  console.log('\n🎯 CLIENT SETUP');
  console.log('='.repeat(50));
  
  // Get existing clients
  const existingClients = await getExistingClients(db);
  
  if (existingClients.length > 0) {
    console.log('\n📋 Existing clients found:');
    existingClients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.id} - ${client.data.name || 'No name'}`);
    });
    console.log(`   ${existingClients.length + 1}. Create new client`);
    
    const choice = await askQuestion(rl, '\nSelect an option (number): ');
    const choiceNum = parseInt(choice);
    
    if (choiceNum >= 1 && choiceNum <= existingClients.length) {
      // Existing client selected
      const selectedClient = existingClients[choiceNum - 1];
      console.log(`\n✅ Selected existing client: ${selectedClient.id}`);
      return {
        clientId: selectedClient.id,
        isExisting: true,
        clientData: selectedClient.data
      };
    } else if (choiceNum === existingClients.length + 1) {
      // Create new client
      const clientId = await askQuestion(rl, '\nEnter new client ID (e.g., MTC, ABC, etc.): ');
      if (!clientId) {
        throw new Error('Client ID cannot be empty');
      }
      console.log(`\n✅ Creating new client: ${clientId}`);
      return {
        clientId: clientId.toUpperCase(),
        isExisting: false,
        clientData: null
      };
    } else {
      throw new Error('Invalid selection');
    }
  } else {
    // No existing clients, create new one
    console.log('\n📋 No existing clients found. Creating new client...');
    const clientId = await askQuestion(rl, 'Enter client ID (e.g., MTC, ABC, etc.): ');
    if (!clientId) {
      throw new Error('Client ID cannot be empty');
    }
    console.log(`\n✅ Creating new client: ${clientId}`);
    return {
      clientId: clientId.toUpperCase(),
      isExisting: false,
      clientData: null
    };
  }
}

/**
 * Confirm data purge for existing client
 */
async function confirmDataPurge(rl, clientId) {
  console.log(`\n⚠️  DATABASE PURGE WARNING`);
  console.log('='.repeat(50));
  console.log(`Client "${clientId}" already exists in the database.`);
  console.log('To proceed with import, all existing data must be purged.');
  console.log('\n🗑️  This will DELETE ALL DATA for this client including:');
  console.log('   • Users and authentication records');
  console.log('   • Units and property information');
  console.log('   • Transactions and financial records');
  console.log('   • Categories and vendors');
  console.log('   • HOA dues and payment history');
  console.log('   • All audit logs and metadata');
  
  const confirm1 = await askQuestion(rl, '\n❓ Are you sure you want to PURGE ALL DATA? (type "yes" to confirm): ');
  if (confirm1.toLowerCase() !== 'yes') {
    return false;
  }
  
  const confirm2 = await askQuestion(rl, '❓ This action CANNOT BE UNDONE. Type the client ID to confirm: ');
  if (confirm2.toUpperCase() !== clientId.toUpperCase()) {
    console.log('❌ Client ID confirmation failed. Purge cancelled.');
    return false;
  }
  
  console.log('✅ Purge confirmed. Proceeding with data deletion...');
  return true;
}

/**
 * Execute purge script
 */
async function executePurge(clientId) {
  console.log(`\n🗑️  Executing database purge for client ${clientId}...`);
  
  return new Promise((resolve, reject) => {
    const purgeProcess = spawn('node', ['purge-all-mtc-data.js'], {
      stdio: 'inherit',
      env: { ...process.env, CLIENT_ID: clientId, FIRESTORE_ENV: ENV }
    });
    
    purgeProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Database purge completed successfully');
        resolve();
      } else {
        reject(new Error(`Purge script failed with exit code ${code}`));
      }
    });
    
    purgeProcess.on('error', (error) => {
      reject(new Error(`Failed to start purge script: ${error.message}`));
    });
  });
}

/**
 * Execute a single import script
 */
async function executeImportScript(scriptConfig, clientId) {
  console.log(`\n📦 Executing: ${scriptConfig.name}`);
  console.log(`📄 Script: ${scriptConfig.script}`);
  console.log(`📝 Description: ${scriptConfig.description}`);
  console.log('-'.repeat(60));
  
  return new Promise((resolve, reject) => {
    const importProcess = spawn('node', [scriptConfig.script], {
      stdio: 'inherit',
      env: { ...process.env, CLIENT_ID: clientId, FIRESTORE_ENV: ENV }
    });
    
    importProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptConfig.name} import completed successfully`);
        resolve({ success: true, script: scriptConfig.script });
      } else {
        console.error(`❌ ${scriptConfig.name} import failed with exit code ${code}`);
        resolve({ success: false, script: scriptConfig.script, exitCode: code });
      }
    });
    
    importProcess.on('error', (error) => {
      console.error(`❌ Failed to start ${scriptConfig.script}: ${error.message}`);
      resolve({ success: false, script: scriptConfig.script, error: error.message });
    });
  });
}

/**
 * Execute all import scripts in sequence
 */
async function executeImportPipeline(clientId) {
  console.log('\n🚀 STARTING IMPORT PIPELINE');
  console.log('='.repeat(50));
  console.log(`📋 Client: ${clientId}`);
  console.log(`🌍 Environment: ${ENV}`);
  console.log(`📦 Scripts to execute: ${IMPORT_SCRIPTS.length}`);
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (let i = 0; i < IMPORT_SCRIPTS.length; i++) {
    const scriptConfig = IMPORT_SCRIPTS[i];
    console.log(`\n[${i + 1}/${IMPORT_SCRIPTS.length}] Starting ${scriptConfig.name}...`);
    
    const result = await executeImportScript(scriptConfig, clientId);
    results.push(result);
    
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
      console.log(`\n⚠️  ${scriptConfig.name} failed. Continuing with next script...`);
    }
  }
  
  return {
    results,
    successCount,
    failureCount,
    totalScripts: IMPORT_SCRIPTS.length
  };
}

/**
 * Generate final report
 */
function generateFinalReport(clientId, importResults) {
  const envConfig = AVAILABLE_ENVIRONMENTS[ENV];
  console.log('\n' + '='.repeat(70));
  console.log('📋 CLIENT ONBOARDING COMPLETE');
  console.log('='.repeat(70));
  console.log(`🎯 Client: ${clientId}`);
  console.log(`🌍 Environment: ${envConfig.name} (${ENV})`);
  console.log(`📋 Project: ${envConfig.projectId}`);
  console.log(`⏰ Completed: ${new Date().toISOString()}`);
  console.log('');
  
  console.log('📊 IMPORT PIPELINE RESULTS:');
  console.log(`   ✅ Successful: ${importResults.successCount}/${importResults.totalScripts}`);
  console.log(`   ❌ Failed: ${importResults.failureCount}/${importResults.totalScripts}`);
  console.log('');
  
  console.log('📝 SCRIPT DETAILS:');
  importResults.results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const scriptName = IMPORT_SCRIPTS[index].name;
    console.log(`   ${status} ${scriptName}`);
    if (!result.success) {
      console.log(`      └─ Error: ${result.error || `Exit code ${result.exitCode}`}`);
    }
  });
  
  if (importResults.successCount === importResults.totalScripts) {
    console.log('\n🎉 CLIENT ONBOARDING SUCCESSFUL!');
    console.log('🔍 All import scripts executed without errors');
    console.log('📊 Client data has been imported and is ready for use');
  } else {
    console.log('\n⚠️  CLIENT ONBOARDING COMPLETED WITH ISSUES');
    console.log('🔧 Review failed scripts and fix any issues before proceeding');
  }
  
  console.log('='.repeat(70));
}

/**
 * Main execution function
 */
async function main() {
  const rl = createReadlineInterface();
  
  try {
    console.log('🚀 SAMS CLIENT ONBOARDING');
    console.log('='.repeat(50));
    console.log('This script will guide you through the complete client onboarding process.');
    console.log('');
    
    // Step 0: Select environment (if not already set)
    ENV = await selectEnvironment(rl);
    
    // Print environment information
    printEnvironmentInfo(ENV);
    
    // Initialize Firebase
    console.log('\n🔥 Initializing Firebase...');
    const { db } = await initializeFirebase(ENV);
    console.log('✅ Firebase initialized successfully');
    
    // Step 1: Select or create client
    const clientInfo = await selectOrCreateClient(rl, db);
    const { clientId, isExisting } = clientInfo;
    
    // Step 2: Check data directory
    const hasDataDirectory = await checkClientDataDirectory(clientId);
    if (!hasDataDirectory) {
      console.log(`\n⚠️  Warning: Data directory for ${clientId} not found at ../MTCdata`);
      console.log('Make sure the client data files are available before proceeding.');
      const proceed = await askQuestion(rl, 'Continue anyway? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('❌ Onboarding cancelled by user');
        process.exit(0);
      }
    }
    
    // Step 3: Handle existing client data
    if (isExisting) {
      const shouldPurge = await confirmDataPurge(rl, clientId);
      if (shouldPurge) {
        await executePurge(clientId);
      } else {
        console.log('❌ Cannot proceed without purging existing data. Onboarding cancelled.');
        process.exit(0);
      }
    }
    
    // Step 4: Execute import pipeline
    const importResults = await executeImportPipeline(clientId);
    
    // Step 5: Generate final report
    generateFinalReport(clientId, importResults);
    
  } catch (error) {
    console.error('\n💥 Onboarding failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Onboarding interrupted by user');
  process.exit(0);
});

// Execute main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * restoreUPSContext.js
 * 
 * Restores UPS context data from a backup file created by backupUPSContext.js
 * 
 * ⚠️ WARNING: This will OVERWRITE existing data!
 * 
 * Usage:
 *   FIRESTORE_ENV=prod node scripts/restoreUPSContext.js ups-backup-AVII-106.json
 *   FIRESTORE_ENV=prod node scripts/restoreUPSContext.js ups-backup-AVII-106.json --dry-run
 * 
 * For production, use Application Default Credentials:
 *   gcloud auth application-default login
 *   gcloud config set project sams-sandyland-prod
 *   USE_ADC=true FIRESTORE_ENV=prod node scripts/restoreUPSContext.js <file> --dry-run
 * 
 * Options:
 *   --dry-run    Show what would be restored without making changes
 *   --force      Skip confirmation prompt
 */

import { initializeFirebase, getCurrentEnvironment } from './utils/environment-config.js';
import { Timestamp } from 'firebase-admin/firestore';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

// For production, default to ADC. For dev, use service account key.
const env = getCurrentEnvironment();
const useADC = process.env.USE_ADC === 'true' || (env === 'prod' && process.env.USE_ADC !== 'false');

// Initialize Firebase
const { db } = await initializeFirebase(null, { useADC });

/**
 * Convert serialized Timestamps back to Firestore Timestamps
 */
function deserializeData(data) {
  if (data === null || data === undefined) {
    return data;
  }
  
  if (data.__type === 'Timestamp' && data._seconds !== undefined) {
    return new Timestamp(data._seconds, data._nanoseconds || 0);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => deserializeData(item));
  }
  
  if (typeof data === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip internal fields
      if (key.startsWith('_')) continue;
      result[key] = deserializeData(value);
    }
    return result;
  }
  
  return data;
}

/**
 * Prompt for confirmation
 */
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(message + ' (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Restore UPS context from backup
 */
async function restoreUPSContext(backupFile, options = {}) {
  const { dryRun = false, force = false } = options;
  
  console.log(`\n🔄 UPS Context Restore`);
  console.log(`   File: ${backupFile}`);
  console.log(`   Mode: ${dryRun ? '🧪 DRY RUN (no changes)' : '⚡ LIVE'}`);
  console.log(`   Environment: ${process.env.FIRESTORE_ENV || process.env.NODE_ENV || 'unknown'}`);
  console.log('─'.repeat(50));
  
  // Find the backup file
  let filePath = backupFile;
  if (!backupFile.startsWith('/')) {
    // Try test-results directory
    filePath = path.join('/Users/michael/Projects/SAMS/test-results', backupFile);
  }
  
  // Read backup file
  console.log('\n📂 Reading backup file...');
  let backup;
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    backup = JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to read backup file: ${error.message}`);
    process.exit(1);
  }
  
  // Validate backup structure
  if (!backup.meta || !backup.data) {
    console.error('❌ Invalid backup file format');
    process.exit(1);
  }
  
  console.log(`\n📋 Backup Info:`);
  console.log(`   Created: ${backup.meta.timestamp}`);
  console.log(`   Client: ${backup.meta.clientId}`);
  console.log(`   Unit: ${backup.meta.unitId}`);
  console.log(`   Environment: ${backup.meta.environment}`);
  
  console.log(`\n📊 Data to Restore:`);
  console.log(`   Unit: ${backup.data.unit ? '1' : '0'} document`);
  console.log(`   CreditBalances: ${backup.data.creditBalances ? '1' : '0'} document`);
  console.log(`   Dues: ${Object.keys(backup.data.dues).length} documents`);
  console.log(`   Transactions: ${backup.data.transactions.length} documents`);
  console.log(`   Water Bills: ${backup.data.waterBills.length} documents`);
  
  // Environment check
  const currentEnv = process.env.FIRESTORE_ENV || process.env.NODE_ENV || 'unknown';
  if (backup.meta.environment !== currentEnv) {
    console.log(`\n⚠️  WARNING: Backup is from ${backup.meta.environment}, restoring to ${currentEnv}`);
  }
  
  // Confirmation
  if (!dryRun && !force) {
    console.log('\n⚠️  WARNING: This will OVERWRITE existing data!');
    const confirmed = await confirm('Are you sure you want to proceed?');
    if (!confirmed) {
      console.log('❌ Restore cancelled');
      process.exit(0);
    }
  }
  
  if (dryRun) {
    console.log('\n🧪 DRY RUN - No changes will be made\n');
  }
  
  const batch = db.batch();
  let operationCount = 0;
  
  try {
    // 1. Restore unit document (unit profile data, NOT credit balance)
    if (backup.data.unit) {
      console.log('\n1️⃣ Restoring unit document...');
      const unitData = deserializeData(backup.data.unit);
      const unitRef = db.doc(backup.data.unit._path);
      
      if (dryRun) {
        console.log(`   [DRY RUN] Would restore: ${backup.data.unit._path}`);
      } else {
        batch.set(unitRef, unitData, { merge: false });
        operationCount++;
      }
      console.log(`   ✅ Unit document queued`);
    }
    
    // 2. Restore creditBalances document (THIS is where credit balance lives)
    if (backup.data.creditBalances) {
      console.log('\n2️⃣ Restoring creditBalances document...');
      const cbData = deserializeData(backup.data.creditBalances);
      const cbRef = db.doc(backup.data.creditBalances._path);
      const unitCB = backup.data.creditBalances[backup.meta.unitId]?.creditBalance || 0;
      
      if (dryRun) {
        console.log(`   [DRY RUN] Would restore: ${backup.data.creditBalances._path}`);
        console.log(`   [DRY RUN] 💰 Unit ${backup.meta.unitId} Credit Balance: ${(unitCB / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} pesos`);
      } else {
        batch.set(cbRef, cbData, { merge: false });
        operationCount++;
        console.log(`   💰 Unit ${backup.meta.unitId} Credit Balance: ${(unitCB / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} pesos`);
      }
      console.log(`   ✅ creditBalances document queued`);
    }
    
    // 3. Restore dues documents
    console.log('\n3️⃣ Restoring dues documents...');
    for (const [duesId, duesDoc] of Object.entries(backup.data.dues)) {
      const duesData = deserializeData(duesDoc);
      const duesRef = db.doc(duesDoc._path);
      
      if (dryRun) {
        console.log(`   [DRY RUN] Would restore: ${duesDoc._path}`);
      } else {
        batch.set(duesRef, duesData, { merge: false });
        operationCount++;
      }
    }
    console.log(`   ✅ ${Object.keys(backup.data.dues).length} dues documents queued`);
    
    // 4. Restore transactions
    console.log('\n4️⃣ Restoring transactions...');
    for (const txnDoc of backup.data.transactions) {
      const txnData = deserializeData(txnDoc);
      const txnRef = db.doc(txnDoc._path);
      
      if (dryRun) {
        console.log(`   [DRY RUN] Would restore: ${txnDoc._path}`);
      } else {
        batch.set(txnRef, txnData, { merge: false });
        operationCount++;
      }
    }
    console.log(`   ✅ ${backup.data.transactions.length} transactions queued`);
    
    // 5. Restore water bills
    if (backup.data.waterBills && backup.data.waterBills.length > 0) {
      console.log('\n5️⃣ Restoring water bills...');
      for (const billDoc of backup.data.waterBills) {
        const billData = deserializeData(billDoc);
        const billRef = db.doc(billDoc._path);
        
        if (dryRun) {
          console.log(`   [DRY RUN] Would restore: ${billDoc._path}`);
        } else {
          batch.set(billRef, billData, { merge: false });
          operationCount++;
        }
      }
      console.log(`   ✅ ${backup.data.waterBills.length} water bills queued`);
    }
    
    // Commit the batch
    if (!dryRun) {
      console.log('\n6️⃣ Committing batch...');
      await batch.commit();
      console.log(`   ✅ Batch committed: ${operationCount} operations`);
    }
    
    console.log('\n' + '─'.repeat(50));
    if (dryRun) {
      console.log('🧪 DRY RUN COMPLETE - No changes made');
      console.log('   Run without --dry-run to apply changes');
    } else {
      console.log('✅ RESTORE COMPLETE');
      console.log(`   ${operationCount} documents restored`);
      console.log('\n⚠️  Remember to refresh the UI (logout/login) to see changes');
    }
    
  } catch (error) {
    console.error('\n❌ RESTORE FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const backupFile = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

if (!backupFile) {
  console.error('❌ Usage: node scripts/restoreUPSContext.js <backup-file> [options]');
  console.error('   Options:');
  console.error('     --dry-run    Show what would be restored without making changes');
  console.error('     --force      Skip confirmation prompt');
  console.error('');
  console.error('   Example: node scripts/restoreUPSContext.js ups-backup-AVII-106-2025-12-18T13-45-00.json');
  process.exit(1);
}

await restoreUPSContext(backupFile, { dryRun, force });
process.exit(0);

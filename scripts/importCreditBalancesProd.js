#!/usr/bin/env node
/**
 * Import Credit Balances to Production
 * 
 * This script imports the clean credit history data to production.
 * Uses Application Default Credentials (ADC) for authentication.
 * 
 * Usage: 
 *   USE_ADC=true node scripts/importCreditBalancesProd.js --dry-run
 *   USE_ADC=true node scripts/importCreditBalancesProd.js --live
 * 
 * IMPORTANT: Run with --dry-run first to verify data!
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs/promises';

// Production project ID
const PROJECT_ID = 'sams-sandyland-prod';

// Path to the rebuilt credit balances JSON
const DATA_PATH = '/Users/michael/Projects/SAMS/test-results/creditBalances-rebuilt.json';

async function main() {
  const isLive = process.argv.includes('--live');
  const isDryRun = !isLive;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  CREDIT BALANCE IMPORT TO PRODUCTION`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Mode: ${isDryRun ? '🔵 DRY RUN (no changes)' : '🔴 LIVE (will update production)'}`);
  console.log(`  Project: ${PROJECT_ID}`);
  console.log(`  Data Source: ${DATA_PATH}`);
  console.log(`${'='.repeat(60)}\n`);

  // Read the rebuilt data
  let data;
  try {
    const fileContent = await fs.readFile(DATA_PATH, 'utf-8');
    data = JSON.parse(fileContent);
    console.log(`✅ Loaded data for ${Object.keys(data).length} units\n`);
  } catch (error) {
    console.error(`❌ Failed to read data file: ${error.message}`);
    console.error(`   Make sure you've run: node scripts/rebuildCreditBalances.js --dry-run`);
    process.exit(1);
  }

  // Display summary
  console.log('Unit Summary:');
  console.log('-'.repeat(50));
  for (const [unitId, unitData] of Object.entries(data)) {
    const balance = unitData.history.reduce((sum, e) => sum + e.amount, 0) / 100;
    console.log(`  Unit ${unitId}: ${unitData.history.length} entries, Balance: $${balance.toFixed(2)}`);
  }
  console.log('-'.repeat(50));
  console.log('');

  if (isDryRun) {
    console.log('💡 This is a DRY RUN. No changes were made.');
    console.log('   To import to production, run with --live flag:');
    console.log('   USE_ADC=true node scripts/importCreditBalancesProd.js --live\n');
    return;
  }

  // Confirm before proceeding
  console.log('⚠️  WARNING: This will overwrite credit balances in PRODUCTION!');
  console.log('   Press Ctrl+C within 5 seconds to abort...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('🔄 Initializing Firebase...');
  initializeApp({ 
    credential: applicationDefault(), 
    projectId: PROJECT_ID 
  });
  const db = getFirestore();

  console.log('📤 Uploading to production...');
  const creditBalancesRef = db.collection('clients').doc('AVII')
    .collection('units').doc('creditBalances');

  await creditBalancesRef.set(data);
  
  console.log('');
  console.log('✅ SUCCESS! Credit balances imported to production.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Verify in Firebase Console: https://console.firebase.google.com');
  console.log('  2. Test Statement of Account for a few units');
  console.log('  3. Check HOA Dues View credit balance display');
  console.log('');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

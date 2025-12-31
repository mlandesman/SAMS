/**
 * Push Credit Balances from DEV to PRODUCTION
 * 
 * Reads the corrected data from DEV and writes to PROD
 * 
 * Usage: node pushCreditBalancesToProd.js [--dry-run]
 */

import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dryRun = process.argv.includes('--dry-run');

// Initialize DEV with service account key
const devServiceAccount = JSON.parse(
  await readFile(path.resolve(__dirname, '../serviceAccountKey.json'), 'utf8')
);

// Initialize apps with unique names
// DEV uses service account key
const devApp = getApps().find(a => a.name === 'dev') || 
  initializeApp({ credential: cert(devServiceAccount) }, 'dev');

// PROD uses Application Default Credentials (ADC)
// Run: gcloud auth application-default login
// Project: sams-sandyland-prod
const prodApp = getApps().find(a => a.name === 'prod') || 
  initializeApp({ 
    credential: applicationDefault(),
    projectId: 'sams-sandyland-prod'
  }, 'prod');

const devDb = getFirestore(devApp);
const prodDb = getFirestore(prodApp);

async function pushToProd() {
  console.log('\n🚀 Push Credit Balances: DEV → PRODUCTION');
  console.log(`   Dry Run: ${dryRun ? 'YES' : 'NO'}\n`);
  console.log('='.repeat(70));
  
  // Read from DEV
  console.log('\n📥 Reading from DEV...');
  const devRef = devDb.collection('clients').doc('AVII').collection('units').doc('creditBalances');
  const devDoc = await devRef.get();
  
  if (!devDoc.exists) {
    console.log('❌ No creditBalances document found in DEV');
    return;
  }
  
  const devData = devDoc.data();
  const units = Object.keys(devData).filter(k => /^\d+$/.test(k)); // Only unit IDs
  
  console.log(`   Found ${units.length} units in DEV\n`);
  
  // Show summary
  console.log('📊 Data to push:');
  console.log('-'.repeat(70));
  console.log('Unit  | History | Credit Balance');
  console.log('-'.repeat(70));
  
  for (const unitId of units.sort()) {
    const unitData = devData[unitId];
    const balance = getCreditBalance(unitData);
    console.log(
      `${unitId.padEnd(5)} | ` +
      `${String(unitData.history?.length || 0).padStart(7)} | ` +
      `$${(balance / 100).toFixed(2)}`
    );
  }
  console.log('-'.repeat(70));
  
  // Read current PROD data for comparison
  console.log('\n📤 Reading current PRODUCTION data...');
  const prodRef = prodDb.collection('clients').doc('AVII').collection('units').doc('creditBalances');
  const prodDoc = await prodRef.get();
  
  if (prodDoc.exists) {
    const prodData = prodDoc.data();
    console.log('   Current PROD credit balances:');
    for (const unitId of units.sort()) {
      const prodUnitData = prodData[unitId];
      if (prodUnitData) {
        const prodBalance = getCreditBalance(prodUnitData);
        const devBalance = getCreditBalance(devData[unitId]);
        const changed = prodBalance !== devBalance ? ' ← WILL CHANGE' : '';
        console.log(`   ${unitId}: $${(prodBalance / 100).toFixed(2)} → $${(devBalance / 100).toFixed(2)}${changed}`);
      } else {
        console.log(`   ${unitId}: (not in PROD) → $${(getCreditBalance(devData[unitId]) / 100).toFixed(2)} ← NEW`);
      }
    }
  } else {
    console.log('   No existing creditBalances document in PROD');
  }
  
  // Push to PROD
  if (!dryRun) {
    console.log('\n✍️  Writing to PRODUCTION...');
    await prodRef.set(devData);
    console.log('✅ Successfully pushed to PRODUCTION!');
    
    // Save backup
    const backupPath = path.resolve(__dirname, `../data/imports/AVII_creditBalances_PROD_backup_${Date.now()}.json`);
    await writeFile(backupPath, JSON.stringify(devData, null, 2));
    console.log(`💾 Backup saved: ${backupPath}`);
  } else {
    console.log('\n🔍 [DRY RUN] Would push to PRODUCTION');
    console.log('   Run without --dry-run to execute');
  }
  
  console.log('\n' + '='.repeat(70));
}

pushToProd()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });


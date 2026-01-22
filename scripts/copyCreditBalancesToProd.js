#!/usr/bin/env node
/**
 * Copy creditBalances from Dev to Prod
 * 
 * Since Dev was synced from Prod and we applied the credit balance fix to Dev,
 * this script copies the updated creditBalances document from Dev to Prod.
 * 
 * Usage:
 *   node scripts/copyCreditBalancesToProd.js AVII          # Dry run - show what would be copied
 *   node scripts/copyCreditBalancesToProd.js AVII --apply  # Actually copy to Prod
 */

import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse arguments
const args = process.argv.slice(2);
const clientId = args.find(a => !a.startsWith('--')) || 'AVII';
const applyChanges = args.includes('--apply');

const productionProjectId = 'sams-sandyland-prod';
const devProjectId = 'sandyland-management-system';

/**
 * Initialize Firebase Admin for a specific project
 */
function initializeFirebaseApp(name, projectId, useADC = false) {
  // Check if app already exists
  const existingApp = admin.apps.find(app => app?.name === name);
  if (existingApp) {
    return existingApp;
  }
  
  if (useADC) {
    // Clear invalid GOOGLE_APPLICATION_CREDENTIALS
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
         !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectId
    }, name);
  } else {
    // Use service account key for dev
    const serviceAccountPath = join(__dirname, '../backend/serviceAccountKey.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId
    }, name);
  }
}

/**
 * Format for display
 */
function formatPesos(amount) {
  return (amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main() {
  console.log('='.repeat(70));
  console.log(`📋 COPY creditBalances FROM DEV TO PROD`);
  console.log(`   Client: ${clientId}`);
  console.log(`   Mode: ${applyChanges ? '🔴 APPLY (will update Prod)' : '🟢 DRY RUN'}`);
  console.log('='.repeat(70));
  
  // Initialize both Firebase apps
  console.log('\n📦 Initializing Firebase connections...');
  
  const devApp = initializeFirebaseApp('dev', devProjectId, false);
  console.log(`   ✅ Dev: ${devProjectId}`);
  
  const prodApp = initializeFirebaseApp('prod', productionProjectId, true);
  console.log(`   ✅ Prod: ${productionProjectId} (using ADC)`);
  console.log(`   💡 Run 'gcloud auth application-default login' if not authenticated`);
  
  const devDb = admin.firestore(devApp);
  const prodDb = admin.firestore(prodApp);
  
  // Read creditBalances from Dev
  console.log(`\n📖 Reading creditBalances from Dev...`);
  const devRef = devDb.collection('clients').doc(clientId).collection('units').doc('creditBalances');
  const devDoc = await devRef.get();
  
  if (!devDoc.exists) {
    console.log(`   ❌ No creditBalances document found in Dev for ${clientId}`);
    process.exit(1);
  }
  
  const devData = devDoc.data();
  const unitIds = Object.keys(devData).filter(k => !k.startsWith('updated'));
  
  console.log(`   ✅ Found ${unitIds.length} units: ${unitIds.join(', ')}`);
  
  // Show summary of what will be copied
  console.log(`\n📊 Data to copy:`);
  for (const unitId of unitIds) {
    const unitData = devData[unitId];
    const entryCount = unitData.history?.length || 0;
    const balance = unitData.balance || 0;
    console.log(`   ${unitId}: ${entryCount} history entries, balance: $${formatPesos(balance)}`);
  }
  
  // Read current Prod data for comparison
  console.log(`\n📖 Reading current creditBalances from Prod...`);
  const prodRef = prodDb.collection('clients').doc(clientId).collection('units').doc('creditBalances');
  const prodDoc = await prodRef.get();
  
  if (prodDoc.exists) {
    const prodData = prodDoc.data();
    const prodUnitIds = Object.keys(prodData).filter(k => !k.startsWith('updated'));
    console.log(`   Current Prod has ${prodUnitIds.length} units`);
    
    // Compare
    console.log(`\n📊 Comparison (Dev vs Prod):`);
    for (const unitId of unitIds) {
      const devEntries = devData[unitId]?.history?.length || 0;
      const prodEntries = prodData[unitId]?.history?.length || 0;
      const devBalance = devData[unitId]?.balance || 0;
      const prodBalance = prodData[unitId]?.balance || 0;
      
      const entriesChanged = devEntries !== prodEntries;
      const balanceChanged = devBalance !== prodBalance;
      
      if (entriesChanged || balanceChanged) {
        console.log(`   ${unitId}: ${prodEntries} → ${devEntries} entries, $${formatPesos(prodBalance)} → $${formatPesos(devBalance)} ${entriesChanged || balanceChanged ? '⚠️' : ''}`);
      } else {
        console.log(`   ${unitId}: No changes`);
      }
    }
  } else {
    console.log(`   No existing creditBalances in Prod`);
  }
  
  if (applyChanges) {
    console.log(`\n🔴 APPLYING CHANGES TO PROD...`);
    
    // Add metadata
    const dataToWrite = {
      ...devData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'copyCreditBalancesToProd_script',
      copiedFromDev: new Date().toISOString()
    };
    
    await prodRef.set(dataToWrite);
    
    console.log(`   ✅ Successfully copied creditBalances to Prod!`);
  } else {
    console.log(`\n🟢 DRY RUN - No changes made to Prod.`);
    console.log(`   Run with --apply to copy to Prod.`);
  }
  
  console.log('\n' + '='.repeat(70));
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

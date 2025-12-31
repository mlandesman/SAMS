/**
 * Update the OLD credit balance location with data from our CSV import
 * 
 * The statement service reads from: /clients/AVII/units/creditBalances (single doc with all units)
 * Our import wrote to: /clients/AVII/units/{unitId}/creditBalances/current
 * 
 * This script copies from NEW → OLD location
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environment = process.argv[2] || 'dev';
const dryRun = process.argv.includes('--dry-run');

// Initialize Firebase
if (getApps().length === 0) {
  const serviceAccountPath = environment === 'prod'
    ? path.resolve(__dirname, '../serviceAccountKey-prod.json')
    : path.resolve(__dirname, '../serviceAccountKey.json');
  
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];

async function updateOldLocation() {
  console.log(`\n🔄 Updating OLD credit balance location (${environment.toUpperCase()})`);
  console.log(`   Dry Run: ${dryRun ? 'YES' : 'NO'}\n`);
  
  // Get the old location document
  const oldRef = db.collection('clients').doc('AVII').collection('units').doc('creditBalances');
  const oldDoc = await oldRef.get();
  const oldData = oldDoc.exists ? oldDoc.data() : {};
  
  console.log('📋 Current OLD location data:\n');
  
  for (const unitId of units) {
    // Read from NEW location
    const newRef = db.collection('clients').doc('AVII')
      .collection('units').doc(unitId)
      .collection('creditBalances').doc('current');
    const newDoc = await newRef.get();
    
    if (!newDoc.exists) {
      console.log(`   ${unitId}: No new data found, skipping`);
      continue;
    }
    
    const newData = newDoc.data();
    const newBalance = getCreditBalance(newData);
    
    // Check old data
    const oldUnitData = oldData[unitId];
    const oldBalance = oldUnitData ? getCreditBalance(oldUnitData) : 0;
    
    console.log(`   ${unitId}: OLD=${oldBalance} (${(oldBalance/100).toFixed(2)}) → NEW=${newBalance} (${(newBalance/100).toFixed(2)})`);
    
    // Update old data with new data
    oldData[unitId] = {
      creditBalance: newBalance,  // For backwards compatibility
      history: newData.history,
      lastChange: {
        year: '2026',
        timestamp: new Date().toISOString(),
        historyIndex: newData.history.length - 1
      }
    };
  }
  
  if (!dryRun) {
    await oldRef.set(oldData);
    console.log('\n✅ Updated OLD location with NEW data');
  } else {
    console.log('\n🔍 [DRY RUN] Would update OLD location');
  }
  
  // Verify
  console.log('\n📊 Verification:');
  for (const unitId of units) {
    const balance = getCreditBalance(oldData[unitId] || { history: [] });
    console.log(`   ${unitId}: ${balance} centavos ($${(balance/100).toFixed(2)})`);
  }
}

updateOldLocation()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


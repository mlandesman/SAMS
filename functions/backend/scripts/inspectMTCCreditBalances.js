/**
 * Inspect MTC Credit Balances - DEV vs PROD comparison
 */

import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DEV
const devServiceAccount = JSON.parse(
  await readFile(path.resolve(__dirname, '../serviceAccountKey.json'), 'utf8')
);
const devApp = getApps().find(a => a.name === 'dev') || 
  initializeApp({ credential: cert(devServiceAccount) }, 'dev');

// Initialize PROD with ADC
const prodApp = getApps().find(a => a.name === 'prod') || 
  initializeApp({ 
    credential: applicationDefault(),
    projectId: 'sams-sandyland-prod'
  }, 'prod');

const devDb = getFirestore(devApp);
const prodDb = getFirestore(prodApp);

const formatTimestamp = (ts) => {
  if (!ts) return 'N/A';
  if (typeof ts === 'string') return ts.split('T')[0];
  if (ts.toDate) return ts.toDate().toISOString().split('T')[0];
  return 'N/A';
};

async function inspectMTC() {
  console.log('\n🔍 Inspecting MTC Credit Balances\n');
  console.log('='.repeat(80));
  
  // Read from both environments
  const devRef = devDb.collection('clients').doc('MTC').collection('units').doc('creditBalances');
  const prodRef = prodDb.collection('clients').doc('MTC').collection('units').doc('creditBalances');
  
  const [devDoc, prodDoc] = await Promise.all([devRef.get(), prodRef.get()]);
  
  const devData = devDoc.exists ? devDoc.data() : {};
  const prodData = prodDoc.exists ? prodDoc.data() : {};
  
  // Get all unit IDs from both
  const allUnits = new Set([
    ...Object.keys(devData).filter(k => /^[A-Z0-9]+$/i.test(k)),
    ...Object.keys(prodData).filter(k => /^[A-Z0-9]+$/i.test(k))
  ]);
  
  console.log(`\nFound ${allUnits.size} units with credit balance data\n`);
  
  const issues = [];
  const summary = [];
  
  for (const unitId of [...allUnits].sort()) {
    const dev = devData[unitId];
    const prod = prodData[unitId];
    
    const devBalance = dev ? getCreditBalance(dev) : 0;
    const prodBalance = prod ? getCreditBalance(prod) : 0;
    const devHistoryCount = dev?.history?.length || 0;
    const prodHistoryCount = prod?.history?.length || 0;
    
    const balanceDiff = devBalance !== prodBalance;
    const historyDiff = devHistoryCount !== prodHistoryCount;
    
    summary.push({
      unitId,
      devBalance: devBalance / 100,
      prodBalance: prodBalance / 100,
      devHistoryCount,
      prodHistoryCount,
      hasDiff: balanceDiff || historyDiff
    });
    
    if (balanceDiff || historyDiff) {
      issues.push({
        unitId,
        devBalance,
        prodBalance,
        devHistoryCount,
        prodHistoryCount
      });
    }
  }
  
  // Print summary table
  console.log('Unit       | DEV Balance  | PROD Balance | DEV Hist | PROD Hist | Status');
  console.log('-'.repeat(80));
  
  for (const s of summary) {
    const status = s.hasDiff ? '⚠️ DIFF' : '✓';
    console.log(
      `${s.unitId.padEnd(10)} | ` +
      `$${s.devBalance.toFixed(2).padStart(10)} | ` +
      `$${s.prodBalance.toFixed(2).padStart(10)} | ` +
      `${String(s.devHistoryCount).padStart(8)} | ` +
      `${String(s.prodHistoryCount).padStart(9)} | ` +
      status
    );
  }
  
  console.log('-'.repeat(80));
  console.log(`\nUnits with differences: ${issues.length}`);
  
  // Show details of units with issues
  if (issues.length > 0) {
    console.log('\n📋 Units with differences:\n');
    
    for (const issue of issues.slice(0, 5)) { // Show first 5
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Unit ${issue.unitId}`);
      console.log('='.repeat(60));
      
      const prod = prodData[issue.unitId];
      const dev = devData[issue.unitId];
      
      if (prod?.history) {
        console.log('\nPROD History:');
        for (const entry of prod.history.slice(0, 5)) {
          console.log(`  ${formatTimestamp(entry.timestamp)}: ${(entry.type || 'unknown').padEnd(15)} ${String(entry.amount).padStart(10)} | ${entry.notes?.substring(0, 35) || ''}`);
        }
        if (prod.history.length > 5) console.log(`  ... and ${prod.history.length - 5} more`);
      }
      
      if (dev?.history) {
        console.log('\nDEV History:');
        for (const entry of dev.history.slice(0, 5)) {
          console.log(`  ${formatTimestamp(entry.timestamp)}: ${(entry.type || 'unknown').padEnd(15)} ${String(entry.amount).padStart(10)} | ${entry.notes?.substring(0, 35) || ''}`);
        }
        if (dev.history.length > 5) console.log(`  ... and ${dev.history.length - 5} more`);
      }
    }
  }
  
  // Save summary to CSV
  const csvPath = '/Users/michael/Projects/SAMS/test-results/MTC_Credit_Balance_Comparison.csv';
  const csvContent = [
    'Unit,DEV Balance,PROD Balance,DEV History,PROD History,Has Diff',
    ...summary.map(s => `${s.unitId},${s.devBalance.toFixed(2)},${s.prodBalance.toFixed(2)},${s.devHistoryCount},${s.prodHistoryCount},${s.hasDiff}`)
  ].join('\n');
  await writeFile(csvPath, csvContent);
  console.log(`\n💾 Saved comparison to: ${csvPath}`);
}

inspectMTC()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


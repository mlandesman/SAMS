/**
 * Export Credit Balances from DEV to a JSON file for PRODUCTION push
 * 
 * Usage: node exportCreditBalancesForProd.js
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCreditBalance } from '../../shared/utils/creditBalanceUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DEV Firebase
if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    await readFile(path.resolve(__dirname, '../serviceAccountKey.json'), 'utf8')
  );
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();

async function exportForProd() {
  console.log('\n📤 Exporting Credit Balances for PRODUCTION\n');
  
  // Read from DEV
  const devRef = db.collection('clients').doc('AVII').collection('units').doc('creditBalances');
  const devDoc = await devRef.get();
  
  if (!devDoc.exists) {
    console.log('❌ No creditBalances document found in DEV');
    return;
  }
  
  const devData = devDoc.data();
  const units = Object.keys(devData).filter(k => /^\d+$/.test(k));
  
  console.log('📊 Credit Balance Summary:');
  console.log('='.repeat(50));
  
  for (const unitId of units.sort()) {
    const unitData = devData[unitId];
    const balance = getCreditBalance(unitData);
    console.log(`   ${unitId}: $${(balance / 100).toFixed(2).padStart(10)} (${unitData.history?.length || 0} history entries)`);
  }
  
  console.log('='.repeat(50));
  
  // Save to file
  const outputDir = '/Users/michael/Projects/SAMS-Docs/apm_session/Data_Exports';
  const timestamp = new Date().toISOString().split('T')[0];
  
  const outputPath = `${outputDir}/AVII_creditBalances_for_PROD_${timestamp}.json`;
  await writeFile(outputPath, JSON.stringify(devData, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);
  
  // Also create a summary CSV
  const csvPath = `${outputDir}/AVII_creditBalances_summary_${timestamp}.csv`;
  const csvContent = [
    'Unit,Credit Balance (centavos),Credit Balance (pesos),History Entries',
    ...units.sort().map(unitId => {
      const balance = getCreditBalance(devData[unitId]);
      return `${unitId},${balance},${(balance/100).toFixed(2)},${devData[unitId].history?.length || 0}`;
    })
  ].join('\n');
  await writeFile(csvPath, csvContent);
  console.log(`💾 Summary CSV: ${csvPath}`);
  
  console.log('\n📋 To push to PRODUCTION:');
  console.log('   1. Use Firebase Console to import the JSON file');
  console.log('   2. OR fix the prod service account key and re-run pushCreditBalancesToProd.js');
  console.log(`\n   Document path: clients/AVII/units/creditBalances`);
}

exportForProd()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


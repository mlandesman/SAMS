/**
 * Compare PROD vs DEV credit balance history in detail
 */

import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'fs/promises';
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

// Initialize PROD with ADC - sams-sandyland-prod
const prodApp = getApps().find(a => a.name === 'prod') || 
  initializeApp({ 
    credential: applicationDefault(),
    projectId: 'sams-sandyland-prod'
  }, 'prod');

const devDb = getFirestore(devApp);
const prodDb = getFirestore(prodApp);

async function compare() {
  console.log('\n🔍 Comparing PROD vs DEV Credit Balance History\n');
  
  const devRef = devDb.collection('clients').doc('AVII').collection('units').doc('creditBalances');
  const prodRef = prodDb.collection('clients').doc('AVII').collection('units').doc('creditBalances');
  
  const [devDoc, prodDoc] = await Promise.all([devRef.get(), prodRef.get()]);
  
  const devData = devDoc.data() || {};
  const prodData = prodDoc.data() || {};
  
  const units = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204'];
  
  for (const unitId of units) {
    const dev = devData[unitId];
    const prod = prodData[unitId];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Unit ${unitId}`);
    console.log('='.repeat(60));
    
    const devBalance = dev ? getCreditBalance(dev) : 0;
    const prodBalance = prod ? getCreditBalance(prod) : 0;
    const devHistoryCount = dev?.history?.length || 0;
    const prodHistoryCount = prod?.history?.length || 0;
    
    console.log(`Balance: DEV=$${(devBalance/100).toFixed(2)} | PROD=$${(prodBalance/100).toFixed(2)} ${devBalance !== prodBalance ? '⚠️ DIFFERENT' : '✓'}`);
    console.log(`History entries: DEV=${devHistoryCount} | PROD=${prodHistoryCount} ${devHistoryCount !== prodHistoryCount ? '⚠️ DIFFERENT' : '✓'}`);
    
    const formatTimestamp = (ts) => {
      if (!ts) return 'N/A';
      if (typeof ts === 'string') return ts.split('T')[0];
      if (ts.toDate) return ts.toDate().toISOString().split('T')[0];
      return 'N/A';
    };
    
    if (prod?.history) {
      console.log('\nPROD History:');
      for (const entry of prod.history) {
        console.log(`  ${formatTimestamp(entry.timestamp)}: ${(entry.type || 'unknown').padEnd(15)} ${String(entry.amount).padStart(10)} | ${entry.notes?.substring(0, 40) || ''}`);
      }
    } else {
      console.log('\nPROD History: (none)');
    }
    
    if (dev?.history) {
      console.log('\nDEV History:');
      for (const entry of dev.history) {
        console.log(`  ${formatTimestamp(entry.timestamp)}: ${(entry.type || 'unknown').padEnd(15)} ${String(entry.amount).padStart(10)} | ${entry.notes?.substring(0, 40) || ''}`);
      }
    }
  }
}

compare()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });


/**
 * Copy Credit Balances from Dev to Prod
 * 
 * Purpose: Copy specific credit balance records from Dev to Prod
 * 
 * Usage:
 *   DRY RUN:  node backend/scripts/copyCreditBalances.js
 *   EXECUTE:  node backend/scripts/copyCreditBalances.js --execute
 */

import admin from 'firebase-admin';

const DRY_RUN = !process.argv.includes('--execute');

// Initialize both apps
const devApp = admin.initializeApp({
  projectId: 'sandyland-management-system',
}, 'dev');

const prodApp = admin.initializeApp({
  projectId: 'sams-sandyland-prod',
}, 'prod');

const devDb = admin.firestore(devApp);
const prodDb = admin.firestore(prodApp);

console.log('🔥 Connected to both DEV and PROD');

// Units to copy
const UNITS_TO_COPY = [
  { clientId: 'AVII', unitId: '102' },
  { clientId: 'AVII', unitId: '201' },
  { clientId: 'AVII', unitId: '204' },
];

async function main() {
  console.log('═'.repeat(70));
  console.log('  COPY CREDIT BALANCES: DEV → PROD');
  console.log('═'.repeat(70));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ EXECUTE (making changes)'}`);
  console.log('');

  for (const { clientId, unitId } of UNITS_TO_COPY) {
    console.log(`\n📍 ${clientId}:${unitId}`);
    
    try {
      // Get Dev credit balance document
      const devDocRef = devDb.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      const devDoc = await devDocRef.get();
      
      if (!devDoc.exists) {
        console.log('  ❌ creditBalances document not found in Dev');
        continue;
      }
      
      const devData = devDoc.data();
      const unitCreditData = devData[unitId];
      
      if (!unitCreditData) {
        console.log(`  ❌ No credit data for unit ${unitId} in Dev`);
        continue;
      }
      
      console.log(`  Dev balance: $${(unitCreditData.creditBalance / 100).toFixed(2)}`);
      console.log(`  Dev history entries: ${unitCreditData.history?.length || 0}`);
      
      // Get Prod credit balance for comparison
      const prodDocRef = prodDb.collection('clients').doc(clientId)
        .collection('units').doc('creditBalances');
      const prodDoc = await prodDocRef.get();
      
      if (prodDoc.exists) {
        const prodData = prodDoc.data();
        const prodUnitData = prodData[unitId];
        if (prodUnitData) {
          console.log(`  Prod balance: $${(prodUnitData.creditBalance / 100).toFixed(2)}`);
        }
      }
      
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update ${clientId}:${unitId} in Prod`);
      } else {
        // Update Prod with Dev data
        await prodDocRef.update({
          [unitId]: unitCreditData
        });
        console.log(`  ✅ Copied to Prod`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  if (DRY_RUN) {
    console.log('🔍 DRY RUN COMPLETE - No changes made');
    console.log('   Run with --execute to apply changes');
  } else {
    console.log('⚡ COPY COMPLETE');
  }
  console.log('');
  
  process.exit(0);
}

main();

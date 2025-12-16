/**
 * Compare Credit Balances Between Dev and Prod
 * 
 * Purpose: Show differences in creditBalances collection between environments
 * 
 * Usage:
 *   node backend/scripts/compareCreditBalances.js
 */

import admin from 'firebase-admin';
import { initializeApp as initDevApp } from 'firebase-admin/app';

// We need two separate Firebase apps for Dev and Prod
const devApp = admin.initializeApp({
  projectId: 'sandyland-management-system',
}, 'dev');

const prodApp = admin.initializeApp({
  projectId: 'sams-sandyland-prod',
}, 'prod');

const devDb = admin.firestore(devApp);
const prodDb = admin.firestore(prodApp);

console.log('🔥 Connected to both DEV and PROD');

async function getCreditBalances(db, envName) {
  const results = {};
  
  // Get all clients
  const clientsSnap = await db.collection('clients').get();
  
  for (const clientDoc of clientsSnap.docs) {
    const clientId = clientDoc.id;
    results[clientId] = {};
    
    // Get creditBalances collection under units
    const creditBalancesSnap = await db.collection('clients').doc(clientId)
      .collection('units').doc('creditBalances').get();
    
    if (creditBalancesSnap.exists) {
      const data = creditBalancesSnap.data();
      results[clientId]['_document'] = data;
    }
    
    // Also check for creditBalances as a subcollection of each unit
    const unitsSnap = await db.collection('clients').doc(clientId)
      .collection('units').get();
    
    for (const unitDoc of unitsSnap.docs) {
      const unitId = unitDoc.id;
      if (unitId === 'creditBalances') continue; // Skip the document we already got
      
      // Check if unit has creditBalances subcollection
      const unitCreditSnap = await db.collection('clients').doc(clientId)
        .collection('units').doc(unitId)
        .collection('creditBalances').get();
      
      if (!unitCreditSnap.empty) {
        results[clientId][unitId] = {};
        unitCreditSnap.docs.forEach(doc => {
          results[clientId][unitId][doc.id] = doc.data();
        });
      }
    }
  }
  
  return results;
}

function formatCurrency(cents) {
  if (cents === undefined || cents === null) return 'N/A';
  return `$${(cents / 100).toFixed(2)}`;
}

async function main() {
  console.log('═'.repeat(80));
  console.log('  CREDIT BALANCES COMPARISON: DEV vs PROD');
  console.log('═'.repeat(80));
  console.log('');

  try {
    console.log('Loading Dev credit balances...');
    const devBalances = await getCreditBalances(devDb, 'DEV');
    
    console.log('Loading Prod credit balances...');
    const prodBalances = await getCreditBalances(prodDb, 'PROD');
    
    // Get all client IDs from both
    const allClients = new Set([...Object.keys(devBalances), ...Object.keys(prodBalances)]);
    
    for (const clientId of allClients) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📁 Client: ${clientId}`);
      console.log('─'.repeat(60));
      
      const devClient = devBalances[clientId] || {};
      const prodClient = prodBalances[clientId] || {};
      
      // Get all unit IDs
      const allUnits = new Set([...Object.keys(devClient), ...Object.keys(prodClient)]);
      
      if (allUnits.size === 0) {
        console.log('  No credit balances found in either environment');
        continue;
      }
      
      // Check the creditBalances document first
      if (devClient['_document'] || prodClient['_document']) {
        console.log('\n  📄 creditBalances Document:');
        const devDoc = devClient['_document'] || {};
        const prodDoc = prodClient['_document'] || {};
        
        // Get all keys
        const allKeys = new Set([...Object.keys(devDoc), ...Object.keys(prodDoc)]);
        
        for (const key of allKeys) {
          const devVal = devDoc[key];
          const prodVal = prodDoc[key];
          
          if (JSON.stringify(devVal) !== JSON.stringify(prodVal)) {
            console.log(`     ⚠️  ${key}:`);
            console.log(`         DEV:  ${typeof devVal === 'object' ? JSON.stringify(devVal) : devVal}`);
            console.log(`         PROD: ${typeof prodVal === 'object' ? JSON.stringify(prodVal) : prodVal}`);
          }
        }
      }
      
      // Check per-unit credit balances
      let hasDifferences = false;
      
      for (const unitId of allUnits) {
        if (unitId === '_document') continue;
        
        const devUnit = devClient[unitId] || {};
        const prodUnit = prodClient[unitId] || {};
        
        // Get all document IDs
        const allDocs = new Set([...Object.keys(devUnit), ...Object.keys(prodUnit)]);
        
        for (const docId of allDocs) {
          const devData = devUnit[docId];
          const prodData = prodUnit[docId];
          
          if (!devData && prodData) {
            console.log(`\n  📍 Unit ${unitId} / ${docId}:`);
            console.log(`     ❌ Missing in DEV, exists in PROD`);
            console.log(`     PROD: ${JSON.stringify(prodData, null, 2).substring(0, 200)}`);
            hasDifferences = true;
          } else if (devData && !prodData) {
            console.log(`\n  📍 Unit ${unitId} / ${docId}:`);
            console.log(`     ❌ Exists in DEV, missing in PROD`);
            console.log(`     DEV: ${JSON.stringify(devData, null, 2).substring(0, 200)}`);
            hasDifferences = true;
          } else if (JSON.stringify(devData) !== JSON.stringify(prodData)) {
            console.log(`\n  📍 Unit ${unitId} / ${docId}:`);
            console.log(`     ⚠️  Data differs:`);
            
            // Compare specific fields
            const allFields = new Set([...Object.keys(devData || {}), ...Object.keys(prodData || {})]);
            for (const field of allFields) {
              if (JSON.stringify(devData?.[field]) !== JSON.stringify(prodData?.[field])) {
                const devVal = devData?.[field];
                const prodVal = prodData?.[field];
                
                // Format based on field type
                let devDisplay = devVal;
                let prodDisplay = prodVal;
                
                if (field.includes('balance') || field.includes('amount') || field.includes('Amount')) {
                  devDisplay = formatCurrency(devVal);
                  prodDisplay = formatCurrency(prodVal);
                } else if (typeof devVal === 'object') {
                  devDisplay = JSON.stringify(devVal);
                  prodDisplay = JSON.stringify(prodVal);
                }
                
                console.log(`         ${field}: DEV=${devDisplay} vs PROD=${prodDisplay}`);
              }
            }
            hasDifferences = true;
          }
        }
      }
      
      if (!hasDifferences && allUnits.size > 1) {
        console.log('\n  ✅ All credit balances match between DEV and PROD');
      }
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log('  COMPARISON COMPLETE');
    console.log('═'.repeat(80));
    console.log('');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();

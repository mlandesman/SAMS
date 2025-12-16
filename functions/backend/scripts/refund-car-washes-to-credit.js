/**
 * Car Wash Credit Refund Script
 * 
 * Purpose: Refund paid car wash charges (Lavado de autos) as credit balances
 * since car wash charges have been discontinued.
 * 
 * This script:
 * 1. Reads paid car wash charges from Sheets unitAccounting.json
 * 2. Adds the amounts as credit balances for each unit
 * 3. Generates a report of all credits added
 * 
 * Usage: 
 *   DRY RUN: node backend/scripts/refund-car-washes-to-credit.js
 *   EXECUTE: node backend/scripts/refund-car-washes-to-credit.js --execute
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Initialize Firebase
const serviceAccountPath = path.resolve('./backend/serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const CLIENT_ID = 'AVII';
const DRY_RUN = !process.argv.includes('--execute');
const SHEETS_DATA_PATH = '/Users/michael/Projects/SAMS-Docs/docs/AVII-Reconciliation/Sheets-Data';

console.log('═'.repeat(70));
console.log('  CAR WASH CREDIT REFUND SCRIPT');
console.log('═'.repeat(70));
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ EXECUTE (making changes)'}`);
console.log('');

/**
 * Load car wash charges from Sheets unitAccounting.json
 */
function loadCarWashCharges() {
  const filePath = path.join(SHEETS_DATA_PATH, 'unitAccounting.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  // Filter for paid car washes (Lavado de autos, positive amount, marked paid)
  const carWashes = data.filter(r => 
    r['Categoría'] === 'Lavado de autos' && 
    r['Cantidad'] > 0 && 
    r['✓'] === true
  );
  
  return carWashes;
}

/**
 * Group car washes by unit
 */
function groupByUnit(carWashes) {
  const byUnit = {};
  
  for (const wash of carWashes) {
    const unitLabel = wash['Depto'];
    const unitId = unitLabel.split(' ')[0]; // Extract "101" from "101 (Zerbarini)"
    
    if (!byUnit[unitId]) {
      byUnit[unitId] = {
        unitId,
        unitLabel,
        charges: [],
        total: 0
      };
    }
    
    byUnit[unitId].charges.push({
      date: wash['Fecha'],
      amount: wash['Cantidad'],
      notes: wash['Notas']
    });
    byUnit[unitId].total += wash['Cantidad'];
  }
  
  return byUnit;
}

/**
 * Get current credit balance for a unit
 */
async function getCurrentCredit(unitId) {
  const creditBalancesRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances');
  
  const doc = await creditBalancesRef.get();
  if (!doc.exists) return 0;
  
  const data = doc.data();
  return (data[unitId]?.creditBalance || 0) / 100; // Return in pesos
}

/**
 * Add credit to a unit's balance
 */
async function addCredit(unitId, amountPesos, note) {
  const amountCentavos = Math.round(amountPesos * 100);
  
  const creditBalancesRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances');
  
  const doc = await creditBalancesRef.get();
  const allData = doc.exists ? doc.data() : {};
  const unitData = allData[unitId] || { creditBalance: 0, history: [] };
  
  const currentBalance = unitData.creditBalance || 0;
  const newBalance = currentBalance + amountCentavos;
  
  const historyEntry = {
    id: `carwash-refund-${Date.now()}`,
    timestamp: new Date().toISOString(),
    amount: amountCentavos,
    balance: newBalance,
    transactionId: null,
    note: note,
    source: 'carwash-refund-script'
  };
  
  const history = unitData.history || [];
  history.push(historyEntry);
  
  allData[unitId] = {
    creditBalance: newBalance,
    lastChange: {
      year: '2026',
      historyIndex: history.length - 1,
      timestamp: new Date().toISOString()
    },
    history: history
  };
  
  if (!DRY_RUN) {
    await creditBalancesRef.set(allData);
  }
  
  return {
    before: currentBalance / 100,
    added: amountPesos,
    after: newBalance / 100
  };
}

/**
 * Main execution
 */
async function main() {
  try {
    // Load and group car wash charges
    console.log('Loading car wash charges from Sheets...');
    const carWashes = loadCarWashCharges();
    console.log(`Found ${carWashes.length} paid car wash charges`);
    console.log('');
    
    const byUnit = groupByUnit(carWashes);
    
    // Display all charges
    console.log('═'.repeat(70));
    console.log('  CAR WASH CHARGES TO REFUND');
    console.log('═'.repeat(70));
    console.log('');
    
    for (const [unitId, data] of Object.entries(byUnit).sort()) {
      console.log(`Unit ${unitId} (${data.unitLabel.split('(')[1]?.replace(')', '') || ''}):`);
      for (const charge of data.charges) {
        const date = new Date(charge.date).toLocaleDateString('en-US');
        console.log(`  ${date}: $${charge.amount} - ${charge.notes}`);
      }
      console.log(`  TOTAL: $${data.total}`);
      console.log('');
    }
    
    // Apply credits
    console.log('═'.repeat(70));
    console.log('  APPLYING CREDITS');
    console.log('═'.repeat(70));
    console.log('');
    
    const results = [];
    
    for (const [unitId, data] of Object.entries(byUnit).sort()) {
      const currentCredit = await getCurrentCredit(unitId);
      
      const note = `Car wash refund (${data.charges.length} charges discontinued): ${data.charges.map(c => 
        `${new Date(c.date).toLocaleDateString('en-US')} $${c.amount}`
      ).join(', ')}`;
      
      if (DRY_RUN) {
        console.log(`Unit ${unitId}:`);
        console.log(`  Current credit: $${currentCredit.toFixed(2)}`);
        console.log(`  Adding: $${data.total.toFixed(2)}`);
        console.log(`  New credit: $${(currentCredit + data.total).toFixed(2)}`);
        console.log(`  [DRY RUN] Would add credit`);
        console.log('');
        
        results.push({
          unitId,
          before: currentCredit,
          added: data.total,
          after: currentCredit + data.total
        });
      } else {
        const result = await addCredit(unitId, data.total, note);
        
        console.log(`Unit ${unitId}:`);
        console.log(`  Credit: $${result.before.toFixed(2)} → $${result.after.toFixed(2)} (+$${result.added.toFixed(2)})`);
        console.log(`  ✅ Credit added`);
        console.log('');
        
        results.push({
          unitId,
          ...result
        });
      }
    }
    
    // Summary report
    console.log('═'.repeat(70));
    console.log('  SUMMARY REPORT');
    console.log('═'.repeat(70));
    console.log('');
    console.log('Unit | Before    | Added     | After');
    console.log('-'.repeat(50));
    
    let totalAdded = 0;
    for (const r of results) {
      console.log(`${r.unitId.padEnd(4)} | $${r.before.toFixed(2).padStart(8)} | $${r.added.toFixed(2).padStart(8)} | $${r.after.toFixed(2).padStart(8)}`);
      totalAdded += r.added;
    }
    
    console.log('-'.repeat(50));
    console.log(`TOTAL CREDITS ADDED: $${totalAdded.toFixed(2)}`);
    console.log('');
    
    if (DRY_RUN) {
      console.log('🔍 DRY RUN COMPLETE - No changes made');
      console.log('   Run with --execute to apply credits');
    } else {
      console.log('⚡ CREDITS APPLIED SUCCESSFULLY');
      console.log('');
      console.log('Note: These credits are now available for future charges.');
    }
    console.log('');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

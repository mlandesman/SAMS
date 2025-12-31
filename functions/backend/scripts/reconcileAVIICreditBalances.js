/**
 * Reconcile AVII Credit Balances
 * 
 * Creates clean credit history with:
 * 1. Starting balance entry (June 30, 2025)
 * 2. Single adjustment entry to reach expected final balance
 * 
 * Usage:
 *   NODE_ENV=production node functions/backend/scripts/reconcileAVIICreditBalances.js [--dry-run]
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getNow } from '../../shared/services/DateService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_ID = 'AVII';
const FY_START_DATE = '2025-07-01T00:00:00.000Z';  // July 1, 2025
const OPENING_BALANCE_DATE = '2025-06-30T23:59:59.000Z';  // Day before FY start
const ADJUSTMENT_DATE = '2025-12-13T15:21:09.000Z';  // Match existing "conversion to quarterly" entries

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function pesosToCentavos(pesos) {
  if (pesos === null || pesos === undefined || isNaN(pesos)) return 0;
  return Math.round(pesos * 100);
}

function centavosToPesos(centavos) {
  return centavos / 100;
}

async function loadExpectedData() {
  const jsonPath = path.join(__dirname, '../data/imports/creditBalances.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`creditBalances.json not found at ${jsonPath}`);
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function getExpectedFinalBalance(unitData) {
  // Get the last entry's adjustedBalanceMxn as the expected final balance
  if (!unitData.entries || unitData.entries.length === 0) {
    return unitData.startingBalance || 0;
  }
  
  // Find the last non-unparsed entry
  for (let i = unitData.entries.length - 1; i >= 0; i--) {
    const entry = unitData.entries[i];
    if (!entry.unparsed && entry.adjustedBalanceMxn !== undefined) {
      return entry.adjustedBalanceMxn;
    }
  }
  
  return unitData.startingBalance || 0;
}

function buildCleanHistory(unitId, unitData) {
  const startingBalancePesos = unitData.startingBalance || 0;
  const expectedFinalPesos = getExpectedFinalBalance(unitData);
  
  const startingBalanceCentavos = pesosToCentavos(startingBalancePesos);
  const expectedFinalCentavos = pesosToCentavos(expectedFinalPesos);
  
  const history = [];
  
  // Entry 1: Starting balance (dated June 30, 2025)
  history.push({
    id: generateId('starting_balance'),
    amount: startingBalanceCentavos,
    timestamp: OPENING_BALANCE_DATE,
    type: 'starting_balance',
    notes: `Starting credit balance from prior period (imported from Sheets)`,
    source: 'import'
  });
  
  // Entry 2: Adjustment to reach expected final balance
  const adjustmentNeeded = expectedFinalCentavos - startingBalanceCentavos;
  
  if (adjustmentNeeded !== 0) {
    history.push({
      id: generateId('reconcile'),
      amount: adjustmentNeeded,
      timestamp: ADJUSTMENT_DATE,
      type: adjustmentNeeded > 0 ? 'credit_added' : 'credit_used',
      notes: `Reconciliation adjustment to match Sheets data (fiscal year activity)`,
      source: 'admin'
    });
  }
  
  // Verify: sum should equal expected final
  const calculatedBalance = history.reduce((sum, e) => sum + e.amount, 0);
  if (calculatedBalance !== expectedFinalCentavos) {
    console.error(`⚠️ Unit ${unitId}: Balance mismatch! Expected ${expectedFinalCentavos}, got ${calculatedBalance}`);
  }
  
  return {
    history,
    startingBalancePesos,
    expectedFinalPesos,
    adjustmentNeeded: centavosToPesos(adjustmentNeeded)
  };
}

async function reconcile(dryRun = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  AVII Credit Balance Reconciliation`);
  console.log(`  Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update Firestore)'}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const db = await getDb();
  const expectedData = await loadExpectedData();
  
  const creditBalancesRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances');
  
  // Read current data
  const currentDoc = await creditBalancesRef.get();
  const currentData = currentDoc.exists ? currentDoc.data() : {};
  
  const newData = {};
  const summary = [];
  
  for (const [unitId, unitData] of Object.entries(expectedData)) {
    console.log(`\n📍 Unit ${unitId}:`);
    
    const result = buildCleanHistory(unitId, unitData);
    
    console.log(`   Starting Balance: $${result.startingBalancePesos.toFixed(2)}`);
    console.log(`   Expected Final:   $${result.expectedFinalPesos.toFixed(2)}`);
    console.log(`   Adjustment:       $${result.adjustmentNeeded >= 0 ? '+' : ''}${result.adjustmentNeeded.toFixed(2)}`);
    console.log(`   History Entries:  ${result.history.length}`);
    
    newData[unitId] = {
      lastChange: {
        year: '2026',
        historyIndex: result.history.length - 1,
        timestamp: getNow().toISOString()
      },
      history: result.history
    };
    
    summary.push({
      unitId,
      startingBalance: result.startingBalancePesos,
      expectedFinal: result.expectedFinalPesos,
      adjustment: result.adjustmentNeeded
    });
  }
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log('SUMMARY:');
  console.log('─'.repeat(60));
  console.log('Unit  | Starting   | Final      | Adjustment');
  console.log('─'.repeat(60));
  for (const s of summary) {
    console.log(`${s.unitId.padEnd(5)} | $${s.startingBalance.toFixed(2).padStart(9)} | $${s.expectedFinal.toFixed(2).padStart(9)} | $${(s.adjustment >= 0 ? '+' : '') + s.adjustment.toFixed(2)}`);
  }
  console.log('─'.repeat(60));
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - No changes made');
    console.log('   Run without --dry-run to apply changes');
  } else {
    // Write to Firestore
    await creditBalancesRef.set(newData);
    console.log(`\n✅ Credit balances updated for ${Object.keys(newData).length} units`);
  }
  
  return summary;
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

reconcile(dryRun)
  .then(() => {
    console.log('\n✅ Reconciliation complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Reconciliation failed:', err);
    process.exit(1);
  });


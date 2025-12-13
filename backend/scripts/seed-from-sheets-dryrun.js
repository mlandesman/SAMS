/**
 * Seed From Sheets - Dry Run v2
 * 
 * This script compares Sheets statement data with actual SAMS data
 * and shows what changes are needed to make SAMS match Sheets.
 * 
 * Usage: node backend/scripts/seed-from-sheets-dryrun.js [unitId]
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
const SHEETS_DATA_PATH = '/Users/michael/Projects/SAMS-Docs/docs/AVII-Reconciliation/Sheets-Data';

/**
 * Load all unit JSON files from Sheets-Data
 */
function loadSheetsData() {
  const files = fs.readdirSync(SHEETS_DATA_PATH)
    .filter(f => f.startsWith('unit-') && f.endsWith('.json'));
  
  const unitData = {};
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(SHEETS_DATA_PATH, file), 'utf8'));
    unitData[content.unit] = content;
  }
  return unitData;
}

/**
 * Check if a row is Q2 water consumption
 * Q2 = October 1, 2025 onwards (charges for Sep/Oct/Nov consumption)
 * Q2 water charges should be excluded since we deleted Q2 bill
 */
function isQ2WaterCharge(row) {
  // Check by date - Q2 starts October 1, 2025
  const rowDate = new Date(row.date);
  const q2Start = new Date('2025-10-01');
  if (rowDate >= q2Start) {
    return true;
  }
  
  // Also check notes as backup for Oct/Nov consumption
  const notes = (row.notes || '').toLowerCase();
  return notes.includes('october') || notes.includes('november');
}

/**
 * Classify a Sheets row into a type
 */
function classifyRow(row) {
  const { category, amount, notes } = row;
  const isCharge = amount > 0;
  const isPayment = amount < 0;
  const isZero = amount === 0;
  
  if (isZero) return { type: 'skip', reason: 'zero amount' };
  
  if (category === 'Mantenimiento trimestral' && isCharge) {
    return { type: 'hoa_charge', category: 'hoa-dues' };
  }
  if (category === 'Consumo de agua') {
    if (isCharge) {
      // Skip Q2 water charges (October, November consumption)
      if (isQ2WaterCharge(row)) {
        return { type: 'skip', reason: 'Q2 water charge (excluded)' };
      }
      return { type: 'water_charge' };
    } else {
      return { type: 'water_payment' };
    }
  }
  if (category === 'Cargo por pago atrasado' && isCharge) {
    // Skip Q2 penalties (Oct 1, 2025 onwards)
    const rowDate = new Date(row.date);
    const q2Start = new Date('2025-10-01');
    if (rowDate >= q2Start) {
      return { type: 'skip', reason: 'Q2 penalty (excluded)' };
    }
    return { type: 'penalty' };
  }
  if ((category === 'Lavado de autos' || category === 'Lavado de barcos') && isCharge) {
    return { type: 'lavado' };
  }
  if (category === 'HOA Dues' && isPayment) {
    return { type: 'hoa_payment' };
  }
  if (category === 'Water Consumption' && isPayment) {
    return { type: 'water_payment' };
  }
  
  return { type: 'unknown' };
}

/**
 * Aggregate Sheets data by type
 */
function aggregateSheetsData(rows) {
  const summary = {
    hoa_charges: 0,
    hoa_payments: 0,
    water_charges: 0,
    water_payments: 0,
    penalties: 0,
    lavado: 0,
    unknown_charges: 0,
    unknown_payments: 0,
    total_charges: 0,
    total_payments: 0,
    rows_by_type: {}
  };
  
  for (const row of rows) {
    const { type } = classifyRow(row);
    if (type === 'skip') continue;
    
    if (!summary.rows_by_type[type]) summary.rows_by_type[type] = [];
    summary.rows_by_type[type].push(row);
    
    const amt = row.amount;
    switch (type) {
      case 'hoa_charge':
        summary.hoa_charges += amt;
        summary.total_charges += amt;
        break;
      case 'hoa_payment':
        summary.hoa_payments += Math.abs(amt);
        summary.total_payments += Math.abs(amt);
        break;
      case 'water_charge':
        summary.water_charges += amt;
        summary.total_charges += amt;
        break;
      case 'water_payment':
        summary.water_payments += Math.abs(amt);
        summary.total_payments += Math.abs(amt);
        break;
      case 'penalty':
        summary.penalties += amt;
        summary.total_charges += amt;
        break;
      case 'lavado':
        summary.lavado += amt;
        summary.total_charges += amt;
        break;
      default:
        if (amt > 0) {
          summary.unknown_charges += amt;
          summary.total_charges += amt;
        } else {
          summary.unknown_payments += Math.abs(amt);
          summary.total_payments += Math.abs(amt);
        }
    }
  }
  
  summary.balance = summary.total_charges - summary.total_payments;
  return summary;
}

/**
 * Get existing transactions for a unit
 */
async function getExistingTransactions(unitId) {
  const txRef = db.collection('clients').doc(CLIENT_ID).collection('transactions');
  const snapshot = await txRef
    .where('unitId', '>=', unitId)
    .where('unitId', '<', unitId + '\uf8ff')
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get water bill data for a unit (Q1 only - Q2 is excluded/deleted)
 * 
 * NOTE: We only compare Q1 because:
 * - Q2 water bill was deleted (SAMS will regenerate it later)
 * - Sheets Q2 water charges are also excluded from comparison
 */
async function getWaterBillData(unitId) {
  const billsRef = db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills');
  
  const q1Doc = await billsRef.doc('2026-Q1').get();
  const q1Data = q1Doc.exists ? q1Doc.data()?.bills?.units?.[unitId] : null;
  
  // Q1 only - Q2 excluded from comparison
  return {
    waterCharge: q1Data?.waterCharge || 0,
    penaltyAmount: q1Data?.penaltyAmount || 0,
    importedLavadoCharge: q1Data?.importedLavadoCharge || 0,
    currentCharge: q1Data?.currentCharge || 0,
    paidAmount: q1Data?.paidAmount || 0,
    q1: q1Data,
    q2: null  // Excluded
  };
}

/**
 * Get HOA dues for a unit
 */
async function getHoaDues(unitId) {
  const duesDoc = await db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc(unitId).collection('dues').doc('2026').get();
  
  if (!duesDoc.exists) return null;
  return duesDoc.data();
}

/**
 * Analyze a single unit
 */
async function analyzeUnit(unitId, sheetsData) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`UNIT ${unitId}: ${sheetsData.unitLabel}`);
  console.log(`${'═'.repeat(70)}`);
  
  const rows = sheetsData.rows;
  const sheets = aggregateSheetsData(rows);
  const finalBalance = rows[rows.length - 1]?.balance || 0;
  
  // Get SAMS data
  const transactions = await getExistingTransactions(unitId);
  const waterBill = await getWaterBillData(unitId);
  const hoaDues = await getHoaDues(unitId);
  
  // Calculate SAMS totals
  const sams = {
    hoa_charges: hoaDues?.scheduledAmount ? (hoaDues.scheduledAmount * 6 / 100) : 0, // scheduledAmount is monthly, multiply by 6 for 2 quarters
    hoa_payments: transactions.filter(t => t.categoryName === '-Split-' || t.categoryId?.includes('hoa'))
      .reduce((sum, t) => sum + (t.amount / 100), 0),
    water_charges: waterBill ? (waterBill.waterCharge / 100) : 0, // Use waterCharge, not currentCharge (which includes lavado)
    water_payments: transactions.filter(t => 
      t.categoryName?.includes('agua') || t.categoryName?.includes('Water') || t.categoryName?.includes('Consumo'))
      .reduce((sum, t) => sum + (t.amount / 100), 0),
    penalties: waterBill ? (waterBill.penaltyAmount / 100) : 0,
    lavado: waterBill ? (waterBill.importedLavadoCharge / 100) : 0,
  };
  
  console.log('\n--- SHEETS Target vs SAMS Current ---');
  console.log('                      SHEETS       SAMS        DIFF');
  console.log('-'.repeat(60));
  
  const compare = (label, sheetsVal, samsVal) => {
    const diff = samsVal - sheetsVal;
    const status = Math.abs(diff) < 1 ? '✅' : Math.abs(diff) < 50 ? '~' : '❌';
    console.log(`${label.padEnd(20)} ${sheetsVal.toFixed(2).padStart(10)} ${samsVal.toFixed(2).padStart(10)} ${diff.toFixed(2).padStart(10)} ${status}`);
    return { label, sheets: sheetsVal, sams: samsVal, diff, status };
  };
  
  const comparisons = [
    compare('HOA Charges', sheets.hoa_charges, sams.hoa_charges),
    compare('HOA Payments', sheets.hoa_payments, sams.hoa_payments),
    compare('Water Charges', sheets.water_charges, sams.water_charges),
    compare('Water Payments', sheets.water_payments, sams.water_payments),
    compare('Penalties', sheets.penalties, sams.penalties),
    compare('Lavado', sheets.lavado, sams.lavado),
  ];
  
  console.log('-'.repeat(60));
  compare('TOTAL CHARGES', sheets.total_charges, 
    sams.hoa_charges + sams.water_charges + sams.penalties + sams.lavado);
  compare('TOTAL PAYMENTS', sheets.total_payments, 
    sams.hoa_payments + sams.water_payments);
  console.log('-'.repeat(60));
  compare('FINAL BALANCE', finalBalance, 
    (sams.hoa_charges + sams.water_charges + sams.penalties + sams.lavado) - 
    (sams.hoa_payments + sams.water_payments));
  
  // Show what needs to change
  console.log('\n--- Required Changes ---');
  const changes = [];
  
  for (const c of comparisons) {
    if (c.status !== '✅') {
      console.log(`  ${c.status} ${c.label}: SAMS has ${c.sams.toFixed(2)}, needs ${c.sheets.toFixed(2)} (diff: ${c.diff.toFixed(2)})`);
      changes.push(c);
    }
  }
  
  if (changes.length === 0) {
    console.log('  ✅ No changes needed - SAMS matches Sheets!');
  }
  
  // Show existing transactions
  console.log('\n--- Existing Transactions (' + transactions.length + ') ---');
  for (const tx of transactions.sort((a, b) => {
    const dateA = a.date?.toDate?.() || new Date(a.date);
    const dateB = b.date?.toDate?.() || new Date(b.date);
    return dateA - dateB;
  })) {
    const date = tx.date?.toDate?.() ? tx.date.toDate().toISOString().split('T')[0] : tx.date?.split('T')[0] || 'unknown';
    const amt = tx.amount / 100;
    console.log(`  ${date} | ${amt.toFixed(2).padStart(10)} | ${tx.categoryName?.substring(0, 25) || tx.id}`);
  }
  
  return {
    unitId,
    unitLabel: sheetsData.unitLabel,
    sheetsBalance: finalBalance,
    samsBalance: (sams.hoa_charges + sams.water_charges + sams.penalties + sams.lavado) - 
                 (sams.hoa_payments + sams.water_payments),
    changes: changes.length,
    matches: changes.length === 0
  };
}

/**
 * Main execution
 */
async function main() {
  const targetUnit = process.argv[2];
  
  console.log('═'.repeat(70));
  console.log('  SEED FROM SHEETS - COMPARISON ANALYSIS v3');
  console.log('  (Q1 only - Oct/Nov water consumption excluded)');
  console.log('═'.repeat(70));
  console.log(`\nClient: ${CLIENT_ID}`);
  console.log(`Sheets Data: ${SHEETS_DATA_PATH}`);
  console.log('Note: Q2 water charges excluded (Oct/Nov consumption)');
  
  // Load Sheets data
  const sheetsData = loadSheetsData();
  console.log(`Loaded ${Object.keys(sheetsData).length} unit files from Sheets`);
  
  // Analyze each unit
  const results = [];
  const unitsToProcess = targetUnit ? [targetUnit] : Object.keys(sheetsData).sort();
  
  for (const unitId of unitsToProcess) {
    if (!sheetsData[unitId]) {
      console.log(`\n⚠️  No Sheets data for unit ${unitId}`);
      continue;
    }
    
    const result = await analyzeUnit(unitId, sheetsData[unitId]);
    results.push(result);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('  SUMMARY');
  console.log('═'.repeat(70));
  
  console.log('\nUnit | Sheets Bal | SAMS Bal   | Diff       | Changes | Status');
  console.log('-'.repeat(70));
  for (const r of results) {
    const diff = r.samsBalance - r.sheetsBalance;
    const status = r.matches ? '✅ MATCH' : Math.abs(diff) < 50 ? '~ CLOSE' : '❌ DIFF';
    console.log(`${r.unitId.padEnd(4)} | ${r.sheetsBalance.toFixed(2).padStart(10)} | ${r.samsBalance.toFixed(2).padStart(10)} | ${diff.toFixed(2).padStart(10)} |    ${r.changes}    | ${status}`);
  }
  
  const matches = results.filter(r => r.matches).length;
  console.log('-'.repeat(70));
  console.log(`\n✅ Matching: ${matches}/${results.length} units`);
  console.log('\n✅ Dry run complete. No changes made.\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

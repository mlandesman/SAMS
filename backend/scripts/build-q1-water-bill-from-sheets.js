/**
 * Build Q1 Water Bill from Sheets unitAccounting Data
 * 
 * This script reads the unitAccounting data and builds the Q1 water bill
 * directly from those values instead of calculating from meter readings.
 * 
 * Usage:
 *   DRY RUN: node backend/scripts/build-q1-water-bill-from-sheets.js
 *   EXECUTE: node backend/scripts/build-q1-water-bill-from-sheets.js --execute
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

// Path to the unitAccounting JSON (exported from Sheets)
const UNIT_ACCOUNTING_PATH = '/Users/michael/Projects/SAMS-Docs/docs/AVII-Reconciliation/Sheets-Data/unitAccounting.json';

console.log('═'.repeat(70));
console.log('  BUILD Q1 WATER BILL FROM SHEETS DATA');
console.log('═'.repeat(70));
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ EXECUTE (making changes)'}`);
console.log('');

/**
 * Parse unit ID from department string like "101 (Zerbarini)"
 */
function parseUnitId(depto) {
  return depto.split(' ')[0];
}

/**
 * Parse consumption month from notes like "June Consumption"
 */
function parseConsumptionMonth(notes, fecha) {
  const notesLower = (notes || '').toLowerCase();
  
  if (notesLower.includes('june')) return '2025-06';
  if (notesLower.includes('july')) return '2025-07';
  if (notesLower.includes('august')) return '2025-08';
  if (notesLower.includes('september')) return '2025-09'; // Q2
  if (notesLower.includes('october')) return '2025-10'; // Q2
  if (notesLower.includes('november')) return '2025-11'; // Q2
  
  return null;
}

/**
 * Check if a date is in Q1 (before Oct 1, 2025)
 */
function isQ1Date(fecha) {
  const date = new Date(fecha);
  const q2Start = new Date('2025-10-01');
  return date < q2Start;
}

/**
 * Load and parse unitAccounting data
 */
function loadUnitAccounting() {
  const raw = fs.readFileSync(UNIT_ACCOUNTING_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * Build Q1 water bill data from unitAccounting
 */
function buildQ1WaterBill(unitAccounting) {
  const units = {};
  
  // Process water consumption entries
  for (const entry of unitAccounting) {
    const categoria = entry['Categoría'] || entry.Categoría || entry.category;
    const depto = entry['Depto'] || entry.Depto || entry.unit;
    const cantidad = entry['Cantidad'] || entry.Cantidad || entry.amount || 0;
    const notas = entry['Notas'] || entry.Notas || entry.notes || '';
    const fecha = entry['Fecha'] || entry.Fecha || entry.date;
    
    // Skip if not water consumption
    if (categoria !== 'Consumo de agua') continue;
    
    // Skip negative entries (paid from credit balance)
    if (cantidad < 0) continue;
    
    // Skip Q2 entries (Sep consumption onwards, dated Oct 1+)
    const month = parseConsumptionMonth(notas, fecha);
    if (!month || month >= '2025-09') continue;
    
    const unitId = parseUnitId(depto);
    
    if (!units[unitId]) {
      units[unitId] = {
        waterCharge: 0,
        penaltyAmount: 0,
        importedLavadoCharge: 0,
        monthlyBreakdown: {}
      };
    }
    
    // Add to monthly breakdown
    if (!units[unitId].monthlyBreakdown[month]) {
      units[unitId].monthlyBreakdown[month] = { waterCharge: 0 };
    }
    units[unitId].monthlyBreakdown[month].waterCharge += Math.round(cantidad * 100);
    units[unitId].waterCharge += Math.round(cantidad * 100);
  }
  
  // Process penalties (Q1 water penalties only)
  for (const entry of unitAccounting) {
    const categoria = entry['Categoría'] || entry.Categoría || entry.category;
    const depto = entry['Depto'] || entry.Depto || entry.unit;
    const cantidad = entry['Cantidad'] || entry.Cantidad || entry.amount || 0;
    const notas = entry['Notas'] || entry.Notas || entry.notes || '';
    const fecha = entry['Fecha'] || entry.Fecha || entry.date;
    
    // Skip if not penalty
    if (categoria !== 'Cargo por pago atrasado') continue;
    
    // Only include water consumption penalties (not HOA penalties)
    const notasLower = notas.toLowerCase();
    if (!notasLower.includes('consumption') && !notasLower.includes('consumo')) continue;
    
    // Skip Q2 penalties
    if (!isQ1Date(fecha)) continue;
    
    const unitId = parseUnitId(depto);
    
    if (!units[unitId]) {
      units[unitId] = {
        waterCharge: 0,
        penaltyAmount: 0,
        importedLavadoCharge: 0,
        monthlyBreakdown: {}
      };
    }
    
    units[unitId].penaltyAmount += Math.round(cantidad * 100);
  }
  
  // Process boat washes (Lavado de barcos) - NOT car washes
  for (const entry of unitAccounting) {
    const categoria = entry['Categoría'] || entry.Categoría || entry.category;
    const depto = entry['Depto'] || entry.Depto || entry.unit;
    const cantidad = entry['Cantidad'] || entry.Cantidad || entry.amount || 0;
    const fecha = entry['Fecha'] || entry.Fecha || entry.date;
    
    // Only boat washes (car washes are discontinued)
    if (categoria !== 'Lavado de barcos') continue;
    
    // Skip Q2
    if (!isQ1Date(fecha)) continue;
    
    const unitId = parseUnitId(depto);
    
    if (!units[unitId]) {
      units[unitId] = {
        waterCharge: 0,
        penaltyAmount: 0,
        importedLavadoCharge: 0,
        monthlyBreakdown: {}
      };
    }
    
    units[unitId].importedLavadoCharge += Math.round(cantidad * 100);
  }
  
  // Calculate currentCharge for each unit
  for (const unitId of Object.keys(units)) {
    const unit = units[unitId];
    unit.currentCharge = unit.waterCharge + unit.penaltyAmount + unit.importedLavadoCharge;
  }
  
  return units;
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('Loading unitAccounting data...');
    const unitAccounting = loadUnitAccounting();
    console.log(`Loaded ${unitAccounting.length} entries`);
    console.log('');
    
    console.log('Building Q1 water bill...');
    const units = buildQ1WaterBill(unitAccounting);
    console.log(`Built data for ${Object.keys(units).length} units`);
    console.log('');
    
    // Display what we built
    console.log('═'.repeat(70));
    console.log('  Q1 WATER BILL DATA');
    console.log('═'.repeat(70));
    console.log('');
    console.log('Unit | Water     | Penalties | Lavado    | Total');
    console.log('-'.repeat(60));
    
    for (const [unitId, data] of Object.entries(units).sort()) {
      const water = (data.waterCharge / 100).toFixed(2);
      const penalty = (data.penaltyAmount / 100).toFixed(2);
      const lavado = (data.importedLavadoCharge / 100).toFixed(2);
      const total = (data.currentCharge / 100).toFixed(2);
      console.log(`${unitId.padEnd(4)} | $${water.padStart(8)} | $${penalty.padStart(8)} | $${lavado.padStart(8)} | $${total.padStart(9)}`);
    }
    console.log('');
    
    // Show monthly breakdown for key units
    console.log('Monthly Breakdown:');
    for (const unitId of ['101', '106']) {
      if (units[unitId]) {
        console.log(`  Unit ${unitId}:`);
        for (const [month, data] of Object.entries(units[unitId].monthlyBreakdown).sort()) {
          console.log(`    ${month}: $${(data.waterCharge / 100).toFixed(2)}`);
        }
      }
    }
    console.log('');
    
    // Get existing Q1 bill for comparison
    const existingBillRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-Q1');
    
    const existingDoc = await existingBillRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : null;
    
    if (existingData) {
      console.log('═'.repeat(70));
      console.log('  COMPARISON: NEW vs EXISTING');
      console.log('═'.repeat(70));
      console.log('');
      console.log('Unit | New Water | Old Water | Diff');
      console.log('-'.repeat(50));
      
      for (const [unitId, newData] of Object.entries(units).sort()) {
        const oldData = existingData.bills?.units?.[unitId];
        const newWater = newData.waterCharge / 100;
        const oldWater = oldData ? oldData.waterCharge / 100 : 0;
        const diff = newWater - oldWater;
        const status = Math.abs(diff) < 0.01 ? '✅' : '❌';
        console.log(`${unitId.padEnd(4)} | $${newWater.toFixed(2).padStart(8)} | $${oldWater.toFixed(2).padStart(8)} | ${diff >= 0 ? '+' : ''}${diff.toFixed(2).padStart(8)} ${status}`);
      }
      console.log('');
    }
    
    // Build the full bill document
    const billDocument = {
      quarterId: '2026-Q1',
      fiscalYear: 2026,
      quarter: 1,
      clientId: CLIENT_ID,
      generatedAt: new Date().toISOString(),
      generatedFrom: 'sheets-unitAccounting',
      bills: {
        units: units
      }
    };
    
    if (DRY_RUN) {
      console.log('🔍 DRY RUN - No changes made');
      console.log('   Run with --execute to write the water bill');
    } else {
      console.log('Writing Q1 water bill to Firestore...');
      await existingBillRef.set(billDocument, { merge: true });
      console.log('✅ Q1 water bill written successfully');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

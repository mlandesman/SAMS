/**
 * Generate Statements of Account for All AVII Units
 * 
 * Compares SAMS Firestore data with unitAccounting.json (Sheets source of truth)
 * 
 * Usage: node backend/scripts/generate-all-statements.js
 */

import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const serviceAccountPath = new URL('../serviceAccountKey.json', import.meta.url);
const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const CLIENT_ID = 'AVII';

// Load unitAccounting.json for comparison
const unitAccountingPath = '/tmp/avii-import/unitAccounting.json';
const unitAccounting = JSON.parse(await readFile(unitAccountingPath, 'utf8'));
const records = unitAccounting.filter(r => r.Fecha && r.Depto);

function extractUnitId(depto) {
  const match = depto.match(/^(\d+)/);
  return match ? match[1] : depto;
}

function centavosToPesos(centavos) {
  return (centavos / 100).toFixed(2);
}

// Water categories
const WATER_CATEGORIES = ['Consumo de agua', 'Lavado de autos', 'Lavado de barcos'];

// Build Sheets data by unit
const sheetsByUnit = {};
for (const r of records) {
  const unitId = extractUnitId(r.Depto);
  if (!sheetsByUnit[unitId]) {
    sheetsByUnit[unitId] = { charges: [], totalCharged: 0, totalPaid: 0 };
  }
  
  if (WATER_CATEGORIES.includes(r.Categoría) && r.Cantidad > 0) {
    sheetsByUnit[unitId].charges.push({
      date: r.Fecha,
      category: r.Categoría,
      amount: r.Cantidad,
      isPaid: r['✓'] === true,
      notes: r.Notas
    });
    sheetsByUnit[unitId].totalCharged += r.Cantidad;
    if (r['✓']) {
      sheetsByUnit[unitId].totalPaid += r.Cantidad;
    }
  }
}

console.log('═'.repeat(80));
console.log('                    AVII WATER BILLS - STATEMENTS OF ACCOUNT');
console.log('                    Generated: ' + new Date().toISOString().split('T')[0]);
console.log('═'.repeat(80));

// Get all bills from Firestore
const billsRef = db.collection('clients').doc(CLIENT_ID)
  .collection('projects').doc('waterBills')
  .collection('bills');

const billDocs = await billsRef.get();
const samsBills = {};

for (const doc of billDocs.docs) {
  samsBills[doc.id] = doc.data();
}

// Get all units
const unitsRef = db.collection('clients').doc(CLIENT_ID).collection('units');
const unitDocs = await unitsRef.get();
const units = {};
for (const doc of unitDocs.docs) {
  units[doc.id] = doc.data();
}

// Sort unit IDs
const unitIds = Object.keys(units).sort((a, b) => {
  const numA = parseInt(a);
  const numB = parseInt(b);
  return numA - numB;
});

// Generate statement for each unit
for (const unitId of unitIds) {
  const unit = units[unitId];
  const ownerName = unit.ownerName || unit.owner || 'Unknown Owner';
  
  console.log('\n' + '─'.repeat(80));
  console.log(`📋 UNIT ${unitId} - ${ownerName}`);
  console.log('─'.repeat(80));
  
  // SAMS data from bills
  let samsTotal = 0;
  let samsPaid = 0;
  
  console.log('\n  SAMS FIRESTORE DATA:');
  console.log('  ' + '-'.repeat(70));
  
  for (const [billId, billData] of Object.entries(samsBills).sort()) {
    const unitBill = billData.bills?.units?.[unitId];
    if (unitBill) {
      const charged = unitBill.currentCharge || 0;
      const paid = unitBill.basePaid || unitBill.paidAmount || 0;
      const owed = charged - paid;
      
      samsTotal += charged;
      samsPaid += paid;
      
      const statusIcon = unitBill.status === 'paid' ? '✅' : 
                         unitBill.status === 'partial' ? '🟡' : '❌';
      
      console.log(`  ${billId}: $${centavosToPesos(charged)} charged, $${centavosToPesos(paid)} paid, $${centavosToPesos(owed)} owed ${statusIcon}`);
      
      // Show charge breakdown if available
      if (unitBill.waterCharge || unitBill.carWashCharge || unitBill.boatWashCharge) {
        const parts = [];
        if (unitBill.waterCharge) parts.push(`Water: $${centavosToPesos(unitBill.waterCharge)}`);
        if (unitBill.carWashCharge) parts.push(`CarWash: $${centavosToPesos(unitBill.carWashCharge)}`);
        if (unitBill.boatWashCharge) parts.push(`BoatWash: $${centavosToPesos(unitBill.boatWashCharge)}`);
        if (parts.length > 0) {
          console.log(`         (${parts.join(', ')})`);
        }
      }
    }
  }
  
  const samsOwed = samsTotal - samsPaid;
  console.log('  ' + '-'.repeat(70));
  console.log(`  SAMS TOTAL: $${centavosToPesos(samsTotal)} charged, $${centavosToPesos(samsPaid)} paid, $${centavosToPesos(samsOwed)} OWED`);
  
  // Sheets data
  const sheetsData = sheetsByUnit[unitId] || { charges: [], totalCharged: 0, totalPaid: 0 };
  const sheetsOwed = sheetsData.totalCharged - sheetsData.totalPaid;
  
  console.log('\n  SHEETS (unitAccounting.json):');
  console.log('  ' + '-'.repeat(70));
  
  // Group by quarter for display
  const chargesByQuarter = {};
  for (const c of sheetsData.charges) {
    const date = new Date(c.date);
    const month = date.getMonth();
    const year = date.getFullYear();
    let qKey;
    if (month >= 6 && month <= 8) qKey = `${year+1}-Q1`;
    else if (month >= 9) qKey = `${year+1}-Q2`;
    else if (month <= 2) qKey = `${year}-Q3`;
    else qKey = `${year}-Q4`;
    
    if (!chargesByQuarter[qKey]) chargesByQuarter[qKey] = [];
    chargesByQuarter[qKey].push(c);
  }
  
  for (const [qKey, charges] of Object.entries(chargesByQuarter).sort()) {
    let qCharged = 0, qPaid = 0;
    for (const c of charges) {
      qCharged += c.amount;
      if (c.isPaid) qPaid += c.amount;
    }
    const qOwed = qCharged - qPaid;
    const statusIcon = qOwed <= 0 ? '✅' : (qPaid > 0 ? '🟡' : '❌');
    console.log(`  ${qKey}: $${qCharged.toFixed(2)} charged, $${qPaid.toFixed(2)} paid, $${qOwed.toFixed(2)} owed ${statusIcon}`);
    
    // Show individual charges
    for (const c of charges.sort((a, b) => new Date(a.date) - new Date(b.date))) {
      const dateStr = new Date(c.date).toISOString().split('T')[0];
      const paidIcon = c.isPaid ? '✓' : '○';
      console.log(`         ${paidIcon} ${dateStr}: $${c.amount.toFixed(2)} - ${c.notes || c.category}`);
    }
  }
  
  console.log('  ' + '-'.repeat(70));
  console.log(`  SHEETS TOTAL: $${sheetsData.totalCharged.toFixed(2)} charged, $${sheetsData.totalPaid.toFixed(2)} paid, $${sheetsOwed.toFixed(2)} OWED`);
  
  // Comparison
  console.log('\n  📊 COMPARISON:');
  console.log('  ' + '-'.repeat(70));
  
  const chargedDiff = (samsTotal / 100) - sheetsData.totalCharged;
  const paidDiff = (samsPaid / 100) - sheetsData.totalPaid;
  const owedDiff = (samsOwed / 100) - sheetsOwed;
  
  const matchIcon = Math.abs(owedDiff) < 0.01 ? '✅ MATCH' : '❌ MISMATCH';
  
  console.log(`  ┌────────────────┬────────────────┬────────────────┬────────────────┐`);
  console.log(`  │ Source         │ Charged        │ Paid           │ Owed           │`);
  console.log(`  ├────────────────┼────────────────┼────────────────┼────────────────┤`);
  console.log(`  │ SAMS           │ $${centavosToPesos(samsTotal).padStart(12)} │ $${centavosToPesos(samsPaid).padStart(12)} │ $${centavosToPesos(samsOwed).padStart(12)} │`);
  console.log(`  │ SHEETS         │ $${sheetsData.totalCharged.toFixed(2).padStart(12)} │ $${sheetsData.totalPaid.toFixed(2).padStart(12)} │ $${sheetsOwed.toFixed(2).padStart(12)} │`);
  console.log(`  ├────────────────┼────────────────┼────────────────┼────────────────┤`);
  console.log(`  │ DIFFERENCE     │ $${chargedDiff.toFixed(2).padStart(12)} │ $${paidDiff.toFixed(2).padStart(12)} │ $${owedDiff.toFixed(2).padStart(12)} │`);
  console.log(`  └────────────────┴────────────────┴────────────────┴────────────────┘`);
  console.log(`  ${matchIcon}`);
}

// Grand Total Summary
console.log('\n' + '═'.repeat(80));
console.log('                              GRAND TOTAL SUMMARY');
console.log('═'.repeat(80));

let grandSamsTotal = 0, grandSamsPaid = 0;
let grandSheetsTotal = 0, grandSheetsPaid = 0;

for (const unitId of unitIds) {
  // SAMS
  for (const [billId, billData] of Object.entries(samsBills)) {
    const unitBill = billData.bills?.units?.[unitId];
    if (unitBill) {
      grandSamsTotal += unitBill.currentCharge || 0;
      grandSamsPaid += unitBill.basePaid || unitBill.paidAmount || 0;
    }
  }
  
  // Sheets
  const sheetsData = sheetsByUnit[unitId];
  if (sheetsData) {
    grandSheetsTotal += sheetsData.totalCharged;
    grandSheetsPaid += sheetsData.totalPaid;
  }
}

const grandSamsOwed = grandSamsTotal - grandSamsPaid;
const grandSheetsOwed = grandSheetsTotal - grandSheetsPaid;
const grandOwedDiff = (grandSamsOwed / 100) - grandSheetsOwed;

console.log(`\n┌────────────────┬────────────────┬────────────────┬────────────────┐`);
console.log(`│ Source         │ Charged        │ Paid           │ Owed           │`);
console.log(`├────────────────┼────────────────┼────────────────┼────────────────┤`);
console.log(`│ SAMS           │ $${centavosToPesos(grandSamsTotal).padStart(12)} │ $${centavosToPesos(grandSamsPaid).padStart(12)} │ $${centavosToPesos(grandSamsOwed).padStart(12)} │`);
console.log(`│ SHEETS         │ $${grandSheetsTotal.toFixed(2).padStart(12)} │ $${grandSheetsPaid.toFixed(2).padStart(12)} │ $${grandSheetsOwed.toFixed(2).padStart(12)} │`);
console.log(`├────────────────┼────────────────┼────────────────┼────────────────┤`);
console.log(`│ DIFFERENCE     │ $${((grandSamsTotal/100) - grandSheetsTotal).toFixed(2).padStart(12)} │ $${((grandSamsPaid/100) - grandSheetsPaid).toFixed(2).padStart(12)} │ $${grandOwedDiff.toFixed(2).padStart(12)} │`);
console.log(`└────────────────┴────────────────┴────────────────┴────────────────┘`);

const allMatch = Math.abs(grandOwedDiff) < 0.01;
console.log(`\n${allMatch ? '✅ ALL UNITS MATCH!' : '❌ DISCREPANCIES FOUND'}`);

console.log('\n' + '═'.repeat(80));
process.exit(0);

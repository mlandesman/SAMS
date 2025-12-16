/**
 * Reconcile Water Bills from unitAccounting.json
 * 
 * This script updates SAMS water bills to match the actual charges
 * and payment status from the Sheets unitAccounting.json file.
 * 
 * Usage: 
 *   DRY RUN (default): node backend/scripts/reconcile-water-bills-from-accounting.js
 *   APPLY CHANGES:     node backend/scripts/reconcile-water-bills-from-accounting.js --apply
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
const DRY_RUN = !process.argv.includes('--apply');

// Load unitAccounting.json
const unitAccountingPath = '/tmp/avii-import/unitAccounting.json';
const unitAccounting = JSON.parse(await readFile(unitAccountingPath, 'utf8'));

// Filter out empty rows
const records = unitAccounting.filter(r => r.Fecha && r.Depto);

function extractUnitId(depto) {
  const match = depto.match(/^(\d+)/);
  return match ? match[1] : depto;
}

function pesosToCentavos(pesos) {
  return Math.round(pesos * 100);
}

function centavosToPesos(centavos) {
  return (centavos / 100).toFixed(2);
}

// Water-related categories
const WATER_CATEGORIES = [
  'Consumo de agua',
  'Lavado de autos',
  'Lavado de barcos',
];

console.log('🔧 Reconcile Water Bills from unitAccounting.json');
console.log('=' .repeat(70));
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '⚠️  APPLYING CHANGES'}`);
console.log('=' .repeat(70));

// Get fiscal quarter from date
function getFiscalQuarter(dateStr) {
  const date = new Date(dateStr);
  const month = date.getMonth();
  const year = date.getFullYear();
  
  let fiscalYear, fiscalQuarter;
  
  if (month >= 6) {
    fiscalYear = year + 1;
    fiscalQuarter = month <= 8 ? 1 : 2;
  } else {
    fiscalYear = year;
    fiscalQuarter = month <= 2 ? 3 : 4;
  }
  
  return { fiscalYear, fiscalQuarter, billId: `${fiscalYear}-Q${fiscalQuarter}` };
}

// Build bills from unitAccounting
const waterCharges = records.filter(r => WATER_CATEGORIES.includes(r.Categoría));
const billsByUnitAndQuarter = {};

for (const charge of waterCharges) {
  const unitId = extractUnitId(charge.Depto);
  const { billId, fiscalYear, fiscalQuarter } = getFiscalQuarter(charge.Fecha);
  
  const key = `${unitId}-${billId}`;
  
  if (!billsByUnitAndQuarter[key]) {
    billsByUnitAndQuarter[key] = {
      unitId,
      billId,
      fiscalYear,
      fiscalQuarter,
      waterCharge: 0,
      carWashCharge: 0,
      boatWashCharge: 0,
      totalCharged: 0,
      totalPaid: 0,
      charges: []
    };
  }
  
  const amount = charge.Cantidad;
  const isPaid = charge['✓'] === true;
  
  // Only process positive amounts
  if (amount > 0) {
    billsByUnitAndQuarter[key].totalCharged += amount;
    if (isPaid) {
      billsByUnitAndQuarter[key].totalPaid += amount;
    }
    
    if (charge.Categoría === 'Consumo de agua') {
      billsByUnitAndQuarter[key].waterCharge += amount;
    } else if (charge.Categoría === 'Lavado de autos') {
      billsByUnitAndQuarter[key].carWashCharge += amount;
    } else if (charge.Categoría === 'Lavado de barcos') {
      billsByUnitAndQuarter[key].boatWashCharge += amount;
    }
    
    billsByUnitAndQuarter[key].charges.push({
      date: charge.Fecha,
      category: charge.Categoría,
      amount: amount,
      isPaid: isPaid,
      notes: charge.Notas
    });
  }
}

// Group by quarter
const byQuarter = {};
for (const [key, bill] of Object.entries(billsByUnitAndQuarter)) {
  if (!byQuarter[bill.billId]) {
    byQuarter[bill.billId] = { 
      fiscalYear: bill.fiscalYear, 
      fiscalQuarter: bill.fiscalQuarter,
      units: {} 
    };
  }
  byQuarter[bill.billId].units[bill.unitId] = bill;
}

// Process each quarter
for (const [billId, quarterData] of Object.entries(byQuarter).sort()) {
  console.log(`\n📄 Processing ${billId}...`);
  
  // Get existing bill document
  const billRef = db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills').doc(billId);
  
  const existingDoc = await billRef.get();
  const existingData = existingDoc.exists ? existingDoc.data() : null;
  
  // Build new bill data
  const unitsData = {};
  let totalNewCharges = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;
  
  for (const [unitId, unitBill] of Object.entries(quarterData.units)) {
    const currentCharge = pesosToCentavos(unitBill.totalCharged);
    const basePaid = pesosToCentavos(unitBill.totalPaid);
    const unpaidAmount = currentCharge - basePaid;
    
    const status = unpaidAmount <= 0 ? 'paid' : (basePaid > 0 ? 'partial' : 'unpaid');
    
    // Get existing consumption data if available
    const existingUnit = existingData?.bills?.units?.[unitId];
    const consumption = existingUnit?.totalConsumption || existingUnit?.consumption || 0;
    
    unitsData[unitId] = {
      // Keep consumption from meter readings
      totalConsumption: consumption,
      
      // Charge breakdown from unitAccounting (in centavos)
      waterCharge: pesosToCentavos(unitBill.waterCharge),
      carWashCharge: pesosToCentavos(unitBill.carWashCharge),
      boatWashCharge: pesosToCentavos(unitBill.boatWashCharge),
      
      // Totals (in centavos)
      currentCharge: currentCharge,
      penaltyAmount: 0,
      totalAmount: currentCharge,
      
      // Payment status from unitAccounting
      paidAmount: basePaid,
      basePaid: basePaid,
      penaltyPaid: 0,
      
      // Status
      status: status,
      
      // Preserve existing payment records if any
      payments: existingUnit?.payments || [],
      
      // Track source
      lastPenaltyUpdate: new Date().toISOString(),
    };
    
    totalNewCharges += currentCharge;
    totalPaid += basePaid;
    totalUnpaid += unpaidAmount;
    
    // Log unit changes
    const existingCharge = existingUnit?.currentCharge || 0;
    const existingPaid = existingUnit?.basePaid || 0;
    const chargeChange = currentCharge - existingCharge;
    const paidChange = basePaid - existingPaid;
    
    if (chargeChange !== 0 || paidChange !== 0 || !existingUnit) {
      console.log(`   Unit ${unitId}: charge ${existingCharge/100} → ${currentCharge/100} (${chargeChange >= 0 ? '+' : ''}${chargeChange/100}), paid ${existingPaid/100} → ${basePaid/100}, status: ${status}`);
    }
  }
  
  // Calculate bill dates based on quarter
  const quarterStartMonth = (quarterData.fiscalQuarter - 1) * 3 + 6; // Q1=6 (Jul), Q2=9 (Oct), etc.
  const billYear = quarterStartMonth >= 6 ? quarterData.fiscalYear - 1 : quarterData.fiscalYear;
  const billMonth = quarterStartMonth % 12;
  const billDate = new Date(billYear, billMonth, 1);
  
  // Due date is start of next quarter
  const dueDate = new Date(billDate);
  dueDate.setMonth(dueDate.getMonth() + 3);
  
  const billDocument = {
    billDate: billDate.toISOString(),
    dueDate: dueDate.toISOString(),
    penaltyStartDate: new Date(dueDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    billingPeriod: 'quarterly',
    fiscalYear: quarterData.fiscalYear,
    fiscalQuarter: quarterData.fiscalQuarter,
    configSnapshot: {
      ratePerM3: 5000,
      penaltyRate: 0.05,
      penaltyDays: 30,
      currency: 'MXN',
      currencySymbol: '$',
      rateCarWash: 10000,
      rateBoatWash: 20000,
    },
    bills: {
      units: unitsData
    },
    summary: {
      totalUnits: Object.keys(unitsData).length,
      totalNewCharges: totalNewCharges,
      totalBilled: totalNewCharges,
      totalPaid: totalPaid,
      totalUnpaid: totalUnpaid,
      currency: 'MXN',
      currencySymbol: '$'
    },
    metadata: {
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      generatedBy: 'reconcile-from-unitAccounting',
      source: 'unitAccounting.json',
      reconciliationDate: new Date().toISOString()
    }
  };
  
  console.log(`   Summary: ${Object.keys(unitsData).length} units, $${centavosToPesos(totalNewCharges)} charged, $${centavosToPesos(totalPaid)} paid, $${centavosToPesos(totalUnpaid)} owed`);
  
  if (!DRY_RUN) {
    await billRef.set(billDocument);
    console.log(`   ✅ Saved ${billId}`);
  } else {
    console.log(`   📋 Would save ${billId} (dry run)`);
  }
}

// Summary
console.log('\n' + '=' .repeat(70));
console.log('📊 RECONCILIATION SUMMARY');
console.log('=' .repeat(70));

// Unit 101 final state
const unit101Q1 = billsByUnitAndQuarter['101-2026-Q1'];
const unit101Q2 = billsByUnitAndQuarter['101-2026-Q2'];

console.log('\nUnit 101 after reconciliation:');
if (unit101Q1) {
  const owed = unit101Q1.totalCharged - unit101Q1.totalPaid;
  console.log(`  Q1: $${unit101Q1.totalCharged.toFixed(2)} charged, $${unit101Q1.totalPaid.toFixed(2)} paid, $${owed.toFixed(2)} owed`);
}
if (unit101Q2) {
  const owed = unit101Q2.totalCharged - unit101Q2.totalPaid;
  console.log(`  Q2: $${unit101Q2.totalCharged.toFixed(2)} charged, $${unit101Q2.totalPaid.toFixed(2)} paid, $${owed.toFixed(2)} owed`);
}

const totalOwed = ((unit101Q1?.totalCharged || 0) - (unit101Q1?.totalPaid || 0)) + 
                  ((unit101Q2?.totalCharged || 0) - (unit101Q2?.totalPaid || 0));
console.log(`  TOTAL OWED: $${totalOwed.toFixed(2)}`);
console.log(`  EXPECTED (Sheets): $800.00`);
console.log(`  MATCH: ${Math.abs(totalOwed - 800) < 0.01 ? '✅ YES' : '❌ NO'}`);

if (DRY_RUN) {
  console.log('\n⚠️  This was a DRY RUN. To apply changes, run with --apply flag:');
  console.log('   node backend/scripts/reconcile-water-bills-from-accounting.js --apply');
}

console.log('\n' + '=' .repeat(70));
process.exit(0);

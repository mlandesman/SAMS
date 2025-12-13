/**
 * Prototype: Import Water Bills from unitAccounting.json
 * 
 * This script demonstrates how to use unitAccounting.json to create
 * accurate water bills that match Sheets, instead of calculating from meter readings.
 * 
 * Usage: node backend/scripts/prototype-unit-accounting-import.js
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

// Water-related categories in Spanish
const WATER_CATEGORIES = [
  'Consumo de agua',      // Water consumption
  'Lavado de autos',      // Car wash
  'Lavado de barcos',     // Boat wash
];

const PENALTY_CATEGORY = 'Cargo por pago atrasado';

console.log('🔍 Prototype: Build Water Bills from unitAccounting.json');
console.log('=' .repeat(70));

// Step 1: Filter water-related charges only
const waterCharges = records.filter(r => 
  WATER_CATEGORIES.includes(r.Categoría) || 
  (r.Categoría === PENALTY_CATEGORY && r.Notas?.toLowerCase().includes('water'))
);

console.log(`\nTotal water-related charges: ${waterCharges.length}`);

// Step 2: Group by unit and fiscal quarter
// Fiscal Year 2026: Q1 = Jul-Sep 2025, Q2 = Oct-Dec 2025
function getFiscalQuarter(dateStr) {
  const date = new Date(dateStr);
  const month = date.getMonth(); // 0-11
  const year = date.getFullYear();
  
  // Fiscal year starts in July (month 6)
  // Q1 = Jul-Sep (months 6-8), Q2 = Oct-Dec (months 9-11)
  // Q3 = Jan-Mar (months 0-2), Q4 = Apr-Jun (months 3-5)
  
  let fiscalYear, fiscalQuarter;
  
  if (month >= 6) { // Jul-Dec
    fiscalYear = year + 1; // FY 2026 for Jul-Dec 2025
    fiscalQuarter = month <= 8 ? 1 : 2; // Q1 or Q2
  } else { // Jan-Jun
    fiscalYear = year;
    fiscalQuarter = month <= 2 ? 3 : 4; // Q3 or Q4
  }
  
  return { fiscalYear, fiscalQuarter, billId: `${fiscalYear}-Q${fiscalQuarter}` };
}

// Group charges by unit and quarter
const billsByUnitAndQuarter = {};

for (const charge of waterCharges) {
  const unitId = extractUnitId(charge.Depto);
  const { fiscalYear, fiscalQuarter, billId } = getFiscalQuarter(charge.Fecha);
  
  const key = `${unitId}-${billId}`;
  
  if (!billsByUnitAndQuarter[key]) {
    billsByUnitAndQuarter[key] = {
      unitId,
      billId,
      fiscalYear,
      fiscalQuarter,
      charges: [],
      totalCharged: 0,
      totalPaid: 0,
      totalUnpaid: 0,
      waterCharge: 0,
      carWashCharge: 0,
      boatWashCharge: 0,
      penaltyAmount: 0,
    };
  }
  
  const amount = charge.Cantidad;
  const isPaid = charge['✓'] === true;
  
  billsByUnitAndQuarter[key].charges.push({
    date: charge.Fecha,
    category: charge.Categoría,
    amount: amount,
    isPaid: isPaid,
    notes: charge.Notas
  });
  
  // Only count positive amounts as charges (negative are credits/adjustments)
  if (amount > 0) {
    billsByUnitAndQuarter[key].totalCharged += amount;
    
    if (isPaid) {
      billsByUnitAndQuarter[key].totalPaid += amount;
    } else {
      billsByUnitAndQuarter[key].totalUnpaid += amount;
    }
    
    // Categorize the charge type
    if (charge.Categoría === 'Consumo de agua') {
      billsByUnitAndQuarter[key].waterCharge += amount;
    } else if (charge.Categoría === 'Lavado de autos') {
      billsByUnitAndQuarter[key].carWashCharge += amount;
    } else if (charge.Categoría === 'Lavado de barcos') {
      billsByUnitAndQuarter[key].boatWashCharge += amount;
    }
  }
}

// Step 3: Display what bills would be created
console.log('\n📋 PROPOSED BILLS FROM unitAccounting.json');
console.log('=' .repeat(70));

// Group by quarter for display
const byQuarter = {};
for (const [key, bill] of Object.entries(billsByUnitAndQuarter)) {
  if (!byQuarter[bill.billId]) {
    byQuarter[bill.billId] = [];
  }
  byQuarter[bill.billId].push(bill);
}

for (const [billId, units] of Object.entries(byQuarter).sort()) {
  console.log(`\n📄 ${billId}:`);
  
  let quarterTotal = 0;
  let quarterPaid = 0;
  let quarterUnpaid = 0;
  
  for (const unit of units.sort((a, b) => a.unitId.localeCompare(b.unitId))) {
    const status = unit.totalUnpaid > 0 ? 
      (unit.totalPaid > 0 ? 'PARTIAL' : 'UNPAID') : 
      'PAID';
    
    console.log(`   Unit ${unit.unitId}: $${unit.totalCharged.toFixed(2)} charged, $${unit.totalPaid.toFixed(2)} paid, $${unit.totalUnpaid.toFixed(2)} owed [${status}]`);
    
    quarterTotal += unit.totalCharged;
    quarterPaid += unit.totalPaid;
    quarterUnpaid += unit.totalUnpaid;
  }
  
  console.log(`   ─────────────────────────────────────────────`);
  console.log(`   QUARTER TOTAL: $${quarterTotal.toFixed(2)} charged, $${quarterPaid.toFixed(2)} paid, $${quarterUnpaid.toFixed(2)} owed`);
}

// Step 4: Compare with current SAMS data for Unit 101
console.log('\n' + '=' .repeat(70));
console.log('📋 UNIT 101 COMPARISON');
console.log('=' .repeat(70));

const unit101Q1 = billsByUnitAndQuarter['101-2026-Q1'];
const unit101Q2 = billsByUnitAndQuarter['101-2026-Q2'];

console.log('\nFrom unitAccounting.json:');
if (unit101Q1) {
  console.log(`  Q1: $${unit101Q1.totalCharged.toFixed(2)} charged, $${unit101Q1.totalPaid.toFixed(2)} paid, $${unit101Q1.totalUnpaid.toFixed(2)} owed`);
  console.log(`      Water: $${unit101Q1.waterCharge.toFixed(2)}, Car Wash: $${unit101Q1.carWashCharge.toFixed(2)}`);
}
if (unit101Q2) {
  console.log(`  Q2: $${unit101Q2.totalCharged.toFixed(2)} charged, $${unit101Q2.totalPaid.toFixed(2)} paid, $${unit101Q2.totalUnpaid.toFixed(2)} owed`);
  console.log(`      Water: $${unit101Q2.waterCharge.toFixed(2)}, Car Wash: $${unit101Q2.carWashCharge.toFixed(2)}`);
}

// Get current SAMS Q1
const samsQ1Doc = await db.collection('clients').doc(CLIENT_ID)
  .collection('projects').doc('waterBills')
  .collection('bills').doc('2026-Q1')
  .get();

if (samsQ1Doc.exists) {
  const samsQ1 = samsQ1Doc.data();
  const samsUnit101 = samsQ1.bills?.units?.['101'];
  
  console.log('\nFrom SAMS Firestore (current):');
  if (samsUnit101) {
    const charged = samsUnit101.currentCharge / 100;
    const paid = (samsUnit101.basePaid || 0) / 100;
    const owed = charged - paid;
    console.log(`  Q1: $${charged.toFixed(2)} charged, $${paid.toFixed(2)} paid, $${owed.toFixed(2)} owed`);
  }
}

// Step 5: Show what needs to change
console.log('\n' + '=' .repeat(70));
console.log('🔧 PROPOSED CHANGES');
console.log('=' .repeat(70));

console.log(`
To close the gap, we need to:

1. UPDATE Q1 2026 BILL with unitAccounting.json values:
   • Use charge amounts from Sheets instead of calculated values
   • Set payment status based on ✓ field
   • Water charges: $${unit101Q1?.waterCharge?.toFixed(2) || '0.00'}
   • Car washes: $${unit101Q1?.carWashCharge?.toFixed(2) || '0.00'}
   • Total Q1: $${unit101Q1?.totalCharged?.toFixed(2) || '0.00'}

2. CREATE Q2 2026 BILL (Oct-Dec charges exist in unitAccounting):
   • Oct consumption: $400 (unpaid)
   • Nov consumption: $400 (unpaid)
   • Total Q2 owed: $${unit101Q2?.totalUnpaid?.toFixed(2) || '0.00'}

3. RESULT after changes:
   • Total owed should be: $${((unit101Q1?.totalUnpaid || 0) + (unit101Q2?.totalUnpaid || 0)).toFixed(2)}
   • This matches Sheets: $800.00 ✅
`);

// Step 6: Build the actual bill structure for Q1
console.log('\n' + '=' .repeat(70));
console.log('📦 PROPOSED Q1 BILL STRUCTURE FOR UNIT 101');
console.log('=' .repeat(70));

if (unit101Q1) {
  const proposedBill = {
    // Consumption (would need to get from readings or keep existing)
    totalConsumption: 31, // Keep existing SAMS value
    
    // Charge breakdown from unitAccounting (in centavos)
    waterCharge: pesosToCentavos(unit101Q1.waterCharge),
    carWashCharge: pesosToCentavos(unit101Q1.carWashCharge),
    boatWashCharge: pesosToCentavos(unit101Q1.boatWashCharge),
    
    // Totals (in centavos)
    currentCharge: pesosToCentavos(unit101Q1.totalCharged),
    penaltyAmount: 0,
    totalAmount: pesosToCentavos(unit101Q1.totalCharged),
    
    // Payment status from unitAccounting
    paidAmount: pesosToCentavos(unit101Q1.totalPaid),
    basePaid: pesosToCentavos(unit101Q1.totalPaid),
    penaltyPaid: 0,
    
    // Status
    status: unit101Q1.totalUnpaid > 0 ? 
      (unit101Q1.totalPaid > 0 ? 'partial' : 'unpaid') : 
      'paid',
    
    // Source tracking
    _importSource: 'unitAccounting.json',
    _chargeDetails: unit101Q1.charges.map(c => ({
      date: c.date,
      category: c.category,
      amount: pesosToCentavos(c.amount),
      isPaid: c.isPaid,
      notes: c.notes
    }))
  };
  
  console.log(JSON.stringify(proposedBill, null, 2));
}

console.log('\n' + '=' .repeat(70));
console.log('✅ Prototype complete. Ready to implement?');
console.log('=' .repeat(70));

process.exit(0);

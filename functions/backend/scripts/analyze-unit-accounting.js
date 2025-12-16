/**
 * Analyze unitAccounting.json - Compare Sheets charges with SAMS
 * 
 * This is the SOURCE OF TRUTH for what SAMS should show
 */

import { readFile } from 'fs/promises';

const data = JSON.parse(await readFile('/tmp/avii-import/unitAccounting.json', 'utf8'));

// Filter out empty rows
const records = data.filter(r => r.Fecha && r.Depto);

console.log('🔍 Unit Accounting Analysis');
console.log('=' .repeat(70));
console.log(`Total records: ${records.length}`);

// Extract unit ID from "Depto" field (e.g., "101 (Zerbarini)" -> "101")
function extractUnitId(depto) {
  const match = depto.match(/^(\d+)/);
  return match ? match[1] : depto;
}

// Group by unit
const byUnit = {};
for (const r of records) {
  const unitId = extractUnitId(r.Depto);
  if (!byUnit[unitId]) {
    byUnit[unitId] = [];
  }
  byUnit[unitId].push(r);
}

console.log(`\nUnits found: ${Object.keys(byUnit).sort().join(', ')}`);

// Analyze Unit 101
console.log('\n' + '=' .repeat(70));
console.log('📋 UNIT 101 DETAILED ANALYSIS');
console.log('=' .repeat(70));

const unit101 = byUnit['101'] || [];

// Categorize records
const waterCharges = unit101.filter(r => r.Categoría === 'Consumo de agua');
const carWashes = unit101.filter(r => r.Categoría === 'Lavado de autos');
const maintenance = unit101.filter(r => r.Categoría === 'Mantenimiento trimestral');
const penalties = unit101.filter(r => r.Categoría === 'Cargo por pago atrasado');

console.log('\n📊 Water Charges (Consumo de agua):');
console.log('-'.repeat(50));
let totalWaterCharged = 0;
let totalWaterPaid = 0;
let totalWaterUnpaid = 0;

for (const r of waterCharges.sort((a, b) => new Date(a.Fecha) - new Date(b.Fecha))) {
  const status = r['✓'] ? '✅ PAID' : '❌ UNPAID';
  const date = new Date(r.Fecha).toISOString().split('T')[0];
  console.log(`  ${date}: $${r.Cantidad.toFixed(2)} - ${status} - ${r.Notas}`);
  
  totalWaterCharged += r.Cantidad;
  if (r['✓']) {
    totalWaterPaid += r.Cantidad;
  } else {
    totalWaterUnpaid += r.Cantidad;
  }
}

console.log(`\n  TOTAL WATER: $${totalWaterCharged.toFixed(2)}`);
console.log(`  PAID:        $${totalWaterPaid.toFixed(2)}`);
console.log(`  UNPAID:      $${totalWaterUnpaid.toFixed(2)}`);

console.log('\n📊 Car Washes (Lavado de autos):');
console.log('-'.repeat(50));
let totalCarWash = 0;
for (const r of carWashes.sort((a, b) => new Date(a.Fecha) - new Date(b.Fecha))) {
  const status = r['✓'] ? '✅ PAID' : '❌ UNPAID';
  const date = new Date(r.Fecha).toISOString().split('T')[0];
  console.log(`  ${date}: $${r.Cantidad.toFixed(2)} - ${status} - ${r.Notas}`);
  totalCarWash += r.Cantidad;
}
console.log(`  TOTAL CAR WASH: $${totalCarWash.toFixed(2)}`);

console.log('\n📊 HOA Maintenance (Mantenimiento trimestral):');
console.log('-'.repeat(50));
for (const r of maintenance.sort((a, b) => new Date(a.Fecha) - new Date(b.Fecha))) {
  const status = r['✓'] ? '✅ PAID' : '❌ UNPAID';
  const date = new Date(r.Fecha).toISOString().split('T')[0];
  console.log(`  ${date}: $${r.Cantidad.toFixed(2)} - ${status} - ${r.Notas}`);
}

// Summary comparison
console.log('\n' + '=' .repeat(70));
console.log('📋 COMPARISON: Sheets vs SAMS');
console.log('=' .repeat(70));

console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│                    UNIT 101 - WATER BILLS                           │
├─────────────────────────────────────────────────────────────────────┤
│ SOURCE                      │ CHARGED     │ PAID       │ OWED       │
├─────────────────────────────┼─────────────┼────────────┼────────────┤
│ SHEETS (unitAccounting)     │ $${totalWaterCharged.toFixed(2).padStart(8)} │ $${totalWaterPaid.toFixed(2).padStart(8)} │ $${totalWaterUnpaid.toFixed(2).padStart(8)} │
│ SAMS Q1 (Firestore)         │ $1,550.00   │ $960.27    │ $589.73    │
├─────────────────────────────┼─────────────┼────────────┼────────────┤
│ DISCREPANCY                 │ $${(totalWaterCharged - 1550).toFixed(2).padStart(8)} │ $${(totalWaterPaid - 960.27).toFixed(2).padStart(8)} │ $${(totalWaterUnpaid - 589.73).toFixed(2).padStart(8)} │
└─────────────────────────────────────────────────────────────────────┘
`);

// Show what's unpaid in detail
console.log('\n📋 UNPAID WATER CHARGES (from Sheets):');
console.log('-'.repeat(50));
const unpaidWater = waterCharges.filter(r => !r['✓']);
for (const r of unpaidWater) {
  const date = new Date(r.Fecha).toISOString().split('T')[0];
  console.log(`  ${date}: $${r.Cantidad.toFixed(2)} - ${r.Notas}`);
}
console.log(`\n  TOTAL UNPAID: $${totalWaterUnpaid.toFixed(2)}`);

// Root cause
console.log('\n' + '=' .repeat(70));
console.log('🔴 ROOT CAUSE ANALYSIS');
console.log('=' .repeat(70));

console.log(`
KEY FINDINGS:

1. SHEETS CHARGE AMOUNTS ≠ SAMS CALCULATED AMOUNTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • Sheets has MANUALLY ENTERED charge amounts
   • SAMS CALCULATES from meter readings × $50/m³
   • These don't match!

   Example for Unit 101:
   • Sheets June water charge: $900
   • SAMS would calculate: ~18 m³ × $50 = $900 ✓ (happens to match)
   • But August: Sheets says $60.27, SAMS would calculate: 6 m³ × $50 = $300

2. SHEETS IS SOURCE OF TRUTH
   ━━━━━━━━━━━━━━━━━━━━━━━━━━
   • unitAccounting.json has the ACTUAL charges
   • The ✓ field shows payment status
   • SAMS should IMPORT these charges, not calculate them

3. HOW TO USE THIS FILE
   ━━━━━━━━━━━━━━━━━━━━━━
   • Filter by Categoría = "Consumo de agua" for water charges
   • Use ✓ = true/false for paid/unpaid status
   • Group by fiscal quarter for quarterly billing
   • Replace the calculated bill amounts with these values

4. CAR WASHES ARE SEPARATE
   ━━━━━━━━━━━━━━━━━━━━━━━
   • "Lavado de autos" charges should be added to water bills
   • Currently SAMS gets these from meter readings (washes array)
   • But Sheets has the actual charge amounts
`);

// Show all units summary
console.log('\n' + '=' .repeat(70));
console.log('📋 ALL UNITS - UNPAID WATER SUMMARY');
console.log('=' .repeat(70));

for (const unitId of Object.keys(byUnit).sort()) {
  const unitRecords = byUnit[unitId];
  const waterRecords = unitRecords.filter(r => r.Categoría === 'Consumo de agua');
  const unpaid = waterRecords.filter(r => !r['✓']);
  const unpaidTotal = unpaid.reduce((sum, r) => sum + r.Cantidad, 0);
  
  if (unpaidTotal > 0) {
    console.log(`\n  Unit ${unitId}: $${unpaidTotal.toFixed(2)} unpaid water`);
    for (const r of unpaid) {
      console.log(`    - ${r.Notas}: $${r.Cantidad.toFixed(2)}`);
    }
  }
}

console.log('\n' + '=' .repeat(70));

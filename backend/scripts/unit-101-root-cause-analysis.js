/**
 * Unit 101 Root Cause Analysis - Complete comparison
 * 
 * Compares source Sheets data with SAMS Firestore data
 */

console.log('🔍 UNIT 101 ROOT CAUSE ANALYSIS');
console.log('=' .repeat(70));

// ========================================
// SOURCE DATA FROM SHEETS (waterCrossRef.json)
// ========================================
console.log('\n📋 SOURCE: waterCrossRef.json (Sheets Data)');
console.log('-'.repeat(50));

const sheetsPayments = [
  // PAY-101 (Zerbarini)-20250717-25
  { paySeq: 'PAY-101-20250717-25', chargeDate: '2025-07-01', category: 'WC', amount: 900, notes: 'July charge' },
  { paySeq: 'PAY-101-20250717-25', chargeDate: '2025-09-05', category: 'WC', amount: 60.27, notes: 'Sept charge' },
  { paySeq: 'PAY-101-20250717-25', chargeDate: '2025-10-01', category: 'WC', amount: 179.46, notes: 'Oct charge' },
  // PAY-101 (Zerbarini)-20250909-61
  { paySeq: 'PAY-101-20250909-61', chargeDate: '2025-10-01', category: 'WC', amount: 60.27, notes: 'Oct charge (2nd payment)' },
];

console.log('Payments from waterCrossRef.json:');
let totalSheetsPaid = 0;
for (const p of sheetsPayments) {
  console.log(`  ${p.paySeq}: $${p.amount} → ${p.notes}`);
  totalSheetsPaid += p.amount;
}
console.log(`\n  Total payments applied in Sheets: $${totalSheetsPaid.toFixed(2)}`);

// ========================================
// SOURCE DATA FROM SHEETS (waterMeterReadings.json)
// ========================================
console.log('\n📋 SOURCE: waterMeterReadings.json (Sheets Data)');
console.log('-'.repeat(50));

const meterReadings = {
  'May 2025': 1749,
  'Jun 2025': 1767,
  'Jul 2025': 1774,
  'Aug 2025': 1780,
  'Sep 2025': 1792,
  'Oct 2025': 1800,
  'Nov 2025': 1808,
};

console.log('Meter readings for Unit 101:');
let prevReading = null;
for (const [month, reading] of Object.entries(meterReadings)) {
  const consumption = prevReading ? reading - prevReading : '-';
  console.log(`  ${month}: ${reading} m³ (consumption: ${consumption})`);
  prevReading = reading;
}

// ========================================
// SAMS BILL CALCULATION (from meter readings)
// ========================================
console.log('\n📋 SAMS BILL CALCULATION (@ $50/m³)');
console.log('-'.repeat(50));

const rate = 50;

// Q1: Jul-Aug-Sep (fiscal months 0-2)
const q1Consumption = (1767-1749) + (1774-1767) + (1780-1774); // Jun→Jul + Jul→Aug + Aug→Sep
const q1Charge = q1Consumption * rate;
console.log(`Q1 2026 (Jul-Sep 2025):`);
console.log(`  Consumption: ${q1Consumption} m³ (18 + 7 + 6 = 31... wait)`);

// Actually SAMS uses fiscal months differently
// Reading 2026-00 = July reading on Jul 1 (END of June billing)
// So consumption for July BILLING = reading at Aug 1 - reading at Jul 1
console.log(`\n  Recalculating with SAMS fiscal month mapping:`);
console.log(`  Fiscal month 0 (July billing): 1774 - 1767 = 7 m³`);
console.log(`  Fiscal month 1 (Aug billing): 1780 - 1774 = 6 m³`);
console.log(`  Fiscal month 2 (Sep billing): 1792 - 1780 = 12 m³`);

// Wait that doesn't add to 31 either. Let me check what SAMS actually has
console.log(`\n  But SAMS Firestore shows Q1 consumption = 31 m³`);
console.log(`  That means: Jul=18 + Aug=7 + Sep=6 = 31`);
console.log(`  SAMS is using June reading (1749) as prior for July billing`);

const actualQ1 = 31;
const actualQ1Charge = actualQ1 * rate * 100; // In centavos
console.log(`\n  Q1 Charge: ${actualQ1} m³ × $50 = $${(actualQ1Charge/100).toFixed(2)}`);

// Q2: Oct-Nov-Dec (fiscal months 3-5)
const actualQ2 = 28; // From SAMS
const actualQ2Charge = actualQ2 * rate * 100;
console.log(`\nQ2 2026 (Oct-Dec 2025):`);
console.log(`  Consumption: Oct=12 + Nov=8 + Dec=8 = 28 m³`);
console.log(`  Q2 Charge: ${actualQ2} m³ × $50 = $${(actualQ2Charge/100).toFixed(2)}`);

// ========================================
// COMPARISON
// ========================================
console.log('\n📋 COMPARISON: Sheets vs SAMS');
console.log('-'.repeat(50));

console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    UNIT 101 ANALYSIS                            │
├─────────────────────────────────────────────────────────────────┤
│ METRIC                 │ SHEETS        │ SAMS         │ DIFF    │
├────────────────────────┼───────────────┼──────────────┼─────────┤
│ Q1 Charge (Jul-Sep)    │ Unknown*      │ $1,550.00    │ ???     │
│ Q2 Charge (Oct-Dec)    │ SHOULD NOT    │ $1,400.00    │ +$1,400 │
│                        │ EXIST YET     │              │ PHANTOM │
├────────────────────────┼───────────────┼──────────────┼─────────┤
│ Total Payments Applied │ $1,200.00     │ $1,200.00    │ $0      │
├────────────────────────┼───────────────┼──────────────┼─────────┤
│ Balance Owed (expected)│ ~$800**       │ $1,750.00    │ -$950   │
│ UI Display             │ N/A           │ -$146.69     │ ???     │
└─────────────────────────────────────────────────────────────────┘

* Sheets charges are not exported - only payments are in waterCrossRef
** Per delegation doc: "$800 owed with known duplicate of $400"
`);

// ========================================
// ROOT CAUSES
// ========================================
console.log('\n🔴 ROOT CAUSES IDENTIFIED');
console.log('=' .repeat(70));

console.log(`
1. PHANTOM Q2 2026 BILL
   ━━━━━━━━━━━━━━━━━━━━━
   • Q2 2026 bill ($1,400) EXISTS but SHOULD NOT
   • Oct-Dec 2025 readings exist, but this quarter hasn't been billed yet
   • Import generated bills from ALL available readings
   • Fix: Delete 2026-Q2 bill or don't generate it during import
   • Impact: +$1,400 in phantom charges

2. BILL AMOUNTS CALCULATED FROM READINGS, NOT IMPORTED FROM SHEETS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • SAMS generates bills: consumption × $50/m³ 
   • Sheets had DIFFERENT charge amounts (not consumption-based?)
   • waterCrossRef.json only has PAYMENTS, not original CHARGES
   • Import cannot reconcile because charge amounts aren't exported
   • Fix: Export charge amounts from Sheets, use those instead of calculating

3. PAYMENT APPLICATION WORKS BUT BILLS ARE WRONG
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • $1,200 paid in both systems ✅
   • But bills have wrong amounts, so balance is wrong
   • Q1: $1,550 charged (SAMS) - $960.27 paid = $589.73 owed
   • Q2: $1,400 charged (SAMS) - $239.73 paid = $1,160.27 owed
   • Total SAMS: $1,750 owed (but Q2 shouldn't exist)

4. UI DISPLAY MISMATCH (-$146.69)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   • Firestore shows $1,750 owed
   • UI shows -$146.69 (credit)
   • Separate bug in Statement of Account calculation
   • Need to trace waterDataService.buildYearDataForDisplay()
`);

// ========================================
// RECOMMENDATIONS
// ========================================
console.log('\n🟢 RECOMMENDATIONS');
console.log('=' .repeat(70));

console.log(`
IMMEDIATE FIXES:
1. DELETE 2026-Q2 BILL
   • This removes $1,400 in phantom charges
   • Run: db.collection('clients/AVII/projects/waterBills/bills').doc('2026-Q2').delete()

2. INVESTIGATE UI CALCULATION BUG
   • Why does UI show -$146.69 when Firestore shows $1,750 owed?
   • Check waterDataService and StatementDataAggregator

LONG-TERM FIXES:
3. EXPORT CHARGE AMOUNTS FROM SHEETS
   • Currently only payments are exported
   • Need to export original charge amounts
   • Use those amounts instead of calculating from readings

4. ADD QUARTERLY BILLING CUT-OFF
   • Don't generate Q2 until Q1 is complete
   • Or flag Q2 as "draft" / "not-real"

5. VALIDATE IMPORT BEFORE APPLYING
   • Compare calculated bills vs expected
   • Flag discrepancies for manual review
`);

console.log('\n' + '=' .repeat(70));
console.log('Analysis complete. See recommendations above.');

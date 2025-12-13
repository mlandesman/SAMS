/**
 * Debug Unit 101 After Q2 Deletion
 * 
 * Check for orphaned payments and remaining discrepancies
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
const UNIT_ID = '101';

function centavosToPesos(centavos) {
  return (centavos / 100).toFixed(2);
}

async function debugAfterQ2Delete() {
  console.log('🔍 Debug Unit 101 After Q2 Deletion');
  console.log('=' .repeat(70));

  // ========================================
  // SECTION 1: Current State Summary
  // ========================================
  console.log('\n📋 SECTION 1: Current State Summary');
  console.log('-'.repeat(50));
  
  const q1Doc = await db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills').doc('2026-Q1')
    .get();
  
  if (q1Doc.exists) {
    const q1Data = q1Doc.data();
    const unit101 = q1Data.bills?.units?.[UNIT_ID];
    
    console.log('Q1 2026 Bill (Only bill remaining):');
    console.log(`  Charge: $${centavosToPesos(unit101?.currentCharge || 0)}`);
    console.log(`  Base Paid: $${centavosToPesos(unit101?.basePaid || 0)}`);
    console.log(`  Balance: $${centavosToPesos((unit101?.currentCharge || 0) - (unit101?.basePaid || 0))}`);
    console.log(`  Status: ${unit101?.status}`);
    console.log(`  Payments recorded: ${unit101?.payments?.length || 0}`);
    
    if (unit101?.payments) {
      for (const p of unit101.payments) {
        console.log(`    - ${p.transactionId}: $${centavosToPesos(p.amount)}`);
      }
    }
  }

  // ========================================
  // SECTION 2: Payment Reconciliation
  // ========================================
  console.log('\n📋 SECTION 2: Payment Reconciliation');
  console.log('-'.repeat(50));
  
  console.log('From waterCrossRef.json (Source Sheets):');
  console.log('  PAY-101-20250717-25:');
  console.log('    - $900.00 → July charge (CHG-101-20250701-WC-8)');
  console.log('    - $60.27 → Sept charge (CHG-101-20250905-WC-56)');
  console.log('    - $179.46 → Oct charge (CHG-101-20251001-WC-87)');
  console.log('  PAY-101-20250909-61:');
  console.log('    - $60.27 → Oct charge (CHG-101-20251001-WC-87)');
  console.log('  ─────────────────────────────────────');
  console.log('  TOTAL: $1,200.00');
  
  console.log('\nIn SAMS after Q2 deletion:');
  console.log('  Q1 basePaid: $960.27');
  console.log('  Q2 (deleted): had $239.73 ($179.46 + $60.27)');
  console.log('  ─────────────────────────────────────');
  console.log('  ORPHANED: $239.73 (payments to Q2 were lost with deletion)');

  // ========================================
  // SECTION 3: Analysis
  // ========================================
  console.log('\n📋 SECTION 3: Analysis');
  console.log('-'.repeat(50));
  
  console.log(`
CURRENT STATE:
┌─────────────────────────────────────────────────────────────────┐
│ Source                    │ Value         │ Notes               │
├───────────────────────────┼───────────────┼─────────────────────┤
│ Q1 Charge                 │ $1,550.00     │ 31 m³ × $50         │
│ Q1 Paid (basePaid)        │ $960.27       │ From 1 payment      │
│ Q1 Balance Owed           │ $589.73       │ Current Firestore   │
├───────────────────────────┼───────────────┼─────────────────────┤
│ Sheets Expected Balance   │ ~$800.00      │ From delegation     │
│ Discrepancy               │ -$210.27      │ SAMS shows LESS     │
├───────────────────────────┼───────────────┼─────────────────────┤
│ Orphaned Payments         │ $239.73       │ Were on deleted Q2  │
│ If applied to Q1          │ $349.46       │ New balance         │
└─────────────────────────────────────────────────────────────────┘

ISSUES REMAINING:

1. ORPHANED PAYMENTS ($239.73)
   • $179.46 + $60.27 were applied to Q2 which is now deleted
   • These payments are NOT reflected in any current bill
   • Options:
     a) Re-apply these payments to Q1 (but Q1 charges are Jul-Sep, these were for Oct)
     b) Create credit balance for Unit 101
     c) Accept they're orphaned until Q2 is legitimately generated

2. CHARGE AMOUNT DISCREPANCY
   • SAMS Q1: $1,550 (calculated from 31 m³ × $50)
   • Sheets Q1: Unknown (charges not exported)
   • If Sheets had DIFFERENT charges, balance won't match

3. UI STILL SHOWS -$146.69 CREDIT
   • Firestore shows $589.73 owed
   • UI shows -$146.69 credit
   • This is a SEPARATE BUG in waterDataService calculation
`);

  // ========================================
  // SECTION 4: Check All Bills for All Units (verify Q2 fully deleted)
  // ========================================
  console.log('\n📋 SECTION 4: All Bills Check');
  console.log('-'.repeat(50));
  
  const allBillsSnapshot = await db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills')
    .get();
  
  console.log(`Total bill documents: ${allBillsSnapshot.size}`);
  for (const doc of allBillsSnapshot.docs) {
    console.log(`  - ${doc.id}`);
  }

  // ========================================
  // SECTION 5: Recommendations
  // ========================================
  console.log('\n📋 SECTION 5: Remaining Issues & Recommendations');
  console.log('-'.repeat(50));
  
  console.log(`
REMAINING ISSUES:

1. ⚠️  ORPHANED PAYMENTS: $239.73 from deleted Q2
   RECOMMENDATION: Create water credit balance for Unit 101
   OR wait until Q2 is legitimately billed and re-apply

2. ⚠️  CHARGE AMOUNT UNKNOWN FROM SHEETS
   • We only have payment data, not original charges
   • Can't verify if $1,550 Q1 charge matches Sheets
   RECOMMENDATION: Export charge amounts from Sheets for comparison

3. 🔴 UI DISPLAY BUG: Shows -$146.69 instead of $589.73
   • This is a calculation bug in waterDataService
   • Need to investigate buildYearDataForDisplay() or StatementDataAggregator
   RECOMMENDATION: Debug the statement calculation separately

4. ❓ "KNOWN DUPLICATE OF $400" mentioned in delegation
   • What is this duplicate? Not clear from data
   • If Sheets has $800 owed with $400 duplicate, real owed is $400?
   • Or is it $800 + $400 = $1,200 total?
   RECOMMENDATION: Clarify with source of truth (Sheets owner)
`);

  console.log('\n' + '=' .repeat(70));
  process.exit(0);
}

debugAfterQ2Delete().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

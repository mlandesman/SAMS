#!/usr/bin/env node
/**
 * fix-2a-overpayment-clean.js
 * 
 * Fixes Unit 2A's May 2025 overpayment situation properly:
 * 
 * WHAT HAPPENED:
 * - Owner sent $46,000 instead of $4,600 (May 1)
 * - Michael refunded $41,400 via Venmo (May 2)
 * - Net: $4,600 should apply to HOA Dues
 * 
 * CURRENT STATE (WRONG):
 * - Fake starting_balance of -$40,509 in credit history
 * - May 1: $46,003 with $4,600 to HOA, $41,403 to Account Credit
 * - May 2: -$41,400 refund to Account Credit
 * - This makes Statement show fake $40,509 opening debt
 * 
 * FIX:
 * 1. Modify May 1 transaction:
 *    - Amount: $4,600 (net)
 *    - Allocations: +$46,000 HOA (deposit), -$41,400 HOA (refund)
 *    - This shows full story but nets to correct amount
 * 
 * 2. Delete May 2 refund transaction (now captured in May 1 allocations)
 * 
 * 3. Clean credit history:
 *    - Delete fake starting_balance (-$40,509)
 *    - Delete credit_added from May 1 ($41,403)
 * 
 * Usage:
 *   DRY RUN:  FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-2a-overpayment-clean.js
 *   LIVE:     FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-2a-overpayment-clean.js --live
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const isLive = process.argv.includes('--live');
const isProd = process.env.FIRESTORE_ENV === 'prod';

console.log(`\n${'='.repeat(70)}`);
console.log(`FIX UNIT 2A OVERPAYMENT - CLEAN SOLUTION`);
console.log(`Environment: ${isProd ? '🔴 PRODUCTION' : '🟡 DEVELOPMENT'}`);
console.log(`Mode: ${isLive ? '🔴 LIVE - WILL MODIFY DATABASE' : '🟡 DRY RUN - Preview only'}`);
console.log(`${'='.repeat(70)}\n`);

// Initialize Firebase
const projectId = isProd ? 'sams-sandyland-prod' : 'sams-sandyland';
const app = initializeApp({ 
  credential: applicationDefault(), 
  projectId 
});
const db = getFirestore(app);

const clientId = 'MTC';
const unitId = '2A';
const may1TxnId = '2025-05-01_235113_096';
const may2TxnId = '2025-05-02_235114_079';

async function fix() {
  // ============================================
  // STEP 1: Verify current state
  // ============================================
  console.log('📋 STEP 1: Verifying current state...\n');
  
  // Get May 1 transaction
  const may1Doc = await db.doc(`clients/${clientId}/transactions/${may1TxnId}`).get();
  if (!may1Doc.exists) {
    console.error('❌ May 1 transaction not found');
    process.exit(1);
  }
  const may1Data = may1Doc.data();
  console.log('May 1 Transaction:');
  console.log(`  ID: ${may1TxnId}`);
  console.log(`  Amount: ${may1Data.amount} cents = $${(may1Data.amount / 100).toFixed(2)}`);
  console.log(`  Category: ${may1Data.categoryId}`);
  console.log(`  Allocations: ${JSON.stringify(may1Data.allocations?.map(a => ({ cat: a.categoryId, amt: a.amount / 100 })))}`);
  
  // Get May 2 transaction
  const may2Doc = await db.doc(`clients/${clientId}/transactions/${may2TxnId}`).get();
  if (!may2Doc.exists) {
    console.log('\n⚠️  May 2 transaction not found (may already be deleted)');
  } else {
    const may2Data = may2Doc.data();
    console.log('\nMay 2 Transaction:');
    console.log(`  ID: ${may2TxnId}`);
    console.log(`  Amount: ${may2Data.amount} cents = $${(may2Data.amount / 100).toFixed(2)}`);
    console.log(`  Category: ${may2Data.categoryId}`);
  }
  
  // Get credit history
  const creditDoc = await db.doc(`clients/${clientId}/units/creditBalances`).get();
  const creditData = creditDoc.data();
  const unit2ACredit = creditData?.[unitId];
  
  console.log('\nCredit History for 2A:');
  if (unit2ACredit?.history) {
    unit2ACredit.history.forEach((entry, i) => {
      const ts = entry.timestamp?._seconds 
        ? new Date(entry.timestamp._seconds * 1000).toISOString().split('T')[0]
        : 'no-date';
      console.log(`  [${i}] ${ts} | ${entry.type} | $${(entry.amount / 100).toFixed(2)} | ${entry.notes?.substring(0, 40) || ''}`);
    });
  }
  
  // ============================================
  // STEP 2: Build the fix
  // ============================================
  console.log('\n' + '='.repeat(70));
  console.log('📝 STEP 2: Building the fix...\n');
  
  // New May 1 transaction data
  const depositAmount = 4600000;  // $46,000 in centavos
  const refundAmount = -4140000;  // -$41,400 in centavos
  const netAmount = 460000;       // $4,600 in centavos (net)
  
  const newMay1Data = {
    amount: netAmount,  // Net amount: $4,600
    categoryId: '-split-',
    categoryName: '-Split-',
    allocations: [
      {
        id: 'alloc_deposit',
        categoryId: 'hoa-dues',
        categoryName: 'HOA Dues',
        amount: depositAmount,  // +$46,000
        type: 'hoa_dues',
        targetId: `hoa_${unitId}_2025_5`,
        targetName: 'HOA Dues - May 2025',
        data: {
          unitId: unitId,
          year: 2025,
          month: 5,
          monthName: 'May'
        },
        metadata: {
          note: 'Original deposit amount'
        }
      },
      {
        id: 'alloc_refund',
        categoryId: 'hoa-dues',
        categoryName: 'HOA Dues',
        amount: refundAmount,  // -$41,400
        type: 'hoa_dues',
        targetId: `hoa_${unitId}_2025_5_refund`,
        targetName: 'HOA Dues - May 2025 (Refund)',
        data: {
          unitId: unitId,
          year: 2025,
          month: 5,
          monthName: 'May',
          isRefund: true
        },
        metadata: {
          note: 'Refund of overpayment via Venmo'
        }
      }
    ],
    allocationSummary: {
      totalAllocated: netAmount,
      allocationCount: 2,
      allocationType: 'hoa_dues',
      hasMultipleTypes: false,
      breakdown: {
        deposit: depositAmount,
        refund: refundAmount,
        net: netAmount
      }
    },
    notes: 'May 2025 HOA - Owner sent $46,000, refunded $41,400 via Venmo. Net: $4,600',
    updated: FieldValue.serverTimestamp(),
    updatedBy: 'fix-2a-overpayment-clean.js'
  };
  
  console.log('New May 1 Transaction:');
  console.log(`  Amount: $${(netAmount / 100).toFixed(2)} (net)`);
  console.log('  Allocations:');
  console.log(`    - HOA Dues: +$${(depositAmount / 100).toFixed(2)} (deposit)`);
  console.log(`    - HOA Dues: -$${(Math.abs(refundAmount) / 100).toFixed(2)} (refund)`);
  console.log(`    - Net: $${(netAmount / 100).toFixed(2)}`);
  
  // New credit history (remove fake entries)
  const cleanedHistory = (unit2ACredit?.history || []).filter((entry, i) => {
    // Remove entry [0] - fake starting_balance
    if (entry.type === 'starting_balance' && entry.amount === -4050900) {
      console.log(`\n🗑️  Removing fake starting_balance: $${(entry.amount / 100).toFixed(2)}`);
      return false;
    }
    // Remove entry [1] - credit_added from May 1 overpayment
    if (entry.type === 'credit_added' && entry.amount === 4140300 && 
        entry.notes?.includes('46,000')) {
      console.log(`🗑️  Removing credit_added from overpayment: $${(entry.amount / 100).toFixed(2)}`);
      return false;
    }
    return true;
  });
  
  console.log(`\nCredit history: ${unit2ACredit?.history?.length || 0} entries → ${cleanedHistory.length} entries`);
  
  // ============================================
  // STEP 3: Preview changes
  // ============================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 STEP 3: Changes to apply...\n');
  
  console.log('1. UPDATE May 1 transaction:');
  console.log(`   - Amount: $${(may1Data.amount / 100).toFixed(2)} → $${(netAmount / 100).toFixed(2)}`);
  console.log('   - Allocations: Deposit +$46,000, Refund -$41,400 (both to HOA Dues)');
  
  console.log('\n2. DELETE May 2 refund transaction:');
  console.log(`   - ${may2TxnId} (now captured in May 1 allocations)`);
  
  console.log('\n3. UPDATE credit history:');
  console.log('   - Remove fake starting_balance (-$40,509)');
  console.log('   - Remove credit_added from overpayment (+$41,403)');
  console.log(`   - Keep ${cleanedHistory.length} legitimate entries`);
  
  // ============================================
  // STEP 4: Apply changes (if --live)
  // ============================================
  if (isLive) {
    console.log('\n' + '='.repeat(70));
    console.log('🔴 STEP 4: Applying changes to database...\n');
    
    // 4a. Update May 1 transaction
    console.log('Updating May 1 transaction...');
    await db.doc(`clients/${clientId}/transactions/${may1TxnId}`).update(newMay1Data);
    console.log('✅ May 1 transaction updated');
    
    // 4b. Delete May 2 transaction
    if (may2Doc.exists) {
      console.log('Deleting May 2 transaction...');
      await db.doc(`clients/${clientId}/transactions/${may2TxnId}`).delete();
      console.log('✅ May 2 transaction deleted');
    }
    
    // 4c. Update credit history
    console.log('Updating credit history...');
    const newUnit2ACredit = {
      ...unit2ACredit,
      history: cleanedHistory,
      updated: new Date().toISOString(),
      updatedBy: 'fix-2a-overpayment-clean.js'
    };
    await db.doc(`clients/${clientId}/units/creditBalances`).update({
      [unitId]: newUnit2ACredit
    });
    console.log('✅ Credit history updated');
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL CHANGES APPLIED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('\nNext steps:');
    console.log('1. Regenerate Statement of Account for Unit 2A');
    console.log('2. Verify Budget vs Actual report shows $4,600 HOA income for May');
    console.log('3. Verify opening balance is now $0 (or actual prior balance)');
    
  } else {
    console.log('\n' + '='.repeat(70));
    console.log('🟡 DRY RUN COMPLETE - No changes made');
    console.log('='.repeat(70));
    console.log('\nRun with --live flag to apply changes:');
    console.log(`  FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-2a-overpayment-clean.js --live`);
  }
}

await fix();
process.exit(0);


#!/usr/bin/env node
/**
 * fix-2a-refund-prod.js
 * 
 * Direct Firestore fix for the 2A refund transaction.
 * Changes category from hoa-dues to -split- with Account Credit allocation.
 * 
 * Usage:
 *   DRY RUN:  FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-2a-refund-prod.js
 *   LIVE:     FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-2a-refund-prod.js --live
 */

import { initializeFirebase } from './utils/environment-config.js';

const clientId = 'MTC';
const refundTxnId = '2025-05-02_235114_079';
const originalTxnId = '2025-05-01_235113_096';
const isLive = process.argv.includes('--live');

console.log(`\n${'='.repeat(60)}`);
console.log(`FIX 2A REFUND TRANSACTION`);
console.log(`Mode: ${isLive ? '🔴 LIVE - WILL MODIFY DATABASE' : '🟡 DRY RUN - Preview only'}`);
console.log(`${'='.repeat(60)}\n`);

const { db } = await initializeFirebase();

async function fixRefund() {
  // Get both transactions
  const refundDoc = await db.collection(`clients/${clientId}/transactions`).doc(refundTxnId).get();
  const originalDoc = await db.collection(`clients/${clientId}/transactions`).doc(originalTxnId).get();
  
  if (!refundDoc.exists || !originalDoc.exists) {
    console.error('❌ One or both transactions not found');
    process.exit(1);
  }
  
  const refund = refundDoc.data();
  const original = originalDoc.data();
  
  console.log('=== REFUND TRANSACTION (to fix) ===');
  console.log(`ID: ${refundTxnId}`);
  console.log(`Amount: $${(refund.amount / 100).toFixed(2)}`);
  console.log(`Current Category: ${refund.categoryId}`);
  console.log(`Has Allocations: ${!!refund.allocations}`);
  
  console.log('\n=== ORIGINAL PAYMENT (reference) ===');
  console.log(`ID: ${originalTxnId}`);
  console.log(`Amount: $${(original.amount / 100).toFixed(2)}`);
  console.log(`Has Allocations: ${!!original.allocations}`);
  
  // Find the Account Credit allocation from original
  const creditAlloc = original.allocations?.find(a => 
    a.categoryId === 'account-credit' || a.type === 'account_credit'
  );
  
  if (!creditAlloc) {
    console.error('❌ No Account Credit allocation found in original payment');
    process.exit(1);
  }
  
  console.log(`\nOriginal Credit Allocation: $${(creditAlloc.amount / 100).toFixed(2)}`);
  
  // Build the fix
  const refundAmount = Math.abs(refund.amount);
  const unitId = refund.unitId?.replace(/ \([^)]+\)/, '') || '2A';
  
  const refundAllocations = [{
    id: 'alloc_refund_001',
    type: 'account_credit',
    targetId: `credit_${unitId}_2025`,
    targetName: `Account Credit - Unit ${unitId}`,
    amount: -refundAmount, // Negative to reverse credit
    percentage: null,
    categoryName: 'Account Credit',
    categoryId: 'account-credit',
    data: {
      unitId: unitId,
      year: 2025,
      creditType: 'refund',
      originalTransactionId: originalTxnId
    },
    metadata: {
      processingStrategy: 'account_credit',
      fixedAt: new Date().toISOString(),
      fixReason: 'Refund should reduce Account Credit, not HOA Dues'
    }
  }];
  
  const updateData = {
    categoryId: '-split-',
    categoryName: '-Split-',
    allocations: refundAllocations,
    allocationSummary: {
      totalAllocated: -refundAmount,
      allocationCount: 1,
      allocationType: 'account_credit',
      hasMultipleTypes: false
    },
    notes: refund.notes ? `${refund.notes} (Fixed: Refund of Account Credit)` : 'Refund of Account Credit',
    updated: new Date(),
    updatedBy: 'fix-2a-refund-prod.js'
  };
  
  console.log('\n=== PROPOSED FIX ===');
  console.log(`Change categoryId: "${refund.categoryId}" → "-split-"`);
  console.log(`Add allocation: Account Credit -$${(refundAmount / 100).toFixed(2)}`);
  console.log(`Effect: This will REDUCE Account Credit income instead of HOA Dues income`);
  
  if (isLive) {
    console.log('\n🔴 LIVE MODE: Updating Firestore...');
    await db.collection(`clients/${clientId}/transactions`).doc(refundTxnId).update(updateData);
    console.log('✅ Transaction updated successfully!');
  } else {
    console.log('\n🟡 DRY RUN: No changes made.');
    console.log('   Add --live flag to apply changes.');
  }
}

await fixRefund();
process.exit(0);


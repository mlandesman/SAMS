/**
 * Fix Refund Transaction
 * 
 * Updates the refund transaction to properly reverse Account Credit instead of HOA Dues
 * 
 * Usage: node backend/testing/fixRefundTransaction.js <clientId> <refundTransactionId> <originalPaymentTransactionId>
 * Example: node backend/testing/fixRefundTransaction.js MTC 2025-05-02_213415_115 2025-05-01_213414_427
 */

import { testHarness } from './testHarness.js';
import { getNow } from '../../shared/services/DateService.js';

// Get Firebase Admin from test harness
let admin;

/**
 * Fix refund transaction
 */
async function fixRefundTransaction(api, clientId, refundTxnId, originalTxnId) {
  try {
    // Get both transactions
    console.log(`\nFetching refund transaction: ${refundTxnId}`);
    const refundResponse = await api.get(`/clients/${clientId}/transactions/${refundTxnId}`);
    const refund = refundResponse.data;
    
    console.log(`Fetching original payment transaction: ${originalTxnId}`);
    const originalResponse = await api.get(`/clients/${clientId}/transactions/${originalTxnId}`);
    const original = originalResponse.data;
    
    console.log(`\n=== CURRENT REFUND TRANSACTION ===`);
    console.log(`ID: ${refund.id}`);
    console.log(`Amount: $${(refund.amount || 0) / 100}`);
    console.log(`Type: ${refund.type}`);
    console.log(`Category: ${refund.categoryId} (${refund.categoryName})`);
    console.log(`Unit: ${refund.unitId}`);
    console.log(`Has Allocations: ${!!refund.allocations}`);
    
    // Find the Account Credit allocation from the original payment
    const accountCreditAlloc = original.allocations?.find(a => 
      a.categoryId === 'account-credit' || a.categoryId === 'account_credit'
    );
    
    if (!accountCreditAlloc) {
      throw new Error('Could not find Account Credit allocation in original payment');
    }
    
    console.log(`\n=== ORIGINAL ACCOUNT CREDIT ALLOCATION ===`);
    console.log(`Amount: $${(accountCreditAlloc.amount || 0) / 100}`);
    console.log(`Target: ${accountCreditAlloc.targetName || accountCreditAlloc.targetId}`);
    
    // Calculate the refund amount (should match the Account Credit allocation)
    const refundAmount = Math.abs(refund.amount || 0);
    const creditAmount = accountCreditAlloc.amount || 0;
    
    console.log(`\n=== FIXING REFUND TRANSACTION ===`);
    console.log(`Refund Amount: $${refundAmount / 100}`);
    console.log(`Credit Amount to Reverse: $${creditAmount / 100}`);
    
    // The refund should:
    // 1. Change categoryId from "hoa-dues" to "account-credit"
    // 2. Add a negative allocation to account-credit that reverses the original
    // 3. Make it a split transaction with categoryId = "-split-"
    
    const refundAllocations = [
      {
        id: 'alloc_001',
        type: 'account_credit',
        targetId: accountCreditAlloc.targetId || `credit_${refund.unitId?.replace(/ \([^)]+\)/, '')}_${accountCreditAlloc.data?.year || 2025}`,
        targetName: accountCreditAlloc.targetName || `Account Credit - Unit ${refund.unitId}`,
        amount: -refundAmount, // Negative amount to reverse the credit
        percentage: null,
        categoryName: 'Account Credit',
        categoryId: 'account-credit',
        data: {
          unitId: accountCreditAlloc.data?.unitId || refund.unitId?.replace(/ \([^)]+\)/, ''),
          year: accountCreditAlloc.data?.year || 2025,
          creditType: 'refund',
          originalTransactionId: original.id,
          originalAllocationId: accountCreditAlloc.id
        },
        metadata: {
          processingStrategy: 'account_credit',
          cleanupRequired: true,
          auditRequired: true,
          createdAt: getNow().toISOString(),
          refundOf: original.id
        }
      }
    ];
    
    // Get Firebase Admin instance (initialize if needed)
    if (!admin) {
      const adminModule = await import('firebase-admin');
      admin = adminModule.default;
      if (!admin.apps.length) {
        admin.initializeApp();
      }
    }
    
    // Prepare update
    const db = admin.firestore();
    const refundRef = db.collection(`clients/${clientId}/transactions`).doc(refundTxnId);
    
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
      updated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'system',
      notes: refund.notes ? `${refund.notes} (Refund of Account Credit - Fixed)` : 'Refund of Account Credit'
    };
    
    console.log(`\n=== UPDATE DATA ===`);
    console.log(JSON.stringify(updateData, null, 2));
    
    // Update the transaction
    console.log(`\nUpdating refund transaction in Firestore...`);
    await refundRef.update(updateData);
    
    console.log(`✅ Refund transaction updated successfully!`);
    console.log(`\nChanges made:`);
    console.log(`  - Category changed from "${refund.categoryId}" to "-split-"`);
    console.log(`  - Added negative Account Credit allocation of $${refundAmount / 100}`);
    console.log(`  - This will now reduce Account Credit income instead of HOA Dues income`);
    
    // Verify the update
    console.log(`\nVerifying update...`);
    const updatedRefundResponse = await api.get(`/clients/${clientId}/transactions/${refundTxnId}`);
    const updatedRefund = updatedRefundResponse.data;
    
    console.log(`\n=== UPDATED REFUND TRANSACTION ===`);
    console.log(`Category: ${updatedRefund.categoryId} (${updatedRefund.categoryName})`);
    console.log(`Has Allocations: ${!!updatedRefund.allocations}`);
    if (updatedRefund.allocations) {
      console.log(`Allocations: ${updatedRefund.allocations.length}`);
      updatedRefund.allocations.forEach(alloc => {
        console.log(`  - ${alloc.categoryName}: $${(alloc.amount || 0) / 100}`);
      });
    }
    
    return {
      success: true,
      message: 'Refund transaction fixed successfully'
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.log('Usage: node backend/testing/fixRefundTransaction.js <clientId> <refundTransactionId> <originalPaymentTransactionId>');
    console.log('Example: node backend/testing/fixRefundTransaction.js MTC 2025-05-02_213415_115 2025-05-01_213414_427');
    process.exit(1);
  }
  
  const [clientId, refundTxnId, originalTxnId] = args;
  
  await testHarness.runTest({
    name: `Fix Refund Transaction ${refundTxnId}`,
    async test({ api }) {
      await fixRefundTransaction(api, clientId, refundTxnId, originalTxnId);
      return { passed: true };
    }
  });
  
  testHarness.showSummary();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


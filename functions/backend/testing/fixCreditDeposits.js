/**
 * Fix Credit Deposit Transactions
 * 
 * Updates transactions that were incorrectly categorized as HOA Dues
 * but are actually direct credit balance deposits (not yet allocated to bills)
 * 
 * Usage: node backend/testing/fixCreditDeposits.js <clientId> <transactionId1> <transactionId2> ...
 * Example: node backend/testing/fixCreditDeposits.js MTC 2025-05-15_213420_705 2025-05-15_213420_019
 */

import { testHarness } from './testHarness.js';
import { getNow } from '../../shared/services/DateService.js';

/**
 * Fix credit deposit transaction
 */
async function fixCreditDeposit(api, clientId, txnId) {
  try {
    // Get transaction
    console.log(`\nFetching transaction: ${txnId}`);
    const txnResponse = await api.get(`/clients/${clientId}/transactions/${txnId}`);
    const txn = txnResponse.data;
    
    console.log(`\n=== CURRENT TRANSACTION ===`);
    console.log(`ID: ${txn.id}`);
    console.log(`Amount: $${(txn.amount || 0) / 100}`);
    console.log(`Type: ${txn.type}`);
    console.log(`Category: ${txn.categoryId} (${txn.categoryName})`);
    console.log(`Unit: ${txn.unitId}`);
    console.log(`Has Allocations: ${!!txn.allocations}`);
    
    const depositAmount = txn.amount || 0;
    const unitId = txn.unitId?.replace(/ \([^)]+\)/, '') || txn.unitId; // Remove unit name in parentheses
    const depositDate = txn.date;
    const depositYear = depositDate?.year || depositDate?.iso ? new Date(depositDate.iso || depositDate).getFullYear() : 2025;
    
    console.log(`\n=== FIXING TRANSACTION ===`);
    console.log(`Deposit Amount: $${depositAmount / 100}`);
    console.log(`Unit ID: ${unitId}`);
    console.log(`Deposit Year: ${depositYear}`);
    console.log(`This is a direct credit balance deposit (not allocated to bills yet)`);
    
    // The transaction should:
    // 1. Change categoryId from "hoa-dues" to "account-credit" (or "-split-" with allocation)
    // 2. Add a positive Account Credit allocation
    // 3. Make it a split transaction with categoryId = "-split-"
    
    const creditAllocations = [
      {
        id: 'alloc_001',
        type: 'account_credit',
        targetId: `credit_${unitId}_${depositYear}`,
        targetName: `Account Credit - Unit ${unitId}`,
        amount: depositAmount, // Positive amount for credit added
        percentage: null,
        categoryName: 'Account Credit',
        categoryId: 'account-credit',
        data: {
          unitId: unitId,
          year: depositYear,
          creditType: 'direct_deposit',
          note: 'Direct credit balance deposit (not yet allocated to bills)'
        },
        metadata: {
          processingStrategy: 'account_credit',
          cleanupRequired: true,
          auditRequired: true,
          createdAt: getNow().toISOString()
        }
      }
    ];
    
    // Prepare update
    let admin;
    if (!admin) {
      const adminModule = await import('firebase-admin');
      admin = adminModule.default;
      if (!admin.apps.length) {
        admin.initializeApp();
      }
    }
    
    const db = admin.firestore();
    const txnRef = db.collection(`clients/${clientId}/transactions`).doc(txnId);
    
    const updateData = {
      categoryId: '-split-',
      categoryName: '-Split-',
      allocations: creditAllocations,
      allocationSummary: {
        totalAllocated: depositAmount,
        allocationCount: 1,
        allocationType: 'account_credit',
        hasMultipleTypes: false
      },
      updated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'system',
      notes: txn.notes ? `${txn.notes} (Direct credit deposit - Fixed)` : 'Direct credit balance deposit (not yet allocated to bills)'
    };
    
    console.log(`\n=== UPDATE DATA ===`);
    console.log(JSON.stringify(updateData, null, 2));
    
    // Update the transaction
    console.log(`\nUpdating transaction in Firestore...`);
    await txnRef.update(updateData);
    
    console.log(`✅ Transaction updated successfully!`);
    console.log(`\nChanges made:`);
    console.log(`  - Category changed from "${txn.categoryId}" to "-split-"`);
    console.log(`  - Added positive Account Credit allocation of $${depositAmount / 100}`);
    console.log(`  - This will now count as Account Credit income instead of HOA Dues income`);
    
    return { success: true, transactionId: txnId };
    
  } catch (error) {
    console.error(`❌ Error fixing transaction ${txnId}:`, error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node backend/testing/fixCreditDeposits.js <clientId> <transactionId1> [transactionId2] ...');
    console.log('Example: node backend/testing/fixCreditDeposits.js MTC 2025-05-15_213420_705 2025-05-15_213420_019');
    process.exit(1);
  }
  
  const clientId = args[0];
  const txnIds = args.slice(1);
  
  await testHarness.runTest({
    name: `Fix Credit Deposit Transactions (${txnIds.length} transactions)`,
    async test({ api }) {
      const results = [];
      for (const txnId of txnIds) {
        const result = await fixCreditDeposit(api, clientId, txnId);
        results.push(result);
      }
      
      console.log(`\n═══════════════════════════════════════════════════════════════════════`);
      console.log(`SUMMARY`);
      console.log(`═══════════════════════════════════════════════════════════════════════`);
      console.log(`Fixed ${results.length} transaction(s):`);
      results.forEach(r => console.log(`  ✅ ${r.transactionId}`));
      console.log(`\nThese transactions will now:`);
      console.log(`  - Count as Account Credit income (cash basis)`);
      console.log(`  - NOT count as HOA Dues income`);
      console.log(`  - Reduce the HOA Dues Actual by $${(results.length * 7200).toFixed(2)} (${results.length * 7200 / 100})`);
      
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


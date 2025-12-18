/**
 * Recreate Partial Payment for Unit 106 Q2
 * 
 * This script recreates the partial payment that was deleted when the last transaction was removed.
 * Based on the analysis:
 * - Unit 106, Q2 (Oct/Nov/Dec) FY 2026
 * - Full quarterly: $36,060.93
 * - Remaining balance: $26,504.78 (base $24,040.62 + penalty $2,464.16)
 * - Partial payment made: $12,020.31 (base only, $4,006.77 per month)
 * - No penalty in partial payment (penalties accrued later)
 */

import { getDb } from '../firebase.js';
import { createTransaction } from '../controllers/transactionsController.js';
import admin from 'firebase-admin';
import { getMexicoDateString } from '../utils/timezone.js';
import { pesosToCentavos } from '../../shared/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '106';
const FISCAL_YEAR = 2026;
const QUARTER = 1; // Q2 = index 1 (Oct/Nov/Dec)
const QUARTER_START_MONTH = 3; // October = month index 3 (0-based: Jul=0, Aug=1, Sep=2, Oct=3)

// Partial payment details
// Full quarterly: $36,060.93
// Remaining base: $24,040.62 (from user's earlier message)
// Partial payment base: $36,060.93 - $24,040.62 = $12,020.31
const PARTIAL_PAYMENT_BASE = 12020.31; // Total base paid in partial payment
const MONTHLY_BASE_PAID = PARTIAL_PAYMENT_BASE / 3; // $4,006.77 per month
const PARTIAL_PAYMENT_PENALTY = 0; // No penalty in partial payment (penalties accrued later)

// Payment date - set to early October (before penalties accrued)
const PAYMENT_DATE = '2025-10-05'; // Early October 2025

async function recreatePartialPayment() {
  try {
    console.log('\n=== Recreating Partial Payment for Unit 106 Q2 ===\n');
    
    const db = await getDb();
    
    // Get default Cash account
    const accountsRef = db.collection('clients').doc(CLIENT_ID).collection('accounts');
    const accountsSnapshot = await accountsRef.where('name', '==', 'Cash').limit(1).get();
    
    let accountId = 'cash';
    let accountType = 'cash'; // Must be one of: bank, cash, credit
    
    if (!accountsSnapshot.empty) {
      const accountDoc = accountsSnapshot.docs[0];
      accountId = accountDoc.id;
      const accountData = accountDoc.data();
      // Map account type to valid values: bank, cash, credit
      const typeMapping = {
        'checking': 'bank',
        'savings': 'bank',
        'cash': 'cash',
        'credit': 'credit'
      };
      accountType = typeMapping[accountData.type] || 'cash';
      console.log(`Using account: ${accountId} (${accountType})`);
    } else {
      console.log(`Cash account not found, using defaults: ${accountId} (${accountType})`);
    }
    
    // Step 1: Get the HOA dues document
    const duesRef = db.collection('clients').doc(CLIENT_ID)
      .collection('units').doc(UNIT_ID)
      .collection('dues').doc(FISCAL_YEAR.toString());
    
    const duesDoc = await duesRef.get();
    if (!duesDoc.exists) {
      throw new Error(`HOA dues document not found for unit ${UNIT_ID}, year ${FISCAL_YEAR}`);
    }
    
    const duesData = duesDoc.data();
    const currentPayments = Array.isArray(duesData.payments) ? duesData.payments : [];
    
    // Ensure payments array has 12 elements (one per month, indexed 0-11)
    // This is critical because the system uses paymentsArray[monthIndex] to access payments
    const updatedPayments = new Array(12).fill(null);
    for (let i = 0; i < currentPayments.length; i++) {
      if (currentPayments[i]) {
        // If payment has a month field, use it to determine index
        if (currentPayments[i].month) {
          const monthIndex = currentPayments[i].month - 1; // Convert 1-based to 0-based
          if (monthIndex >= 0 && monthIndex < 12) {
            updatedPayments[monthIndex] = currentPayments[i];
          }
        } else {
          // If no month field, assume array is already indexed by month
          updatedPayments[i] = currentPayments[i];
        }
      }
    }
    
    console.log('Current payment status:');
    for (let i = 0; i < 3; i++) {
      const monthIndex = QUARTER_START_MONTH + i;
      const payment = updatedPayments[monthIndex];
      console.log(`  Month ${monthIndex + 1} (${['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'][monthIndex]}):`, 
        payment ? `$${(payment.amount || 0) / 100}` : '$0.00');
    }
    
    // Step 2: Update payment entries for Q2 months (Oct, Nov, Dec)
    const transactionId = `PARTIAL_Q2_${Date.now()}`;
    
    for (let i = 0; i < 3; i++) {
      const monthIndex = QUARTER_START_MONTH + i;
      const monthName = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'][monthIndex];
      
      // Get existing payment if any
      const existingPayment = updatedPayments[monthIndex];
      const existingBasePaid = existingPayment?.basePaid || 0;
      const existingPenaltyPaid = existingPayment?.penaltyPaid || 0;
      
      // Add partial payment amounts
      const newBasePaid = existingBasePaid + pesosToCentavos(MONTHLY_BASE_PAID);
      const newPenaltyPaid = existingPenaltyPaid + pesosToCentavos(PARTIAL_PAYMENT_PENALTY);
      const newAmount = newBasePaid + newPenaltyPaid;
      
      updatedPayments[monthIndex] = {
        month: monthIndex + 1, // Add month field (1-based: 4=Oct, 5=Nov, 6=Dec)
        amount: newAmount,
        basePaid: newBasePaid,
        penaltyPaid: newPenaltyPaid,
        date: admin.firestore.Timestamp.fromDate(new Date(PAYMENT_DATE)),
        paid: true,
        reference: transactionId,
        paymentMethod: 'Cash', // Default payment method
        notes: `Q2 Month ${i + 1}/3 - Partial Payment (Recreated)`
      };
      
      console.log(`  Updated ${monthName}: +$${MONTHLY_BASE_PAID.toFixed(2)} base, total: $${(newAmount / 100).toFixed(2)}`);
    }
    
    // Step 3: Calculate new total paid
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + (p?.amount || 0), 0);
    console.log(`\nNew total paid: $${(newTotalPaid / 100).toFixed(2)}`);
    
    // Step 4: Create transaction
    const transactionData = {
      date: PAYMENT_DATE,
      amount: PARTIAL_PAYMENT_BASE, // In pesos
      type: 'income', // HOA payments are income
      categoryName: 'HOA Dues',
      accountId: accountId,
      accountType: accountType,
      vendorId: 'deposit', // Standard vendor for all deposits
      vendorName: 'Deposit', // Display name for reporting
      paymentMethod: 'Cash',
      unitId: UNIT_ID,
      description: `Q2 Partial Payment - Unit ${UNIT_ID} (Recreated)`,
      notes: `Recreated partial payment for Q2. Base: $${PARTIAL_PAYMENT_BASE.toFixed(2)}`,
      allocations: [
        {
          categoryName: 'HOA Dues',
          amount: PARTIAL_PAYMENT_BASE, // In pesos
          unitId: UNIT_ID,
          metadata: {
            type: 'hoa_dues',
            quarter: QUARTER,
            year: FISCAL_YEAR
          }
        }
      ],
      enteredBy: 'system',
      metadata: {
        type: 'hoa_dues',
        unitId: UNIT_ID,
        quarter: QUARTER,
        year: FISCAL_YEAR,
        recreated: true
      }
    };
    
    console.log('\nCreating transaction...');
    const txnId = await createTransaction(CLIENT_ID, transactionData);
    console.log(`✅ Transaction created: ${txnId}`);
    
    // Step 5: Update HOA dues document with payments
    console.log('\nUpdating HOA dues document...');
    await duesRef.update({
      payments: updatedPayments,
      totalPaid: newTotalPaid,
      updated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('\n✅ Partial payment recreated successfully!');
    console.log(`\nSummary:`);
    console.log(`  Unit: ${UNIT_ID}`);
    console.log(`  Quarter: Q2 (Oct/Nov/Dec)`);
    console.log(`  Amount: $${PARTIAL_PAYMENT_BASE.toFixed(2)}`);
    console.log(`  Per month: $${MONTHLY_BASE_PAID.toFixed(2)}`);
    console.log(`  Transaction ID: ${txnId}`);
    console.log(`  Payment date: ${PAYMENT_DATE}`);
    
  } catch (error) {
    console.error('\n❌ Error recreating partial payment:', error);
    throw error;
  }
}

// Run the script
recreatePartialPayment()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

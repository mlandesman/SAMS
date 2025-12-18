/**
 * RESTORE ESSENTIAL DATA FOR UNIT 106
 * 
 * This script ONLY recreates:
 * 1. Oct payment: $12,020.31 (from the $24,000 payment)
 * 2. Credit balance: $10,125.86
 * 
 * Nothing else. Simple and focused.
 */

import { getDb } from '../firebase.js';
import admin from 'firebase-admin';
import { pesosToCentavos } from '../../shared/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '106';
const FISCAL_YEAR = 2026;

// Essential data to restore
const OCT_PAYMENT_AMOUNT = 12020.31; // $12,020.31 paid to October
const CREDIT_BALANCE = 10125.86; // $10,125.86 credit balance

// Payment date for Oct payment (from the $24,000 transaction)
const OCT_PAYMENT_DATE = '2025-10-05'; // Approximate date

async function restoreEssentialData() {
  try {
    console.log('\n=== RESTORING ESSENTIAL DATA FOR UNIT 106 ===\n');
    console.log('This will restore:');
    console.log(`  1. Oct payment: $${OCT_PAYMENT_AMOUNT.toFixed(2)}`);
    console.log(`  2. Credit balance: $${CREDIT_BALANCE.toFixed(2)}\n`);
    
    const db = await getDb();
    
    // Step 1: Restore Oct payment in HOA dues
    console.log('Step 1: Restoring Oct payment...');
    const duesRef = db.collection('clients').doc(CLIENT_ID)
      .collection('units').doc(UNIT_ID)
      .collection('dues').doc(FISCAL_YEAR.toString());
    
    const duesDoc = await duesRef.get();
    if (!duesDoc.exists) {
      throw new Error(`HOA dues document not found for unit ${UNIT_ID}, year ${FISCAL_YEAR}`);
    }
    
    const duesData = duesDoc.data();
    const currentPayments = Array.isArray(duesData.payments) ? duesData.payments : [];
    
    // Ensure payments array has 12 elements
    const updatedPayments = new Array(12).fill(null);
    for (let i = 0; i < currentPayments.length && i < 12; i++) {
      if (currentPayments[i]) {
        updatedPayments[i] = currentPayments[i];
      }
    }
    
    // Oct is month index 3 (0-based: Jul=0, Aug=1, Sep=2, Oct=3)
    const octMonthIndex = 3;
    const octPaymentCentavos = pesosToCentavos(OCT_PAYMENT_AMOUNT);
    
    // Set Oct payment
    updatedPayments[octMonthIndex] = {
      month: 4, // Oct = month 4 (1-based)
      amount: octPaymentCentavos,
      basePaid: octPaymentCentavos,
      penaltyPaid: 0,
      date: admin.firestore.Timestamp.fromDate(new Date(OCT_PAYMENT_DATE)),
      paid: true,
      reference: 'RESTORED_OCT_PAYMENT',
      paymentMethod: 'Cash',
      notes: 'Oct payment restored - from $24,000 payment'
    };
    
    console.log(`  ✓ Oct payment restored: $${OCT_PAYMENT_AMOUNT.toFixed(2)}`);
    
    // Calculate total paid
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + (p?.amount || 0), 0);
    
    // Update HOA dues document
    await duesRef.update({
      payments: updatedPayments,
      totalPaid: newTotalPaid,
      updated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`  ✓ Total paid updated: $${(newTotalPaid / 100).toFixed(2)}\n`);
    
    // Step 2: Restore credit balance
    console.log('Step 2: Restoring credit balance...');
    const creditRef = db.collection('clients').doc(CLIENT_ID)
      .collection('units').doc(UNIT_ID)
      .collection('creditBalances').doc('current');
    
    const creditBalanceCentavos = pesosToCentavos(CREDIT_BALANCE);
    
    await creditRef.set({
      creditBalance: creditBalanceCentavos,
      updated: admin.firestore.FieldValue.serverTimestamp(),
      notes: 'Credit balance restored'
    }, { merge: true });
    
    console.log(`  ✓ Credit balance restored: $${CREDIT_BALANCE.toFixed(2)}\n`);
    
    console.log('✅ ESSENTIAL DATA RESTORED SUCCESSFULLY\n');
    console.log('Summary:');
    console.log(`  Unit: ${UNIT_ID}`);
    console.log(`  Oct payment: $${OCT_PAYMENT_AMOUNT.toFixed(2)}`);
    console.log(`  Credit balance: $${CREDIT_BALANCE.toFixed(2)}`);
    console.log(`  Q2 status: Oct paid, Nov/Dec unpaid`);
    
  } catch (error) {
    console.error('\n❌ Error restoring data:', error);
    throw error;
  }
}

// Run the script
restoreEssentialData()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

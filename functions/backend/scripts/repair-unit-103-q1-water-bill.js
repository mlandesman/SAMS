#!/usr/bin/env node
/**
 * REPAIR SCRIPT: Unit 103 Q1 Water Bill Payment from Credit
 * 
 * Fixes Unit 103's Q1 water bill by:
 * 1. Marking the Q1 water bill as paid ($1,676.94 from credit)
 * 2. Adding credit history entry to decrement credit balance by $1,676.94 on 10/1/2025
 * 
 * Based on Sheets data, the Q1 bill total is $2,149.88.
 * We have enough credit to pay the full bill amount.
 * 
 * Original credit entries from Sheets:
 * - 08/01/25: -$76.94 (June Consumption Paid from Credit Balance)
 * - 08/01/25: -$400.00 (July Consumption Paid from Credit Balance)
 * - 09/05/25: -$1,200.00 (August Consumption Paid from Credit Balance)
 * Note: The full bill amount ($2,149.88) will be applied as a single credit payment.
 * 
 * Usage:
 *   DRY RUN: node functions/backend/scripts/repair-unit-103-q1-water-bill.js
 *   LIVE:    node functions/backend/scripts/repair-unit-103-q1-water-bill.js --live --prod
 */

import admin from 'firebase-admin';
import { existsSync } from 'fs';
import { pesosToCentavos, centavosToPesos } from '../../shared/utils/currencyUtils.js';
import { validateCentavos } from '../../shared/utils/centavosValidation.js';
import { getCreditBalance, createCreditHistoryEntry } from '../../shared/utils/creditBalanceUtils.js';
import { getNow } from '../../shared/services/DateService.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '103';
const BILL_ID = '2026-Q1'; // Q1 fiscal year 2026
// Note: Full bill amount - we have enough credit to pay the entire bill
const CREDIT_AMOUNT_PESOS = 2149.88; // Full Q1 bill amount
const PAYMENT_DATE = '2025-10-01T00:00:00-05:00'; // October 1, 2025 (when credit was applied)

// Check for flags
const isLive = process.argv.includes('--live');
const useProduction = process.argv.includes('--prod');
const productionProjectId = 'sams-sandyland-prod';

async function initializeFirebase() {
  if (useProduction) {
    console.log(`🌍 Environment: PRODUCTION`);
    console.log(`🔥 Firebase Project: ${productionProjectId}`);
    console.log(`🔑 Using Application Default Credentials (ADC)\n`);
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
         !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: productionProjectId
      });
    }
    
    return admin.firestore();
  } else {
    const { getDb } = await import('../firebase.js');
    return await getDb();
  }
}

async function main() {
  console.log('🔧 REPAIR: Unit 103 Q1 Water Bill Payment from Credit\n');
  console.log('='.repeat(80));
  console.log(`Unit: ${UNIT_ID}`);
  console.log(`Bill: ${BILL_ID}`);
  console.log(`Credit Amount: $${CREDIT_AMOUNT_PESOS.toFixed(2)}`);
  console.log(`Payment Date: ${PAYMENT_DATE}`);
  console.log(`Mode: ${isLive ? '🔴 LIVE' : '🟡 DRY RUN'}`);
  console.log('='.repeat(80));
  
  if (!isLive) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made');
    console.log('   Add --live flag to apply changes\n');
  }
  
  const db = await initializeFirebase();
  
  // 1. Get the Q1 water bill
  const billRef = db.collection('clients').doc(CLIENT_ID)
    .collection('projects').doc('waterBills')
    .collection('bills').doc(BILL_ID);
  
  const billDoc = await billRef.get();
  
  if (!billDoc.exists) {
    console.error(`❌ Bill ${BILL_ID} not found`);
    process.exit(1);
  }
  
  const billData = billDoc.data();
  const unitBill = billData.bills?.units?.[UNIT_ID];
  
  if (!unitBill) {
    console.error(`❌ Unit ${UNIT_ID} not found in bill ${BILL_ID}`);
    process.exit(1);
  }
  
  console.log(`\n📊 Current Bill Status:`);
  console.log(`   Bill Amount: $${centavosToPesos(unitBill.totalAmount || 0).toFixed(2)}`);
  console.log(`   Paid Amount: $${centavosToPesos(unitBill.paidAmount || 0).toFixed(2)}`);
  console.log(`   Base Paid: $${centavosToPesos(unitBill.basePaid || 0).toFixed(2)}`);
  console.log(`   Penalty Paid: $${centavosToPesos(unitBill.penaltyPaid || 0).toFixed(2)}`);
  console.log(`   Status: ${unitBill.status || 'unpaid'}`);
  console.log(`   Payments: ${(unitBill.payments || []).length} payment(s)`);
  
  // 2. Calculate new payment amounts
  const creditAmountCentavos = pesosToCentavos(CREDIT_AMOUNT_PESOS);
  const currentPaidAmount = unitBill.paidAmount || 0;
  const currentBasePaid = unitBill.basePaid || 0;
  const currentPenaltyPaid = unitBill.penaltyPaid || 0;
  
  // Apply credit to base charge first, then penalties
  const totalDue = unitBill.totalAmount || 0;
  const remainingDue = totalDue - currentPaidAmount;
  const creditToApply = Math.min(creditAmountCentavos, remainingDue);
  
  // Apply to base charge first
  const baseRemaining = (unitBill.baseAmount || totalDue) - currentBasePaid;
  const basePaidFromCredit = Math.min(creditToApply, baseRemaining);
  const penaltyPaidFromCredit = Math.max(0, creditToApply - basePaidFromCredit);
  
  const newBasePaid = validateCentavos(currentBasePaid + basePaidFromCredit, 'newBasePaid');
  const newPenaltyPaid = validateCentavos(currentPenaltyPaid + penaltyPaidFromCredit, 'newPenaltyPaid');
  const newPaidAmount = validateCentavos(newBasePaid + newPenaltyPaid, 'newPaidAmount');
  
  // Determine new status
  let newStatus = 'unpaid';
  if (newPaidAmount >= totalDue) {
    newStatus = 'paid';
  } else if (newPaidAmount > 0) {
    newStatus = 'partial';
  }
  
  console.log(`\n📝 Payment Calculation:`);
  console.log(`   Credit to Apply: $${CREDIT_AMOUNT_PESOS.toFixed(2)} (${creditAmountCentavos} centavos)`);
  console.log(`   Base Paid from Credit: $${centavosToPesos(basePaidFromCredit).toFixed(2)}`);
  console.log(`   Penalty Paid from Credit: $${centavosToPesos(penaltyPaidFromCredit).toFixed(2)}`);
  console.log(`   New Paid Amount: $${centavosToPesos(newPaidAmount).toFixed(2)}`);
  console.log(`   New Status: ${newStatus}`);
  
  // 3. Create payment entry
  const existingPayments = unitBill.payments || [];
  const paymentEntry = {
    amount: creditToApply,
    baseChargePaid: basePaidFromCredit,
    penaltyPaid: penaltyPaidFromCredit,
    date: PAYMENT_DATE,
    method: 'credit_balance',
    reference: 'Manual repair - Q1 water bill paid from credit',
    transactionId: null, // No transaction ID for credit-only payment
    recordedAt: getNow().toISOString(),
    notes: `Q1 water bill paid in full from credit balance: $${CREDIT_AMOUNT_PESOS.toFixed(2)}`
  };
  
  const updatedPayments = [...existingPayments, paymentEntry];
  
  // 4. Get current credit balance
  const creditBalancesRef = db.collection('clients').doc(CLIENT_ID)
    .collection('units').doc('creditBalances');
  
  const creditDoc = await creditBalancesRef.get();
  const creditData = creditDoc.exists ? creditDoc.data() : {};
  const unitCreditData = creditData[UNIT_ID] || { history: [] };
  
  const currentCreditBalance = getCreditBalance(unitCreditData);
  const currentCreditBalancePesos = centavosToPesos(currentCreditBalance);
  
  console.log(`\n💰 Current Credit Balance: $${currentCreditBalancePesos.toFixed(2)}`);
  console.log(`   Credit to Deduct: $${CREDIT_AMOUNT_PESOS.toFixed(2)}`);
  console.log(`   New Credit Balance: $${centavosToPesos(currentCreditBalance - creditAmountCentavos).toFixed(2)}`);
  
  // 5. Create credit history entry
  const creditHistoryEntry = createCreditHistoryEntry({
    amount: -creditAmountCentavos, // Negative = credit used
    transactionId: null, // No transaction for credit-only payment
    notes: `Q1 Water Bill payment in full from credit balance: $${CREDIT_AMOUNT_PESOS.toFixed(2)}`,
    type: 'credit_used',
    timestamp: PAYMENT_DATE,
    source: 'waterBills'
  });
  
  const updatedCreditHistory = [...(unitCreditData.history || []), creditHistoryEntry];
  
  // Validate credit balance won't go negative
  const newCreditBalance = getCreditBalance({ history: updatedCreditHistory });
  if (newCreditBalance < 0) {
    console.error(`\n❌ ERROR: Credit balance would become negative: ${centavosToPesos(newCreditBalance).toFixed(2)}`);
    console.error(`   Current balance: $${currentCreditBalancePesos.toFixed(2)}`);
    console.error(`   Attempting to deduct: $${CREDIT_AMOUNT_PESOS.toFixed(2)}`);
    process.exit(1);
  }
  
  // 6. Apply changes
  if (isLive) {
    console.log(`\n🔴 APPLYING CHANGES...\n`);
    
    const batch = db.batch();
    
    // Update water bill
    batch.update(billRef, {
      [`bills.units.${UNIT_ID}.paidAmount`]: newPaidAmount,
      [`bills.units.${UNIT_ID}.basePaid`]: newBasePaid,
      [`bills.units.${UNIT_ID}.penaltyPaid`]: newPenaltyPaid,
      [`bills.units.${UNIT_ID}.status`]: newStatus,
      [`bills.units.${UNIT_ID}.payments`]: updatedPayments
    });
    
    // Update credit balance
    const fiscalYear = 2026; // AVII fiscal year
    batch.set(creditBalancesRef, {
      ...creditData,
      [UNIT_ID]: {
        ...unitCreditData,
        history: updatedCreditHistory,
        lastChange: {
          year: fiscalYear.toString(),
          historyIndex: updatedCreditHistory.length - 1,
          timestamp: getNow().toISOString()
        }
      }
    }, { merge: true });
    
    await batch.commit();
    
    console.log(`✅ Changes applied successfully!`);
    console.log(`   - Water bill ${BILL_ID} updated: ${newStatus}`);
    console.log(`   - Credit balance updated: $${centavosToPesos(newCreditBalance).toFixed(2)}`);
  } else {
    console.log(`\n🟡 DRY RUN - Would apply:`);
    console.log(`   - Update water bill ${BILL_ID}: paidAmount=${newPaidAmount}, status=${newStatus}`);
    console.log(`   - Add payment entry: $${centavosToPesos(creditToApply).toFixed(2)}`);
    console.log(`   - Add credit history entry: -$${CREDIT_AMOUNT_PESOS.toFixed(2)}`);
    console.log(`   - New credit balance: $${centavosToPesos(newCreditBalance).toFixed(2)}`);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('Repair complete.');
  console.log(`${'='.repeat(80)}\n`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


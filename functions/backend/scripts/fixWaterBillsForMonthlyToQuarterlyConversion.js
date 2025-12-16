/**
 * Fix Water Bill Documents for Monthly to Quarterly Conversion
 * 
 * Problem: When converting from monthly to quarterly billing, some units had:
 * 1. June monthly bills that were paid
 * 2. Those payments were recorded in the Q1 quarterly bill document
 * 3. But the bill document might show net amounts (after credits) instead of full charges
 * 
 * Solution: 
 * - Check each unit's credit history for June-related entries
 * - Compare payment amounts in Q1 bill with what should be the full charge
 * - Update bill documents to show full charges (original bill amounts)
 * 
 * This is a one-time data fix for migration from Sheets.
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

async function fixWaterBillsForConversion() {
  const db = await getDb();
  const clientId = 'AVII';
  const billId = '2026-Q1';
  
  console.log(`Analyzing and fixing water bills for ${clientId} ${billId}...`);
  console.log('');
  
  // Step 1: Get the Q1 bill document
  // Water bills are stored at: clients/{clientId}/projects/waterBills/bills/{billId}
  const billsRef = db.collection('clients').doc(clientId)
    .collection('projects').doc('waterBills')
    .collection('bills');
  
  const q1BillDoc = await billsRef.doc(billId).get();
  
  if (!q1BillDoc.exists) {
    console.log(`❌ ${billId} bill document does not exist`);
    return;
  }
  
  const q1Bill = q1BillDoc.data();
  
  if (!q1Bill || !q1Bill.bills || !q1Bill.bills.units) {
    console.log(`❌ ${billId} bill document missing bills.units structure`);
    return;
  }
  
  // Step 2: Get credit balances to check for June-related credits
  const creditBalancesRef = db.collection('clients').doc(clientId)
    .collection('units').doc('creditBalances');
  const creditDoc = await creditBalancesRef.get();
  const creditData = creditDoc.exists ? creditDoc.data() : {};
  
  // Step 3: Analyze each unit
  const unitsToFix = [];
  const units = q1Bill.bills.units;
  
  for (const [unitId, unitBill] of Object.entries(units)) {
    // Check if this unit has a payment with "June" reference
    const hasJunePayment = unitBill.payments && unitBill.payments.some(p => 
      (p.reference || '').toLowerCase().includes('june')
    );
    
    if (!hasJunePayment) continue;
    
    // Get credit history for this unit
    const unitCreditData = creditData[unitId];
    let juneCreditAdjustment = 0;
    
    if (unitCreditData && unitCreditData.history) {
      // Find June-related credit entries that might indicate a credit back
      const juneEntries = unitCreditData.history.filter(entry => 
        (entry.description || '').toLowerCase().includes('june') &&
        (entry.description || '').toLowerCase().includes('sewage') ||
        (entry.description || '').toLowerCase().includes('refund')
      );
      
      if (juneEntries.length > 0) {
        // Calculate the credit adjustment amount
        // For unit 201, we know it was $239.73 credit back
        // For unit 101, we see $239.73 refund
        for (const entry of juneEntries) {
          const before = (entry.balanceBefore || 0) / 100;
          const after = (entry.balanceAfter || 0) / 100;
          const change = after - before;
          if (change > 0) {
            // Credit was added (refund), so the original bill was higher
            juneCreditAdjustment = change;
          }
        }
      }
    }
    
    // Check if payment amount suggests a credit was applied
    const payment = unitBill.payments && unitBill.payments[0];
    if (payment && juneCreditAdjustment > 0) {
      const paymentAmount = payment.amount || 0; // in centavos
      const currentCharge = unitBill.currentCharge || 0; // in centavos
      const creditAdjustmentCentavos = juneCreditAdjustment * 100;
      
      // If payment + credit adjustment > current charge, we need to update
      const expectedCharge = paymentAmount + creditAdjustmentCentavos;
      
      if (Math.abs(currentCharge - expectedCharge) > 1) {
        unitsToFix.push({
          unitId,
          currentCharge: currentCharge / 100,
          paymentAmount: paymentAmount / 100,
          creditAdjustment: juneCreditAdjustment,
          expectedCharge: expectedCharge / 100,
          paymentDate: payment.date
        });
      }
    }
  }
  
  if (unitsToFix.length === 0) {
    console.log('✅ No units need fixing. All bill documents appear correct.');
    return;
  }
  
  console.log(`Found ${unitsToFix.length} unit(s) that need fixing:`);
  unitsToFix.forEach(u => {
    console.log(`  Unit ${u.unitId}:`);
    console.log(`    Current charge: $${u.currentCharge.toFixed(2)}`);
    console.log(`    Payment amount: $${u.paymentAmount.toFixed(2)}`);
    console.log(`    Credit adjustment: $${u.creditAdjustment.toFixed(2)}`);
    console.log(`    Expected charge: $${u.expectedCharge.toFixed(2)}`);
    console.log('');
  });
  
  // Step 4: Update the bill document
  console.log('Updating bill document...');
  const billRef = billsRef.doc(billId);
  
  for (const fix of unitsToFix) {
    const expectedChargeCentavos = Math.round(fix.expectedCharge * 100);
    
    // Update the unit's charge fields using dot notation for nested paths
    await billRef.update({
      [`bills.units.${fix.unitId}.currentCharge`]: expectedChargeCentavos,
      [`bills.units.${fix.unitId}.waterCharge`]: expectedChargeCentavos,
      [`bills.units.${fix.unitId}.totalAmount`]: expectedChargeCentavos,
      [`bills.units.${fix.unitId}.payments.0.amount`]: expectedChargeCentavos,
      [`bills.units.${fix.unitId}.payments.0.baseChargePaid`]: expectedChargeCentavos,
      [`bills.units.${fix.unitId}.paidAmount`]: expectedChargeCentavos,
      [`bills.units.${fix.unitId}.basePaid`]: expectedChargeCentavos
    });
    
    console.log(`  ✓ Updated unit ${fix.unitId}: $${fix.currentCharge.toFixed(2)} → $${fix.expectedCharge.toFixed(2)}`);
  }
  console.log('');
  console.log(`✅ Successfully updated ${unitsToFix.length} unit(s) in ${billId}`);
  console.log('');
  console.log('Note: Credit adjustments will appear separately in the statement.');
  console.log('The bill documents now show the full original charges.');
}

// Run the fix
fixWaterBillsForConversion()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });

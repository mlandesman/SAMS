/**
 * DEBUG: Why carryover.totalPenalties is $0 instead of $149.74
 */

import { getDb } from '../backend/firebase.js';
import { centavosToPesos } from '../backend/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';

async function debugCarryoverPenalties() {
  console.log(`\n🔍 DEBUGGING carryover.totalPenalties calculation`);
  console.log('='.repeat(60));
  
  try {
    const db = await getDb();
    
    // Get actual bill document
    const billRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-00');
    
    const billDoc = await billRef.get();
    const unitBill = billDoc.data()?.bills?.units?.[UNIT_ID];
    
    console.log(`\n📋 Actual Bill Data (Unit ${UNIT_ID}, 2026-00):`);
    if (unitBill) {
      console.log(`  currentCharge: $${centavosToPesos(unitBill.currentCharge || 0)}`);
      console.log(`  penaltyAmount: $${centavosToPesos(unitBill.penaltyAmount || 0)}`);
      console.log(`  totalAmount: $${centavosToPesos(unitBill.totalAmount || 0)}`);
      console.log(`  paidAmount: $${centavosToPesos(unitBill.paidAmount || 0)}`);
      console.log(`  status: ${unitBill.status}`);
    }
    
    // Get aggregated data
    const aggregatedRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    const aggregatedDoc = await aggregatedRef.get();
    const aggregatedData = aggregatedDoc.data();
    
    console.log(`\n📊 Aggregated Data (Unit ${UNIT_ID}, Month 0):`);
    if (aggregatedData?.months?.[0]?.units?.[UNIT_ID]) {
      const unitData = aggregatedData.months[0].units[UNIT_ID];
      console.log(`  billAmount: $${centavosToPesos(unitData.billAmount || 0)}`);
      console.log(`  previousBalance: $${centavosToPesos(unitData.previousBalance || 0)}`);
      console.log(`  totalPenalties: $${centavosToPesos(unitData.totalPenalties || 0)}`);
      console.log(`  displayTotalPenalties: $${centavosToPesos(unitData.displayTotalPenalties || 0)}`);
      console.log(`  totalDue: $${centavosToPesos(unitData.totalDue || 0)}`);
      console.log(`  displayTotalDue: $${centavosToPesos(unitData.displayTotalDue || 0)}`);
      
      console.log(`\n🧮 Calculation Breakdown:`);
      const billAmount = centavosToPesos(unitData.billAmount || 0);
      const previousBalance = centavosToPesos(unitData.previousBalance || 0);
      const totalPenalties = centavosToPesos(unitData.totalPenalties || 0);
      
      console.log(`  billAmount: $${billAmount}`);
      console.log(`  previousBalance: $${previousBalance}`);
      console.log(`  totalPenalties: $${totalPenalties}`);
      console.log(`  Expected total: $${billAmount + previousBalance + totalPenalties}`);
      console.log(`  Actual displayTotalDue: $${centavosToPesos(unitData.displayTotalDue || 0)}`);
      
      // The issue: totalPenalties should be $149.74 but it's $0
      const actualBillPenalty = centavosToPesos(unitBill?.penaltyAmount || 0);
      console.log(`\n🐛 THE PROBLEM:`);
      console.log(`  Actual bill penalty: $${actualBillPenalty}`);
      console.log(`  totalPenalties in aggregated: $${totalPenalties}`);
      console.log(`  Difference: $${actualBillPenalty - totalPenalties}`);
      
      if (Math.abs(actualBillPenalty - totalPenalties) > 0.01) {
        console.log(`\n❌ MISMATCH: totalPenalties is wrong!`);
        console.log(`  It should be $${actualBillPenalty} but it's $${totalPenalties}`);
        console.log(`  This is why displayTotalDue is wrong!`);
      }
    }
    
  } catch (error) {
    console.error(`Error:`, error.message);
  }
}

debugCarryoverPenalties();

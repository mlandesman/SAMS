/**
 * CHECK: Why displayTotalDue shows $900 instead of $1099.74
 */

import { getDb } from '../backend/firebase.js';
import { centavosToPesos } from '../backend/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';

async function checkDisplayTotalDue() {
  console.log(`\n🔍 CHECKING displayTotalDue vs actual bill data`);
  console.log('='.repeat(60));
  
  try {
    const db = await getDb();
    
    // Get aggregated data
    const aggregatedRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    const aggregatedDoc = await aggregatedRef.get();
    const aggregatedData = aggregatedDoc.data();
    
    console.log(`\n📊 Aggregated Data (Unit ${UNIT_ID}, Month 0):`);
    if (aggregatedData?.months?.[0]?.units?.[UNIT_ID]) {
      const unitData = aggregatedData.months[0].units[UNIT_ID];
      console.log(`  displayTotalDue: $${unitData.displayTotalDue || 0}`);
      console.log(`  totalDue: $${unitData.totalDue || 0}`);
      console.log(`  displayTotalPenalties: $${unitData.displayTotalPenalties || 0}`);
      console.log(`  totalPenalties: $${unitData.totalPenalties || 0}`);
      console.log(`  billAmount: $${unitData.billAmount || 0}`);
      console.log(`  previousBalance: $${unitData.previousBalance || 0}`);
    } else {
      console.log(`  No data found for Unit ${UNIT_ID}`);
    }
    
    // Get actual bill document
    const billRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-00');
    
    const billDoc = await billRef.get();
    const unitBill = billDoc.data()?.bills?.units?.[UNIT_ID];
    
    console.log(`\n📋 Actual Bill Document (Unit ${UNIT_ID}, 2026-00):`);
    if (unitBill) {
      console.log(`  currentCharge: $${centavosToPesos(unitBill.currentCharge || 0)}`);
      console.log(`  penaltyAmount: $${centavosToPesos(unitBill.penaltyAmount || 0)}`);
      console.log(`  totalAmount: $${centavosToPesos(unitBill.totalAmount || 0)}`);
      console.log(`  paidAmount: $${centavosToPesos(unitBill.paidAmount || 0)}`);
      console.log(`  status: ${unitBill.status}`);
    } else {
      console.log(`  No bill found for Unit ${UNIT_ID}`);
    }
    
    // Compare
    console.log(`\n🔍 COMPARISON:`);
    if (unitBill && aggregatedData?.months?.[0]?.units?.[UNIT_ID]) {
      const unitData = aggregatedData.months[0].units[UNIT_ID];
      const actualTotal = centavosToPesos(unitBill.currentCharge || 0) + centavosToPesos(unitBill.penaltyAmount || 0);
      
      console.log(`  Actual bill total: $${actualTotal}`);
      console.log(`  displayTotalDue: $${unitData.displayTotalDue || 0}`);
      console.log(`  Difference: $${Math.abs(actualTotal - (unitData.displayTotalDue || 0))}`);
      
      if (Math.abs(actualTotal - (unitData.displayTotalDue || 0)) > 0.01) {
        console.log(`\n❌ MISMATCH DETECTED!`);
        console.log(`  UI will show: $${unitData.displayTotalDue || 0}`);
        console.log(`  But bill actually costs: $${actualTotal}`);
        console.log(`  This explains why $900 payment shows as partial!`);
      } else {
        console.log(`\n✅ displayTotalDue matches actual bill total`);
      }
    }
    
  } catch (error) {
    console.error(`Error:`, error.message);
  }
}

checkDisplayTotalDue();

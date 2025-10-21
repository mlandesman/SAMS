/**
 * TRACE: Where does each component read its data from?
 * Goal: Find why frontend and backend show different numbers when both should use aggregatedData
 */

import { getDb } from '../backend/firebase.js';
import { centavosToPesos } from '../backend/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';
const MONTH_INDEX = 0; // July

async function traceDataSources() {
  console.log(`\n🔍 DATA SOURCE TRACE`);
  console.log('='.repeat(80));
  console.log(`Looking for: Unit ${UNIT_ID}, Month ${MONTH_INDEX} (July)`);
  console.log('='.repeat(80));
  
  try {
    const db = await getDb();
    
    // 1. AggregatedData (SOURCE OF TRUTH)
    console.log(`\n📊 1. AGGREGATED DATA (Source of Truth):`);
    const aggregatedRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    const aggregatedDoc = await aggregatedRef.get();
    const aggregatedData = aggregatedDoc.data();
    
    if (aggregatedData?.months?.[MONTH_INDEX]?.units?.[UNIT_ID]) {
      const unitData = aggregatedData.months[MONTH_INDEX].units[UNIT_ID];
      console.log(`   Path: clients/AVII/projects/waterBills/bills/aggregatedData`);
      console.log(`   → months[${MONTH_INDEX}].units[${UNIT_ID}]`);
      console.log(`   displayTotalDue: ${unitData.displayTotalDue} centavos = $${centavosToPesos(unitData.displayTotalDue)}`);
      console.log(`   billAmount: ${unitData.billAmount} centavos = $${centavosToPesos(unitData.billAmount)}`);
      console.log(`   displayTotalPenalties: ${unitData.displayTotalPenalties} centavos = $${centavosToPesos(unitData.displayTotalPenalties)}`);
      console.log(`   totalDue: ${unitData.totalDue} centavos = $${centavosToPesos(unitData.totalDue)}`);
    } else {
      console.log(`   ❌ NO DATA FOUND`);
    }
    
    // 2. Bill Document (what backend reads for payment calculations)
    console.log(`\n📋 2. BILL DOCUMENT (Backend reads this for payments):`);
    const billRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-00');
    
    const billDoc = await billRef.get();
    const unitBill = billDoc.data()?.bills?.units?.[UNIT_ID];
    
    if (unitBill) {
      console.log(`   Path: clients/AVII/projects/waterBills/bills/2026-00`);
      console.log(`   → bills.units[${UNIT_ID}]`);
      console.log(`   currentCharge: ${unitBill.currentCharge} centavos = $${centavosToPesos(unitBill.currentCharge)}`);
      console.log(`   penaltyAmount: ${unitBill.penaltyAmount} centavos = $${centavosToPesos(unitBill.penaltyAmount)}`);
      console.log(`   totalAmount: ${unitBill.totalAmount} centavos = $${centavosToPesos(unitBill.totalAmount)}`);
      console.log(`   paidAmount: ${unitBill.paidAmount} centavos = $${centavosToPesos(unitBill.paidAmount)}`);
    } else {
      console.log(`   ❌ NO DATA FOUND`);
    }
    
    // 3. Frontend WaterPaymentModal - trace what it SHOULD read
    console.log(`\n💻 3. FRONTEND (WaterPaymentModal.jsx line 60):`);
    console.log(`   Code: totalDue = unitData.displayTotalDue || 0;`);
    console.log(`   Source: waterData.months[${MONTH_INDEX}].units[${UNIT_ID}].displayTotalDue`);
    console.log(`   Should read: ${aggregatedData?.months?.[MONTH_INDEX]?.units?.[UNIT_ID]?.displayTotalDue || 0} centavos`);
    console.log(`   Should show: $${centavosToPesos(aggregatedData?.months?.[MONTH_INDEX]?.units?.[UNIT_ID]?.displayTotalDue || 0)}`);
    
    // 4. Backend waterPaymentsService - trace what it reads
    console.log(`\n🔧 4. BACKEND (waterPaymentsService.js):`);
    console.log(`   For payment preview/calculation, backend reads:`);
    console.log(`   → Bill documents (not aggregatedData)`);
    console.log(`   → clients/AVII/projects/waterBills/bills/2026-00`);
    console.log(`   Uses: currentCharge (${unitBill?.currentCharge} centavos = $${centavosToPesos(unitBill?.currentCharge || 0)})`);
    
    // COMPARISON
    console.log(`\n${'='.repeat(80)}`);
    console.log(`COMPARISON`);
    console.log('='.repeat(80));
    
    const aggDisplayTotalDue = aggregatedData?.months?.[MONTH_INDEX]?.units?.[UNIT_ID]?.displayTotalDue || 0;
    const billCurrentCharge = unitBill?.currentCharge || 0;
    
    console.log(`Frontend SHOULD show (from aggregatedData): $${centavosToPesos(aggDisplayTotalDue)}`);
    console.log(`Backend uses (from bill doc): $${centavosToPesos(billCurrentCharge)}`);
    
    if (aggDisplayTotalDue !== billCurrentCharge) {
      console.log(`\n❌ MISMATCH DETECTED!`);
      console.log(`   AggregatedData.displayTotalDue: ${aggDisplayTotalDue} centavos ($${centavosToPesos(aggDisplayTotalDue)})`);
      console.log(`   Bill.currentCharge: ${billCurrentCharge} centavos ($${centavosToPesos(billCurrentCharge)})`);
      console.log(`   Difference: ${Math.abs(aggDisplayTotalDue - billCurrentCharge)} centavos ($${centavosToPesos(Math.abs(aggDisplayTotalDue - billCurrentCharge))})`);
      console.log(`\n🔥 ROOT CAUSE: AggregatedData is OUT OF SYNC with bill documents!`);
      console.log(`   Solution: Rebuild aggregatedData to match bill documents`);
    } else {
      console.log(`\n✅ Data is in sync`);
      console.log(`   If frontend shows wrong amount, it's a browser cache issue`);
    }
    
  } catch (error) {
    console.error(`Error:`, error.message);
  }
}

traceDataSources();

/**
 * CHECK: Why UI shows $900 but backend needs $950
 */

import { getDb } from '../backend/firebase.js';
import { centavosToPesos } from '../backend/utils/currencyUtils.js';

const CLIENT_ID = 'AVII';
const UNIT_ID = '101';

async function checkUIVsBackend() {
  console.log(`\n🔍 CHECKING UI vs Backend Data Discrepancy`);
  console.log('='.repeat(60));
  
  try {
    const db = await getDb();
    
    // Get aggregated data (what the UI uses)
    const aggregatedRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('aggregatedData');
    
    const aggregatedDoc = await aggregatedRef.get();
    const aggregatedData = aggregatedDoc.data();
    
    console.log(`\n📊 Aggregated Data (UI Source):`);
    if (aggregatedData?.months?.[0]?.units?.[UNIT_ID]) {
      const unitData = aggregatedData.months[0].units[UNIT_ID];
      console.log(`  displayTotalDue: $${centavosToPesos(unitData.displayTotalDue || 0)}`);
      console.log(`  totalDue: $${centavosToPesos(unitData.totalDue || 0)}`);
      console.log(`  billAmount: $${centavosToPesos(unitData.billAmount || 0)}`);
      console.log(`  displayTotalPenalties: $${centavosToPesos(unitData.displayTotalPenalties || 0)}`);
      console.log(`  totalPenalties: $${centavosToPesos(unitData.totalPenalties || 0)}`);
      console.log(`  previousBalance: $${centavosToPesos(unitData.previousBalance || 0)}`);
    }
    
    // Get actual bill document (what backend uses)
    const billRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('bills').doc('2026-00');
    
    const billDoc = await billRef.get();
    const unitBill = billDoc.data()?.bills?.units?.[UNIT_ID];
    
    console.log(`\n📋 Actual Bill Document (Backend Source):`);
    if (unitBill) {
      console.log(`  currentCharge: $${centavosToPesos(unitBill.currentCharge || 0)}`);
      console.log(`  penaltyAmount: $${centavosToPesos(unitBill.penaltyAmount || 0)}`);
      console.log(`  totalAmount: $${centavosToPesos(unitBill.totalAmount || 0)}`);
      console.log(`  paidAmount: $${centavosToPesos(unitBill.paidAmount || 0)}`);
      console.log(`  status: ${unitBill.status}`);
    }
    
    // Check what the water consumption rate is
    const configRef = db.collection('clients').doc(CLIENT_ID)
      .collection('config').doc('waterBills');
    
    const configDoc = await configRef.get();
    const config = configDoc.data();
    
    console.log(`\n⚙️ Water Billing Config:`);
    if (config) {
      console.log(`  ratePerM3: ${config.ratePerM3} centavos ($${centavosToPesos(config.ratePerM3 || 0)} per m³)`);
      console.log(`  minimumCharge: ${config.minimumCharge} centavos ($${centavosToPesos(config.minimumCharge || 0)})`);
    }
    
    // Check the actual consumption for Unit 101
    const readingsRef = db.collection('clients').doc(CLIENT_ID)
      .collection('projects').doc('waterBills')
      .collection('readings').doc('2026-00');
    
    const readingsDoc = await readingsRef.get();
    const readings = readingsDoc.data();
    
    console.log(`\n💧 Water Consumption Data:`);
    if (readings?.units?.[UNIT_ID]) {
      const unitReading = readings.units[UNIT_ID];
      console.log(`  consumption: ${unitReading.consumption || 0} m³`);
      console.log(`  waterCharge: $${centavosToPesos(unitReading.waterCharge || 0)}`);
      console.log(`  currentCharge: $${centavosToPesos(unitReading.currentCharge || 0)}`);
      
      // Calculate what the charge should be
      const ratePerM3 = config?.ratePerM3 || 5000; // 50 pesos per m³ default
      const consumption = unitReading.consumption || 0;
      const calculatedCharge = consumption * ratePerM3;
      const minimumCharge = config?.minimumCharge || 0;
      const finalCharge = Math.max(calculatedCharge, minimumCharge);
      
      console.log(`\n🧮 Calculation Check:`);
      console.log(`  Consumption: ${consumption} m³`);
      console.log(`  Rate: $${centavosToPesos(ratePerM3)} per m³`);
      console.log(`  Calculated: ${consumption} × $${centavosToPesos(ratePerM3)} = $${centavosToPesos(calculatedCharge)}`);
      console.log(`  Minimum: $${centavosToPesos(minimumCharge)}`);
      console.log(`  Final Charge: $${centavosToPesos(finalCharge)}`);
      
      if (Math.abs(finalCharge - (unitBill?.currentCharge || 0)) > 0.01) {
        console.log(`\n❌ CHARGE MISMATCH!`);
        console.log(`  Expected: $${centavosToPesos(finalCharge)}`);
        console.log(`  Actual: $${centavosToPesos(unitBill?.currentCharge || 0)}`);
        console.log(`  Difference: $${centavosToPesos(Math.abs(finalCharge - (unitBill?.currentCharge || 0)))}`);
      } else {
        console.log(`\n✅ Charge calculation is correct`);
      }
    }
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SUMMARY`);
    console.log('='.repeat(60));
    
    const uiTotal = centavosToPesos(aggregatedData?.months?.[0]?.units?.[UNIT_ID]?.displayTotalDue || 0);
    const backendTotal = centavosToPesos(unitBill?.currentCharge || 0);
    
    console.log(`UI shows: $${uiTotal}`);
    console.log(`Backend uses: $${backendTotal}`);
    
    if (Math.abs(uiTotal - backendTotal) > 0.01) {
      console.log(`\n❌ DISCREPANCY: $${Math.abs(uiTotal - backendTotal)} difference`);
      console.log(`This explains why payment amounts don't match!`);
    } else {
      console.log(`\n✅ UI and backend amounts match`);
    }
    
  } catch (error) {
    console.error(`Error:`, error.message);
  }
}

checkUIVsBackend();

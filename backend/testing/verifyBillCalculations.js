#!/usr/bin/env node

/**
 * Verify Water Bill Calculations
 * Ensures bills are calculated correctly using config values
 */

import { getDb } from '../firebase.js';

async function verifyCalculations() {
  console.log('🔍 Verifying Water Bill Calculations\n');
  
  try {
    const db = await getDb();
    const clientId = 'AVII';
    
    // 1. Get the config
    console.log('1️⃣ Loading water billing configuration...');
    const configDoc = await db
      .collection('clients').doc(clientId)
      .collection('config').doc('waterBills')
      .get();
    
    if (!configDoc.exists) {
      console.error('❌ Water billing config not found');
      process.exit(1);
    }
    
    const config = configDoc.data();
    const ratePerM3InPesos = config.ratePerM3 / 100;
    
    console.log('✅ Config loaded:');
    console.log(`   Rate: $${ratePerM3InPesos.toFixed(2)} MXN per m³`);
    console.log(`   Minimum charge: $${(config.minimumCharge / 100).toFixed(2)} MXN`);
    console.log(`   Penalty: ${(config.penaltyRate * 100)}% after ${config.penaltyDays} days`);
    console.log(`   Compound penalty: ${config.compoundPenalty}`);
    
    // 2. Get the most recent bills
    console.log('\n2️⃣ Finding recent bills...');
    const billsSnapshot = await db
      .collection('clients').doc(clientId)
      .collection('projects').doc('waterBills')
      .collection('bills')
      .orderBy('billDate', 'desc')
      .limit(1)
      .get();
    
    if (billsSnapshot.empty) {
      console.log('⚠️  No bills found. Generate bills first.');
      process.exit(0);
    }
    
    const billDoc = billsSnapshot.docs[0];
    const billData = billDoc.data();
    
    console.log(`✅ Found bills for: ${billData.billingPeriod}`);
    console.log(`   Document ID: ${billDoc.id}`);
    console.log(`   Bill date: ${new Date(billData.billDate).toLocaleDateString()}`);
    console.log(`   Due date: ${new Date(billData.dueDate).toLocaleDateString()}`);
    
    // 3. Verify calculations for each unit
    console.log('\n3️⃣ Verifying bill calculations...');
    
    let totalCalculated = 0;
    let errors = [];
    
    for (const [unitId, bill] of Object.entries(billData.bills?.units || {})) {
      const consumption = bill.consumption;
      const expectedAmount = consumption * ratePerM3InPesos;
      const finalAmount = Math.max(expectedAmount, config.minimumCharge / 100);
      
      // Check if calculation is correct
      if (Math.abs(bill.baseAmount - finalAmount) > 0.01) {
        errors.push({
          unitId,
          consumption,
          expected: finalAmount,
          actual: bill.baseAmount,
          difference: bill.baseAmount - finalAmount
        });
      }
      
      totalCalculated += bill.baseAmount;
      
      // Show first 3 units as examples
      if (Object.keys(billData.bills.units).indexOf(unitId) < 3) {
        console.log(`   Unit ${unitId}:`);
        console.log(`     Readings: ${bill.priorReading} → ${bill.currentReading}`);
        console.log(`     Consumption: ${consumption} m³`);
        console.log(`     Calculation: ${consumption} m³ × $${ratePerM3InPesos.toFixed(2)} = $${expectedAmount.toFixed(2)}`);
        console.log(`     Base amount: $${bill.baseAmount.toFixed(2)}`);
        console.log(`     Status: ${bill.status}`);
        console.log(`     ✅ Correct: ${Math.abs(bill.baseAmount - finalAmount) <= 0.01}`);
      }
    }
    
    // 4. Verify totals
    console.log('\n4️⃣ Verifying totals...');
    console.log(`   Sum of all bills: $${totalCalculated.toFixed(2)}`);
    console.log(`   Stored total: $${billData.summary.totalBilled.toFixed(2)}`);
    console.log(`   Match: ${Math.abs(totalCalculated - billData.summary.totalBilled) <= 0.01 ? '✅' : '❌'}`);
    
    // 5. Check config snapshot
    console.log('\n5️⃣ Verifying config snapshot...');
    if (billData.configSnapshot) {
      console.log(`   Rate stored: ${billData.configSnapshot.ratePerM3} (current: ${config.ratePerM3})`);
      console.log(`   Penalty stored: ${billData.configSnapshot.penaltyRate} (current: ${config.penaltyRate})`);
      console.log(`   Currency: ${billData.configSnapshot.currency}`);
      console.log('   ✅ Config snapshot preserved');
    } else {
      console.log('   ⚠️  No config snapshot found');
    }
    
    // 6. Report errors
    if (errors.length > 0) {
      console.log('\n❌ CALCULATION ERRORS FOUND:');
      errors.forEach(err => {
        console.log(`   Unit ${err.unitId}: Expected $${err.expected.toFixed(2)}, Got $${err.actual.toFixed(2)} (diff: $${err.difference.toFixed(2)})`);
      });
    } else {
      console.log('\n✅ All calculations verified correctly!');
    }
    
    // 7. Summary statistics
    console.log('\n📊 Summary Statistics:');
    console.log(`   Total units billed: ${billData.summary.totalUnits}`);
    console.log(`   Total billed: ${billData.summary.currencySymbol}${billData.summary.totalBilled.toFixed(2)}`);
    console.log(`   Total unpaid: ${billData.summary.currencySymbol}${billData.summary.totalUnpaid.toFixed(2)}`);
    console.log(`   Average bill: ${billData.summary.currencySymbol}${(billData.summary.totalBilled / billData.summary.totalUnits).toFixed(2)}`);
    
    // Calculate total consumption
    const totalConsumption = Object.values(billData.bills?.units || {})
      .reduce((sum, bill) => sum + bill.consumption, 0);
    console.log(`   Total consumption: ${totalConsumption} m³`);
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run verification
verifyCalculations();
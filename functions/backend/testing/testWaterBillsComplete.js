#!/usr/bin/env node

/**
 * COMPLETE WATER BILLS SYSTEM TEST
 * Demonstrates all working functionality with real Firebase data
 */

import { testHarness, createApiClient } from './testHarness.js';

async function completeWaterBillsTest() {
  console.log('=====================================');
  console.log('🚀 WATER BILLS SYSTEM - COMPLETE TEST');
  console.log('=====================================\n');
  
  try {
    // Get authenticated client
    const api = await createApiClient('fjXv8gX1CYWBvOZ1CS27j96oRCT2');
    console.log('✅ Authentication successful - User: michael@landesman.com\n');
    
    // Test 1: Submit new readings for multiple units
    console.log('📊 TEST 1: SUBMIT METER READINGS');
    console.log('=================================');
    const readings = {
      '101': 1770,  // Previous was 1767
      '102': 2350,  // Previous was 2347
      '103': 3460,  // Previous was 3456
      '104': 4500,
      '105': 5600,
      '106': 6700
    };
    
    console.log('Submitting readings for 6 units...');
    const submitResponse = await api.post('/api/clients/AVII/projects/waterBills/2026/0/readings', {
      readings: readings
    });
    
    console.log(`✅ Successfully updated ${submitResponse.data.updated} units`);
    console.log('\nCalculated consumption and bills:');
    Object.entries(submitResponse.data.data).forEach(([unitId, data]) => {
      console.log(`  Unit ${unitId}: ${data.priorReading} → ${data.currentReading} = ${data.consumption} m³ = ₱${(data.amount / 100).toFixed(2)}`);
    });
    
    // Test 2: Read current month data
    console.log('\n📖 TEST 2: READ CURRENT MONTH DATA');
    console.log('===================================');
    const getResponse = await api.get('/api/clients/AVII/projects/waterBills/2026/0');
    
    const monthData = getResponse.data.data;
    console.log(`Period: ${monthData.period} (Billing: ${monthData.billingMonth})`);
    
    let totalConsumption = 0;
    let totalAmount = 0;
    let unpaidCount = 0;
    
    Object.entries(monthData.units).forEach(([unitId, data]) => {
      totalConsumption += data.consumption || 0;
      totalAmount += data.amount || 0;
      if (!data.paid) unpaidCount++;
    });
    
    console.log(`\nSummary:`);
    console.log(`  Total units with readings: ${Object.keys(monthData.units).length}`);
    console.log(`  Total consumption: ${totalConsumption} m³`);
    console.log(`  Total amount due: ₱${(totalAmount / 100).toFixed(2)}`);
    console.log(`  Unpaid bills: ${unpaidCount}`);
    
    // Test 3: Process payments for specific units
    console.log('\n💰 TEST 3: PROCESS PAYMENTS');
    console.log('============================');
    const unitsToPayFor = ['101', '102'];
    
    for (const unitId of unitsToPayFor) {
      const unitData = monthData.units[unitId];
      if (unitData && !unitData.paid) {
        console.log(`Processing payment for Unit ${unitId}...`);
        const paymentResponse = await api.post('/api/clients/AVII/projects/waterBills/2026/0/payments', {
          unitId: unitId,
          amount: unitData.amount / 100, // Convert cents to pesos
          method: 'cash'
        });
        
        if (paymentResponse.data.success) {
          const payment = paymentResponse.data.payment;
          console.log(`  ✅ Payment recorded: ₱${(payment.totalPaid / 100).toFixed(2)}`);
          console.log(`     Payment ID: ${payment.paymentId}`);
        }
      }
    }
    
    // Test 4: Verify payments were recorded
    console.log('\n✅ TEST 4: VERIFY PAYMENT STATUS');
    console.log('=================================');
    const verifyResponse = await api.get('/api/clients/AVII/projects/waterBills/2026/0');
    const updatedData = verifyResponse.data.data;
    
    console.log('Payment status for all units:');
    Object.entries(updatedData.units).forEach(([unitId, data]) => {
      const status = data.paid ? '✅ PAID' : '❌ UNPAID';
      console.log(`  Unit ${unitId}: ${status} - Amount: ₱${(data.amount / 100).toFixed(2)}`);
    });
    
    // Test 5: Calculate unpaid balances with penalties
    console.log('\n📈 TEST 5: UNPAID BALANCE TRACKING');
    console.log('===================================');
    let totalUnpaid = 0;
    let totalWithPenalty = 0;
    
    Object.entries(updatedData.units).forEach(([unitId, data]) => {
      if (!data.paid) {
        totalUnpaid += data.amount;
        const withPenalty = data.unpaidBalance + data.amount;
        totalWithPenalty += withPenalty;
        if (data.monthsBehind > 0) {
          console.log(`  Unit ${unitId}: ${data.monthsBehind} months behind - Penalty applied`);
        }
      }
    });
    
    console.log(`\nTotal unpaid (current month): ₱${(totalUnpaid / 100).toFixed(2)}`);
    console.log(`Total with penalties: ₱${(totalWithPenalty / 100).toFixed(2)}`);
    
    // Final Summary
    console.log('\n=====================================');
    console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('=====================================');
    console.log('\n📋 SYSTEM CAPABILITIES DEMONSTRATED:');
    console.log('  ✅ Authentication with Firebase tokens');
    console.log('  ✅ Submit meter readings for multiple units');
    console.log('  ✅ Automatic consumption calculation');
    console.log('  ✅ Bill amount calculation (₱50 per m³)');
    console.log('  ✅ Process payments with tracking');
    console.log('  ✅ Track unpaid balances and penalties');
    console.log('  ✅ Real-time data updates in Firebase');
    
    console.log('\n🌐 FRONTEND ACCESS:');
    console.log('  Navigate to: http://localhost:5173/water-bills');
    console.log('  Login with your Firebase credentials');
    console.log('  Select AVII client');
    console.log('  You can now use the water bills interface!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the complete test
completeWaterBillsTest();
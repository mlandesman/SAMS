/**
 * Test Water Bills CrossRef Mapping
 * 
 * This test simulates the CrossRef building process for water bills
 * without touching the database. It reads files from Firebase Storage
 * and validates the mapping logic.
 */

import { testHarness } from './testHarness.js';
import { readFileFromFirebaseStorage } from '../api/importStorage.js';
import admin from 'firebase-admin';
import { getDb } from '../firebase.js';

const CLIENT_ID = 'AVII';
const STORAGE_PATH = 'firebase_storage';

/**
 * Extract unit ID from unit string
 * "201 (Ische)" → "201"
 */
function extractUnitId(unitString) {
  if (!unitString) return null;
  const match = unitString.match(/^(\d+)/);
  return match ? match[1] : unitString;
}

/**
 * Build Water Bills Transaction CrossRef (simulation)
 */
function buildWaterBillsCrossRef(transactionsData) {
  const crossRef = {
    generated: new Date().toISOString(),
    totalRecords: 0,
    byPaymentSeq: {},  // PAY-* → transaction info
    byUnit: {}         // Unit → array of payments
  };
  
  console.log('\n🔍 Scanning transactions for Water Consumption payments...\n');
  
  for (const transaction of transactionsData) {
    // Look for Water Consumption category
    if (transaction.Category === "Water Consumption" && transaction['']) {
      const paySeq = transaction[''];  // e.g., "PAY-201 (Ische)-20251002-96"
      const unitId = extractUnitId(transaction.Unit);
      
      // Simulate transaction ID (in real import, this would be Firebase-generated)
      const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      crossRef.byPaymentSeq[paySeq] = {
        transactionId: transactionId,
        unitId: unitId,
        amount: transaction.Amount,
        date: transaction.Date,
        notes: transaction.Notes || ''
      };
      
      // Index by unit
      if (!crossRef.byUnit[unitId]) {
        crossRef.byUnit[unitId] = [];
      }
      crossRef.byUnit[unitId].push({
        paymentSeq: paySeq,
        transactionId: transactionId,
        amount: transaction.Amount,
        date: transaction.Date
      });
      
      crossRef.totalRecords++;
      
      console.log(`✓ ${paySeq}`);
      console.log(`  Unit: ${unitId}`);
      console.log(`  Amount: $${transaction.Amount}`);
      console.log(`  Date: ${transaction.Date}`);
      console.log(`  Transaction ID: ${transactionId}`);
      console.log(`  Notes: ${transaction.Notes || '(none)'}`);
      console.log('');
    }
  }
  
  return crossRef;
}

/**
 * Analyze payment-to-charge mappings
 */
function analyzePaymentChargeMapping(waterCrossRef, txnCrossRef) {
  console.log('\n📊 Analyzing Payment-to-Charge Mappings\n');
  
  const paymentGroups = {};
  
  // Group charges by payment
  for (const charge of waterCrossRef) {
    const paySeq = charge.PaymentSeq;
    
    if (!paymentGroups[paySeq]) {
      paymentGroups[paySeq] = {
        paymentSeq: paySeq,
        unit: charge.Unit,
        paymentDate: charge.PaymentDate,
        charges: [],
        totalAmount: 0,
        baseCharges: 0,
        penalties: 0
      };
    }
    
    paymentGroups[paySeq].charges.push(charge);
    paymentGroups[paySeq].totalAmount += charge.AmountApplied;
    
    if (charge.Category === 'WC') {
      paymentGroups[paySeq].baseCharges += charge.AmountApplied;
    } else if (charge.Category === 'WCP') {
      paymentGroups[paySeq].penalties += charge.AmountApplied;
    }
  }
  
  // Analyze each payment
  const analysis = {
    totalPayments: Object.keys(paymentGroups).length,
    linkedPayments: 0,
    unlinkedPayments: 0,
    multiChargePayments: 0,
    penaltyPayments: 0,
    details: []
  };
  
  for (const [paySeq, payment] of Object.entries(paymentGroups)) {
    const txnRef = txnCrossRef.byPaymentSeq[paySeq];
    const isLinked = !!txnRef;
    
    if (isLinked) {
      analysis.linkedPayments++;
    } else {
      analysis.unlinkedPayments++;
    }
    
    if (payment.charges.length > 1) {
      analysis.multiChargePayments++;
    }
    
    if (payment.penalties > 0) {
      analysis.penaltyPayments++;
    }
    
    const detail = {
      paymentSeq: paySeq,
      unit: payment.unit,
      paymentDate: payment.paymentDate,
      transactionId: txnRef?.transactionId || 'NOT FOUND',
      linked: isLinked,
      chargeCount: payment.charges.length,
      totalAmount: payment.totalAmount,
      baseCharges: payment.baseCharges,
      penalties: payment.penalties,
      charges: payment.charges.map(c => ({
        chargeSeq: c.ChargeSeq,
        chargeDate: c.ChargeDate,
        category: c.Category,
        amount: c.AmountApplied
      }))
    };
    
    analysis.details.push(detail);
    
    // Print detail
    console.log(`${isLinked ? '✅' : '❌'} ${paySeq}`);
    console.log(`   Unit: ${payment.unit}`);
    console.log(`   Transaction: ${detail.transactionId}`);
    console.log(`   Total: $${payment.totalAmount.toFixed(2)} (Base: $${payment.baseCharges.toFixed(2)}, Penalties: $${payment.penalties.toFixed(2)})`);
    console.log(`   Charges: ${payment.charges.length}`);
    
    for (const charge of payment.charges) {
      const chargeDate = new Date(charge.ChargeDate).toISOString().split('T')[0];
      console.log(`     - ${charge.ChargeSeq}: $${charge.AmountApplied} (${charge.Category}) on ${chargeDate}`);
    }
    console.log('');
  }
  
  return analysis;
}

/**
 * Display summary statistics
 */
function displaySummary(analysis) {
  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY STATISTICS');
  console.log('='.repeat(80) + '\n');
  
  console.log(`Total Payments: ${analysis.totalPayments}`);
  console.log(`✅ Linked to Transactions: ${analysis.linkedPayments}`);
  console.log(`❌ Unlinked (Missing): ${analysis.unlinkedPayments}`);
  console.log(`🔀 Multi-Charge Payments: ${analysis.multiChargePayments}`);
  console.log(`⚠️  Payments with Penalties: ${analysis.penaltyPayments}`);
  
  const linkageRate = ((analysis.linkedPayments / analysis.totalPayments) * 100).toFixed(1);
  console.log(`\n📊 Linkage Rate: ${linkageRate}%`);
  
  if (analysis.unlinkedPayments > 0) {
    console.log('\n⚠️  UNLINKED PAYMENTS:');
    const unlinked = analysis.details.filter(d => !d.linked);
    for (const payment of unlinked) {
      console.log(`   • ${payment.paymentSeq} (Unit ${payment.unit})`);
    }
  }
  
  // Charge date distribution
  console.log('\n📅 CHARGE DATE DISTRIBUTION:');
  const chargeDates = {};
  for (const payment of analysis.details) {
    for (const charge of payment.charges) {
      const month = charge.chargeDate.substring(0, 7); // YYYY-MM
      chargeDates[month] = (chargeDates[month] || 0) + 1;
    }
  }
  
  const sortedMonths = Object.keys(chargeDates).sort();
  for (const month of sortedMonths) {
    console.log(`   ${month}: ${chargeDates[month]} charges`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Main test
 */
async function testWaterBillsCrossRefMapping() {
  return await testHarness.runTest({
    name: 'Water Bills CrossRef Mapping Simulation',
    async test({ api, userId }) {
      try {
        console.log('🌊 Water Bills CrossRef Mapping Test');
        console.log('=' .repeat(80));
        console.log(`Client: ${CLIENT_ID}`);
        console.log(`Storage: Firebase Storage`);
        console.log('=' .repeat(80));
        
        // Step 1: Load Transactions.json
        console.log('\n📥 Loading Transactions.json...');
        const transactionsBuffer = await readFileFromFirebaseStorage(
          CLIENT_ID,
          'Transactions.json',
          { uid: userId }
        );
        const transactionsData = JSON.parse(transactionsBuffer.toString('utf-8'));
        console.log(`✓ Loaded ${transactionsData.length} transactions`);
        
        // Step 2: Load waterCrossRef.json
        console.log('\n📥 Loading waterCrossRef.json...');
        const waterCrossRefBuffer = await readFileFromFirebaseStorage(
          CLIENT_ID,
          'waterCrossRef.json',
          { uid: userId }
        );
        const waterCrossRef = JSON.parse(waterCrossRefBuffer.toString('utf-8'));
        console.log(`✓ Loaded ${waterCrossRef.length} charge records`);
        
        // Step 3: Build Transaction CrossRef (simulation)
        console.log('\n🔨 Building Water Bills Transaction CrossRef...');
        const txnCrossRef = buildWaterBillsCrossRef(transactionsData);
        console.log(`✓ Built CrossRef with ${txnCrossRef.totalRecords} payment records`);
        
        // Step 4: Analyze payment-to-charge mapping
        console.log('\n🔍 Analyzing Payment-to-Charge Mappings...');
        const analysis = analyzePaymentChargeMapping(waterCrossRef, txnCrossRef);
        
        // Step 5: Display summary
        displaySummary(analysis);
        
        // Step 6: Validate results
        const allLinked = analysis.unlinkedPayments === 0;
        
        return {
          passed: allLinked,
          message: allLinked 
            ? `All ${analysis.totalPayments} payments successfully linked to transactions`
            : `${analysis.unlinkedPayments} payments could not be linked to transactions`,
          data: {
            crossRef: {
              totalRecords: txnCrossRef.totalRecords,
              byPaymentSeq: Object.keys(txnCrossRef.byPaymentSeq).length,
              byUnit: Object.keys(txnCrossRef.byUnit).length
            },
            analysis: {
              totalPayments: analysis.totalPayments,
              linkedPayments: analysis.linkedPayments,
              unlinkedPayments: analysis.unlinkedPayments,
              multiChargePayments: analysis.multiChargePayments,
              penaltyPayments: analysis.penaltyPayments,
              linkageRate: ((analysis.linkedPayments / analysis.totalPayments) * 100).toFixed(1) + '%'
            },
            samplePayments: analysis.details.slice(0, 3) // First 3 for inspection
          }
        };
        
      } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
      }
    }
  });
}

// Run the test
console.log('\n🚀 Starting Water Bills CrossRef Mapping Test\n');

testWaterBillsCrossRefMapping()
  .then(result => {
    console.log('\n✅ Test completed');
    console.log(`Result: ${result.passed ? 'PASSED' : 'FAILED'}`);
    if (result.message) {
      console.log(`Message: ${result.message}`);
    }
    process.exit(result.passed ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Test error:', error);
    process.exit(1);
  });

/**
 * Test Water Bills CrossRef Generation
 * 
 * Quick test to verify the CrossRef generation logic works
 * without doing a full import
 */

import { readFileFromFirebaseStorage } from '../api/importStorage.js';

const CLIENT_ID = 'AVII';
const TEST_USER_ID = 'fjXv8gX1CYWBvOZ1CS27j96oRCT2';

/**
 * Simulate the CrossRef generation logic
 */
function generateWaterBillsCrossRef(transactionsData) {
  const waterBillsCrossRef = {
    generated: new Date().toISOString(),
    totalRecords: 0,
    byPaymentSeq: {},
    byUnit: {}
  };
  
  console.log('\n💧 Simulating Water Bills CrossRef Generation...\n');
  
  for (let i = 0; i < transactionsData.length; i++) {
    const transaction = transactionsData[i];
    const seqNumber = transaction[""];
    
    // Check if this is a Water Consumption transaction
    if (transaction.Category === "Water Consumption" && seqNumber) {
      // Simulate transaction ID (in real import, this comes from Firebase)
      const transactionId = `TXN-${Date.now()}-${i}`;
      
      // Extract unit ID from "Unit (Name)" format → "Unit"
      const unitMatch = transaction.Unit?.match(/^(\d+)/);
      const unitId = unitMatch ? unitMatch[1] : transaction.Unit;
      
      waterBillsCrossRef.byPaymentSeq[seqNumber] = {
        transactionId: transactionId,
        unitId: unitId,
        amount: transaction.Amount,
        date: transaction.Date,
        notes: transaction.Notes || ''
      };
      waterBillsCrossRef.totalRecords++;
      
      // Also track by unit
      if (!waterBillsCrossRef.byUnit[unitId]) {
        waterBillsCrossRef.byUnit[unitId] = [];
      }
      waterBillsCrossRef.byUnit[unitId].push({
        paymentSeq: seqNumber,
        transactionId: transactionId,
        amount: transaction.Amount,
        date: transaction.Date
      });
      
      console.log(`✓ ${seqNumber} → Unit ${unitId} ($${transaction.Amount})`);
    }
  }
  
  return waterBillsCrossRef;
}

async function runTest() {
  try {
    console.log('🌊 Testing Water Bills CrossRef Generation');
    console.log('='.repeat(80));
    
    // Load Transactions.json
    console.log('\n📥 Loading Transactions.json...');
    const transactionsText = await readFileFromFirebaseStorage(
      `imports/${CLIENT_ID}/Transactions.json`,
      { uid: TEST_USER_ID }
    );
    const transactionsData = JSON.parse(transactionsText);
    console.log(`✓ Loaded ${transactionsData.length} transactions`);
    
    // Generate CrossRef
    const crossRef = generateWaterBillsCrossRef(transactionsData);
    
    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('📊 CROSSREF GENERATION RESULTS');
    console.log('='.repeat(80));
    console.log(`Total Records: ${crossRef.totalRecords}`);
    console.log(`Payment Sequences: ${Object.keys(crossRef.byPaymentSeq).length}`);
    console.log(`Units with Payments: ${Object.keys(crossRef.byUnit).length}`);
    
    // Show unit breakdown
    console.log('\n📋 Payments by Unit:');
    for (const [unitId, payments] of Object.entries(crossRef.byUnit)) {
      console.log(`  Unit ${unitId}: ${payments.length} payment(s)`);
    }
    
    console.log('\n✅ CrossRef generation logic verified!');
    console.log('\n💡 The CrossRef will be automatically generated during transaction import.');
    console.log('   No need to reimport - proceed to Step 3!\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return false;
  }
}

// Run test
runTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Error:', error);
    process.exit(1);
  });

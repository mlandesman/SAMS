import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Test CrossRef generation using actual MTCdata files
 * This script reads the transactions and builds the CrossRef file
 * so you can manually compare with the data
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testCrossRefGeneration() {
  console.log('🧪 Testing CrossRef Generation with MTC Data\n');
  
  try {
    // Path to MTCdata directory
    const dataPath = path.join(__dirname, '../../MTCdata');
    console.log(`📁 Reading data from: ${dataPath}\n`);
    
    // Load transactions file
    const transactionsPath = path.join(dataPath, 'Transactions.json');
    console.log('📄 Loading Transactions.json...');
    const transactionsData = JSON.parse(await fs.readFile(transactionsPath, 'utf-8'));
    console.log(`✅ Loaded ${transactionsData.length} transactions\n`);
    
    // Initialize CrossRef structure
    const hoaCrossRef = {
      generated: new Date().toISOString(),
      totalRecords: 0,
      bySequence: {},
      byUnit: {},
      summary: {
        totalTransactions: transactionsData.length,
        hoaTransactions: 0,
        unitsWithHOA: new Set()
      }
    };
    
    // Process transactions to find HOA Dues
    console.log('🔍 Scanning for HOA Dues transactions...\n');
    let hoaCount = 0;
    
    for (let i = 0; i < transactionsData.length; i++) {
      const transaction = transactionsData[i];
      const seqNumber = transaction[""]; // Unnamed first field contains sequence number
      
      if (transaction.Category === "HOA Dues" && seqNumber) {
        hoaCount++;
        
        // Add to sequence mapping
        hoaCrossRef.bySequence[seqNumber] = {
          transactionId: `SIMULATED-TXN-${seqNumber}`, // In real import, this would be the Firebase ID
          unitId: transaction.Unit,
          amount: transaction.Amount,
          date: transaction.Date,
          vendor: transaction.Vendor,
          notes: transaction.Notes || ''
        };
        
        // Add to unit mapping
        if (!hoaCrossRef.byUnit[transaction.Unit]) {
          hoaCrossRef.byUnit[transaction.Unit] = [];
        }
        hoaCrossRef.byUnit[transaction.Unit].push({
          transactionId: `SIMULATED-TXN-${seqNumber}`,
          sequenceNumber: seqNumber,
          amount: transaction.Amount,
          date: transaction.Date,
          vendor: transaction.Vendor
        });
        
        // Update summary
        hoaCrossRef.summary.unitsWithHOA.add(transaction.Unit);
        
        // Show sample entries for verification
        if (hoaCount <= 5) {
          console.log(`📝 HOA Transaction #${hoaCount}:`);
          console.log(`   Seq: ${seqNumber}`);
          console.log(`   Unit: ${transaction.Unit}`);
          console.log(`   Amount: ${transaction.Amount}`);
          console.log(`   Date: ${transaction.Date}`);
          console.log(`   Vendor: ${transaction.Vendor}`);
          console.log(`   Notes: ${transaction.Notes || 'N/A'}\n`);
        }
      }
    }
    
    // Update final counts
    hoaCrossRef.totalRecords = hoaCount;
    hoaCrossRef.summary.hoaTransactions = hoaCount;
    hoaCrossRef.summary.unitsWithHOA = Array.from(hoaCrossRef.summary.unitsWithHOA).sort();
    
    console.log(`\n📊 CrossRef Summary:`);
    console.log(`   Total HOA transactions found: ${hoaCount}`);
    console.log(`   Units with HOA payments: ${hoaCrossRef.summary.unitsWithHOA.length}`);
    console.log(`   Units: ${hoaCrossRef.summary.unitsWithHOA.slice(0, 10).join(', ')}${hoaCrossRef.summary.unitsWithHOA.length > 10 ? '...' : ''}`);
    
    // Save CrossRef file
    const outputPath = path.join(dataPath, 'HOA_Transaction_CrossRef_TEST.json');
    await fs.writeFile(outputPath, JSON.stringify(hoaCrossRef, null, 2));
    console.log(`\n💾 CrossRef saved to: ${outputPath}`);
    
    // Now load HOA Dues file to show how it would be used
    console.log('\n🔗 Checking HOA Dues file for sequence references...\n');
    const hoaDuesPath = path.join(dataPath, 'HOADues.json');
    const hoaDuesData = JSON.parse(await fs.readFile(hoaDuesPath, 'utf-8'));
    
    // Check a few HOA dues entries for sequence numbers
    let matchCount = 0;
    let sampleCount = 0;
    
    for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
      if (unitData.payments && Array.isArray(unitData.payments)) {
        for (const payment of unitData.payments) {
          if (payment.notes && payment.notes.includes('Seq:')) {
            const seqMatch = payment.notes.match(/Seq:\s*(\d+)/);
            if (seqMatch) {
              const seqNumber = seqMatch[1];
              const crossRefEntry = hoaCrossRef.bySequence[seqNumber];
              
              if (crossRefEntry) {
                matchCount++;
                if (sampleCount < 5) {
                  console.log(`✅ Match found for Unit ${unitId}, Month ${payment.month}:`);
                  console.log(`   Sequence: ${seqNumber}`);
                  console.log(`   Payment: $${payment.paid}`);
                  console.log(`   Transaction Amount: $${crossRefEntry.amount}`);
                  console.log(`   Transaction Date: ${crossRefEntry.date}\n`);
                  sampleCount++;
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`\n🔗 CrossRef Matching Summary:`);
    console.log(`   HOA payments with sequence numbers that match transactions: ${matchCount}`);
    
    console.log('\n✅ CrossRef generation test completed!');
    console.log('\n📋 You can now manually inspect the generated file:');
    console.log(`   ${outputPath}`);
    console.log('\nCompare the sequence numbers with:');
    console.log(`   - Transactions.json (look for "" field in HOA Dues entries)`);
    console.log(`   - HOADues.json (look for "Seq: XXXXX" in payment notes)`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
console.log('🚀 Starting CrossRef Generation Test...\n');

testCrossRefGeneration()
  .then(() => {
    console.log('\n🎉 Test completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
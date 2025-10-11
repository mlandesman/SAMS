/**
 * Validate that our credit calculation logic matches the final creditBalance
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function validateCreditCalculation() {
  console.log('🔍 Validating Credit Balance Calculation Logic\n');
  
  // Load data files
  const dataPath = path.join(__dirname, '../../MTCdata');
  const hoaDuesData = JSON.parse(await fs.readFile(path.join(dataPath, 'HOADues.json'), 'utf-8'));
  const transactionsData = JSON.parse(await fs.readFile(path.join(dataPath, 'Transactions.json'), 'utf-8'));
  
  // Build transaction lookup by sequence number
  const transactionsBySeq = {};
  for (const tx of transactionsData) {
    const seqNum = tx[''] || tx[0];
    if (seqNum) {
      transactionsBySeq[seqNum] = tx;
    }
  }
  
  // Track validation results
  const results = {
    totalUnits: 0,
    matchingUnits: 0,
    mismatchUnits: 0,
    details: []
  };
  
  // Process each unit
  for (const [unitId, unitData] of Object.entries(hoaDuesData)) {
    results.totalUnits++;
    
    const expectedBalance = Math.round((unitData.creditBalance || 0) * 100); // Convert to centavos
    let calculatedBalance = 0;
    const creditTransactions = [];
    
    // Process each payment for this unit
    if (unitData.payments && Array.isArray(unitData.payments)) {
      for (const payment of unitData.payments) {
        // Extract sequence number from notes
        const seqMatch = payment.notes?.match(/Seq:\s*(\d+)/);
        if (seqMatch) {
          const seqNum = seqMatch[1];
          const transaction = transactionsBySeq[seqNum];
          
          if (transaction) {
            // Find all HOA payments for this sequence
            const hoaPaymentsForSeq = unitData.payments.filter(p => {
              const pSeqMatch = p.notes?.match(/Seq:\s*(\d+)/);
              return pSeqMatch && pSeqMatch[1] === seqNum;
            });
            
            // Calculate credit using same logic as import
            const totalDuesAmount = hoaPaymentsForSeq.reduce((sum, p) => sum + (p.paid * 100), 0);
            const transactionAmount = Math.round(transaction.Amount * 100);
            const creditAmount = transactionAmount - totalDuesAmount;
            
            if (creditAmount !== 0) {
              // Only add once per sequence (avoid duplicates from multiple months)
              const alreadyRecorded = creditTransactions.find(ct => ct.seqNum === seqNum);
              if (!alreadyRecorded) {
                calculatedBalance += creditAmount;
                creditTransactions.push({
                  seqNum,
                  transactionAmount: transactionAmount / 100,
                  duesAmount: totalDuesAmount / 100,
                  creditAmount: creditAmount / 100,
                  type: creditAmount > 0 ? 'added' : 'used',
                  notes: transaction.Notes
                });
              }
            }
          }
        }
      }
    }
    
    // Compare calculated vs expected
    const matches = Math.abs(calculatedBalance - expectedBalance) < 1; // Allow for rounding
    
    if (matches) {
      results.matchingUnits++;
    } else {
      results.mismatchUnits++;
    }
    
    results.details.push({
      unitId,
      expected: expectedBalance / 100,
      calculated: calculatedBalance / 100,
      difference: (calculatedBalance - expectedBalance) / 100,
      matches,
      creditTransactionCount: creditTransactions.length,
      creditTransactions
    });
  }
  
  // Print summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('                   VALIDATION SUMMARY                  ');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total Units:      ${results.totalUnits}`);
  console.log(`✅ Matching:      ${results.matchingUnits}`);
  console.log(`❌ Mismatches:    ${results.mismatchUnits}`);
  console.log(`Success Rate:     ${((results.matchingUnits / results.totalUnits) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Print detailed results
  console.log('DETAILED RESULTS BY UNIT:\n');
  
  for (const detail of results.details) {
    const icon = detail.matches ? '✅' : '❌';
    console.log(`${icon} Unit ${detail.unitId}:`);
    console.log(`   Expected:   $${detail.expected.toFixed(2)}`);
    console.log(`   Calculated: $${detail.calculated.toFixed(2)}`);
    
    if (!detail.matches) {
      console.log(`   ⚠️ Difference: $${detail.difference.toFixed(2)}`);
    }
    
    if (detail.creditTransactions.length > 0) {
      console.log(`   Credit Transactions: ${detail.creditTransactions.length}`);
      for (const ct of detail.creditTransactions) {
        console.log(`      Seq ${ct.seqNum}: $${ct.transactionAmount} - $${ct.duesAmount} = $${ct.creditAmount} (${ct.type})`);
      }
    }
    console.log('');
  }
  
  // Print mismatches in detail if any
  if (results.mismatchUnits > 0) {
    console.log('\n⚠️  MISMATCHES REQUIRE INVESTIGATION:\n');
    for (const detail of results.details.filter(d => !d.matches)) {
      console.log(`Unit ${detail.unitId}:`);
      console.log(`  Expected: $${detail.expected.toFixed(2)}, Calculated: $${detail.calculated.toFixed(2)}`);
      console.log(`  Difference: $${detail.difference.toFixed(2)}`);
      console.log('');
    }
  }
  
  return results;
}

// Run validation
validateCreditCalculation()
  .then(results => {
    if (results.mismatchUnits === 0) {
      console.log('🎉 All credit calculations match! Logic is correct.');
      process.exit(0);
    } else {
      console.log('⚠️  Some mismatches found. Review output above.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });


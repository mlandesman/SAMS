/**
 * Targeted Cleanup: Fix Credit Balance History Contamination
 * 
 * Purpose: Clean contaminated centavos values in credit balance history arrays
 * that were migrated from the old structure to the new /units/creditBalances structure.
 * 
 * Usage: node backend/scripts/cleanupCreditBalanceHistory.js [clientId]
 */

import { getDb } from '../firebase.js';
import { validateCentavos } from '../utils/centavosValidation.js';

const stats = {
  unitsProcessed: 0,
  historyEntriesCleaned: 0,
  fieldsCleaned: 0,
  errors: []
};

async function cleanupCreditBalanceHistory(clientId) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧹 CLEANING CREDIT BALANCE HISTORY - Client: ${clientId}`);
  console.log(`${'='.repeat(80)}\n`);
  
  const db = await getDb();
  
  try {
    // Get the creditBalances document
    const creditBalancesRef = db.doc(`clients/${clientId}/units/creditBalances`);
    const creditBalancesDoc = await creditBalancesRef.get();
    
    if (!creditBalancesDoc.exists) {
      console.log('❌ No creditBalances document found');
      return stats;
    }
    
    const allCreditBalances = creditBalancesDoc.data();
    const unitIds = Object.keys(allCreditBalances);
    console.log(`📊 Found ${unitIds.length} units with credit balances\n`);
    
    let documentNeedsUpdate = false;
    
    for (const unitId of unitIds) {
      const unitData = allCreditBalances[unitId];
      console.log(`🏠 Processing Unit ${unitId}...`);
      
      if (!unitData.history || !Array.isArray(unitData.history)) {
        console.log(`   ⏭️  No history array\n`);
        continue;
      }
      
      let unitHadContamination = false;
      stats.unitsProcessed++;
      
      // Clean each history entry
      for (let i = 0; i < unitData.history.length; i++) {
        const entry = unitData.history[i];
        let entryChanged = false;
        
        // Check and clean amount
        if (entry.amount !== undefined && !Number.isInteger(entry.amount)) {
          const cleaned = Math.round(entry.amount);
          console.log(`   📝 history[${i}].amount: ${entry.amount} → ${cleaned}`);
          entry.amount = cleaned;
          entryChanged = true;
          stats.fieldsCleaned++;
        }
        
        // Check and clean balance
        if (entry.balance !== undefined && !Number.isInteger(entry.balance)) {
          const cleaned = Math.round(entry.balance);
          console.log(`   📝 history[${i}].balance: ${entry.balance} → ${cleaned}`);
          entry.balance = cleaned;
          entryChanged = true;
          stats.fieldsCleaned++;
        }
        
        // Check and clean balanceBefore
        if (entry.balanceBefore !== undefined && !Number.isInteger(entry.balanceBefore)) {
          const cleaned = Math.round(entry.balanceBefore);
          console.log(`   📝 history[${i}].balanceBefore: ${entry.balanceBefore} → ${cleaned}`);
          entry.balanceBefore = cleaned;
          entryChanged = true;
          stats.fieldsCleaned++;
        }
        
        // Check and clean balanceAfter
        if (entry.balanceAfter !== undefined && !Number.isInteger(entry.balanceAfter)) {
          const cleaned = Math.round(entry.balanceAfter);
          console.log(`   📝 history[${i}].balanceAfter: ${entry.balanceAfter} → ${cleaned}`);
          entry.balanceAfter = cleaned;
          entryChanged = true;
          stats.fieldsCleaned++;
        }
        
        if (entryChanged) {
          unitHadContamination = true;
          stats.historyEntriesCleaned++;
        }
      }
      
      if (unitHadContamination) {
        documentNeedsUpdate = true;
        console.log(`   ✅ Cleaned unit ${unitId} history\n`);
      } else {
        console.log(`   ✅ Unit ${unitId} history already clean\n`);
      }
    }
    
    // Update the document if any changes were made
    if (documentNeedsUpdate) {
      await creditBalancesRef.set(allCreditBalances);
      console.log(`💾 Updated creditBalances document with cleaned history\n`);
    } else {
      console.log(`✅ No updates needed - all history already clean\n`);
    }
    
  } catch (error) {
    console.error(`❌ Error cleaning credit balance history:`, error);
    stats.errors.push(error.message);
  }
  
  // Print summary
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 CLEANUP SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Units processed: ${stats.unitsProcessed}`);
  console.log(`History entries cleaned: ${stats.historyEntriesCleaned}`);
  console.log(`Fields cleaned: ${stats.fieldsCleaned}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`${'='.repeat(80)}\n`);
  
  return stats;
}

// Parse command line arguments
const clientId = process.argv[2] || 'AVII';

// Run cleanup
cleanupCreditBalanceHistory(clientId)
  .then(() => {
    console.log('✅ Cleanup completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });


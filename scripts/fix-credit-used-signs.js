#!/usr/bin/env node
/**
 * fix-credit-used-signs.js
 * 
 * PROBLEM: In production, credit_used history entries have POSITIVE amounts
 * but they should be NEGATIVE (credit is being used/subtracted).
 * 
 * The getCreditBalance() getter sums all amounts, so positive credit_used
 * causes the balance to be way too high.
 * 
 * This script:
 * 1. Finds all credit_used entries with positive amounts
 * 2. Negates them to be negative
 * 3. Optionally removes the stale creditBalance field
 * 
 * Usage:
 *   DRY RUN (default):  FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-credit-used-signs.js MTC
 *   LIVE RUN:           FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-credit-used-signs.js MTC --live
 */

import { initializeFirebase } from './utils/environment-config.js';

const clientId = process.argv[2];
const isLive = process.argv.includes('--live');

if (!clientId) {
  console.error('Usage: node scripts/fix-credit-used-signs.js <clientId> [--live]');
  console.error('Example: FIRESTORE_ENV=prod USE_ADC=true node scripts/fix-credit-used-signs.js MTC --live');
  process.exit(1);
}

console.log(`\n${'='.repeat(60)}`);
console.log(`FIX CREDIT_USED SIGNS FOR ${clientId}`);
console.log(`Mode: ${isLive ? '🔴 LIVE - WILL MODIFY DATABASE' : '🟡 DRY RUN - Preview only'}`);
console.log(`${'='.repeat(60)}\n`);

const { db } = await initializeFirebase();

async function fixCreditUsedSigns() {
  // Fetch creditBalances document
  const creditBalancesRef = db.collection('clients').doc(clientId)
    .collection('units').doc('creditBalances');
  
  const doc = await creditBalancesRef.get();
  
  if (!doc.exists) {
    console.log('❌ No creditBalances document found');
    process.exit(1);
  }
  
  const data = doc.data();
  const updatedData = {};
  let totalFixes = 0;
  let unitsWithFixes = 0;
  
  for (const [unitId, unitData] of Object.entries(data)) {
    if (unitId === '_id') continue; // Skip metadata
    
    if (!unitData.history || !Array.isArray(unitData.history)) {
      updatedData[unitId] = unitData;
      continue;
    }
    
    let unitFixes = 0;
    const fixedHistory = unitData.history.map(entry => {
      // Check if this is a credit_used with positive amount
      if (entry.type === 'credit_used' && typeof entry.amount === 'number' && entry.amount > 0) {
        unitFixes++;
        totalFixes++;
        console.log(`  📍 ${unitId}: Fixing credit_used entry`);
        console.log(`     Transaction: ${entry.transactionId || 'N/A'}`);
        console.log(`     Old amount: +${entry.amount} → New amount: -${entry.amount}`);
        
        return {
          ...entry,
          amount: -entry.amount // Negate the amount
        };
      }
      
      // Check for starting_balance that describes a DEBIT (owed money) but has positive amount
      // These should be negative because they represent a debt, not a credit
      if (entry.type === 'starting_balance' && 
          typeof entry.amount === 'number' && 
          entry.amount > 0 &&
          (entry.description?.toLowerCase().includes('debit') || 
           entry.note?.toLowerCase().includes('debit'))) {
        unitFixes++;
        totalFixes++;
        console.log(`  📍 ${unitId}: Fixing starting_balance (debit) entry`);
        console.log(`     Description: ${entry.description || entry.note}`);
        console.log(`     Old amount: +${entry.amount} → New amount: -${entry.amount}`);
        
        return {
          ...entry,
          amount: -entry.amount // Negate the amount (debit = negative)
        };
      }
      
      return entry;
    });
    
    if (unitFixes > 0) {
      unitsWithFixes++;
      
      // Calculate new balance by summing history
      const newBalance = fixedHistory.reduce((sum, e) => {
        return sum + (typeof e.amount === 'number' ? e.amount : 0);
      }, 0);
      
      console.log(`  ✅ ${unitId}: ${unitFixes} entries fixed`);
      console.log(`     Old stale creditBalance: ${unitData.creditBalance || 'N/A'}`);
      console.log(`     New calculated balance: ${newBalance} centavos ($${(newBalance/100).toFixed(2)})\n`);
    }
    
    // Create updated unit data WITHOUT stale creditBalance field
    const { creditBalance, ...cleanUnitData } = unitData;
    updatedData[unitId] = {
      ...cleanUnitData,
      history: fixedHistory
    };
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total credit_used entries fixed: ${totalFixes}`);
  console.log(`Units affected: ${unitsWithFixes}`);
  console.log(`Stale creditBalance fields removed: YES (from all units)`);
  
  if (isLive) {
    console.log(`\n🔴 LIVE MODE: Writing to database...`);
    await creditBalancesRef.set(updatedData);
    console.log(`✅ Database updated successfully!`);
  } else {
    console.log(`\n🟡 DRY RUN: No changes made.`);
    console.log(`   Add --live flag to apply changes.`);
  }
}

await fixCreditUsedSigns();
process.exit(0);


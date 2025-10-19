#!/usr/bin/env node

/**
 * Water Bills Delete Reversal Test
 * Tests credit reversal when deleting a water bills transaction
 */

import fetch from 'node-fetch';
import { tokenManager } from './tokenManager.js';

const BASE_URL = 'http://localhost:5001';
const CLIENT_ID = 'AVII';
const UNIT_ID = '106';

const TRANSACTION_ID = process.argv[2];

if (!TRANSACTION_ID) {
  console.error('❌ ERROR: Please provide transaction ID as argument');
  console.log('\nUsage: node testWaterBillsDeleteReversal.js <transactionId>');
  console.log('Example: node testWaterBillsDeleteReversal.js 2025-10-16_132218_947\n');
  process.exit(1);
}

async function testDeleteReversal() {
  console.log('\n🧪 Water Bills Delete Reversal Test');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // Get authentication token
    console.log('🔑 Getting authentication token...');
    const token = await tokenManager.getToken();
    console.log('✅ Token obtained\n');
    
    // STEP 1: Get current credit balance
    console.log(`📋 STEP 1: Checking credit balance for Unit ${UNIT_ID}...`);
    
    const creditBeforeResponse = await fetch(`${BASE_URL}/credit/${CLIENT_ID}/${UNIT_ID}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!creditBeforeResponse.ok) {
      throw new Error(`Failed to get credit balance: ${creditBeforeResponse.statusText}`);
    }
    
    const creditBefore = await creditBeforeResponse.json();
    console.log(`💰 Credit balance BEFORE: ${creditBefore.creditBalanceDisplay}`);
    console.log(`   (${creditBefore.creditBalance * 100} centavos)\n`);
    
    // STEP 2: Get credit history
    console.log(`📋 STEP 2: Checking credit history for transaction entries...`);
    
    const historyBeforeResponse = await fetch(`${BASE_URL}/credit/${CLIENT_ID}/${UNIT_ID}/history?limit=20`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const historyBefore = await historyBeforeResponse.json();
    const entriesForTransaction = historyBefore.history.filter(e => e.transactionId === TRANSACTION_ID);
    
    console.log(`📜 Found ${entriesForTransaction.length} credit entries for transaction ${TRANSACTION_ID}`);
    if (entriesForTransaction.length > 0) {
      entriesForTransaction.forEach(entry => {
        console.log(`   - ${entry.note}: $${entry.amount}`);
      });
    }
    console.log('');
    
    // STEP 3: Delete the transaction
    console.log(`📋 STEP 3: Deleting transaction ${TRANSACTION_ID}...`);
    
    const deleteResponse = await fetch(`${BASE_URL}/clients/${CLIENT_ID}/transactions/${TRANSACTION_ID}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      throw new Error(`Delete failed (${deleteResponse.status}): ${errorText}`);
    }
    
    console.log(`✅ Delete succeeded: ${deleteResponse.status}\n`);
    
    // Wait for processing
    console.log('⏱️  Waiting 3 seconds for processing...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // STEP 4: Verify reversal
    console.log(`📋 STEP 4: Verifying reversal effects...\n`);
    
    // Check credit balance after
    const creditAfterResponse = await fetch(`${BASE_URL}/credit/${CLIENT_ID}/${UNIT_ID}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const creditAfter = await creditAfterResponse.json();
    console.log(`💰 Credit balance AFTER: ${creditAfter.creditBalanceDisplay}`);
    console.log(`   (${creditAfter.creditBalance * 100} centavos)`);
    
    const creditChange = (creditAfter.creditBalance - creditBefore.creditBalance) * 100;
    console.log(`📊 Credit change: ${creditChange > 0 ? '+' : ''}${creditChange} centavos ($${(creditChange / 100).toFixed(2)})\n`);
    
    // Check history for reversal entry
    const historyAfterResponse = await fetch(`${BASE_URL}/credit/${CLIENT_ID}/${UNIT_ID}/history?limit=20`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const historyAfter = await historyAfterResponse.json();
    const reversalEntry = historyAfter.history.find(e => e.transactionId === `${TRANSACTION_ID}_reversal`);
    const stillHasOriginal = historyAfter.history.filter(e => e.transactionId === TRANSACTION_ID);
    
    // TEST SUMMARY
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ Transaction Deleted:        YES');
    console.log(`${reversalEntry ? '✅' : '❌'} Reversal Entry Created:     ${reversalEntry ? 'YES' : 'NO'}`);
    console.log(`${stillHasOriginal.length === 0 ? '✅' : '❌'} Original Entries Removed:    ${stillHasOriginal.length === 0 ? 'YES' : 'NO (' + stillHasOriginal.length + ' remaining)'}`);
    console.log(`📊 Credit Balance Restored:    ${creditChange > 0 ? '+' : ''}$${(creditChange / 100).toFixed(2)}`);
    
    if (reversalEntry) {
      console.log('');
      console.log('Reversal Entry Details:');
      console.log(`  Note: ${reversalEntry.note}`);
      console.log(`  Amount: $${reversalEntry.amount}`);
      console.log(`  Balance After: $${reversalEntry.balance}`);
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(reversalEntry && stillHasOriginal.length === 0 ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

testDeleteReversal();


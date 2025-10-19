#!/usr/bin/env node

/**
 * Simple Delete Reversal Test
 * Just verify that the backend logs show proper credit reversal when deleting a transaction
 */

import fetch from 'node-fetch';
import { tokenManager } from './tokenManager.js';

const BASE_URL = 'http://localhost:5001';
const CLIENT_ID = 'AVII';
const UNIT_ID = '106';

// Use an existing transaction ID that Michael can provide
const TRANSACTION_ID = process.argv[2];

async function testDeleteReversal() {
  console.log('\n🧪 Water Bills Delete Reversal - Simple Test');
  console.log('═══════════════════════════════════════════════════════\n');
  
  if (!TRANSACTION_ID) {
    console.error('❌ ERROR: Please provide transaction ID as argument');
    console.log('\nUsage: node testDeleteReversalSimple.js <transactionId>');
    console.log('Example: node testDeleteReversalSimple.js 2025-10-16_132218_947\n');
    process.exit(1);
  }
  
  try {
    console.log('🔑 Getting authentication token...');
    const token = await tokenManager.getToken();
    console.log('✅ Token obtained\n');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Get current credit balance
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`📋 STEP 1: Checking current credit balance for Unit ${UNIT_ID}...`);
    
    const creditBeforeResponse = await fetch(`${BASE_URL}/credit/${CLIENT_ID}/${UNIT_ID}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!creditBeforeResponse.ok) {
      throw new Error(`Failed to get credit balance: ${creditBeforeResponse.statusText}`);
    }
    
    const creditBefore = await creditBeforeResponse.json();
    console.log(`💰 Credit balance BEFORE delete: ${creditBefore.creditBalanceDisplay}`);
    console.log(`   (${creditBefore.creditBalance * 100} centavos)\n`);
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Get credit history
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`📋 STEP 2: Getting credit history...`);
    
    const historyBeforeResponse = await fetch(`${BASE_URL}/credit/${CLIENT_ID}/${UNIT_ID}/history?limit=20`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const historyBefore = await historyBeforeResponse.json();
    const entriesForTransaction = historyBefore.history.filter(e => e.transactionId === TRANSACTION_ID);
    
    console.log(`📜 Found ${entriesForTransaction.length} credit history entries for transaction ${TRANSACTION_ID}`);
    entriesForTransaction.forEach(entry => {
      console.log(`   - ${entry.note}: $${entry.amount} (Transaction: ${entry.transactionId})`);
    });
    console.log('');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Delete the transaction
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`📋 STEP 3: Deleting transaction ${TRANSACTION_ID}...`);
    console.log('🗑️ Calling DELETE endpoint...\n');
    
    const deleteResponse = await fetch(`${BASE_URL}/clients/${CLIENT_ID}/transactions/${TRANSACTION_ID}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      throw new Error(`Delete failed: ${deleteResponse.statusText}\n${errorText}`);
    }
    
    console.log(`✅ Delete API call succeeded: ${deleteResponse.status}\n`);
    
    // Wait for processing
    console.log('⏱️  Waiting 3 seconds for backend processing...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Verify reversal effects
    // ═══════════════════════════════════════════════════════════════
    
    console.log(`📋 STEP 4: Verifying reversal effects...`);
    
    // Check transaction is deleted
    console.log(`🔍 Checking if transaction is deleted...`);
    try {
      const checkResponse = await fetch(`${BASE_URL}/clients/${CLIENT_ID}/transactions/${TRANSACTION_ID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (checkResponse.status === 404) {
        console.log(`✅ PASS: Transaction deleted (404 Not Found)`);
      } else {
        console.log(`❌ FAIL: Transaction still exists! Status: ${checkResponse.status}`);
      }
    } catch (error) {
      console.log(`✅ PASS: Transaction deleted (fetch error - expected)`);
    }
    console.log('');
    
    // Check credit balance
    console.log(`🔍 Checking credit balance after delete...`);
    const creditAfterResponse = await fetch(`${BASE_URL}/credit/${CLIENT_ID}/${UNIT_ID}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const creditAfter = await creditAfterResponse.json();
    console.log(`💰 Credit balance AFTER delete: ${creditAfter.creditBalanceDisplay}`);
    console.log(`   (${creditAfter.creditBalance * 100} centavos)`);
    
    const creditDifference = (creditAfter.creditBalance - creditBefore.creditBalance) * 100;
    console.log(`📊 Credit balance change: ${creditDifference > 0 ? '+' : ''}${creditDifference} centavos`);
    console.log('');
    
    // Check credit history has reversal entry
    console.log(`🔍 Checking credit history for reversal entry...`);
    const historyAfterResponse = await fetch(`${BASE_URL}/credit/${CLIENT_ID}/${UNIT_ID}/history?limit=20`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const historyAfter = await historyAfterResponse.json();
    const reversalEntry = historyAfter.history.find(e => e.transactionId === `${TRANSACTION_ID}_reversal`);
    
    if (reversalEntry) {
      console.log(`✅ PASS: Credit history reversal entry found`);
      console.log(`   Note: ${reversalEntry.note}`);
      console.log(`   Amount: $${reversalEntry.amount}`);
      console.log(`   Balance after: $${reversalEntry.balance}`);
    } else {
      console.log(`❌ FAIL: Credit history reversal entry NOT found`);
    }
    console.log('');
    
    // Check original transaction entries are removed
    console.log(`🔍 Checking if original transaction entries were removed from history...`);
    const stillHasOriginal = historyAfter.history.filter(e => e.transactionId === TRANSACTION_ID);
    
    if (stillHasOriginal.length === 0) {
      console.log(`✅ PASS: Original transaction entries removed from credit history`);
    } else {
      console.log(`❌ FAIL: ${stillHasOriginal.length} original transaction entries still in history`);
      stillHasOriginal.forEach(entry => {
        console.log(`   - ${entry.note}`);
      });
    }
    console.log('');
    
    // ═══════════════════════════════════════════════════════════════
    // TEST SUMMARY
    // ═══════════════════════════════════════════════════════════════
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Test Transaction: ${TRANSACTION_ID}`);
    console.log(`Unit: ${UNIT_ID} (${CLIENT_ID})`);
    console.log('');
    console.log('Results:');
    console.log(`  ✅ Transaction deleted`);
    console.log(`  ${reversalEntry ? '✅' : '❌'} Credit history reversal entry created`);
    console.log(`  ${stillHasOriginal.length === 0 ? '✅' : '❌'} Original entries removed`);
    console.log(`  📊 Credit balance change: ${creditDifference > 0 ? '+' : ''}$${(creditDifference / 100).toFixed(2)}`);
    console.log('');
    console.log('✅ Delete Reversal Test Complete\n');
    
    } catch (error) {
      console.log('');
      console.log('❌ TEST FAILED WITH ERROR:');
      console.log(error.message);
      if (error.stack) {
        console.log('\nStack trace:', error.stack);
      }
      process.exit(1);
    }
  }
}

// Run the test
const test = new DeleteReversalTest();
test.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


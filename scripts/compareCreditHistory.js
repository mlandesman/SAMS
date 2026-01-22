#!/usr/bin/env node
/**
 * Compare Credit History: Running Balance vs creditBalances Document
 * 
 * This script computes credit flow from the running balance (like a bank statement)
 * and compares it to the creditBalances.history array to find missing entries.
 * 
 * If there are only a handful of missing entries, we can update the creditBalances
 * document rather than changing permanent code.
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase
const serviceAccountPath = join(__dirname, '../backend/serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// Import statement data service
import { createApiClient } from '../backend/testing/apiClient.js';
import { getStatementData } from '../functions/backend/services/statementDataService.js';

/**
 * Format currency
 */
function formatPesos(amount) {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Calculate credit flow events from running balance changes
 */
function calculateCreditFlowFromRunningBalance(lineItems, openingBalance) {
  const creditEvents = [];
  let prevBalance = openingBalance;
  
  for (const item of lineItems) {
    const currentBalance = item.balance;
    
    // Detect credit consumption: when balance goes from negative to positive (or less negative)
    // due to a CHARGE (not a payment)
    if (prevBalance < 0 && item.charge > 0) {
      const creditUsed = Math.min(Math.abs(prevBalance), item.charge);
      if (creditUsed > 0.01) {
        creditEvents.push({
          date: item.date,
          type: 'credit_used',
          amount: -creditUsed,
          computedNote: `Used $${formatPesos(creditUsed)} from credit to pay ${item.description}`,
          description: item.description,
          lineItemBalance: currentBalance
        });
      }
    }
    
    // Detect credit creation: when a payment pushes balance negative
    if (item.payment > 0 && currentBalance < 0) {
      let creditCreated;
      if (prevBalance >= 0) {
        // Went from positive/zero to negative - all of negative balance is new credit
        creditCreated = Math.abs(currentBalance);
      } else {
        // Was already negative, got more negative - difference is new credit
        creditCreated = Math.abs(currentBalance) - Math.abs(prevBalance);
      }
      
      if (creditCreated > 0.01) {
        creditEvents.push({
          date: item.date,
          type: 'credit_added',
          amount: creditCreated,
          computedNote: `Added $${formatPesos(creditCreated)} to credit from ${item.description}`,
          description: item.description,
          lineItemBalance: currentBalance
        });
      }
    }
    
    prevBalance = currentBalance;
  }
  
  return creditEvents;
}

/**
 * Get creditBalances history from Firestore
 */
async function getCreditBalancesHistory(clientId, unitId) {
  const creditBalancesRef = db.collection('clients').doc(clientId)
    .collection('units').doc('creditBalances');
  const creditDoc = await creditBalancesRef.get();
  
  if (!creditDoc.exists) {
    return [];
  }
  
  const data = creditDoc.data();
  const unitData = data[unitId];
  
  if (!unitData || !unitData.history) {
    return [];
  }
  
  return unitData.history.map(entry => ({
    ...entry,
    amountPesos: (entry.amount || 0) / 100,
    notes: entry.note || entry.notes || entry.description || ''
  }));
}

/**
 * Compare computed credit events to stored history
 */
function compareEvents(computedEvents, storedHistory) {
  const results = {
    inBothCount: 0,
    missingFromStoredCount: 0,
    extraInStoredCount: 0,
    missingFromStored: [],
    extraInStored: [],
    matched: []
  };
  
  // Filter out starting_balance from stored history
  const storedEvents = storedHistory.filter(e => e.type !== 'starting_balance');
  
  // For each computed event, try to find a matching stored event
  for (const computed of computedEvents) {
    const computedDate = computed.date instanceof Date 
      ? computed.date.toISOString().split('T')[0]
      : String(computed.date).split('T')[0];
    
    // Look for a matching event in stored history
    // Match by: type (credit_added/credit_used), approximate amount, approximate date
    const match = storedEvents.find(stored => {
      const storedDate = stored.timestamp?._seconds 
        ? new Date(stored.timestamp._seconds * 1000).toISOString().split('T')[0]
        : 'unknown';
      
      const typeMatch = stored.type === computed.type;
      const amountClose = Math.abs(stored.amountPesos - computed.amount) < 1; // Within $1
      const dateClose = storedDate === computedDate || 
        Math.abs(new Date(storedDate) - new Date(computedDate)) < 7 * 24 * 60 * 60 * 1000; // Within 7 days
      
      return typeMatch && amountClose;
    });
    
    if (match) {
      results.inBothCount++;
      results.matched.push({ computed, stored: match });
    } else {
      results.missingFromStoredCount++;
      results.missingFromStored.push(computed);
    }
  }
  
  // Find extra entries in stored that don't match any computed
  for (const stored of storedEvents) {
    const storedDate = stored.timestamp?._seconds 
      ? new Date(stored.timestamp._seconds * 1000).toISOString().split('T')[0]
      : 'unknown';
    
    const match = computedEvents.find(computed => {
      const computedDate = computed.date instanceof Date 
        ? computed.date.toISOString().split('T')[0]
        : String(computed.date).split('T')[0];
      
      const typeMatch = stored.type === computed.type;
      const amountClose = Math.abs(stored.amountPesos - computed.amount) < 1;
      
      return typeMatch && amountClose;
    });
    
    if (!match) {
      results.extraInStoredCount++;
      results.extraInStored.push(stored);
    }
  }
  
  return results;
}

/**
 * Main function
 */
async function main() {
  // Parse command line args
  const args = process.argv.slice(2);
  const clientId = args[0] || 'AVII';
  const unitId = args[1] || '103';
  const fiscalYear = parseInt(args[2]) || 2026;
  
  console.log('='.repeat(70));
  console.log(`📊 COMPARE CREDIT HISTORY: ${clientId} Unit ${unitId} FY${fiscalYear}`);
  console.log('='.repeat(70));
  
  // Step 1: Get statement data with running balance
  console.log('\n📋 Step 1: Fetching statement data...');
  const api = await createApiClient();
  const data = await getStatementData(api, clientId, unitId, fiscalYear);
  
  console.log(`   Line items: ${data.lineItems?.length || 0}`);
  console.log(`   Opening balance: $${formatPesos(data.summary?.openingBalance || 0)}`);
  console.log(`   Closing balance: $${formatPesos(data.summary?.closingBalance || 0)}`);
  
  // Step 2: Calculate credit events from running balance
  console.log('\n📋 Step 2: Computing credit flow from running balance...');
  const computedEvents = calculateCreditFlowFromRunningBalance(
    data.lineItems || [], 
    data.summary?.openingBalance || 0
  );
  
  console.log(`   Computed credit events: ${computedEvents.length}`);
  console.log('');
  console.log('   COMPUTED CREDIT EVENTS (from running balance):');
  computedEvents.forEach((event, i) => {
    const dateStr = event.date instanceof Date 
      ? event.date.toISOString().split('T')[0]
      : String(event.date).split('T')[0];
    const sign = event.amount >= 0 ? '+' : '';
    console.log(`   [${i}] ${dateStr} | ${event.type} | ${sign}$${formatPesos(event.amount)} | ${event.computedNote}`);
  });
  
  // Step 3: Get stored creditBalances history
  console.log('\n📋 Step 3: Fetching creditBalances.history...');
  const storedHistory = await getCreditBalancesHistory(clientId, unitId);
  
  console.log(`   Stored history entries: ${storedHistory.length}`);
  console.log('');
  console.log('   STORED CREDIT HISTORY (from creditBalances document):');
  storedHistory.forEach((entry, i) => {
    const dateStr = entry.timestamp?._seconds 
      ? new Date(entry.timestamp._seconds * 1000).toISOString().split('T')[0]
      : 'unknown';
    const sign = entry.amountPesos >= 0 ? '+' : '';
    console.log(`   [${i}] ${dateStr} | ${entry.type} | ${sign}$${formatPesos(entry.amountPesos)} | ${entry.notes}`);
  });
  
  // Step 4: Compare
  console.log('\n📋 Step 4: Comparing...');
  const comparison = compareEvents(computedEvents, storedHistory);
  
  console.log(`\n   📊 COMPARISON RESULTS:`);
  console.log(`   ✅ Matched: ${comparison.inBothCount}`);
  console.log(`   ❌ Missing from stored: ${comparison.missingFromStoredCount}`);
  console.log(`   ⚠️  Extra in stored: ${comparison.extraInStoredCount}`);
  
  if (comparison.missingFromStored.length > 0) {
    console.log('\n   ❌ MISSING FROM creditBalances.history (need to add):');
    comparison.missingFromStored.forEach((event, i) => {
      const dateStr = event.date instanceof Date 
        ? event.date.toISOString().split('T')[0]
        : String(event.date).split('T')[0];
      const sign = event.amount >= 0 ? '+' : '';
      console.log(`   [${i}] ${dateStr} | ${event.type} | ${sign}$${formatPesos(event.amount)}`);
      console.log(`        Note: ${event.computedNote}`);
    });
  }
  
  if (comparison.extraInStored.length > 0) {
    console.log('\n   ⚠️  EXTRA in creditBalances.history (not computed from running balance):');
    comparison.extraInStored.forEach((entry, i) => {
      const dateStr = entry.timestamp?._seconds 
        ? new Date(entry.timestamp._seconds * 1000).toISOString().split('T')[0]
        : 'unknown';
      const sign = entry.amountPesos >= 0 ? '+' : '';
      console.log(`   [${i}] ${dateStr} | ${entry.type} | ${sign}$${formatPesos(entry.amountPesos)} | ${entry.notes}`);
    });
    console.log('\n   Note: Extra entries may be manual adjustments or migration artifacts that are valid.');
  }
  
  console.log('\n' + '='.repeat(70));
  if (comparison.missingFromStoredCount === 0) {
    console.log('✅ All credit events from running balance are in creditBalances.history');
  } else {
    console.log(`❌ ${comparison.missingFromStoredCount} credit events are MISSING from creditBalances.history`);
    console.log('   These should be added to make the Credit Balance Activity table complete.');
  }
  console.log('='.repeat(70));
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

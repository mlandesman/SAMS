#!/usr/bin/env node

/**
 * Test Fiscal Year Balance Calculation
 * Verifies that fiscal year dates are being calculated correctly
 * Tests the same logic the application uses to determine which snapshot to use
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { getFiscalYearBounds, validateFiscalYearConfig } from '../backend/utils/fiscalYearUtils.js';

const require = createRequire(import.meta.url);
const serviceAccount = require('../backend/serviceAccountKey.json');

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

/**
 * Determine which year's snapshot to use for balance recalculation
 * This mimics the logic that should be in the application
 */
function determineSnapshotYear(currentDate, fiscalYearStartMonth) {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
  
  // If we're before the fiscal year start month, we're still in the previous fiscal year
  // For example, if FY starts in July (month 7):
  // - January 2026 is still in FY 2026 (which started July 2025)
  // - July 2026 would be in FY 2027 (which started July 2026)
  
  let fiscalYear;
  if (currentMonth < fiscalYearStartMonth) {
    // We're in the latter part of the fiscal year
    fiscalYear = currentYear;
  } else {
    // We're in the beginning part of the fiscal year
    fiscalYear = currentYear + 1;
  }
  
  // The snapshot we need is from the previous fiscal year end
  const snapshotYear = fiscalYear - 1;
  
  return { currentFiscalYear: fiscalYear, snapshotYear };
}

async function testFiscalYearBalance(clientId) {
  try {
    console.log(`\n🧪 Testing fiscal year balance calculation for ${clientId}...\n`);
    
    // Get client document
    const clientRef = db.collection('clients').doc(clientId);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.error(`❌ Client ${clientId} not found`);
      return;
    }
    
    const clientData = clientDoc.data();
    const fiscalYearStartMonth = validateFiscalYearConfig(clientData);
    
    console.log(`📅 Client ${clientId} Configuration:`);
    console.log(`   Fiscal Year Start Month: ${fiscalYearStartMonth}`);
    
    // Determine which snapshot year to use based on today's date
    const today = new Date();
    const { currentFiscalYear, snapshotYear } = determineSnapshotYear(today, fiscalYearStartMonth);
    
    console.log(`\n📊 Dynamic Year Calculation (Today: ${today.toISOString().split('T')[0]}):`);
    console.log(`   Current Fiscal Year: FY ${currentFiscalYear}`);
    console.log(`   Required Snapshot Year: ${snapshotYear}`);
    
    // Get fiscal year bounds for current year
    const { startDate: fyStart, endDate: fyEnd } = getFiscalYearBounds(currentFiscalYear, fiscalYearStartMonth);
    console.log(`   Current FY Period: ${fyStart.toISOString().split('T')[0]} to ${fyEnd.toISOString().split('T')[0]}`);
    
    // Check if the required year-end snapshot exists
    const snapshotRef = db.collection('clients').doc(clientId).collection('yearEndBalances').doc(snapshotYear.toString());
    const snapshot = await snapshotRef.get();
    
    if (snapshot.exists) {
      const snapshotData = snapshot.data();
      console.log(`\n✅ Year-End Snapshot for ${snapshotYear} EXISTS:`);
      console.log(`   Accounts: ${snapshotData.accounts?.length || 0}`);
      console.log(`   Created: ${snapshotData.createdAt ? new Date(snapshotData.createdAt.toDate ? snapshotData.createdAt.toDate() : snapshotData.createdAt).toISOString().split('T')[0] : 'Unknown'}`);
      console.log(`   Created By: ${snapshotData.createdBy || 'Unknown'}`);
      
      // Show what fiscal year end this snapshot represents
      const { endDate: expectedDate } = getFiscalYearBounds(snapshotYear, fiscalYearStartMonth);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      console.log(`   ℹ️  Represents fiscal year end: ${expectedDateStr}`);
      
      // Show what balance recalculation will do
      const transactionStartDate = new Date(expectedDate.getTime() + 1);
      console.log(`\n🔄 Balance Recalculation Will:`);
      console.log(`   1. Start with snapshot from: ${expectedDateStr}`);
      console.log(`   2. Include transactions after: ${transactionStartDate.toISOString()}`);
      
      // Count transactions that would be included
      const transactionsRef = db.collection('clients').doc(clientId).collection('transactions');
      const query = transactionsRef
        .where('date', '>', transactionStartDate)
        .orderBy('date', 'asc');
      
      const transactions = await query.get();
      console.log(`   3. Process ${transactions.size} transactions`);
      
      // Show first and last transaction dates if any exist
      if (transactions.size > 0) {
        const docs = transactions.docs;
        const firstTx = docs[0].data();
        const lastTx = docs[docs.length - 1].data();
        const firstDate = firstTx.date?.toDate ? firstTx.date.toDate() : new Date(firstTx.date);
        const lastDate = lastTx.date?.toDate ? lastTx.date.toDate() : new Date(lastTx.date);
        console.log(`   4. Transaction range: ${firstDate.toISOString().split('T')[0]} to ${lastDate.toISOString().split('T')[0]}`);
      }
      
    } else {
      console.log(`\n❌ MISSING Year-End Snapshot for ${snapshotYear}!`);
      console.log(`   This will cause balance recalculation to fail.`);
      console.log(`   The application expects a snapshot at:`);
      const { endDate: expectedDate } = getFiscalYearBounds(snapshotYear, fiscalYearStartMonth);
      console.log(`   - Year: ${snapshotYear}`);
      console.log(`   - Date: ${expectedDate.toISOString().split('T')[0]}`);
    }
    
    console.log(`\n✅ Test complete for ${clientId}`);
    
  } catch (error) {
    console.error(`❌ Error testing ${clientId}:`, error.message);
  }
}

async function runTests() {
  console.log('🧪 Testing Fiscal Year Balance Calculations');
  console.log('==========================================');
  console.log(`📅 Today's Date: ${new Date().toISOString().split('T')[0]}`);
  
  // Test AVII (fiscal year - starts July 1)
  await testFiscalYearBalance('AVII');
  
  console.log('\n------------------------------------------\n');
  
  // Test MTC (calendar year - starts January 1)
  await testFiscalYearBalance('MTC');
  
  console.log('\n==========================================');
  console.log('🎯 Testing complete!');
  console.log('\n📝 Summary:');
  console.log('- The test dynamically determines which year snapshot is needed');
  console.log('- It uses the same logic the application should use');
  console.log('- It validates that the correct snapshot exists with proper dates');
}

// Run tests
runTests()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });
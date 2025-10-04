#!/usr/bin/env node

/**
 * Test MTC State - Check current MTC data in database
 */

import { initializeImport } from './import-config.js';

async function checkMTCState() {
  console.log('\n=== Checking MTC Database State ===\n');
  
  try {
    // Initialize with MTC client
    const { db, dateService } = await initializeImport('MTC');
    
    // Count transactions
    const transactionsCount = await db.collection('transactions')
      .where('clientId', '==', 'MTC')
      .count()
      .get();
    
    console.log(`MTC Transactions: ${transactionsCount.data().count}`);
    
    // Get sample transactions (without orderBy to avoid index requirement)
    const sampleTransactions = await db.collection('transactions')
      .where('clientId', '==', 'MTC')
      .limit(3)
      .get();
    
    if (!sampleTransactions.empty) {
      console.log('\nSample Transactions:');
      sampleTransactions.forEach(doc => {
        const data = doc.data();
        const formatted = dateService.formatForFrontend(data.date);
        console.log(`  - ${doc.id}: ${formatted.display} - ${data.description} ($${data.amount})`);
      });
    }
    
    // Count HOA dues
    const hoaDuesCount = await db.collection('hoaDues')
      .where('clientId', '==', 'MTC')
      .count()
      .get();
    
    console.log(`\nMTC HOA Dues: ${hoaDuesCount.data().count}`);
    
    // Get sample HOA dues (without orderBy to avoid index requirement)
    const sampleHoaDues = await db.collection('hoaDues')
      .where('clientId', '==', 'MTC')
      .limit(3)
      .get();
    
    if (!sampleHoaDues.empty) {
      console.log('\nSample HOA Dues:');
      sampleHoaDues.forEach(doc => {
        const data = doc.data();
        const formatted = dateService.formatForFrontend(data.dueDate);
        console.log(`  - ${doc.id}: Unit ${data.unitNumber} - ${formatted.display} ($${data.amountDue})`);
      });
    }
    
    // Count units
    const unitsCount = await db.collection('units')
      .where('clientId', '==', 'MTC')
      .count()
      .get();
    
    console.log(`\nMTC Units: ${unitsCount.data().count}`);
    
    // Get sample units
    const sampleUnits = await db.collection('units')
      .where('clientId', '==', 'MTC')
      .limit(3)
      .get();
    
    if (!sampleUnits.empty) {
      console.log('\nSample Units:');
      sampleUnits.forEach(doc => {
        const data = doc.data();
        console.log(`  - Unit ${data.unitNumber}: Balance $${data.balance || 0}`);
      });
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total MTC Transactions: ${transactionsCount.data().count}`);
    console.log(`Total MTC HOA Dues: ${hoaDuesCount.data().count}`);
    console.log(`Total MTC Units: ${unitsCount.data().count}`);
    
  } catch (error) {
    console.error('Error checking MTC state:', error.message);
    process.exit(1);
  }
}

// Run the check
checkMTCState().then(() => {
  console.log('\n✅ MTC state check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Create Year-End Balance Snapshot
 * Creates the required year-end balance snapshot needed for balance calculations
 */

import { initializeFirebase, printEnvironmentInfo } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
import { MTC_IMPORT_CONFIG } from './config/mtc-import-config.js';

const CLIENT_ID = MTC_IMPORT_CONFIG.clientId;

async function createYearEndSnapshot() {
  try {
    console.log('📊 Creating year-end balance snapshot...\n');
    
    // Initialize Firebase
    const { db } = await initializeFirebase();
    printEnvironmentInfo();
    
    // Get the client document to access accounts array
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.error('❌ Error: MTC client document not found');
      process.exit(1);
    }
    
    const clientData = clientDoc.data();
    const accounts = clientData.accounts || [];
    
    if (accounts.length === 0) {
      console.error('❌ Error: No accounts found in client document');
      process.exit(1);
    }
    
    console.log(`📋 Found ${accounts.length} accounts in client document`);
    
    // Create year-end snapshot with actual balances from config
    const year = MTC_IMPORT_CONFIG.yearEndBalances.year;
    const yearEndBalances = MTC_IMPORT_CONFIG.yearEndBalances.balances;
    
    const snapshotAccounts = accounts.map(account => ({
      id: account.id,
      name: account.name,
      balance: yearEndBalances[account.id] || 0  // Use defined balance or 0 if not found
    }));
    
    const yearEndSnapshot = {
      year: year,
      created: getCurrentTimestamp(),
      createdBy: 'create-yearend-snapshot-script',
      accounts: snapshotAccounts
    };
    
    // Save to yearEndBalances collection
    const snapshotRef = db.collection('clients').doc(CLIENT_ID).collection('yearEndBalances').doc(year);
    
    // Check if already exists
    const existing = await snapshotRef.get();
    if (existing.exists) {
      console.log(`⚠️  Year-end snapshot for ${year} already exists. Updating...`);
      await snapshotRef.update({
        ...yearEndSnapshot,
        updated: getCurrentTimestamp(),
        updatedBy: 'create-yearend-snapshot-script'
      });
      console.log(`✅ Updated year-end snapshot for ${year}`);
    } else {
      await snapshotRef.set(yearEndSnapshot);
      console.log(`✅ Created year-end snapshot for ${year}`);
    }
    
    console.log('\n📊 Year-End Snapshot Details:');
    console.log(`   Year: ${year}`);
    console.log(`   Accounts: ${snapshotAccounts.length}`);
    snapshotAccounts.forEach((account, index) => {
      console.log(`   ${index + 1}. ${account.name} (${account.id}): $${(account.balance / 100).toFixed(2)}`);
    });
    
    console.log('\n✨ Year-end snapshot created successfully!');
    console.log('💡 Balance recalculation should now work correctly');
    console.log('📝 Year-end balances set:');
    console.log('   - MTC Bank: $164,088.00');
    console.log('   - Cash Account: $5,000.00');
    
  } catch (error) {
    console.error('❌ Error creating year-end snapshot:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
createYearEndSnapshot();
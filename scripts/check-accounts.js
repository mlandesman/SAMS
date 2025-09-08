#!/usr/bin/env node

/**
 * Check what accounts exist in the database
 */

import { initializeFirebase, printEnvironmentInfo } from './client-onboarding/utils/environment-config.js';

const CLIENT_ID = 'MTC';

async function checkAccounts() {
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase('dev');
    printEnvironmentInfo('dev');
    
    console.log('\n🔍 Checking existing accounts for MTC...\n');
    
    // Query accounts collection
    const accountsRef = db.collection('clients').doc(CLIENT_ID).collection('accounts');
    const snapshot = await accountsRef.get();
    
    if (snapshot.empty) {
      console.log('❌ No accounts found in database!');
      console.log('💡 You may need to run: node create-default-accounts.js');
      return;
    }
    
    console.log(`✅ Found ${snapshot.size} accounts:`);
    console.log('📋 Account Details:');
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   ID: ${doc.id}`);
      console.log(`   Name: ${data.name || 'N/A'}`);
      console.log(`   Type: ${data.type || 'N/A'}`);
      console.log(`   Active: ${data.active !== false ? 'Yes' : 'No'}`);
      console.log(`   ---`);
    });
    
    // Check specifically for the accounts the import script expects
    const expectedAccounts = ['bank-001', 'cash-001'];
    console.log('\n🎯 Checking expected accounts:');
    
    for (const accountId of expectedAccounts) {
      const accountDoc = await accountsRef.doc(accountId).get();
      if (accountDoc.exists) {
        const data = accountDoc.data();
        console.log(`   ✅ ${accountId}: ${data.name} (${data.type})`);
      } else {
        console.log(`   ❌ ${accountId}: NOT FOUND`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking accounts:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the check
checkAccounts();
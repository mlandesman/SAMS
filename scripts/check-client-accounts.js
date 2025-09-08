#!/usr/bin/env node

/**
 * Check accounts array inside the MTC client document
 */

import { initializeFirebase, printEnvironmentInfo } from './client-onboarding/utils/environment-config.js';

const CLIENT_ID = 'MTC';

async function checkClientAccounts() {
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase('dev');
    printEnvironmentInfo('dev');
    
    console.log('\n🔍 Checking accounts array in MTC client document...\n');
    
    // Get the client document
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    const clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      console.log('❌ MTC client document not found!');
      return;
    }
    
    const clientData = clientDoc.data();
    const accounts = clientData.accounts;
    
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      console.log('❌ No accounts array found in client document!');
      console.log('💡 The accounts should be in client.accounts array');
      return;
    }
    
    console.log(`✅ Found ${accounts.length} accounts in client.accounts array:`);
    console.log('📋 Account Details:');
    
    accounts.forEach((account, index) => {
      console.log(`   ${index + 1}. ID: ${account.id || account.accountId || 'N/A'}`);
      console.log(`      Name: ${account.name || account.accountName || 'N/A'}`);
      console.log(`      Type: ${account.type || account.accountType || 'N/A'}`);
      console.log(`      Active: ${account.active !== false ? 'Yes' : 'No'}`);
      console.log(`      ---`);
    });
    
    // Check specifically for the accounts the import script expects
    const expectedAccounts = ['bank-001', 'cash-001'];
    console.log('\n🎯 Checking expected accounts:');
    
    for (const accountId of expectedAccounts) {
      const account = accounts.find(acc => 
        acc.id === accountId || 
        acc.accountId === accountId
      );
      
      if (account) {
        console.log(`   ✅ ${accountId}: ${account.name || account.accountName} (${account.type || account.accountType})`);
      } else {
        console.log(`   ❌ ${accountId}: NOT FOUND`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking client accounts:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the check
checkClientAccounts();
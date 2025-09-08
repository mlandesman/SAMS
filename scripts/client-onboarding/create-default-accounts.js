#!/usr/bin/env node

/**
 * Create default accounts for MTC using the accounts controller
 */

import { createAccount } from '../../backend/controllers/accountsController.js';

const CLIENT_ID = 'MTC';

async function createDefaultAccounts() {
  console.log('🏦 Creating default accounts for MTC...\n');
  
  const accounts = [
    {
      id: 'bank-001',
      name: 'MTC Bank',  // Changed to match validation expectations
      type: 'bank',
      currency: 'USD',
      initialBalance: 0
    },
    {
      id: 'cash-001',
      name: 'Cash Account',  // Changed to match validation expectations
      type: 'cash', 
      currency: 'USD',
      initialBalance: 0
    }
  ];
  
  for (const accountData of accounts) {
    try {
      console.log(`📝 Creating account: ${accountData.name} (${accountData.id})...`);
      
      // Use the controller which handles all validation and audit logging
      const newAccount = await createAccount(CLIENT_ID, accountData);
      
      console.log(`✅ Created account: ${newAccount.name} with ID: ${newAccount.id}`);
      
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`⚠️  Account '${accountData.name}' already exists`);
      } else {
        console.error(`❌ Error creating account ${accountData.name}:`, error.message);
      }
    }
  }
  
  console.log('\n✅ Accounts setup complete!');
  console.log('📝 Next step: Run the import scripts');
}

// Execute
createDefaultAccounts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
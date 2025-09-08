#!/usr/bin/env node

/**
 * Create Client Script
 * 
 * Creates a new client record in the database using environment variables
 * for configuration. This allows it to work with any client.
 * 
 * Environment Variables:
 *   IMPORT_CLIENT_ID - The client ID to create
 *   IMPORT_DATA_PATH - Path to the client data directory
 */

import { initializeFirebase } from './utils/environment-config.js';
import { getCurrentTimestamp } from './utils/timestamp-converter.js';
import { createAccount } from '../../backend/controllers/accountsController.js';
import fs from 'fs/promises';
import path from 'path';

// Get configuration from environment or defaults
const CLIENT_ID = process.env.IMPORT_CLIENT_ID || 'MTC';
const DATA_PATH = process.env.IMPORT_DATA_PATH || './MTCdata';

/**
 * Load and validate client configuration from file
 */
async function loadClientConfig(clientId) {
  const configPath = path.join(DATA_PATH, 'client-config.json');
  
  // Load config file
  let config;
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(configData);
    console.log(`✅ Loaded config from: ${configPath}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`❌ Configuration file not found at: ${configPath}\n   Run 'node setup-client-config.js ${clientId}' to create it.`);
    } else if (error instanceof SyntaxError) {
      throw new Error(`❌ Invalid JSON in configuration file: ${configPath}\n   ${error.message}`);
    } else {
      throw new Error(`❌ Error reading configuration file: ${error.message}`);
    }
  }
  
  // Validate required fields
  const requiredFields = [
    'clientId',
    'name', 
    'shortName',
    'address.street',
    'address.city',
    'address.state',
    'address.country',
    'contact.email',
    'contact.phone',
    'contact.primaryContact.name',
    'contact.primaryContact.email',
    'financial.currency',
    'financial.yearEndBalances.bank',
    'financial.yearEndBalances.cash'
  ];
  
  const missingFields = [];
  for (const field of requiredFields) {
    const value = field.split('.').reduce((obj, key) => obj?.[key], config);
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    throw new Error(`❌ Missing required fields in configuration:\n   ${missingFields.join('\n   ')}`);
  }
  
  // Validate clientId matches
  if (config.clientId !== clientId) {
    throw new Error(`❌ Client ID mismatch: config has '${config.clientId}' but expected '${clientId}'`);
  }
  
  // Check if this is the proper MTC structure or the old structure
  if (config.basicInfo) {
    // New MTC-based structure - return as-is
    return config;
  } else {
    // Old structure - transform to expected format
    return {
      name: config.name,
      shortName: config.shortName,
      address: config.address,
      contactEmail: config.contact.email,
      contactPhone: config.contact.phone,
      yearEndBalances: config.financial.yearEndBalances,
      primaryContact: config.contact.primaryContact,
      features: config.features,
      financial: config.financial,
      propertyInfo: config.propertyInfo,
      branding: config.branding,
      accounts: config.accounts || []
    };
  }
}

async function createClient() {
  console.log(`\n🏢 Creating client: ${CLIENT_ID}`);
  console.log(`📁 Data path: ${DATA_PATH}`);
  
  try {
    // Initialize Firebase
    const { db } = await initializeFirebase(process.env.IMPORT_ENVIRONMENT || 'dev');
    
    // Load client configuration (from file, hardcoded, or minimal)
    console.log('📄 Loading client configuration...');
    const clientConfig = await loadClientConfig(CLIENT_ID);
    console.log('✅ Client configuration loaded successfully');
    console.log(`   Name: ${clientConfig.name}`);
    console.log(`   Short Name: ${clientConfig.shortName}`);
    console.log(`   Email: ${clientConfig.contactEmail}`);
    console.log(`   Currency: ${clientConfig.financial?.currency || 'MXN'}`);
    console.log(`   Accounts: ${clientConfig.accounts.length}`);
    
    // Create client document
    console.log('\n📝 Creating client document...');
    const clientData = {
      clientId: CLIENT_ID,
      name: clientConfig.name,
      status: 'active',
      basicInfo: {
        companyName: clientConfig.name,
        shortName: clientConfig.shortName,
        address: clientConfig.address,
        contactEmail: clientConfig.contactEmail,
        contactPhone: clientConfig.contactPhone
      },
      contactInfo: {
        primaryContact: clientConfig.primaryContact || {
          name: 'Administrator',
          email: clientConfig.contactEmail,
          phone: clientConfig.contactPhone,
          role: 'Property Manager'
        }
      },
      financialInfo: clientConfig.financial || {
        currency: 'MXN',
        fiscalYearEnd: '12-31',
        yearEndBalances: clientConfig.yearEndBalances
      },
      features: clientConfig.features || {
        multiUnit: true,
        hoaManagement: true,
        documentStorage: true,
        financialReporting: true
      },
      propertyInfo: clientConfig.propertyInfo,
      branding: clientConfig.branding,
      created: getCurrentTimestamp(),
      updated: getCurrentTimestamp()
    };
    
    // Initialize accounts array in client data
    clientData.accounts = [];
    
    console.log('📤 Writing client document to Firestore...');
    console.log(`   Document ID: ${CLIENT_ID}`);
    console.log(`   Basic Info: ${JSON.stringify(clientData.basicInfo, null, 2)}`);
    
    // Save to Firestore
    const clientRef = db.collection('clients').doc(CLIENT_ID);
    
    try {
      await clientRef.set(clientData);
      console.log(`✅ Client document written to Firestore`);
    } catch (writeError) {
      console.error('❌ Error writing client document:', writeError);
      console.error('   Error details:', writeError.message);
      console.error('   Client data attempted:', JSON.stringify(clientData, null, 2));
      throw writeError;
    }
    
    // Verify the client document exists before proceeding
    console.log('🔍 Verifying client document...');
    const verifyDoc = await clientRef.get();
    if (!verifyDoc.exists) {
      throw new Error('Client document was not created properly - document does not exist after write');
    }
    
    const docData = verifyDoc.data();
    console.log(`✅ Client ${CLIENT_ID} document verified successfully`);
    console.log(`   Document has ${Object.keys(docData).length} fields`);
    console.log(`   Client name: ${docData.name || 'NOT SET'}`);
    console.log(`   Status: ${docData.status || 'NOT SET'}`);
    console.log(`   BasicInfo exists: ${docData.basicInfo ? 'Yes' : 'No'}`);
    
    // Create initial collections
    console.log('\n📁 Creating initial collections...');
    
    const collections = [
      'users',
      'categories', 
      'vendors',
      'paymentMethods',
      'units',
      'transactions',
      'accounts'
    ];
    
    for (const collection of collections) {
      // Create a placeholder document to ensure collection exists
      const placeholderRef = clientRef.collection(collection).doc('_placeholder');
      await placeholderRef.set({
        _placeholder: true,
        created: getCurrentTimestamp()
      });
      
      // Delete the placeholder
      await placeholderRef.delete();
      console.log(`  ✅ Created ${collection} collection`);
    }
    
    // Note: Exchange rates are managed at the top level, not within client documents
    
    // Create accounts from configuration
    console.log('\n🏦 Creating accounts from configuration...');
    const configAccounts = clientConfig.accounts || [];
    
    if (configAccounts.length === 0) {
      throw new Error('❌ No accounts defined in client configuration. Please add accounts section to config file.');
    }
    
    // Validate each account has required fields
    for (const account of configAccounts) {
      if (!account.name || !account.type || !account.id) {
        throw new Error(`❌ Account missing required fields (id, name, type): ${JSON.stringify(account)}`);
      }
      
      if (!['bank', 'cash'].includes(account.type)) {
        throw new Error(`❌ Invalid account type: ${account.type}. Must be 'bank' or 'cash'`);
      }
      
      // Check for placeholder names
      if (account.name.includes('MUST MATCH') || account.name.includes('NAME')) {
        throw new Error(`❌ Account name not updated from template: "${account.name}". Please update to match your Transactions.json`);
      }
    }
    
    // Create each account with proper initial balances
    for (const accountData of configAccounts) {
      // Override initialBalance with yearEndBalances based on type
      if (accountData.type === 'bank') {
        accountData.initialBalance = clientConfig.yearEndBalances.bank;
      } else if (accountData.type === 'cash') {
        accountData.initialBalance = clientConfig.yearEndBalances.cash;
      }
      
      // Ensure currency matches financial settings
      accountData.currency = accountData.currency || clientConfig.financial?.currency || 'MXN';
      
      try {
        await createAccount(CLIENT_ID, accountData);
        console.log(`  ✅ Created account: ${accountData.name} (${accountData.type}) - Initial balance: $${(accountData.initialBalance / 100).toFixed(2)}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ⚠️  Account '${accountData.name}' already exists`);
        } else {
          throw new Error(`❌ Critical error creating account ${accountData.name}: ${error.message}`);
        }
      }
    }
    
    // Import config subcollection if config.json exists
    console.log('\n📋 Setting up configuration documents...');
    const configPath = path.join(DATA_PATH, 'config.json');
    
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      // Create activities document
      if (config.activities) {
        const activitiesRef = clientRef.collection('config').doc('activities');
        await activitiesRef.set({
          ...config.activities,
          updatedAt: getCurrentTimestamp(),
          updatedBy: 'client-onboarding'
        });
        console.log('  ✅ Created activities configuration');
      }
      
      // Create receiptEmail document
      if (config.receiptEmail) {
        const receiptEmailRef = clientRef.collection('config').doc('receiptEmail');
        await receiptEmailRef.set({
          ...config.receiptEmail,
          updated: getCurrentTimestamp()
        });
        console.log('  ✅ Created receipt email configuration');
      }
      
    } catch (error) {
      console.log('  ⚠️  No config.json found - using default configuration');
      
      // Create default activities configuration
      const activitiesRef = clientRef.collection('config').doc('activities');
      await activitiesRef.set({
        menu: [
          { label: 'Dashboard', activity: 'Dashboard' },
          { label: 'Transactions', activity: 'Transactions' },
          { label: 'HOA Dues', activity: 'HOADues' },
          { label: 'Projects', activity: 'Projects' },
          { label: 'Budgets', activity: 'Budgets' },
          { label: 'List Management', activity: 'ListManagement' },
          { label: 'Settings', activity: 'Settings' }
        ],
        updatedAt: getCurrentTimestamp(),
        updatedBy: 'client-onboarding'
      });
      console.log('  ✅ Created default activities configuration');
    }
    
    console.log('\n✅ Client setup completed successfully!');
    
  } catch (error) {
    console.error(`\n❌ Error creating client: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));

if (isMainModule) {
  console.log('🚀 Starting client creation from direct execution...');
  createClient()
    .then(() => {
      console.log('✅ Client creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Client creation failed:', error);
      process.exit(1);
    });
} else {
  console.log('📦 Module loaded - not executing directly');
  console.log(`   import.meta.url: ${import.meta.url}`);
  console.log(`   process.argv[1]: ${process.argv[1]}`);
}

export { createClient };
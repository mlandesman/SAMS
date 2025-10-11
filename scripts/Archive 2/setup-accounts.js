/**
 * Account Setup for MTC Migration
 * 
 * Creates the financial accounts structure for MTC client
 * Sets up bank and cash accounts with proper mapping for transactions
 * 
 * Task ID: MTC-MIGRATION-001 - Phase 3 Step 5
 * Date: June 27, 2025
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { getMTCImportMapping } from '../backend/utils/accountMapping.js';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';

/**
 * Get account structure from mapping
 */
function getAccountsToCreate() {
  const accountMapping = getMTCImportMapping();
  
  console.log('📊 Account mapping configuration:');
  Object.entries(accountMapping).forEach(([name, config]) => {
    console.log(`   "${name}" → ${config.accountId} (${config.accountType})`);
  });
  
  return accountMapping;
}

/**
 * Create accounts in client document
 */
async function createClientAccounts(db, accountMapping) {
  console.log('\n🏦 Creating client accounts...\n');
  
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    throw new Error(`Client ${CLIENT_ID} does not exist - run previous import steps first`);
  }
  
  const clientData = clientDoc.data();
  console.log(`✅ Found client: ${clientData.name || CLIENT_ID}`);
  
  // Prepare accounts array
  const accounts = [];
  
  Object.entries(accountMapping).forEach(([name, config]) => {
    const account = {
      id: config.accountId,
      name: config.account || name,
      type: config.accountType,
      balance: 0, // Will be calculated when transactions are imported
      isActive: true,
      currency: 'USD',
      createdAt: new Date(),
      migrationData: {
        originalName: name,
        mappedFrom: name,
        migratedAt: new Date().toISOString()
      }
    };
    
    accounts.push(account);
    console.log(`📝 Prepared account: ${account.name} (${account.id})`);
  });
  
  // Update client document with accounts
  await clientRef.update({
    accounts: accounts,
    accountsLastUpdated: new Date(),
    status: 'inactive'
  });
  
  console.log(`\n✅ Created ${accounts.length} accounts for client ${CLIENT_ID}`);
  
  return {
    accountsCreated: accounts.length,
    accounts: accounts
  };
}

/**
 * Verify account setup
 */
async function verifyAccountSetup(db) {
  console.log('\n🔍 Verifying account setup...\n');
  
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const clientDoc = await clientRef.get();
  
  if (!clientDoc.exists) {
    throw new Error(`Client ${CLIENT_ID} not found`);
  }
  
  const clientData = clientDoc.data();
  const accounts = clientData.accounts || [];
  
  console.log(`🏦 Accounts found: ${accounts.length}`);
  
  if (accounts.length > 0) {
    console.log('\n🏦 Account details:');
    accounts.forEach((account, index) => {
      console.log(`   ${index + 1}. ${account.name} (${account.id})`);
      console.log(`      Type: ${account.type}`);
      console.log(`      Balance: $${account.balance}`);
      console.log(`      Active: ${account.isActive}`);
      console.log(`      Created: ${account.createdAt?.toDate?.()}`);
      console.log(`      Migration data: ${account.migrationData ? 'Present' : 'Missing'}`);
    });
  }
  
  // Check for required accounts
  const requiredAccountIds = ['bank-cibanco-001', 'cash-001'];
  const foundAccountIds = accounts.map(acc => acc.id);
  const missingAccounts = requiredAccountIds.filter(id => !foundAccountIds.includes(id));
  
  if (missingAccounts.length > 0) {
    console.log(`\n⚠️ Missing required accounts: ${missingAccounts.join(', ')}`);
  } else {
    console.log('\n✅ All required accounts present');
  }
  
  return {
    totalAccounts: accounts.length,
    accountIds: foundAccountIds,
    missingAccounts: missingAccounts,
    allRequiredPresent: missingAccounts.length === 0
  };
}

/**
 * Test account mapping with sample transaction data
 */
async function testAccountMapping() {
  console.log('\n🧪 Testing account mapping with sample transaction data...\n');
  
  // Load a few sample transactions to test mapping
  try {
    const transactionsData = JSON.parse(await fs.readFile('./MTCdata/Transactions.json', 'utf-8'));
    const sampleTransactions = transactionsData.slice(0, 5); // First 5 transactions
    
    const accountMapping = getMTCImportMapping();
    const mappingResults = {
      total: sampleTransactions.length,
      mapped: 0,
      unmapped: 0,
      accounts: {}
    };
    
    console.log('🧪 Testing mapping for first 5 transactions:');
    sampleTransactions.forEach((txn, index) => {
      const account = txn.Account;
      const mapping = accountMapping[account];
      
      if (mapping) {
        mappingResults.mapped++;
        mappingResults.accounts[account] = (mappingResults.accounts[account] || 0) + 1;
        console.log(`   ${index + 1}. "${account}" → ${mapping.accountId} ✅`);
      } else {
        mappingResults.unmapped++;
        console.log(`   ${index + 1}. "${account}" → NO MAPPING ❌`);
      }
    });
    
    console.log('\n📊 Mapping test results:');
    console.log(`   Total transactions tested: ${mappingResults.total}`);
    console.log(`   Successfully mapped: ${mappingResults.mapped}`);
    console.log(`   Failed to map: ${mappingResults.unmapped}`);
    console.log(`   Account usage:`, mappingResults.accounts);
    
    return mappingResults;
    
  } catch (error) {
    console.log('⚠️ Could not load transactions for mapping test:', error.message);
    return null;
  }
}

/**
 * Initialize year-end balances if needed
 */
async function initializeYearEndBalances(db, accounts) {
  console.log('\n📅 Initializing year-end balances...\n');
  
  const clientRef = db.collection('clients').doc(CLIENT_ID);
  const yearEndBalancesRef = clientRef.collection('yearEndBalances');
  
  const currentYear = new Date().getFullYear();
  const yearDocRef = yearEndBalancesRef.doc(currentYear.toString());
  const yearDoc = await yearDocRef.get();
  
  if (yearDoc.exists) {
    console.log(`✅ Year-end balances for ${currentYear} already exist`);
    return { created: false, year: currentYear };
  }
  
  // Create year-end balances document
  const yearEndBalances = {
    year: currentYear,
    balances: {},
    lastUpdated: new Date(),
    migrationData: {
      initializedDuringMigration: true,
      migratedAt: new Date().toISOString()
    }
  };
  
  // Initialize balance for each account
  accounts.forEach(account => {
    yearEndBalances.balances[account.id] = {
      accountId: account.id,
      accountName: account.name,
      startingBalance: 0,
      endingBalance: 0, // Will be calculated after transactions
      lastUpdated: new Date()
    };
  });
  
  await yearDocRef.set(yearEndBalances);
  
  console.log(`✅ Created year-end balances for ${currentYear}`);
  console.log(`📊 Initialized ${accounts.length} account balances`);
  
  return { created: true, year: currentYear, accountsInitialized: accounts.length };
}

/**
 * Main account setup process
 */
async function performAccountSetup() {
  console.log('🚀 Starting Account Setup...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    clientId: CLIENT_ID,
    accountMapping: null,
    accountCreation: null,
    verification: null,
    mappingTest: null,
    yearEndBalances: null,
    success: false
  };
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Get account mapping
    console.log('=== STEP 1: ACCOUNT MAPPING ANALYSIS ===');
    const accountMapping = getAccountsToCreate();
    results.accountMapping = {
      totalMappings: Object.keys(accountMapping).length,
      mappings: accountMapping
    };
    
    // Create accounts
    console.log('\n=== STEP 2: ACCOUNT CREATION ===');
    results.accountCreation = await createClientAccounts(db, accountMapping);
    
    // Verify setup
    console.log('\n=== STEP 3: VERIFICATION ===');
    results.verification = await verifyAccountSetup(db);
    
    // Test mapping
    console.log('\n=== STEP 4: MAPPING VALIDATION ===');
    results.mappingTest = await testAccountMapping();
    
    // Initialize year-end balances
    console.log('\n=== STEP 5: YEAR-END BALANCES SETUP ===');
    results.yearEndBalances = await initializeYearEndBalances(db, results.accountCreation.accounts);
    
    // Check success
    results.success = results.verification.allRequiredPresent && results.accountCreation.accountsCreated > 0;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 ACCOUNT SETUP SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`⏰ Completed: ${results.timestamp}`);
    console.log('');
    console.log('🗺️ ACCOUNT MAPPING:');
    console.log(`   Total mappings: ${results.accountMapping.totalMappings}`);
    Object.entries(results.accountMapping.mappings).forEach(([name, config]) => {
      console.log(`   "${name}" → ${config.accountId} (${config.accountType})`);
    });
    console.log('');
    console.log('🏦 ACCOUNT CREATION:');
    console.log(`   Accounts created: ${results.accountCreation.accountsCreated}`);
    console.log('');
    console.log('🔍 VERIFICATION:');
    console.log(`   Total accounts: ${results.verification.totalAccounts}`);
    console.log(`   All required present: ${results.verification.allRequiredPresent}`);
    console.log(`   Account IDs: ${results.verification.accountIds.join(', ')}`);
    console.log('');
    console.log('🧪 MAPPING TEST:');
    if (results.mappingTest) {
      console.log(`   Transactions tested: ${results.mappingTest.total}`);
      console.log(`   Successfully mapped: ${results.mappingTest.mapped}`);
      console.log(`   Failed mappings: ${results.mappingTest.unmapped}`);
    } else {
      console.log('   Test not available');
    }
    console.log('');
    console.log('📅 YEAR-END BALANCES:');
    console.log(`   Year: ${results.yearEndBalances.year}`);
    console.log(`   Created: ${results.yearEndBalances.created}`);
    if (results.yearEndBalances.accountsInitialized) {
      console.log(`   Accounts initialized: ${results.yearEndBalances.accountsInitialized}`);
    }
    
    if (results.success) {
      console.log('\n✅ ACCOUNT SETUP SUCCESSFUL!');
      console.log('🚀 Ready for next step: Transactions Import');
    } else {
      console.log('\n⚠️ ACCOUNT SETUP COMPLETED WITH ISSUES');
      console.log('🔧 Review errors before proceeding to next step');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    console.error('\n💥 Account setup failed:', error);
    results.error = error.message;
    throw error;
  }
}

// Execute
performAccountSetup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
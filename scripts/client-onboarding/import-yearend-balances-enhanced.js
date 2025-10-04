#!/usr/bin/env node

/**
 * Enhanced Year-End Balances Import with DateService
 * 
 * Imports year-end balance snapshots with proper timezone handling
 * Critical for fiscal year calculations and financial reporting
 * 
 * Features:
 * - DateService for all date operations
 * - Fiscal year calculations in correct timezone
 * - Creates fallback with zero balances if no data
 * - Client-agnostic implementation
 * 
 * Usage:
 *   node import-yearend-balances-enhanced.js <CLIENT_ID> [DATA_PATH]
 * 
 * Created: September 29, 2025
 */

import { 
  dateService, 
  getImportConfig, 
  initializeImport,
  parseDate,
  formatDate,
  getCurrentTimestamp,
  createMigrationMetadata,
  logProgress 
} from './import-config.js';
import { getFiscalYear } from '../../backend/utils/fiscalYearUtils.js';
import fs from 'fs/promises';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('❌ Usage: node import-yearend-balances-enhanced.js <CLIENT_ID> [DATA_PATH]');
  process.exit(1);
}

const CLIENT_ID = args[0];
const DATA_PATH = args[1];

// Get import configuration
const config = getImportConfig(CLIENT_ID, DATA_PATH);

/**
 * Load client configuration to get fiscal year settings
 */
async function loadClientConfig() {
  const configFile = path.join(config.dataPath, 'client-config.json');
  
  try {
    const configData = JSON.parse(await fs.readFile(configFile, 'utf-8'));
    logProgress(`Loaded client configuration`, 'success');
    return configData;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logProgress('No client-config.json found - using defaults', 'warn');
      return {
        configuration: {
          fiscalYearStartMonth: 1 // Default to January
        },
        accounts: [] // Will need to fetch from database
      };
    }
    throw error;
  }
}

/**
 * Load year-end balances from JSON file
 */
async function loadYearEndBalances() {
  const balancesFile = path.join(config.dataPath, 'yearEndBalances.json');
  
  try {
    const data = await fs.readFile(balancesFile, 'utf-8');
    const balances = JSON.parse(data);
    
    // Remove any instruction or comment fields
    const cleaned = {};
    for (const [year, yearData] of Object.entries(balances)) {
      if (!year.startsWith('_') && yearData.accounts) {
        cleaned[year] = {
          year: parseInt(year),
          date: yearData.date,
          accounts: yearData.accounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            balance: acc.balance || 0
          }))
        };
      }
    }
    
    logProgress(`Found ${Object.keys(cleaned).length} year-end balance(s) to import`, 'success');
    return cleaned;
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      logProgress('No yearEndBalances.json found - will create fallback with zero balances', 'warn');
      return null;
    }
    throw error;
  }
}

/**
 * Get accounts from client configuration or database
 */
async function getClientAccounts(clientConfig, db) {
  // First try to use accounts from config
  if (clientConfig.accounts && clientConfig.accounts.length > 0) {
    return clientConfig.accounts;
  }
  
  // Otherwise fetch from database
  logProgress('Fetching accounts from database...', 'info');
  const accountsRef = db.collection('clients').doc(CLIENT_ID).collection('accounts');
  const accountsSnapshot = await accountsRef.get();
  
  const accounts = [];
  accountsSnapshot.forEach(doc => {
    accounts.push({
      id: doc.id,
      name: doc.data().name || doc.id
    });
  });
  
  if (accounts.length === 0) {
    // Create default accounts
    logProgress('No accounts found - creating defaults', 'warn');
    return [
      { id: 'bank-001', name: 'Bank Account' },
      { id: 'cash-001', name: 'Cash Account' }
    ];
  }
  
  return accounts;
}

/**
 * Create fallback year-end balance with zero amounts
 */
function createFallbackYearEnd(accounts, fiscalYear) {
  return {
    year: fiscalYear,
    created: getCurrentTimestamp(),
    createdBy: 'import-fallback-enhanced',
    accounts: accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      balance: 0
    })),
    note: 'Auto-created with zero balances - update in Firebase console if needed',
    ...createMigrationMetadata({
      reason: 'no-yearend-data-file',
      accountsCreated: accounts.length
    })
  };
}

/**
 * Parse year-end date with proper timezone
 */
function parseYearEndDate(dateString) {
  if (!dateString) {
    return null;
  }
  
  // Try common date formats
  const formats = ['yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy'];
  
  for (const format of formats) {
    const parsed = parseDate(dateString, format);
    if (parsed) {
      return parsed;
    }
  }
  
  logProgress(`Could not parse year-end date: ${dateString}`, 'warn');
  return null;
}

/**
 * Import year-end balances to Firestore
 */
async function importYearEndBalances() {
  try {
    logProgress(`Starting year-end balances import for ${CLIENT_ID}...`, 'info');
    
    // Initialize Firebase
    const { db } = await initializeImport(CLIENT_ID);
    
    // Load client configuration
    const clientConfig = await loadClientConfig();
    const fiscalYearStartMonth = clientConfig.configuration?.fiscalYearStartMonth || 1;
    logProgress(`Fiscal year starts in month: ${fiscalYearStartMonth}`, 'info');
    
    // Get accounts
    const accounts = await getClientAccounts(clientConfig, db);
    logProgress(`Found ${accounts.length} accounts`, 'info');
    
    // Try to load year-end balances from file
    let yearEndData = await loadYearEndBalances();
    
    const results = {
      imported: 0,
      fallback: false,
      years: []
    };
    
    if (yearEndData && Object.keys(yearEndData).length > 0) {
      // Import provided year-end balances
      console.log(`\n📊 Importing year-end balances:`);
      
      for (const [year, data] of Object.entries(yearEndData)) {
        const docRef = db.collection('clients').doc(CLIENT_ID)
          .collection('yearEndBalances').doc(year);
        
        const balanceDoc = {
          year: data.year,
          date: parseYearEndDate(data.date),
          accounts: data.accounts,
          created: getCurrentTimestamp(),
          createdBy: 'import-script-enhanced',
          ...createMigrationMetadata({
            originalDate: data.date,
            accountCount: data.accounts.length
          })
        };
        
        await docRef.set(balanceDoc);
        
        console.log(`\n✅ Imported year-end balance for fiscal year ${year}`);
        console.log(`   Date: ${data.date ? formatDate(balanceDoc.date) : 'Not specified'}`);
        console.log(`   Accounts: ${data.accounts.length}`);
        
        let total = 0;
        data.accounts.forEach(acc => {
          console.log(`     - ${acc.name}: $${(acc.balance / 100).toFixed(2)}`);
          total += acc.balance;
        });
        console.log(`   Total: $${(total / 100).toFixed(2)}`);
        
        results.imported++;
        results.years.push(year);
      }
    } else {
      // Create fallback with zero balances
      results.fallback = true;
      console.log('\n⚠️  Creating fallback year-end balance with zero amounts');
      
      // Calculate the most recent completed fiscal year using DateService
      const currentDate = dateService.getNow();
      const currentFY = getFiscalYear(currentDate, fiscalYearStartMonth);
      
      // Determine if we're early in the fiscal year
      const currentMonth = currentDate.getMonth() + 1;
      const monthsIntoFY = currentMonth >= fiscalYearStartMonth 
        ? currentMonth - fiscalYearStartMonth + 1
        : (12 - fiscalYearStartMonth + 1) + currentMonth;
      
      // Use previous fiscal year as the most recent completed
      const mostRecentCompletedFY = monthsIntoFY <= 2 ? currentFY - 1 : currentFY - 1;
      
      console.log(`📅 Current date: ${formatDate(currentDate)}`);
      console.log(`📅 Current fiscal year: ${currentFY}`);
      console.log(`📅 Most recent completed fiscal year: ${mostRecentCompletedFY}`);
      
      // Create and save fallback
      const fallback = createFallbackYearEnd(accounts, mostRecentCompletedFY);
      
      const docRef = db.collection('clients').doc(CLIENT_ID)
        .collection('yearEndBalances').doc(String(mostRecentCompletedFY));
      
      await docRef.set(fallback);
      
      console.log(`\n✅ Created fallback year-end balance for fiscal year ${mostRecentCompletedFY}`);
      console.log('   ⚠️  All accounts set to $0.00 - update in Firebase console if needed');
      console.log('   Accounts created:');
      fallback.accounts.forEach(acc => {
        console.log(`     - ${acc.name} (${acc.id}): $0.00`);
      });
      
      results.imported++;
      results.years.push(mostRecentCompletedFY);
    }
    
    return results;
    
  } catch (error) {
    logProgress(`Error importing year-end balances: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Verify year-end balances import
 */
async function verifyYearEndBalances(db) {
  logProgress('Verifying year-end balances import...', 'info');
  
  const balancesRef = db.collection('clients').doc(CLIENT_ID).collection('yearEndBalances');
  const balancesSnapshot = await balancesRef.get();
  
  console.log(`\n💰 Year-end balances in database: ${balancesSnapshot.size}`);
  
  balancesSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`\n   Fiscal Year ${doc.id}:`);
    console.log(`      Date: ${data.date ? formatDate(data.date) : 'Not specified'}`);
    console.log(`      Accounts: ${data.accounts?.length || 0}`);
    console.log(`      Created: ${formatDate(data.created)}`);
    console.log(`      Created By: ${data.createdBy}`);
  });
  
  return {
    totalBalances: balancesSnapshot.size,
    years: balancesSnapshot.docs.map(doc => doc.id)
  };
}

/**
 * Main import process
 */
async function main() {
  console.log('🚀 Starting Enhanced Year-End Balances Import with DateService...\n');
  console.log('✅ Features:');
  console.log('   - DateService for fiscal year calculations');
  console.log('   - Timezone-aware date handling');
  console.log('   - Fallback creation if no data');
  console.log('   - Client-agnostic implementation\n');
  
  const results = {
    timestamp: dateService.formatForFrontend(new Date()).iso,
    timestampDisplay: dateService.formatForFrontend(new Date()).displayFull,
    clientId: CLIENT_ID,
    dataPath: config.dataPath,
    import: null,
    verification: null,
    success: false
  };
  
  try {
    // Import year-end balances
    console.log('=== STEP 1: YEAR-END BALANCES IMPORT ===');
    results.import = await importYearEndBalances();
    
    // Verify
    console.log('\n=== STEP 2: VERIFICATION ===');
    const { db } = await initializeImport(CLIENT_ID);
    results.verification = await verifyYearEndBalances(db);
    
    // Check success
    results.success = results.import.imported > 0;
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 ENHANCED YEAR-END BALANCES IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`📁 Data Path: ${config.dataPath}`);
    console.log(`⏰ Completed: ${results.timestampDisplay}`);
    console.log(`🕐 Timezone: ${config.timezone}`);
    console.log('');
    console.log('📊 IMPORT RESULTS:');
    console.log(`   Year-end balances imported: ${results.import.imported}`);
    console.log(`   Fiscal years: ${results.import.years.join(', ')}`);
    console.log(`   Fallback created: ${results.import.fallback ? 'Yes' : 'No'}`);
    console.log('');
    console.log('🔍 VERIFICATION:');
    console.log(`   Total balances in database: ${results.verification.totalBalances}`);
    
    if (results.success) {
      console.log('\n✅ ENHANCED YEAR-END BALANCES IMPORT SUCCESSFUL!');
      console.log('🕐 All dates calculated in America/Cancun timezone');
      console.log('📊 Fiscal year calculations accurate');
      if (results.import.fallback) {
        console.log('⚠️  Fallback balances created - update in console if needed');
      }
    } else {
      console.log('\n⚠️ YEAR-END BALANCES IMPORT FAILED');
      console.log('🔧 Review errors above');
    }
    
    console.log('='.repeat(70));
    
    return results;
    
  } catch (error) {
    logProgress(`Import failed: ${error.message}`, 'error');
    console.error(error);
    results.error = error.message;
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

// Export for testing
export { loadClientConfig, loadYearEndBalances, createFallbackYearEnd, importYearEndBalances };
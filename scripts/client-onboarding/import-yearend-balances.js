#!/usr/bin/env node

/**
 * Import Year-End Balances
 * 
 * This script imports year-end balance snapshots from yearEndBalances.json
 * or creates a fallback zero-balance document if the file doesn't exist.
 * 
 * All years are treated as fiscal years based on client configuration.
 */

import { initializeFirebase } from './utils/environment-config.js';
import { getFiscalYear } from '../../backend/utils/fiscalYearUtils.js';
import fs from 'fs/promises';
import path from 'path';

// Get configuration from environment
const CLIENT_ID = process.env.IMPORT_CLIENT_ID || 'MTC';
const DATA_PATH = process.env.IMPORT_DATA_PATH || `../../${CLIENT_ID}data`;

/**
 * Load client configuration to get fiscal year settings
 */
async function loadClientConfig() {
  const configFile = path.join(DATA_PATH, 'client-config.json');
  try {
    const configData = JSON.parse(await fs.readFile(configFile, 'utf-8'));
    return configData;
  } catch (error) {
    console.error(`❌ Error loading client config: ${error.message}`);
    throw error;
  }
}

/**
 * Load year-end balances from JSON file
 */
async function loadYearEndBalances() {
  const balancesFile = path.join(DATA_PATH, 'yearEndBalances.json');
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
    
    return cleaned;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠️  No yearEndBalances.json found - will create fallback with zero balances');
      return null;
    }
    throw error;
  }
}

/**
 * Create fallback year-end balance with zero amounts
 */
function createFallbackYearEnd(clientConfig, fiscalYear) {
  const accounts = clientConfig.accounts || [];
  
  return {
    year: fiscalYear,
    created: new Date(),
    createdBy: 'import-fallback',
    accounts: accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      balance: 0
    })),
    note: 'Auto-created with zero balances - update in Firebase console if needed'
  };
}

/**
 * Import year-end balances to Firestore
 */
async function importYearEndBalances() {
  try {
    console.log('\n💰 Importing Year-End Balances...\n');
    console.log(`📁 Client: ${CLIENT_ID}`);
    console.log(`📁 Data path: ${DATA_PATH}`);
    
    // Initialize Firebase
    const { db } = await initializeFirebase();
    
    // Load client configuration
    const clientConfig = await loadClientConfig();
    // Get fiscalYearStartMonth from the configuration section (standard location)
    const fiscalYearStartMonth = clientConfig.configuration?.fiscalYearStartMonth || 1;
    console.log(`📅 Fiscal year starts in month: ${fiscalYearStartMonth}`);
    
    // Try to load year-end balances from file
    let yearEndData = await loadYearEndBalances();
    
    if (yearEndData && Object.keys(yearEndData).length > 0) {
      // Import provided year-end balances
      console.log(`✅ Found ${Object.keys(yearEndData).length} year-end balance(s) to import`);
      
      for (const [year, data] of Object.entries(yearEndData)) {
        const docRef = db.collection('clients').doc(CLIENT_ID)
          .collection('yearEndBalances').doc(year);
        
        const balanceDoc = {
          year: data.year,
          date: data.date ? new Date(data.date) : null,
          accounts: data.accounts,
          created: new Date(),
          createdBy: 'import-script'
        };
        
        await docRef.set(balanceDoc);
        
        console.log(`✅ Imported year-end balance for fiscal year ${year}`);
        console.log(`   Date: ${data.date || 'Not specified'}`);
        console.log(`   Accounts: ${data.accounts.length}`);
        
        let total = 0;
        data.accounts.forEach(acc => {
          console.log(`     - ${acc.name}: $${(acc.balance / 100).toFixed(2)}`);
          total += acc.balance;
        });
        console.log(`   Total: $${(total / 100).toFixed(2)}`);
      }
    } else {
      // Create fallback with zero balances
      console.log('⚠️  Creating fallback year-end balance with zero amounts');
      
      // Calculate the most recent completed fiscal year
      const currentDate = new Date();
      const currentFY = getFiscalYear(currentDate, fiscalYearStartMonth);
      
      // Determine if we're early in the fiscal year
      const currentMonth = currentDate.getMonth() + 1;
      const monthsIntoFY = currentMonth >= fiscalYearStartMonth 
        ? currentMonth - fiscalYearStartMonth + 1
        : (12 - fiscalYearStartMonth + 1) + currentMonth;
      
      // Use previous fiscal year as the most recent completed
      const mostRecentCompletedFY = monthsIntoFY <= 2 ? currentFY - 1 : currentFY - 1;
      
      console.log(`📅 Current fiscal year: ${currentFY}`);
      console.log(`📅 Most recent completed fiscal year: ${mostRecentCompletedFY}`);
      
      // Create and save fallback
      const fallback = createFallbackYearEnd(clientConfig, mostRecentCompletedFY);
      
      const docRef = db.collection('clients').doc(CLIENT_ID)
        .collection('yearEndBalances').doc(String(mostRecentCompletedFY));
      
      await docRef.set(fallback);
      
      console.log(`✅ Created fallback year-end balance for fiscal year ${mostRecentCompletedFY}`);
      console.log('   ⚠️  All accounts set to $0.00 - update in Firebase console if needed');
      console.log('   Accounts created:');
      fallback.accounts.forEach(acc => {
        console.log(`     - ${acc.name} (${acc.id}): $0.00`);
      });
    }
    
    console.log('\n✅ Year-end balance import completed successfully!\n');
    
  } catch (error) {
    console.error(`\n❌ Error importing year-end balances: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Export for use in other scripts
export { importYearEndBalances };

// Run if called directly
// Always run when this file is executed
importYearEndBalances()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
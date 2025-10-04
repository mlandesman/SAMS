/**
 * Modern Year-End Balances Import
 * Uses controllers and DateService for all operations
 * 
 * Phase 2: Import Script Modernization
 * Date: 2025-09-29
 */

import { initializeFirebase, getDb } from '../backend/firebase.js';
import { createYearEndBalance } from '../backend/controllers/yearEndBalancesController.js';
import { getFiscalYear } from '../backend/utils/fiscalYearUtils.js';
import { 
  createMockContext, 
  createDateService,
  ProgressLogger,
  handleControllerResponse,
  loadJsonData,
  createImportSummary
} from './utils/import-utils-modern.js';
import path from 'path';
import fs from 'fs/promises';

const CLIENT_ID = 'MTC';
const DATA_PATH = `./MTCdata`;

/**
 * Load client configuration to get fiscal year settings
 */
async function loadClientConfig() {
  const configFile = path.join(DATA_PATH, 'client-config.json');
  try {
    return await loadJsonData(configFile);
  } catch (error) {
    console.log('⚠️  No client config found - using defaults');
    return {
      fiscalYearStart: 'calendar',
      accounts: []
    };
  }
}

/**
 * Load year-end balances from JSON file
 */
async function loadYearEndBalances() {
  const balancesFile = path.join(DATA_PATH, 'yearEndBalances.json');
  try {
    const balances = await loadJsonData(balancesFile);
    
    // Clean and normalize data
    const cleaned = {};
    for (const [year, yearData] of Object.entries(balances)) {
      if (!year.startsWith('_') && yearData.accounts) {
        cleaned[year] = {
          year: parseInt(year),
          date: yearData.date,
          accounts: yearData.accounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            balance: parseFloat(acc.balance) || 0
          }))
        };
      }
    }
    
    return cleaned;
  } catch (error) {
    if (error.message.includes('ENOENT')) {
      console.log('⚠️  No yearEndBalances.json found - will create fallback with zero balances');
      return null;
    }
    throw error;
  }
}

/**
 * Get or create accounts mapping
 */
async function getAccountsMapping(db) {
  console.log('🔗 Loading accounts mapping...');
  
  const accountsRef = db.collection('clients').doc(CLIENT_ID).collection('accounts');
  const accountsSnapshot = await accountsRef.get();
  
  const accountsMap = {};
  accountsSnapshot.forEach(doc => {
    const account = doc.data();
    accountsMap[account.accountId || doc.id] = {
      id: doc.id,
      name: account.name,
      type: account.type
    };
  });
  
  console.log(`✅ Loaded ${Object.keys(accountsMap).length} account mappings`);
  return accountsMap;
}

/**
 * Create fallback year-end balance with zero amounts
 */
function createFallbackYearEnd(accountsMap, fiscalYear, dateService) {
  const yearEndDate = dateService.getEndOfYear(fiscalYear);
  
  return {
    year: fiscalYear,
    date: yearEndDate.toISO(),
    created: new Date().toISOString(),
    createdBy: 'import-fallback',
    accounts: Object.entries(accountsMap).map(([id, account]) => ({
      id: id,
      name: account.name,
      balance: 0
    })),
    note: 'Auto-created with zero balances - update in Firebase console if needed'
  };
}

/**
 * Import year-end balances using controller
 */
async function importBalances(balancesData, accountsMap, mockContext, dateService) {
  console.log('\n💰 Importing Year-End Balances...\n');
  
  const years = Object.keys(balancesData);
  const logger = new ProgressLogger('Year-End Balances', years.length);
  const balanceIds = [];
  
  for (const year of years) {
    try {
      const yearData = balancesData[year];
      
      // Prepare balance data for controller
      const balancePayload = {
        fiscalYear: yearData.year,
        date: yearData.date || dateService.getEndOfYear(yearData.year).toISO(),
        accounts: {},
        totals: {
          assets: 0,
          liabilities: 0,
          equity: 0,
          netPosition: 0
        },
        metadata: {
          source: 'import',
          importDate: new Date().toISOString(),
          originalData: yearData
        }
      };
      
      // Map accounts and calculate totals
      for (const acc of yearData.accounts) {
        const accountInfo = accountsMap[acc.id];
        if (accountInfo) {
          balancePayload.accounts[accountInfo.id] = {
            accountId: accountInfo.id,
            accountName: accountInfo.name,
            balance: acc.balance,
            type: accountInfo.type
          };
          
          // Update totals based on account type
          if (accountInfo.type === 'asset') {
            balancePayload.totals.assets += acc.balance;
          } else if (accountInfo.type === 'liability') {
            balancePayload.totals.liabilities += acc.balance;
          } else if (accountInfo.type === 'equity') {
            balancePayload.totals.equity += acc.balance;
          }
        }
      }
      
      // Calculate net position
      balancePayload.totals.netPosition = 
        balancePayload.totals.assets - balancePayload.totals.liabilities;
      
      // Call controller
      mockContext.req.body = balancePayload;
      const result = await createYearEndBalance(CLIENT_ID, balancePayload, mockContext.req.user);
      
      const balanceId = handleControllerResponse(result);
      if (balanceId) {
        balanceIds.push(balanceId);
        logger.logItem(`Year ${year}`, 'success');
      } else {
        logger.logItem(`Year ${year}`, 'error');
      }
      
    } catch (error) {
      logger.logError(`Year ${year}`, error);
    }
  }
  
  const summary = logger.logSummary();
  summary.balanceIds = balanceIds;
  return summary;
}

/**
 * Verify imports
 */
async function verifyImports() {
  console.log('\n🔍 Verifying imports...\n');
  
  const db = await getDb();
  const balancesRef = db.collection('clients').doc(CLIENT_ID).collection('yearEndBalances');
  const auditLogsRef = db.collection('auditLogs');
  
  const balancesSnapshot = await balancesRef.orderBy('fiscalYear', 'desc').get();
  
  console.log(`💰 Year-end balances in database: ${balancesSnapshot.size}`);
  
  if (balancesSnapshot.size > 0) {
    console.log('\n📊 Year-end balances by year:');
    balancesSnapshot.forEach(doc => {
      const data = doc.data();
      const accountCount = Object.keys(data.accounts || {}).length;
      console.log(`   ${data.fiscalYear}: ${accountCount} accounts, Net: $${data.totals?.netPosition?.toFixed(2) || '0.00'}`);
    });
  }
  
  // Check recent audit logs
  const auditSnapshot = await auditLogsRef
    .where('clientId', '==', CLIENT_ID)
    .where('module', '==', 'yearEndBalances')
    .orderBy('timestamp', 'desc')
    .limit(10)
    .get();
  
  console.log(`\n📝 Recent audit logs: ${auditSnapshot.size}`);
  
  return {
    balances: balancesSnapshot.size,
    auditLogs: auditSnapshot.size
  };
}

/**
 * Main import process
 */
async function main() {
  console.log('🚀 Starting Modern Year-End Balances Import...\n');
  const startTime = Date.now();
  
  try {
    // Initialize Firebase
    await initializeFirebase();
    const db = await getDb();
    
    // Create mock context for controllers
    const { req, res } = createMockContext(CLIENT_ID);
    const mockContext = { req, res };
    
    // Create DateService
    const dateService = createDateService();
    
    // Load client configuration
    const clientConfig = await loadClientConfig();
    
    // Get accounts mapping
    const accountsMap = await getAccountsMapping(db);
    
    // Load year-end balances data
    let balancesData = await loadYearEndBalances();
    
    // If no data, create fallback
    if (!balancesData) {
      const currentFiscalYear = getFiscalYear(new Date(), clientConfig.fiscalYearStart);
      const fallbackYear = currentFiscalYear - 1; // Previous year
      
      balancesData = {
        [fallbackYear]: createFallbackYearEnd(accountsMap, fallbackYear, dateService)
      };
      
      console.log(`📝 Created fallback year-end balance for fiscal year ${fallbackYear}`);
    }
    
    console.log(`✅ Processing ${Object.keys(balancesData).length} year-end balances\n`);
    
    // Import balances
    const balancesResult = await importBalances(balancesData, accountsMap, mockContext, dateService);
    
    // Verify imports
    const verification = await verifyImports();
    
    // Create summary
    const summary = createImportSummary('Year-End Balances Import', {
      total: balancesResult.total,
      success: balancesResult.success,
      duplicates: balancesResult.duplicates,
      errors: balancesResult.errors,
      balances: balancesResult,
      verification: verification
    }, startTime);
    
    // Final report
    console.log('\n' + '='.repeat(70));
    console.log('💰 MODERN YEAR-END BALANCES IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log(`🎯 Client: ${CLIENT_ID}`);
    console.log(`⏰ Duration: ${summary.duration}`);
    console.log(`💰 Year-end balances: ${balancesResult.success}/${balancesResult.total} imported`);
    console.log(`📝 Audit logs created: ${verification.auditLogs}`);
    
    if (summary.success) {
      console.log('\n✅ IMPORT SUCCESSFUL!');
    } else {
      console.log('\n⚠️ IMPORT COMPLETED WITH ERRORS');
      console.log('Please review the errors above before proceeding.');
    }
    
    console.log('='.repeat(70));
    
    return summary;
    
  } catch (error) {
    console.error('\n💥 Import failed:', error);
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

export { importBalances, main as performYearEndBalancesImport };
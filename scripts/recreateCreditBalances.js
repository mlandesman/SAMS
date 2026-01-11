#!/usr/bin/env node
/**
 * Recreate creditBalances from Running Balance
 * 
 * This script computes what the creditBalances.history SHOULD be based on
 * the running balance changes in the statement. It's designed to fix legacy
 * data where "Account Credit" imports didn't properly record in creditBalances.
 * 
 * Usage:
 *   node recreateCreditBalances.js --client=AVII                    # Dry run for all AVII units
 *   node recreateCreditBalances.js --client=AVII --unit=103         # Dry run for specific unit
 *   node recreateCreditBalances.js --client=AVII --apply            # Actually update Dev
 *   node recreateCreditBalances.js --client=AVII --apply --prod     # Actually update PROD via ADC
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs, { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for --prod flag
const isProd = process.argv.includes('--prod');
const devProjectId = 'sandyland-management-system';
const prodProjectId = 'sams-sandyland-prod';

// Initialize Firebase based on environment
if (!admin.apps.length) {
  if (isProd) {
    // Production: Use Application Default Credentials (ADC)
    // Clear any stale GOOGLE_APPLICATION_CREDENTIALS
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS.includes('/path/to/') || 
         !existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: prodProjectId
    });
    console.log('🔴 PRODUCTION MODE - Using ADC for', prodProjectId);
  } else {
    // Dev: Use service account key
    const serviceAccountPath = join(__dirname, '../backend/serviceAccountKey.json');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('🟢 DEV MODE - Using service account for', devProjectId);
  }
}

const db = admin.firestore();

// Import statement data service
import { createApiClient } from '../backend/testing/apiClient.js';
import { getStatementData } from '../functions/backend/services/statementDataService.js';

/**
 * Format currency
 */
function formatPesos(amount) {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Calculate credit flow events from running balance changes
 * Returns entries ready for creditBalances.history format (amounts in centavos)
 */
function calculateCreditHistoryFromRunningBalance(lineItems, openingBalance, fiscalYearStart) {
  const entries = [];
  let prevBalance = openingBalance;
  let runningCreditBalance = openingBalance < 0 ? Math.abs(openingBalance) * 100 : 0; // In centavos
  
  // Add starting_balance entry - use day BEFORE fiscal year start
  // and use ISO string format to match Prod data structure
  if (openingBalance < 0) {
    const dayBefore = new Date(fiscalYearStart);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(17, 0, 0, 0); // 5PM UTC to match Prod format
    
    entries.push({
      id: `credit_${Date.now()}_0`,
      type: 'starting_balance',
      amount: Math.abs(openingBalance) * 100, // Positive centavos
      timestamp: dayBefore.toISOString(), // STRING format like Prod
      notes: 'Opening Balance',
      source: 'running_balance_computation'
    });
  }
  
  for (const item of lineItems) {
    const currentBalance = item.balance;
    const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
    
    // Skip if invalid date
    if (isNaN(itemDate.getTime())) continue;
    
    // Detect credit consumption: when balance goes from negative toward positive due to CHARGE
    if (prevBalance < 0 && item.charge > 0) {
      const creditUsed = Math.min(Math.abs(prevBalance), item.charge);
      if (creditUsed > 0.01) {
        runningCreditBalance -= creditUsed * 100;
        entries.push({
          id: `credit_${Date.now()}_${entries.length}`,
          type: 'credit_used',
          amount: -Math.round(creditUsed * 100), // Negative centavos
          timestamp: itemDate.toISOString(), // STRING format like Prod
          notes: `Used to pay ${item.description}`,
          source: 'running_balance_computation'
        });
      }
    }
    
    // Detect credit creation: when a payment pushes balance negative
    if (item.payment > 0 && currentBalance < 0) {
      let creditCreated;
      if (prevBalance >= 0) {
        creditCreated = Math.abs(currentBalance);
      } else {
        creditCreated = Math.abs(currentBalance) - Math.abs(prevBalance);
      }
      
      if (creditCreated > 0.01) {
        const creditCreatedCentavos = Math.round(creditCreated * 100);
        entries.push({
          id: `credit_${Date.now()}_${entries.length}`,
          type: 'credit_added',
          amount: creditCreatedCentavos, // Positive centavos
          timestamp: itemDate.toISOString(), // STRING format like Prod
          notes: `Overpayment from ${item.description}`,
          source: 'running_balance_computation'
        });
        runningCreditBalance += creditCreatedCentavos;
      }
    }
    
    prevBalance = currentBalance;
  }
  
  return {
    entries,
    finalBalance: runningCreditBalance
  };
}

/**
 * Determine the correct creditBalances document name based on fiscal year
 * MTC: fiscal year starts January (month 1)
 * AVII: fiscal year starts July (month 7)
 */
function getCreditBalancesDocName(fiscalYear, clientId) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // Determine fiscal year start month based on client
  const fiscalYearStartMonth = clientId === 'AVII' ? 7 : 1;
  
  // Calculate current fiscal year
  let currentFiscalYear;
  if (fiscalYearStartMonth === 1) {
    currentFiscalYear = currentYear;
  } else {
    currentFiscalYear = currentMonth >= fiscalYearStartMonth ? currentYear + 1 : currentYear;
  }
  
  // Use creditBalances for current fiscal year, creditBalances_YYYY for past years
  if (fiscalYear === currentFiscalYear) {
    return 'creditBalances';
  } else {
    return `creditBalances_${fiscalYear}`;
  }
}

/**
 * Get current creditBalances for a client
 */
async function getCurrentCreditBalances(clientId, fiscalYear) {
  const docName = getCreditBalancesDocName(fiscalYear, clientId);
  console.log(`   Using document: ${docName}`);
  const ref = db.collection('clients').doc(clientId).collection('units').doc(docName);
  const doc = await ref.get();
  return doc.exists ? doc.data() : {};
}

/**
 * Get all units for a client
 */
async function getClientUnits(clientId) {
  const unitsSnapshot = await db.collection('clients').doc(clientId).collection('units').get();
  const units = [];
  for (const doc of unitsSnapshot.docs) {
    if (doc.id === 'creditBalances' || doc.id.startsWith('creditBalances_')) continue;
    units.push(doc.id);
  }
  return units.sort((a, b) => {
    const aNum = parseInt(a);
    const bNum = parseInt(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return a.localeCompare(b);
  });
}

/**
 * Process a single unit
 */
async function processUnit(api, clientId, unitId, fiscalYear, currentCreditBalances) {
  const result = {
    unitId,
    success: false,
    currentEntryCount: 0,
    newEntryCount: 0,
    entries: [],
    finalBalance: 0,
    error: null
  };
  
  try {
    // Get statement data
    const data = await getStatementData(api, clientId, unitId, fiscalYear);
    
    if (!data || !data.lineItems) {
      result.error = 'No statement data';
      return result;
    }
    
    // Get fiscal year start date
    const fiscalYearStart = new Date(data.statementInfo?.fiscalYearBounds?.startDate || `${fiscalYear - 1}-07-01`);
    
    // Calculate new credit history from running balance
    const computed = calculateCreditHistoryFromRunningBalance(
      data.lineItems,
      data.summary?.openingBalance || 0,
      fiscalYearStart
    );
    
    result.entries = computed.entries;
    result.newEntryCount = computed.entries.length;
    result.finalBalance = computed.finalBalance / 100; // Convert to pesos for display
    result.currentEntryCount = currentCreditBalances[unitId]?.history?.length || 0;
    result.success = true;
    
  } catch (error) {
    result.error = error.message;
  }
  
  return result;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse --key=value style arguments
  const getArgValue = (key) => {
    const arg = args.find(a => a.startsWith(`--${key}=`));
    return arg ? arg.split('=')[1] : null;
  };
  
  const clientId = getArgValue('client') || 'AVII';
  const specificUnit = getArgValue('unit');
  const applyChanges = args.includes('--apply');
  const fiscalYear = parseInt(getArgValue('year') || '2026', 10);
  
  console.log('='.repeat(70));
  console.log(`📊 RECREATE creditBalances FROM RUNNING BALANCE`);
  console.log(`   Client: ${clientId}`);
  console.log(`   Fiscal Year: ${fiscalYear}`);
  console.log(`   Mode: ${applyChanges ? '🔴 APPLY CHANGES' : '🟢 DRY RUN'}`);
  if (specificUnit) console.log(`   Unit: ${specificUnit}`);
  console.log('='.repeat(70));
  
  // Get API client
  const api = await createApiClient();
  
  // Get current creditBalances
  const currentCreditBalances = await getCurrentCreditBalances(clientId, fiscalYear);
  
  // Get units to process
  const units = specificUnit ? [specificUnit] : await getClientUnits(clientId);
  console.log(`\n📋 Processing ${units.length} units...\n`);
  
  const results = [];
  const newCreditBalances = { ...currentCreditBalances };
  
  for (const unitId of units) {
    process.stdout.write(`   Processing ${unitId}... `);
    const result = await processUnit(api, clientId, unitId, fiscalYear, currentCreditBalances);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.newEntryCount} entries (was ${result.currentEntryCount})`);
      
      // Build new unit credit data
      // Note: Don't include 'balance' field - it's not used and was causing confusion
      if (result.entries.length > 0) {
        newCreditBalances[unitId] = {
          history: result.entries // Already has string timestamps
        };
      }
    } else {
      console.log(`❌ ${result.error}`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  // Show details for each unit
  console.log('\n📋 UNIT DETAILS:');
  for (const result of successful) {
    console.log(`\n   ${clientId} Unit ${result.unitId}:`);
    console.log(`   Current entries: ${result.currentEntryCount}`);
    console.log(`   New entries: ${result.newEntryCount}`);
    console.log(`   Final balance: $${formatPesos(result.finalBalance)}`);
    
    if (result.entries.length > 0 && result.entries.length <= 15) {
      console.log('   Entries:');
      result.entries.forEach((entry, i) => {
        // Timestamps are now ISO strings
        const dateStr = typeof entry.timestamp === 'string' 
          ? entry.timestamp.split('T')[0] 
          : 'unknown';
        const amountPesos = (entry.amount || 0) / 100;
        const sign = amountPesos >= 0 ? '+' : '';
        console.log(`      [${i}] ${dateStr} | ${entry.type} | ${sign}$${formatPesos(amountPesos)} | ${entry.notes}`);
      });
    } else if (result.entries.length > 15) {
      console.log(`   (${result.entries.length} entries - too many to show)`);
    }
  }
  
  if (applyChanges) {
    const docName = getCreditBalancesDocName(fiscalYear, clientId);
    console.log(`\n🔴 APPLYING CHANGES TO FIRESTORE (${docName})...`);
    
    const ref = db.collection('clients').doc(clientId).collection('units').doc(docName);
    await ref.set(newCreditBalances, { merge: true });
    
    console.log('✅ Changes applied successfully!');
  } else {
    console.log('\n🟢 DRY RUN - No changes made.');
    console.log('   Run with --apply to update Firestore.');
  }
  
  console.log('\n' + '='.repeat(70));
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

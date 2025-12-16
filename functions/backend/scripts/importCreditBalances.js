/**
 * Import Credit Balances from creditBalances.json
 * 
 * Reads creditBalances.json from Firebase Storage imports bucket
 * and writes to /clients/{clientId}/units/creditBalances document
 * 
 * Usage: node backend/scripts/importCreditBalances.js [clientId]
 * Example: node backend/scripts/importCreditBalances.js AVII
 */

import admin from 'firebase-admin';
import { getDb } from '../firebase.js';
import { getNow } from '../../shared/services/DateService.js';

// Determine storage bucket based on environment
function getStorageBucket() {
  if (process.env.NODE_ENV === 'production') {
    return 'sams-sandyland-prod.firebasestorage.app';
  } else if (process.env.NODE_ENV === 'staging') {
    return 'sams-staging-6cdcd.firebasestorage.app';
  }
  return 'sandyland-management-system.firebasestorage.app';
}

/**
 * Parse date string from various formats
 */
function parseDate(dateText) {
  if (!dateText) return null;
  
  // Try parsing as ISO string or date string
  try {
    const date = new Date(dateText);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (e) {
    // Continue to other parsing methods
  }
  
  // Try parsing formats like "Jul 23 2025"
  const monthMap = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  const parts = dateText.trim().split(/\s+/);
  if (parts.length >= 3 && monthMap[parts[0]]) {
    const month = monthMap[parts[0]];
    const day = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    if (!isNaN(day) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  
  return null;
}

/**
 * Convert pesos to centavos
 */
function pesosToCentavos(pesos) {
  if (!pesos || isNaN(pesos)) return 0;
  return Math.round(pesos * 100);
}

/**
 * Determine entry type from description
 */
function determineEntryType(entry, previousBalance, currentBalance) {
  // Check if it's a starting balance (first entry with startingBalance)
  if (entry.fromText?.toLowerCase().includes('starting balance') || 
      entry.fromText === '') {
    return 'starting_balance';
  }
  
  // Check if credit was used
  if (entry.fromText?.toLowerCase().includes('credit used') ||
      entry.fromText?.toLowerCase().includes('use of credit') ||
      entry.fromText?.toLowerCase().includes('used to') ||
      entry.fromText?.toLowerCase().includes('to pay')) {
    return 'credit_used';
  }
  
  // Check if credit was added (overpayment, deposit, etc.)
  if (entry.fromText?.toLowerCase().includes('overpayment') ||
      entry.fromText?.toLowerCase().includes('deposit') ||
      entry.fromText?.toLowerCase().includes('refund') ||
      entry.fromText?.toLowerCase().includes('added') ||
      entry.fromText?.toLowerCase().includes('conversion')) {
    return 'credit_added';
  }
  
  // Default: if balance increased, it's credit_added; if decreased, credit_used
  const balanceChange = currentBalance - previousBalance;
  return balanceChange > 0 ? 'credit_added' : 'credit_used';
}

/**
 * Convert creditBalances.json entry to Firestore history entry
 */
function convertEntryToHistory(entry, previousBalance, currentBalance, index) {
  const date = parseDate(entry.dateText);
  const type = determineEntryType(entry, previousBalance, currentBalance);
  
  // Calculate amount (absolute difference)
  const amount = Math.abs(currentBalance - previousBalance);
  
  return {
    id: `entry_${index}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    timestamp: date ? admin.firestore.Timestamp.fromDate(date) : admin.firestore.Timestamp.now(),
    transactionId: entry.transactionId || null,
    type: type,
    amount: pesosToCentavos(amount),
    description: entry.fromText || entry.text || '',
    balanceBefore: pesosToCentavos(previousBalance),
    balanceAfter: pesosToCentavos(currentBalance),
    notes: entry.details || entry.text || entry.fromText || ''
  };
}

/**
 * Process unit credit balance data
 */
function processUnitCreditBalance(unitId, unitData) {
  const history = [];
  let currentBalance = unitData.startingBalance || 0;
  
  // Add starting balance entry if not zero
  if (currentBalance !== 0) {
    // Get fiscal year start date (AVII uses July 1)
    const now = getNow();
    const currentYear = now.getFullYear();
    const fiscalYearStart = new Date(currentYear, 6, 1); // July 1
    
    history.push({
      id: `starting_balance_${Date.now()}`,
      timestamp: admin.firestore.Timestamp.fromDate(fiscalYearStart),
      transactionId: null,
      type: 'starting_balance',
      amount: pesosToCentavos(Math.abs(currentBalance)),
      description: 'Starting credit balance from prior period',
      balanceBefore: 0,
      balanceAfter: pesosToCentavos(currentBalance),
      notes: 'Imported from creditBalances.json'
    });
  }
  
  // Process entries
  let previousBalance = currentBalance;
  unitData.entries.forEach((entry, index) => {
    if (entry.unparsed) {
      // Skip unparsed entries for now
      console.warn(`⚠️  Skipping unparsed entry for unit ${unitId}: ${entry.text}`);
      return;
    }
    
    if (entry.adjustedBalanceMxn !== undefined && !isNaN(entry.adjustedBalanceMxn)) {
      currentBalance = entry.adjustedBalanceMxn;
      const historyEntry = convertEntryToHistory(entry, previousBalance, currentBalance, index);
      history.push(historyEntry);
      previousBalance = currentBalance;
    }
  });
  
  return {
    creditBalance: pesosToCentavos(currentBalance),
    lastChange: {
      year: new Date().getFullYear().toString(),
      historyIndex: history.length - 1,
      timestamp: getNow().toISOString()
    },
    history: history
  };
}

/**
 * Main import function
 */
async function importCreditBalances(clientId) {
  try {
    console.log(`\n📥 Starting credit balances import for ${clientId}...`);
    
    // Initialize Firebase
    const db = await getDb();
    const bucket = admin.storage().bucket();
    
    // Read creditBalances.json from storage or local file
    let creditBalancesData;
    
    try {
      console.log('📂 Reading creditBalances.json from imports bucket...');
      const file = bucket.file('imports/creditBalances.json');
      const [exists] = await file.exists();
      
      if (exists) {
        const [fileContents] = await file.download();
        creditBalancesData = JSON.parse(fileContents.toString());
        console.log('✅ Loaded from Firebase Storage');
      } else {
        throw new Error('Not found in storage');
      }
    } catch (storageError) {
      // Fallback to local file
      console.log('📂 Trying local file: backend/data/imports/creditBalances.json');
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const localPath = path.join(__dirname, '../../data/imports/creditBalances.json');
      
      if (fs.existsSync(localPath)) {
        const fileContents = fs.readFileSync(localPath, 'utf8');
        creditBalancesData = JSON.parse(fileContents);
        console.log('✅ Loaded from local file');
      } else {
        // Try alternative path
        const altPath = path.join(__dirname, '../data/imports/creditBalances.json');
        if (fs.existsSync(altPath)) {
          const fileContents = fs.readFileSync(altPath, 'utf8');
          creditBalancesData = JSON.parse(fileContents);
          console.log('✅ Loaded from local file (alt path)');
        } else {
          throw new Error(`creditBalances.json not found in storage or local paths:\n  - imports/creditBalances.json (storage)\n  - ${localPath}\n  - ${altPath}`);
        }
      }
    }
    
    console.log(`✅ Loaded credit balances for ${Object.keys(creditBalancesData).length} units`);
    
    // Get existing creditBalances document
    const creditBalancesRef = db.collection('clients').doc(clientId)
      .collection('units').doc('creditBalances');
    const creditBalancesDoc = await creditBalancesRef.get();
    const allCreditBalances = creditBalancesDoc.exists ? creditBalancesDoc.data() : {};
    
    // Process each unit
    let processed = 0;
    let skipped = 0;
    
    for (const [unitId, unitData] of Object.entries(creditBalancesData)) {
      try {
        console.log(`\n📋 Processing unit ${unitId}...`);
        console.log(`   Starting Balance: ${unitData.startingBalance || 0} MXN`);
        console.log(`   Entries: ${unitData.entries.length}`);
        
        const processedData = processUnitCreditBalance(unitId, unitData);
        
        // Update in allCreditBalances object
        allCreditBalances[unitId] = processedData;
        
        console.log(`   ✅ Processed: ${processedData.history.length} history entries`);
        console.log(`   Final Balance: ${processedData.creditBalance / 100} MXN (${processedData.creditBalance} centavos)`);
        
        processed++;
      } catch (error) {
        console.error(`   ❌ Error processing unit ${unitId}:`, error.message);
        skipped++;
      }
    }
    
    // Write to Firestore
    console.log(`\n💾 Writing to Firestore...`);
    await creditBalancesRef.set(allCreditBalances);
    
    console.log(`\n✅ Import complete!`);
    console.log(`   Processed: ${processed} units`);
    console.log(`   Skipped: ${skipped} units`);
    console.log(`   Written to: clients/${clientId}/units/creditBalances`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const clientId = args[0] || 'AVII';
  
  if (!clientId) {
    console.error('Usage: node backend/scripts/importCreditBalances.js [clientId]');
    console.error('Example: node backend/scripts/importCreditBalances.js AVII');
    process.exit(1);
  }
  
  try {
    await importCreditBalances(clientId);
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
